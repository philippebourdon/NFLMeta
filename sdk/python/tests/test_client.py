from __future__ import annotations

import unittest
from io import BytesIO
from urllib.error import HTTPError
from urllib.request import Request

from nflmeta import (
    NFLMetaBadRequestError,
    NFLMetaClient,
    NFLMetaInvalidUrlError,
    NFLMetaUnauthorizedError,
)
from nflmeta.client import NFLMetaClientCore, TransportResponse, _default_transport


class NFLMetaClientTests(unittest.TestCase):
    def test_adds_api_key_and_parses_rate_limits(self) -> None:
        captured: dict[str, object] = {}

        def transport(url: str, headers, timeout):
            captured["url"] = url
            captured["headers"] = dict(headers)
            captured["timeout"] = timeout
            return TransportResponse(
                status=200,
                headers={
                    "X-RateLimit-Limit": "1000",
                    "X-RateLimit-Remaining": "999",
                    "X-RateLimit-Reset": "2026-04-01T00:00:00.000Z",
                    "X-RateLimit-Policy": "monthly",
                },
                payload={
                    "data": [{"year": 2025, "id": 57}],
                    "meta": {"total": 1, "returned": 1},
                },
            )

        client = NFLMetaClient(api_key="test-key", transport=transport)
        result = client.seasons.list(year_from=2025, limit=1)

        self.assertEqual(captured["headers"]["X-NFLMeta-Key"], "test-key")
        self.assertTrue(str(captured["url"]).endswith("/api/v1/seasons?year_from=2025&limit=1"))
        self.assertEqual(result.rate_limit.limit, 1000)
        self.assertEqual(result.rate_limit.remaining, 999)
        self.assertEqual(result.data[0]["year"], 2025)

    def test_raises_typed_unauthorized_errors(self) -> None:
        def transport(_url: str, _headers, _timeout):
            return TransportResponse(
                status=401,
                headers={},
                payload={"error": {"code": "unauthorized", "message": "invalid api key"}},
            )

        client = NFLMetaClient(transport=transport)

        with self.assertRaises(NFLMetaUnauthorizedError) as ctx:
            client.usage.get()

        self.assertEqual(ctx.exception.status, 401)
        self.assertEqual(ctx.exception.code, "unauthorized")

    def test_builds_nested_resource_paths(self) -> None:
        captured: dict[str, object] = {}

        def transport(url: str, _headers, _timeout):
            captured["url"] = url
            return TransportResponse(
                status=200,
                headers={},
                payload={"data": {"field": "pass_passer_rating", "value": 99.4}},
            )

        client = NFLMetaClient(transport=transport)
        result = client.players.career_field("josh-allen-1996", "pass_passer_rating")

        self.assertTrue(str(captured["url"]).endswith("/api/v1/players/josh-allen-1996/career/pass_passer_rating"))
        self.assertEqual(result.data["value"], 99.4)

    def test_coach_history_field_uses_the_implemented_field_route(self) -> None:
        captured: dict[str, object] = {}

        def transport(url: str, _headers, _timeout):
            captured["url"] = url
            return TransportResponse(
                status=200,
                headers={},
                payload={
                    "data": {
                        "field": "team_records",
                        "value": [{"team_abbr": "PIT", "wins": 183}],
                    }
                },
            )

        result = NFLMetaClient(transport=transport).coaches.history_field("mike-tomlin", "team_records")

        self.assertTrue(str(captured["url"]).endswith("/api/v1/coaches/mike-tomlin/history/team_records"))
        self.assertEqual(result.data["value"][0]["team_abbr"], "PIT")

    def test_live_scores_use_the_supported_v1_resource(self) -> None:
        captured: dict[str, object] = {}

        def transport(url: str, _headers, _timeout):
            captured["url"] = url
            return TransportResponse(
                status=200,
                headers={},
                payload={
                    "data": [{"game_id": 42, "phase": "in"}],
                    "meta": {
                        "available": True,
                        "stale": False,
                        "recommended_poll_seconds": 10,
                        "target_delay_seconds": 20,
                        "service_level": "best_effort",
                    },
                },
            )

        result = NFLMetaClient(api_key="free-key", transport=transport).live_scores.get()

        self.assertTrue(str(captured["url"]).endswith("/api/v1/live-scores"))
        self.assertEqual(result.data[0]["game_id"], 42)
        self.assertEqual(result.meta["service_level"], "best_effort")

    def test_plays_resource_builds_the_three_play_routes(self) -> None:
        requested: list[str] = []

        def transport(url: str, _headers, _timeout):
            requested.append(url)
            return TransportResponse(status=200, headers={}, payload={"data": [], "meta": {"returned": 0}})

        client = NFLMetaClient(transport=transport)
        client.plays.list(game_id=21390, skip_markers=True, limit=5)
        client.plays.summary(season=2024, group_by="team", season_type="REG")
        client.plays.leaders(season=2024, role="passer", min_plays=300)

        self.assertTrue(requested[0].endswith("/api/v1/plays?game_id=21390&skip_markers=true&limit=5"))
        self.assertTrue(requested[1].endswith("/api/v1/plays/summary?season=2024&group_by=team&season_type=REG"))
        self.assertTrue(requested[2].endswith("/api/v1/plays/leaders?season=2024&role=passer&min_plays=300"))

    def test_plays_list_surfaces_narrowing_filter_refusal(self) -> None:
        # /api/v1/plays answers 400 rather than serving an arbitrary page out of
        # 1.28 million rows. The SDK has to turn that into something a caller
        # can branch on, not a generic failure.
        def transport(_url: str, _headers, _timeout):
            return TransportResponse(
                status=400,
                headers={},
                payload={
                    "error": {
                        "code": "invalid_request",
                        "message": (
                            "a narrowing filter is required: pass game_id, or player, "
                            "or season with one of week, team, or opponent."
                        ),
                    }
                },
            )

        client = NFLMetaClient(transport=transport)

        with self.assertRaises(NFLMetaBadRequestError) as ctx:
            client.plays.list()

        self.assertEqual(ctx.exception.status, 400)
        self.assertEqual(ctx.exception.code, "invalid_request")
        self.assertIn("narrowing filter", str(ctx.exception))

    def test_plays_summary_returns_rows_with_rate_basis(self) -> None:
        def transport(_url: str, _headers, _timeout):
            return TransportResponse(
                status=200,
                headers={},
                payload={
                    "data": [
                        {
                            "group_key": "ARI",
                            "plays": 1369,
                            "scrimmage_plays": 1031,
                            "epa_per_play": 0.0671,
                            "success_rate": 0.4733,
                        }
                    ],
                    "meta": {"group_by": "team", "rate_basis": "scrimmage_plays", "returned": 1},
                },
            )

        client = NFLMetaClient(transport=transport)
        result = client.plays.summary(season=2024, group_by="team")

        self.assertEqual(result.data[0]["group_key"], "ARI")
        self.assertEqual(result.data[0]["scrimmage_plays"], 1031)
        self.assertEqual(result.meta["rate_basis"], "scrimmage_plays")

    def test_default_transport_normalizes_http_errors(self) -> None:
        request = Request("https://nflmeta.org/api/v1/usage", method="GET")
        http_error = HTTPError(
            request.full_url,
            401,
            "Unauthorized",
            hdrs={"Content-Type": "application/json"},
            fp=BytesIO(b'{"error":{"code":"unauthorized","message":"invalid api key"}}'),
        )

        # The transport opens through _OPENER rather than urlopen, because the
        # default opener follows a cross-origin redirect and re-sends every
        # header, key included. Patch the same thing the transport uses.
        class FakeOpener:
            def open(self, _request, timeout=None):
                raise http_error

        from nflmeta import client as client_module

        original_opener = client_module._OPENER
        client_module._OPENER = FakeOpener()
        try:
            response = _default_transport(request.full_url, {}, 10.0)
        finally:
            client_module._OPENER = original_opener

        self.assertEqual(response.status, 401)
        self.assertEqual(response.payload["error"]["code"], "unauthorized")


if __name__ == "__main__":
    unittest.main()


class CredentialBoundaryTests(unittest.TestCase):
    """The key must not leave the configured origin.

    get() used to accept any absolute http(s) URL and then attach X-NFLMeta-Key
    to it unconditionally, so an application passing a user-controlled or
    mistakenly absolute URL handed its key to whatever host was named.

    Two separate escapes are pinned, because closing one leaves the other open:
    the request URL, and a redirect. urllib forwards every request header across
    a cross-origin redirect -- X-NFLMeta-Key and Authorization both, which is
    worse than Node's fetch, which at least strips Authorization.
    """

    def _client(self, transport):
        return NFLMetaClientCore(api_key="nflmeta_secret", transport=transport)

    def test_cross_origin_url_is_refused_before_headers_are_built(self) -> None:
        called = []

        def transport(url, headers, timeout):
            called.append(url)
            return TransportResponse(status=200, headers={}, payload={"data": []})

        client = self._client(transport)
        for target in (
            "https://attacker.invalid/collect",
            "http://attacker.invalid/collect",
            "https://nflmeta.org.attacker.invalid/api/v1/players",
        ):
            with self.assertRaises(NFLMetaInvalidUrlError, msg=f"{target} was not refused"):
                client.get(target)

        self.assertEqual(called, [], "the transport ran -- the check is in the wrong place")

    def test_same_origin_absolute_url_still_works(self) -> None:
        seen = {}

        def transport(url, headers, timeout):
            seen["url"] = url
            return TransportResponse(status=200, headers={}, payload={"data": [], "meta": {}})

        self._client(transport).get("https://nflmeta.org/api/v1/players")
        self.assertEqual(seen["url"], "https://nflmeta.org/api/v1/players")

    def test_path_outside_api_v1_is_refused(self) -> None:
        def transport(url, headers, timeout):
            raise AssertionError("transport must not run")

        with self.assertRaises(NFLMetaInvalidUrlError):
            self._client(transport).get("/admin/api")

    def test_cross_origin_redirect_does_not_carry_the_key(self) -> None:
        """Driven against two real local servers, because this is transport behaviour.

        A mocked transport cannot show it: the leak happens inside urllib, after
        the client has handed over the request.
        """
        import http.server
        import threading

        received = {}

        class Collector(http.server.BaseHTTPRequestHandler):
            def do_GET(self):  # noqa: N802
                received.update({k.lower(): v for k, v in self.headers.items()})
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"data":[]}')

            def log_message(self, *args):  # noqa: D102
                pass

        collector = http.server.HTTPServer(("127.0.0.1", 0), Collector)
        threading.Thread(target=collector.serve_forever, daemon=True).start()
        collector_port = collector.server_address[1]

        class Redirector(http.server.BaseHTTPRequestHandler):
            def do_GET(self):  # noqa: N802
                self.send_response(302)
                self.send_header("Location", f"http://127.0.0.1:{collector_port}/collect")
                self.end_headers()

            def log_message(self, *args):  # noqa: D102
                pass

        redirector = http.server.HTTPServer(("127.0.0.1", 0), Redirector)
        threading.Thread(target=redirector.serve_forever, daemon=True).start()
        redirector_port = redirector.server_address[1]

        try:
            client = NFLMetaClientCore(
                api_key="nflmeta_leak_probe",
                base_url=f"http://127.0.0.1:{redirector_port}",
            )
            with self.assertRaises(NFLMetaInvalidUrlError):
                client.get("/api/v1/players")
            self.assertEqual(
                received.get("x-nflmeta-key"),
                None,
                "the API key reached the redirect target",
            )
        finally:
            for server in (collector, redirector):
                server.shutdown()
                server.server_close()

    def test_same_origin_redirect_is_still_followed(self) -> None:
        import http.server
        import threading

        paths = []

        class Server(http.server.BaseHTTPRequestHandler):
            def do_GET(self):  # noqa: N802
                paths.append(self.path)
                if self.path.endswith("/"):
                    self.send_response(308)
                    self.send_header("Location", "/api/v1/players")
                    self.end_headers()
                    return
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"data":[],"meta":{}}')

            def log_message(self, *args):  # noqa: D102
                pass

        server = http.server.HTTPServer(("127.0.0.1", 0), Server)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        try:
            client = NFLMetaClientCore(
                api_key="nflmeta_secret",
                base_url=f"http://127.0.0.1:{server.server_address[1]}",
            )
            client.get("/api/v1/players/")
            self.assertEqual(paths, ["/api/v1/players/", "/api/v1/players"])
        finally:
            server.shutdown()
            server.server_close()
