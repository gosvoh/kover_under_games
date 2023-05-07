import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  let game = JSON.parse(req.headers.get("game") as string);

  let response = await fetch(
    `https://api.nexusmods.com/v1/games/${game.value}/mods/latest_added.json`,
    {
      headers: {
        apikey: process.env.NEXUSMODS_KEY as string,
      },
    }
  );

  if (!response.ok) return response;

  let latest = (await response.json())[0].mod_id;
  return NextResponse.json(latest);
}
