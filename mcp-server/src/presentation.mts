import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import * as z from "zod/v4";

import type { NFLMetaApiResult } from "./api-client.mjs";

export type OutputFormat = "summary" | "full";

export interface PresentationOptions {
  fields?: string[];
  format?: OutputFormat;
  maxSummaryChars?: number;
  maxSummaryItems?: number;
  summaryData?: unknown;
  summaryTransform?: (data: unknown) => unknown;
}

export const fieldsSchema = z.array(
  z.string().trim().min(1).max(120).regex(/^[A-Za-z0-9_.-]+$/, "Use field names or dotted paths"),
).max(50).optional().describe("Optional fields or dotted paths to return, for example ['display_name', 'record.wins']");

export const formatSchema = z.enum(["summary", "full"]).default("summary")
  .describe("summary returns compact Markdown and bounded structured data; full returns complete JSON");

export const presentationShape = {
  fields: fieldsSchema,
  format: formatSchema,
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getPath(source: unknown, parts: string[]): { found: boolean; value?: unknown } {
  let current = source;
  for (const part of parts) {
    if (!isRecord(current) || !(part in current)) return { found: false };
    current = current[part];
  }
  return { found: true, value: current };
}

function setPath(target: Record<string, unknown>, parts: string[], value: unknown): void {
  let current = target;
  for (const part of parts.slice(0, -1)) {
    if (!isRecord(current[part])) current[part] = {};
    current = current[part] as Record<string, unknown>;
  }
  current[parts.at(-1)!] = value;
}

function projectRecord(source: Record<string, unknown>, fields: string[]): Record<string, unknown> {
  const projected: Record<string, unknown> = {};
  for (const field of fields) {
    const parts = field.split(".");
    const match = getPath(source, parts);
    if (match.found) setPath(projected, parts, match.value);
  }
  return projected;
}

export function projectFields(data: unknown, fields: string[] | undefined): unknown {
  if (!fields?.length) return data;
  if (Array.isArray(data)) {
    return data.map((row) => isRecord(row) ? projectRecord(row, fields) : row);
  }
  if (isRecord(data)) return projectRecord(data, fields);
  return data;
}

/**
 * Keys that say *which* record a row is, in the order a reader wants them.
 *
 * Both compaction and table rendering used to keep whichever keys came first
 * in the object. A player game-stat row carries 35 stat columns before
 * player_key, display_name, week and opponent_abbr, so a game log came back as
 * five anonymous stat lines -- correct numbers, no way to tell whose or from
 * when. Identity is pulled to the front instead of trusting column order.
 */
const IDENTITY_KEYS = [
  "rank", "player_key", "display_name", "team_abbr", "opponent_abbr",
  "season_year", "season_type", "week", "round", "game_date", "home_away",
  "result", "position", "stat_value",
  "coach_key", "contributor_key", "executive_key", "staff_key", "venue_key",
  "official_key", "game_id", "title", "name", "abbr", "key",
];

/** Identity keys first, in IDENTITY_KEYS order, then everything else as-is. */
function orderByIdentity(keys: string[]): string[] {
  const present = new Set(keys);
  const lead = IDENTITY_KEYS.filter((key) => present.has(key));
  const leadSet = new Set(lead);
  return [...lead, ...keys.filter((key) => !leadSet.has(key))];
}

function compactValue(value: unknown, maxItems: number, depth = 0): unknown {
  // A boxscore is {teamStats: {away: {stats: [...]}}}, which reaches this limit
  // before the numbers do -- the stat rows came back as "[nested object]" in
  // structuredContent as well as in the text. Breadth is already capped by
  // maxItems and by the 30-key slice below, so depth can afford to go further.
  if (depth >= 8) {
    if (Array.isArray(value)) return `[${value.length} items]`;
    if (isRecord(value)) return "[nested object]";
    return value;
  }
  if (Array.isArray(value)) return value.slice(0, maxItems).map((item) => compactValue(item, maxItems, depth + 1));
  if (isRecord(value)) {
    const keys = orderByIdentity(Object.keys(value)).slice(0, 30);
    return Object.fromEntries(
      keys.map((key) => [key, compactValue(value[key], maxItems, depth + 1)]),
    );
  }
  if (typeof value === "string" && value.length > 240) return `${value.slice(0, 237)}...`;
  return value;
}

function cell(value: unknown): string {
  if (value == null) return "—";
  const raw = typeof value === "object" ? JSON.stringify(value) : String(value);
  const compact = raw.replace(/\s+/g, " ").replaceAll("|", "\\|");
  return compact.length > 100 ? `${compact.slice(0, 97)}...` : compact;
}

function scalarEntries(value: Record<string, unknown>): [string, unknown][] {
  return Object.entries(value).filter(([, item]) => item == null || typeof item !== "object");
}

const LABEL_KEYS = ["display_name", "name", "title", "player_key", "team_abbr", "key"];

/** Pull a human label out of a row's nested objects when the row itself has none. */
function nestedLabel(row: Record<string, unknown>): string | null {
  for (const value of Object.values(row)) {
    const candidate = Array.isArray(value) ? value[0] : value;
    if (!isRecord(candidate)) continue;
    for (const key of LABEL_KEYS) {
      const label = candidate[key];
      if (typeof label === "string" && label.trim()) return label;
    }
  }
  return null;
}

function renderArray(rows: unknown[], maxItems: number, depth = 0): string {
  if (!rows.length) return "_No results._";
  const shown = rows.slice(0, maxItems);
  if (!shown.every(isRecord)) {
    const lines = shown.map((item) => `- ${cell(item)}`);
    if (rows.length > shown.length) lines.push(`- _${rows.length - shown.length} more rows omitted_`);
    return lines.join("\n");
  }

  // A table can only carry scalar columns, so a nested array of records is
  // dropped from it without trace. For grouped shapes that array is the answer:
  // weekly leaders come back as one row per week with the players nested under
  // it, and the table rendered a tidy list of week numbers with every leader
  // missing. Render those group-wise instead, so the payload survives.
  const groupKeys: string[] = [];
  if (depth < 2) {
    for (const row of shown) {
      for (const [key, value] of Object.entries(row)) {
        if (groupKeys.includes(key)) continue;
        const isRecordArray = Array.isArray(value) && value.length > 0 && value.every(isRecord);
        const isNestedObject = isRecord(value) && Object.keys(value).length > 0;
        if (isRecordArray || isNestedObject) groupKeys.push(key);
      }
    }
  }
  if (groupKeys.length) {
    const blocks = shown.map((row, index) => {
      const scalars = scalarEntries(row);
      const labelEntry = scalars.find(([, value]) => value != null);
      // A grouped row often carries no scalar of its own -- a comparison entry
      // is nothing but { profile, career, seasons } -- and heading those "Item
      // 1" and "Item 2" told the reader nothing about which player they were
      // looking at. Fall back to a name from inside the row.
      const heading = labelEntry ? cell(labelEntry[1]) : nestedLabel(row) ?? `Item ${index + 1}`;
      const meta = scalars
        .filter(([key, value]) => value != null && (!labelEntry || key !== labelEntry[0]))
        .map(([key, value]) => `${key}: ${cell(value)}`)
        .join(" · ");
      const parts = [meta ? `**${heading}** — ${meta}` : `**${heading}**`];
      for (const key of groupKeys) {
        const value = row[key];
        if (Array.isArray(value)) {
          if (!value.length) continue;
          parts.push(`${title(key)}:\n\n${renderArray(value, Math.min(maxItems, 5), depth + 1)}`);
        } else if (isRecord(value) && Object.keys(value).length) {
          parts.push(`${title(key)}:\n\n${renderObject(value, Math.min(maxItems, 5), depth + 1)}`);
        }
      }
      return parts.join("\n\n");
    });
    if (rows.length > shown.length) {
      blocks.push(`_${rows.length - shown.length} more rows omitted; use format='full' or pagination to retrieve them._`);
    }
    return blocks.join("\n\n");
  }

  const columns: string[] = [];
  for (const row of shown) {
    for (const key of orderByIdentity(Object.keys(row))) {
      const value = row[key];
      if ((value == null || typeof value !== "object") && !columns.includes(key)) columns.push(key);
      if (columns.length >= 10) break;
    }
    if (columns.length >= 10) break;
  }
  // A table needs at least one column that actually carries a value. Rows made
  // entirely of nested objects yield only null-valued scalar keys, which
  // rendered as a header over a column of em-dashes -- the comparison tools
  // produced exactly that. Fall back to showing the structure instead.
  const columnsCarryData = columns.some((key) => shown.some((row) => row[key] != null));
  if (!columns.length || !columnsCarryData) {
    return shown.map((row, index) => {
      const label = orderByIdentity(Object.keys(row)).find((key) => row[key] != null && typeof row[key] !== "object");
      const heading = label ? `${cell(row[label])}` : `Item ${index + 1}`;
      const inner = Object.entries(row)
        .map(([key, value]) => `  - ${key}: ${cell(value)}`)
        .join("\n");
      return `- **${heading}**\n${inner}`;
    }).join("\n");
  }
  const header = `| ${columns.join(" | ")} |`;
  const divider = `| ${columns.map(() => "---").join(" | ")} |`;
  const body = shown.map((row) => `| ${columns.map((key) => cell(row[key])).join(" | ")} |`);
  if (rows.length > shown.length) body.push(`\n_${rows.length - shown.length} more rows omitted; use format='full' or pagination to retrieve them._`);
  return [header, divider, ...body].join("\n");
}

function title(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function renderObject(value: Record<string, unknown>, maxItems: number, depth = 0): string {
  const sections: string[] = [];
  const scalars = scalarEntries(value);
  if (scalars.length) {
    sections.push(["| field | value |", "| --- | --- |", ...scalars.map(([key, item]) => `| ${key} | ${cell(item)} |`)].join("\n"));
  }
  for (const [key, item] of Object.entries(value)) {
    if (item == null || typeof item !== "object") continue;
    if (Array.isArray(item)) {
      // Always render a list, however deep it sits. Standings nest three levels
      // -- grouped, then conference, then division -- so a depth cut-off of two
      // turned every division into a clipped JSON blob and the tool returned
      // not one team's record. renderArray bounds itself by maxItems, so depth
      // is not what keeps this output small.
      sections.push(`### ${title(key)}\n\n${renderArray(item, maxItems, depth)}`);
    } else if (depth >= 3) {
      sections.push(`**${title(key)}:** ${cell(item)}`);
    } else {
      sections.push(`### ${title(key)}\n\n${renderObject(item as Record<string, unknown>, maxItems, depth + 1)}`);
    }
  }
  return sections.join("\n\n") || "_No data._";
}

export function renderMarkdown(data: unknown, maxItems = 12): string {
  if (Array.isArray(data)) return renderArray(data, maxItems);
  if (isRecord(data)) return renderObject(data, maxItems);
  return cell(data);
}

function truncateMarkdown(markdown: string, maxBytes: number): string {
  if (Buffer.byteLength(markdown, "utf8") <= maxBytes) return markdown;
  const suffix = "\n\n_Summary truncated; use fields or format='full' for more._";
  let prefix = markdown.slice(0, Math.max(0, maxBytes - Buffer.byteLength(suffix, "utf8")));
  while (prefix && Buffer.byteLength(`${prefix.trimEnd()}${suffix}`, "utf8") > maxBytes) prefix = prefix.slice(0, -1);
  return `${prefix.trimEnd()}${suffix}`;
}

function jsonCompatible(value: unknown): unknown {
  const encoded = JSON.stringify(value);
  return encoded === undefined ? null : JSON.parse(encoded);
}

export function presentResult(result: NFLMetaApiResult, options: PresentationOptions = {}): CallToolResult {
  const format = options.format ?? "summary";
  const maxItems = options.maxSummaryItems ?? 12;
  const source = format === "summary" && !options.fields?.length
    ? options.summaryData !== undefined
      ? options.summaryData
      : options.summaryTransform
        ? options.summaryTransform(result.data)
        : result.data
    : result.data;
  const projected = projectFields(source, options.fields);
  const data = jsonCompatible(format === "summary" ? compactValue(projected, maxItems) : projected);
  const structuredContent: Record<string, unknown> = {
    data,
    meta: jsonCompatible(result.meta ?? null),
    rateLimit: jsonCompatible(result.rateLimit),
  };
  const text = format === "full"
    ? JSON.stringify(structuredContent, null, 2)
    : truncateMarkdown(renderMarkdown(data, maxItems), options.maxSummaryChars ?? 6_000);
  return { content: [{ type: "text", text }], structuredContent };
}
