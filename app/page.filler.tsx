"use client";

import { Rubik } from "next/font/google";
import Image from "next/image";
import { useEffect, useState, useSyncExternalStore } from "react";
import Switch from "react-switch";
import { useLocalStorageValue } from "@react-hookz/web";
import { AutoComplete, ConfigProvider, Spin, theme } from "antd";
import { useAudio } from "@/utils/useAudio";
import { useGameRequests } from "@/utils/useGameRequests";
import type { GameOption } from "@/utils/types";
import Footer from "./footer";
import History from "./history";
import styles from "./page.module.scss";

const font = Rubik({ subsets: ["latin", "cyrillic"], display: "swap" });
const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;
const motionSnapshot = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const subscribeMotion = (listener: () => void) => {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
};

export default function Home({ games }: { games: GameOption[] }) {
  const mounted = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  const reducedMotion = useSyncExternalStore(subscribeMotion, motionSnapshot, serverSnapshot);
  const boobs = useLocalStorageValue<boolean>("boobs", { defaultValue: false, initializeWithValue: false });
  const savedGame = useLocalStorageValue<GameOption | null>("selectedGame", { defaultValue: null, initializeWithValue: false });
  const storageVolume = useLocalStorageValue<number>("volume", { defaultValue: 0.5, initializeWithValue: false });
  const [query, setQuery] = useState<string | null>(null);
  const defaultGame = games.find((game) => game.value === "skyrimspecialedition") ?? games[0];
  const selectedGame = savedGame.value?.value
    ? games.find((game) => game.value === savedGame.value?.value) ?? defaultGame
    : query === null ? defaultGame : undefined;
  const volume = typeof storageVolume.value === "number" && Number.isFinite(storageVolume.value)
    ? Math.min(1, Math.max(0, storageVolume.value)) : 0.5;
  const audio = useAudio("/Wolfie.mp3", volume);
  const requests = useGameRequests(mounted ? selectedGame?.value ?? "" : "", boobs.value === true);
  const [modId, setModId] = useState(0);
  const [actionError, setActionError] = useState("");
  const errorMessage = requests.error || audio.error || actionError;
  const mod = requests.mod;
  const categoryName = requests.categories.find((category) => category.category_id === mod?.category_id)?.name;

  useEffect(() => {
    if (!requests.loading || reducedMotion) return;
    const interval = setInterval(() => {
      setModId(Math.floor(Math.random() * requests.lastId));
    }, 50);
    return () => clearInterval(interval);
  }, [requests.loading, requests.lastId, reducedMotion]);

  async function handleCopy() {
    if (!selectedGame || !mod) return;
    setActionError("");
    try {
      await navigator.clipboard.writeText(`https://www.nexusmods.com/${selectedGame.value}/mods/${mod.mod_id}`);
    } catch {
      setActionError("Не удалось скопировать ссылку. Проверьте разрешение браузера на доступ к буферу обмена.");
    }
  }
  function handleNewTab() {
    if (!selectedGame || !mod) return;
    window.open(`https://www.nexusmods.com/${selectedGame.value}/mods/${mod.mod_id}`, "_blank", "noopener,noreferrer");
  }

  if (!mounted) return <main className={styles.loading}><Spin aria-label="Загрузка" /></main>;
  if (!games.length) return <main className={styles.main}><p>Список игр пуст. Попробуйте зайти позже.</p><Footer /></main>;

  return (
    <ConfigProvider theme={{ algorithm: theme.darkAlgorithm, token: {
      colorPrimary: "#789cff", colorBgContainer: "#000000", colorBgElevated: "#000000",
      colorText: "#f5f5f5", colorTextPlaceholder: "#b3b3b3", colorBorder: "#555555",
      fontFamily: font.style.fontFamily, fontSize: 16, borderRadius: 10, controlHeight: 52,
    } }}>
      <main className={`${styles.main} ${font.className}`}>
        <header className={styles.header}>
          <span className={styles.brand}><span className={styles.brandMark} aria-hidden="true">K</span>Kover roller</span>
          <a href="https://www.nexusmods.com/" target="_blank" rel="noopener noreferrer" className={styles.source}>Моды с Nexusmods</a>
        </header>
        <div className={styles.center}>
          <section className={styles.intro}>
            <h1 className={styles.title}>Во имя<br />рандома.</h1>
            <p className={styles.description}>Выбирай игру. Доверяй случаю.<br />Находи мод, который сам бы не искал.</p>
            <div className={styles.mascot}>
              <Image src="/pepe-peepo.gif" alt="Pepe ждёт, какой мод выпадет" width={400} height={400} priority unoptimized />
              <span className={styles.mascotStill} aria-hidden="true">K</span>
              <span className={styles.mascotCaption}>Рандом решает. Ты играешь.</span>
            </div>
          </section>
          <section className={styles.gameSection} aria-label="Рулетка модов">
          <label className={styles.fieldLabel} htmlFor="game-search">Для какой игры ищем мод?</label>
          <AutoComplete
            id="game-search"
            aria-label="Игра"
            className={styles.gameSelect}
            placeholder="Начни вводить название игры"
            options={games}
            allowClear
            value={query ?? selectedGame?.label ?? ""}
            filterOption={(input, option) => Boolean(option && (
              option.label.toUpperCase().includes(input.toUpperCase()) ||
              option.value.toUpperCase().includes(input.toUpperCase())
            ))}
            onChange={(value) => {
              setQuery(value);
              setActionError("");
              savedGame.set(games.find((game) => game.label === value) ?? { value: "", label: "", modsCount: 0 });
            }}
            onSelect={(_, option) => { setQuery(null); savedGame.set(option); setActionError(""); }}
          />
          <div className={styles.stats}>
            <p>Модов на Nexusmods - <strong>{selectedGame?.modsCount ?? 0}</strong></p>
            <p>ID последнего загруженного мода - <strong>{requests.lastId}</strong></p>
          </div>
          <div className={styles.roll}>
            <div className={styles.display} aria-busy={requests.loading}>
              <span className={styles.displayLabel}>{requests.loading ? "Ищем твой следующий мод" : mod ? "Твой случайный мод" : "Какой мод выпадет?"}</span>
              <div className={`${styles.modId} ${requests.loading ? styles.rolling : ""}`} aria-hidden={requests.loading}>
                {requests.loading ? reducedMotion ? "…" : String(modId).padStart(6, "0") : mod ? String(mod.mod_id).padStart(6, "0") : "— — —"}
              </div>
              <span className={styles.displayHint} role="status">{requests.loading ? "Немного терпения — рандом работает" : mod ? "Мод найден. Можно открывать!" : "Нажми «Роллим!» и доверься случаю"}</span>
            </div>
            <button disabled={requests.loading || !selectedGame} onClick={() => { setActionError(""); void requests.roll(); }}>Роллим!</button>
          </div>
          <div className={styles.filterRow}>
            <p aria-hidden={errorMessage !== "" || !mod} style={{ visibility: errorMessage !== "" || !mod ? "hidden" : "visible" }} className={mod?.contains_adult_content ? styles.adultBadge : styles.safeBadge}>
              {mod?.contains_adult_content ? "Возможно бубы!" : "Без взрослого контента"}
            </p>
            <label className={styles.flexRow}>
              <Switch onChange={boobs.set} checked={boobs.value === true} checkedIcon={false} uncheckedIcon={false} onColor="#244dff" onHandleColor="#ffffff" offColor="#555555" height={22} width={42} />
              <span className={styles.pointer}>Вкл шанс буб?</span>
            </label>
          </div>
          <p className={styles.error} hidden={errorMessage === ""} role={errorMessage ? "alert" : undefined}>Ошибка - {errorMessage}</p>
          {mod?.historySaved === false && <p className={styles.error} role="alert">Мод найден, но сохранить его в общую историю не удалось.</p>}
          <div className={styles.actions}>
            <button disabled={!mod || requests.loading} onClick={() => { void handleCopy(); }}>Скопировать ссылку на мод</button>
            <button disabled={!mod || requests.loading} onClick={handleNewTab}>Открыть в новой вкладке</button>
          </div>
          <div className={styles.modDetails} aria-hidden={!mod} style={{ visibility: mod ? "visible" : "hidden" }}>
            <p className={styles.modName} title={mod?.name || "Название не указано"}>
              Название: <span>{mod?.name || "не указано"}</span>
            </p>
            <p className={styles.category} title={categoryName}>
              Категория: <span>{categoryName ?? "не найдена"}</span>
            </p>
          </div>
          <div className={styles.audioControls}>
            <label className={styles.flexRow}>
              <Switch onChange={(enabled) => { void audio.toggle(enabled); }} checked={audio.playing} checkedIcon={false} uncheckedIcon={false} onColor="#244dff" onHandleColor="#ffffff" offColor="#555555" height={22} width={42} />
              <span className={styles.pointer}>Музыка</span>
            </label>
            <input type="range" value={volume * 100} min={0} max={100} step={5} onChange={(event) => storageVolume.set(Number(event.target.value) / 100)} className={styles.flex1} aria-label="Громкость" />
            <span className={styles.volumeValue}>{Math.round(volume * 100)}%</span>
          </div>
          </section>
      <History game={selectedGame?.value ?? ""} gameName={selectedGame?.label ?? ""}
        allowAdult={boobs.value === true} paused={requests.loading} result={mod} />
      </div>
      <Footer />
      </main>
    </ConfigProvider>
  );
}
