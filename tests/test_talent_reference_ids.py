import unittest

from scripts.import_blizzard_data import extract_talent_nodes, reference_id, talent_tree_reference_id


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


    def test_extracts_blizzard_talent_nodes_field(self):
        nodes = [
            {"id": 80938, "node_type": "single", "ranks": 1},
            {"id": 80942, "node_type": "choice", "ranks": 1},
        ]
        self.assertEqual(extract_talent_nodes({"talent_nodes": nodes}), nodes)

    def test_extracts_nodes_from_supported_wrappers(self):
        nodes = [{"id": 123, "ranks": 1}]
        self.assertEqual(
            extract_talent_nodes({"data": {"talent_tree": {"talent_nodes": nodes}}}),
            nodes,
        )
        self.assertEqual(extract_talent_nodes({"nodes": nodes}), nodes)

    def test_missing_talent_nodes_returns_empty_list(self):
        self.assertEqual(extract_talent_nodes({"id": 786, "name": "Shaman"}), [])

    def test_missing_tree_reference_returns_none(self):
        self.assertIsNone(talent_tree_reference_id({"name": "Missing reference"}))


if __name__ == "__main__":
    unittest.main()
