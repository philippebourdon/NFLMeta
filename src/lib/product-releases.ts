export type ProductRelease = {
  version: string;
  date: string;
  title: string;
  previousVersions?: string[];
  developerNotes?: string;
  otherImprovements?: string[];
  changes: { type: 'feature' | 'improvement' | 'fix'; text: string; href?: string; label?: string }[];
};

// Newest first. Product release versions are independent of /api/v1 and SDK versions.
export const productReleases: ProductRelease[] = [
  {
    version: '2026.10.05.3', date: '2026-10-05', title: 'Player identity and SDK/MCP integration improvements',
    changes: [
      {type: 'fix', text: 'Depth charts return canonical player keys after merges and identify matched, merged and unmatched entries. Player lookup reports alias resolution; chart quality metadata exposes capture age without inventing vacant slots. Merged entries retain the previous NFLMeta key for reconciliation.', href: '/api-docs/core-endpoints', label: 'Integration guide'},
      {type: 'feature', text: 'SDK 0.2.0 adds defensive and special-teams game events, depth charts and league roster helpers. MCP adds filtered live scores, defensive and special-teams events, and practice-date filters.', href: '/api-docs/sdk', label: 'SDK guide'},
    ],
    developerNotes: 'Existing player keys remain accepted through retained aliases. Preserve internal Favorites IDs when mapping canonical keys. Unknown slot completeness and missing event facts remain explicit.',
  },
  {
    version: '2026.10.05.2', date: '2026-10-05', title: 'Historical daily practice participation',
    changes: [{ type: 'feature', text: 'Injury API responses include reviewed dated DNP, LP, and FP participation from 2018–2025. Practice-only records are explicitly labeled when no weekly designation is retained; unresolved source records remain excluded.', href: '/api-docs/core-endpoints', label: 'API documentation' }],
    developerNotes: 'Use season/week or date=YYYY-MM-DD on the existing league, team, and player injury routes. Historical practice reasons can be unknown; collection timestamps and retrospective dates do not certify pre-kickoff availability. Weekly designations remain separate.',
  },
  {
    version: '2026.10.05.1', date: '2026-10-05', title: 'Historical weekly rosters',
    changes: [{ type: 'feature', text: 'Roster API requests can select a historical season and week, including postseason rosters, with source provenance and explicit identity-quality information.', href: '/api-docs/core-endpoints', label: 'API documentation' }],
    developerNotes: 'Use season, week and optional season_type=REG|POST on league, team and player roster routes; MCP get_roster and get_player roster view accept weekly filters. Retrospective snapshots do not certify information available before kickoff.',
  },
  {
    version: '2026.10.04.7', date: '2026-10-04', title: 'Defensive and special-teams game events',
    changes: [{ type: 'feature', text: 'Retrieve a compact game feed of defensive and special-teams touchdowns, kicking attempts, turnovers, sacks, safeties, and blocked kicks or punts. Includes game-score context, final replay corrections, penalty safeties, and multiple turnovers within a play; uncertain team credits remain explicit.', href: '/api-docs', label: 'API documentation' }],
    developerNotes: 'GET /api/v1/games/{id}/defense-special-teams returns classified play rows. Live events are provisional; description-derived detections and unknown team credits are labeled. Coverage metadata distinguishes unavailable source data from no detected events and reports attribution gaps. This is an event feed, not a complete fantasy scoring total.',
  },
  {
    version: '2026.10.04.6', date: '2026-10-04', title: 'Pay only for the live scores you request',
    changes: [{ type: 'fix', text: 'Filter live scores to games in progress or selected game IDs. Only returned games count toward your row allowance; empty results cost no rows.', href: '/api-docs/core-endpoints', label: 'Live-score filters' }],
    developerNotes: 'GET /api/v1/live-scores supports phase=pre|in|post, game_id, or game_ids (up to 100 comma-separated IDs). Filters select the current live-score window. Poll selected IDs without phase=in to receive final scores. Existing unfiltered requests remain compatible; request limits still apply.',
  },
  {
    version: '2026.10.04.5', date: '2026-10-04', title: 'Clearer game injury outcomes',
    changes: [{ type: 'fix', text: 'Dated pregame availability rulings no longer replace an earlier game’s injury outcome. Practice history and injured-reserve updates remain separate.' }],
  },
  {
    version: '2026.10.04.4', date: '2026-10-04', title: 'More accurate MCP results and data status',
    changes: [
      { type: 'fix', text: 'MCP requests with repeated query values now keep their original order, preventing a cached response from being reused for a different request.' },
      { type: 'fix', text: 'Data freshness checks flag timestamps more than one minute in the future instead of treating them as fresh.', href: '/status', label: 'Data status' },
    ],
  },
  {
    version: '2026.10.04.3', date: '2026-10-04', title: 'Look up practice status by date',
    changes: [{ type: 'feature', text: 'Injury API requests can now select a practice date and return only that day’s participation entries for matching players.', href: '/api-docs', label: 'API documentation' }],
    developerNotes: 'Use date=YYYY-MM-DD with /api/v1/injuries, team injuries, or player injury history. Weekly game designations are not historical as-of values.',
  },
  {
    version: '2026.10.04.2', date: '2026-10-04', title: 'Daily practice history for 2026',
    changes: [{ type: 'feature', text: 'Weekly injury API responses now include dated practice participation from verified club reports, including non-injury reasons when listed. Retrospective rows show when NFLMeta collected the source.', href: '/api-docs', label: 'API documentation' }],
    developerNotes: 'The existing /api/v1/injuries, team injuries, and player injury history responses include practice_days for available 2026 reports.',
  },
  {
    version: '2026.10.04.1', date: '2026-10-04', title: 'More reliable completed-game player stats',
    changes: [{ type: 'fix', text: 'Verified completed-game player stats can continue refreshing after current roster changes. A game requiring further identity review no longer stops other games from being processed.' }],
  },
  {
    version: '2026.10.03.3', date: '2026-10-03', title: 'Clearer injury report follow-ups',
    changes: [{ type: 'fix', text: 'Injury updates distinguish concussion protocol clearance from recovery of a separate injury, and report removal replaces only a matching game designation while preserving prior-game outcomes keeping closed clearance-only history unchanged, and using dated injury context after clearance or report removal.' }],
  },
  {
    version: '2026.10.02.11', date: '2026-10-02', title: 'Corrected injury updates',
    changes: [{ type: 'fix', text: 'Practice updates now attach each participation status to its stated day, preventing a later absence from being reported as a Wednesday absence.' }],
  },
  {
    version: '2026.10.02.10', date: '2026-10-02', title: 'UCL injury updates',
    changes: [{ type: 'fix', text: 'Injury updates now recognize UCL reports as elbow injuries, keeping them distinct from ACL knee injuries.' }],
  },
  {
    version: '2026.10.02.9', date: '2026-10-02', title: 'More complete injury updates',
    changes: [{ type: 'fix', text: 'Injury updates now retain each named player’s own injury and game status in group reports, while keeping hyphenated surnames attached to the correct player.' }],
  },
  {
    version: '2026.10.02.8', date: '2026-10-02', title: 'Clearer in-game injury updates',
    changes: [{ type: 'fix', text: 'In-game outcomes now retain an injury identified in the same club report, and dated recovery updates keep their original source available for review.' }],
  },
  {
    version: '2026.10.02.7', date: '2026-10-02', title: 'More reliable live player stats',
    changes: [{ type: 'fix', text: 'Game pages and the live player-stats API now wait through brief snapshot updates, keeping available player stats visible instead of temporarily showing them as unavailable.', href: '/scores', label: 'Live scores' }],
  },
  {
    version: '2026.10.02.6', date: '2026-10-02', title: 'Corrected injury updates',
    changes: [{ type: 'fix', text: 'In-game outcomes no longer inherit an injury label from a later report about another game. Injury labels explicitly linked within the same game report remain available.' }],
  },
  {
    version: '2026.10.02.5', date: '2026-10-02', title: 'Corrected injury updates',
    changes: [{ type: 'fix', text: 'Injury updates now recognize reported full practice participation and a game-specific absence of an injury designation, so a confirmed practice update replaces an earlier expectation for that day.' }],
  },
  {
    version: '2026.10.02.4', date: '2026-10-02', title: 'Corrected injury updates',
    changes: [{ type: 'fix', text: 'Injury updates now date older injury reports when a newer full-practice report follows, and correctly label practice reported as occurring “yesterday.”' }],
  },
  {
    version: '2026.10.02.3', date: '2026-10-02', title: 'Clearer injury follow-ups',
    changes: [
      { type: 'fix', text: 'Later reports that a player could not return now close the in-game outcome. Verified interview names also connect updates to the correct players.' },
      { type: 'fix', text: 'Recovery reports now replace stale present-tense injury wording when a player has returned to the field.' },
    ],
  },
  {
    version: '2026.10.02.2', date: '2026-10-02', title: 'Corrected injury updates',
    changes: [{ type: 'fix', text: 'Historical injury references in new articles no longer create current injury updates. Separately stated current injuries can still be reported.' }],
  },
  {
    version: '2026.10.02.1', date: '2026-10-02', title: 'Corrected injury updates',
    changes: [{ type: 'fix', text: 'In-game updates now recognize reports that a player returns later in the game, closing an earlier questionable-to-return status without implying availability for future games.' }],
  },
  {
    version: '2026.10.01.5', date: '2026-10-01', title: 'Corrected injury updates',
    changes: [{ type: 'fix', text: 'Game updates that say a player was ruled out from returning to a matchup now show that game’s confirmed outcome without implying availability for future games.' }],
  },
  {
    version: '2026.10.01.4', date: '2026-10-01', title: 'Current 49ers roster restored',
    changes: [{ type: 'fix', text: 'The roster refresh now includes players listed under the 49ers’ active roster code, keeping the team current with the other clubs.', href: '/rosters', label: 'Browse rosters' }],
  },
  {
    version: '2026.10.01.3', date: '2026-10-01', title: 'Corrected injury updates',
    changes: [{ type: 'fix', text: 'Injury updates now distinguish a report’s date from a planned surgery date while preserving confirmed in-game outcomes.' }],
  },
  {
    version: '2026.10.01.2', date: '2026-10-01', title: 'More reliable injury updates',
    changes: [{ type: 'fix', text: 'Injury updates retain verified earlier medical findings, and postgame coverage finds more official interviews about game results.', href: '/injuries', label: 'Browse injuries' }],
  },
  {
    version: '2026.10.01.1', date: '2026-10-01', title: 'Fresh daily data and complete player totals',
    changes: [{ type: 'fix', text: 'Daily roster, schedule, and player data updates resume throughout the week after Tuesday power rankings publish. New Orleans safety Mike Reid’s final-game statistics also count toward his season totals.', href: '/players/michael-reid-2002', label: 'Mike Reid' }],
  },
  {
    version: '2026.09.30.8', date: '2026-09-30', title: 'Cleaner current injury updates',
    changes: [{ type: 'fix', text: 'Injury updates now separate past injuries from current issues, distinguish a return to practice from an in-game return, and keep similarly named players’ reports attached to the right player.', href: '/injuries', label: 'Browse injuries' }],
  },
  {
    version: '2026.09.30.7', date: '2026-09-30', title: 'Verified postgame injury names',
    changes: [{ type: 'fix', text: 'Reviewed postgame transcript names now link to the correct players, including a reported in-game stinger return, while a contradicted injury timeline stays out of updates.' }],
  },
  {
    version: '2026.09.30.6', date: '2026-09-30', title: 'Timed medical observations',
    changes: [{ type: 'fix', text: 'Injury updates now date past medical observations and remove expired overnight plans even when no newer report has arrived.' }],
  },
  {
    version: '2026.09.30.5', date: '2026-09-30', title: 'Clearer injury updates',
    changes: [{ type: 'fix', text: 'Injury updates now show conflicting reports about an injury location with their sources, while expired game participation expectations leave the current summary.' }],
  },
  {
    version: '2026.09.30.4', date: '2026-09-30', title: 'More accurate injury updates',
    changes: [{ type: 'fix', text: 'Injury updates now keep historical injury mentions and pregame warmup reports out of current and in-game claims, while checking the source of each retained medical detail.' }],
  },
  {
    version: '2026.09.30.2', date: '2026-09-30', title: 'Miami injury identity corrected',
    changes: [{ type: 'fix', text: 'Miami’s Julius Brents injury report now links to his JuJu Brents player profile.', href: '/injuries', label: 'Browse injuries' }],
  },
  {
    version: '2026.09.30.1', date: '2026-09-30', title: 'Detroit roster refresh restored',
    changes: [{ type: 'fix', text: 'Roster updates now include newly signed players without holding back an entire team’s current roster.', href: '/rosters', label: 'Browse rosters' }],
  },
  {
    version: '2026.09.29.5', date: '2026-09-29', title: 'Clearer row-pack purchase controls',
    changes: [{ type: 'fix', text: 'The customer portal now highlights prepaid row packs and shows the purchase options in a readable, high-contrast selector on desktop and mobile.', href: '/customer-portal', label: 'Manage API usage' }],
  },
  {
    version: '2026.09.29.4', date: '2026-09-29', title: 'Prepaid API row packs',
    changes: [{ type: 'feature', text: 'Builder and Pro customers can buy extra API rows in one-time $5 packs of 250,000. Unused purchased rows carry forward until used, while the monthly plan allowance is spent first.', href: '/customer-portal', label: 'Manage API usage' }],
  },
  {
    version: '2026.09.29.3', date: '2026-09-29', title: 'Current transactions restored',
    changes: [{ type: 'fix', text: 'Recent team transactions continue updating when the NFL lists a commissioner action without an assigned team.', href: '/transactions', label: 'Browse transactions' }],
  },
  {
    version: '2026.09.29.2', date: '2026-09-29', title: 'Faster Tuesday power rankings',
    changes: [{ type: 'fix', text: 'Power rankings now check for new ESPN, CBS Sports, and NFL.com editions throughout Tuesday, so published updates can appear without waiting for the next daily refresh.', href: '/api-docs/reference-data', label: 'Power rankings' }],
  },
  {
    version: '2026.09.29.1', date: '2026-09-29', title: 'Confirmed Bears postgame injury outcomes',
    changes: [{ type: 'fix', text: 'Braxton Jones and Cam Lewis now show their confirmed non-return against Philadelphia, with direct source links. Postgame research also recognizes “unable to return” reports and checks newly finished games more often.', href: '/games/22819', label: 'Eagles–Bears game' }],
  },
  {
    version: '2026.09.28.12', date: '2026-09-28', title: 'Clearance distinct from game return',
    changes: [{ type: 'fix', text: 'Live injury alerts can show that a player was cleared to return before his next play, without treating the evaluation as a diagnosed concussion or saying he has already returned.', href: '/scores', label: 'Live scores' }],
  },
  {
    version: '2026.09.28.11', date: '2026-09-28', title: 'Accurate live injury return timing',
    changes: [{ type: 'fix', text: 'Live injury alerts now wait for a player to take a snap after the injury play before marking him returned, even when the source alert timestamp arrives early.', href: '/scores', label: 'Live scores' }],
  },
  {
    version: '2026.09.28.10', date: '2026-09-28', title: 'Verified reserve placement in injury updates',
    changes: [{ type: 'fix', text: 'Jaxson Dart’s injury update now includes the Giants’ confirmation that he was placed on injured reserve. A surgery plan whose scheduled day has passed is shown as a dated report until completion is confirmed.' }],
  },
  {
    version: '2026.09.28.9', date: '2026-09-28', title: 'Current injury outcomes from verified sources',
    changes: [{ type: 'fix', text: 'Injury updates now reflect a confirmed season-ending ACL tear, a coach-confirmed game non-return, and later verified game appearances. Older practice and in-game uncertainty no longer overrides those outcomes.' }],
  },
  {
    version: '2026.09.28.8', date: '2026-09-28', title: 'Updated Bears game designation',
    changes: [{ type: 'fix', text: 'Tyson Bagent no longer appears as questionable for Eagles–Bears after the Bears removed his game designation. The weekly practice record remains available.', href: '/injuries?year=2026&week=3&team=CHI', label: 'Bears injury report' }],
  },
  {
    version: '2026.09.28.7', date: '2026-09-28', title: 'Verified in-game injury returns',
    changes: [{ type: 'fix', text: 'A confirmed return in an official NFL gamebook now resolves a conflicting secondary injury recap, so injury updates show the verified in-game outcome.' }],
  },
  {
    version: '2026.09.28.6', date: '2026-09-28', title: 'Clearer injury follow-ups',
    changes: [{ type: 'fix', text: 'Injury updates now retire pregame expectations after confirmed game action, retain corroborated game absences, reflect full-practice availability, credit club articles accurately, and show conflicting return reports as disputed.' }],
  },
  {
    version: '2026.09.28.5', date: '2026-09-28', title: 'More accurate injury updates',
    changes: [{ type: 'fix', text: 'Injury updates no longer assign another player’s injury to Will Lee from the ordinary word “will.” Unsupported held summaries also disappear when their source evidence is withdrawn.' }],
  },
  {
    version: '2026.09.28.4', date: '2026-09-28', title: 'Corrected injury updates',
    changes: [{ type: 'fix', text: 'Explicit team clearance of a named injury now closes that issue in injury updates. It does not confirm a return to the game or fitness for a future game.' }],
  },
  {
    version: '2026.09.28.3', date: '2026-09-28', title: 'Corrected injury updates',
    changes: [{ type: 'fix', text: 'Game updates that explicitly say a player won’t return now close an earlier questionable return status, with the source retained and no season absence inferred.' }],
  },
  {
    version: '2026.09.28.2', date: '2026-09-28', title: 'Historical injuries stay out of current updates',
    changes: [{ type: 'fix', text: 'Injury-update beta no longer presents a last-season injury as a current issue when a new article mentions it while announcing a player’s return.' }],
  },
  {
    version: '2026.09.28.1', date: '2026-09-28', title: 'Injury updates retain final context',
    changes: [{ type: 'fix', text: 'Injury-update beta now keeps a confirmed regular-season absence and game non-return in view when later articles recap the injury. Practice summaries identify conflicting reports while prioritizing the team’s statement, and old medical plans no longer appear as new updates.' }],
  },
  {
    version: '2026.09.27.18', date: '2026-09-27', title: 'Verified final player stats',
    changes: [{ type: 'fix', text: 'Final player stats for Week 3 have been checked against official gamebooks. Unconfirmed extra fields have been resolved, and confirmed totals remain accurate when a live play description or scorer credit differs.', href: '/games/22814', label: 'Cardinals–49ers' }],
  },
  {
    version: '2026.09.27.17', date: '2026-09-27', title: 'Penalty-adjusted live player gains',
    changes: [{ type: 'fix', text: 'A touchdown erased by a holding penalty can still count as a completed pass or rushing attempt. Live player totals now retain the credited gain up to the enforcement spot, including Ty Johnson’s 29-yard catch and Brock Purdy’s 35-yard run.', href: '/games/22809', label: 'Chargers–Bills' }],
  },
  {
    version: '2026.09.27.16', date: '2026-09-27', title: 'More complete live player totals',
    changes: [
      { type: 'fix', text: 'Live totals now count clearly recorded punt-return touchdowns, recovered kickoff muffs and two-fumble possession chains. A punt moved beyond the 20 by a penalty no longer receives inside-20 credit.', href: '/games/22815', label: 'Vikings–Buccaneers' },
      { type: 'fix', text: 'Game-day roster status and verified name variants resolve more abbreviated player names, while a direct-snap mention no longer steals the passer’s intended target.', href: '/games/22808', label: 'Chiefs–Dolphins' },
    ],
  },
  {
    version: '2026.09.27.15', date: '2026-09-27', title: 'Reliable Python API access',
    changes: [{ type: 'fix', text: 'Python scripts can call live scores and other versioned API endpoints with the standard urllib client, without adding a custom User-Agent. API key authentication and plan limits still apply.', href: '/api-docs/quickstart', label: 'API quickstart' }],
  },
  {
    version: '2026.09.27.14', date: '2026-09-27', title: 'More accurate live player stats',
    changes: [{ type: 'fix', text: 'Live player totals now credit a clearly recorded scoring lateral and a receiver’s own end-zone fumble recovery to the correct players. Final box-score reconciliation continues to keep unconfirmed fields separate.', href: '/games/22814', label: 'Cardinals–49ers' }],
  },
  {
    version: '2026.09.27.13', date: '2026-09-27', title: 'Clearer beta injury evidence',
    changes: [{ type: 'fix', text: 'Injury-update beta no longer treats a player’s height as a foot injury or assigns one player’s injury to a teammate. Reports about possible further testing retain that uncertainty, and separately reported game injuries stay distinct.' }],
  },
  {
    version: '2026.09.27.12', date: '2026-09-27', title: 'More accurate game injury notices',
    changes: [{ type: 'fix', text: 'Game injury notices exclude players who were inactive before kickoff even when the postgame recap lists them beside in-game injuries. Newly confirmed postgame outcomes appear with their sources.', href: '/games/22815', label: 'Vikings–Buccaneers' }],
  },
  {
    version: '2026.09.27.11', date: '2026-09-27', title: 'Corrected game injury identities',
    changes: [
      { type: 'fix', text: 'Game injury notices use the player identified on that game’s roster when a recap links to another athlete with the same name. Duplicate notices from mismatched recap links no longer appear.', href: '/games/22811', label: 'Lions–Jets' },
      { type: 'fix', text: 'Previously unresolved game injury notices now show confirmed returns, rule-outs and non-returns when a team, league, or contemporary game report establishes the outcome. Reports remain linked on the game page.', href: '/games/22796', label: 'Steelers–Patriots' },
    ],
  },
  {
    version: '2026.09.27.10', date: '2026-09-27', title: 'Confirmed postgame non-returns',
    changes: [{ type: 'fix', text: 'Game injury notices can show sourced outcomes from explicit Associated Press recaps and verified injury updates for the same player and completed game. Mike Jackson and Greg Van Roten no longer appear as unresolved.', href: '/games/22805', label: 'Panthers–Browns' }],
  },
  {
    version: '2026.09.27.9', date: '2026-09-27', title: 'Recognized returns from later game plays',
    changes: [{ type: 'fix', text: 'Game injury notices recognize a player’s later participation when play-by-play uses an abbreviated name omitted from the player record. A later recorded play can confirm a return, including Samaje Perine’s return against Pittsburgh.', href: '/games/22806', label: 'Steelers–Bengals' }],
  },
  {
    version: '2026.09.27.8', date: '2026-09-27', title: 'More reliable postgame injury updates',
    changes: [{ type: 'fix', text: 'Injury-update beta collection follows verified articles when their headlines and URLs change, recognizes explicit ruled-out reports after an in-game departure, and reserves research capacity for unresolved injuries after games finish. Explicit returns in the same official article are linked to the reported injury when that link is unambiguous. Official live press conferences remain pending until their archived audio is available.' }],
  },
  {
    version: '2026.09.27.7', date: '2026-09-27', title: 'Complete club game-day inactives',
    changes: [{ type: 'fix', text: 'Cardinals, Ravens and Cowboys game-day inactive lists now appear when the club publishes its explicit list inside an availability article or a dated game-day update, even when the headline focuses on an active player.', href: '/games/22814', label: 'Cardinals–49ers' }],
  },
  {
    version: '2026.09.27.6', date: '2026-09-27', title: 'Clearer injury return and availability updates',
    changes: [{ type: 'fix', text: 'Injury-update beta summaries keep the outcome open when a player briefly returns and then leaves again. A later return remains unconfirmed until supported by a new report. Explicit game activation and no-designation reports also supersede earlier questionable listings without implying medical recovery.' }],
  },
  {
    version: '2026.09.27.5', date: '2026-09-27', title: 'Corrected Lions–Jets game-day inactives',
    changes: [{ type: 'fix', text: 'Lions–Jets inactive lists now keep each player on the correct team and include Detroit’s surname-referenced scratch. Active players and reserve-list discussion remain excluded.', href: '/games', label: 'Game pages' }],
  },
  {
    version: '2026.09.27.4', date: '2026-09-27', title: 'Press access applications',
    changes: [{ type: 'feature', text: 'Sports writers and press members can apply for complimentary Builder access by sharing their publication, role, teams covered and a recent article. Applications are reviewed individually, with follow-up through support.', href: '/press-verification', label: 'Apply for press access' }],
  },
  {
    version: '2026.09.27.3', date: '2026-09-27', title: 'Restored hourly roster updates',
    changes: [{ type: 'fix', text: 'Hourly roster publication resumes after correcting a same-name player mismatch in the Chargers depth chart. Incomplete snapshots can be retried without waiting for the next source update.', href: '/rosters', label: 'Rosters' }],
  },
  {
    version: '2026.09.27.2', date: '2026-09-27', title: 'Separate test keys for invited injury beta testers',
    changes: [{ type: 'feature', text: 'Invited injury beta testers can copy their separate test key from Customer Portal and see its allowed endpoints and usage limits. Beta testing uses its own allowance while the production key remains in place.', href: '/customer-portal', label: 'Customer Portal' }],
  },
  {
    version: '2026.09.27.1', date: '2026-09-27', title: 'An editable NFL API playground',
    changes: [{ type: 'fix', text: 'Edit demo requests and inspect readable results alongside JSON. New saved 2026 score and play-by-play examples join historical efficiency samples, with capture times clearly shown.', href: '/demo', label: 'Try the playground' }],
  },
  {
    version: '2026.09.26.6', date: '2026-09-26', title: 'Try NFLMeta without an API key',
    changes: [{ type: 'feature', text: 'Explore historical passer efficiency and team third-down splits in an interactive visual demo, then run the matching example and inspect its JSON response. No signup required.', href: '/demo', label: 'Try the demo' }],
  },
  {
    version: '2026.09.26.5', date: '2026-09-26', title: 'Clearer injury attribution and timing',
    changes: [{ type: 'fix', text: 'Injury updates keep ordered injury descriptions attached to the correct player and preserve the dates of individual entries on rolling team news pages.' }],
  },
  {
    version: '2026.09.26.4', date: '2026-09-26', title: 'More accurate injury updates',
    changes: [{ type: 'fix', text: 'Injury updates distinguish negated reserve claims, recognize additional return and ruled-out wording, and keep past game absences out of practice timelines. Narratives flagged for correction are withdrawn until their evidence or wording changes.' }],
  },
  {
    version: '2026.09.26.3', date: '2026-09-26', title: 'More reliable roster transfer reconciliation',
    changes: [{ type: 'fix', text: 'Official acquisition announcements with a misspelled action word now resolve transfers correctly when club roster pages lag behind.', href: '/rosters', label: 'Rosters' }],
  },
  {
    version: '2026.09.25.3', date: '2026-09-25', title: 'Corrected Week 1 and Week 2 injury notices',
    changes: [{ type: 'fix', text: 'Earlier game pages include missing in-game injury notices and verified return or ruled-out outcomes. A confirmed pregame inactive is no longer shown as injured during the game.', href: '/games', label: 'Game pages' }],
  },
  {
    version: '2026.09.25.2', date: '2026-09-25', title: 'Complete injury reports through game day',
    changes: [{ type: 'fix', text: 'Injury API responses keep all available weekly practice and designation rows through game day, even when the website shows a shorter game-day list.', href: '/api-docs', label: 'API documentation' }],
    developerNotes: 'GET /api/v1/injuries and GET /api/v1/teams/{abbr}/injuries no longer apply the website-only game-day display filter. Absence from a response is not proof of medical recovery or game-day activation; use no_game_designation only when the final weekly report explicitly records it.',
  },
  {
    version: '2026.09.25.1', date: '2026-09-25', title: 'Confirmed postgame injury outcomes',
    changes: [{ type: 'fix', text: 'Game injury notices can now show a sourced did-not-return outcome after the final whistle, so a resolved game does not keep showing an unanswered return question.', href: '/games/22804', label: 'Game details' }],
  },
  {
    version: '2026.09.24.3', date: '2026-09-24', title: 'Clearer final-game injury notices',
    changes: [{ type: 'fix', text: 'When a game ends without a verified return or ruled-out report, its injury notice now says the final outcome is unconfirmed instead of leaving an in-game return question looking current.', href: '/games', label: 'Game pages' }],
  },
  {
    version: '2026.09.24.2', date: '2026-09-24', title: 'Fairer injury API row usage',
    changes: [{ type: 'fix', text: 'Injury API responses still include current reserve players, but those bundled reserve entries no longer use the monthly row allowance on each practice check.', href: '/api-docs', label: 'API documentation' }],
    developerNotes: 'GET /api/v1/injuries, /api/v1/teams/{abbr}/injuries, and /api/v1/players/{player_key}/injuries continue returning meta.current_reserves unchanged. Only data injury-report records count toward the monthly row allowance.',
  },
  {
    version: '2026.09.24.1', date: '2026-09-24', title: 'More accurate in-game injury notices',
    changes: [{ type: 'fix', text: 'Game pages no longer describe a confirmed pregame inactive as suffering an in-game injury when a live provider sends a late injury-status row.', href: '/games', label: 'Game pages' }],
  },
  {
    version: '2026.09.23.9', date: '2026-09-23', title: 'In-game injury notices on game pages',
    changes: [{ type: 'feature', text: 'Game play-by-play now shows reported player injuries and follows whether each player returned, was ruled out, or still has no confirmed outcome.', href: '/games', label: 'Game pages' }],
  },
  {
    version: '2026.09.23.8', date: '2026-09-23', title: 'Reliable checkout when a billing address is needed',
    changes: [{ type: 'fix', text: 'Paid plan checkout now collects a billing address before starting a subscription when it is needed to calculate tax.', href: '/customer-portal/billing', label: 'Manage billing' }],
  },
  {
    version: '2026.09.23.7', date: '2026-09-23', title: 'Verified injury player links',
    changes: [{ type: 'fix', text: 'Injury reports can recover missing player links automatically when an official player profile uniquely confirms the person; uncertain names remain unlinked for review.', href: '/injuries', label: 'Injury reports' }],
  },
  {
    version: '2026.09.23.6', date: '2026-09-23', title: 'More complete weekly injury reports',
    changes: [{ type: 'fix', text: 'Weekly injury reports now recognize player positions embedded in club report names and link an additional verified player nickname to the right profile.', href: '/injuries', label: 'Injury reports' }],
  },
  {
    version: '2026.09.23.5', date: '2026-09-23', title: 'Faster updates for newly signed players',
    changes: [{ type: 'fix', text: 'Team rosters can now include newly signed players from official club pages before they appear in the league player feed, while uncertain identities still wait for verification.', href: '/rosters', label: 'Team rosters' }],
  },
  {
    version: '2026.09.23.4', date: '2026-09-23', title: 'Correct player links on injury reports',
    changes: [{ type: 'fix', text: 'Current injury reports now link additional verified player-name variants to the right profiles, including players listed under a given name or nickname.', href: '/injuries', label: 'Injury reports' }],
  },
  {
    version: '2026.09.23.3', date: '2026-09-23', title: 'Choose a power rankings publisher',
    changes: [{ type: 'improvement', text: 'Request one team’s CBS Sports, ESPN, or NFL power ranking directly, while the usual team response continues to include every publisher.', href: '/api-docs/reference-data', label: 'API reference' }],
    developerNotes: 'GET /api/v1/teams/{abbr}/power-rankings and its /{field} variant accept optional source=cbs|espn|nfl. The filter is case-insensitive; omitted source returns all available publishers.',
  },
  {
    version: '2026.09.23.2', date: '2026-09-23', title: 'Current CBS Sports power rankings',
    changes: [{ type: 'fix', text: 'CBS Sports power rankings now follow the newest published weekly list, so team rankings update even when the publisher’s main rankings page lags behind.', href: '/api-docs/reference-data', label: 'Power rankings' }],
  },
  {
    version: '2026.09.23.1', date: '2026-09-23', title: 'Reliable postgame totals and inactive lists',
    changes: [
      { type: 'fix', text: 'Postgame season totals now retain stats for players who changed teams or left a roster after playing, using their dated team history to preserve the correct identity.', href: '/players', label: 'Player profiles' },
      { type: 'fix', text: 'Game-day inactive lists can recover from the official gamebook when a club report is late or unavailable, without an older unresolved game blocking future updates.', href: '/schedule', label: 'Game details' },
    ],
  },
  {
    version: '2026.09.22.5', date: '2026-09-22', title: 'Game-day weather forecasts',
    changes: [{ type: 'feature', text: 'See a compact venue-specific forecast beside the kickoff details on upcoming game pages, with clear context for outdoor, fixed-roof and retractable-roof stadiums.', href: '/games', label: 'View games' },
      { type: 'feature', text: 'Use venue-specific weather centered on kickoff through the API, with hourly game-window conditions when available.', href: '/api-docs', label: 'API documentation' }],
    developerNotes: 'GET /api/v1/games/{id}/weather returns an hourly kickoff forecast inside the short-range window, a daily outlook farther out, and an explicit unavailable state when a reliable forecast does not exist. Forecasts use a six-hour cache while kickoff is farther away and refresh every ten minutes from two hours before kickoff through five hours after.',
  },
  {
    version: '2026.09.22.4', previousVersions: ['2026.09.22.3'], date: '2026-09-22', title: 'Complete weekly broadcaster coverage',
    changes: [{ type: 'fix', text: 'Weekly announcer assignments now load from an additional published roundup, filling complete crews sooner while preserving official team confirmations and complete simulcast networks.', href: '/schedule', label: 'Game schedule' }],
  },
  {
    version: '2026.09.22.2', date: '2026-09-22', title: 'Complete game broadcast assignments',
    changes: [{ type: 'fix', text: 'Broadcast updates now recognize additional official team watch-guide wording, keeping announcer assignments available alongside network and officiating details.', href: '/schedule', label: 'Game schedule' }],
  },
  {
    version: '2026.09.21.9', date: '2026-09-21', title: 'Focused game-day injury reports',
    previousVersions: ['2026.09.21.8', '2026.09.21.7'],
    changes: [{ type: 'fix', text: 'The latest injury report shows weekly designations before game day, then narrows to pending decisions and confirmed injured inactives. Cleared players disappear instead of receiving an active label.', href: '/injuries', label: 'Injury reports' }],
    developerNotes: 'GET /api/v1/injuries and team injury responses apply the latest-week game-day view. Older weeks and player history retain full weekly reports; report_status preserves the earlier designation.',
  },
  {
    version: '2026.09.21.6', date: '2026-09-21', title: 'Clean final player totals',
    changes: [{ type: 'fix', text: 'Reconciled player statistics now show confirmed final fields only. Unconfirmed play-by-play extras no longer remain visible after final reconciliation.', href: '/games', label: 'Game statistics' }],
    developerNotes: 'Final responses from GET /api/v1/games/{id}/live-player-stats now omit unconfirmed extras and return empty provisional_stats objects.',
  },
  {
    version: '2026.09.21.5', date: '2026-09-21', title: 'Reliable live-score display',
    changes: [{ type: 'fix', text: 'Live scores now show only validated game status and scoring information while in-game injury reporting remains under review.', href: '/scores', label: 'Live scores' }],
    developerNotes: 'The provisional injuries field has been withdrawn from GET /api/v1/live-scores and the TypeScript SDK contract.',
  },
  {
    version: '2026.09.21.2', date: '2026-09-21', title: 'A cleaner quarter-by-quarter timeline',
    changes: [{ type: 'improvement', text: 'Game play-by-play follows the natural Q1-to-finish sequence, automatically collapses completed quarters, and keeps the current quarter open to reduce scrolling.', href: '/games', label: 'Game pages' }],
  },
  {
    version: '2026.09.21.1', date: '2026-09-21', title: 'Newest game action first',
    changes: [{ type: 'improvement', text: 'Game play-by-play now starts with the newest play and works backward, keeping the latest live action immediately visible.', href: '/games', label: 'Game pages' }],
  },
  {
    version: '2026.09.20.1', date: '2026-09-20', title: 'More accurate live player attribution',
    changes: [{ type: 'fix', text: 'Live and postgame player statistics now distinguish active players from same-initial practice-squad teammates and recognize additional verified player-name variants.', href: '/scores', label: 'Live games' }],
  },
  {
    version: '2026.09.18.5', date: '2026-09-18', title: 'Reliable broadcast and officials updates',
    changes: [{ type: 'fix', text: 'Broadcast and officiating updates now recognize the current weekly schedule layout and additional official club watch-guide formats while continuing to reject incomplete assignment data.', href: '/schedule', label: 'Game schedule' }],
  },
  {
    version: '2026.09.18.4', date: '2026-09-18', title: 'More reliable reserve transactions',
    changes: [{ type: 'fix', text: 'Transaction updates now recognize club announcements that combine an injured-reserve placement with a designated-to-return status.', href: '/transactions', label: 'Transactions' }],
  },
  {
    version: '2026.09.18.3', date: '2026-09-18', title: 'Cleaner current injury reports',
    changes: [{ type: 'fix', text: 'Current injury reports now consolidate alternate team abbreviations, preserve the most complete official details, and link additional verified player-name variants to the correct profiles.', href: '/injuries', label: 'Injury reports' }],
  },
  {
    version: '2026.09.18.2', date: '2026-09-18', title: 'Reliable logos in the team ticker',
    changes: [{ type: 'fix', text: 'Team logos in the scrolling homepage ticker now remain visible as they move into view instead of occasionally waiting for a hover or browser repaint.', href: '/', label: 'Homepage' }],
  },
  {
    version: '2026.09.18.1', date: '2026-09-18', title: 'Reliable team logos on live scores',
    changes: [{ type: 'fix', text: 'Team logos on live and upcoming game cards now appear immediately instead of occasionally waiting for an interaction or browser repaint.', href: '/scores', label: 'Live scores' }],
  },
  {
    version: '2026.09.17.5', date: '2026-09-17', title: 'More reliable game-day inactive reports',
    changes: [{ type: 'fix', text: 'Game-day inactive updates now recognize official club reports published as narrative articles, while excluding players the same report confirms are active.', href: '/schedule', label: 'Game details' }],
  },
  {
    version: '2026.09.16.1', date: '2026-09-16', title: 'More reliable early-week injury updates',
    changes: [{ type: 'fix', text: 'Early-week injury reports can now publish as clubs release them at different times. Missing reports become blocking only in the final 24 hours before kickoff, while empty feeds still fail safely.', href: '/injuries', label: 'Injury reports' }],
  },
  {
    version: '2026.09.15.17', date: '2026-09-15', title: 'Independent team roster updates',
    changes: [{ type: 'fix', text: 'A failed team roster update now retains that team’s last verified roster while other teams continue updating. Delayed teams keep their original freshness timestamps and are identified on the roster page and in API responses.', href: '/rosters', label: 'Team rosters' }],
  },
  {
    version: '2026.09.15.16', date: '2026-09-15', title: 'Support tickets and private conversations',
    changes: [{ type: 'feature', text: 'Open a numbered support ticket, track its status, and reply privately from your account. Receive email notifications when support responds or your ticket status changes.', href: '/support', label: 'Get support' }],
  },
  {
    version: '2026.09.15.15', date: '2026-09-15', title: 'Accurate roster fields for unnumbered players',
    changes: [{ type: 'fix', text: 'Players without an assigned jersey number now retain the correct position, height, weight, and experience in roster listings and API responses.', href: '/rosters', label: 'Team rosters' }],
  },
  {
    version: '2026.09.15.14', date: '2026-09-15', title: 'More reliable roster updates',
    changes: [{ type: 'fix', text: 'Roster updates now reconcile excess active-player listings against recent official practice-squad moves, keeping updates flowing when a club roster page lags its transaction announcements.', href: '/rosters', label: 'Team rosters' }],
  },
  {
    version:'2026.09.15.13',date:'2026-09-15',title:'Thursday Night Football broadcast details',
    changes:[{type:'fix',text:'Thursday Night Football broadcast updates now recognize team watch guides that list streaming coverage, analysts, and sideline reporters separately.',href:'/schedule',label:'Game schedule'}],
  },
  {
    version: '2026.09.15.11', date: '2026-09-15', title: 'Immediate billing for plan upgrades',
    changes: [{ type: 'fix', text: 'Paid plan changes now collect the amount due immediately. If payment fails, your existing plan stays in place and you can update your payment method before retrying.', href: '/customer-portal/billing', label: 'Manage billing' }],
  },
  {
    version:'2026.09.15.10',date:'2026-09-15',title:'More resilient assignment updates',
    changes:[{type:'fix',text:'Broadcast and officiating updates now retry temporary source timeouts before reporting a failed refresh, while retaining checks for missing assignments.',href:'/schedule',label:'Game schedule'}],
  },
  {
    version:'2026.09.15.9',date:'2026-09-15',title:'Injury-settlement transaction updates',
    changes:[{type:'fix',text:'Transaction updates now handle announcements covering multiple injury settlements and EDGE-designated players.',href:'/teams',label:'Team transactions'}],
  },
  {
    version:'2026.09.15.8',date:'2026-09-15',title:'Murvin Kenion profile correction',
    changes:[{type:'fix',text:'Consolidated Murvin Kenion’s duplicate player profile while preserving his history and existing profile links.',href:'/players/murvin-kenion-2001',label:'Player profile'}],
  },
  {
    version:'2026.09.15.7',date:'2026-09-15',title:'Corrected player links for roster departures',
    changes:[{type:'fix',text:'Corrected player links on releases, waivers, and reserve moves, including duplicate profiles, alternate names, and transactions reported by a player’s former team.',href:'/teams',label:'Team rosters'}],
  },
  {
    version:'2026.09.15.6',date:'2026-09-15',title:'More accurate transaction player links',
    changes:[{type:'fix',text:'Roster moves now separate practice-squad labels from player names and use position and verified identities to link players accurately, including corrected duplicate profiles.',href:'/teams',label:'Team rosters'}],
  },
  {
    version:'2026.09.15.5',date:'2026-09-15',title:'More reliable Free-key card verification',
    changes:[{type:'fix',text:'Card verification waits until the secure form is ready and offers a reload option if it cannot load or submit, instead of leaving verification stuck.',href:'/customer-portal',label:'Customer portal'}],
  },
  {
    version:'2026.09.15.4',date:'2026-09-15',title:'Team-first weekly injury updates',
    changes:[{type:'fix',text:'Weekly injury updates now check team-specific reports directly, so practice participation can update before the league-wide report catches up. Reports are checked against the current week and matchup.',href:'/injuries',label:'Injury reports'}],
    otherImprovements:['Fixed power-ranking updates when team names include their win-loss record.'],
  },
  {
    version:'2026.09.15.3',date:'2026-09-15',title:'Transaction refresh recovery',
    changes:[{type:'fix',text:'Transaction updates now recover from empty year-archive responses while still requiring a valid dated report.',href:'/teams',label:'Team rosters'}],
  },
  {
    version:'2026.09.15.2',date:'2026-09-15',title:'Roster moves and game-day availability fixes',
    changes:[{type:'fix',text:'Improved transaction imports for practice-squad returns and multi-player moves, keeping current rosters updating.',href:'/teams',label:'Team rosters'},
      {type:'fix',text:'Recovered missing game-day inactive lists and improved support for different report formats.',href:'/schedule',label:'Game details'}],
  },
  {
    version:'2026.09.15.1',date:'2026-09-15',title:'Postgame season-total matching fix',
    changes:[{type:'fix',text:'Fixed alternate-name matching for Dru (Andru) Phillips and CJ (Basil) Okoye so completed-game statistics can update current-season player totals.',href:'/players',label:'Player profiles'}],
  },
  {
    version: '2026.09.14.6', date: '2026-09-14', title: 'Plex setup on NFLMeta',
    changes: [{ type: 'improvement', text: 'Generate your private Plex connection, find game filenames, and apply artwork directly on NFLMeta. Setup clearly identifies the minimum Plex Media Server version: 1.43.0.', href: '/plex/setup', label: 'Set up Plex' }],
  },
  {
    version: '2026.09.14.5', date: '2026-09-14', title: 'Logo-free Original artwork for paid Plex accounts',
    changes: [{ type: 'feature', text: 'Build, Pro and Team customers now receive the Original artwork without NFLMeta branding. Choose its preview card anytime to switch back from another theme. Free accounts keep the branded Original.', href: 'https://plex.nflmeta.org/setup', label: 'Choose artwork' }],
  },
  {
    version: '2026.09.14.4', date: '2026-09-14', title: 'Pick and apply Plex artwork in one step',
    changes: [{ type: 'improvement', text: 'Preview every theme before entering your key. Choose artwork, enter your key once, and apply. A clear upgrade prompt explains when a theme requires Build, Pro or Team.', href: 'https://plex.nflmeta.org/setup', label: 'Choose artwork' }],
  },
  {
    version: '2026.09.14.3', date: '2026-09-14', title: 'Clearer Plex artwork controls',
    changes: [{ type: 'fix', text: 'Enter your API key directly beside the artwork controls. Missing-key prompts, loading progress and errors now appear where you are choosing your theme.', href: 'https://plex.nflmeta.org/setup', label: 'Plex setup' }],
  },
  {
    version: '2026.09.14.2', date: '2026-09-14', title: 'Six artwork themes for Plex',
    changes: [{ type: 'feature', text: 'Build, Pro and Team customers can choose six coordinated, NFLMeta-logo-free artwork themes for seasons, weeks, games and postseason rounds. Apply a theme in setup, then refresh metadata in Plex.', href: 'https://plex.nflmeta.org/setup', label: 'Choose Plex artwork' }],
  },
  {
    version:'2026.09.14.1',date:'2026-09-14',title:'Near-real-time player stats',
    changes:[{type:'feature',text:'Follow passing, rushing, receiving, defense and special-teams player totals on game pages as plays arrive. Updates run about every 30 seconds; live totals are provisional and show when updates are delayed.',href:'/scores',label:'Follow games'},
      {type:'feature',text:'Use the same player totals through the API and connected AI assistants. Final totals reconcile after the game, with unconfirmed fields shown separately.'}],
    developerNotes:'GET /api/v1/games/{id}/live-player-stats and MCP get_live_player_stats (server 0.9.0). Recent regular-season coverage; poll every 30 seconds and check status, stale and provisional_stats. See /api-docs.',
  },
  {
    version:'2026.09.13.8',date:'2026-09-13',title:'Complete final game timelines',
    changes:[{type:'fix',text:'Game pages continue checking for the closing play-by-play event after the score becomes final, and completed games no longer appear to be live.',href:'/scores',label:'Game scores'}],
  },
  {
    version:'2026.09.13.6',date:'2026-09-13',title:'Current-season SDK helpers',
    changes:[{type:'feature',text:'Use daily team cap space, confirmed game-day inactives, injury reports, and team rosters directly from both official SDKs.',href:'/api-docs/sdk',label:'SDK examples'},
      {type:'fix',text:'Connected AI assistants now account for available cap-space data in trade guidance and can request roster counts.'}],
    developerNotes:'TypeScript 0.1.5 and Python 0.1.6. Existing live-score, play-by-play, and historical analytics methods remain compatible.',
  },
  {
    version:'2026.09.13.5',date:'2026-09-13',title:'More reliable postgame player totals',
    changes:[{type:'fix',text:'Improved player matching keeps season totals on player profiles updating after completed games, including players listed under alternate names.',href:'/players',label:'Player profiles'}],
  },
  {
    version:'2026.09.13.4',date:'2026-09-13',title:'Live possession indicators',
    changes:[{type:'feature',text:'A football beside the team name shows reported possession on live score cards. It updates with the score feed and disappears when possession is unavailable or updates become stale.',href:'/scores',label:'Live scores'}],
  },
  {
    version:'2026.09.13.3',date:'2026-09-13',title:'Clearer live game clocks',
    changes:[{type:'fix',text:'Live score cards show the remaining time once with a full quarter label. Eastern-time timestamps display consistently when the page loads.',href:'/scores',label:'Live scores'}],
  },
  {
    version:'2026.09.13.2',date:'2026-09-13',title:'Injured reserve visibility',
    changes:[{type:'fix',text:'See current injured-reserve players alongside weekly injury reports, on team and player profiles. Pending reported moves are distinguished from confirmed roster status.',href:'/injuries',label:'View injuries'}],
    developerNotes:'Injury API responses include a separate current_reserves collection. Historical weekly injury designations are preserved.',
  },
  {
    version: '2026.09.13.1', date: '2026-09-13', title: 'Confirmed game-day inactives',
    changes: [{type:'feature',text:'See confirmed inactive players for both teams on game pages, through the API, and in connected AI assistants.',href:'/schedule',label:'View games'},
      {type:'fix',text:'Confirmed game-day availability now takes precedence over earlier injury designations on the injury list.'}],
    developerNotes: 'GET /api/v1/games/{id}/inactives and MCP get_game_inactives. Injury responses add game_status while preserving report_status.',
  },
  {
    version: '2026.09.12.2',
    date: '2026-09-12',
    previousVersions: ['2026.09.12.1'],
    title: 'Daily team salary-cap space',
    changes: [
      { type: 'feature', text: 'See available salary-cap space for all 32 teams on their profiles, through the API, or in connected AI assistants. Updated daily.', href: '/teams', label: 'Explore teams' },
      { type: 'fix', text: 'Division standings now correctly include teams that have not played and rank 0–0 teams ahead of 0–1 teams.', href: '/standings', label: 'View standings' },
    ],
    developerNotes: 'API: GET /api/v1/teams/cap-space. MCP: get_team_cap_space. Request one team or all 32. See the documentation for filters, freshness, and usage limits.',
  },
];
