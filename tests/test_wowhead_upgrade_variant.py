"""Tests for generic Wowhead upgrade-rank variant discovery."""
import io
import json
import unittest
from unittest.mock import patch

from scripts import import_blizzard_data as importer


class WowheadUpgradeVariantTests(unittest.TestCase):
    def test_upgrade_rank_request_uses_wowhead_upgd_and_reads_explicit_level(self):
        payload = {
            "tooltip": {
                "html": "<table><tr><td>Item Level 340</td></tr>"
                        "<tr><td>+147 Haste</td></tr></table>"
            }
        }
        diagnostics = {
            "requestsSucceeded": 0, "usableStats": 0, "emptyTooltip": 0,
            "tooltipWithoutParsedStats": 0, "requestErrors": 0, "retries": 0,
            "responseShapes": {}, "explicitCosmeticItems": set(),
        }
        metadata = {}

        class Response:
            def __enter__(self):
                return self
            def __exit__(self, *args):
                return False
            def read(self):
                return json.dumps(payload).encode("utf-8")

        def fake_urlopen(request, timeout):
            self.assertIn("upgd=6", request.full_url)
            self.assertIn("/tooltip/item/12345?", request.full_url)
            return Response()

        with patch.object(importer, "throttled_urlopen", side_effect=fake_urlopen):
            stats = importer.fetch_wowhead_tooltip_stats(
                12345, diagnostics, upgrade_rank=6, variant_metadata=metadata
            )

        self.assertEqual(metadata["itemLevel"], 340)
        self.assertEqual(metadata["upgradeRank"], 6)
        self.assertEqual([(s["type"]["name"], s["value"]) for s in stats], [("haste", 147)])

    def test_upgrade_rank_does_not_guess_level_when_tooltip_omits_it(self):
        payload = {"tooltip": {"html": "<table><tr><td>+147 Haste</td></tr></table>"}}
        metadata = {}

        class Response:
            def __enter__(self):
                return self
            def __exit__(self, *args):
                return False
            def read(self):
                return json.dumps(payload).encode("utf-8")

        with patch.object(importer, "throttled_urlopen", return_value=Response()):
            stats = importer.fetch_wowhead_tooltip_stats(
                12345, upgrade_rank=6, variant_metadata=metadata
            )

        self.assertTrue(stats)
        self.assertIsNone(metadata["itemLevel"])
        self.assertEqual(metadata["upgradeRank"], 6)


if __name__ == "__main__":
    unittest.main()
