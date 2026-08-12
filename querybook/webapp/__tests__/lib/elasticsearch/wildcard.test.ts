import { toContainsPattern } from 'lib/elasticsearch/wildcard';

describe('toContainsPattern', () => {
    it('wraps a plain word so it matches anywhere in the name', () => {
        expect(toContainsPattern('world')).toBe('*world*');
    });

    it('keeps punctuation, which the filter field preserves', () => {
        expect(toContainsPattern('.world')).toBe('*.world*');
        expect(toContainsPattern('core.users')).toBe('*core.users*');
    });

    it('trims surrounding whitespace', () => {
        expect(toContainsPattern('  world  ')).toBe('*world*');
    });

    it('escapes a typed * so it is matched literally', () => {
        expect(toContainsPattern('a*b')).toBe('*a\\*b*');
    });

    it('escapes a typed ? so it is matched literally', () => {
        expect(toContainsPattern('a?b')).toBe('*a\\?b*');
    });

    it('escapes backslashes before wildcards so escapes are unambiguous', () => {
        expect(toContainsPattern('a\\b')).toBe('*a\\\\b*');
        expect(toContainsPattern('a\\*b')).toBe('*a\\\\\\*b*');
    });

    it('always produces a contains pattern, never an anchored one', () => {
        // the user typing their own wildcards must not change the anchoring
        expect(toContainsPattern('*world')).toBe('*\\*world*');
        expect(toContainsPattern('world*')).toBe('*world\\**');
    });
});
