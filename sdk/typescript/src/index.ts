import { NFLMetaClientCore } from "./client.js";
import {
  AllStarGamesResource,
  AssetsResource,
  CoachesResource,
  ContributorsResource,
  ExecutivesResource,
  GamesResource,
  HallOfFameResource,
  HealthResource,
  HistoryResource,
  LiveScoresResource,
  MetadataResource,
  PlayersResource,
  PlayoffGamesResource,
  PlayoffsResource,
  PlaysResource,
  ReferenceResource,
  SeasonsResource,
  StaffResource,
  StandingsResource,
  StatsResource,
  SuperBowlsResource,
  TeamsResource,
  UsageResource,
} from "./resources.js";
import { NFLMetaError, NFLMetaBadRequestError, NFLMetaNotFoundError, NFLMetaRateLimitError, NFLMetaTimeoutError, NFLMetaUnauthorizedError } from "./errors.js";

export * from "./errors.js";
export * from "./types.js";

export class NFLMetaClient extends NFLMetaClientCore {
  readonly health: HealthResource;
  readonly liveScores: LiveScoresResource;
  readonly usage: UsageResource;
  readonly metadata: MetadataResource;
  readonly seasons: SeasonsResource;
  readonly teams: TeamsResource;
  readonly players: PlayersResource;
  readonly games: GamesResource;
  readonly plays: PlaysResource;
  readonly playoffGames: PlayoffGamesResource;
  readonly standings: StandingsResource;
  readonly playoffs: PlayoffsResource;
  readonly superBowls: SuperBowlsResource;
  readonly history: HistoryResource;
  readonly hallOfFame: HallOfFameResource;
  readonly contributors: ContributorsResource;
  readonly executives: ExecutivesResource;
  readonly staff: StaffResource;
  readonly coaches: CoachesResource;
  readonly assets: AssetsResource;
  readonly allStarGames: AllStarGamesResource;
  readonly stats: StatsResource;
  readonly reference: ReferenceResource;

  constructor(options: ConstructorParameters<typeof NFLMetaClientCore>[0] = {}) {
    super(options);
    this.health = new HealthResource(this);
    this.liveScores = new LiveScoresResource(this);
    this.usage = new UsageResource(this);
    this.metadata = new MetadataResource(this);
    this.seasons = new SeasonsResource(this);
    this.teams = new TeamsResource(this);
    this.players = new PlayersResource(this);
    this.games = new GamesResource(this);
    this.plays = new PlaysResource(this);
    this.playoffGames = new PlayoffGamesResource(this);
    this.standings = new StandingsResource(this);
    this.playoffs = new PlayoffsResource(this);
    this.superBowls = new SuperBowlsResource(this);
    this.history = new HistoryResource(this);
    this.hallOfFame = new HallOfFameResource(this);
    this.contributors = new ContributorsResource(this, ["contributors"]);
    this.executives = new ExecutivesResource(this, ["executives"]);
    this.staff = new StaffResource(this, ["staff"]);
    this.coaches = new CoachesResource(this, ["coaches"]);
    this.assets = new AssetsResource(this);
    this.allStarGames = new AllStarGamesResource(this);
    this.stats = new StatsResource(this);
    this.reference = new ReferenceResource(this);
  }
}

export function createNFLMetaClient(options: ConstructorParameters<typeof NFLMetaClient>[0] = {}): NFLMetaClient {
  return new NFLMetaClient(options);
}

export {
  NFLMetaBadRequestError,
  NFLMetaError,
  NFLMetaNotFoundError,
  NFLMetaRateLimitError,
  NFLMetaTimeoutError,
  NFLMetaUnauthorizedError,
};
