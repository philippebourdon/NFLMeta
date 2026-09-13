import test from "node:test";
import assert from "node:assert/strict";

import {
  NFLMetaBadRequestError,
  NFLMetaClient,
  NFLMetaUnauthorizedError,
} from "../dist/index.js";

function response(body, init = {}) {
  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json",
      ...init.headers,
    },
    status: init.status ?? 200,
  });
}

test("adds api key header and parses rate limit headers", async () => {
  let requestUrl;
  let requestHeaders;

  const client = new NFLMetaClient({
    apiKey: "test-key",
    fetch: async (input, init) => {
      requestUrl = String(input);
      requestHeaders = new Headers(init?.headers);
      return response(
        {
          data: [{ year: 2025, id: 57 }],
          meta: { total: 1, returned: 1 },
        },
        {
          headers: {
            "X-RateLimit-Limit": "1000",
            "X-RateLimit-Remaining": "999",
            "X-RateLimit-Reset": "2026-04-01T00:00:00.000Z",
            "X-RateLimit-Policy": "monthly",
          },
        },
      );
    },
  });

  const result = await client.seasons.list({ year_from: 2025, limit: 1 });

  assert.equal(requestHeaders.get("X-NFLMeta-Key"), "test-key");
  assert.match(requestUrl, /\/api\/v1\/seasons\?year_from=2025&limit=1$/);
  assert.equal(result.rateLimit.limit, 1000);
  assert.equal(result.rateLimit.remaining, 999);
  assert.equal(result.data[0].year, 2025);
});

test("throws typed unauthorized errors", async () => {
  const client = new NFLMetaClient({
    fetch: async () =>
      response(
        {
          error: {
            code: "unauthorized",
            message: "invalid api key",
          },
        },
        { status: 401 },
      ),
  });

  await assert.rejects(() => client.usage.get(), (error) => {
    assert.ok(error instanceof NFLMetaUnauthorizedError);
    assert.equal(error.status, 401);
    assert.equal(error.code, "unauthorized");
    return true;
  });
});

test("builds nested resource paths correctly", async () => {
  let requestUrl;

  const client = new NFLMetaClient({
    fetch: async (input) => {
      requestUrl = String(input);
      return response({
        data: {
          field: "pass_passer_rating",
          value: 99.4,
        },
      });
    },
  });

  const result = await client.players.careerField("josh-allen-1996", "pass_passer_rating");

  assert.match(requestUrl, /\/api\/v1\/players\/josh-allen-1996\/career\/pass_passer_rating$/);
  assert.equal(result.data.value, 99.4);
});

test("coach history field uses the implemented field route", async () => {
  let requestUrl;

  const client = new NFLMetaClient({
    fetch: async (input) => {
      requestUrl = String(input);
      return response({
        data: {
          field: "team_records",
          value: [{ team_abbr: "PIT", wins: 183 }],
        },
      });
    },
  });

  const result = await client.coaches.historyField("mike-tomlin", "team_records");

  assert.match(requestUrl, /\/api\/v1\/coaches\/mike-tomlin\/history\/team_records$/);
  assert.equal(result.data.value[0].team_abbr, "PIT");
});

test("live scores use the supported v1 resource and preserve feed metadata", async () => {
  let requestUrl;
  const client = new NFLMetaClient({
    apiKey: "free-key",
    fetch: async (input) => {
      requestUrl = String(input);
      return response({
        data: [{
          game_id: 42,
          away_team: { abbr: "WAS", name: "Washington Commanders", logo_url: null, score: 10 },
          home_team: { abbr: "PHI", name: "Philadelphia Eagles", logo_url: null, score: 14 },
          phase: "in",
        }],
        meta: {
          available: true,
          stale: false,
          generated_at: "2026-09-11T01:00:05.000Z",
          last_success_at: "2026-09-11T01:00:00.000Z",
          last_change_at: "2026-09-11T00:59:58.000Z",
          recommended_poll_seconds: 10,
          target_delay_seconds: 20,
          service_level: "best_effort",
        },
      });
    },
  });

  const result = await client.liveScores.get();

  assert.equal(requestUrl, "https://nflmeta.org/api/v1/live-scores");
  assert.equal(result.data[0].home_team.score, 14);
  assert.equal(result.meta.service_level, "best_effort");
});

test("plays resource builds the three play routes and serializes filters", async () => {
  const requested = [];

  const client = new NFLMetaClient({
    fetch: async (input) => {
      requested.push(String(input));
      return response({ data: [], meta: { returned: 0 } });
    },
  });

  await client.plays.list({ game_id: 21390, skip_markers: true, limit: 5 });
  await client.plays.summary({ season: 2024, group_by: "team", season_type: "REG" });
  await client.plays.leaders({ season: 2024, role: "passer", min_plays: 300 });

  assert.match(requested[0], /\/api\/v1\/plays\?game_id=21390&skip_markers=true&limit=5$/);
  assert.match(requested[1], /\/api\/v1\/plays\/summary\?season=2024&group_by=team&season_type=REG$/);
  assert.match(requested[2], /\/api\/v1\/plays\/leaders\?season=2024&role=passer&min_plays=300$/);
});

test("plays list surfaces the narrowing-filter refusal as a bad request error", async () => {
  // /api/v1/plays answers 400 rather than serving an arbitrary page out of 1.28
  // million rows. The SDK has to turn that into something a caller can branch
  // on, not a generic failure.
  const client = new NFLMetaClient({
    fetch: async () =>
      response(
        {
          error: {
            code: "invalid_request",
            message:
              "a narrowing filter is required: pass game_id, or player, or season with one of week, team, or opponent.",
          },
        },
        { status: 400 },
      ),
  });

  await assert.rejects(() => client.plays.list(), (error) => {
    assert.ok(error instanceof NFLMetaBadRequestError);
    assert.equal(error.status, 400);
    assert.equal(error.code, "invalid_request");
    assert.match(error.message, /narrowing filter/);
    return true;
  });
});

test("plays summary returns typed aggregate rows with their rate basis", async () => {
  const client = new NFLMetaClient({
    fetch: async () =>
      response({
        data: [
          {
            group_key: "ARI",
            plays: 1369,
            scrimmage_plays: 1031,
            epa_per_play: 0.0671,
            success_rate: 0.4733,
          },
        ],
        meta: { group_by: "team", rate_basis: "scrimmage_plays", returned: 1 },
      }),
  });

  const result = await client.plays.summary({ season: 2024, group_by: "team" });

  assert.equal(result.data[0].group_key, "ARI");
  assert.equal(result.data[0].scrimmage_plays, 1031);
  assert.equal(result.meta.rate_basis, "scrimmage_plays");
});

// ---------------------------------------------------------------------------
// The key must not leave the configured origin
// ---------------------------------------------------------------------------
//
// get() used to accept any absolute http(s) URL and then attach X-NFLMeta-Key to
// it unconditionally. An application passing a user-controlled or mistakenly
// absolute URL handed its key to whatever host was named, with no warning.
//
// Two separate escapes are pinned here, because closing one leaves the other:
// the request URL, and a redirect. Node's fetch strips Authorization across a
// cross-origin redirect but forwards X-NFLMeta-Key intact, so following one
// blindly is a leak on its own.

test("refuses a cross-origin request URL before any header is built", async () => {
  let fetchCalled = false;
  const client = new NFLMetaClient({
    apiKey: "nflmeta_secret",
    fetch: async () => {
      fetchCalled = true;
      return response({ data: [] });
    },
  });

  for (const target of [
    "https://attacker.invalid/collect",
    "http://attacker.invalid/collect",
    "https://nflmeta.org.attacker.invalid/api/v1/players",
  ]) {
    await assert.rejects(
      () => client.get(target),
      (error) => {
        assert.equal(error.name, "NFLMetaInvalidUrlError");
        assert.equal(error.code, "invalid_url");
        // Nothing was sent, so there is no server status to report.
        assert.equal(error.status, 0);
        return true;
      },
      `${target} was not refused`,
    );
  }

  assert.equal(fetchCalled, false, "the transport ran at all -- the check is in the wrong place");
});

test("still accepts a same-origin absolute URL", async () => {
  let requestUrl;
  const client = new NFLMetaClient({
    apiKey: "nflmeta_secret",
    fetch: async (input) => {
      requestUrl = String(input);
      return response({ data: [], meta: {} });
    },
  });

  await client.get("https://nflmeta.org/api/v1/players");
  assert.equal(requestUrl, "https://nflmeta.org/api/v1/players");
});

test("refuses a path that resolves outside /api/v1", async () => {
  const client = new NFLMetaClient({ apiKey: "nflmeta_secret", fetch: async () => response({ data: [] }) });
  await assert.rejects(() => client.get("/admin/api"), { name: "NFLMetaInvalidUrlError" });
});

test("refuses to follow a redirect off the API origin, and follows one that stays", async () => {
  const seen = [];
  const client = new NFLMetaClient({
    apiKey: "nflmeta_secret",
    fetch: async (input) => {
      const url = String(input);
      seen.push(url);
      if (url === "https://nflmeta.org/api/v1/players") {
        return new Response(null, { status: 302, headers: { location: "https://attacker.invalid/collect" } });
      }
      return response({ data: [], meta: {} });
    },
  });

  await assert.rejects(() => client.get("/api/v1/players"), { name: "NFLMetaInvalidUrlError" });
  assert.deepEqual(seen, ["https://nflmeta.org/api/v1/players"], "the redirect target was requested anyway");

  const followed = [];
  const ok = new NFLMetaClient({
    apiKey: "nflmeta_secret",
    fetch: async (input) => {
      const url = String(input);
      followed.push(url);
      if (url === "https://nflmeta.org/api/v1/players/") {
        return new Response(null, { status: 308, headers: { location: "/api/v1/players" } });
      }
      return response({ data: [], meta: {} });
    },
  });

  await ok.get("/api/v1/players/");
  assert.deepEqual(followed, [
    "https://nflmeta.org/api/v1/players/",
    "https://nflmeta.org/api/v1/players",
  ]);
});
