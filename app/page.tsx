import { getGames } from "@/utils/getGames";
import Home from "./page.filler";

export default async function Page() {
  let games = await getGames();

  return <Home games={games} />;
}
