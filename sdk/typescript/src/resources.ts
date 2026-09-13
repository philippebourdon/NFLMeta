import { NFLMetaClientCore } from "./client.js";
import type {
  FieldValue,
  GameListItem,
  HealthSnapshot,
  LiveScoreGame,
  LiveScoreMeta,
  ListMeta,
  NFLMetaEnvelope,
  PlayLeaderRow,
  PlayListItem,
  PlaySummaryRow,
  PlayerBio,
  PlayerIdentity,
  PlayerIds,
  PlayerListItem,
  QueryParams,
  SeasonListItem,
  TeamListItem,
  UnknownRecord,
  UsageSnapshot,
} from "./types.js";

function segment(value: string | number): string {
  return encodeURIComponent(String(value));
}

function apiPath(...parts: Array<string | number>): string {
  return `/api/v1/${parts.map(segment).join("/")}`;
}

class BaseResource {
  protected readonly client: NFLMetaClientCore;

  constructor(client: NFLMetaClientCore) {
    this.client = client;
  }

  protected request<TData = UnknownRecord, TMeta = unknown>(
    path: string,
    query?: QueryParams,
  ): Promise<NFLMetaEnvelope<TData, TMeta>> {
    return this.client.get<TData, TMeta>(path, { query });
  }

  protected requestField<TValue = unknown>(
    path: string,
    query?: QueryParams,
  ): Promise<NFLMetaEnvelope<FieldValue<TValue>>> {
    return this.client.get<FieldValue<TValue>>(path, { query });
  }
}

export class HealthResource extends BaseResource {
  get(): Promise<NFLMetaEnvelope<HealthSnapshot>> {
    return this.request<HealthSnapshot>(apiPath("health"));
  }
}

export class LiveScoresResource extends BaseResource {
  get(): Promise<NFLMetaEnvelope<LiveScoreGame[], LiveScoreMeta>> {
    return this.request<LiveScoreGame[], LiveScoreMeta>(apiPath("live-scores"));
  }
}

export class UsageResource extends BaseResource {
  get(): Promise<NFLMetaEnvelope<UsageSnapshot>> {
    return this.request<UsageSnapshot>(apiPath("usage"));
  }
}

export class MetadataResource extends BaseResource {
  show(): Promise<NFLMetaEnvelope<UnknownRecord>> {
    return this.request(apiPath("show"));
  }
}

export class SeasonsResource extends BaseResource {
  list(query?: QueryParams): Promise<NFLMetaEnvelope<SeasonListItem[], ListMeta>> {
    return this.request<SeasonListItem[], ListMeta>(apiPath("seasons"), query);
  }

  summary(year: number): Promise<NFLMetaEnvelope<UnknownRecord>> {
    return this.request(apiPath("season", year));
  }

  summaryField<TValue = unknown>(year: number, field: string): Promise<NFLMetaEnvelope<FieldValue<TValue>>> {
    return this.requestField(apiPath("season", year, field));
  }

  byes(year: number): Promise<NFLMetaEnvelope<UnknownRecord>> {
    return this.request(apiPath("byes", year));
  }
}

export class TeamsResource extends BaseResource {
  list(query?: QueryParams): Promise<NFLMetaEnvelope<TeamListItem[], ListMeta>> {
    return this.request<TeamListItem[], ListMeta>(apiPath("teams"), query);
  }

  get(abbr: string, query?: QueryParams): Promise<NFLMetaEnvelope<UnknownRecord>> {
    return this.request(apiPath("teams", abbr), query);
  }

  recentGames(abbr: string, query?: QueryParams): Promise<NFLMetaEnvelope<GameListItem[], UnknownRecord>> {
    return this.request<GameListItem[], UnknownRecord>(apiPath("teams", abbr, "games"), query);
  }

  profile(abbr: string, query?: QueryParams): Promise<NFLMetaEnvelope<UnknownRecord>> {
    return this.request(apiPath("teams", abbr, "profile"), query);
  }

  profileField<TValue = unknown>(abbr: string, field: string, query?: QueryParams): Promise<NFLMetaEnvelope<FieldValue<TValue>>> {
    return this.requestField(apiPath("teams", abbr, "profile", field), query);
  }

  identity(abbr: string): Promise<NFLMetaEnvelope<UnknownRecord>> {
    return this.request(apiPath("teams", abbr, "identity"));
  }

  identityField<TValue = unknown>(abbr: string, field: string): Promise<NFLMetaEnvelope<FieldValue<TValue>>> {
    return this.requestField(apiPath("teams", abbr, "identity", field));
  }

  season(abbr: string, query?: QueryParams): Promise<NFLMetaEnvelope<UnknownRecord>> {
    return this.request(apiPath("teams", abbr, "season"), query);
  }

  seasonField<TValue = unknown>(abbr: string, field: string, query?: QueryParams): Promise<NFLMetaEnvelope<FieldValue<TValue>>> {
    return this.requestField(apiPath("teams", abbr, "season", field), query);
  }

  stats(abbr: string, query?: QueryParams): Promise<NFLMetaEnvelope<UnknownRecord>> {
    return this.request(apiPath("teams", abbr, "stats"), query);
  }

  statsField<TValue = unknown>(abbr: string, field: string, query?: QueryParams): Promise<NFLMetaEnvelope<FieldValue<TValue>>> {
    return this.requestField(apiPath("teams", abbr, "stats", field), query);
  }

  powerRankings(abbr: string, query?: QueryParams): Promise<NFLMetaEnvelope<UnknownRecord>> {
    return this.request(apiPath("teams", abbr, "power-rankings"), query);
  }

  powerRankingsField<TValue = unknown>(abbr: string, field: string, query?: QueryParams): Promise<NFLMetaEnvelope<FieldValue<TValue>>> {
    return this.requestField(apiPath("teams", abbr, "power-rankings", field), query);
  }

  stadium(abbr: string, query?: QueryParams): Promise<NFLMetaEnvelope<UnknownRecord>> {
    return this.request(apiPath("teams", abbr, "stadium"), query);
  }

  stadiumField<TValue = unknown>(abbr: string, field: string, query?: QueryParams): Promise<NFLMetaEnvelope<FieldValue<TValue>>> {
    return this.requestField(apiPath("teams", abbr, "stadium", field), query);
  }

  proBowl(abbr: string, query?: QueryParams): Promise<NFLMetaEnvelope<UnknownRecord>> {
    return this.request(apiPath("teams", abbr, "pro-bowl"), query);
  }

  proBowlField<TValue = unknown>(abbr: string, field: string, query?: QueryParams): Promise<NFLMetaEnvelope<FieldValue<TValue>>> {
    return this.requestField(apiPath("teams", abbr, "pro-bowl", field), query);
  }
}

export class PlayersResource extends BaseResource {
  list(query?: QueryParams): Promise<NFLMetaEnvelope<PlayerListItem[], ListMeta>> {
    return this.request<PlayerListItem[], ListMeta>(apiPath("players"), query);
  }

  get(playerKey: string): Promise<NFLMetaEnvelope<UnknownRecord>> {
    return this.request(apiPath("players", playerKey));
  }

  identity(playerKey: string): Promise<NFLMetaEnvelope<PlayerIdentity>> {
    return this.request<PlayerIdentity>(apiPath("players", playerKey, "identity"));
  }

  identityField<TValue = unknown>(playerKey: string, field: string): Promise<NFLMetaEnvelope<FieldValue<TValue>>> {
    return this.requestField(apiPath("players", playerKey, "identity", field));
  }

  bio(playerKey: string): Promise<NFLMetaEnvelope<PlayerBio>> {
    return this.request<PlayerBio>(apiPath("players", playerKey, "bio"));
  }

  bioField<TValue = unknown>(playerKey: string, field: string): Promise<NFLMetaEnvelope<FieldValue<TValue>>> {
    return this.requestField(apiPath("players", playerKey, "bio", field));
  }

  ids(playerKey: string): Promise<NFLMetaEnvelope<PlayerIds>> {
    return this.request<PlayerIds>(apiPath("players", playerKey, "ids"));
  }

  idsField<TValue = unknown>(playerKey: string, field: string): Promise<NFLMetaEnvelope<FieldValue<TValue>>> {
    return this.requestField(apiPath("players", playerKey, "ids", field));
  }

  history(playerKey: string): Promise<NFLMetaEnvelope<UnknownRecord>> {
    return this.request(apiPath("players", playerKey, "history"));
  }

  historyField<TValue = unknown>(playerKey: string, field: string): Promise<NFLMetaEnvelope<FieldValue<TValue>>> {
    return this.requestField(apiPath("players", playerKey, "history", field));
  }

  honors(playerKey: string): Promise<NFLMetaEnvelope<UnknownRecord>> {
    return this.request(apiPath("players", playerKey, "honors"));
  }

  honorsField<TValue = unknown>(playerKey: string, field: string): Promise<NFLMetaEnvelope<FieldValue<TValue>>> {
    return this.requestField(apiPath("players", playerKey, "honors", field));
  }

  roster(playerKey: string): Promise<NFLMetaEnvelope<UnknownRecord>> {
    return this.request(apiPath("players", playerKey, "roster"));
  }

  games(playerKey: string, query?: QueryParams): Promise<NFLMetaEnvelope<UnknownRecord[], UnknownRecord>> {
    return this.request<UnknownRecord[], UnknownRecord>(apiPath("players", playerKey, "games"), query);
  }

  career(playerKey: string): Promise<NFLMetaEnvelope<UnknownRecord>> {
    return this.request(apiPath("players", playerKey, "career"));
  }

  careerField<TValue = unknown>(playerKey: string, field: string): Promise<NFLMetaEnvelope<FieldValue<TValue>>> {
    return this.requestField(apiPath("players", playerKey, "career", field));
  }

  careerSeasons(playerKey: string, query?: QueryParams): Promise<NFLMetaEnvelope<UnknownRecord[], ListMeta>> {
    return this.request<UnknownRecord[], ListMeta>(apiPath("players", playerKey, "career", "seasons"), query);
  }

  splits(playerKey: string, query?: QueryParams): Promise<NFLMetaEnvelope<UnknownRecord>> {
    return this.request(apiPath("players", playerKey, "splits"), query);
  }

  splitsField<TValue = unknown>(playerKey: string, field: string, query?: QueryParams): Promise<NFLMetaEnvelope<FieldValue<TValue>>> {
    return this.requestField(apiPath("players", playerKey, "splits", field), query);
  }

  records(playerKey: string, query?: QueryParams): Promise<NFLMetaEnvelope<UnknownRecord>> {
    return this.request(apiPath("players", playerKey, "records"), query);
  }

  recordsField<TValue = unknown>(playerKey: string, field: string, query?: QueryParams): Promise<NFLMetaEnvelope<FieldValue<TValue>>> {
    return this.requestField(apiPath("players", playerKey, "records", field), query);
  }

  kicking(playerKey: string): Promise<NFLMetaEnvelope<UnknownRecord[]>> {
    return this.request<UnknownRecord[]>(apiPath("players", playerKey, "kicking"));
  }

  kickingSeason(playerKey: string, seasonYear: number): Promise<NFLMetaEnvelope<UnknownRecord>> {
    return this.request(apiPath("players", playerKey, "kicking", seasonYear));
  }

  kickingSeasonField<TValue = unknown>(
    playerKey: string,
    seasonYear: number,
    field: string,
  ): Promise<NFLMetaEnvelope<FieldValue<TValue>>> {
    return this.requestField(apiPath("players", playerKey, "kicking", seasonYear, field));
  }

  punting(playerKey: string): Promise<NFLMetaEnvelope<UnknownRecord[]>> {
    return this.request<UnknownRecord[]>(apiPath("players", playerKey, "punting"));
  }

  puntingSeason(playerKey: string, seasonYear: number): Promise<NFLMetaEnvelope<UnknownRecord>> {
    return this.request(apiPath("players", playerKey, "punting", seasonYear));
  }

  puntingSeasonField<TValue = unknown>(
    playerKey: string,
    seasonYear: number,
    field: string,
  ): Promise<NFLMetaEnvelope<FieldValue<TValue>>> {
    return this.requestField(apiPath("players", playerKey, "punting", seasonYear, field));
  }
}

export class GamesResource extends BaseResource {
  list(query?: QueryParams): Promise<NFLMetaEnvelope<GameListItem[], ListMeta>> {
    return this.request<GameListItem[], ListMeta>(apiPath("games"), query);
  }

  get(gameId: number): Promise<NFLMetaEnvelope<UnknownRecord>> {
    return this.request(apiPath("games", gameId));
  }

  field<TValue = unknown>(gameId: number, field: string): Promise<NFLMetaEnvelope<FieldValue<TValue>>> {
    return this.requestField(apiPath("games", gameId, field));
  }

  extras(gameId: number): Promise<NFLMetaEnvelope<UnknownRecord, UnknownRecord>> {
    return this.request<UnknownRecord, UnknownRecord>(apiPath("games", gameId, "extras"));
  }
}

/**
 * Play-by-play.
 *
 * `list` is metered per play and the API refuses an unnarrowed request with
 * 400: pass `game_id`, or `player`, or `season` together with one of `week`,
 * `team` or `opponent`. `summary` and `leaders` answer season-wide questions
 * server-side in tens of rows, which is what most callers actually want.
 */
export class PlaysResource extends BaseResource {
  list(query?: QueryParams): Promise<NFLMetaEnvelope<PlayListItem[], ListMeta>> {
    return this.request<PlayListItem[], ListMeta>(apiPath("plays"), query);
  }

  summary(query?: QueryParams): Promise<NFLMetaEnvelope<PlaySummaryRow[], UnknownRecord>> {
    return this.request<PlaySummaryRow[], UnknownRecord>(apiPath("plays", "summary"), query);
  }

  leaders(query?: QueryParams): Promise<NFLMetaEnvelope<PlayLeaderRow[], ListMeta>> {
    return this.request<PlayLeaderRow[], ListMeta>(apiPath("plays", "leaders"), query);
  }
}

export class PlayoffGamesResource extends BaseResource {
  get(gameId: number): Promise<NFLMetaEnvelope<UnknownRecord>> {
    return this.request(apiPath("playoff-games", gameId));
  }

  field<TValue = unknown>(gameId: number, field: string): Promise<NFLMetaEnvelope<FieldValue<TValue>>> {
    return this.requestField(apiPath("playoff-games", gameId, field));
  }

  extras(gameId: number): Promise<NFLMetaEnvelope<UnknownRecord>> {
    return this.request(apiPath("playoff-games", gameId, "extras"));
  }

  supplemental(gameId: number): Promise<NFLMetaEnvelope<UnknownRecord>> {
    return this.request(apiPath("playoff-games", gameId, "supplemental"));
  }
}

export class StandingsResource extends BaseResource {
  get(query?: QueryParams): Promise<NFLMetaEnvelope<UnknownRecord>> {
    return this.request(apiPath("standings"), query);
  }
}

export class PlayoffsResource extends BaseResource {
  picture(query?: QueryParams): Promise<NFLMetaEnvelope<UnknownRecord>> {
    return this.request(apiPath("playoffs", "picture"), query);
  }
}

export class SuperBowlsResource extends BaseResource {
  list(query?: QueryParams): Promise<NFLMetaEnvelope<UnknownRecord[], ListMeta>> {
    return this.request<UnknownRecord[], ListMeta>(apiPath("super-bowls"), query);
  }

  bySeason(seasonYear: number): Promise<NFLMetaEnvelope<UnknownRecord>> {
    return this.request(apiPath("super-bowls", seasonYear));
  }

  byTeam(abbr: string): Promise<NFLMetaEnvelope<UnknownRecord>> {
    return this.request(apiPath("super-bowls", "teams", abbr));
  }
}

export class HistoryResource extends BaseResource {
  officials(query?: QueryParams): Promise<NFLMetaEnvelope<UnknownRecord[], ListMeta>> {
    return this.request<UnknownRecord[], ListMeta>(apiPath("history", "officials"), query);
  }

  stadiums(query?: QueryParams): Promise<NFLMetaEnvelope<UnknownRecord[], ListMeta>> {
    return this.request<UnknownRecord[], ListMeta>(apiPath("history", "stadiums"), query);
  }

  teamLogos(query?: QueryParams): Promise<NFLMetaEnvelope<UnknownRecord[], ListMeta>> {
    return this.request<UnknownRecord[], ListMeta>(apiPath("history", "team-logos"), query);
  }

  venues(query?: QueryParams): Promise<NFLMetaEnvelope<UnknownRecord[], ListMeta>> {
    return this.request<UnknownRecord[], ListMeta>(apiPath("history", "venues"), query);
  }
}

export class HallOfFameResource extends BaseResource {
  list(query?: QueryParams): Promise<NFLMetaEnvelope<UnknownRecord[], ListMeta>> {
    return this.request<UnknownRecord[], ListMeta>(apiPath("hall-of-fame"), query);
  }

  election(year: number): Promise<NFLMetaEnvelope<UnknownRecord>> {
    return this.request(apiPath("hall-of-fame", year));
  }

  electionField<TValue = unknown>(year: number, field: string): Promise<NFLMetaEnvelope<FieldValue<TValue>>> {
    return this.requestField(apiPath("hall-of-fame", year, field));
  }
}

class PeopleSliceResource extends BaseResource {
  protected readonly baseSegments: readonly string[];

  constructor(client: NFLMetaClientCore, baseSegments: readonly string[]) {
    super(client);
    this.baseSegments = baseSegments;
  }

  protected resourcePath(key: string, ...suffix: Array<string | number>): string {
    return apiPath(...this.baseSegments, key, ...suffix);
  }

  get(key: string): Promise<NFLMetaEnvelope<UnknownRecord>> {
    return this.request(this.resourcePath(key));
  }

  identity(key: string): Promise<NFLMetaEnvelope<UnknownRecord>> {
    return this.request(this.resourcePath(key, "identity"));
  }

  identityField<TValue = unknown>(key: string, field: string): Promise<NFLMetaEnvelope<FieldValue<TValue>>> {
    return this.requestField(this.resourcePath(key, "identity", field));
  }

  bio(key: string): Promise<NFLMetaEnvelope<UnknownRecord>> {
    return this.request(this.resourcePath(key, "bio"));
  }

  bioField<TValue = unknown>(key: string, field: string): Promise<NFLMetaEnvelope<FieldValue<TValue>>> {
    return this.requestField(this.resourcePath(key, "bio", field));
  }

  history(key: string): Promise<NFLMetaEnvelope<UnknownRecord>> {
    return this.request(this.resourcePath(key, "history"));
  }

  historyField<TValue = unknown>(key: string, field: string): Promise<NFLMetaEnvelope<FieldValue<TValue>>> {
    return this.requestField(this.resourcePath(key, "history", field));
  }
}

export class ContributorsResource extends PeopleSliceResource {
  list(query?: QueryParams): Promise<NFLMetaEnvelope<UnknownRecord[], ListMeta>> {
    return this.request<UnknownRecord[], ListMeta>(apiPath("contributors"), query);
  }
}

export class ExecutivesResource extends PeopleSliceResource {
  list(query?: QueryParams): Promise<NFLMetaEnvelope<UnknownRecord[], ListMeta>> {
    return this.request<UnknownRecord[], ListMeta>(apiPath("executives"), query);
  }

  career(key: string): Promise<NFLMetaEnvelope<UnknownRecord>> {
    return this.request(this.resourcePath(key, "career"));
  }

  careerField<TValue = unknown>(key: string, field: string): Promise<NFLMetaEnvelope<FieldValue<TValue>>> {
    return this.requestField(this.resourcePath(key, "career", field));
  }
}

export class StaffResource extends PeopleSliceResource {
  list(query?: QueryParams): Promise<NFLMetaEnvelope<UnknownRecord[], ListMeta>> {
    return this.request<UnknownRecord[], ListMeta>(apiPath("staff"), query);
  }

  career(key: string): Promise<NFLMetaEnvelope<UnknownRecord>> {
    return this.request(this.resourcePath(key, "career"));
  }

  careerField<TValue = unknown>(key: string, field: string): Promise<NFLMetaEnvelope<FieldValue<TValue>>> {
    return this.requestField(this.resourcePath(key, "career", field));
  }
}

export class CoachesResource extends PeopleSliceResource {
  list(query?: QueryParams): Promise<NFLMetaEnvelope<UnknownRecord[], ListMeta>> {
    return this.request<UnknownRecord[], ListMeta>(apiPath("coaches"), query);
  }

  career(key: string): Promise<NFLMetaEnvelope<UnknownRecord>> {
    return this.request(this.resourcePath(key, "career"));
  }

  careerField<TValue = unknown>(key: string, field: string): Promise<NFLMetaEnvelope<FieldValue<TValue>>> {
    return this.requestField(this.resourcePath(key, "career", field));
  }
}

export class AssetsResource extends BaseResource {
  logos(query?: QueryParams): Promise<NFLMetaEnvelope<UnknownRecord[], ListMeta>> {
    return this.request<UnknownRecord[], ListMeta>(apiPath("assets", "logos"), query);
  }

  images(query?: QueryParams): Promise<NFLMetaEnvelope<UnknownRecord[], ListMeta>> {
    return this.request<UnknownRecord[], ListMeta>(apiPath("assets", "images"), query);
  }
}

export class AllStarGamesResource extends BaseResource {
  list(query?: QueryParams): Promise<NFLMetaEnvelope<UnknownRecord[], ListMeta>> {
    return this.request<UnknownRecord[], ListMeta>(apiPath("all-star-games"), query);
  }
}

export class StatsPlayersResource extends BaseResource {
  catalog(query?: QueryParams): Promise<NFLMetaEnvelope<UnknownRecord>> {
    return this.request(apiPath("stats", "players", "catalog"), query);
  }

  search(query?: QueryParams): Promise<NFLMetaEnvelope<UnknownRecord[], UnknownRecord>> {
    return this.request<UnknownRecord[], UnknownRecord>(apiPath("stats", "players", "search"), query);
  }

  compare(query?: QueryParams): Promise<NFLMetaEnvelope<UnknownRecord>> {
    return this.request(apiPath("stats", "players", "compare"), query);
  }

  seasons(query?: QueryParams): Promise<NFLMetaEnvelope<UnknownRecord[], UnknownRecord>> {
    return this.request<UnknownRecord[], UnknownRecord>(apiPath("stats", "players", "seasons"), query);
  }

  seasonsByStat(seasonYear: number, stat: string, query?: QueryParams): Promise<NFLMetaEnvelope<UnknownRecord[], UnknownRecord>> {
    return this.request<UnknownRecord[], UnknownRecord>(apiPath("stats", "players", "seasons", seasonYear, stat), query);
  }

  careers(query?: QueryParams): Promise<NFLMetaEnvelope<UnknownRecord[], UnknownRecord>> {
    return this.request<UnknownRecord[], UnknownRecord>(apiPath("stats", "players", "careers"), query);
  }

  careersByStat(stat: string, query?: QueryParams): Promise<NFLMetaEnvelope<UnknownRecord[], UnknownRecord>> {
    return this.request<UnknownRecord[], UnknownRecord>(apiPath("stats", "players", "careers", stat), query);
  }

  games(query?: QueryParams): Promise<NFLMetaEnvelope<UnknownRecord[], UnknownRecord>> {
    return this.request<UnknownRecord[], UnknownRecord>(apiPath("stats", "players", "games"), query);
  }

  gameSplits(query?: QueryParams): Promise<NFLMetaEnvelope<UnknownRecord[], UnknownRecord>> {
    return this.request<UnknownRecord[], UnknownRecord>(apiPath("stats", "players", "games", "splits"), query);
  }

  gameLeadersByFamily(statFamily: string, query?: QueryParams): Promise<NFLMetaEnvelope<UnknownRecord[], UnknownRecord>> {
    return this.request<UnknownRecord[], UnknownRecord>(apiPath("stats", "players", "games", "leaders", statFamily), query);
  }

  teams(query?: QueryParams): Promise<NFLMetaEnvelope<UnknownRecord[], UnknownRecord>> {
    return this.request<UnknownRecord[], UnknownRecord>(apiPath("stats", "players", "teams"), query);
  }

  weeks(seasonYear: number, query?: QueryParams): Promise<NFLMetaEnvelope<UnknownRecord[], UnknownRecord>> {
    return this.request<UnknownRecord[], UnknownRecord>(apiPath("stats", "players", "season", seasonYear, "weeks"), query);
  }
}

export class StatsResource {
  readonly players: StatsPlayersResource;

  constructor(client: NFLMetaClientCore) {
    this.players = new StatsPlayersResource(client);
  }
}

export class ReferenceResource extends BaseResource {
  allStarGames(query?: QueryParams): Promise<NFLMetaEnvelope<UnknownRecord[], ListMeta>> {
    return this.request<UnknownRecord[], ListMeta>(apiPath("reference", "all-star-games"), query);
  }

  coaches(query?: QueryParams): Promise<NFLMetaEnvelope<UnknownRecord[], ListMeta>> {
    return this.request<UnknownRecord[], ListMeta>(apiPath("reference", "coaches"), query);
  }

  coach(key: string): Promise<NFLMetaEnvelope<UnknownRecord>> {
    return this.request(apiPath("reference", "coaches", key));
  }

  coachField<TValue = unknown>(key: string, field: string): Promise<NFLMetaEnvelope<FieldValue<TValue>>> {
    return this.requestField(apiPath("reference", "coaches", key, field));
  }

  officials(query?: QueryParams): Promise<NFLMetaEnvelope<UnknownRecord[], ListMeta>> {
    return this.request<UnknownRecord[], ListMeta>(apiPath("reference", "officials"), query);
  }

  official(key: string): Promise<NFLMetaEnvelope<UnknownRecord>> {
    return this.request(apiPath("reference", "officials", key));
  }

  officialField<TValue = unknown>(key: string, field: string): Promise<NFLMetaEnvelope<FieldValue<TValue>>> {
    return this.requestField(apiPath("reference", "officials", key, field));
  }

  powerRankings(query?: QueryParams): Promise<NFLMetaEnvelope<UnknownRecord[], ListMeta>> {
    return this.request<UnknownRecord[], ListMeta>(apiPath("reference", "power-rankings"), query);
  }

  proBowlPlayerBios(query?: QueryParams): Promise<NFLMetaEnvelope<UnknownRecord[], ListMeta>> {
    return this.request<UnknownRecord[], ListMeta>(apiPath("reference", "pro-bowl-player-bios"), query);
  }

  proBowlPlayerStats(query?: QueryParams): Promise<NFLMetaEnvelope<UnknownRecord[], ListMeta>> {
    return this.request<UnknownRecord[], ListMeta>(apiPath("reference", "pro-bowl-player-stats"), query);
  }

  proBowlSelections(query?: QueryParams): Promise<NFLMetaEnvelope<UnknownRecord[], ListMeta>> {
    return this.request<UnknownRecord[], ListMeta>(apiPath("reference", "pro-bowl-selections"), query);
  }

  seasons(query?: QueryParams): Promise<NFLMetaEnvelope<UnknownRecord[], ListMeta>> {
    return this.request<UnknownRecord[], ListMeta>(apiPath("reference", "seasons"), query);
  }

  stadiumHistories(query?: QueryParams): Promise<NFLMetaEnvelope<UnknownRecord[], ListMeta>> {
    return this.request<UnknownRecord[], ListMeta>(apiPath("reference", "stadium-histories"), query);
  }

  stadiums(query?: QueryParams): Promise<NFLMetaEnvelope<UnknownRecord[], ListMeta>> {
    return this.request<UnknownRecord[], ListMeta>(apiPath("reference", "stadiums"), query);
  }

  teamAliases(query?: QueryParams): Promise<NFLMetaEnvelope<UnknownRecord[], ListMeta>> {
    return this.request<UnknownRecord[], ListMeta>(apiPath("reference", "team-aliases"), query);
  }

  teamCoaches(query?: QueryParams): Promise<NFLMetaEnvelope<UnknownRecord[], ListMeta>> {
    return this.request<UnknownRecord[], ListMeta>(apiPath("reference", "team-coaches"), query);
  }

  teamColors(query?: QueryParams): Promise<NFLMetaEnvelope<UnknownRecord[], ListMeta>> {
    return this.request<UnknownRecord[], ListMeta>(apiPath("reference", "team-colors"), query);
  }

  teamLogoHistories(query?: QueryParams): Promise<NFLMetaEnvelope<UnknownRecord[], ListMeta>> {
    return this.request<UnknownRecord[], ListMeta>(apiPath("reference", "team-logo-histories"), query);
  }

  teamNameHistories(query?: QueryParams): Promise<NFLMetaEnvelope<UnknownRecord[], ListMeta>> {
    return this.request<UnknownRecord[], ListMeta>(apiPath("reference", "team-name-histories"), query);
  }

  teamSeasonRecords(query?: QueryParams): Promise<NFLMetaEnvelope<UnknownRecord[], ListMeta>> {
    return this.request<UnknownRecord[], ListMeta>(apiPath("reference", "team-season-records"), query);
  }

  teamSeasonStats(query?: QueryParams): Promise<NFLMetaEnvelope<UnknownRecord[], ListMeta>> {
    return this.request<UnknownRecord[], ListMeta>(apiPath("reference", "team-season-stats"), query);
  }

  teams(query?: QueryParams): Promise<NFLMetaEnvelope<UnknownRecord[], ListMeta>> {
    return this.request<UnknownRecord[], ListMeta>(apiPath("reference", "teams"), query);
  }

  venues(query?: QueryParams): Promise<NFLMetaEnvelope<UnknownRecord[], ListMeta>> {
    return this.request<UnknownRecord[], ListMeta>(apiPath("reference", "venues"), query);
  }

  venue(key: string): Promise<NFLMetaEnvelope<UnknownRecord>> {
    return this.request(apiPath("reference", "venues", key));
  }

  venueField<TValue = unknown>(key: string, field: string): Promise<NFLMetaEnvelope<FieldValue<TValue>>> {
    return this.requestField(apiPath("reference", "venues", key, field));
  }
}
