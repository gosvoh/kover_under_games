// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import History from "../app/history";

const entry = { id: 1, game: "fallout4", modId: 7, name: "A new companion", adult: false, createdAt: "2026-09-30T10:00:00.000Z" };
const props = { game: "fallout4", gameName: "Fallout 4", allowAdult: false, paused: false };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

it("renders shared history as usable Nexusmods links", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json([entry])));
  render(<History {...props} />);
  const link = await screen.findByRole("link", { name: /A new companion/ });
  expect(link.getAttribute("href")).toBe("https://www.nexusmods.com/fallout4/mods/7");
  expect(link.getAttribute("rel")).toBe("noopener noreferrer");
});

it("prevents a previous game's delayed history from appearing after switching", async () => {
  let finishOld!: (response: Response) => void;
  let oldSignal: AbortSignal | undefined;
  vi.stubGlobal("fetch", vi.fn((url: string, options: RequestInit) => {
    if (url.includes("game=fallout4")) {
      oldSignal = options.signal ?? undefined;
      return new Promise<Response>((resolve) => { finishOld = resolve; });
    }
    return Promise.resolve(Response.json([{ ...entry, game: "skyrimspecialedition", name: "Skyrim result" }]));
  }));
  const { rerender } = render(<History {...props} />);
  rerender(<History {...props} game="skyrimspecialedition" gameName="Skyrim" />);
  expect(oldSignal?.aborted).toBe(true);
  expect(await screen.findByRole("link", { name: /Skyrim result/ })).toBeTruthy();
  await act(async () => { finishOld(Response.json([entry])); });
  expect(screen.queryByRole("link", { name: /A new companion/ })).toBeNull();
});

it("hides adult history immediately when the filter is disabled", async () => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => Response.json(url.includes("boobs=true") ? [{ ...entry, adult: true }] : [])));
  const { rerender } = render(<History {...props} allowAdult />);
  expect(await screen.findByRole("link", { name: /A new companion/ })).toBeTruthy();
  rerender(<History {...props} />);
  expect(screen.queryByRole("link", { name: /A new companion/ })).toBeNull();
  expect(await screen.findByText(/пока ничего не выпало/)).toBeTruthy();
});

it("pauses polling during a roll and refreshes immediately when its result is revealed", async () => {
  vi.useFakeTimers();
  const fetch = vi.fn(async () => Response.json([entry]));
  vi.stubGlobal("fetch", fetch);
  const { rerender, unmount } = render(<History {...props} />);
  await act(async () => {});
  expect(fetch).toHaveBeenCalledTimes(1);
  rerender(<History {...props} paused />);
  await act(async () => { await vi.advanceTimersByTimeAsync(20_000); });
  expect(fetch).toHaveBeenCalledTimes(1);
  rerender(<History {...props} result={{ mod_id: 7, available: true, status: "published", contains_adult_content: false }} />);
  await act(async () => {});
  expect(fetch).toHaveBeenCalledTimes(2);
  unmount();
  await act(async () => { await vi.advanceTimersByTimeAsync(20_000); });
  expect(fetch).toHaveBeenCalledTimes(2);
});

it("shows history failures without removing the rest of the page", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ message: "История временно недоступна." }, { status: 503 })));
  render(<History {...props} />);
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("История временно недоступна"));
  expect(screen.getByRole("button", { name: "Обновить историю" })).toBeTruthy();
});
