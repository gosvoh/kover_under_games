import { NextRequest, NextResponse } from "next/server";
import { readHistory } from "@/utils/history";
import { getGameDomain, NexusError, nexusErrorResponse } from "@/utils/nexus";
import { errorType, log, withRequestLogging } from "@/utils/logger";

async function handleGet(req: NextRequest) {
  try {
    const game = getGameDomain(req);
    const entries = await readHistory(game, req.nextUrl.searchParams.get("boobs") === "true");
    return NextResponse.json(entries, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof NexusError) return nexusErrorResponse(error, req.signal);
    log("error", "history.read_failed", { errorType: errorType(error) });
    return NextResponse.json({ message: "История временно недоступна. Попробуйте обновить её позже." },
      { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export const GET = withRequestLogging("/api/history", handleGet);
