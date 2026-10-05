import { resumeSupportPreviewRequest } from "@/lib/support-preview-routing";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher(["/admin(.*)", "/account(.*)", "/customer-portal(.*)"]);

const BOT_USER_AGENT_RE =
  /\b(amazonbot|applebot|ahrefsbot|bingbot|bytespider|ccbot|chatgpt-user|claudebot|crawler|dotbot|duckduckbot|facebookexternalhit|facebot|gptbot|googlebot|googleother|mj12bot|meta-externalagent|oai-searchbot|perplexitybot|petalbot|semrushbot|seznambot|sogou|spider|yandexbot)\b/i;

const handleClerkRoute = clerkMiddleware(async (auth, req) => {
  if (process.env.NFLMETA_SUPPORT_PRIVATE_PREVIEW === "1") {
    const { userId } = await auth();
    if (!userId) {
      const signIn = new URL("https://nflmeta.org/sign-in");
      signIn.searchParams.set("redirect_url", `${req.nextUrl.basePath}${req.nextUrl.pathname}`);
      return NextResponse.redirect(signIn);
    }
  }
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

function isMaintenanceEnabled(): boolean {
  const raw = process.env.SITE_MAINTENANCE_MODE?.trim().toLowerCase() || process.env.NFLMETA_MAINTENANCE_MODE?.trim().toLowerCase() || "";
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function isBotBlockingEnabled(): boolean {
  const raw = process.env.NFLMETA_BLOCK_BOTS?.trim().toLowerCase() || "false";
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function isBotBlockedPath(pathname: string): boolean {
  return pathname !== "/robots.txt"
    && pathname !== "/favicon.ico"
    && !pathname.startsWith("/_next/")
    && !pathname.startsWith("/api/")
    && !pathname.startsWith("/sign-in")
    && !pathname.startsWith("/sign-up")
    && pathname !== "/status"
    && pathname !== "/maintenance";
}

function isBlockedBotRequest(req: NextRequest): boolean {
  if (!isBotBlockingEnabled()) return false;
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  if (!isBotBlockedPath(req.nextUrl.pathname)) return false;

  const userAgent = req.headers.get("user-agent") || "";
  return BOT_USER_AGENT_RE.test(userAgent);
}

function isMaintenanceExempt(pathname: string): boolean {
  return pathname === "/maintenance"
    || pathname === "/status"
    || pathname === "/sign-in"
    || pathname === "/sign-up"
    || pathname.startsWith("/api/")
    || pathname.startsWith("/_next/");
}

function isProductionDesignPath(pathname: string): boolean {
  return process.env.NODE_ENV === "production"
    && (pathname === "/design" || pathname.startsWith("/design/"));
}

function rewriteToNotFound(req: NextRequest): NextResponse {
  const notFound = req.nextUrl.clone();
  notFound.pathname = "/_not-found";
  return NextResponse.rewrite(notFound);
}

/**
 * True when any segment of `pathname` carries a percent-escape that
 * decodeURIComponent cannot decode.
 *
 * WHY THIS EXISTS
 *
 * `GET /api/v1/players/%%%` used to answer `Internal Server Error` as
 * text/plain with status 500 -- not the JSON envelope docs/openapi.yaml
 * promises for every route, and not something the application could even see.
 * `%E0%A4%A`, `%C0%80` and `%FF` did the same, and so did the page routes:
 * `/players/%%%` and `/teams/%%%` were identical failures.
 *
 * The throw is not in any handler. Next builds a params object by running
 * decodeURIComponent over each matched dynamic segment, in getRouteMatcher
 * (next/dist/shared/lib/router/utils/route-matcher.js), and raises
 * `DecodeError: failed to decode param` when that fails. That happens in the
 * routing layer, before a route module is invoked, so withApiErrorHandling in
 * api-route-error.ts never runs and Sentry never hears about it. Next then
 * tries to render its own error page for the DecodeError, that render fails
 * too, and the last-resort branch in base-server.js returns the bare
 * `RenderResult.fromStatic('Internal Server Error', 'text/plain')` seen on the
 * wire -- which is also why the response carries none of the security headers
 * next.config.ts sets.
 *
 * Middleware is the only layer that runs earlier, which is why the check is
 * here rather than in a handler. That it does run first was verified rather
 * than assumed: a malformed path still reaches this function (a bot-agent
 * request for `/players/%%%` is answered by the 403 above, and the 404 for
 * `/api/%%%` comes back carrying `x-middleware-rewrite` and Clerk's headers).
 *
 * The test is applied per segment rather than to the whole path because that
 * is exactly the question the router is about to ask: it decodes each dynamic
 * segment on its own. Only genuinely undecodable escapes match -- a legitimate
 * `%25` or `%C3%A9` in a slug decodes fine and passes straight through.
 */
function hasUndecodablePathSegment(pathname: string): boolean {
  // Nothing to decode without an escape, and that is nearly every request, so
  // the try/catch below stays off the common path.
  if (!pathname.includes("%")) return false;

  for (const segment of pathname.split("/")) {
    if (!segment.includes("%")) continue;
    try {
      decodeURIComponent(segment);
    } catch {
      return true;
    }
  }
  return false;
}

/**
 * The answer to a request whose path cannot be decoded.
 *
 * A path the client encoded wrongly is a client error, so the status is 400
 * and not the 500 this used to return. The code is `invalid_request`, which is
 * already in the ApiErrorCode union in api-key.ts and already what routes
 * return for a malformed input (`invalid season`, `season_year must be a
 * number`); no new code is introduced for this.
 *
 * The envelope is written out literally rather than imported from
 * api-key.ts because this file runs as middleware: api-key.ts reaches for
 * node:crypto, pg and the database, none of which belong in this bundle. It is
 * byte-identical to what apiErrorBody() produces -- `error.code`,
 * `error.message`, `error.status`, in that order, with the status repeated in
 * the body -- and the unit test pins that against apiErrorBody itself so the
 * two cannot drift apart silently.
 *
 * Non-API paths deliberately do NOT get JSON. A person who mistypes a URL
 * should see the branded 404 page, so those are rewritten to Next's own
 * not-found route, which renders src/app/not-found.tsx with status 404 -- the
 * same response `/players/does-not-exist` already gives.
 */
function malformedPathResponse(req: NextRequest, pathname: string): NextResponse {
  if (!pathname.startsWith("/api/")) {
    return rewriteToNotFound(req);
  }

  return NextResponse.json(
    { error: { code: "invalid_request", message: "malformed percent-encoding in request path", status: 400 } },
    { status: 400 },
  );
}

export default async function proxy(req: NextRequest, event: Parameters<typeof handleClerkRoute>[1]) {
  const pathname = req.nextUrl.pathname;

  // Design studies are useful locally, but they are not product pages. Keep
  // the whole namespace unavailable in production so a newly-added mock
  // cannot become public merely because its page file was deployed.
  if (isProductionDesignPath(pathname)) {
    return rewriteToNotFound(req);
  }

  if (isBlockedBotRequest(req)) {
    // This response MUST NOT be stored by a shared cache.
    //
    // It used to say `public, max-age=300`, and that took the site down one page
    // at a time for four months. The decision above is made on User-Agent, but
    // nginx caches on "$scheme$request_method$host$request_uri" -- no user agent
    // anywhere in the key. So the first crawler to touch a page stored this
    // 403 under that page's URL, and every human who asked for it within the
    // next five minutes was handed "bot traffic blocked" instead of the page.
    // Verified on the running server, not reasoned about: ClaudeBot fetched
    // /faq (403, x-proxy-cache: MISS), a browser user-agent asked for /faq a
    // second later and got 403 with x-proxy-cache: HIT.
    //
    // `Vary: User-Agent` would be the other half of a correct answer, but it is
    // not the answer here: it makes the entry uncacheable in practice anyway
    // (user agents are effectively unique), and it relies on every intermediary
    // honouring it. Refusing storage outright is what this response actually
    // wants -- it is cheap to recompute, and a wrong hit costs a real reader
    // the page.
    return new NextResponse("bot traffic blocked", {
      status: 403,
      headers: {
        "Cache-Control": "private, no-store",
        "Vary": "User-Agent",
        "Content-Type": "text/plain; charset=utf-8",
        "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
      },
    });
  }

  if (isMaintenanceEnabled() && !isMaintenanceExempt(pathname)) {
    if (req.method === "GET") {
      return NextResponse.redirect(new URL("/maintenance", req.url), { status: 307 });
    }
    return NextResponse.json({ error: { code: "maintenance", message: "maintenance mode active" } }, { status: 503 });
  }

  // Ahead of Clerk, because a path this broken has no business reaching an
  // auth check, and because everything downstream of here -- Clerk included --
  // is entitled to assume the router can decode the path it was handed.
  if (hasUndecodablePathSegment(pathname)) {
    return malformedPathResponse(req, pathname);
  }

  // This standalone flow verifies the supplied NFLMeta API key itself. Do not
  // send a visitor's Clerk cookies through an unrelated session handshake.
  if (pathname === '/plex/setup' || pathname === '/plex/setup/action' || pathname === '/api/internal/support-email') return NextResponse.next();
  const response = await handleClerkRoute(req, event);
  // Next normalizes a loopback request URL to localhost, while its router keeps
  // the explicit listener address. Clerk's same-URL resume rewrite can then
  // proxy back to this listener. Retain Clerk's response/context and resume it
  // internally; the helper leaves redirects and different destinations intact.
  if (response) {
    resumeSupportPreviewRequest(req.url, response.headers);
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
