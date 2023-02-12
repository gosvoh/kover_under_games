import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  let game = JSON.parse(req.headers.game as string);

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

  res.status(200).json(latest);
}
