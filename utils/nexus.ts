import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { durationSince, errorType, log, statusLevel } from "./logger";

export class NexusError extends Error {
  constructor(public status: number, message: string, public retryAfter?: string) {
    super(message);
  }
}
export function getGameDomain(req: NextRequest): string {
  const game = req.nextUrl.searchParams.get("game");
  if (!game || game.length > 100 || !/^[a-z0-9][a-z0-9_-]*$/.test(game)) {
    throw new NexusError(400, "Выберите корректную игру.");
  }
  return game;
}
export async function nexusJson<T>(path: string, signal?: AbortSignal, revalidate?: number): Promise<T> {
  const start = performance.now();
  let status: number | undefined;
  const fields = { path, cachePolicy: revalidate ? "force-cache" : "no-store", revalidateSeconds: revalidate };
  log("debug", "nexus.started", fields);
  try {
    const key = process.env.NEXUSMODS_KEY;
    if (!key) throw new NexusError(500, "На сервере не настроен API-ключ Nexusmods.");
    const requestSignal = AbortSignal.any([AbortSignal.timeout(10_000), ...(signal ? [signal] : [])]);
    requestSignal.throwIfAborted();
    const response = await fetch(`https://api.nexusmods.com/v1/${path}`, {
      cache: revalidate ? "force-cache" : "no-store",
      ...(revalidate ? { next: { revalidate } } : {}),
      signal: requestSignal, headers: { apikey: key },
    });
    status = response.status;
    if (!response.ok) {
      await response.body?.cancel();
      const message = response.status === 429
        ? "Лимит запросов Nexusmods исчерпан. Попробуйте позже."
        : response.status === 401 || response.status === 403
          ? "Nexusmods отклонил доступ. Проверьте API-ключ на сервере."
          : response.status === 404
            ? "Игра или мод не найдены на Nexusmods."
            : "Nexusmods временно недоступен. Попробуйте позже.";
      throw new NexusError(response.status, message, response.headers.get("Retry-After") ?? undefined);
    }
    try {
      const data = await response.json() as T;
      log("info", "nexus.completed", { ...fields, status, durationMs: durationSince(start) });
      return data;
    } catch (error) {
      requestSignal.throwIfAborted();
      if (error instanceof SyntaxError) throw new NexusError(502, "Nexusmods вернул некорректные данные.");
      throw error;
    }
  } catch (error) {
    const aborted = signal?.aborted && signal.reason?.name !== "TimeoutError";
    const failureStatus = aborted ? 499 : error instanceof NexusError ? error.status : error instanceof Error && error.name === "TimeoutError" ? 504 : 502;
    log(aborted || failureStatus === 404 ? "info" : statusLevel(failureStatus), "nexus.failed", {
      ...fields, status, errorStatus: failureStatus, durationMs: durationSince(start), errorType: errorType(error),
    });
    throw error;
  }
}
export async function getLatestModId(game: string, signal?: AbortSignal): Promise<number> {
  const latest = await nexusJson<unknown>(`games/${game}/mods/latest_added.json`, signal);
  if (!Array.isArray(latest)) throw new NexusError(502, "Nexusmods вернул некорректный список модов.");
  if (latest.length === 0) throw new NexusError(404, "У этой игры пока нет модов.");
  const ids = latest.map((mod) => mod?.mod_id);
  if (ids.some((id) => !Number.isSafeInteger(id) || id < 1)) throw new NexusError(502, "Nexusmods вернул некорректные номера модов.");
  return Math.max(...ids);
}
function createNexusErrorResponse(error: unknown, signal?: AbortSignal): NextResponse {
  if (signal?.aborted) return NextResponse.json({ message: "Запрос отменён." }, { status: 499 });
  if (error instanceof NexusError) {
    return NextResponse.json({ message: error.message }, {
      status: error.status,
      headers: error.retryAfter ? { "Retry-After": error.retryAfter } : undefined,
    });
  }
  const timeout = error instanceof Error && error.name === "TimeoutError";
  return NextResponse.json({ message: timeout
    ? "Nexusmods не ответил вовремя. Попробуйте ещё раз."
    : "Не удалось связаться с Nexusmods. Попробуйте позже.",
  }, { status: timeout ? 504 : 502 });
}

export function nexusErrorResponse(error: unknown, signal?: AbortSignal): NextResponse {
  const response = createNexusErrorResponse(error, signal);
  log(statusLevel(response.status), "request.error", {
    status: response.status, errorType: errorType(error),
    // NexusError messages are controlled by this application; network exceptions are not.
    message: error instanceof NexusError ? error.message : undefined,
  });
  return response;
}
