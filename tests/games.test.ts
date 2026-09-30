import { afterEach, expect, it, vi } from "vitest";
import { getGames } from "../utils/getGames";

vi.mock("server-only", () => ({}));
// Next's persistent cache requires its server context; the production build checks that layer.
vi.mock("next/cache", () => ({ unstable_cache: (load: () => Promise<unknown>) => load }));
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("fetches the large upstream body uncached and returns only compact game options", async () => {
  vi.stubEnv("NEXUSMODS_KEY", "test-key");
  const fetch = vi.fn(async (_url: string, _options?: RequestInit) => Response.json([
    { domain_name: "zgame", name: "Z game", mods: 5, description: "x".repeat(3_000_000) },
    { domain_name: "agame", name: "A game", mods: 10 },
  ]));
  vi.stubGlobal("fetch", fetch);
  expect(await getGames()).toEqual([
    { value: "agame", label: "A game", modsCount: 10 },
    { value: "zgame", label: "Z game", modsCount: 5 },
  ]);
  expect(fetch.mock.calls[0]?.[1]).toMatchObject({ cache: "no-store" });
});
