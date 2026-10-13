from unittest import TestCase

from userdata import genre_families as gf
from userdata.tmdb_client import STATIC_GENRE_NAMES


class GenreFamilyTests(TestCase):
    def test_every_known_genre_has_a_family(self):
        for gid in STATIC_GENRE_NAMES:
            with self.subTest(gid=gid):
                self.assertIn(gid, gf.FAMILY_OF)

    def test_movie_genre_and_its_tv_counterpart_share_a_family(self):
        self.assertEqual(gf.FAMILY_OF[28], gf.FAMILY_OF[10759])
        self.assertEqual(gf.FAMILY_OF[12], gf.FAMILY_OF[10759])
        self.assertEqual(gf.FAMILY_OF[878], gf.FAMILY_OF[10765])
        self.assertEqual(gf.FAMILY_OF[10752], gf.FAMILY_OF[10768])
        self.assertNotEqual(gf.FAMILY_OF[28], gf.FAMILY_OF[18])

    def test_a_title_counts_once_per_family(self):
        self.assertEqual(gf.families([28, 12, 18]), ["action-adventure", "18"])

    def test_one_family_ors_its_ids(self):
        self.assertEqual(gf.with_genres("movie", ["action-adventure"]), "28|12")
        self.assertEqual(gf.with_genres("tv", ["action-adventure"]), "10759")
        self.assertEqual(gf.with_genres("tv", ["18"]), "18")

    def test_several_families_and_their_primary_ids(self):
        self.assertEqual(gf.with_genres("movie", ["action-adventure", "18"]), "28,18")
        self.assertEqual(gf.with_genres("tv", ["action-adventure", "18"]), "10759,18")

    def test_a_type_without_the_genre_is_not_queried(self):
        self.assertIsNone(gf.with_genres("tv", ["27"]))  # Horror: movies only
        self.assertIsNone(gf.with_genres("movie", ["10764"]))  # Reality: TV only
        self.assertIsNone(gf.with_genres("tv", ["18", "27"]))
        self.assertIsNone(gf.with_genres("movie", []))

    def test_names(self):
        self.assertEqual(gf.family_name("action-adventure", STATIC_GENRE_NAMES), "Action & Adventure")
        self.assertEqual(gf.family_name("scifi-fantasy", STATIC_GENRE_NAMES), "Sci-Fi & Fantasy")
        self.assertEqual(gf.family_name("27", STATIC_GENRE_NAMES), "Horror")
        self.assertEqual(gf.family_name("10764", STATIC_GENRE_NAMES), "Reality")

    def test_unknown_id_is_its_own_family_for_its_type(self):
        family = gf.family_of(999001, "tv")
        self.assertEqual(family, "999001")
        self.assertEqual(gf.with_genres("tv", [family]), "999001")
        self.assertIsNone(gf.with_genres("movie", [family]))
        self.assertEqual(gf.family_name(family, {}), "Genre 999001")
