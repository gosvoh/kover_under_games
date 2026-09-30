export async function clientRequest<T>(url: string, signal: AbortSignal, method: "GET" | "POST" = "GET"): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    method,
    signal: AbortSignal.any([signal, AbortSignal.timeout(25_000)]),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(typeof body?.message === "string" ? body.message : `Ошибка запроса (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.name === "TimeoutError") return "Сервер не ответил вовремя. Попробуйте ещё раз.";
  return error instanceof Error ? error.message : "Не удалось выполнить запрос.";
}
