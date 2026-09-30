"use client";
import { useEffect, useRef, useState } from "react";
import { clientRequest, errorMessage } from "./clientRequest";
import type { GameInfo, ModInfo } from "./types";

interface Resource<T> {
  game: string;
  data?: T;
  error?: string;
  loading?: boolean;
}

function waitForAnimation(signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const timer = setTimeout(finish, 5_000);
    signal.addEventListener("abort", finish, { once: true });
    if (signal.aborted) finish();
  });
}

export function useGameRequests(game: string, allowAdult: boolean) {
  const [last, setLast] = useState<Resource<number>>({ game: "" });
  const [info, setInfo] = useState<Resource<GameInfo>>({ game: "" });
  const [mod, setMod] = useState<Resource<ModInfo>>({ game: "" });
  const [previousGame, setPreviousGame] = useState(game);
  const [previousAdult, setPreviousAdult] = useState(allowAdult);
  const modController = useRef<AbortController | null>(null);

  // Reset during the guarded render, so revisiting a game cannot revive its old request.
  if (previousGame !== game) {
    setPreviousGame(game);
    setLast({ game: "" });
    setInfo({ game: "" });
    setMod({ game: "" });
  }
  if (previousAdult !== allowAdult) {
    setPreviousAdult(allowAdult);
    setMod({ game, data: mod.game === game ? mod.data : undefined });
  }

  useEffect(() => {
    if (!game) return;
    const controller = new AbortController();
    const signal = controller.signal;
    const query = new URLSearchParams({ game });
    void clientRequest<number>(`/api/getLastModId?${query}`, signal).then(
      (data) => { if (!signal.aborted) setLast({ game, data }); },
      (error) => { if (!signal.aborted) setLast({ game, error: errorMessage(error) }); },
    );
    void clientRequest<GameInfo>(`/api/getGameInfo?${query}`, signal).then(
      (data) => { if (!signal.aborted) setInfo({ game, data }); },
      (error) => { if (!signal.aborted) setInfo({ game, error: errorMessage(error) }); },
    );
    return () => controller.abort();
  }, [game]);

  useEffect(() => () => modController.current?.abort(), [game, allowAdult]);

  async function roll() {
    if (!game) return;
    modController.current?.abort();
    const controller = new AbortController();
    modController.current = controller;
    const previousResult = mod.game === game ? mod.data : undefined;
    setMod({ game, data: previousResult, loading: true });
    const animation = waitForAnimation(controller.signal);
    const query = new URLSearchParams({ game, boobs: String(allowAdult) });
    const [result] = await Promise.allSettled([
      clientRequest<ModInfo>(`/api/getModInfo?${query}`, controller.signal, "POST"),
      animation,
    ]);
    if (controller.signal.aborted) return;
    if (result.status === "fulfilled") setMod({ game, data: result.value });
    else setMod({ game, data: previousResult, error: errorMessage(result.reason) });
  }

  const currentMod = mod.game === game ? mod : undefined;
  return {
    roll,
    loading: currentMod?.loading ?? false,
    mod: currentMod?.data,
    lastId: last.game === game ? last.data ?? 0 : 0,
    categories: info.game === game ? info.data?.categories ?? [] : [],
    error: currentMod?.error || (last.game === game ? last.error : "") || (info.game === game ? info.error : "") || "",
  };
}
