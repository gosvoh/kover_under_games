import { NextRequest, NextResponse } from "next/server";

var randomNumber = require("random-number-csprng-2");

export async function GET(req: NextRequest) {
  const game = req.nextUrl.searchParams.get("game");
  let boobsOn = req.nextUrl.searchParams.get("boobs") === "true";
  let modInfo = null;

  let response = await fetch(
    `https://api.nexusmods.com/v1/games/${game}/mods/latest_added.json`,
    {
      headers: {
        apikey: process.env.NEXUSMODS_KEY as string,
      },
    }
  );
  if (!response.ok) return response;

  let latest = (await response.json())[0].mod_id;

  while (modInfo === null) {
    let rnd = await randomNumber(1, latest);
    response = await fetch(
      `https://api.nexusmods.com/v1/games/${game}/mods/${rnd}.json`,
      {
        cache: "no-cache",
        headers: {
          apikey: process.env.NEXUSMODS_KEY as string,
        },
      }
    );

    if (!response.ok) continue;

    let info = await response.json();
    if (info.status !== "published" || info.available !== true) continue;
    if (!boobsOn && info.contains_adult_content) continue;
    modInfo = info;
  }
  return NextResponse.json(modInfo);
}
