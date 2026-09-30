import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { NexusError, nexusJson } from "./nexus";
import type { GameOption } from "./types";
import { durationSince, errorType, log } from "./logger";

async function loadGameOptions(): Promise<GameOption[]> {
  const start = performance.now();
  try {
    const games = await nexusJson<unknown>("games");
    if (!Array.isArray(games)) throw new NexusError(502, "Nexusmods вернул некорректный список игр.");
    const options = games.map((game) => {
      if (typeof game?.domain_name !== "string" || typeof game.name !== "string" ||
          !Number.isSafeInteger(game.mods) || game.mods < 0) {
        throw new NexusError(502, "Nexusmods вернул некорректные данные игры.");
      }
      return { value: game.domain_name, label: game.name, modsCount: game.mods };
    }).sort((a, b) => a.label.localeCompare(b.label));
    log("info", "games.loaded", { count: options.length, durationMs: durationSince(start) });
    return options;
  } catch (error) {
    log("error", "games.failed", { errorType: errorType(error), durationMs: durationSince(start) });
    throw error;
  }
}

// Cache compact options, not Nexusmods' multi-megabyte descriptions and metadata.
export const getGames = cache(unstable_cache(loadGameOptions, ["nexus-game-options-v1"], {
  revalidate: 60 * 60 * 24,
}));
