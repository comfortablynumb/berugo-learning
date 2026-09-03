/** Concepts for Boyer-Moore, rolling hashes and Aho-Corasick (M15.4-M15.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'boyer-moore': [
      {
        term: 'Comparing right to left is the whole idea',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["align the pattern, compare<br/>from its last character"] --> B["a mismatch there"]',
            '    B --> C["tells you about a text character<br/>you would not otherwise have read"]',
            '    C --> D["so the pattern can jump<br/>past several positions at once"]',
            '    D --> E["sub-linear on average —<br/>most characters never read at all"]'
          ].join('\n'),
          caption: 'Every other matcher here reads every character of the text. This one can finish having skipped most of them, which is why it is the one in your editor.'
        },
        plain: 'A mismatch at the pattern\'s last position tells you about a character you have not otherwise looked at.',
        formal: 'within each alignment, compare pattern[m−1] down to pattern[0]',
        detail: [
          'Every other matcher in this milestone reads the text left to right, and can at best look ' +
            'at each character once.',
          'Boyer-Moore starts at the far end of the window, so a mismatch there is information about ' +
            'a character `m − 1` positions ahead of where a left-to-right scan would be. If that ' +
            'character occurs nowhere in the pattern, the whole window can be skipped.',
          'That is the only way any matcher gets below one comparison per text character.'
        ],
        example: 'On English with a three-character pattern the matcher examines 0.388 characters ' +
          'per text character; at 32 characters it is 0.106.'
      },
      {
        term: 'The bad-character rule slides the rightmost matching copy into place',
        plain: 'On a mismatch against text character c, line up the last c in the pattern — or skip the window entirely.',
        formal: 'shift = max(1, j − last[c]), where last[c] is the rightmost index of c in the pattern, or −1',
        readAs: 'On a mismatch, slide the pattern so its last occurrence of the offending character lines up. ' +
          'If the character is absent entirely, last[c] is −1 and the whole pattern jumps past it. The ' +
          'max(1, …) stops the shift going backwards.',
        detail: [
          'The big jumps come from the absent case.',
          'A pattern of length m contains at most m distinct characters. So on a large alphabet most ' +
            'text characters are in no row of the table at all, and license a full m-position slide.',
          'Shrink the alphabet and that stops being true. On DNA a mismatching character is in the ' +
            'table three times out of four, which is exactly why the algorithm degrades as the ' +
            'alphabet does.'
        ],
        example: 'For the pattern "the": e slides by 1, h by 1, t by 2, and any other character by ' +
          'the whole 3.'
      },
      {
        term: 'The good-suffix rule is the half people leave out',
        plain: 'Slide so that the suffix already matched reappears, or so that a prefix lands on its tail.',
        formal: 'a two-pass construction; the second pass handles the case where only a prefix of the pattern survives',
        detail: [
          'The first pass covers a re-occurrence of the matched suffix elsewhere in the pattern.',
          'The second covers the case where no such re-occurrence exists, but a *prefix* of the ' +
            'pattern matches the tail of the matched suffix. Omitting it produces an implementation ' +
            'that is quietly wrong on periodic patterns: it shifts too far and skips occurrences.',
          'That is the classic Boyer-Moore bug, and it is invisible on non-periodic test data.'
        ],
        example: 'Both rules together cost 1 553 comparisons on English; the good-suffix rule alone ' +
          'costs 3 641 and the bad-character rule alone 1 615.'
      },
      {
        term: 'Both rules are safe, so the algorithm takes the larger',
        plain: 'Neither rule can ever slide past an occurrence, so their maximum cannot either.',
        formal: 'shift = max(badCharacter, goodSuffix); correctness follows from each being individually safe',
        readAs: 'Two rules propose a shift and you take the larger. Both are individually guaranteed never to ' +
          'skip an occurrence, so taking whichever is bigger is safe too.',
        detail: [
          'This is a small and useful piece of reasoning. Two independently sound lower bounds on ' +
            'how far the pattern may move combine into a better one for free, with no interaction ' +
            'to check.',
          'It is the same shape as taking the maximum of two admissible heuristics in A*, and the ' +
            'same shape as combining two prefilters.',
          'The demo records which rule won each shift, because that ratio decides whether the second ' +
            'table earns its construction cost.'
        ],
        example: 'On English the bad-character rule decides 1 195 shifts and the good-suffix rule ' +
          '139, with 40 ties.'
      },
      {
        term: 'It gets faster as the pattern gets longer',
        plain: 'The opposite of every other matcher here.',
        formal: 'the expected shift grows with m on a large alphabet, so comparisons per text character fall',
        detail: [
          'A longer pattern means a longer possible jump and a lower chance that a given text ' +
            'character appears in it, so both factors push the same way.',
          'Every other matcher is bounded below by roughly one comparison per text character, ' +
            'however long the pattern is.',
          'That is why a long search term feels instant and a one-character one does not, and it is ' +
            'the single most counter-intuitive fact in the milestone.'
        ],
        example: 'Comparisons per text character at pattern lengths 2, 4, 8, 16 and 32: 0.611, ' +
          '0.324, 0.165, 0.131, 0.106 — while KMP stays at 1.05 throughout.'
      },
      {
        term: 'A small alphabet takes the skipping away',
        plain: 'On a two-symbol alphabet every mismatching character is in the pattern, so no jump is large.',
        formal: 'the expected bad-character shift falls towards 1 as the alphabet shrinks towards the pattern\'s own character set',
        detail: [
          'The bad-character rule is a bet that the mismatching character is absent from the ' +
            'pattern, and that bet is a function of the alphabet size relative to the pattern length.',
          'On DNA, on binary framing, on a restricted symbol set, the bet loses most of the time and ' +
            'the algorithm collapses towards the naive scan.',
          'This is why the corpus table matters more than the complexity table: the same algorithm ' +
            'is sublinear on one row and linear on the next.'
        ],
        example: 'On the repeated corpus Boyer-Moore, Horspool and Sunday all pay 15 988 ' +
          'comparisons — exactly the naive cost — while KMP pays 4 000.'
      },
      {
        term: 'Horspool and Sunday drop machinery on purpose',
        plain: 'One table and no good-suffix pass; or look one character past the window instead.',
        formal: 'Horspool keys on the character aligned with pattern[m−1]; Sunday keys on text[start + m] and can shift by m + 1',
        readAs: 'Two simplifications of Boyer-Moore. Horspool looks at the character under the pattern\'s ' +
          'last position; Sunday looks one past the end, which lets it jump the entire pattern length ' +
          'plus one.',
        detail: [
          'Both are shorter than full Boyer-Moore, and neither is uniformly worse. That is the ' +
            'interesting part.',
          'Horspool ignores where the mismatch happened and keys only on the window\'s last ' +
            'character. Sunday looks one position beyond the window, which buys a shift of up to ' +
            '`m + 1` at the cost of touching a character outside it.',
          'The corpus table shows the ranking between the three inverting twice.'
        ],
        example: 'Sunday wins on English (1 265 against 1 553) and loses catastrophically on the ' +
          'adversarial corpus (23 940 against 3 989).'
      },
      {
        term: 'Real strstr implementations are hybrids, and that is the honest conclusion',
        plain: 'A vectorised scan for short patterns, a skipping matcher for long ones, and a linear-time fallback.',
        formal: 'no single matcher dominates across pattern length, alphabet size and occurrence density',
        detail: [
          'Every algorithm in this milestone has a corpus in the same demo on which it is the worst ' +
            'available choice.',
          'A library cannot see its input before choosing, so it picks the one with the best worst ' +
            'case and adds a fast path for the common case. That is exactly what glibc, V8 and Rust ' +
            'all do.',
          'When you are choosing yourself you can see the input, and that is the advantage worth ' +
            'using rather than defaulting to whatever the textbook ranked first.'
        ],
        example: 'Across seven corpora the best of Boyer-Moore, Horspool and Sunday changes hands ' +
          'four times.'
      }
    ],

    'rolling-hashes': [
      {
        term: 'The window hash is a polynomial, so sliding it is arithmetic',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["the current window\'s hash"] --> B["subtract the leading<br/>character\'s contribution"]',
            '    B --> C["multiply by the base"]',
            '    C --> D["add the new character"]',
            '    D --> E["constant time, whatever<br/>the window length"]'
          ].join('\n'),
          caption: 'Three operations move the window one place, regardless of how long it is. That constant is the whole reason a rolling hash beats rehashing each window.'
        },
        plain: 'Subtract the leading term, multiply by the base, add the new character.',
        formal: 'h′ = (h − c₀·bᵐ⁻¹)·b + cₘ, all modulo M — constant time whatever the window length',
        readAs: 'Rolling the hash forward: subtract the departing character\'s contribution, multiply ' +
          'everything up one place, add the arriving character. Three operations regardless of window ' +
          'size — h′ is read "h prime", the next hash.',
        detail: 'That constant-time update is what makes a fingerprint per position affordable at ' +
          'all. Without it, hashing every window costs the same as comparing every window and the ' +
          'whole approach is pointless. With it, matching becomes a stream of integer comparisons ' +
          'and character comparisons happen only on a hit — which is a good trade exactly when hits ' +
          'are rare, and a catastrophic one when an adversary can make them common.',
        example: 'On 4 000 characters the matcher does 3 997 rolling updates and 36 character ' +
          'comparisons.'
      },
      {
        term: 'Verification is not optional',
        plain: 'Every hash hit is checked character by character before it is reported.',
        formal: 'with verification the algorithm is Las Vegas — always correct, sometimes slower; without it, Monte Carlo',
        readAs: 'Two kinds of randomised algorithm. Las Vegas is always right and takes a variable amount of ' +
          'time; Monte Carlo runs in fixed time and is occasionally wrong. Checking each hash hit is ' +
          'what moves Rabin-Karp from the second to the first.',
        detail: 'Rabin-Karp with the verification removed returns wrong answers at a rate you have ' +
          'to reason about, and the rate depends on the modulus, the text and — if anybody is ' +
          'choosing the text — on them. With verification a collision costs a comparison run and ' +
          'never a wrong answer, so the modulus decides the *work* and never the *answer*. That ' +
          'separation is what makes the modulus a tuning parameter rather than a correctness ' +
          'assumption.',
        example: 'At moduli 101, 1 009, 1 000 003 and 999 999 937 the matcher finds exactly the ' +
          'same 12 occurrences, at 55, 40, 36 and 36 character comparisons.'
      },
      {
        term: 'The spurious-hit rate is windows over modulus',
        plain: 'A well-spread hash collides about n/M times over n windows.',
        formal: 'expected spurious hits ≈ (n − m + 1)/M for a hash spreading uniformly',
        readAs: 'False hash matches happen about once per M windows, so the number is the window count over ' +
          'the modulus. At M around a million and a few thousand windows, that is essentially none.',
        detail: 'That prediction is what makes the modulus choice a calculation rather than a ' +
          'superstition, and comparing it against the measurement is what tells you whether the ' +
          'hash actually spreads. A modulus of a million over four thousand windows predicts 0.004 ' +
          'spurious hits, which is why nobody notices Rabin-Karp\'s failure mode until somebody ' +
          'constructs one — the expected number is well below one.',
        example: 'At modulus 101 the prediction is 39.58 and the measurement is 19; at 1 000 003 ' +
          'both are 0.'
      },
      {
        term: 'A fixed base and modulus is a published function',
        plain: 'A birthday search over about √M random strings finds two with the same fingerprint.',
        formal: 'the birthday bound: √M candidates suffice with constant probability, and M ≈ 10⁶ means about 1 000 tries',
        readAs: 'You do not need M tries to force a collision, only about the square root of M — the same ' +
          'reason 23 people in a room share a birthday. A million-sized modulus falls in a thousand ' +
          'attempts, which is instant.',
        detail: 'The attacker needs no cleverness and no access — only the constants, which are in ' +
          'the source. A second of work produces a colliding pair; repeating one half of it produces ' +
          'a text on which every window hits and every verification fails, so the filter admits ' +
          'everything and the matcher does the quadratic work it exists to avoid. This is the same ' +
          'shape as the hash-flooding attacks that produced SipHash, and it has the same fix.',
        example: 'A colliding pair of 16-character strings took 1 536 random tries against a ' +
          'birthday estimate of 1 000.'
      },
      {
        term: 'Randomising the base per run is the fix, and it is one line',
        plain: 'The colliding pair was a solution for one base; a different base breaks it.',
        formal: 'choose b uniformly at process start; the adversary must now defeat a base they cannot see',
        detail: 'It converts an attacker-controlled quadratic blow-up into a probabilistic ' +
          'guarantee they cannot aim at, and it costs nothing at all — the hash is the same ' +
          'arithmetic with a different constant. The only thing it takes away is reproducibility ' +
          'across runs, which matters for a content-addressed store and not for a matcher. Any ' +
          'deterministic hash of untrusted input is a promise that its worst case is reachable on ' +
          'demand.',
        example: 'The attack text produces 200 spurious hits at the fixed base and 0 at the worst ' +
          'of 20 random ones.'
      },
      {
        term: 'Content-defined chunking is the same hash asked a different question',
        plain: 'Cut wherever the rolling hash of the last few bytes has enough low zero bits.',
        formal: 'a boundary at position i iff hash(text[i−w..i]) mod 2^k = 0 — a property of the CONTENT, not the offset',
        readAs: 'Cut the file wherever the rolling hash of the last w bytes ends in k zeros. Because the ' +
          'decision depends only on the bytes themselves, inserting something at the start does not ' +
          'move any later boundary — which is the whole point for deduplication.',
        detail: 'Because the boundary depends on the bytes around it rather than on the distance ' +
          'from the start of the file, inserting a byte moves one boundary and leaves every other ' +
          'chunk byte-identical. A fixed-size chunker shifts every boundary after the insertion ' +
          'point and every chunk after it becomes a different string. That single difference is why ' +
          'rsync, restic, borg and every deduplicating store cut on content.',
        example: 'After one inserted byte the content-defined chunker keeps 73 of its 75 chunks and ' +
          'a 64-byte fixed chunker keeps 20 of 63.'
      },
      {
        term: 'The boundary-bit setting is the whole tuning dial',
        plain: 'Each extra bit halves the boundary probability and doubles the mean chunk.',
        formal: 'expected chunk length ≈ 2^k for a k-bit boundary condition',
        detail: 'Smaller chunks find more duplicates and cost more index entries; larger chunks ' +
          'cost less index and lose more when an edit lands inside one. That is the entire design ' +
          'space of a deduplicating store, and it is one integer. Real implementations add a minimum ' +
          'and a maximum chunk size on top, because the geometric distribution the rule produces has ' +
          'a long tail in both directions and neither extreme is useful.',
        example: 'From 3 to 9 boundary bits the mean chunk goes from 23.3 bytes to 126.7 and the ' +
          'reuse fraction falls with it.'
      },
      {
        term: 'The fingerprint decides the work and the verification decides the answer',
        plain: 'Two separate concerns, and conflating them is how the algorithm gets a reputation for being wrong.',
        formal: 'correctness depends only on the verification; the modulus, the base and the collision rate are all cost',
        detail: 'Every criticism of Rabin-Karp that begins "but it can produce false positives" is ' +
          'about an implementation that dropped the verification. With it, the algorithm is exactly ' +
          'as correct as the naive scan and differs only in how much work it does to get there. ' +
          'Keeping that boundary clear is what lets the modulus be tuned freely — and what makes ' +
          'the attack a performance problem rather than a correctness one.',
        example: 'Under the attack the matcher does 1 200 wasted character comparisons and still ' +
          'reports exactly 0 occurrences, which is the right answer.'
      }
    ],

    'aho-corasick': [
      {
        term: 'One pass finds every pattern, whatever the set size',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["k patterns, run a single-pattern<br/>matcher k times"] --> B["k passes over the text"]',
            '    C["k patterns in one automaton"] --> D["one pass over the text"]',
            '    D --> E["cost depends on the text length<br/>and the number of matches —<br/>not on k"]'
          ].join('\n'),
          caption: 'This is the property that matters at scale: adding the ten-thousandth pattern to the set costs build time and nothing at all at match time.'
        },
        plain: 'Running a single-pattern matcher k times costs k passes; this costs one.',
        formal: 'O(n + total pattern length + occurrences), independent of k for the scan itself',
        detail: 'The automaton is built once from the pattern set and then the text is read once. ' +
          'That is the entire argument, and it means the saving grows without bound as the set ' +
          'grows while the automaton\'s per-character cost does not move. At one pattern it is a ' +
          'loss — the trie construction buys nothing — and the crossover is at two or three, which ' +
          'is why almost any real keyword set is worth an automaton.',
        example: 'The automaton does 4 000 comparisons at every set size from 1 to 32, while one ' +
          'naive scan per pattern goes from 4 303 to 135 036.'
      },
      {
        term: 'The trie of patterns is the goto function',
        plain: 'One state per distinct prefix of any pattern.',
        formal: 'goto(state, symbol) = the child, or undefined; the state count is the number of distinct prefixes',
        detail: 'That is the memory model and it is worth internalising: a keyword set costs states ' +
          'proportional to its total *distinct prefix* count rather than its total length, so a ' +
          'thousand words sharing prefixes is far cheaper than a thousand random strings. It also ' +
          'means the automaton for a growing keyword list grows sublinearly in the list, which is ' +
          'why content filters and intrusion signature sets stay affordable.',
        example: '5 patterns over an 8-letter vocabulary give 10 states and 9 goto edges.'
      },
      {
        term: 'A failure link is KMP\'s border, generalised to a set',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["a state spells the string she"] --> B["the match fails here"]',
            '    B --> C["where else could we be?"]',
            '    C --> D["at the longest proper suffix of she<br/>that is a prefix of some pattern"]',
            '    D --> E["the state for he — follow the link<br/>and keep going, without re-reading"]'
          ].join('\n'),
          caption: 'One pattern has one border chain; a set of patterns has a tree of them. The failure link is the same idea with the trie standing in for the single pattern.'
        },
        plain: 'Point each state at the state for the longest proper suffix of what it spells that is a prefix of some pattern.',
        formal: 'fail(u) = the deepest state v ≠ u whose string is a suffix of u\'s string',
        detail: 'Exactly the same idea as the border array, with "the pattern" replaced by "any ' +
          'pattern", and exactly the same consequence: on a mismatch the automaton falls back ' +
          'without re-reading any text. One breadth-first pass builds all of them, because a ' +
          'state\'s failure link is computed from its parent\'s and BFS is the order that finishes ' +
          'parents first.',
        example: 'The state for "she" fails to the state for "he", which is the longest suffix that ' +
          'is also a prefix of a pattern.'
      },
      {
        term: 'Output links exist for one case, and it is the case that bites',
        plain: 'When a pattern is a suffix of another, reaching the longer one must also report the shorter.',
        formal: 'output(u) = the nearest state along u\'s failure chain that ends a pattern; the chain must be followed on every match',
        detail: 'Nothing in the goto trie says that arriving at `she` also means arriving at `he`, ' +
          'and nothing about the failure links reports it either — the links are followed on ' +
          'mismatch, not on match. The output chain is a separate five lines, and dropping them ' +
          'produces a matcher that finds every occurrence of every pattern except the nested ones. ' +
          'That looks like a data problem rather than an algorithm problem, which is why it survives.',
        example: 'On the ushers fixture, 2 of the 11 matches come from the output chain alone, and ' +
          'both disappear when it is dropped.'
      },
      {
        term: 'The failure is silent, and the fix is a question rather than a debugger',
        plain: 'When a multi-pattern matcher is "missing some matches", ask whether any pattern is a suffix of another.',
        formal: 'the dropped matches are exactly the occurrences of patterns that are proper suffixes of other patterns',
        detail: 'That one question resolves most reports of this shape, and it explains the timing: ' +
          'keyword lists grow organically, and nobody adds `he` to a list containing `she` on the ' +
          'day the matcher is written and tested. The bug appears months later, on a list change, ' +
          'in a component nobody touched — which is the worst possible combination for diagnosis and ' +
          'the best possible argument for an assertion against a brute-force oracle in the test ' +
          'suite.',
        example: 'The broken run reports 9 matches against a true 11, with the failure-link count ' +
          'identical in both — nothing about the run looks different.'
      },
      {
        term: 'Overlapping and nested matches are both required',
        plain: 'Every occurrence of every pattern, reported exactly once each.',
        formal: 'the output multiset is { (pattern, position) : the pattern occurs there }, with no deduplication and no omission',
        readAs: 'Every pattern-and-position pair where a match genuinely occurs, reported once each. A ' +
          'multiset rather than a set because the same pattern can legitimately appear at many ' +
          'positions.',
        detail: 'Two separate requirements that are easy to conflate. Overlapping means the same ' +
          'pattern occurring at nearby positions; nested means different patterns ending at the ' +
          'same position. An implementation can get one right and the other wrong, so the oracle ' +
          'compares multisets rather than sets — a duplicate report is as much a disagreement as a ' +
          'missing one.',
        example: 'On the fixture, "she" at position 1 and "he" at position 2 both end at position ' +
          '3, and both must be reported.'
      },
      {
        term: 'The dense goto table is the same trade as KMP\'s automaton, at a larger scale',
        plain: 'Resolve every fallback in advance and matching is one lookup per character.',
        formal: '|alphabet| × states cells; the failure links are never followed at run time',
        readAs: 'Precomputing every transition costs one cell per state per character, and in exchange the ' +
          'scan never walks a failure chain. Memory for a guaranteed one-array-read per character.',
        detail: 'The sparse form follows links on a mismatch, which is a short loop per character; ' +
          'the dense form has no loop at all. The cost is a cell per state per alphabet symbol, and ' +
          'a keyword set has many more states than a single pattern, so the multiplication bites ' +
          'sooner. That is why intrusion-detection and content-filter engines work over bytes: 256 ' +
          'is affordable at ten thousand states and a Unicode alphabet is not.',
        example: 'The same 10-state automaton costs 40 cells on DNA and 400 on source code.'
      },
      {
        term: 'The saving is unbounded in the set size and zero at one pattern',
        plain: 'The automaton is worth building exactly when there is more than one thing to look for.',
        formal: 'saving ≈ k, since the automaton pass is independent of k and the naive alternative is linear in it',
        detail: 'Stating the crossover honestly is what makes the recommendation useful. At one ' +
          'pattern the automaton is a trie construction and a state machine to gain nothing; at two ' +
          'it roughly breaks even against two naive scans; past that the saving is essentially the ' +
          'pattern count. Any system with a *list* of things to find — a filter, a tokeniser\'s ' +
          'reserved words, a signature set — is on the right side of that line.',
        example: 'The saving is 1.08× at one pattern and 33.76× at thirty-two, on the same text.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
