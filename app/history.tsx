"use client";
import { useEffect, useState } from "react";
import { Button } from "antd";
import { clientRequest, errorMessage } from "@/utils/clientRequest";
import type { HistoryEntry, ModInfo } from "@/utils/types";
import styles from "./page.module.scss";

const dateFormat = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export default function History({ game, gameName, allowAdult, paused, result }: {
  game: string; gameName: string; allowAdult: boolean; paused: boolean; result?: ModInfo;
}) {
  const key = `${game}:${allowAdult}`;
  const [resource, setResource] = useState<{ key: string; entries: HistoryEntry[]; error?: string }>({ key: "", entries: [] });
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!game || paused) return;
    let controller: AbortController | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    const refresh = async () => {
      if (disposed || document.hidden) return;
      controller?.abort();
      const current = new AbortController();
      controller = current;
      try {
        const query = new URLSearchParams({ game, boobs: String(allowAdult) });
        const entries = await clientRequest<HistoryEntry[]>(`/api/history?${query}`, current.signal);
        if (!Array.isArray(entries)) throw new Error("Сервер вернул некорректную историю.");
        if (!current.signal.aborted) setResource({ key, entries });
      } catch (error) {
        if (!current.signal.aborted) setResource((previous) => ({
          key, entries: previous.key === key ? previous.entries : [], error: errorMessage(error),
        }));
      } finally {
        if (!disposed && !current.signal.aborted) timer = setTimeout(() => { void refresh(); }, 15_000);
      }
    };
    const onVisibilityChange = () => {
      clearTimeout(timer);
      controller?.abort();
      if (!document.hidden) void refresh();
    };
    void refresh();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      disposed = true;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [game, allowAdult, paused, result, retry, key]);

  if (!game) return null;
  const current = resource.key === key ? resource : undefined;
  return (
    <section className={styles.history} aria-labelledby="history-heading">
      <div className={styles.historyHeading}>
        <div>
          <h2 id="history-heading">Что выпало другим</h2>
          <p>Последние выпадения для {gameName}. Твои результаты тоже здесь.</p>
        </div>
        <Button size="small" onClick={() => setRetry((value) => value + 1)} disabled={paused}>Обновить историю</Button>
      </div>
      {current?.error && <p className={styles.error} role="alert">{current.error}</p>}
      {!current ? <p className={styles.historyEmpty}>{paused ? "История обновится после прокрутки." : "Загружаем историю…"}</p>
        : current.entries.length === 0 && !current.error ? <p className={styles.historyEmpty}>Для этой игры пока ничего не выпало. Твой ролл может стать первым.</p>
        : <ol className={styles.historyList} tabIndex={0} aria-label="Последние выпадения">
          {current.entries.map((entry) => (
            <li key={entry.id}>
              <a href={`https://www.nexusmods.com/${entry.game}/mods/${entry.modId}`} target="_blank" rel="noopener noreferrer">
                <span className={styles.historyName}>{entry.name}</span>
                <span className={styles.historyMeta}>#{entry.modId}{entry.adult ? " · 18+" : ""}</span>
              </a>
              <time dateTime={entry.createdAt}>{dateFormat.format(new Date(entry.createdAt))}</time>
            </li>
          ))}
        </ol>}
    </section>
  );
}
