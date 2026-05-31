import threading
import unittest
from unittest.mock import patch

from api import core


class WebSearchSpeedTests(unittest.TestCase):
    def test_search_engines_are_fanned_out_per_query(self):
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


if __name__ == "__main__":
    unittest.main()
