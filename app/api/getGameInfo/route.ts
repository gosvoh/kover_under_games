import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  let game = req.nextUrl.searchParams.get("game");

  let response = await fetch(
    `https://api.nexusmods.com/v1/games/${game}.json`,
    {
      headers: {
        apikey: process.env.NEXUSMODS_KEY as string,
      },
      next: {
        revalidate: 60 * 60 * 24,
      },
    }
  );

  return response;
}
