from __future__ import annotations

from typing import Any
from urllib.parse import quote

from .client import NFLMetaClientCore
from .types import APIResponse, QueryParams


def _segment(value: str | int) -> str:
    return quote(str(value), safe="")


def _api_path(*parts: str | int) -> str:
    return "/api/v1/" + "/".join(_segment(part) for part in parts)


class BaseResource:
    def __init__(self, client: NFLMetaClientCore) -> None:
        self.client = client

    def _request(self, path: str, query: QueryParams | None = None) -> APIResponse:
        return self.client.get(path, query=query)

    def _field(self, path: str, query: QueryParams | None = None) -> APIResponse:
        return self.client.get(path, query=query)


class HealthResource(BaseResource):
    def get(self) -> APIResponse:
        return self._request(_api_path("health"))


class LiveScoresResource(BaseResource):
    def get(self) -> APIResponse:
        return self._request(_api_path("live-scores"))


class UsageResource(BaseResource):
    def get(self) -> APIResponse:
        return self._request(_api_path("usage"))


class MetadataResource(BaseResource):
    def show(self) -> APIResponse:
        return self._request(_api_path("show"))


class SeasonsResource(BaseResource):
    def list(self, **query: Any) -> APIResponse:
        return self._request(_api_path("seasons"), query=query or None)

    def summary(self, year: int) -> APIResponse:
        return self._request(_api_path("season", year))

    def summary_field(self, year: int, field: str) -> APIResponse:
        return self._field(_api_path("season", year, field))

    def byes(self, year: int) -> APIResponse:
        return self._request(_api_path("byes", year))


class TeamsResource(BaseResource):
    def list(self, **query: Any) -> APIResponse:
        return self._request(_api_path("teams"), query=query or None)

    def get(self, abbr: str, **query: Any) -> APIResponse:
        return self._request(_api_path("teams", abbr), query=query or None)

    def recent_games(self, abbr: str, **query: Any) -> APIResponse:
        return self._request(_api_path("teams", abbr, "games"), query=query or None)

    def profile(self, abbr: str, **query: Any) -> APIResponse:
        return self._request(_api_path("teams", abbr, "profile"), query=query or None)

    def profile_field(self, abbr: str, field: str, **query: Any) -> APIResponse:
        return self._field(_api_path("teams", abbr, "profile", field), query=query or None)

    def identity(self, abbr: str) -> APIResponse:
        return self._request(_api_path("teams", abbr, "identity"))

    def identity_field(self, abbr: str, field: str) -> APIResponse:
        return self._field(_api_path("teams", abbr, "identity", field))

    def season(self, abbr: str, **query: Any) -> APIResponse:
        return self._request(_api_path("teams", abbr, "season"), query=query or None)

    def season_field(self, abbr: str, field: str, **query: Any) -> APIResponse:
        return self._field(_api_path("teams", abbr, "season", field), query=query or None)

    def stats(self, abbr: str, **query: Any) -> APIResponse:
        return self._request(_api_path("teams", abbr, "stats"), query=query or None)

    def stats_field(self, abbr: str, field: str, **query: Any) -> APIResponse:
        return self._field(_api_path("teams", abbr, "stats", field), query=query or None)

    def power_rankings(self, abbr: str, **query: Any) -> APIResponse:
        return self._request(_api_path("teams", abbr, "power-rankings"), query=query or None)

    def power_rankings_field(self, abbr: str, field: str, **query: Any) -> APIResponse:
        return self._field(_api_path("teams", abbr, "power-rankings", field), query=query or None)

    def stadium(self, abbr: str, **query: Any) -> APIResponse:
        return self._request(_api_path("teams", abbr, "stadium"), query=query or None)

    def stadium_field(self, abbr: str, field: str, **query: Any) -> APIResponse:
        return self._field(_api_path("teams", abbr, "stadium", field), query=query or None)

    def pro_bowl(self, abbr: str, **query: Any) -> APIResponse:
        return self._request(_api_path("teams", abbr, "pro-bowl"), query=query or None)

    def pro_bowl_field(self, abbr: str, field: str, **query: Any) -> APIResponse:
        return self._field(_api_path("teams", abbr, "pro-bowl", field), query=query or None)


class PlayersResource(BaseResource):
    def list(self, **query: Any) -> APIResponse:
        return self._request(_api_path("players"), query=query or None)

    def get(self, player_key: str) -> APIResponse:
        return self._request(_api_path("players", player_key))

    def identity(self, player_key: str) -> APIResponse:
        return self._request(_api_path("players", player_key, "identity"))

    def identity_field(self, player_key: str, field: str) -> APIResponse:
        return self._field(_api_path("players", player_key, "identity", field))

    def bio(self, player_key: str) -> APIResponse:
        return self._request(_api_path("players", player_key, "bio"))

    def bio_field(self, player_key: str, field: str) -> APIResponse:
        return self._field(_api_path("players", player_key, "bio", field))

    def ids(self, player_key: str) -> APIResponse:
        return self._request(_api_path("players", player_key, "ids"))

    def ids_field(self, player_key: str, field: str) -> APIResponse:
        return self._field(_api_path("players", player_key, "ids", field))

    def history(self, player_key: str) -> APIResponse:
        return self._request(_api_path("players", player_key, "history"))

    def history_field(self, player_key: str, field: str) -> APIResponse:
        return self._field(_api_path("players", player_key, "history", field))

    def honors(self, player_key: str) -> APIResponse:
        return self._request(_api_path("players", player_key, "honors"))

    def honors_field(self, player_key: str, field: str) -> APIResponse:
        return self._field(_api_path("players", player_key, "honors", field))

    def roster(self, player_key: str) -> APIResponse:
        return self._request(_api_path("players", player_key, "roster"))

    def games(self, player_key: str, **query: Any) -> APIResponse:
        return self._request(_api_path("players", player_key, "games"), query=query or None)

    def career(self, player_key: str) -> APIResponse:
        return self._request(_api_path("players", player_key, "career"))

    def career_field(self, player_key: str, field: str) -> APIResponse:
        return self._field(_api_path("players", player_key, "career", field))

    def career_seasons(self, player_key: str, **query: Any) -> APIResponse:
        return self._request(_api_path("players", player_key, "career", "seasons"), query=query or None)

    def splits(self, player_key: str, **query: Any) -> APIResponse:
        return self._request(_api_path("players", player_key, "splits"), query=query or None)

    def splits_field(self, player_key: str, field: str, **query: Any) -> APIResponse:
        return self._field(_api_path("players", player_key, "splits", field), query=query or None)

    def records(self, player_key: str, **query: Any) -> APIResponse:
        return self._request(_api_path("players", player_key, "records"), query=query or None)

    def records_field(self, player_key: str, field: str, **query: Any) -> APIResponse:
        return self._field(_api_path("players", player_key, "records", field), query=query or None)

    def kicking(self, player_key: str) -> APIResponse:
        return self._request(_api_path("players", player_key, "kicking"))

    def kicking_season(self, player_key: str, season_year: int) -> APIResponse:
        return self._request(_api_path("players", player_key, "kicking", season_year))

    def kicking_season_field(self, player_key: str, season_year: int, field: str) -> APIResponse:
        return self._field(_api_path("players", player_key, "kicking", season_year, field))

    def punting(self, player_key: str) -> APIResponse:
        return self._request(_api_path("players", player_key, "punting"))

    def punting_season(self, player_key: str, season_year: int) -> APIResponse:
        return self._request(_api_path("players", player_key, "punting", season_year))

    def punting_season_field(self, player_key: str, season_year: int, field: str) -> APIResponse:
        return self._field(_api_path("players", player_key, "punting", season_year, field))


class GamesResource(BaseResource):
    def list(self, **query: Any) -> APIResponse:
        return self._request(_api_path("games"), query=query or None)

    def get(self, game_id: int) -> APIResponse:
        return self._request(_api_path("games", game_id))

    def field(self, game_id: int, field: str) -> APIResponse:
        return self._field(_api_path("games", game_id, field))

    def extras(self, game_id: int) -> APIResponse:
        return self._request(_api_path("games", game_id, "extras"))


class PlaysResource(BaseResource):
    """Play-by-play.

    ``list`` is metered per play and the API refuses an unnarrowed request with
    400: pass ``game_id``, or ``player``, or ``season`` together with one of
    ``week``, ``team`` or ``opponent``. ``summary`` and ``leaders`` answer
    season-wide questions server-side in tens of rows, which is what most
    callers actually want.
    """

    def list(self, **query: Any) -> APIResponse:
        return self._request(_api_path("plays"), query=query or None)

    def summary(self, **query: Any) -> APIResponse:
        return self._request(_api_path("plays", "summary"), query=query or None)

    def leaders(self, **query: Any) -> APIResponse:
        return self._request(_api_path("plays", "leaders"), query=query or None)


class PlayoffGamesResource(BaseResource):
    def get(self, game_id: int) -> APIResponse:
        return self._request(_api_path("playoff-games", game_id))

    def field(self, game_id: int, field: str) -> APIResponse:
        return self._field(_api_path("playoff-games", game_id, field))

    def extras(self, game_id: int) -> APIResponse:
        return self._request(_api_path("playoff-games", game_id, "extras"))

    def supplemental(self, game_id: int) -> APIResponse:
        return self._request(_api_path("playoff-games", game_id, "supplemental"))


class StandingsResource(BaseResource):
    def get(self, **query: Any) -> APIResponse:
        return self._request(_api_path("standings"), query=query or None)


class PlayoffsResource(BaseResource):
    def picture(self, **query: Any) -> APIResponse:
        return self._request(_api_path("playoffs", "picture"), query=query or None)


class SuperBowlsResource(BaseResource):
    def list(self, **query: Any) -> APIResponse:
        return self._request(_api_path("super-bowls"), query=query or None)

    def by_season(self, season_year: int) -> APIResponse:
        return self._request(_api_path("super-bowls", season_year))

    def by_team(self, abbr: str) -> APIResponse:
        return self._request(_api_path("super-bowls", "teams", abbr))


class HistoryResource(BaseResource):
    def officials(self, **query: Any) -> APIResponse:
        return self._request(_api_path("history", "officials"), query=query or None)

    def stadiums(self, **query: Any) -> APIResponse:
        return self._request(_api_path("history", "stadiums"), query=query or None)

    def team_logos(self, **query: Any) -> APIResponse:
        return self._request(_api_path("history", "team-logos"), query=query or None)

    def venues(self, **query: Any) -> APIResponse:
        return self._request(_api_path("history", "venues"), query=query or None)


class HallOfFameResource(BaseResource):
    def list(self, **query: Any) -> APIResponse:
        return self._request(_api_path("hall-of-fame"), query=query or None)

    def election(self, year: int) -> APIResponse:
        return self._request(_api_path("hall-of-fame", year))

    def election_field(self, year: int, field: str) -> APIResponse:
        return self._field(_api_path("hall-of-fame", year, field))


class _PeopleResource(BaseResource):
    def __init__(self, client: NFLMetaClientCore, *base_segments: str) -> None:
        super().__init__(client)
        self.base_segments = base_segments

    def _resource_path(self, key: str, *suffix: str | int) -> str:
        return _api_path(*self.base_segments, key, *suffix)

    def get(self, key: str) -> APIResponse:
        return self._request(self._resource_path(key))

    def identity(self, key: str) -> APIResponse:
        return self._request(self._resource_path(key, "identity"))

    def identity_field(self, key: str, field: str) -> APIResponse:
        return self._field(self._resource_path(key, "identity", field))

    def bio(self, key: str) -> APIResponse:
        return self._request(self._resource_path(key, "bio"))

    def bio_field(self, key: str, field: str) -> APIResponse:
        return self._field(self._resource_path(key, "bio", field))

    def history(self, key: str) -> APIResponse:
        return self._request(self._resource_path(key, "history"))

    def history_field(self, key: str, field: str) -> APIResponse:
        return self._field(self._resource_path(key, "history", field))


class ContributorsResource(_PeopleResource):
    def list(self, **query: Any) -> APIResponse:
        return self._request(_api_path("contributors"), query=query or None)


class ExecutivesResource(_PeopleResource):
    def list(self, **query: Any) -> APIResponse:
        return self._request(_api_path("executives"), query=query or None)

    def career(self, key: str) -> APIResponse:
        return self._request(self._resource_path(key, "career"))

    def career_field(self, key: str, field: str) -> APIResponse:
        return self._field(self._resource_path(key, "career", field))


class StaffResource(_PeopleResource):
    def list(self, **query: Any) -> APIResponse:
        return self._request(_api_path("staff"), query=query or None)

    def career(self, key: str) -> APIResponse:
        return self._request(self._resource_path(key, "career"))

    def career_field(self, key: str, field: str) -> APIResponse:
        return self._field(self._resource_path(key, "career", field))


class CoachesResource(_PeopleResource):
    def list(self, **query: Any) -> APIResponse:
        return self._request(_api_path("coaches"), query=query or None)

    def career(self, key: str) -> APIResponse:
        return self._request(self._resource_path(key, "career"))

    def career_field(self, key: str, field: str) -> APIResponse:
        return self._field(self._resource_path(key, "career", field))


class AssetsResource(BaseResource):
    def logos(self, **query: Any) -> APIResponse:
        return self._request(_api_path("assets", "logos"), query=query or None)

    def images(self, **query: Any) -> APIResponse:
        return self._request(_api_path("assets", "images"), query=query or None)


class AllStarGamesResource(BaseResource):
    def list(self, **query: Any) -> APIResponse:
        return self._request(_api_path("all-star-games"), query=query or None)


class StatsPlayersResource(BaseResource):
    def catalog(self, **query: Any) -> APIResponse:
        return self._request(_api_path("stats", "players", "catalog"), query=query or None)

    def search(self, **query: Any) -> APIResponse:
        return self._request(_api_path("stats", "players", "search"), query=query or None)

    def compare(self, **query: Any) -> APIResponse:
        return self._request(_api_path("stats", "players", "compare"), query=query or None)

    def seasons(self, **query: Any) -> APIResponse:
        return self._request(_api_path("stats", "players", "seasons"), query=query or None)

    def seasons_by_stat(self, season_year: int, stat: str, **query: Any) -> APIResponse:
        return self._request(_api_path("stats", "players", "seasons", season_year, stat), query=query or None)

    def careers(self, **query: Any) -> APIResponse:
        return self._request(_api_path("stats", "players", "careers"), query=query or None)

    def careers_by_stat(self, stat: str, **query: Any) -> APIResponse:
        return self._request(_api_path("stats", "players", "careers", stat), query=query or None)

    def games(self, **query: Any) -> APIResponse:
        return self._request(_api_path("stats", "players", "games"), query=query or None)

    def game_splits(self, **query: Any) -> APIResponse:
        return self._request(_api_path("stats", "players", "games", "splits"), query=query or None)

    def game_leaders_by_family(self, stat_family: str, **query: Any) -> APIResponse:
        return self._request(_api_path("stats", "players", "games", "leaders", stat_family), query=query or None)

    def teams(self, **query: Any) -> APIResponse:
        return self._request(_api_path("stats", "players", "teams"), query=query or None)

    def weeks(self, season_year: int, **query: Any) -> APIResponse:
        return self._request(_api_path("stats", "players", "season", season_year, "weeks"), query=query or None)


class StatsResource:
    def __init__(self, client: NFLMetaClientCore) -> None:
        self.players = StatsPlayersResource(client)


class ReferenceResource(BaseResource):
    def all_star_games(self, **query: Any) -> APIResponse:
        return self._request(_api_path("reference", "all-star-games"), query=query or None)

    def coaches(self, **query: Any) -> APIResponse:
        return self._request(_api_path("reference", "coaches"), query=query or None)

    def coach(self, key: str) -> APIResponse:
        return self._request(_api_path("reference", "coaches", key))

    def coach_field(self, key: str, field: str) -> APIResponse:
        return self._field(_api_path("reference", "coaches", key, field))

    def officials(self, **query: Any) -> APIResponse:
        return self._request(_api_path("reference", "officials"), query=query or None)

    def official(self, key: str) -> APIResponse:
        return self._request(_api_path("reference", "officials", key))

    def official_field(self, key: str, field: str) -> APIResponse:
        return self._field(_api_path("reference", "officials", key, field))

    def power_rankings(self, **query: Any) -> APIResponse:
        return self._request(_api_path("reference", "power-rankings"), query=query or None)

    def pro_bowl_player_bios(self, **query: Any) -> APIResponse:
        return self._request(_api_path("reference", "pro-bowl-player-bios"), query=query or None)

    def pro_bowl_player_stats(self, **query: Any) -> APIResponse:
        return self._request(_api_path("reference", "pro-bowl-player-stats"), query=query or None)

    def pro_bowl_selections(self, **query: Any) -> APIResponse:
        return self._request(_api_path("reference", "pro-bowl-selections"), query=query or None)

    def seasons(self, **query: Any) -> APIResponse:
        return self._request(_api_path("reference", "seasons"), query=query or None)

    def stadium_histories(self, **query: Any) -> APIResponse:
        return self._request(_api_path("reference", "stadium-histories"), query=query or None)

    def stadiums(self, **query: Any) -> APIResponse:
        return self._request(_api_path("reference", "stadiums"), query=query or None)

    def team_aliases(self, **query: Any) -> APIResponse:
        return self._request(_api_path("reference", "team-aliases"), query=query or None)

    def team_coaches(self, **query: Any) -> APIResponse:
        return self._request(_api_path("reference", "team-coaches"), query=query or None)

    def team_colors(self, **query: Any) -> APIResponse:
        return self._request(_api_path("reference", "team-colors"), query=query or None)

    def team_logo_histories(self, **query: Any) -> APIResponse:
        return self._request(_api_path("reference", "team-logo-histories"), query=query or None)

    def team_name_histories(self, **query: Any) -> APIResponse:
        return self._request(_api_path("reference", "team-name-histories"), query=query or None)

    def team_season_records(self, **query: Any) -> APIResponse:
        return self._request(_api_path("reference", "team-season-records"), query=query or None)

    def team_season_stats(self, **query: Any) -> APIResponse:
        return self._request(_api_path("reference", "team-season-stats"), query=query or None)

    def teams(self, **query: Any) -> APIResponse:
        return self._request(_api_path("reference", "teams"), query=query or None)

    def venues(self, **query: Any) -> APIResponse:
        return self._request(_api_path("reference", "venues"), query=query or None)

    def venue(self, key: str) -> APIResponse:
        return self._request(_api_path("reference", "venues", key))

    def venue_field(self, key: str, field: str) -> APIResponse:
        return self._field(_api_path("reference", "venues", key, field))
