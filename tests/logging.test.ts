import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../app/api/getGameInfo/route";

vi.mock("server-only", () => ({}));
const entries: Record<string, unknown>[] = [];
beforeEach(() => {
  entries.length = 0;
  vi.stubEnv("NEXUSMODS_KEY", "secret-test-key");
  vi.stubEnv("LOG_LEVEL", "info");
  for (const method of ["info", "warn", "error", "debug"] as const) {
    vi.spyOn(console, method).mockImplementation((line: string) => { entries.push(JSON.parse(line)); });
  }
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const request = () => new NextRequest("http://localhost/api/getGameInfo?game=fallout4&apikey=secret-query");

it("correlates incoming and upstream requests with status and duration", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ categories: [] })));
  const response = await GET(request());
  const id = response.headers.get("x-request-id");
  expect(id).toBeTruthy();
  expect(entries.map((entry) => entry.event)).toEqual(["request.started", "nexus.completed", "request.completed"]);
  expect(entries.every((entry) => entry.requestId === id)).toBe(true);
  expect(entries[1]).toMatchObject({ status: 200, level: "info", path: "games/fallout4.json" });
  expect(entries[2]).toMatchObject({ status: 200, level: "info", route: "/api/getGameInfo", game: "fallout4" });
  expect(entries[2].durationMs).toBeGreaterThanOrEqual(0);
});

it("logs upstream errors without headers, query secrets, or response bodies", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ message: "secret-body" }, { status: 401 })));
  expect((await GET(request())).status).toBe(401);
  expect(entries.find((entry) => entry.event === "nexus.failed")).toMatchObject({ status: 401, level: "warn" });
  expect(entries.at(-1)).toMatchObject({ status: 401, level: "warn" });
  expect(JSON.stringify(entries)).not.toMatch(/secret-/);
});

it("logs network failures without arbitrary exception messages", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("secret-test-key secret-network-url"); }));
  expect((await GET(request())).status).toBe(502);
  expect(entries.find((entry) => entry.event === "nexus.failed")).toMatchObject({ level: "error", errorType: "TypeError" });
  expect(JSON.stringify(entries)).not.toMatch(/secret-/);
});

it("keeps concurrent request identifiers separate", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => { await Promise.resolve(); return Response.json({ categories: [] }); }));
  const responses = await Promise.all([GET(request()), GET(request())]);
  const ids = responses.map((response) => response.headers.get("x-request-id"));
  expect(new Set(ids).size).toBe(2);
  for (const id of ids) expect(entries.filter((entry) => entry.requestId === id).map((entry) => entry.event))
    .toEqual(["request.started", "nexus.completed", "request.completed"]);
});

it("honors LOG_LEVEL while preserving request identifiers", async () => {
  vi.stubEnv("LOG_LEVEL", "warn");
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ categories: [] })));
  expect((await GET(request())).headers.get("x-request-id")).toBeTruthy();
  expect(entries).toEqual([]);
});

it("does not fail an otherwise successful request if logging fails", async () => {
  vi.spyOn(console, "info").mockImplementation(() => { throw new Error("output unavailable"); });
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ categories: [] })));
  expect((await GET(request())).status).toBe(200);
});

it("logs client cancellation as informational rather than a server failure", async () => {
  const controller = new AbortController();
  vi.stubGlobal("fetch", vi.fn((_url: string, options: RequestInit) => new Promise<Response>((_, reject) => {
    options.signal?.addEventListener("abort", () => reject(options.signal?.reason), { once: true });
  })));
  const pending = GET(new NextRequest("http://localhost/api/getGameInfo?game=fallout4", { signal: controller.signal }));
  controller.abort();
  expect((await pending).status).toBe(499);
  expect(entries.find((entry) => entry.event === "nexus.failed")).toMatchObject({ level: "info", errorStatus: 499 });
  expect(entries.at(-1)).toMatchObject({ level: "info", status: 499 });
});

it("distinguishes a timeout from a network failure", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => { throw new DOMException("secret-timeout", "TimeoutError"); }));
  expect((await GET(request())).status).toBe(504);
  expect(entries.find((entry) => entry.event === "nexus.failed")).toMatchObject({ level: "error", errorStatus: 504, errorType: "TimeoutError" });
});

it("enables upstream start events at debug level", async () => {
  vi.stubEnv("LOG_LEVEL", "debug");
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ categories: [] })));
  await GET(request());
  expect(entries.find((entry) => entry.event === "nexus.started")).toMatchObject({ level: "debug", cachePolicy: "force-cache", revalidateSeconds: 86400 });
});
