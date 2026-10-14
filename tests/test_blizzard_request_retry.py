import unittest
import urllib.error
from unittest.mock import MagicMock, patch

from scripts import import_blizzard_data as importer


class BlizzardRequestRetryTests(unittest.TestCase):
    def test_retry_logs_endpoint_without_query_string_and_uses_backoff(self):
        response = MagicMock()
        response.__enter__.return_value.read.return_value = b'{"ok": true}'
        with patch.object(importer.urllib.request, "urlopen", side_effect=[
            urllib.error.URLError("ssl handshake timeout"),
            urllib.error.URLError("temporary network failure"),
            response,
        ]) as urlopen, patch.object(importer.time, "sleep") as sleep, patch(
            "builtins.print"
        ) as printer:
            result = importer.request_json(
                "https://us.api.blizzard.com/data/wow/search/item?access_token=DO_NOT_LOG",
                headers={"Accept": "application/json"},
            )

        self.assertEqual(result, {"ok": True})
        self.assertEqual(urlopen.call_count, 3)
        self.assertEqual(urlopen.call_args.kwargs["timeout"], 20)
        self.assertEqual([call.args[0] for call in sleep.call_args_list], [1, 2])
        messages = "\n".join(str(call.args[0]) for call in printer.call_args_list)
        self.assertIn("us.api.blizzard.com/data/wow/search/item", messages)
        self.assertIn("attempt 1/3", messages)
        self.assertNotIn("DO_NOT_LOG", messages)

    def test_final_failure_names_endpoint_and_stops_after_bounded_retries(self):
        with patch.object(
            importer.urllib.request,
            "urlopen",
            side_effect=urllib.error.URLError("ssl handshake timeout"),
        ) as urlopen, patch.object(importer.time, "sleep"), patch(
            "builtins.print"
        ) as printer:
            with self.assertRaises(urllib.error.URLError):
                importer.request_json(
                    "https://us.api.blizzard.com/data/wow/item/123?namespace=static-us"
                )

        self.assertEqual(urlopen.call_count, importer.MAX_RETRIES)
        messages = "\n".join(str(call.args[0]) for call in printer.call_args_list)
        self.assertIn("failed after 3 attempts", messages)
        self.assertIn("us.api.blizzard.com/data/wow/item/123", messages)
        self.assertNotIn("namespace=static-us", messages)


if __name__ == "__main__":
    unittest.main()
