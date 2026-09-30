import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as getMod } from "../app/api/getModInfo/route";
import { GET as getLast } from "../app/api/getLastModId/route";
import { GET as getGame } from "../app/api/getGameInfo/route";
import { recordRoll } from "../utils/history";

vi.mock("server-only", () => ({}));
vi.mock("../utils/history", () => ({ recordRoll: vi.fn(async () => {}) }));
const request = (game = "skyrimspecialedition", signal?: AbortSignal) =>
  new NextRequest(`http://localhost/api?game=${game}`, { signal });
const published = { mod_id: 7, status: "published", available: true, contains_adult_content: false, category_id: 1 };

function useControlledDeadlines() {
  vi.useFakeTimers();
  // Native AbortSignal.timeout uses an internal clock. Drive its public signal with Vitest's clock.
  vi.spyOn(AbortSignal, "timeout").mockImplementation((ms) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(new DOMException("Timed out", "TimeoutError")), ms);
    return controller.signal;
  });
}

beforeEach(() => {
  vi.stubEnv("NEXUSMODS_KEY", "test-key");
  vi.mocked(recordRoll).mockReset().mockResolvedValue(undefined);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

describe("Nexusmods routes", () => {
  it("stops waiting for history persistence when the client cancels", async () => {
    const controller = new AbortController();
    vi.mocked(recordRoll).mockImplementationOnce((_record, signal) => new Promise((_, reject) => {
      signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
    }));
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(Response.json([{ mod_id: 10 }]))
      .mockResolvedValueOnce(Response.json(published)));
    const pending = getMod(request("skyrimspecialedition", controller.signal));
    await vi.waitFor(() => expect(recordRoll).toHaveBeenCalled());
    controller.abort();
    expect((await pending).status).toBe(499);
  });

  it("includes history persistence in the twenty-second request budget", async () => {
    useControlledDeadlines();
    vi.mocked(recordRoll).mockImplementationOnce((_record, signal) => new Promise((_, reject) => {
      signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
    }));
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(Response.json([{ mod_id: 10 }]))
      .mockResolvedValueOnce(Response.json(published)));
    const pending = getMod(request());
    await vi.advanceTimersByTimeAsync(20_000);
    expect((await pending).status).toBe(504);
    expect(recordRoll).toHaveBeenCalled();
  });
  it("records only the selected mod, not skipped candidates", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(Response.json([{ mod_id: 10 }]))
      .mockResolvedValueOnce(Response.json({}, { status: 404 }))
      .mockResolvedValueOnce(Response.json({ ...published, name: "Companion" })));
    expect((await getMod(request())).status).toBe(200);
    expect(recordRoll).toHaveBeenCalledExactlyOnceWith({ game: "skyrimspecialedition", modId: 7, name: "Companion", adult: false }, expect.any(AbortSignal));
  });

  it("keeps a found mod available but reports a failed history write", async () => {
    vi.mocked(recordRoll).mockRejectedValueOnce(new Error("disk unavailable"));
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(Response.json([{ mod_id: 10 }]))
      .mockResolvedValueOnce(Response.json(published)));
    const response = await getMod(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ mod_id: 7, historySaved: false });
  });

  it("does not record an unsuccessful search", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({}, { status: 429 })));
    expect((await getMod(request())).status).toBe(429);
    expect(recordRoll).not.toHaveBeenCalled();
  });
  it.each([getMod, getLast, getGame])("rejects an invalid game before contacting Nexusmods", async (handler) => {
    const fetch = vi.fn(async () => Response.json([{ mod_id: 7 }]));
    vi.stubGlobal("fetch", fetch);
    const response = await handler(request("../users"));
    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([getMod, getLast])("returns a useful error for a game without mods", async (handler) => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json([])));
    const response = await handler(request());
    expect(response.status).toBe(404);
    expect((await response.json()).message).toBeTruthy();
  });

  it.each([401, 403, 429, 500])("stops searching on upstream HTTP %s", async (status) => {
    let calls = 0;
    vi.stubGlobal("fetch", vi.fn(async () => {
      if (++calls === 1) return Response.json([{ mod_id: 10 }]);
      if (calls > 3) throw new Error("test stopped runaway search");
      return Response.json({ message: "upstream error" }, { status, headers: { "Retry-After": "60" } });
    }));
    const response = await getMod(request());
    expect(response.status).toBe(status);
    expect(calls).toBe(2);
    if (status === 429) expect(response.headers.get("Retry-After")).toBe("60");
  });

  it("ends the search when no eligible mod can be found", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", vi.fn(async () => {
      if (++calls === 1) return Response.json([{ mod_id: 10 }]);
      if (calls > 60) throw new Error("test stopped runaway search");
      return Response.json({ ...published, contains_adult_content: true });
    }));
    const response = await getMod(request());
    expect(response.status).toBe(503);
    expect(calls).toBe(31);
  });

  it("skips a missing mod and returns the next eligible one", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(Response.json([{ mod_id: 10 }]))
      .mockResolvedValueOnce(Response.json({}, { status: 404 }))
      .mockResolvedValueOnce(Response.json(published));
    vi.stubGlobal("fetch", fetch);
    expect(await (await getMod(request())).json()).toEqual(published);
  });

  it("stops when the client aborts between attempts", async () => {
    const controller = new AbortController();
    const fetch = vi.fn(async () => {
      controller.abort();
      return Response.json([{ mod_id: 10 }]);
    });
    vi.stubGlobal("fetch", fetch);
    const response = await getMod(request("skyrimspecialedition", controller.signal));
    expect(response.status).toBe(499);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("reports a request timeout instead of a server exception", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new DOMException("Timed out", "TimeoutError"); }));
    expect((await getGame(request())).status).toBe(504);
  });

  it("preserves the upstream game-info error status", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ message: "limited" }, { status: 429 })));
    expect((await getGame(request())).status).toBe(429);
  });

  it("aborts an in-flight upstream request when the client disconnects", async () => {
    const controller = new AbortController();
    let upstreamSignal: AbortSignal | undefined;
    vi.stubGlobal("fetch", vi.fn((_url: string, options: RequestInit) => {
      upstreamSignal = options.signal ?? undefined;
      return new Promise<Response>((_, reject) => upstreamSignal?.addEventListener("abort", () => reject(upstreamSignal?.reason), { once: true }));
    }));
    const response = getGame(request("skyrimspecialedition", controller.signal));
    controller.abort();
    expect((await response).status).toBe(499);
    expect(upstreamSignal?.aborted).toBe(true);
  });

  it("returns a controlled error for malformed upstream JSON", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("not JSON")));
    expect((await getGame(request())).status).toBe(502);
  });

  it("rejects an invalid mod-ID payload instead of entering the random loop", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json([{ mod_id: -1 }])));
    expect((await getLast(request())).status).toBe(502);
  });

  it("allows adult mods only when the filter explicitly enables them", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(Response.json([{ mod_id: 10 }]))
      .mockResolvedValueOnce(Response.json({ ...published, contains_adult_content: true }));
    vi.stubGlobal("fetch", fetch);
    const response = await getMod(new NextRequest("http://localhost/api?game=skyrimspecialedition&boobs=true"));
    expect(response.status).toBe(200);
    expect((await response.json()).contains_adult_content).toBe(true);
  });

  it("cancels an upstream fetch that exceeds ten seconds", async () => {
    useControlledDeadlines();
    vi.stubGlobal("fetch", vi.fn((_url: string, options: RequestInit) => new Promise<Response>((_, reject) => {
      options.signal?.addEventListener("abort", () => reject(options.signal?.reason), { once: true });
    })));
    const pending = getGame(request());
    await vi.advanceTimersByTimeAsync(10_000);
    expect((await pending).status).toBe(504);
  });

  it("enforces the twenty-second budget across otherwise timely retries", async () => {
    useControlledDeadlines();
    let calls = 0;
    vi.stubGlobal("fetch", vi.fn((_url: string, options: RequestInit) => {
      if (++calls === 1) return Promise.resolve(Response.json([{ mod_id: 10 }]));
      return new Promise<Response>((resolve, reject) => {
        const timer = setTimeout(() => resolve(Response.json({}, { status: 404 })), 6_000);
        options.signal?.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(options.signal?.reason);
        }, { once: true });
      });
    }));
    const pending = getMod(request());
    await vi.advanceTimersByTimeAsync(20_000);
    expect((await pending).status).toBe(504);
    expect(calls).toBe(5);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(calls).toBe(5);
  });
});
