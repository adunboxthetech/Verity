import unittest
from unittest.mock import patch

from api import core
from app import app


class ResultMetadataTests(unittest.TestCase):
    def test_status_labels_are_normalized_for_product_ui(self):
        cases = {
            "TRUE": ("verified", "Verified"),
            "FALSE": ("misleading", "Misleading"),
            "PARTIALLY TRUE": ("partly_true", "Partly true"),
            "INSUFFICIENT EVIDENCE": ("needs_more_evidence", "Needs more evidence"),
            "UNVERIFIABLE": ("unverifiable", "Unverifiable"),
        }

        for verdict, expected in cases.items():
            with self.subTest(verdict=verdict):
                self.assertEqual(core._status_from_verdict(verdict), expected)

    @patch.dict(
        "os.environ",
        {"Groq_api_key": "", "GROQ_API_KEY": "real-groq-key"},
        clear=True,
    )
    def test_env_lookup_ignores_empty_case_variant(self):
        self.assertEqual(core._get_env_var_insensitive("GROQ_API_KEY"), "real-groq-key")

    def test_enriched_results_include_evidence_metadata(self):
        results = [
            {
                "claim": "NASA launched Artemis I in 2022.",
                "result": {
                    "verdict": "TRUE",
                    "confidence": 88,
                    "explanation": "NASA records support the launch date.",
                    "sources": ["https://www.nasa.gov/example"],
                },
            }
        ]

        enriched = core._enrich_fact_check_results(results)
        result = enriched[0]["result"]

        self.assertEqual(result["status"], "verified")
        self.assertEqual(result["status_label"], "Verified")
        self.assertEqual(result["claim_domain"], "science")
        self.assertEqual(result["evidence"][0]["host"], "nasa.gov")
        self.assertIn("tier", result["evidence"][0])

    def test_claim_breakdown_summarizes_checked_claims(self):
        results = core._enrich_fact_check_results(
            [
                {
                    "claim": "A checked claim.",
                    "result": {
                        "verdict": "FALSE",
                        "confidence": 82,
                        "explanation": "Contradicted by evidence.",
                        "sources": ["https://example.com/report"],
                    },
                }
            ]
        )

        breakdown = core._build_claim_breakdown("text", results)

        self.assertEqual(breakdown["input_type"], "text")
        self.assertEqual(breakdown["total_checked"], 1)
        self.assertEqual(
            breakdown["checked_claims"][0]["status_label"], "Misleading"
        )

    @patch("api.core._get_checker")
    def test_text_endpoint_rejects_oversized_text_before_checker(self, get_checker):
        response, status = core.fact_check_text_input("x" * (core.MAX_TEXT_INPUT_CHARS + 1))

        self.assertEqual(status, 400)
        self.assertIn("too long", response["error"])
        get_checker.assert_not_called()

    def test_flask_rejects_oversized_json_body(self):
        client = app.test_client()
        response = client.post(
            "/api/fact-check",
            data="x" * (12 * 1024 * 1024 + 1),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 413)

    def test_groq_is_primary_even_when_web_search_requested(self):
        checker = core.FactChecker(api_key="gemini-key", groq_api_key="groq-key")
        calls = []

        def fake_groq(payload, use_vision=False):
            calls.append(("groq", payload, use_vision))
            return core.GeminiResponse(status_code=200, body="{}")

        def fake_gemini(payload):
            calls.append(("gemini", payload, False))
            return core.GeminiResponse(status_code=200, body="{}")

        checker._post_groq = fake_groq
        checker._post_gemini = fake_gemini

        response = checker._post_api({"messages": [], "use_web_search": True})

        self.assertEqual(response.status_code, 200)
        self.assertEqual([call[0] for call in calls], ["groq"])
        self.assertNotIn("use_web_search", calls[0][1])

    def test_groq_failure_falls_back_to_gemini(self):
        checker = core.FactChecker(api_key="gemini-key", groq_api_key="groq-key")
        calls = []

        def fake_groq(payload, use_vision=False):
            calls.append("groq")
            return core.GeminiResponse(status_code=429, body="rate limit")

        def fake_gemini(payload):
            calls.append("gemini")
            return core.GeminiResponse(status_code=200, body="{}")

        checker._post_groq = fake_groq
        checker._post_gemini = fake_gemini

        response = checker._post_api({"messages": [], "use_web_search": True})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(calls, ["groq", "gemini"])


if __name__ == "__main__":
    unittest.main()
