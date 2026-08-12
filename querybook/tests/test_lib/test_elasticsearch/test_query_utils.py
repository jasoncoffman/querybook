from unittest import TestCase

from lib.elasticsearch.query_utils import match_filters


class MatchFiltersPartialTestCase(TestCase):
    PARTIAL = ["full_table_name"]

    def _filter_terms(self, filters, **kwargs):
        return match_filters(filters, **kwargs)["filter"]["bool"]["must"]

    def test_exact_name_stays_a_match_query(self):
        terms = self._filter_terms(
            [["full_table_name", "core.snapshot_v1"]],
            partial_filter_names=self.PARTIAL,
        )
        self.assertEqual(terms, [{"match": {"full_table_name": "core.snapshot_v1"}}])

    def test_wrapped_wildcards_match_substring(self):
        terms = self._filter_terms(
            [["full_table_name", "*world*"]], partial_filter_names=self.PARTIAL
        )
        self.assertEqual(
            terms, [{"wildcard": {"full_table_name": {"value": "*world*"}}}]
        )

    def test_bare_word_without_wildcards_stays_exact(self):
        # intent is never inferred from the text: a plain word is an exact name
        terms = self._filter_terms(
            [["full_table_name", "world"]], partial_filter_names=self.PARTIAL
        )
        self.assertEqual(terms, [{"match": {"full_table_name": "world"}}])

    def test_dotted_value_without_wildcards_stays_exact(self):
        for value in [".world", "core.", "core.users"]:
            terms = self._filter_terms(
                [["full_table_name", value]], partial_filter_names=self.PARTIAL
            )
            self.assertEqual(
                terms,
                [{"match": {"full_table_name": value}}],
                "{} should not become a wildcard".format(value),
            )

    def test_pattern_is_passed_through_unchanged(self):
        # the caller owns anchoring; match_filters never adds or removes wildcards
        terms = self._filter_terms(
            [["full_table_name", "core.*_v1"]], partial_filter_names=self.PARTIAL
        )
        self.assertEqual(
            terms, [{"wildcard": {"full_table_name": {"value": "core.*_v1"}}}]
        )

    def test_value_is_lowercased(self):
        # wildcard queries are not analyzed, so the value must be lowercased to
        # match terms normalized by case_insensitive
        terms = self._filter_terms(
            [["full_table_name", "*SnapShot*"]], partial_filter_names=self.PARTIAL
        )
        self.assertEqual(
            terms, [{"wildcard": {"full_table_name": {"value": "*snapshot*"}}}]
        )

    def test_escaped_wildcards_are_preserved_and_not_operators(self):
        # a "*" the caller escaped is a literal character, so it neither acts as
        # an operator nor counts toward the literal floor
        terms = self._filter_terms(
            [["full_table_name", "*a\\*b\\?c*"]], partial_filter_names=self.PARTIAL
        )
        self.assertEqual(
            terms, [{"wildcard": {"full_table_name": {"value": "*a\\*b\\?c*"}}}]
        )

    def test_only_escaped_wildcards_is_not_partial(self):
        # nothing unescaped means the value is literal, not a pattern
        terms = self._filter_terms(
            [["full_table_name", "core\\*name"]], partial_filter_names=self.PARTIAL
        )
        self.assertEqual(terms, [{"match": {"full_table_name": "core\\*name"}}])

    def test_escapes_survive_lowercasing(self):
        terms = self._filter_terms(
            [["full_table_name", "*A\\*B*"]], partial_filter_names=self.PARTIAL
        )
        self.assertEqual(
            terms, [{"wildcard": {"full_table_name": {"value": "*a\\*b*"}}}]
        )

    def test_not_enabled_for_other_filters(self):
        terms = self._filter_terms([["schema", "*world*"]])
        self.assertEqual(terms, [{"match": {"schema": "*world*"}}])

    def test_too_few_literals_is_not_partial(self):
        # a bare wildcard would scan the whole term dictionary
        for value in ["*", "**", "*a*", "*.*", "*ab*", "*a?b*", "*\\*b*"]:
            terms = self._filter_terms(
                [["full_table_name", value]], partial_filter_names=self.PARTIAL
            )
            self.assertEqual(
                terms,
                [{"match": {"full_table_name": value}}],
                "{} should not become a wildcard".format(value),
            )

    def test_minimum_literals_is_partial(self):
        terms = self._filter_terms(
            [["full_table_name", "*abc*"]], partial_filter_names=self.PARTIAL
        )
        self.assertEqual(terms, [{"wildcard": {"full_table_name": {"value": "*abc*"}}}])

    def test_mixed_list_ands_exact_and_partial(self):
        terms = self._filter_terms(
            [["full_table_name", ["core.users", "*snapshot*"]]],
            and_filter_names=["full_table_name"],
            partial_filter_names=self.PARTIAL,
        )
        self.assertEqual(
            terms,
            [
                {
                    "bool": {
                        "must": [
                            {"match": {"full_table_name": "core.users"}},
                            {"wildcard": {"full_table_name": {"value": "*snapshot*"}}},
                        ]
                    }
                }
            ],
        )

    def test_non_string_value_is_untouched(self):
        terms = self._filter_terms(
            [["full_table_name", 42]], partial_filter_names=self.PARTIAL
        )
        self.assertEqual(terms, [{"match": {"full_table_name": 42}}])
