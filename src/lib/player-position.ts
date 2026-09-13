const POSITION_ALIASES: Record<string, string> = {
  QB: "QB",

  RB: "RB",
  HB: "RB",
  TB: "RB",
  BB: "RB",
  WB: "RB",
  "WB-FB-HB": "RB",
  "TB-DB": "RB",
  "BB-DB": "RB",

  FB: "FB",
  "FB/HB": "FB",
  "FB-DB": "FB",

  WR: "WR",
  FL: "WR",

  TE: "TE",
  E: "TE",

  OL: "OL",
  "G-T": "OL",

  OT: "OT",
  T: "OT",
  LT: "OT",
  RT: "OT",

  G: "G",
  LG: "G",
  RG: "G",

  C: "C",

  DL: "DL",
  "DT-DE": "DL",
  "E-T": "DL",

  DE: "DE",
  LDE: "DE",
  RDE: "DE",
  LE: "DE",
  RE: "DE",

  DT: "DT",
  LDT: "DT",
  RDT: "DT",
  "LDT/RDT": "DT",

  NT: "NT",

  LB: "LB",
  OLB: "LB",
  ILB: "LB",
  MLB: "LB",
  LLB: "LB",
  RLB: "LB",
  "G-LB": "LB",
  "C-LB": "LB",

  DB: "DB",
  CB: "CB",
  LCB: "CB",
  RCB: "CB",
  S: "S",
  SAF: "S",
  FS: "S",
  SS: "S",
  "BB-QB-DB": "QB",

  K: "K",
  P: "P",
  LS: "LS",
  SPEC: "SPEC",
  KR: "SPEC",
  PR: "SPEC",
};

const POSITION_GROUP_BY_POSITION: Record<string, string> = {
  QB: "QB",
  RB: "RB",
  FB: "RB",
  WR: "WR",
  TE: "TE",
  OL: "OL",
  OT: "OL",
  G: "OL",
  C: "OL",
  DL: "DL",
  DE: "DL",
  DT: "DL",
  NT: "DL",
  LB: "LB",
  DB: "DB",
  CB: "DB",
  S: "DB",
  K: "SPEC",
  P: "SPEC",
  LS: "SPEC",
  SPEC: "SPEC",
};

export const CANONICAL_PLAYER_POSITIONS = [
  "QB",
  "RB",
  "FB",
  "WR",
  "TE",
  "OL",
  "OT",
  "G",
  "C",
  "DL",
  "DE",
  "DT",
  "NT",
  "LB",
  "DB",
  "CB",
  "S",
  "K",
  "P",
  "LS",
  "SPEC",
] as const;

function cleanPositionValue(value: string | null | undefined) {
  return String(value || "").trim().toUpperCase();
}

export function normalizePlayerPosition(value: string | null | undefined): string | null {
  const cleaned = cleanPositionValue(value);
  if (!cleaned) return null;
  return POSITION_ALIASES[cleaned] || cleaned;
}

export function normalizePlayerPositionGroup(
  positionGroup: string | null | undefined,
  position: string | null | undefined,
): string | null {
  const cleanedGroup = cleanPositionValue(positionGroup);
  if (cleanedGroup && cleanedGroup !== "OFF" && cleanedGroup !== "ST") {
    return cleanedGroup;
  }
  if (cleanedGroup === "OFF") return "OL";
  if (cleanedGroup === "ST") return "SPEC";

  const canonicalPosition = normalizePlayerPosition(position);
  if (!canonicalPosition) return null;
  return POSITION_GROUP_BY_POSITION[canonicalPosition] || null;
}

function sqlLiteral(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

export function normalizedPlayerPositionSql(expr: string) {
  const entries = Object.entries(POSITION_ALIASES);
  const whenClauses = entries.map(([raw, canonical]) => `WHEN upper(coalesce(${expr}, '')) = ${sqlLiteral(raw)} THEN ${sqlLiteral(canonical)}`);
  return `(CASE ${whenClauses.join(" ")} ELSE upper(nullif(btrim(coalesce(${expr}, '')), '')) END)`;
}
