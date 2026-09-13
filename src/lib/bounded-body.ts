import type { NextRequest } from "next/server";

/**
 * Read at most `maxBytes` from a request body, counting as it goes.
 *
 * `req.text()` and `req.json()` buffer whatever the client sends before any of
 * our code can object, so an unauthenticated endpoint that calls either has no
 * ceiling at all: the memory is spent before the size is known. `Content-Length`
 * is a claim by the sender rather than a fact -- chunked bodies carry none -- so
 * the header check here is only an early exit and the stream is what actually
 * enforces the limit.
 *
 * Returns null when the body is over the limit or the client hangs up. Callers
 * must treat that as a refusal, not as a truncated document: half a JSON body is
 * not a smaller version of the whole one.
 *
 * Lifted out of src/app/api/csp-report/route.ts, which had the only copy. The
 * public analytics endpoint needed the same ceiling and had none.
 */
export async function readBoundedBody(req: NextRequest, maxBytes: number): Promise<string | null> {
  const declared = Number.parseInt(req.headers.get("content-length") || "", 10);
  if (Number.isInteger(declared) && declared > maxBytes) return null;

  const body = req.body;
  if (!body) return "";

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } catch {
    // A client that hangs up mid-request is not an error anybody should see.
    return null;
  }

  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(joined);
}
