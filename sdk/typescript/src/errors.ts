import type { RateLimitInfo, UnknownRecord } from "./types.js";

export interface NFLMetaErrorDetails {
  code?: string;
  payload?: unknown;
  rateLimit?: RateLimitInfo;
}

export class NFLMetaError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly payload?: unknown;
  readonly rateLimit?: RateLimitInfo;

  constructor(message: string, status: number, details: NFLMetaErrorDetails = {}) {
    super(message);
    this.name = "NFLMetaError";
    this.status = status;
    this.code = details.code;
    this.payload = details.payload;
    this.rateLimit = details.rateLimit;
  }
}

/**
 * A request was refused before it was sent, because its URL left the configured
 * API origin.
 *
 * This is not a server status. `status` is 0 precisely because nothing was
 * transmitted: the client attaches X-NFLMeta-Key to every request, so a URL
 * pointing somewhere else has to be stopped before any header is built, not
 * reported after the fact.
 */
export class NFLMetaInvalidUrlError extends NFLMetaError {
  constructor(message: string, details: NFLMetaErrorDetails = {}) {
    super(message, 0, { code: "invalid_url", ...details });
    this.name = "NFLMetaInvalidUrlError";
  }
}

export class NFLMetaBadRequestError extends NFLMetaError {
  constructor(message: string, details: NFLMetaErrorDetails = {}) {
    super(message, 400, details);
    this.name = "NFLMetaBadRequestError";
  }
}

export class NFLMetaUnauthorizedError extends NFLMetaError {
  constructor(message: string, details: NFLMetaErrorDetails = {}) {
    super(message, 401, details);
    this.name = "NFLMetaUnauthorizedError";
  }
}

export class NFLMetaNotFoundError extends NFLMetaError {
  constructor(message: string, details: NFLMetaErrorDetails = {}) {
    super(message, 404, details);
    this.name = "NFLMetaNotFoundError";
  }
}

export class NFLMetaRateLimitError extends NFLMetaError {
  constructor(message: string, details: NFLMetaErrorDetails = {}) {
    super(message, 429, details);
    this.name = "NFLMetaRateLimitError";
  }
}

export class NFLMetaTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`NFLMeta request timed out after ${timeoutMs}ms`);
    this.name = "NFLMetaTimeoutError";
  }
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function messageFromPayload(payload: unknown, fallback: string): string {
  if (!isRecord(payload)) return fallback;
  const error = payload.error;
  if (!isRecord(error)) return fallback;
  const message = error.message;
  return typeof message === "string" && message.trim() ? message : fallback;
}

function codeFromPayload(payload: unknown): string | undefined {
  if (!isRecord(payload)) return undefined;
  const error = payload.error;
  if (!isRecord(error)) return undefined;
  return typeof error.code === "string" && error.code.trim() ? error.code : undefined;
}

export function createHttpError(status: number, payload: unknown, rateLimit?: RateLimitInfo): NFLMetaError {
  const fallback = `NFLMeta request failed with status ${status}`;
  const message = messageFromPayload(payload, fallback);
  const details: NFLMetaErrorDetails = {
    code: codeFromPayload(payload),
    payload,
    rateLimit,
  };

  if (status === 400) return new NFLMetaBadRequestError(message, details);
  if (status === 401) return new NFLMetaUnauthorizedError(message, details);
  if (status === 404) return new NFLMetaNotFoundError(message, details);
  if (status === 429) return new NFLMetaRateLimitError(message, details);
  return new NFLMetaError(message, status, details);
}
