/* Server cache shared across requests.

   The site runs on Cloudflare Workers, where a request can land on a fresh
   isolate whose module-level memory is empty. The old in-memory Map therefore
   missed on most requests, and every page load refetched every provider and
   re-ran the AI news translation — 17 to 30 seconds per load.

   Entries now also go to Cloudflare's Cache API (`caches.default`), which is
   shared by every isolate in the same data centre. Memory stays as the first
   tier, and is the only tier locally, where `caches.default` does not exist.

   Every entry is kept for a long time after it goes stale, for two reasons:
   a provider failure falls back to the last good value, and slow sources can be
   served stale while they refresh in the background (`swrMs`). */

import { getRequest } from "@tanstack/react-start/server";

type Entry = { value: unknown; storedAt: number };

const memory = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();

/** How long anything is kept for fallback, regardless of its freshness TTL. */
const KEEP_MS = 7 * 24 * 60 * 60_000;

type CfCache = {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
};

type WaitUntil = (promise: Promise<unknown>) => void;

function sharedCache(): CfCache | null {
  const storage = (globalThis as { caches?: { default?: CfCache } }).caches;
  return storage?.default ?? null;
}

function currentRequest(): (Request & { waitUntil?: WaitUntil }) | null {
  try {
    return getRequest() as Request & { waitUntil?: WaitUntil };
  } catch {
    return null; // outside a request
  }
}

let warnedNoWaitUntil = false;

/** Keep work alive after the response is sent. Workers cancel unfinished work
    once a response is out unless it is registered with waitUntil. */
export function background(promise: Promise<unknown>): void {
  const settled = promise.catch((error) => console.error("[cache] background task failed", error));
  const waitUntil =
    currentRequest()?.waitUntil ?? (globalThis as { __wait_until__?: WaitUntil }).__wait_until__;
  if (waitUntil) {
    waitUntil(settled);
  } else if (sharedCache() && !warnedNoWaitUntil) {
    // Only worth a warning on Workers; Node keeps the promise running anyway.
    warnedNoWaitUntil = true;
    console.warn("[cache] waitUntil unavailable; background refresh may be cut short");
  }
}

function cacheKeyRequest(key: string): Request {
  let origin = "https://united-cache.internal";
  const request = currentRequest();
  if (request) {
    try {
      origin = new URL(request.url).origin;
    } catch {
      /* keep the fallback origin */
    }
  }
  return new Request(`${origin}/__united-cache/${encodeURIComponent(key)}`);
}

async function readShared(key: string): Promise<Entry | null> {
  const cache = sharedCache();
  if (!cache) return null;
  try {
    const response = await cache.match(cacheKeyRequest(key));
    if (!response) return null;
    return (await response.json()) as Entry;
  } catch (error) {
    console.error("[cache] shared read failed", key, error);
    return null;
  }
}

function writeShared(key: string, entry: Entry): void {
  const cache = sharedCache();
  if (!cache) return;
  const response = new Response(JSON.stringify(entry), {
    headers: {
      "content-type": "application/json",
      "cache-control": `public, max-age=${Math.round(KEEP_MS / 1000)}`,
    },
  });
  background(cache.put(cacheKeyRequest(key), response));
}

async function lookup(key: string): Promise<{ entry: Entry; tier: "memory" | "shared" } | null> {
  const local = memory.get(key);
  // Another isolate may have refreshed the shared copy since; prefer whichever
  // is newer once the local one has gone stale.
  const shared = local && Date.now() - local.storedAt < 30_000 ? null : await readShared(key);
  if (shared && (!local || shared.storedAt > local.storedAt)) {
    memory.set(key, shared);
    return { entry: shared, tier: "shared" };
  }
  return local ? { entry: local, tier: "memory" } : null;
}

function store(key: string, value: unknown): void {
  const entry = { value, storedAt: Date.now() };
  memory.set(key, entry);
  writeShared(key, entry);
}

/** One load per key at a time, so a burst of cache misses (several tabs, the
    30-second live poll) shares a single upstream call — and a single AI
    translation — instead of firing one each. */
function refresh<T>(key: string, load: () => Promise<T>): Promise<T> {
  const running = inflight.get(key);
  if (running) return running as Promise<T>;
  const started = Date.now();
  const promise = load()
    .then((value) => {
      store(key, value);
      console.log(`[cache] loaded ${key} in ${Date.now() - started}ms`);
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

export async function cached<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
  options: { swrMs?: number } = {},
): Promise<T> {
  const hit = await lookup(key);
  const age = hit ? Date.now() - hit.entry.storedAt : Infinity;

  if (hit && age < ttlMs) {
    if (hit.tier === "shared") console.log(`[cache] shared hit ${key}`);
    return hit.entry.value as T;
  }

  // Stale but within the stale-while-revalidate window: answer now, refresh after.
  if (hit && options.swrMs && age < ttlMs + options.swrMs) {
    console.log(`[cache] stale ${key} (${Math.round(age / 1000)}s old), refreshing in background`);
    background(refresh(key, load));
    return hit.entry.value as T;
  }

  try {
    return await refresh(key, load);
  } catch (err) {
    console.error("[manutd] load failed for", key, err);
    if (hit) return hit.entry.value as T;
    throw err;
  }
}

/** Store and read a value with no loader, e.g. the last good snapshot. */
export function remember(key: string, value: unknown): void {
  store(key, value);
}

export async function recall<T>(key: string): Promise<T | null> {
  const hit = await lookup(key);
  return hit ? (hit.entry.value as T) : null;
}

/** Resolve with `fallback` if `promise` has not settled by `deadline` (epoch ms).
    The work itself carries on in the background, so whatever it loads still
    lands in the cache for the next request. */
export function withDeadline<T>(promise: Promise<T>, deadline: number, fallback: T): Promise<T> {
  const remaining = deadline - Date.now();
  if (remaining <= 0) {
    background(promise);
    return Promise.resolve(fallback);
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      background(promise);
      resolve(fallback);
    }, remaining);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
