import threading
import unittest
from unittest.mock import patch

from api import core


class WebSearchSpeedTests(unittest.TestCase):
    def test_search_engines_are_fanned_out_per_query(self):
        core._SEARCH_CACHE.clear()
        started = []
        release = threading.Event()
        lock = threading.Lock()

        def fake_search(name):
            def _search(query, max_results):
                with lock:
                    started.append(name)
                    if len(started) == 3:
                        release.set()
                self.assertTrue(release.wait(timeout=1.0))
                return [
                    {
                        "url": f"https://{name}.example.com/report",
                        "title": name,
                        "snippet": query,
                    }
                ]

            return _search

        with (
            patch("api.core._search_duckduckgo_sources", fake_search("duckduckgo")),
            patch("api.core._search_bing_sources", fake_search("bing")),
            patch("api.core._search_yahoo_sources", fake_search("yahoo")),
        ):
            sources = core._search_web_sources("NASA Artemis launch", max_results=5)

        self.assertEqual(set(started), {"duckduckgo", "bing", "yahoo"})
        self.assertEqual(len(sources), 3)

    def test_search_results_are_cached_briefly(self):
        core._SEARCH_CACHE.clear()
        calls = []

        def fake_search(query, max_results):
            calls.append(query)
            return [
                {
                    "url": "https://www.nasa.gov/report",
                    "title": "NASA",
                    "snippet": query,
                }
            ]

        with (
            patch("api.core._search_duckduckgo_sources", fake_search),
            patch("api.core._search_bing_sources", lambda *_: []),
            patch("api.core._search_yahoo_sources", lambda *_: []),
        ):
            first = core._search_web_sources("NASA Artemis latest", max_results=5)
            second = core._search_web_sources("NASA Artemis latest", max_results=5)

        self.assertEqual(first, second)
        self.assertEqual(len(calls), 1)

    def test_cache_pruning_evicts_expired_and_oldest_entries(self):
        core._SEARCH_CACHE.clear()
        now = 1000.0
        original_max = core.SEARCH_CACHE_MAX_ITEMS
        try:
            core.SEARCH_CACHE_MAX_ITEMS = 2
            core._SEARCH_CACHE[("expired", 5)] = (
                now - core.SEARCH_CACHE_TTL_SECONDS - 1,
                [],
            )
            core._SEARCH_CACHE[("oldest", 5)] = (now - 3, [])
            core._SEARCH_CACHE[("middle", 5)] = (now - 2, [])
            core._SEARCH_CACHE[("newest", 5)] = (now - 1, [])

            core._prune_caches(now)

            self.assertNotIn(("expired", 5), core._SEARCH_CACHE)
            self.assertNotIn(("oldest", 5), core._SEARCH_CACHE)
            self.assertEqual(
                set(core._SEARCH_CACHE),
                {("middle", 5), ("newest", 5)},
            )
        finally:
            core.SEARCH_CACHE_MAX_ITEMS = original_max
            core._SEARCH_CACHE.clear()


if __name__ == "__main__":
    unittest.main()
