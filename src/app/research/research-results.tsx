"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import type { PlayLeaderRow, PlaySummaryRow } from "@/lib/plays-data";

type Props = { rows: PlayLeaderRow[]; summaries?: never } | { summaries: PlaySummaryRow[]; rows?: never };
function number(value: number | null, digits = 3) {
  return value == null ? "Not available" : value.toLocaleString("en-US", { maximumFractionDigits: digits });
}
function percent(value: number | null) { return value == null ? "Not available" : `${number(value * 100, 2)}%`; }
const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;
export default function ResearchResults(props: Props) {
  // Do not accept native checkbox changes before React owns the controls:
  // otherwise a fast click can look selected without updating comparison state.
  const ready = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  const [selected, setSelected] = useState<string[]>([]);
  const [comparison, setComparison] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const leaders = props.rows?.filter((row) => !comparison || selected.includes(row.player_key));
  const headings = props.rows
    ? ["Player", "Teams", "Plays", "EPA/play", "EPA total", "Success", "Yards/play", "CPOE (pp)"]
    : ["Group", "All plays", "Scrimmage plays", "EPA/play", "EPA total", "Success", "Yards/play", "Pass rate", "CPOE (pp)"];
  const values = leaders
    ? leaders.map((r) => [r.player_name || r.player_key, r.teams, r.plays, r.epa_per_play, r.epa_total, r.success_rate, r.yards_gained_per_play, r.cpoe])
    : props.summaries!.map((r) => [r.group_key, r.plays, r.scrimmage_plays, r.epa_per_play, r.epa_total, r.success_rate, r.yards_per_play, r.pass_rate, r.cpoe]);
  function download() {
    const escape = (value: unknown) => {
      const text = value == null ? "" : String(value);
      // Prevent spreadsheet formulas in text labels; numeric negatives stay numeric.
      const safe = typeof value === "string" && /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
      return `"${safe.replaceAll('"', '""')}"`;
    };
    const blob = new Blob([[headings, ...values].map((row) => row.map(escape).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "nflmeta-research.csv"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <>
    <div className="research-actions">
      <button type="button" disabled={!ready} onClick={async () => { try { await navigator.clipboard.writeText(window.location.href); setCopied(true); setCopyError(false); } catch { setCopyError(true); } }}>{copied ? "Link copied" : "Copy research link"}</button>
      <button type="button" disabled={!ready} onClick={download}>Download displayed results (CSV)</button>
      {props.rows && <button type="button" disabled={!ready || (!comparison && selected.length < 2)} onClick={() => setComparison(!comparison)}>{comparison ? "Show leaderboard" : `Compare selected (${selected.length}/4)`}</button>}
    </div>
    {copyError && <p role="status">Copy the address from your browser to share these filters.</p>}
    {props.rows && <p>Select two to four players to compare their figures. The share link preserves filters, not player selections. Showing at most 100 qualifying players.</p>}
    <div className="research-table-scroll"><table>
      <caption>{props.rows ? "Player efficiency, calculated from play-by-play" : "Play efficiency over the selected historical slice"}</caption>
      <thead><tr>{props.rows && <th scope="col">Compare</th>}{headings.map((h) => <th scope="col" key={h}>{h}</th>)}</tr></thead>
      <tbody>{leaders ? leaders.map((r) => <tr key={r.player_key}>
        <td><input aria-label={`Compare ${r.player_name || r.player_key}`} type="checkbox" checked={selected.includes(r.player_key)} disabled={!ready || (!selected.includes(r.player_key) && selected.length >= 4)} onChange={(e) => setSelected(e.target.checked ? [...selected, r.player_key] : selected.filter((key) => key !== r.player_key))} /></td>
        <th scope="row"><Link href={`/players/${encodeURIComponent(r.player_key)}`}>{r.player_name || r.player_key}</Link></th><td>{r.teams}</td><td>{number(r.plays, 0)}</td><td>{number(r.epa_per_play, 4)}</td><td>{number(r.epa_total)}</td><td>{percent(r.success_rate)}</td><td>{number(r.yards_gained_per_play)}</td><td>{number(r.cpoe)}</td>
      </tr>) : props.summaries!.map((r) => <tr key={r.group_key}>
        <th scope="row">{r.group_key}</th><td>{number(r.plays, 0)}</td><td>{number(r.scrimmage_plays, 0)}</td><td>{number(r.epa_per_play, 4)}</td><td>{number(r.epa_total)}</td><td>{percent(r.success_rate)}</td><td>{number(r.yards_per_play)}</td><td>{percent(r.pass_rate)}</td><td>{number(r.cpoe)}</td>
      </tr>)}</tbody>
    </table></div>
    {!values.length && <p role="status">No qualifying results. Try a lower minimum, a different season, or fewer filters. Missing data is not a zero.</p>}
    <p>CSV contains the displayed rows; rate columns use fractions (0.50 = 50%). CPOE uses percentage points. Your plan’s commercial-use terms still apply.</p>
  </>;
}
