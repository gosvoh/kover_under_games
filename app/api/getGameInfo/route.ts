import { NextRequest, NextResponse } from "next/server";
import { getGameDomain, NexusError, nexusErrorResponse, nexusJson } from "@/utils/nexus";
import type { GameInfo } from "@/utils/types";
import { withRequestLogging } from "@/utils/logger";

async function handleGet(req: NextRequest) {
  try {
    const game = await nexusJson<GameInfo>(`games/${getGameDomain(req)}.json`, req.signal, 60 * 60 * 24);
    if (!game || !Array.isArray(game.categories)) throw new NexusError(502, "Nexusmods вернул некорректные данные игры.");
    return NextResponse.json(game);
  } catch (error) {
    return nexusErrorResponse(error, req.signal);
  }
}

export const GET = withRequestLogging("/api/getGameInfo", handleGet);
