import { Dispatch } from "react";

export default function Btn({
  selectedGame,
  setModInfo,
  setErrorMessage,
  isFetching,
  setIsFetching,
}: {
  selectedGame: string;
  setModInfo: Dispatch<any>;
  setErrorMessage: Dispatch<any>;
  isFetching: boolean;
  setIsFetching: Dispatch<any>;
}) {
  async function rollModId() {
    setIsFetching(true);
    let response = await fetch("/api/getModInfo", {
      cache: "no-cache",
      headers: {
        game: JSON.stringify(selectedGame),
      },
    });

    if (response.status !== 200) {
      setErrorMessage(response.statusText);
      setIsFetching(false);
      return;
    }

    let modInfo = await response.json();
    setIsFetching(false);
    setModInfo(modInfo);
  }

  return (
    <button disabled={isFetching} onClick={rollModId}>
      Роллим!
    </button>
  );
}
