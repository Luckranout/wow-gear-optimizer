import json
import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
OBSERVATIONS_PATH = ROOT / "data" / "verified-item-effect-observations.json"


class VerifiedItemEffectObservationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with OBSERVATIONS_PATH.open(encoding="utf-8") as source:
            cls.data = json.load(source)

    def test_permafrost_essence_records_all_four_screenshot_observations(self):
        items = self.data["items"]
        self.assertEqual(len(items), 1)
        item = items[0]
        self.assertEqual(item["itemId"], 250244)
        observations = item["sourceObservations"]
        self.assertEqual(len(observations), 4)
        self.assertEqual(
            [entry["displayedTooltipItemLevel"] for entry in observations],
            [108, 214, 246, 334],
        )

    def test_observations_preserve_reported_values_without_inventing_scaling(self):
        item = self.data["items"][0]
        observations = item["sourceObservations"]
        self.assertEqual(
            [entry["criticalStrikePerMark"] for entry in observations],
            [28, 6, 6, 85],
        )
        self.assertEqual(
            [entry["frostBarrierAbsorptionPerMark"] for entry in observations],
            [6794, 714, 714, 73767],
        )
        self.assertTrue(any("scaling relationship is not established" in note
                            for note in item["unresolved"]))
        self.assertTrue(any("Do not interpolate or extrapolate" in note
                            for note in item["unresolved"]))

    def test_proc_rate_is_not_marked_independently_verified(self):
        observation = self.data["items"][0]["sourceObservations"][0]
        self.assertEqual(observation["reportedProcRatePPM"], 8)
        self.assertEqual(
            observation["procRateStatus"],
            "source-reported; not independently verified",
        )

    def test_conditional_effects_are_not_permanent_stats(self):
        policy = self.data["policy"].lower()
        self.assertIn("optimizer-ready simulation values", policy)
        self.assertTrue(any("not permanent static item stats" in note
                            for note in self.data["items"][0]["unresolved"]))


if __name__ == "__main__":
    unittest.main()
