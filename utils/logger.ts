import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";

type Level = "debug" | "info" | "warn" | "error";
type Fields = Record<string, string | number | boolean | undefined>;
const levels: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const context = new AsyncLocalStorage<{ requestId: string }>();

export function log(level: Level, event: string, fields: Fields = {}) {
  const configured = process.env.LOG_LEVEL;
  const minimum = configured && Object.hasOwn(levels, configured) ? levels[configured as Level] : levels.info;
  if (levels[level] < minimum) return;
  try {
    console[level](JSON.stringify({ ...fields, timestamp: new Date().toISOString(), level, event,
      requestId: context.getStore()?.requestId }));
  } catch {
    // Observability must not change the outcome of a request if the output stream fails.
  }
}

export function durationSince(start: number): number {
  return Math.round((performance.now() - start) * 100) / 100;
}

export function statusLevel(status: number): Level {
  return status === 499 ? "info" : status >= 500 ? "error" : status >= 400 ? "warn" : "info";
}

export function errorType(error: unknown): string {
  // Arbitrary exception messages, names and stacks can contain URLs or credentials.
  const name = error instanceof Error ? error.name : "UnknownError";
  return ["Error", "TypeError", "SyntaxError", "TimeoutError", "AbortError"].includes(name) ? name : "UnknownError";
}

export function withRequestLogging(route: string, handler: (req: NextRequest) => Promise<NextResponse>) {
  return (req: NextRequest) => context.run({ requestId: randomUUID() }, async () => {
    const start = performance.now();
    const value = req.nextUrl.searchParams.get("game");
    const game = value && value.length <= 100 && /^[a-z0-9][a-z0-9_-]*$/.test(value) ? value : undefined;
    const fields = { route, method: req.method, game, allowAdult: req.nextUrl.searchParams.get("boobs") === "true" };
    log("info", "request.started", fields);
    let status = 500;
    let failure: string | undefined;
    try {
      const response = await handler(req);
      status = response.status;
      response.headers.set("x-request-id", context.getStore()!.requestId);
      return response;
    } catch (error) {
      failure = errorType(error);
      throw error;
    } finally {
      log(statusLevel(status), "request.completed", { ...fields, status, durationMs: durationSince(start), errorType: failure });
    }
  });
}
