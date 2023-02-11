import { cache } from "react";
import "server-only";

export const getGames = cache(async () => {
  const response = await fetch("https://api.nexusmods.com/v1/games", {
    next: { revalidate: 60 * 60 * 24 },
    headers: {
      apikey: process.env.NEXUSMODS_KEY as string,
    },
  });
  if (!response.ok) {
    throw new Error("Failed to fetch games");
  }
  let games = await response.json();
  return games
    .map((game: any) => ({
      value: game.domain_name,
      label: game.name,
      modsCount: game.mods,
    }))
    .sort((a: any, b: any) => a.label.localeCompare(b.label));
});
