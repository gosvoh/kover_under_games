// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Home from "../app/page.filler";

vi.mock("next/font/google", () => ({ Rubik: () => ({ className: "rubik", style: { fontFamily: "Rubik" } }) }));
const games = [
  { value: "skyrimspecialedition", label: "Skyrim Special Edition", modsCount: 100 },
  { value: "fallout4", label: "Fallout 4", modsCount: 50 },
];
let audio: HTMLAudioElement;

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal("matchMedia", () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
  audio = document.createElement("audio");
  audio.play = vi.fn(async () => {});
  audio.pause = vi.fn();
  audio.load = vi.fn();
  vi.stubGlobal("Audio", function () { return audio; });
  vi.stubGlobal("fetch", vi.fn(async (url: string) =>
    Response.json(url.includes("getLastModId") ? 10 : { categories: [] })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

it("restores zero volume rather than the default", async () => {
  localStorage.setItem("volume", "0");
  render(<Home games={games} />);
  await waitFor(() => expect((screen.getByRole("slider") as HTMLInputElement).value).toBe("0"));
  expect(audio.volume).toBe(0);
});

it("does not show an old-game error after switching games", async () => {
  let rejectOld!: (error: Error) => void;
  let oldSignal: AbortSignal | undefined;
  vi.stubGlobal("fetch", vi.fn((url: string, options: RequestInit) => {
    if (url.includes("getModInfo")) {
      oldSignal = options.signal ?? undefined;
      return new Promise<Response>((_, reject) => { rejectOld = reject; });
    }
    return Promise.resolve(Response.json(url.includes("getLastModId") ? 10 : { categories: [] }));
  }));
  render(<Home games={games} />);
  fireEvent.click(await screen.findByRole("button", { name: "Роллим!" }));
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "Fallout 4" } });
  expect(oldSignal?.aborted).toBe(true);
  await act(async () => { rejectOld(new Error("old Skyrim error")); });
  expect(screen.queryByText(/old Skyrim error/)).toBeNull();
  expect((screen.getByRole("combobox") as HTMLInputElement).value).toBe("Fallout 4");
});

it("releases the audio resource on unmount", async () => {
  const { unmount } = render(<Home games={games} />);
  fireEvent.click(await screen.findByRole("switch", { name: "Музыка" }));
  await waitFor(() => expect(audio.play).toHaveBeenCalled());
  vi.mocked(audio.pause).mockClear();
  unmount();
  expect(audio.pause).toHaveBeenCalled();
});

it("handles an audio playback rejection visibly", async () => {
  audio.play = vi.fn(async () => { throw new Error("playback blocked"); });
  render(<Home games={games} />);
  fireEvent.click(await screen.findByRole("switch", { name: "Музыка" }));
  expect(await screen.findByText(/Не удалось включить музыку/)).toBeTruthy();
  expect(screen.getByRole("switch", { name: "Музыка" }).getAttribute("aria-checked")).toBe("false");
});

it("shows an empty game list without an endless spinner", async () => {
  render(<Home games={[]} />);
  expect(await screen.findByText(/Список игр пуст/)).toBeTruthy();
});

it("stops the rolling timer when the request fails", async () => {
  vi.useFakeTimers();
  const originalSetInterval = globalThis.setInterval;
  const originalClearInterval = globalThis.clearInterval;
  const active = new Set<ReturnType<typeof setInterval>>();
  vi.stubGlobal("setInterval", (callback: () => void, ms: number) => {
    const id = originalSetInterval(callback, ms);
    active.add(id);
    return id;
  });
  vi.stubGlobal("clearInterval", (id: ReturnType<typeof setInterval>) => {
    active.delete(id);
    originalClearInterval(id);
  });
  let finish!: (response: Response) => void;
  vi.stubGlobal("fetch", vi.fn((url: string) => url.includes("getModInfo")
    ? new Promise<Response>((resolve) => { finish = resolve; })
    : Promise.resolve(Response.json(url.includes("getLastModId") ? 10 : { categories: [] }))));
  render(<Home games={games} />);
  await act(async () => {});
  expect(screen.getByText(/ID последнего загруженного мода/).textContent).toContain("10");
  const before = active.size;
  fireEvent.click(screen.getByRole("button", { name: "Роллим!" }));
  expect(active.size).toBeGreaterThan(before);
  await act(async () => { finish(Response.json({ message: "search failed" }, { status: 502 })); });
  await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
  expect(active.size).toBe(before);
  expect(screen.getByRole("button", { name: "Роллим!" }).hasAttribute("disabled")).toBe(false);
});

it("cancels a pending roll when the adult-content filter changes", async () => {
  let signal: AbortSignal | null | undefined;
  vi.stubGlobal("fetch", vi.fn((url: string, options: RequestInit) => {
    if (url.includes("getModInfo")) {
      signal = options.signal;
      return new Promise<Response>(() => {});
    }
    return Promise.resolve(Response.json(url.includes("getLastModId") ? 10 : { categories: [] }));
  }));
  render(<Home games={games} />);
  fireEvent.click(await screen.findByRole("button", { name: "Роллим!" }));
  fireEvent.click(screen.getByRole("switch", { name: "Вкл шанс буб?" }));
  expect(signal?.aborted).toBe(true);
  expect(screen.getByRole("button", { name: "Роллим!" }).hasAttribute("disabled")).toBe(false);
});

it("shows the successful mod, category, and enabled link actions", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", vi.fn(async (url: string) => Response.json(
    url.includes("getModInfo") ? { mod_id: 7, name: "A new companion", category_id: 1, contains_adult_content: false, status: "published", available: true }
      : url.includes("getLastModId") ? 10 : { categories: [{ category_id: 1, name: "Followers" }] },
  )));
  render(<Home games={games} />);
  fireEvent.click(screen.getByRole("button", { name: "Роллим!" }));
  await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
  expect(screen.getByText("Followers").closest("p")?.textContent).toBe("Категория: Followers");
  expect(screen.getByText("A new companion").closest("p")?.textContent).toBe("Название: A new companion");
  expect(screen.getByRole("button", { name: "Скопировать ссылку на мод" }).hasAttribute("disabled")).toBe(false);
  expect(screen.getByRole("button", { name: "Открыть в новой вкладке" }).hasAttribute("disabled")).toBe(false);
});

it("keeps a fast successful roll hidden until five seconds have passed", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", vi.fn(async (url: string) => Response.json(
    url.includes("getModInfo") ? { mod_id: 7, category_id: 1, contains_adult_content: false, status: "published", available: true }
      : url.includes("getLastModId") ? 10 : { categories: [] },
  )));
  render(<Home games={games} />);
  const roll = screen.getByRole("button", { name: "Роллим!" });
  fireEvent.click(roll);
  await act(async () => { await vi.advanceTimersByTimeAsync(4_999); });
  expect(roll.hasAttribute("disabled")).toBe(true);
  expect(screen.getByRole("button", { name: "Скопировать ссылку на мод" }).hasAttribute("disabled")).toBe(true);
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(roll.hasAttribute("disabled")).toBe(false);
  expect(screen.getByRole("button", { name: "Скопировать ссылку на мод" }).hasAttribute("disabled")).toBe(false);
});

it("keeps rolling beyond five seconds and reveals a slow response immediately", async () => {
  vi.useFakeTimers();
  let finish!: (response: Response) => void;
  vi.stubGlobal("fetch", vi.fn((url: string) => url.includes("getModInfo")
    ? new Promise<Response>((resolve) => { finish = resolve; })
    : Promise.resolve(Response.json(url.includes("getLastModId") ? 10 : { categories: [] }))));
  render(<Home games={games} />);
  const roll = screen.getByRole("button", { name: "Роллим!" });
  fireEvent.click(roll);
  await act(async () => { await vi.advanceTimersByTimeAsync(8_000); });
  expect(roll.hasAttribute("disabled")).toBe(true);
  await act(async () => { finish(Response.json({ mod_id: 7, contains_adult_content: false, status: "published", available: true })); });
  expect(roll.hasAttribute("disabled")).toBe(false);
  expect(screen.getByRole("button", { name: "Скопировать ссылку на мод" }).hasAttribute("disabled")).toBe(false);
});

it("cancels the minimum animation wait on a game change", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", vi.fn(async (url: string) => Response.json(
    url.includes("getModInfo") ? { mod_id: 7, contains_adult_content: false, status: "published", available: true }
      : url.includes("getLastModId") ? 10 : { categories: [] },
  )));
  render(<Home games={games} />);
  fireEvent.click(screen.getByRole("button", { name: "Роллим!" }));
  await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "Fallout 4" } });
  await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
  expect(screen.getByRole("button", { name: "Роллим!" }).hasAttribute("disabled")).toBe(false);
  expect(screen.getByRole("button", { name: "Скопировать ссылку на мод" }).hasAttribute("disabled")).toBe(true);
});

it("restores the default game on reload after clearing the selector", async () => {
  const { unmount } = render(<Home games={games} />);
  fireEvent.click(await screen.findByRole("button", { name: "Clear" }));
  expect(screen.getByRole("button", { name: "Роллим!" }).hasAttribute("disabled")).toBe(true);
  unmount();
  render(<Home games={games} />);
  await waitFor(() => expect((screen.getByRole("combobox") as HTMLInputElement).value).toBe("Skyrim Special Edition"));
  expect(screen.getByRole("button", { name: "Роллим!" }).hasAttribute("disabled")).toBe(false);
});

it("adds the revealed roll to shared history without exposing it before five seconds", async () => {
  vi.useFakeTimers();
  let saved = false;
  const fetch = vi.fn(async (url: string) => {
    if (url.includes("/api/history")) return Response.json(saved ? [{
      id: 1, game: "skyrimspecialedition", modId: 7, name: "Shared Skyrim mod", adult: false,
      createdAt: "2026-09-30T10:00:00.000Z",
    }] : []);
    if (url.includes("getModInfo")) {
      saved = true;
      return Response.json({ mod_id: 7, status: "published", available: true, contains_adult_content: false });
    }
    return Response.json(url.includes("getLastModId") ? 10 : { categories: [] });
  });
  vi.stubGlobal("fetch", fetch);
  render(<Home games={games} />);
  await act(async () => {});
  fireEvent.click(screen.getByRole("button", { name: "Роллим!" }));
  await act(async () => { await vi.advanceTimersByTimeAsync(4_999); });
  expect(screen.queryByRole("link", { name: /Shared Skyrim mod/ })).toBeNull();
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(screen.getByRole("link", { name: /Shared Skyrim mod/ })).toBeTruthy();
  expect(fetch.mock.calls.find(([url]) => url.includes("getModInfo"))?.[0]).toBeTruthy();
});

it("keeps the found mod and category when the adult-content filter changes", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", vi.fn(async (url: string) => Response.json(
    url.includes("/api/history") ? [] : url.includes("getModInfo")
      ? { mod_id: 7, category_id: 1, status: "published", available: true, contains_adult_content: false }
      : url.includes("getLastModId") ? 10 : { categories: [{ category_id: 1, name: "Followers" }] },
  )));
  render(<Home games={games} />);
  fireEvent.click(screen.getByRole("button", { name: "Роллим!" }));
  await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
  fireEvent.click(screen.getByRole("switch", { name: "Вкл шанс буб?" }));
  expect(screen.getByText("000007")).toBeTruthy();
  expect(screen.getByText("Followers").closest("p")?.textContent).toBe("Категория: Followers");
  expect(screen.getByRole("button", { name: "Скопировать ссылку на мод" }).hasAttribute("disabled")).toBe(false);
});

it("restores the previous result when a filter change cancels the next roll", async () => {
  vi.useFakeTimers();
  let rolls = 0;
  let pendingSignal: AbortSignal | undefined;
  vi.stubGlobal("fetch", vi.fn((url: string, options: RequestInit) => {
    if (url.includes("getModInfo")) {
      if (++rolls === 1) return Promise.resolve(Response.json({ mod_id: 7, status: "published", available: true, contains_adult_content: false }));
      pendingSignal = options.signal ?? undefined;
      return new Promise<Response>((_, reject) => options.signal?.addEventListener("abort", () => reject(options.signal?.reason), { once: true }));
    }
    return Promise.resolve(Response.json(url.includes("/api/history") ? [] : url.includes("getLastModId") ? 10 : { categories: [] }));
  }));
  render(<Home games={games} />);
  fireEvent.click(screen.getByRole("button", { name: "Роллим!" }));
  await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
  fireEvent.click(screen.getByRole("button", { name: "Роллим!" }));
  fireEvent.click(screen.getByRole("switch", { name: "Вкл шанс буб?" }));
  await act(async () => {});
  expect(pendingSignal?.aborted).toBe(true);
  expect(screen.getByText("000007")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Открыть в новой вкладке" }).hasAttribute("disabled")).toBe(false);
});
