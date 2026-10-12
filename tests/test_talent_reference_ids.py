import unittest

from scripts.import_blizzard_data import reference_id, talent_tree_reference_id


class TalentReferenceIdTests(unittest.TestCase):
    def test_talent_tree_reference_does_not_return_trailing_spec_id(self):
        ref = {
            "key": {
                "href": "https://us.api.blizzard.com/data/wow/talent-tree/263/playable-specialization/267?namespace=static-us"
            }
        }
        self.assertEqual(talent_tree_reference_id(ref), 263)
        self.assertEqual(reference_id(ref), 267)

    def test_talent_tree_href_with_query_string(self):
        ref = {"href": "/data/wow/talent-tree/74?namespace=static-us"}
        self.assertEqual(talent_tree_reference_id(ref), 74)

    def test_explicit_tree_id_is_supported(self):
        self.assertEqual(talent_tree_reference_id({"id": 999}), 999)

    def test_integer_tree_reference_is_supported(self):
        self.assertEqual(talent_tree_reference_id(42), 42)

    def test_missing_tree_reference_returns_none(self):
        self.assertIsNone(talent_tree_reference_id({"name": "Missing reference"}))


if __name__ == "__main__":
    unittest.main()
