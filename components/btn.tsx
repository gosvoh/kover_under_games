import { Dispatch } from "react";

export default function Btn({
  selectedGame,
  setModInfo,
}: {
  selectedGame: string;
  setModInfo: Dispatch<any>;
}) {
  async function rollModId() {
    let response = await fetch("/api/getModInfo", {
      cache: "no-cache",
      headers: {
        game: JSON.stringify(selectedGame),
      },
    });

    let modInfo = await response.json();
    setModInfo(modInfo);
  }

  return <button onClick={rollModId}>Роллим!</button>;
}
