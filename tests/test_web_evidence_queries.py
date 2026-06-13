import datetime
import unittest

from api import core


class WebEvidenceQueryTests(unittest.TestCase):
    def test_scheme_form_claim_gets_current_application_queries(self):
        claim = "Annapurna Bhandar online form fillup started"
        year = datetime.date.today().year

        queries = core._build_search_queries_for_claim(claim)

        self.assertEqual(core._classify_claim_domain(claim), "government_policy")
        self.assertIn("Annapurna Bhandar form fill up started today news", queries)
        self.assertIn("Annapurna Bhandar forms issued today news", queries)
        self.assertIn(f"Annapurna Bhandar apply online latest news {year}", queries)
        self.assertLessEqual(len(queries), core.MAX_SEARCH_QUERY_VARIANTS)

    def test_indian_news_sources_are_treated_as_reputable(self):
        score, tier, _ = core._source_authority_score(
            "https://www.livemint.com/news/india/example.html",
            "government_policy",
        )

        self.assertEqual(tier, "reputable")
        self.assertGreaterEqual(score, 60)

    def test_latest_claim_gets_recency_and_primary_source_queries(self):
        claim = "The FDA announced a new vaccine warning today"
        queries = core._build_search_queries_for_claim(claim)

        self.assertTrue(any("site:fda.gov" in query for query in queries))
        self.assertTrue(any("after:" in query for query in queries))

    def test_publication_date_is_extracted_from_article_metadata(self):
        soup = core.BeautifulSoup(
            '<html><head><meta property="article:published_time" content="2026-06-12T08:30:00Z"></head></html>',
            "lxml",
        )

        self.assertEqual(core._extract_publication_date(soup, []), "2026-06-12")

    def test_date_hint_handles_url_paths_and_news_snippets(self):
        self.assertEqual(
            core._extract_date_hint("https://example.com/news/2026/03/30/story"),
            "2026-03-30",
        )
        self.assertEqual(
            core._extract_date_hint("The update was published on 16 November 2022."),
            "2022-11-16",
        )


if __name__ == "__main__":
    unittest.main()
