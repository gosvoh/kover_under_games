import { NextRequest, NextResponse } from "next/server";
import { getGameDomain, getLatestModId, nexusErrorResponse } from "@/utils/nexus";
import { withRequestLogging } from "@/utils/logger";

async function handleGet(req: NextRequest) {
  try {
    return NextResponse.json(await getLatestModId(getGameDomain(req), req.signal));
  } catch (error) {
    return nexusErrorResponse(error, req.signal);
  }
}

export const GET = withRequestLogging("/api/getLastModId", handleGet);
