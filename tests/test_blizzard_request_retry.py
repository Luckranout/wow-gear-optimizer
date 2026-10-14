import unittest
import tempfile
import os
import urllib.error
from email.message import Message
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

    def test_http_429_honors_retry_after_header(self):
        headers = Message()
        headers["Retry-After"] = "7"
        rate_limited = urllib.error.HTTPError(
            "https://us.api.blizzard.com/data/wow/item/123",
            429,
            "Too Many Requests",
            headers,
            None,
        )
        response = MagicMock()
        response.__enter__.return_value.read.return_value = b'{"id": 123}'
        with patch.object(importer.urllib.request, "urlopen", side_effect=[rate_limited, response]) as urlopen, patch.object(
            importer.time, "sleep"
        ) as sleep, patch("builtins.print"):
            payload = importer.request_json(
                "https://us.api.blizzard.com/data/wow/item/123?namespace=static-us"
            )

        self.assertEqual(payload, {"id": 123})
        self.assertEqual(urlopen.call_count, 2)
        sleep.assert_called_once_with(7.0)

    def test_item_response_cache_reuses_successful_item_detail(self):
        with tempfile.TemporaryDirectory() as directory:
            cache_path = os.path.join(directory, "cache.sqlite3")
            response = MagicMock()
            response.__enter__.return_value.read.return_value = b'{"id": 123, "name": "Test Item"}'
            url = "https://us.api.blizzard.com/data/wow/item/123?namespace=static-us&locale=en_US"
            with patch.object(importer, "ITEM_CACHE_PATH", cache_path), patch.object(
                importer.urllib.request, "urlopen", return_value=response
            ) as urlopen, patch.object(importer, "REQUEST_INTERVAL_SECONDS", 0):
                first = importer.request_json(url)
                second = importer.request_json(url)

            self.assertEqual(first, {"id": 123, "name": "Test Item"})
            self.assertEqual(second, first)
            urlopen.assert_called_once()

    def test_retry_after_http_date_is_parsed(self):
        headers = Message()
        headers["Retry-After"] = "Wed, 21 Oct 2015 07:28:00 GMT"
        error = urllib.error.HTTPError("https://example.test", 429, "limited", headers, None)
        with patch.object(importer.datetime, "now", return_value=importer.datetime(2015, 10, 21, 7, 27, 50, tzinfo=importer.timezone.utc)):
            self.assertEqual(importer._retry_after_seconds(error), 10.0)

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
