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

function useAudio(url: string): [boolean, () => void] {
  const [audio, setAudio] = useState<HTMLAudioElement>(null as any);
  const [playing, setPlaying] = useState(false);

  const toggle = () => setPlaying(!playing);

  useEffect(() => {
    let audio = new Audio(url);
    audio.loop = true;
    setAudio(audio);
  }, []);

  useEffect(() => {
    playing ? audio?.play() : audio?.pause();
  }, [playing]);

  return [playing, toggle];
}

export default function Home({ games }: { games: any }) {
  const [selectedGame, setSelectedGame] = useState<any>(null);
  const [modInfo, setModInfo] = useState<any>({ mod_id: 0 });
  const [playing, toggle] = useAudio("/Wolfie.mp3");

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
  }, [selectedGame]);

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
          <div className={styles.roll}>
            <div className={styles.modId}>{modInfo.mod_id}</div>
            <Btn selectedGame={selectedGame} setModInfo={setModInfo} />
          </div>
          <p className={modInfo.contains_adult_content && styles.boobs}>
            Бубы? {modInfo.contains_adult_content ? "Возможно" : "Вроде нет"}
          </p>
          <div className={styles.actions}>
            <button disabled={modInfo.mod_id === 0} onClick={handleCopy}>
              Скопировать ссылку на мод
            </button>
            <button disabled={modInfo.mod_id === 0} onClick={handleNewTab}>
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
