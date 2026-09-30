import { getGames } from "@/utils/getGames";
import Home from "./page.filler";

// Load Nexusmods data at runtime so builds do not require an API key.
// getGames still caches the compact list for 24 hours.
export const dynamic = "force-dynamic";

export default async function Page() {
  let games = await getGames();

  return <Home games={games} />;
}
