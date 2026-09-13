from __future__ import annotations

from typing import Any

from .client import NFLMetaClientCore, __version__
from .errors import (
    NFLMetaBadRequestError,
    NFLMetaError,
    NFLMetaInvalidUrlError,
    NFLMetaNotFoundError,
    NFLMetaRateLimitError,
    NFLMetaTimeoutError,
    NFLMetaUnauthorizedError,
)
from .resources import (
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
)
from .types import APIResponse, FieldValue, RateLimitInfo


class NFLMetaClient(NFLMetaClientCore):
    def __init__(self, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self.health = HealthResource(self)
        self.live_scores = LiveScoresResource(self)
        self.usage = UsageResource(self)
        self.metadata = MetadataResource(self)
        self.seasons = SeasonsResource(self)
        self.teams = TeamsResource(self)
        self.players = PlayersResource(self)
        self.games = GamesResource(self)
        self.plays = PlaysResource(self)
        self.playoff_games = PlayoffGamesResource(self)
        self.standings = StandingsResource(self)
        self.playoffs = PlayoffsResource(self)
        self.super_bowls = SuperBowlsResource(self)
        self.history = HistoryResource(self)
        self.hall_of_fame = HallOfFameResource(self)
        self.contributors = ContributorsResource(self, "contributors")
        self.executives = ExecutivesResource(self, "executives")
        self.staff = StaffResource(self, "staff")
        self.coaches = CoachesResource(self, "coaches")
        self.assets = AssetsResource(self)
        self.all_star_games = AllStarGamesResource(self)
        self.stats = StatsResource(self)
        self.reference = ReferenceResource(self)


def create_client(**kwargs: Any) -> NFLMetaClient:
    return NFLMetaClient(**kwargs)


__all__ = [
    "APIResponse",
    "__version__",
    "FieldValue",
    "NFLMetaBadRequestError",
    "NFLMetaClient",
    "NFLMetaError",
    "NFLMetaInvalidUrlError",
    "NFLMetaNotFoundError",
    "NFLMetaRateLimitError",
    "NFLMetaTimeoutError",
    "NFLMetaUnauthorizedError",
    "RateLimitInfo",
    "create_client",
]
