/**
 * A small in-process fixed-window rate limiter.
 *
 * Deliberately not shared state: each Node process keeps its own counters, so
 * this bounds what one process will do rather than what an attacker can do
 * across a fleet. NFLMeta runs one process, so today those are the same thing;
 * if that ever stops being true this becomes a per-process ceiling and the real
 * limit belongs at the edge.
 *
 * Fixed window rather than sliding: a burst can cross a window boundary and get
 * up to two windows' worth. That is accepted. The purpose here is to stop an
 * unauthenticated endpoint being used to fill a database, not to meter precisely.
 *
 * The client table is capped and cleared wholesale when it fills, because an
 * attacker rotating source addresses would otherwise turn the limiter itself
 * into the memory leak it exists to prevent.
 */
export class FixedWindowRateLimiter {
  private readonly windowMs: number;
  private readonly perClient: number;
  private readonly global: number;
  private readonly maxClients: number;
  private readonly now: () => number;

  private clients = new Map<string, { windowStart: number; count: number }>();
  private globalWindowStart = 0;
  private globalCount = 0;

  constructor(options: {
    windowMs?: number;
    perClient: number;
    global: number;
    maxClients?: number;
    now?: () => number;
  }) {
    this.windowMs = options.windowMs ?? 60_000;
    this.perClient = options.perClient;
    this.global = options.global;
    this.maxClients = options.maxClients ?? 5_000;
    this.now = options.now ?? Date.now;
  }

  /** How many clients are currently tracked. For tests and diagnostics. */
  trackedClients(): number {
    return this.clients.size;
  }

  /** True when this request is allowed. Counts it when it is. */
  allow(client: string): boolean {
    const now = this.now();

    if (now - this.globalWindowStart >= this.windowMs) {
      this.globalWindowStart = now;
      this.globalCount = 0;
    }
    if (this.globalCount >= this.global) return false;

    const entry = this.clients.get(client);
    if (!entry || now - entry.windowStart >= this.windowMs) {
      if (!entry && this.clients.size >= this.maxClients) this.clients.clear();
      this.clients.set(client, { windowStart: now, count: 1 });
      this.globalCount += 1;
      return true;
    }
    if (entry.count >= this.perClient) return false;

    entry.count += 1;
    this.globalCount += 1;
    return true;
  }
}
