// Keep in sync with MIN_PARTIAL_FILTER_LITERALS in
// server/lib/elasticsearch/query_utils.py. Shorter values are treated as exact
// by the server, so offering them as a partial match would return no results.
export const MIN_PARTIAL_NAME_LENGTH = 3;

/**
 * Build a "contains" wildcard pattern from user input.
 *
 * Everything the user typed is escaped, so a "*" or "?" in the input matches
 * that literal character instead of acting as an operator. Only the surrounding
 * wildcards are meaningful, which keeps the behaviour exactly "contains".
 */
export function toContainsPattern(input: string): string {
    const escaped = input
        .trim()
        .replace(/\\/g, '\\\\')
        .replace(/([*?])/g, '\\$1');
    return `*${escaped}*`;
}
