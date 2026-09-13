import { NextResponse } from "next/server";
import { appQuery, query } from "@/lib/db";
import { withApiErrorHandling } from "@/lib/api-route-error";

/**
 * The one v1 route that needs no API key, and therefore the only thing an
 * external monitor can ask without holding a credential.
 *
 * It used to check one database. That was not nothing -- it is a real round
 * trip, not a liveness ping -- but it checked the wrong half of the problem.
 * `query` goes to the content database; `api_keys` lives in the *app* database
 * behind APP_DATABASE_URL, which db.ts deliberately refuses to let fall back.
 * With the app database unreachable every key lookup throws, all 171
 * authenticated endpoints answer 500, and this endpoint still reported
 * `{"status":"ok"}` because the content database was fine. The health check
 * would stay green through a total loss of the paid product.
 *
 * Two rules constrain what can be added here. It is unauthenticated, so the
 * body must never carry a connection string, a driver message or a stack
 * frame -- an attacker learning the database host from a health endpoint is
 * worse than having no health endpoint. And a monitor calls it every few
 * minutes, so it must stay cheap and bounded: two `SELECT 1`s in parallel
 * under a hard timeout, never a count or a join.
 */

// A health endpoint that can be answered from a build-time cache is not a
// health endpoint. Nothing in this handler reads the request, which is exactly
// the shape Next will try to prerender.
export const dynamic = "force-dynamic";

/** Bounded so a hung pool cannot hold this request open indefinitely. */
const CHECK_TIMEOUT_MS = 3_000;

type CheckState = "ok" | "unavailable";

async function probe(run: () => Promise<unknown>): Promise<CheckState> {
  try {
    await Promise.race([
      run(),
      new Promise((_resolve, reject) => {
        setTimeout(() => reject(new Error("health check timed out")), CHECK_TIMEOUT_MS).unref?.();
      }),
    ]);
    return "ok";
  } catch (error) {
    // Logged in full server-side; the caller is told only "unavailable".
    console.error("Health check dependency failed", error);
    return "unavailable";
  }
}

async function handleGET() {
  const startedAt = Date.now();

  const [contentDatabase, appDatabase] = await Promise.all([
    probe(() => query<{ ok: number }>("SELECT 1 AS ok")),
    probe(() => appQuery<{ ok: number }>("SELECT 1 AS ok")),
  ]);

  const checks = { contentDatabase, appDatabase };
  const healthy = contentDatabase === "ok" && appDatabase === "ok";

  return NextResponse.json(
    {
      data: {
        status: healthy ? "ok" : "degraded",
        // Retained for callers written against the original shape, which had
        // no `checks` object and read this boolean.
        db: contentDatabase === "ok",
        checks,
        durationMs: Date.now() - startedAt,
      },
    },
    {
      // 503 rather than 200-with-a-sad-body: a monitor, a load balancer and a
      // deploy gate all read the status line, and only some of them parse JSON.
      status: healthy ? 200 : 503,
      headers: { "cache-control": "no-store" },
    },
  );
}

export const GET = withApiErrorHandling(handleGET);
