/** Reference entries for Boyer-Moore, rolling hashes and Aho-Corasick (M15.4-M15.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'boyer-moore': {
      summary: 'The only matcher whose cost falls as the pattern grows, the bad-character rule that ' +
        'does almost all of the work on a large alphabet, and seven corpora on which the best of ' +
        'three variants changes hands four times.',
      intuition: 'A pattern of length m contains at most m distinct characters, so on a 26-letter ' +
        'alphabet most mismatches are against a character it does not contain — and that licenses a ' +
        'full m-position jump.',
      formulation: {
        equations: [
          {
            label: 'The two rules',
            expr: 'shift = max(badCharacter, goodSuffix), and both are individually safe',
            terms: [
              { sym: 'bad character', meaning: 'max(1, j − last[c]); the whole window when c is absent from the pattern' },
              { sym: 'good suffix', meaning: 'slide so the matched suffix reappears, or so a prefix lands on its tail' },
              { sym: 'the omitted half', meaning: 'the prefix case; leaving it out is quietly wrong on periodic patterns' },
              { sym: 'measured on English', meaning: 'bad character decides 1 195 shifts, good suffix 139, tied 40' }
            ]
          },
          {
            label: 'Characters examined per text character, English, 4 000 characters',
            expr: 'Boyer-Moore FALLS as the pattern grows; nothing else does',
            terms: [
              { sym: 'Boyer-Moore', meaning: '0.611 / 0.324 / 0.165 / 0.131 / 0.106 at lengths 2 / 4 / 8 / 16 / 32' },
              { sym: 'KMP', meaning: '1.048 / 1.056 / 1.055 / 1.054 / 1.052 — flat' },
              { sym: 'naive', meaning: '1.057 / 1.068 / 1.072 / 1.080 / 1.096 — rising' },
              { sym: 'the swing', meaning: '58% of KMP\'s work at length 2, 10% at length 32' }
            ]
          },
          {
            label: 'The rules priced separately, English, pattern "the"',
            expr: 'the good-suffix table earns almost nothing on a large alphabet',
            terms: [
              { sym: 'both rules', meaning: '1 553 comparisons over 1 386 alignments' },
              { sym: 'bad character alone', meaning: '1 615 over 1 436' },
              { sym: 'good suffix alone', meaning: '3 641 over 3 244' },
              { sym: 'the table', meaning: 'for "the": e slides 1, h slides 1, t slides 2, anything else slides 3' }
            ]
          },
          {
            label: 'Three variants across seven corpora (character comparisons)',
            expr: 'the winner changes hands four times',
            terms: [
              { sym: 'english (26 symbols)', meaning: 'BM 1 553 · Horspool 1 553 · Sunday 1 265 — Sunday' },
              { sym: 'source (40)', meaning: '80 · 77 · 74 — Sunday' },
              { sym: 'dna (4)', meaning: '1 927 · 2 611 · 2 108 — Boyer-Moore' },
              { sym: 'binary (2)', meaning: '1 855 · 5 978 · 5 328 — Boyer-Moore' },
              { sym: 'adversarial', meaning: '3 989 · 3 989 · 23 940 — Sunday is 6x worse' },
              { sym: 'repeated', meaning: '15 988 for all three, against KMP\'s 4 000' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Both shift rules are individually safe, so their maximum is safe',
          why: 'It is what licenses taking the larger without checking for interaction.',
          breaks: 'A shift larger than either rule allows skips an occurrence, silently.'
        },
        {
          name: 'The good-suffix table handles the prefix case as well as the re-occurrence case',
          why: 'The second pass exists for patterns where only a prefix survives.',
          breaks: 'Omitting it shifts too far on periodic patterns, and non-periodic test data never shows it.'
        },
        {
          name: 'The occurrence list matches the naive scan on every corpus',
          why: 'A skipping matcher fails by skipping an occurrence, which looks like a data problem.',
          breaks: 'The comparison count is meaningless beside a wrong answer.'
        },
        {
          name: 'Sublinearity is a property of the corpus, not of the algorithm',
          why: 'Below one comparison per character requires an alphabet large enough for the jumps to be large.',
          breaks: 'On a two-symbol alphabet the same algorithm is linear, and on the repeated corpus it is naive.'
        }
      ],
      complexity: [
        { operation: 'Boyer-Moore, both rules', average: 'O(n/m) on a large alphabet — sublinear', worst: 'O(n·m) without the Galil rule; 0.106 characters per character at m = 32' },
        { operation: 'bad-character table', average: 'Θ(m + |alphabet|)', worst: 'one entry per distinct pattern character' },
        { operation: 'good-suffix table', average: 'Θ(m), two passes', worst: 'earns 62 comparisons of 1 615 on English and 684 of 2 611 on DNA' },
        { operation: 'Horspool', average: 'O(n/m) expected, one table', worst: 'O(n·m); within 0% of Boyer-Moore on English and 36% worse on DNA' },
        { operation: 'Sunday', average: 'shifts up to m + 1', worst: '6x worse than Boyer-Moore on the adversarial corpus' },
        { operation: 'on the repeated corpus', average: 'every skipping variant degrades to the naive cost', worst: '15 988 against KMP\'s 4 000' }
      ],
      failureModes: [
        {
          symptom: 'A Boyer-Moore implementation misses occurrences of a periodic pattern.',
          cause: 'The good-suffix table omits the case where only a prefix of the pattern survives.',
          fix: 'Implement both passes; test on "aabaab" and "abcabcabc", not on English words.'
        },
        {
          symptom: 'Boyer-Moore is slower than the naive scan on production data.',
          cause: 'A small alphabet, a short pattern, or a pattern that matches at almost every position.',
          fix: 'Measure on the real corpus; the algorithm is a bet about the alphabet and it can lose.'
        },
        {
          symptom: 'A search feature is fast for long queries and slow for short ones.',
          cause: 'That is the algorithm working as designed — the shift is bounded by the pattern length.',
          fix: 'Use a prefilter or an index for short queries; skipping has nothing to skip.'
        },
        {
          symptom: 'Switching from Boyer-Moore to Sunday makes one workload much worse.',
          cause: 'Sunday looks one character past the window and is catastrophic on runs of one symbol.',
          fix: 'Keep a linear-time fallback, or choose per corpus rather than globally.'
        }
      ],
      inTheWild: [
        { system: 'GNU grep', how: 'Boyer-Moore-family skipping for fixed strings, with a fallback for pathological patterns' },
        { system: 'V8 String.prototype.indexOf', how: 'Boyer-Moore-Horspool past a pattern-length threshold, naive with a filter below it' },
        { system: 'Text editors\' find', how: 'Horspool, because the pattern is typed once and the buffer is scanned repeatedly' },
        { system: 'Antivirus and DLP scanners', how: 'skipping matchers over byte alphabets, where the tables are affordable' }
      ],
      sources: [
        { title: 'A fast string searching algorithm', where: 'Boyer, Moore — CACM, 1977' },
        { title: 'Practical fast searching in strings', where: 'R. Nigel Horspool — Software: Practice and Experience, 1980' },
        { title: 'A very fast substring search algorithm', where: 'Daniel Sunday — CACM, 1990' },
        { title: 'Handbook of Exact String Matching Algorithms', where: 'Charras, Lecroq, 2004 — all three, with code' }
      ]
    },

    'rolling-hashes': {
      summary: 'A constant-time window fingerprint, a modulus that decides the work and never the ' +
        'answer, a birthday attack that needs only the published constants, and the same hash ' +
        'pointed at file chunking.',
      intuition: 'The fingerprint is a filter and the character comparison is the answer. Keeping ' +
        'those separate is what makes the modulus a tuning parameter instead of a correctness ' +
        'assumption.',
      formulation: {
        equations: [
          {
            label: 'The rolling update',
            expr: 'h′ = ((h − c₀·bᵐ⁻¹) · b + cₘ) mod M',
            terms: [
              { sym: 'cost', meaning: 'two multiplications and two additions, whatever the window length' },
              { sym: 'measured', meaning: '3 997 rolling updates and 36 character comparisons over 4 000 characters' },
              { sym: 'verification', meaning: 'every hash hit is checked character by character — Las Vegas, not Monte Carlo' }
            ]
          },
          {
            label: 'The modulus sweep, English, pattern "the", 4 000 characters',
            expr: 'the same 12 occurrences at every setting',
            terms: [
              { sym: 'M = 101', meaning: '31 hits, 19 spurious, 55 comparisons; predicted 39.58' },
              { sym: 'M = 1 009', meaning: '16 hits, 4 spurious, 40 comparisons; predicted 3.96' },
              { sym: 'M = 1 000 003', meaning: '12 hits, 0 spurious, 36 comparisons' },
              { sym: 'M = 999 999 937', meaning: '12 hits, 0 spurious, 36 comparisons' },
              { sym: 'the model', meaning: 'expected spurious hits = (n − m + 1)/M' }
            ]
          },
          {
            label: 'The birthday attack on a fixed base',
            expr: 'about sqrt(M) random strings find a colliding pair',
            terms: [
              { sym: 'the search', meaning: '1 536 tries against an estimate of 1 000, in milliseconds' },
              { sym: 'the text', meaning: 'the pair\'s second half repeated 200 times, 3 200 characters' },
              { sym: 'fixed base 257', meaning: '200 spurious hits, 1 200 wasted character comparisons, 0 occurrences found' },
              { sym: 'random base, 20 trials', meaning: '0 spurious hits at the worst, 0 in total' },
              { sym: 'why', meaning: 'the pair was a solution for one base only' }
            ]
          },
          {
            label: 'Content-defined chunking, one inserted byte',
            expr: 'boundaries follow the content, so an edit moves one of them',
            terms: [
              { sym: 'content-defined', meaning: '75 chunks before, 74 after, 73 byte-identical — 97.3% reused' },
              { sym: 'fixed 64-byte', meaning: '63 chunks before and after, 20 byte-identical — 31.7%' },
              { sym: 'the dial', meaning: 'each boundary bit halves the probability and doubles the mean chunk: 23.3 bytes at 3 bits, 126.7 at 9' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every hash hit is verified before it is reported',
          why: 'It is what makes the modulus a cost decision rather than a correctness one.',
          breaks: 'Without it the matcher returns false positives at a rate an attacker controls.'
        },
        {
          name: 'The occurrence list is identical at every modulus',
          why: 'The fingerprint filters and the comparison decides; the two must not be confused.',
          breaks: 'A modulus that changes the answer means the verification was skipped.'
        },
        {
          name: 'The base is chosen at run time when the input is untrusted',
          why: 'A deterministic hash of chosen input is a promise that its worst case is reachable.',
          breaks: 'One second of birthday search turns the filter into a no-op.'
        },
        {
          name: 'A chunk boundary depends only on the bytes inside its window',
          why: 'That is what makes an insertion move one boundary rather than all of them.',
          breaks: 'Any offset-dependent term destroys the deduplication the scheme exists for.'
        }
      ],
      complexity: [
        { operation: 'rolling update', average: 'Θ(1)', worst: '3 997 updates over 4 000 characters, whatever the pattern length' },
        { operation: 'Rabin-Karp search', average: 'Θ(n + m) expected', worst: 'Θ(n·m) when every window collides — reachable on demand with a fixed base' },
        { operation: 'spurious hits', average: '(n − m + 1)/M expected', worst: '19 at M = 101; 200 of 200 windows under the attack' },
        { operation: 'birthday collision search', average: 'Θ(sqrt(M))', worst: '1 536 tries at M ≈ 10⁶, milliseconds of work' },
        { operation: 'content-defined chunking', average: 'Θ(n), one rolling update per byte', worst: 'mean chunk 2^k for a k-bit boundary rule' },
        { operation: 'reuse after a one-byte insert', average: '1 chunk lost', worst: '97.3% reused against 31.7% for fixed-size chunking' }
      ],
      failureModes: [
        {
          symptom: 'A matcher is fast in testing and quadratic in production.',
          cause: 'Somebody constructed a text that collides with the pattern under the fixed base.',
          fix: 'Randomise the base at process start; it is one line and it costs nothing.'
        },
        {
          symptom: 'A Rabin-Karp implementation returns positions that are not occurrences.',
          cause: 'The verification step was dropped as an optimisation.',
          fix: 'Put it back; without it the algorithm is Monte Carlo and the error rate is not yours to choose.'
        },
        {
          symptom: 'A deduplicating backup transfers the whole file after a one-byte change.',
          cause: 'Fixed-size chunking, so every boundary after the edit moved.',
          fix: 'Cut on content: the boundary must depend on the bytes in a window, not on the offset.'
        },
        {
          symptom: 'A content-defined chunker produces enormous or tiny chunks.',
          cause: 'The boundary rule gives a geometric distribution with a long tail in both directions.',
          fix: 'Impose a minimum and a maximum chunk size on top of the rule, as every real implementation does.'
        }
      ],
      inTheWild: [
        { system: 'rsync', how: 'a rolling checksum over the receiver\'s blocks, then a strong hash on a hit' },
        { system: 'restic, borg, Duplicacy', how: 'content-defined chunking with a Rabin fingerprint, then content-addressed storage' },
        { system: 'Plagiarism detection (MOSS, winnowing)', how: 'rolling hashes over k-grams with a local-minimum selection rule' },
        { system: 'ZFS and LBFS', how: 'variable-size blocks cut on a rolling-hash boundary for deduplication' }
      ],
      sources: [
        { title: 'Efficient randomized pattern-matching algorithms', where: 'Karp, Rabin — IBM Journal of R&D, 1987' },
        { title: 'A Low-bandwidth Network File System', where: 'Muthitacharoen, Chen, Mazières — SOSP, 2001 — content-defined chunking' },
        { title: 'Winnowing: local algorithms for document fingerprinting', where: 'Schleimer, Wilkerson, Aiken — SIGMOD, 2003' },
        { title: 'Denial of Service via Algorithmic Complexity Attacks', where: 'Crosby, Wallach — USENIX Security, 2003' }
      ]
    },

    'aho-corasick': {
      summary: 'KMP\'s failure link generalised to a pattern set, one pass over the text whatever ' +
        'the set size, and an output chain that exists for one case — a pattern nested inside ' +
        'another — whose omission under-reports in complete silence.',
      intuition: 'Failure links are followed on a mismatch and output links on a match. Everybody ' +
        'implements the first; the second is five lines and is what reports "he" inside "she".',
      formulation: {
        equations: [
          {
            label: 'The three link kinds',
            expr: 'goto is the trie; failure is the longest suffix that is a prefix; output chains to the nearest pattern end',
            terms: [
              { sym: 'construction', meaning: 'one breadth-first pass, because a failure link is read off the parent\'s' },
              { sym: 'state count', meaning: 'one per distinct prefix of any pattern — 10 states and 9 edges for 5 patterns' },
              { sym: 'why output links', meaning: 'nothing in the goto trie says that arriving at "she" also means arriving at "he"' }
            ]
          },
          {
            label: 'The nested case, measured',
            expr: 'patterns he, she, his, hers, her over "ushers said he hushed his hers"',
            terms: [
              { sym: 'with output links', meaning: '11 matches, 0 missing, 0 extra — 10 failure follows and 2 output follows' },
              { sym: 'without', meaning: '9 matches, 2 missing — and the failure-follow count is IDENTICAL at 10' },
              { sym: 'what is lost', meaning: '"he" inside "she", at both positions where "she" occurs' },
              { sym: 'the diagnostic', meaning: 'ask whether any pattern is a suffix of another; that resolves most reports of this shape' }
            ]
          },
          {
            label: 'One pass against one scan per pattern, English, 4 000 characters',
            expr: 'the automaton cost is independent of the pattern count',
            terms: [
              { sym: 'automaton comparisons', meaning: '4 000 at 1, 2, 4, 8, 16 and 32 patterns — flat' },
              { sym: 'one naive scan each', meaning: '4 303 / 8 645 / 17 288 / 34 654 / 68 864 / 135 036' },
              { sym: 'saving', meaning: '1.08x at one pattern and 33.76x at thirty-two' },
              { sym: 'states', meaning: '5 / 11 / 20 / 42 / 73 / 138 — sublinear, because prefixes are shared' }
            ]
          },
          {
            label: 'The dense goto table',
            expr: '|alphabet| x states cells, and the failure links are never followed at run time',
            terms: [
              { sym: 'DNA (4 symbols)', meaning: '40 cells for a 10-state automaton' },
              { sym: 'source code (40 symbols)', meaning: '400 cells for the identical automaton' },
              { sym: 'why byte alphabets', meaning: '256 is affordable at ten thousand states; Unicode is not' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every occurrence of every pattern is reported exactly once',
          why: 'Overlapping and nested are two separate requirements and an implementation can fail either.',
          breaks: 'The oracle compares multisets: a duplicate report is as much a disagreement as a missing one.'
        },
        {
          name: 'The output chain is followed on every match, not only on a mismatch',
          why: 'Failure links fire on mismatch; nested patterns are found on a successful step.',
          breaks: 'Dropping it loses exactly the patterns that are proper suffixes of other patterns.'
        },
        {
          name: 'Failure links are built breadth-first',
          why: 'A state\'s link is computed from its parent\'s, so the parent must be finished first.',
          breaks: 'A depth-first construction reads an unset parent link and produces a plausible wrong automaton.'
        },
        {
          name: 'The scan reads each text character once',
          why: 'The failure fallback is a loop over links, never over text positions.',
          breaks: 'Re-reading text means the automaton was rebuilt as a per-pattern search.'
        }
      ],
      complexity: [
        { operation: 'construction', average: 'Θ(total pattern length)', worst: '10 states and 9 edges for 5 patterns; 138 states for 32' },
        { operation: 'the scan', average: 'Θ(n + occurrences)', worst: '4 000 comparisons at any pattern-set size' },
        { operation: 'one naive scan per pattern', average: 'Θ(k · n)', worst: '135 036 comparisons at 32 patterns' },
        { operation: 'failure-link follows', average: 'amortised Θ(1) per character', worst: '10 over the 30-character fixture' },
        { operation: 'output-link follows', average: 'Θ(1) per reported nested match', worst: '2 on the fixture, and 0 when the chain is dropped' },
        { operation: 'dense goto table', average: 'Θ(|alphabet| · states) cells', worst: '40 on DNA, 400 on source code, for the same automaton' }
      ],
      failureModes: [
        {
          symptom: 'A keyword matcher misses some hits after the keyword list is changed.',
          cause: 'A newly added keyword is a suffix of an existing one and the output chain is missing.',
          fix: 'Follow the output links; assert against a brute-force multi-pattern oracle in the tests.'
        },
        {
          symptom: 'The automaton reports a match twice.',
          cause: 'The state\'s own patterns are emitted and then re-emitted from the output chain.',
          fix: 'Start the chain at output(state), not at state; compare multisets to catch it.'
        },
        {
          symptom: 'Construction produces an automaton that mostly works.',
          cause: 'The failure links were built depth-first, so some were read before the parent\'s was set.',
          fix: 'Build them breadth-first; the order is the only reason the construction is linear.'
        },
        {
          symptom: 'A dense goto table exhausts memory.',
          cause: 'alphabet × states, with a large alphabet and a large keyword set.',
          fix: 'Work over bytes, or keep the sparse form and follow links — the loop is amortised constant.'
        }
      ],
      inTheWild: [
        { system: 'Snort and Suricata', how: 'Aho-Corasick over byte alphabets for the multi-pattern prefilter stage' },
        { system: 'fgrep and grep -F', how: 'Commentz-Walter or Aho-Corasick for multiple fixed strings' },
        { system: 'Content and profanity filters', how: 'a keyword automaton, which is exactly where the nested-pattern bug lives' },
        { system: 'Lexers with reserved-word sets', how: 'one automaton pass rather than a hash lookup per token' }
      ],
      sources: [
        { title: 'Efficient string matching: an aid to bibliographic search', where: 'Aho, Corasick — CACM, 1975' },
        { title: 'A string matching algorithm fast on the average', where: 'Commentz-Walter — ICALP, 1979 — the skipping variant' },
        { title: 'Algorithms on Strings, Trees and Sequences, chapter 3', where: 'Dan Gusfield, 1997' },
        { title: 'Flexible Pattern Matching in Strings', where: 'Navarro, Raffinot — Cambridge University Press, 2002' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
