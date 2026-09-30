import { randomInt } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getGameDomain, getLatestModId, NexusError, nexusErrorResponse, nexusJson } from "@/utils/nexus";
import type { ModInfo } from "@/utils/types";
import { errorType, log, withRequestLogging } from "@/utils/logger";
import { recordRoll } from "@/utils/history";

async function handlePost(req: NextRequest) {
  try {
    const game = getGameDomain(req);
    const allowAdult = req.nextUrl.searchParams.get("boobs") === "true";
    const signal = AbortSignal.any([req.signal, AbortSignal.timeout(20_000)]);
    const latest = await getLatestModId(game, signal);
    for (let attempt = 0; attempt < 30; attempt++) {
      signal.throwIfAborted();
      let info: ModInfo;
      try {
        info = await nexusJson<ModInfo>(`games/${game}/mods/${randomInt(1, latest + 1)}.json`, signal);
      } catch (error) {
        if (error instanceof NexusError && error.status === 404) {
          log("debug", "search.skipped", { attempt: attempt + 1, reason: "not_found" });
          continue;
        }
        throw error;
      }
      if (!info || !Number.isSafeInteger(info.mod_id) || info.mod_id < 1 ||
          typeof info.status !== "string" || typeof info.available !== "boolean" ||
          typeof info.contains_adult_content !== "boolean") {
        throw new NexusError(502, "Nexusmods вернул некорректные данные мода.");
      }
      if (info.status !== "published" || !info.available) {
        log("debug", "search.skipped", { attempt: attempt + 1, reason: "unavailable" });
        continue;
      }
      if (!allowAdult && info.contains_adult_content) {
        log("debug", "search.skipped", { attempt: attempt + 1, reason: "adult_filter" });
        continue;
      }
      log("info", "search.selected", { attempt: attempt + 1, modId: info.mod_id });
      signal.throwIfAborted();
      try {
        await recordRoll({ game, modId: info.mod_id,
          name: typeof info.name === "string" && info.name.trim() ? info.name : `Мод #${info.mod_id}`,
          adult: info.contains_adult_content,
        }, signal);
        signal.throwIfAborted();
        log("info", "history.saved", { game, modId: info.mod_id });
      } catch (error) {
        signal.throwIfAborted();
        log("error", "history.write_failed", { game, modId: info.mod_id, errorType: errorType(error) });
        return NextResponse.json({ ...info, historySaved: false });
      }
      return NextResponse.json(info);
    }
    throw new NexusError(503, "Не удалось найти подходящий мод за ограниченное число попыток. Попробуйте ещё раз.");
  } catch (error) {
    return nexusErrorResponse(error, req.signal);
  }
}

export const POST = withRequestLogging("/api/getModInfo", handlePost);
