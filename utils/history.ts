import "server-only";
import { createClient } from "@libsql/client";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { HistoryEntry } from "./types";

type RollRecord = Pick<HistoryEntry, "game" | "modId" | "name" | "adult">;
const shared = globalThis as typeof globalThis & {
  koverHistoryStores?: Map<string, Promise<Awaited<ReturnType<typeof createHistoryStore>>>>;
  koverHistoryWrites?: Map<string, Promise<void>>;
};

export async function createHistoryStore(filename: string) {
  // The database is a runtime file on a persistent disk, never a bundled build asset.
  const path = resolve(/* turbopackIgnore: true */ filename);
  await mkdir(dirname(path), { recursive: true });
  const client = createClient({ url: pathToFileURL(path).href });
  try {
    await client.execute("PRAGMA busy_timeout = 5000");
    await client.execute("PRAGMA journal_mode = WAL");
    await client.batch([
      `CREATE TABLE IF NOT EXISTS roll_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game TEXT NOT NULL,
        mod_id INTEGER NOT NULL CHECK (mod_id > 0),
        name TEXT NOT NULL,
        adult INTEGER NOT NULL CHECK (adult IN (0, 1)),
        created_at TEXT NOT NULL
      )`,
      "CREATE INDEX IF NOT EXISTS history_game_id ON roll_history (game, id DESC)",
    ], "write");
  } catch (error) {
    client.close();
    throw error;
  }
  return {
    async append(record: RollRecord, signal?: AbortSignal): Promise<void> {
      signal?.throwIfAborted();
      // Serialize local writes so a synchronous SQLite lock wait cannot block another
      // transaction's commit on the same JavaScript event loop.
      const queues = shared.koverHistoryWrites ??= new Map();
      const previous = queues.get(path) ?? Promise.resolve();
      const write = previous.catch(() => {}).then(async () => {
        signal?.throwIfAborted();
        const transaction = await client.transaction("write");
        try {
          signal?.throwIfAborted();
          await transaction.execute({
            sql: "INSERT INTO roll_history (game, mod_id, name, adult, created_at) VALUES (?, ?, ?, ?, ?)",
            args: [record.game, record.modId, record.name.slice(0, 300), record.adult ? 1 : 0, new Date().toISOString()],
          });
          signal?.throwIfAborted();
          await transaction.commit();
        } finally {
          transaction.close();
        }
      });
      queues.set(path, write);
      try {
        await write;
      } finally {
        if (queues.get(path) === write) queues.delete(path);
      }
    },
    async recent(game: string, allowAdult: boolean): Promise<HistoryEntry[]> {
      const result = await client.execute({
        sql: "SELECT * FROM roll_history WHERE game = ? AND (? = 1 OR adult = 0) ORDER BY id DESC LIMIT 20",
        args: [game, allowAdult ? 1 : 0],
      });
      return result.rows.map((row) => ({
        id: Number(row.id), game: String(row.game), modId: Number(row.mod_id), name: String(row.name),
        adult: row.adult === 1, createdAt: String(row.created_at),
      }));
    },
    close: () => client.close(),
  };
}

// Reuse one connection across requests and development reloads; initialization is lazy.
async function getStore() {
  const path = resolve(/* turbopackIgnore: true */ process.env.HISTORY_DB_PATH || "data/roll-history.sqlite");
  const stores = shared.koverHistoryStores ??= new Map();
  let store = stores.get(path);
  if (!store) {
    store = createHistoryStore(path).catch((error) => { stores.delete(path); throw error; });
    stores.set(path, store);
  }
  return store;
}
export async function recordRoll(record: RollRecord, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const pending = getStore().then((store) => store.append(record, signal));
  if (!signal) return pending;
  // Stop waiting promptly; the write observes the same signal before committing.
  return new Promise<void>((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    pending.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}
export async function readHistory(game: string, allowAdult: boolean) { return (await getStore()).recent(game, allowAdult); }
