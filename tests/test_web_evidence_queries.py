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


if __name__ == "__main__":
    unittest.main()
