import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createHistoryStore } from "../utils/history";

vi.mock("server-only", () => ({}));
let directory: string;
let store: Awaited<ReturnType<typeof createHistoryStore>>;
const record = { game: "fallout4", modId: 7, name: "A new companion", adult: false };
beforeEach(async () => {
  await mkdir(resolve(".test-data"), { recursive: true });
  directory = await mkdtemp(join(resolve(".test-data"), "history-"));
  store = await createHistoryStore(join(directory, "history.sqlite"));
});
afterEach(async () => {
  store?.close();
  if (!resolve(directory).startsWith(resolve(".test-data") + "/") &&
      !resolve(directory).startsWith(resolve(".test-data") + "\\")) throw new Error("Unexpected test directory");
  await rm(directory, { recursive: true, force: true }).catch((error: NodeJS.ErrnoException) => {
    // The native Windows driver may retain file handles until the worker exits.
    if (error.code !== "EBUSY") throw error;
  });
});

it("persists successful rolls across closing and reopening the database", async () => {
  await store.append(record);
  store.close();
  store = await createHistoryStore(join(directory, "history.sqlite"));
  expect(await store.recent("fallout4", false)).toEqual([
    expect.objectContaining({ game: "fallout4", modId: 7, name: "A new companion", adult: false, createdAt: expect.any(String) }),
  ]);
});

it("filters by game and excludes adult results unless enabled", async () => {
  await store.append(record);
  await store.append({ ...record, modId: 8, adult: true });
  await store.append({ ...record, game: "skyrimspecialedition", modId: 9 });
  expect((await store.recent("fallout4", false)).map((entry) => entry.modId)).toEqual([7]);
  expect((await store.recent("fallout4", true)).map((entry) => entry.modId)).toEqual([8, 7]);
});

it("returns only the latest twenty rolls while retaining the full history", async () => {
  for (let modId = 1; modId <= 25; modId++) await store.append({ ...record, modId });
  const recent = await store.recent("fallout4", true);
  expect(recent).toHaveLength(20);
  expect(recent[0].modId).toBe(25);
  expect(recent.at(-1)?.modId).toBe(6);
});

it("keeps repeated mod results as separate rolls and treats titles as literal data", async () => {
  await store.append({ ...record, name: "'; DROP TABLE roll_history; --" });
  await store.append(record);
  const recent = await store.recent("fallout4", false);
  expect(recent).toHaveLength(2);
  expect(recent[1].name).toBe("'; DROP TABLE roll_history; --");
  expect(recent[0].id).not.toBe(recent[1].id);
});

it("preserves concurrent rolls from independent connections", async () => {
  const other = await createHistoryStore(join(directory, "history.sqlite"));
  try {
    await Promise.all([store.append(record), other.append({ ...record, modId: 8 })]);
    expect(await store.recent("fallout4", false)).toHaveLength(2);
  } finally { other.close(); }
});

it("does not save a queued roll if its request is cancelled", async () => {
  const controller = new AbortController();
  const first = store.append(record);
  const cancelled = store.append({ ...record, modId: 8 }, controller.signal);
  controller.abort();
  await first;
  await expect(cancelled).rejects.toMatchObject({ name: "AbortError" });
  expect((await store.recent("fallout4", false)).map((entry) => entry.modId)).toEqual([7]);
});
