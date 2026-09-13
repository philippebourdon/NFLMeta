import styles from "./player-season-stats.module.css";
import { seasonStatValue } from "@/lib/season-stat-availability";

type SeasonRow = Record<string, unknown>;

type Column = {
  key: string;
  label: string;
  format?: "decimal" | "percent";
};

type StatFamily = {
  title: string;
  description: string;
  activity: string[];
  columns: Column[];
};

const FAMILIES: StatFamily[] = [
  {
    title: "Passing",
    description: "Completions, volume, scoring, interceptions, and passer rating",
    activity: ["pass_att", "pass_cmp", "pass_yds", "pass_td", "pass_int"],
    columns: [
      { key: "pass_cmp", label: "CMP" }, { key: "pass_att", label: "ATT" },
      { key: "pass_cmp_pct", label: "CMP%", format: "percent" }, { key: "pass_yds", label: "YDS" },
      { key: "pass_td", label: "TD" }, { key: "pass_int", label: "INT" },
      { key: "pass_passer_rating", label: "RATE", format: "decimal" },
    ],
  },
  {
    title: "Rushing",
    description: "Carries, yards, efficiency, touchdowns, and fumbles",
    activity: ["rush_att", "rush_yds", "rush_td"],
    columns: [
      { key: "rush_att", label: "ATT" }, { key: "rush_yds", label: "YDS" },
      { key: "rush_yds_per_att", label: "AVG", format: "decimal" }, { key: "rush_td", label: "TD" },
      { key: "rush_long", label: "LONG" }, { key: "fumbles", label: "FUM" },
      { key: "fumbles_lost", label: "LOST" },
    ],
  },
  {
    title: "Receiving",
    description: "Targets, catches, yards, efficiency, and touchdowns",
    activity: ["targets", "rec", "rec_yds", "rec_td"],
    columns: [
      { key: "targets", label: "TGT" }, { key: "rec", label: "REC" },
      { key: "rec_catch_pct", label: "CATCH%", format: "percent" }, { key: "rec_yds", label: "YDS" },
      { key: "rec_yds_per_rec", label: "AVG", format: "decimal" }, { key: "rec_td", label: "TD" },
      { key: "rec_long", label: "LONG" },
    ],
  },
  {
    title: "Defense",
    description: "Tackles, sacks, takeaways, and passes defended",
    activity: ["def_tkl_combined", "def_tkl_solo", "def_sacks", "def_int", "def_pd", "def_ff", "def_fr", "def_td"],
    columns: [
      { key: "def_tkl_combined", label: "TKL", format: "decimal" },
      { key: "def_tkl_solo", label: "SOLO", format: "decimal" },
      { key: "def_sacks", label: "SACK", format: "decimal" }, { key: "def_int", label: "INT" },
      { key: "def_int_yds", label: "INT YDS" }, { key: "def_pd", label: "PD" },
      { key: "def_ff", label: "FF" }, { key: "def_fr", label: "FR" }, { key: "def_td", label: "TD" },
    ],
  },
  {
    title: "Returns",
    description: "Kick and punt return opportunities, yards, and touchdowns",
    activity: ["kick_returns", "kick_return_yds", "punt_returns", "punt_return_yds"],
    columns: [
      { key: "kick_returns", label: "KR" }, { key: "kick_return_yds", label: "KR YDS" },
      { key: "kick_return_td", label: "KR TD" }, { key: "punt_returns", label: "PR" },
      { key: "punt_return_yds", label: "PR YDS" }, { key: "punt_return_td", label: "PR TD" },
    ],
  },
  {
    title: "Kicking",
    description: "Field goals, extra points, scoring, and long field goals",
    activity: ["fga", "fgm", "xpa", "xpm", "kick_points"],
    columns: [
      { key: "fgm", label: "FGM" }, { key: "fga", label: "FGA" },
      { key: "fg_pct", label: "FG%", format: "percent" }, { key: "fg_long", label: "LONG" },
      { key: "xpm", label: "XPM" }, { key: "xpa", label: "XPA" }, { key: "kick_points", label: "PTS" },
    ],
  },
  {
    title: "Punting",
    description: "Punts, total yards, average, and longest punt",
    activity: ["punts", "punt_yds"],
    columns: [
      { key: "punts", label: "PUNTS" }, { key: "punt_yds", label: "YDS" },
      { key: "punt_avg", label: "AVG", format: "decimal" }, { key: "punt_long", label: "LONG" },
    ],
  },
];

function numeric(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function active(row: SeasonRow, keys: string[]): boolean {
  return keys.some((key) => (numeric(row[key]) ?? 0) !== 0);
}

function displayStat(value: unknown, format?: Column["format"]): string {
  const parsed = numeric(value);
  if (parsed == null) return "-";
  if (format === "percent") return `${parsed.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
  if (format === "decimal") return parsed.toLocaleString("en-US", { minimumFractionDigits: parsed % 1 ? 1 : 0, maximumFractionDigits: 1 });
  return parsed.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

function team(row: SeasonRow): string {
  return String(row.season_team_abbr || row.latest_team_abbr || "-");
}

export function PlayerSeasonStats({ rows }: { rows: SeasonRow[] }) {
  const families = FAMILIES.map((family) => ({
    ...family,
    rows: rows.filter((row) => active(row, family.activity)),
  })).filter((family) => family.rows.length > 0);

  if (!families.length) return null;

  return (
    <div className={styles.wrapper}>
      <div className={styles.intro}>
        <div>
          <span className={styles.kicker}>Season by Season</span>
          <h2>Every tracked year, broken down</h2>
          <p>Regular-season and postseason production are separated so each number keeps its proper context.</p>
          <p>Current-season totals update automatically after final game box scores are published, including later corrections. Unavailable statistics are shown as a dash.</p>
        </div>
        <span className={styles.access}>GUI · API · MCP</span>
      </div>
      <div className={styles.families}>
        {families.map((family, index) => (
          <details className={styles.family} key={family.title} open={index === 0}>
            <summary>
              <span><strong>{family.title}</strong><small>{family.description}</small></span>
              <span className={styles.rowCount}>{family.rows.length} split{family.rows.length === 1 ? "" : "s"}</span>
            </summary>
            <div className={styles.tableWrap}>
              <table>
                <thead><tr><th>Season</th><th>Split</th><th>Team</th><th>G</th>{family.columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead>
                <tbody>
                  {family.rows.map((row, rowIndex) => (
                    <tr key={`${row.season_year}-${row.season_type}-${team(row)}-${rowIndex}`}>
                      <td><strong>{String(row.season_year || "-")}</strong></td>
                      <td><span className={row.season_type === "POST" ? styles.postseason : styles.regular}>{row.season_type === "POST" ? "Post" : "Reg"}</span></td>
                      <td>{team(row)}</td>
                      <td>{displayStat(row.games_with_stats)}</td>
                      {family.columns.map((column) => <td key={column.key}>{displayStat(seasonStatValue(row, column.key), column.format)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
