/** Concepts for the suffix-structure sections (M06.4-M06.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'suffix-trees': [
      {
        term: 'The suffix trie is quadratic',
        plain: 'Every suffix of a length-n text, uncompressed, is n(n+1)/2 nodes.',
        formal: 'Σ |suffix i| = n(n+1)/2',
        detail: 'The idea is obvious and the naive form is unusable: put every suffix into a trie ' +
          'and substring search becomes a walk down. For a 2 000-character text that is two million ' +
          'nodes, and for a genome it is not a structure, it is a joke. Compressing every ' +
          'non-branching chain into one edge fixes the space — the compressed tree has at most 2n ' +
          'nodes because there are n leaves and every internal node branches — but it does not fix ' +
          'the construction, which is still quadratic if each suffix is inserted from the root.',
        example: 'banana has 21 suffix-trie nodes and 11 suffix-tree nodes.'
      },
      {
        term: 'A unique terminator',
        plain: 'Appending a character that occurs nowhere else makes every suffix end at its own leaf.',
        formal: 'no suffix is a prefix of another ⇒ leaves = n + 1',
        detail: 'Without it a suffix that is also a prefix of a longer suffix ends inside an edge, ' +
          'with nothing to mark it — the tree is *implicit*, and questions like "how many times ' +
          'does P occur" become wrong because counting leaves under a match point misses the ' +
          'suffixes that have no leaf. The terminator costs one character and one leaf and makes ' +
          'every suffix explicit. It also has to genuinely not occur in the text, which is worth ' +
          'enforcing rather than assuming: a "$" in user input silently corrupts the tree.',
        example: 'banana$ gives 7 leaves for 7 suffixes; banana alone would give 4.'
      },
      {
        term: 'Open edges make rule 1 free',
        plain: 'A leaf stores "the current end", so extending the text extends every leaf at once.',
        formal: 'leaf.end = ∞, resolved to the current position when read',
        detail: 'This is the first of Ukkonen\'s three tricks and the easiest to miss when reading ' +
          'the algorithm, because it is a representation choice rather than a step. In the ' +
          'phase-by-phase definition, every existing leaf must be extended by the new character; ' +
          'storing the end index as a shared "current position" makes all of those extensions ' +
          'happen for free, at once, by incrementing one variable. Without it the construction ' +
          'does Θ(n) leaf updates per phase and is quadratic no matter what else is clever.',
        example: 'one variable increment extends every leaf, so rule 1 costs nothing per phase.'
      },
      {
        term: 'The active point',
        plain: 'Where the last insertion happened: a node, an edge and a distance along it.',
        formal: '(activeNode, activeEdge, activeLength)',
        detail: 'The naive construction restarts at the root for every suffix of every prefix, which ' +
          'is where the second factor of n comes from. The active point is the memory that removes ' +
          'it: the next insertion begins where the last one ended. Keeping it correct is most of ' +
          'the implementation work, because it has to be adjusted after every rule application and ' +
          'the adjustment differs depending on whether the active node is the root. It is also ' +
          'exactly what a step-through visualisation should show, because the three numbers *are* ' +
          'the algorithm\'s state.',
        example: 'after phase 6 of banana$ the active point is (root, "a", 3) with remainder 3.'
      },
      {
        term: 'Suffix links',
        plain: 'From the node spelling cα, a pointer to the node spelling α.',
        formal: 'link(node for cα) = node for α',
        detail: 'After splitting at some point inside suffix i, the corresponding point in suffix ' +
          'i + 1 is the same string with its first character removed — and the suffix link goes ' +
          'straight there instead of walking down from the root again. Every internal node created ' +
          'during a phase gets a link to the next internal node created in that phase, which is why ' +
          'they can be built in the same pass that uses them. They are also what makes the tree ' +
          'more than a set of answers: algorithms like matching statistics and Ukkonen\'s own ' +
          'analysis are stated in terms of the links, not the edges.',
        example: 'the node for "ana" links to the node for "na", which links to the root.'
      },
      {
        term: 'The remainder',
        plain: 'How many suffixes the tree still owes.',
        formal: 'incremented once per phase, decremented once per rule-2 application',
        detail: 'Each phase adds a character and therefore owes one more suffix. Rule 2 — split an ' +
          'edge or hang a new leaf — pays one back. Rule 3 — the character is already on the edge — ' +
          'ends the phase immediately and leaves the debt outstanding, because those suffixes are ' +
          'present implicitly, inside an edge, with no leaf of their own. Watching the remainder ' +
          'rise through banana\'s repeated "ana" and collapse to zero when the terminator arrives ' +
          'is the clearest way to see what "implicit tree" means.',
        example: 'banana$: the remainder climbs to 3 by phase 6 and drops to 0 at the terminator.'
      },
      {
        term: 'Occurrences are leaves below the match',
        plain: 'Walk the pattern down, then count the leaves in the subtree you land in.',
        formal: 'count(P) = leaves below the locus of P',
        detail: 'Every leaf is a suffix start position, and every suffix starting with P corresponds ' +
          'to an occurrence of P, so the number of occurrences is the number of leaves below the ' +
          'point where the pattern walk ends. That makes existence O(m) and counting O(m + occ) ' +
          'unless the leaf counts are precomputed, in which case counting is O(m) too. The same ' +
          'walk answers "where" by listing those leaves, which is the query a plain index of ' +
          'positions would need to have been built for in advance.',
        example: 'in banana, "ana" ends above 2 leaves and occurs at positions 1 and 3.'
      },
      {
        term: 'Twenty bytes was never the number',
        plain: 'Measured node counts put a straightforward implementation near 40 bytes per character.',
        formal: 'nodes/char × bytes/node, both measured rather than quoted',
        detail: 'The figure repeated in textbooks is Kurtz\'s heavily engineered 20 bytes per input ' +
          'character, which took a paper to achieve. A direct implementation stores start, end, ' +
          'suffix link and parent per node and holds 1.5 to 2.0 nodes per character, which lands ' +
          'between 35 and 48. A suffix array plus an LCP array answers the same questions in 9. ' +
          'Quoting the engineered constant while writing the direct implementation is how a design ' +
          'ends up with a structure five times the size it was budgeted for.',
        example: 'DNA: 1.76 nodes per character, 42.3 bytes per character against the array\'s 9.'
      }
    ],

    'suffix-arrays': [
      {
        term: 'Sorted suffix starts',
        plain: 'One integer per character, in the order the suffixes sort.',
        formal: 'sa[i] = start of the i-th smallest suffix',
        detail: 'The array holds no characters and no pointers — the text is already there, and a ' +
          'suffix is fully described by where it starts. That is the entire space argument: four ' +
          'bytes per character where a suffix tree needs a node with four fields, and the ' +
          'difference is not asymptotic, it is a constant of about five that decides whether a ' +
          'human genome fits in memory. Everything else in the section is about recovering the ' +
          'suffix tree\'s abilities from this much smaller object.',
        example: 'mississippi: sa = 10, 7, 4, 1, 0, 9, 8, 6, 3, 5, 2.'
      },
      {
        term: 'A pattern occupies one contiguous range',
        plain: 'Every suffix beginning with P sorts together, so a search is two binary searches.',
        formal: 'occurrences(P) = sa[first … last), found in O(m log n)',
        detail: 'This follows immediately from sorting and it is the property the structure exists ' +
          'for: if two suffixes both begin with P then everything sorting between them also begins ' +
          'with P. So the answer set is an interval, and the two ends are found by binary search ' +
          'with an O(m) comparison at each of the log n steps. No index of positions is needed and ' +
          'no auxiliary structure is consulted — which is why a suffix array is the smallest thing ' +
          'that can answer "where does this occur" without scanning.',
        example: 'in mississippi, "ssi" occupies ranks 9 and 10 — a range of 2.'
      },
      {
        term: 'The LCP array',
        plain: 'lcp[i] is how many characters suffix sa[i] shares with sa[i − 1].',
        formal: 'lcp[i] = |longest common prefix of sa[i − 1] and sa[i]|',
        detail: 'It is what turns a sorted list into the equal of a tree. The internal nodes of a ' +
          'suffix tree correspond exactly to the local minima structure of the LCP array, so ' +
          'anything the tree answers by finding a deep internal node, the array answers by finding ' +
          'a large LCP entry. The longest repeated substring is the maximum entry. The number of ' +
          'distinct substrings is n(n+1)/2 minus the sum. Reading the LCP column beside the ' +
          'suffixes is reading the repeated structure of the text directly.',
        example: 'mississippi: the largest LCP entry is 4, and the repeat it marks is "issi".'
      },
      {
        term: 'Kasai\'s amortised walk',
        plain: 'Compute the LCPs in text order, not array order, and carry the match length.',
        formal: 'h can fall by at most 1 per step, so total work is O(n)',
        detail: 'The trick is a one-line observation with a large consequence: if suffix i shares h ' +
          'characters with its neighbour, then suffix i + 1 — the same string with the first ' +
          'character removed — shares at least h − 1 with *its* neighbour. So walking the suffixes ' +
          'in text order and carrying h means h decreases at most n times overall and therefore ' +
          'increases at most 2n times, giving a linear algorithm out of what looks like it must be ' +
          'quadratic. Walking in array order instead gives no such bound, and that is the version ' +
          'people write first.',
        example: 'over 4 000 characters Kasai does about 8 000 character steps, not 8 million.'
      },
      {
        term: 'Prefix doubling',
        plain: 'Sort by 1 character, then use the ranks to sort by 2, 4, 8 …',
        formal: 'rank_{2k}(i) = (rank_k(i), rank_k(i + k))',
        detail: 'The insight is that once suffixes are ranked by their first k characters, comparing ' +
          'the first 2k characters of two suffixes is comparing a pair of integers rather than a ' +
          'pair of strings — because the second half of a suffix starting at i is a suffix starting ' +
          'at i + k, whose rank is already known. That makes each round a sort of integer pairs and ' +
          'there are log n rounds. It also gives the rank table, which is the algorithm made ' +
          'visible: watching it stop changing is watching the suffixes become distinguishable.',
        example: 'mississippi needs 3 rounds — the ranks are all distinct after 4 characters.'
      },
      {
        term: 'SA-IS sorts by induction',
        plain: 'Classify positions S or L, place the LMS seeds, and induce the rest twice.',
        formal: 'S-type: suffix i < suffix i + 1; LMS: an S-type after an L-type',
        detail: 'The linear construction does no character comparisons after the first pass. It ' +
          'classifies each position by whether its suffix sorts before the next one, places the ' +
          'left-most S-type positions into their buckets, and then derives the order of every other ' +
          'suffix from those seeds by two scans — L-types left to right from the bucket heads, ' +
          'S-types right to left from the tails. If the seeds are not yet distinguishable it ' +
          'recurses on a reduced string. The whole algorithm is bucket arithmetic, which is why it ' +
          'is linear and why it is hard to read.',
        example: '4 000 characters of DNA: 4 recursions, zero character comparisons.'
      },
      {
        term: 'The naive construction is the reference',
        plain: 'Sorting the suffixes as strings is slow, obviously correct, and therefore useful.',
        formal: 'O(n² log n): each of the O(n log n) comparisons is O(n)',
        detail: 'A construction that is fast and wrong is the failure mode here, and it is not ' +
          'catchable by inspection — an off-by-one in the induced sort produces an array that looks ' +
          'entirely plausible and answers most queries correctly. Keeping the obviously-correct ' +
          'version and asserting the two agree on every corpus, including a one-letter alphabet, is ' +
          'the only cheap defence. The cost column also makes the point the section is about: the ' +
          'naive version does 77 million character comparisons where the others do none.',
        example: 'DNA 4 000: naive 42 555 comparisons touching 77 241 942 characters.'
      },
      {
        term: 'Distinct substrings, two ways',
        plain: 'n(n+1)/2 minus the sum of the LCP array, which a suffix automaton must agree with.',
        formal: 'distinct = n(n+1)/2 − Σ lcp[i]',
        detail: 'Every substring is a prefix of some suffix, so summing the suffix lengths counts ' +
          'every substring once per suffix it prefixes; subtracting the LCP sum removes exactly the ' +
          'duplicates, because two adjacent suffixes share precisely lcp[i] prefixes. The value is ' +
          'worth computing not for itself but because a suffix automaton computes the same quantity ' +
          'by a completely different route — summing len(v) − len(link(v)) over its states — and ' +
          'two independent computations agreeing is a far stronger check than either passing its ' +
          'own tests.',
        example: 'mississippi: 66 − 13 = 53 distinct substrings, and the automaton also says 53.'
      }
    ],

    'suffix-automata': [
      {
        term: 'The minimal DFA of all substrings',
        plain: 'One automaton accepting exactly the substrings of the text, and nothing else.',
        formal: 'L(A) = { P : P occurs in T }',
        detail: 'A trie of all substrings is quadratic; the minimal deterministic automaton for the ' +
          'same language is linear — at most 2n − 1 states and 3n − 4 transitions, both tight. That ' +
          'is remarkable enough on its own, and it is buildable online in one left-to-right pass, ' +
          'which is more remarkable. Membership is one transition per pattern character with no ' +
          'edge labels to compare and no binary search, so it is the fastest of the substring ' +
          'indexes to query and the hardest of them to write.',
        example: 'abbbaab: 10 states, 13 transitions, 21 distinct substrings.'
      },
      {
        term: 'A state is an endpos class',
        plain: 'One state stands for every substring that ends at exactly the same set of positions.',
        formal: 'endpos(P) = { i : T[i − |P| … i) = P }',
        detail: 'Two substrings that always co-occur — always end together — cannot be distinguished ' +
          'by anything that follows them, so a minimal automaton must merge them. That is the whole ' +
          'reason the state count is linear rather than quadratic: the number of distinct endpos ' +
          'sets is bounded even though the number of substrings is not. Each state stores `len`, ' +
          'the longest string in its class; the shortest is one more than its suffix link\'s len, ' +
          'so a state represents a contiguous range of lengths.',
        example: 'in abbbaab the substrings "b", "bb" and "abb" do not share an endpos set.'
      },
      {
        term: 'The link tree is containment',
        plain: 'A state\'s suffix link points at the state holding the next shorter class.',
        formal: 'endpos(v) ⊊ endpos(link(v)), and the links form a tree',
        detail: 'Removing characters from the front of a substring can only ever add end positions, ' +
          'never remove them, so the endpos sets nest — and the suffix links, which walk to the ' +
          'next shorter class, therefore form a tree ordered by set containment. That tree is where ' +
          'most of the automaton\'s applications live: occurrence counting propagates up it, the ' +
          'longest common substring of two texts is found in it, and the check that catches a ' +
          'broken construction is stated on it.',
        example: 'a state\'s occurrence count is the sum of its link children\'s, plus one if it is a prefix.'
      },
      {
        term: 'The clone',
        plain: 'When a state reached by the new character is too long, split it in two.',
        formal: 'if len(q) > len(p) + 1: copy q with len = len(p) + 1 and repoint',
        detail: 'This is the entire difficulty of the construction. The situation is that a state ' +
          'currently mixes substrings which the new character has just separated into different ' +
          'endpos classes — some of them now also end at the new position and some do not. The fix ' +
          'is to make a copy with the shorter length and the same outgoing transitions, repoint the ' +
          'transitions that should now reach the shorter class at the copy, and link both the ' +
          'original and the new state to it. Every part of that sentence is load-bearing, and ' +
          'implementations from memory drop one of them.',
        example: 'abbbaab needs 2 clones; mississippi needs 6; a string of one letter needs none.'
      },
      {
        term: 'Skipping the clone accepts a superset',
        plain: 'The broken automaton still accepts every substring — plus strings that never occurred.',
        formal: 'L(oracle) ⊇ L(automaton), with the inclusion strict in general',
        detail: 'This is why the clone case is dangerous rather than merely hard. An automaton built ' +
          'without it passes every test of the form "insert the text, check that each of its ' +
          'substrings is accepted", because accepting more is not detected by such a test. What it ' +
          'does is accept strings that do not occur, and the only ways to notice are a check ' +
          'against brute force over non-substrings, or the endpos identity on the link tree. A ' +
          'spot check is not a test here.',
        example: 'the oracle for abbbaab accepts "aba", "abaa" and "abba" — none of which occur.'
      },
      {
        term: 'The factor oracle is that structure, kept on purpose',
        plain: 'Exactly n + 1 states, no clones, and a known false-accept rate.',
        formal: 'states = n + 1 always; L(oracle) ⊇ substrings(T)',
        detail: 'It is the same left-to-right construction with the clone step removed, and it is ' +
          'used deliberately in string-matching algorithms where a false accept costs a ' +
          'verification step and nothing else — BOM and its descendants search with one. Keeping it ' +
          'beside the real automaton is the cheapest way to make the clone\'s value concrete: two ' +
          'structures, one obviously smaller, and a table of the strings the smaller one gets ' +
          'wrong. Using it where correctness matters is a real bug that looks like an optimisation.',
        example: 'abbbaab: 8 oracle states against 10 automaton states, and 3 false accepts.'
      },
      {
        term: 'Counting occurrences up the link tree',
        plain: 'Give each prefix state a 1, give clones a 0, and propagate up the links.',
        formal: 'count(v) = [v is a prefix state] + Σ count(children in the link tree)',
        detail: 'A state\'s occurrence count is the size of its endpos set, and endpos sets are ' +
          'unions of their link children\'s plus the state\'s own end position when it is a prefix ' +
          'of the text. So one pass down the text to mark the prefix states and one pass over the ' +
          'states in decreasing length order computes every count. Giving a clone an initial 1 is ' +
          'the second classic bug — a clone is not itself a prefix — and it inflates counts in a ' +
          'way that only shows up on repeated texts.',
        example: 'process states in decreasing len order; a clone starts at 0, not 1.'
      },
      {
        term: 'Two computations of one quantity',
        plain: 'Σ (len(v) − len(link(v))) must equal n(n+1)/2 − Σ lcp.',
        formal: 'automaton and suffix array count distinct substrings independently',
        detail: 'Each state is the longest representative of a contiguous range of lengths, so ' +
          'summing len(v) − len(link(v)) over every state but the initial one counts each distinct ' +
          'substring exactly once. The suffix array reaches the same number by an entirely ' +
          'different route. Asserting they agree, on repetitive and random and one-letter inputs, ' +
          'is the strongest cheap check available for either structure — far stronger than any ' +
          'membership spot check, because it depends on the whole structure rather than on one ' +
          'path through it.',
        example: 'DNA 2 000: both routes give 1 978 348 distinct substrings.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
