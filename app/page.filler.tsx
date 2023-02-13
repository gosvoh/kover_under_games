"use client";

import { Inter } from "@next/font/google";
import Footer from "./footer";
import styles from "./page.module.scss";
import Image from "next/image";
import { useEffect, useState } from "react";
import Btn from "@/components/btn";
import Select from "@/components/select";
import Switch from "react-switch";

const inter = Inter({ subsets: ["latin", "cyrillic"] });

function useAudio(
  url: string
): [boolean, () => void, number, (volume: number) => void] {
  const [audio, setAudio] = useState<HTMLAudioElement>(null as any);
  const [playing, setPlaying] = useState(false);
  const [audioVolume, setAudioVolume] = useState(0.5);

  const toggle = () => setPlaying(!playing);
  const setVolume = (volume: number) => setAudioVolume(volume);

  useEffect(() => {
    let audio = new Audio(url);
    audio.loop = true;
    setAudio(audio);
  }, [url, setAudio]);

  useEffect(() => {
    if (!audio) return;
    audio.volume = audioVolume;
  }, [audio, audioVolume]);

  useEffect(() => {
    if (!audio) return;
    if (playing) audio.play();
    else {
      audio.pause();
      audio.currentTime = 0;
    }
  }, [audio, playing]);

  return [playing, toggle, audioVolume, setVolume];
}

export default function Home({ games }: { games: any }) {
  const [selectedGame, setSelectedGame] = useState<any>(null);
  const [modInfo, setModInfo] = useState<any>({ mod_id: 0 });
  const [playing, toggle, volume, setVolume] = useAudio("/Wolfie.mp3");
  const [errorMessage, setErrorMessage] = useState("");
  const [lastModId, setLastModId] = useState(0);
  const [isFetching, setIsFetching] = useState(false);
  const [modId, setModId] = useState(modInfo.mod_id);

  let interval: any = null;

  useEffect(() => {
    if (errorMessage === "") return;
    setTimeout(() => {
      setErrorMessage("");
    }, 5000);
  }, [errorMessage]);

  useEffect(() => {
    let storedVolume = localStorage.getItem("volume");
    if (storedVolume) {
      try {
        setVolume(Number(storedVolume));
        return;
      } catch (e) {}
    }
  }, [setVolume]);

  useEffect(() => {
    let game = localStorage.getItem("selectedGame");
    if (game) {
      try {
        setSelectedGame(JSON.parse(game));
        return;
      } catch (e) {}
    }
    let skyrim = games.filter(
      (option: any) => option.value === "skyrimspecialedition"
    )[0];
    setSelectedGame(skyrim);
    localStorage.setItem("selectedGame", JSON.stringify(skyrim));
  }, [games, setSelectedGame]);

  useEffect(() => {
    if (!selectedGame) return;
    localStorage.setItem("selectedGame", JSON.stringify(selectedGame));

    fetch("/api/getLastModId", {
      cache: "no-cache",
      headers: {
        game: JSON.stringify(selectedGame),
      },
    }).then(async (response) => {
      if (response.status !== 200) {
        setErrorMessage(response.statusText);
        return;
      }

      let modId = await response.json();
      setLastModId(modId);
    });
  }, [selectedGame]);

  useEffect(() => {
    if (!isFetching) {
      setModId(modInfo.mod_id);
      return;
    }

    interval = setInterval(() => {
      setModId(Math.floor(Math.random() * lastModId));
    }, 10);

    return () => clearInterval(interval);
  }, [isFetching, modInfo, lastModId, setModId]);

  function handleCopy() {
    navigator.clipboard.writeText(
      `https://www.nexusmods.com/${selectedGame.value}/mods/${modInfo.mod_id}`
    );
  }

  function handleNewTab() {
    window.open(
      `https://www.nexusmods.com/${selectedGame.value}/mods/${modInfo.mod_id}`,
      "_blank"
    );
  }

  function handleVolume(event: any) {
    let volume = Number(event.target.value) / 100;
    localStorage.setItem("volume", volume.toString());

    setVolume(volume);
  }

  return (
    <main className={`${styles.main} ${inter.className}`}>
      <h1 className={styles.title}>Kover roller</h1>
      <div className={styles.center}>
        <Pepe />
        <div className={styles.gameSection}>
          <Select
            games={games}
            selectedGame={selectedGame}
            setSelectedGame={setSelectedGame}
          />
          <p>Модов на Nexusmods - {selectedGame?.modsCount}</p>
          <p>ID последнего загруженного мода - {lastModId}</p>
          <div className={styles.roll}>
            <div className={styles.modId}>{modId}</div>
            <Btn
              selectedGame={selectedGame}
              setModInfo={setModInfo}
              setErrorMessage={setErrorMessage}
              isFetching={isFetching}
              setIsFetching={setIsFetching}
            />
          </div>
          <p
            hidden={errorMessage !== ""}
            className={modInfo.contains_adult_content && styles.boobs}
          >
            Бубы? {modInfo.contains_adult_content ? "Возможно" : "Вроде нет"}
          </p>
          <p hidden={errorMessage === ""}>Ошибка - {errorMessage}</p>
          <div className={styles.actions}>
            <button
              disabled={modInfo.mod_id === 0 || isFetching}
              onClick={handleCopy}
            >
              Скопировать ссылку на мод
            </button>
            <button
              disabled={modInfo.mod_id === 0 || isFetching}
              onClick={handleNewTab}
            >
              Открыть в новой вкладке
            </button>
          </div>
          <label className={styles.music}>
            <Switch
              onChange={toggle}
              checked={playing}
              checkedIcon={false}
              uncheckedIcon={false}
            />
            <span>Музыка</span>
            <input
              type={"range"}
              value={volume * 100}
              min={0}
              max={100}
              step={5}
              onChange={handleVolume}
            />
            <span>{Math.round(volume * 100)}</span>
          </label>
        </div>
      </div>
      <Footer />
    </main>
  );
}

function Pepe() {
  return (
    <Image src="/pepe-peepo.gif" alt="pepe" width={400} height={400} priority />
  );
}

export const revalidate = 60 * 60;
