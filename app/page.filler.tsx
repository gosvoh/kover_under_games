"use client";

import { Inter } from "next/font/google";
import Footer from "./footer";
import styles from "./page.module.scss";
import Image from "next/image";
import { useEffect, useState } from "react";
import Switch from "react-switch";
import { useAsync, useLocalStorageValue } from "@react-hookz/web";
import { AutoComplete, Spin } from "antd";

const font = Inter({ subsets: ["latin", "cyrillic"] });

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

export default function Home({
  games,
}: {
  games: {
    value: string;
    label: string;
    modsCount: number;
  }[];
}) {
  type ArrayElement<T> = T extends (infer U)[] ? U : null;

  const boobs = useLocalStorageValue("boobs", {
    defaultValue: false,
  });
  const selectedGame = useLocalStorageValue("selectedGame", {
    defaultValue: { value: "", label: "", modsCount: 0 },
  });
  const storageVolume = useLocalStorageValue("volume", {
    defaultValue: 0.5,
  });
  const [acValue, setAcValue] = useState("");
  const [playing, toggle, volume, setVolume] = useAudio("/Wolfie.mp3");
  const [errorMessage, setErrorMessage] = useState("");
  const [modInfoState, modInfoAction] = useAsync(
    async (): Promise<{
      contains_adult_content?: string;
      mod_id: number;
      category_id?: number;
    }> => {
      setErrorMessage("");
      try {
        const res = await fetch(
          `/api/getModInfo?game=${selectedGame.value?.value}&boobs=${boobs.value}`,
          {
            cache: "no-cache",
          }
        );
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
      } catch (error: any) {
        console.error(error);
        setErrorMessage(error.message);
        throw error;
      } finally {
      }
    },
    { mod_id: 3 }
  );
  const [lastModIdState, lastModIdAction] = useAsync(
    async (): Promise<number> => {
      setErrorMessage("");
      try {
        const res = await fetch(
          `/api/getLastModId?game=${selectedGame.value?.value}`,
          {
            cache: "no-cache",
          }
        );
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
      } catch (error: any) {
        console.error(error);
        setErrorMessage(error.message);
        throw error;
      }
    },
    0
  );
  const [gameInfoState, gameInfoAction] = useAsync(async (): Promise<any> => {
    try {
      const res = await fetch(
        `/api/getGameInfo?game=${selectedGame.value?.value}`,
        {
          cache: "no-cache",
        }
      );
      if (!res.ok) throw new Error(res.statusText);
      return res.json();
    } catch (error: any) {
      console.error(error);
      throw error;
    }
  });
  const [modId, setModId] = useState(modInfoState.result.mod_id);
  const [loaded, setLoaded] = useState(false);

  let interval: any = null;

  useEffect(() => {
    setVolume(storageVolume.value || 0.5);
    if (selectedGame.value && selectedGame.value.value.length !== 0) {
      setAcValue(selectedGame.value.label);
      setLoaded(true);
      return;
    }

    const skyrim = games.find(
      (option: ArrayElement<typeof games>) =>
        option.value === "skyrimspecialedition"
    );
    if (!skyrim) return;
    setAcValue(skyrim.label);
    selectedGame.set(skyrim);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (
      !games.find(
        (option: ArrayElement<typeof games>) =>
          option.value === selectedGame.value?.value
      )
    ) {
      lastModIdAction.reset();
      gameInfoAction.reset();
      modInfoAction.reset();
      return;
    }
    lastModIdAction.reset();
    lastModIdAction.execute();
    gameInfoAction.reset();
    gameInfoAction.execute();
    modInfoAction.reset();
  }, [selectedGame]);

  useEffect(() => {
    if (modInfoState.status === "not-executed") return;

    if (modInfoState.status === "success") {
      setModId(modInfoState.result?.mod_id);
      return;
    }

    interval = setInterval(() => {
      setModId(Math.floor(Math.random() * lastModIdState.result));
    }, 10);

    return () => clearInterval(interval);
  }, [modInfoState.result, lastModIdState.result, setModId]);

  function handleCopy() {
    navigator.clipboard.writeText(
      `https://www.nexusmods.com/${selectedGame.value?.value}/mods/${modInfoState.result.mod_id}`
    );
  }

  function handleNewTab() {
    window.open(
      `https://www.nexusmods.com/${selectedGame.value?.value}/mods/${modInfoState.result.mod_id}`,
      "_blank"
    );
  }

  function handleVolume(event: any) {
    let volume = Number(event.target.value) / 100;
    storageVolume.set(volume);

    setVolume(volume);
  }

  if (!loaded) return <Spin />;

  return (
    <main className={`${styles.main} ${font.className}`}>
      <h1 className={styles.title}>Kover roller</h1>
      <div className={styles.center}>
        <Pepe />
        <div className={styles.gameSection}>
          <AutoComplete
            options={games}
            allowClear
            value={acValue}
            filterOption={(inputValue, option) =>
              option!.label.toUpperCase().indexOf(inputValue.toUpperCase()) !==
                -1 ||
              option!.value.toUpperCase().indexOf(inputValue.toUpperCase()) !==
                -1
            }
            onChange={(value) => {
              setAcValue(value);
              const game = games.find((game) => game.label === value);
              if (game) selectedGame.set(game);
              else selectedGame.set({ value: "", label: "", modsCount: 0 });
            }}
            onSelect={(value, option) => {
              setAcValue(option.label);
              selectedGame.set(option);
            }}
          />
          <p>Модов на Nexusmods - {selectedGame.value?.modsCount}</p>
          <p>ID последнего загруженного мода - {lastModIdState.result}</p>
          <div className={styles.roll}>
            <div className={styles.modId}>
              {modInfoState.status === "loading"
                ? modId
                : modInfoState.result.mod_id}
            </div>
            <button
              disabled={
                modInfoState.status === "loading" ||
                !games.find((x) => x.value === selectedGame.value?.value)
              }
              onClick={() => {
                modInfoAction.reset();
                modInfoAction.execute();
              }}
            >
              Роллим!
            </button>
          </div>
          <div className={styles.flexRow}>
            <p
              hidden={errorMessage !== ""}
              className={
                modInfoState.result.contains_adult_content
                  ? [styles.error, styles.blink].join(" ")
                  : ""
              }
            >
              {modInfoState.result.contains_adult_content
                ? "Возможно бубы!"
                : "Это не бубы"}
            </p>
            <label className={styles.flexRow}>
              <Switch
                onChange={boobs.set}
                checked={boobs.value || false}
                checkedIcon={false}
                uncheckedIcon={false}
              />
              <span className={styles.pointer}>Вкл шанс буб?</span>
            </label>
          </div>
          <p className={styles.error} hidden={errorMessage === ""}>
            Ошибка - {errorMessage}
          </p>
          <div className={styles.actions}>
            <button
              disabled={modInfoState.status !== "success"}
              onClick={handleCopy}
            >
              Скопировать ссылку на мод
            </button>
            <button
              disabled={modInfoState.status !== "success"}
              onClick={handleNewTab}
            >
              Открыть в новой вкладке
            </button>
          </div>
          <p
            style={{
              visibility:
                gameInfoState.status === "success" &&
                modInfoState.result.category_id
                  ? "visible"
                  : "hidden",
              width: 0,
              minWidth: "100%",
            }}
          >
            {`Категория: ${
              (
                gameInfoState.result?.categories as {
                  category_id: number;
                  name: string;
                }[]
              )?.find(
                (val) => val.category_id === modInfoState.result?.category_id
              )?.name ?? "не найдена"
            }`}
          </p>
          <div className={styles.flexRow}>
            <label className={styles.flexRow}>
              <Switch
                onChange={toggle}
                checked={playing}
                checkedIcon={false}
                uncheckedIcon={false}
              />
              <span className={styles.pointer}>Музыка</span>
            </label>
            <input
              type={"range"}
              value={volume * 100}
              min={0}
              max={100}
              step={5}
              onChange={handleVolume}
              className={styles.flex1}
            />
            <span>{String(Math.round(volume * 100)).padStart(3, "0")}</span>
          </div>
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
