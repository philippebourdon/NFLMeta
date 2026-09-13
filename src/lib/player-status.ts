type StatusCode =
  | "ACT"
  | "IR"
  | "PUP"
  | "PS"
  | "FUT"
  | "NFI"
  | "SUS"
  | "EXE"
  | "RET"
  | "CUT"
  | "TRD"
  | "FA"
  | "RES";

const DIRECT_STATUS_MAP: Record<string, StatusCode> = {
  ACT: "ACT",
  PUP: "PUP",
  SUS: "SUS",
  EXE: "EXE",
  RET: "RET",
  CUT: "CUT",
  TRD: "TRD",
  UFA: "FA",
  RFA: "FA",
  DEV: "PS",
  RSR: "FUT",
  NWT: "FA",
};

// These come from the mirrored roster status dictionary plus the newer
// subcodes present in our imported roster history.
const STATUS_DESCRIPTION_MAP: Record<string, StatusCode> = {
  A01: "ACT",
  E01: "EXE",
  E02: "EXE",
  F12: "FUT",
  I01: "ACT",
  I02: "ACT",
  I05: "ACT",
  P01: "PS",
  P02: "PS",
  P03: "PS",
  P04: "PS",
  P06: "PS",
  P07: "PS",
  P09: "PS",
  P10: "PS",
  P11: "PS",
  P12: "PS",
  P13: "PS",
  P14: "PS",
  R01: "IR",
  R02: "IR",
  R03: "IR",
  R04: "IR",
  R05: "NFI",
  R06: "PUP",
  R23: "FUT",
  R27: "NFI",
  R30: "SUS",
  R33: "SUS",
  R34: "EXE",
  R36: "NFI",
  R40: "SUS",
  R42: "IR",
  R47: "NFI",
  R48: "IR",
  R49: "IR",
  R59: "IR",
  R62: "FUT",
  W03: "CUT",
  W04: "CUT",
};

function normalizeValue(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.toUpperCase() : null;
}

function fromTrackingLabel(value: string | null | undefined): StatusCode | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.includes("practice squad")) return "PS";
  if (normalized.includes("future")) return "FUT";
  if (normalized.includes("physically unable to perform")) return "PUP";
  if (normalized.includes("non-football")) return "NFI";
  if (normalized.includes("commissioner exempt") || normalized.includes("exempt")) return "EXE";
  if (normalized.includes("suspended")) return "SUS";
  if (normalized.includes("retired")) return "RET";
  if (normalized.includes("injured reserve")) return "IR";
  if (normalized.includes("covid")) return "IR";
  if (normalized.includes("waived") || normalized.includes("released")) return "CUT";
  if (normalized.includes("free agent")) return "FA";
  if (normalized.includes("inactive")) return "ACT";
  if (normalized.includes("active")) return "ACT";
  return null;
}

export function resolveRosterStatusCode(
  status: string | null | undefined,
  statusDescriptionAbbr?: string | null,
): StatusCode | string {
  const normalizedStatus = normalizeValue(status);
  const normalizedDescription = normalizeValue(statusDescriptionAbbr);

  if (normalizedStatus === "RET") return "RET";
  if (normalizedStatus === "TRD") return "TRD";
  if (normalizedStatus === "CUT") return "CUT";
  if (normalizedStatus === "UFA" || normalizedStatus === "RFA") return "FA";
  if (normalizedStatus === "DEV") return "PS";
  if (normalizedStatus === "RSR") return "FUT";
  if (normalizedStatus === "NWT") return "FA";

  if (normalizedDescription && STATUS_DESCRIPTION_MAP[normalizedDescription]) {
    return STATUS_DESCRIPTION_MAP[normalizedDescription];
  }

  if (normalizedStatus && DIRECT_STATUS_MAP[normalizedStatus]) {
    return DIRECT_STATUS_MAP[normalizedStatus];
  }

  if (normalizedStatus === "RES" || normalizedStatus === "RSN") {
    return "IR";
  }

  return normalizedStatus || "-";
}

export function describeStatusCode(value: string | null | undefined): string {
  switch (value) {
    case "ACT":
      return "Active roster";
    case "IR":
      return "Injured Reserve";
    case "PUP":
      return "Physically Unable to Perform";
    case "PS":
      return "Practice Squad";
    case "FUT":
      return "Reserve/Future contract";
    case "NFI":
      return "Non-Football Injury";
    case "SUS":
      return "Suspended";
    case "EXE":
      return "Exempt list";
    case "RET":
      return "Retired";
    case "CUT":
      return "Released or waived";
    case "TRD":
      return "Traded";
    case "FA":
      return "Free Agent";
    case "RES":
      return "Reserve";
    default:
      return value || "-";
  }
}

export function resolvePlayerStatusCode(input: {
  status: string | null;
  trackingStatusLabel?: string | null;
  lastSeason?: number | null;
  rosterStatus?: string | null;
  rosterStatusDescriptionAbbr?: string | null;
}): StatusCode | string {
  const currentYear = new Date().getUTCFullYear();

  if (input.lastSeason != null && input.lastSeason < currentYear - 1) {
    return "RET";
  }

  const rosterStatus = resolveRosterStatusCode(input.rosterStatus, input.rosterStatusDescriptionAbbr);
  if (rosterStatus !== "-") {
    return rosterStatus;
  }

  const trackingStatus = fromTrackingLabel(input.trackingStatusLabel);
  if (trackingStatus) return trackingStatus;

  return resolveRosterStatusCode(input.status);
}
