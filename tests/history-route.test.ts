import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../app/api/history/route";
import { readHistory } from "../utils/history";
vi.mock("server-only", () => ({}));
vi.mock("../utils/history", () => ({ readHistory: vi.fn() }));
beforeEach(() => vi.mocked(readHistory).mockReset().mockResolvedValue([]));

it("returns uncached history and applies the game and adult-content filter", async () => {
  const response = await GET(new NextRequest("http://localhost/api/history?game=fallout4&boobs=true"));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(readHistory).toHaveBeenCalledExactlyOnceWith("fallout4", true);
});
it("rejects invalid games without opening the database", async () => {
  expect((await GET(new NextRequest("http://localhost/api/history?game=../users"))).status).toBe(400);
  expect(readHistory).not.toHaveBeenCalled();
});
it("reports database failures without exposing server paths or exception details", async () => {
  vi.mocked(readHistory).mockRejectedValueOnce(new Error("secret-database-path"));
  const response = await GET(new NextRequest("http://localhost/api/history?game=fallout4"));
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("secret-database-path");
});
