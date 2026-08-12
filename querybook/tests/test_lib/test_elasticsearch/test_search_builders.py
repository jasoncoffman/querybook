from unittest import TestCase

from lib.elasticsearch.search_board import construct_board_query
from lib.elasticsearch.search_query import construct_query_search_query


def _filter_terms(query):
    return query["query"]["bool"]["filter"]["bool"]["must"]


class QuerySearchPartialTableFilterTestCase(TestCase):
    def _construct(self, table_name):
        return construct_query_search_query(
            keywords="",
            filters=[["full_table_name", [table_name]]],
            limit=10,
            offset=0,
        )

    def test_partial_name_becomes_wildcard(self):
        terms = _filter_terms(self._construct("*world*"))
        self.assertIn(
            {
                "bool": {
                    "must": [{"wildcard": {"full_table_name": {"value": "*world*"}}}]
                }
            },
            terms,
        )

    def test_exact_name_stays_a_match(self):
        terms = _filter_terms(self._construct("main.world_happiness_2015"))
        self.assertIn(
            {
                "bool": {
                    "must": [
                        {"match": {"full_table_name": "main.world_happiness_2015"}}
                    ]
                }
            },
            terms,
        )


class BoardSearchPartialTableFilterTestCase(TestCase):
    UID = 7

    def _construct(self, table_name):
        return construct_board_query(
            uid=self.UID,
            keywords="",
            filters=[["full_table_name", [table_name]]],
            fields=[],
            limit=10,
            offset=0,
        )

    def test_partial_name_becomes_wildcard(self):
        terms = _filter_terms(self._construct("*world*"))
        # boards OR their table filters, unlike query search
        self.assertIn(
            {
                "bool": {
                    "should": [{"wildcard": {"full_table_name": {"value": "*world*"}}}]
                }
            },
            terms,
        )

    def test_exact_name_stays_a_match(self):
        terms = _filter_terms(self._construct("main.world_happiness_2015"))
        self.assertIn(
            {
                "bool": {
                    "should": [
                        {"match": {"full_table_name": "main.world_happiness_2015"}}
                    ]
                }
            },
            terms,
        )

    def test_access_terms_are_still_applied(self):
        terms = _filter_terms(self._construct("*world*"))
        self.assertIn(
            {
                "bool": {
                    "should": [
                        {"term": {"readable_user_ids": self.UID}},
                        {"term": {"public": True}},
                    ]
                }
            },
            terms,
        )
