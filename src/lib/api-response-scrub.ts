/**
 * Strips upstream provenance from public API payloads.
 *
 * Several tables keep the raw imported record and the address it came from,
 * which is worth having internally -- it is how an import is debugged and a
 * value traced. Those columns were being selected straight into public
 * responses, so a single Pro Bowl request returned 118 external reference URLs.
 *
 * Scrubbing here rather than in each query is deliberate. The leak came from
 * `SELECT *` and spread operators picking up columns nobody meant to publish,
 * and that will keep happening; a central filter cannot be forgotten by a new
 * endpoint or reintroduced by a careless `...row`.
 *
 * Only keys that carry origin identity are removed; the exceptions are listed
 * with PROVENANCE_EXCEPTIONS below.
 */
const PROVENANCE_KEYS = new Set([
  "raw_data",
  "raw_row",
  "source_url",
  "source_file",
  "source_dataset",
  "source_dataset_tag",
  "source_site",
  "source_path",
  "headshot_source_url",
  "prospect_profile_url",
  "profile_source_data",
  "player_url",
  // Audit trails. Each records where a value was obtained or which record it
  // was reconciled against, and each was reachable through some endpoint.
  "alias_source_url",
  "alias_source_dataset_tag",
  "evidence_url",
  "evidence_kind",
  "source_summary",
  // Now unambiguous: the person-name columns that used to share this name were
  // renamed to listed_name, so anything still called source_name really is one.
  "source_name",
  "source_page_title",
  "source_record_key",
  "source_bucket",
  "source_kind",
  "retirement_source",
  "roster_status_source",
  "page_url",
  "page_html",
  "local_url",
  // A staff record keeps the club page it was read from. Neither
  // prospect_profile_url nor player_url covers the bare name.
  "profile_url",
  "index_url",
  // Release-catalogue columns. Named generically, but they hold the address
  // an asset was downloaded from.
  "download_url",
  "browser_download_url",
  "html_url",
  "repo",
  // The previous public key, kept so an old value can still be traced
  // internally. It is the namespaced form, so serving it would undo the
  // rename entirely.
  "legacy_player_key",
  // Cross-reference identifiers. Renaming the columns stopped the schema
  // naming their issuers, but the values are themselves recognisable -- an
  // archive id like "MahoPa00" identifies its issuer on sight -- and the
  // player endpoint was returning all of them on every request. They are
  // retained for a future cross-reference tier; until there is one, nothing
  // serves them.
  "ext_roster_id",
  "ext_uuid",
  "ext_site_id",
  "ext_grading_id",
  "ext_grading_position",
  "ext_grading_status",
  "ext_contract_id",
  "ext_fantasy_id",
  "ext_news_id",
  "ext_platform_id",
  "ext_feed_id",
  "ext_portal_id",
  "external_id",
  "canonical_player_id",
]);

/**
 * Kept even though they look like provenance.
 *
 *   source_team_abbr  a club code carried alongside a record, not a marker of
 *                     where the record came from
 *   source            power-ranking attribution, which is editorial credit for
 *                     someone else's published opinion and has to stay
 *   headshot_url      the served media URL, which is an opaque /media/a/<key>
 *                     and is the whole point of the response
 *   quota_source      whether a key's quota comes from its plan or an override.
 *                     It describes billing configuration, not where any datum
 *                     came from, and the _source$ pattern was silently deleting
 *                     it from the usage endpoint's own response
 */
const PROVENANCE_EXCEPTIONS = new Set([
  "source_team_abbr",
  "source",
  "headshot_url",
  // The power-ranking attribution link. It is the only camelCase sourceUrl in
  // the payloads, and it belongs with `source` above: a ranking without a link
  // to whose ranking it is is not attribution at all.
  "sourceUrl",
  "quota_source",
]);

/**
 * The explicit list above is the floor, not the ceiling. Columns get added,
 * and a new one called source_something would otherwise ship until somebody
 * noticed. Anything shaped like provenance is dropped unless it is named as an
 * exception, so the default for a new column is closed rather than open.
 */
const PROVENANCE_PATTERNS = [
  // camelCase equivalents. Payloads built by hand use camelCase, and a
  // snake_case-only rule would miss sourceUrl on one of them.
  /^source[A-Z]/,
  /SourceUrl$/,
  /^raw[A-Z]/,
  // Every cross-reference identifier, including any added later.
  /^ext_/,
  /^source_/,
  /_source$/,
  /_source_url$/,
  /_source_data$/,
  /_source_tag$/,
  /^raw_/,
];

function isProvenance(key: string): boolean {
  if (PROVENANCE_EXCEPTIONS.has(key)) return false;
  if (PROVENANCE_KEYS.has(key)) return true;
  return PROVENANCE_PATTERNS.some((pattern) => pattern.test(key));
}

/** JSON.stringify replacer: dropping a key returns undefined for it. */
function scrubReplacer(key: string, value: unknown): unknown {
  return isProvenance(key) ? undefined : value;
}

/**
 * Serializes a payload with provenance keys removed.
 *
 * Uses a stringify replacer so this is a single pass over data that was about
 * to be serialized anyway, rather than a deep clone.
 */
export function serializeWithoutProvenance(body: unknown): string {
  return JSON.stringify(body, scrubReplacer);
}

export function isProvenanceKey(key: string): boolean {
  return isProvenance(key);
}
