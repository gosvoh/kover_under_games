import { NextApiRequest, NextApiResponse } from "next";
var randomNumber = require("random-number-csprng-2");

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  let game = JSON.parse(req.headers.game as string);
  let modInfo = null;

  let response = await fetch(
    `https://api.nexusmods.com/v1/games/${game.value}/mods/latest_added.json`,
    {
      headers: {
        apikey: process.env.NEXUSMODS_KEY as string,
      },
    }
  );
  if (!response.ok) {
    res.status(response.status).json(response.statusText);
    return;
  }
  let latest = (await response.json())[0].mod_id;

  while (modInfo === null) {
    let rnd = await randomNumber(1, latest);
    response = await fetch(
      `https://api.nexusmods.com/v1/games/${game.value}/mods/${rnd}.json`,
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
    modInfo = info;
  }

  res.status(200).json(modInfo);
}
