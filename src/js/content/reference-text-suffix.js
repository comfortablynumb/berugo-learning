/** Reference entries for the suffix-structure sections (M06.4-M06.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'suffix-trees': {
      summary: 'A compressed trie of every suffix, built online in linear time by Ukkonen, ' +
        'answering substring questions in time proportional to the pattern.',
      intuition: 'Every substring is a prefix of a suffix. Put all the suffixes in a trie and ' +
        'substring search becomes a walk down; compress the chains so the trie fits.',
      formulation: {
        equations: [
          {
            label: 'Size',
            expr: 'leaves = n + 1 with a unique terminator; nodes ≤ 2n + 1',
            terms: [
              { sym: 'measured', meaning: '1.5 to 2.0 nodes per character across the corpora' }
            ]
          },
          {
            label: 'The three rules',
            expr: 'rule 1: extend every leaf (free) · rule 2: split and add a leaf · rule 3: already present, stop',
            terms: [
              { sym: 'remainder', meaning: '+1 per phase, −1 per rule 2; rule 3 leaves the debt outstanding' }
            ]
          },
          {
            label: 'Queries',
            expr: 'exists(P) = O(m) · count(P) = leaves below the locus',
            terms: [
              { sym: 'independent of n', meaning: 'the text length never enters the walk' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every internal node has at least two children',
          why: 'A single-child internal node means an edge was not compressed.',
          breaks: 'A split that leaves the old child alone under the new node produces one.'
        },
        {
          name: 'Leaves equal the text length, terminator included',
          why: 'A unique terminator makes every suffix explicit, so any shortfall is a lost suffix.',
          breaks: 'A terminator that occurs in the text leaves suffixes implicit and the count short.'
        },
        {
          name: 'The remainder is zero when the build ends',
          why: 'A positive remainder means suffixes were owed and never inserted.',
          breaks: 'An active-point update that is wrong at the root leaves the debt permanently.'
        }
      ],
      complexity: [
        { operation: 'construction', average: 'Θ(n)', worst: 'Θ(n · |Σ|)', note: 'the alphabet factor is in the child lookup' },
        { operation: 'exists(P)', average: 'Θ(m)', worst: 'Θ(m)', note: 'one downward walk' },
        { operation: 'count(P)', average: 'Θ(m)', worst: 'Θ(m + occ)', note: 'Θ(m) with precomputed leaf counts' },
        { operation: 'longest repeated substring', average: 'Θ(n)', worst: 'Θ(n)', note: 'the deepest internal node' },
        { operation: 'suffix array from the tree', average: 'Θ(n)', worst: 'Θ(n · |Σ| log |Σ|)', note: 'sorted DFS over the leaves' },
        { operation: 'space', average: 'Θ(n)', worst: 'Θ(n)', note: '35 to 48 bytes per character, measured' }
      ],
      failureModes: [
        {
          symptom: 'The tree has fewer leaves than the text has characters.',
          cause: 'The terminator occurs in the text, so some suffix is a prefix of another.',
          fix: 'Reject a terminator that appears in the input rather than assuming it does not.'
        },
        {
          symptom: 'Construction is correct and quadratic.',
          cause: 'Missing skip/count in the walk-down, or leaves with a stored rather than shared end index.',
          fix: 'Hop whole edges when the active length exceeds them; make leaf ends an open reference.'
        },
        {
          symptom: 'Occurrence counts are too low on repetitive text.',
          cause: 'Counting leaves in an implicit tree, where some suffixes have no leaf.',
          fix: 'Add the terminator before counting, or count from the suffix array instead.'
        },
        {
          symptom: 'The structure is five times the size the design budgeted.',
          cause: 'The 20-bytes-per-character figure was quoted from an engineered implementation.',
          fix: 'Measure your own node count and node size; a direct implementation lands near 40.'
        }
      ],
      inTheWild: [
        { system: 'MUMmer and other genome aligners (older versions)', how: 'maximal exact matches between genomes' },
        { system: 'Plagiarism and duplicate detection', how: 'longest common substring across documents' },
        { system: 'Data compression research', how: 'as the model behind LZ-family parsing' }
      ],
      sources: [
        { title: 'Ukkonen — On-line construction of suffix trees (Algorithmica 1995)', where: 'the construction, with the active point' },
        { title: 'Gusfield — Algorithms on Strings, Trees and Sequences (1997)', where: 'the standard exposition, chapters 5 and 6' },
        { title: 'McCreight — A space-economical suffix tree construction algorithm (JACM 1976)', where: 'the earlier linear-time construction' },
        { title: 'Kurtz — Reducing the space requirement of suffix trees (SPE 1999)', where: 'where the 20-bytes-per-character figure comes from' }
      ]
    },

    'suffix-arrays': {
      summary: 'The sorted list of suffix start positions, plus an LCP array — every suffix-tree ' +
        'answer at a fifth of the memory.',
      intuition: 'A suffix is fully described by where it starts. Sort those positions and every ' +
        'pattern occupies one contiguous range.',
      formulation: {
        equations: [
          {
            label: 'The array',
            expr: 'sa[i] = start of the i-th smallest suffix · rank[sa[i]] = i',
            terms: [
              { sym: 'space', meaning: '4 bytes per character, plus the text' }
            ]
          },
          {
            label: 'Kasai',
            expr: 'walk i in text order; h falls by at most 1 per step',
            terms: [
              { sym: 'why linear', meaning: 'h decreases ≤ n times, so it increases ≤ 2n times' }
            ]
          },
          {
            label: 'Distinct substrings',
            expr: 'n(n+1)/2 − Σ lcp[i]',
            terms: [
              { sym: 'cross-check', meaning: 'a suffix automaton computes the same number differently' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The array is a permutation of 0 … n − 1',
          why: 'Every suffix appears exactly once; a repeat or a gap is a construction bug.',
          breaks: 'An induced-sort off-by-one writes a position twice and drops another.'
        },
        {
          name: 'The suffixes are in non-decreasing order',
          why: 'Everything downstream — binary search, LCP, ranges — assumes it.',
          breaks: 'A doubling round that compares the wrong rank pair silently reorders a few entries.'
        },
        {
          name: 'lcp[i] is exact, not merely a lower bound',
          why: 'The character after the shared prefix must differ, or the entry is short.',
          breaks: 'A Kasai loop that forgets to decrement h after each row reports short LCPs.'
        }
      ],
      complexity: [
        { operation: 'naive construction', average: 'O(n² log n)', worst: 'O(n² log n)', note: 'each comparison is O(n)' },
        { operation: 'prefix doubling', average: 'O(n log² n)', worst: 'O(n log² n)', note: 'O(n log n) with a radix sort' },
        { operation: 'SA-IS', average: 'Θ(n)', worst: 'Θ(n)', note: 'no character comparisons after the first pass' },
        { operation: 'Kasai LCP', average: 'Θ(n)', worst: 'Θ(n)', note: 'amortised by the h-falls-by-one argument' },
        { operation: 'pattern search', average: 'O(m log n)', worst: 'O(m log n)', note: 'two binary searches' },
        { operation: 'space', average: 'Θ(n)', worst: 'Θ(n)', note: '9 bytes per character with the LCP array and the text' }
      ],
      failureModes: [
        {
          symptom: 'The array is right on English and wrong on a one-letter alphabet.',
          cause: 'A tie-break in the induced sort or the doubling comparator that assumes distinct characters.',
          fix: 'Test every construction on aaaa…a and on a two-letter alphabet, not only on natural text.'
        },
        {
          symptom: 'Most queries work and a few return wrong ranges.',
          cause: 'A fast construction is subtly wrong, and the errors are localised.',
          fix: 'Keep the naive construction as an oracle and assert the arrays agree on every corpus.'
        },
        {
          symptom: 'LCP values are one too small in places.',
          cause: 'The carried match length was not decremented after recording, or was reset per row.',
          fix: 'Record lcp[rank[i]] = h, then h = max(0, h − 1); check that the next characters differ.'
        },
        {
          symptom: 'The search returns occurrences that do not start with the pattern.',
          cause: 'The binary search compared the whole suffix instead of its first m characters.',
          fix: 'Compare the m-character prefix; the answer is the range between the two bounds.'
        }
      ],
      inTheWild: [
        { system: 'BWA, Bowtie and other read aligners', how: 'suffix array or FM-index over a reference genome' },
        { system: 'grep -F on large corpora, indexed search', how: 'the array as a substring index' },
        { system: 'bsdiff, Courgette and binary diffing', how: 'longest common substring between two binaries' }
      ],
      sources: [
        { title: 'Manber, Myers — Suffix arrays: a new method for on-line string searches (SICOMP 1993)', where: 'the structure and prefix doubling' },
        { title: 'Nong, Zhang, Chan — Two efficient algorithms for linear time suffix array construction (2011)', where: 'SA-IS' },
        { title: 'Kasai et al. — Linear-time longest-common-prefix computation (CPM 2001)', where: 'the LCP walk' },
        { title: 'Abouelhoda, Kurtz, Ohlebusch — Replacing suffix trees with enhanced suffix arrays (2004)', where: 'why the array is enough' }
      ]
    },

    'suffix-automata': {
      summary: 'The minimal DFA accepting exactly the substrings of a text, built online, with at ' +
        'most 2n − 1 states.',
      intuition: 'Substrings that always end at the same positions cannot be told apart by anything ' +
        'that follows, so one state can stand for all of them.',
      formulation: {
        equations: [
          {
            label: 'States',
            expr: 'one per endpos equivalence class; ≤ 2n − 1 states, ≤ 3n − 4 transitions',
            terms: [
              { sym: 'tight', meaning: 'both bounds are achieved by specific strings' }
            ]
          },
          {
            label: 'The clone condition',
            expr: 'if len(q) > len(p) + 1 then clone q with len = len(p) + 1',
            terms: [
              { sym: 'q', meaning: 'the state reached from p by the new character' }
            ]
          },
          {
            label: 'Distinct substrings',
            expr: 'Σ over v ≠ init of (len(v) − len(link(v)))',
            terms: [
              { sym: 'must equal', meaning: 'n(n+1)/2 − Σ lcp from the suffix array' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'link(v) is strictly shorter than v',
          why: 'The links form a tree ordered by length, and every algorithm on them assumes it.',
          breaks: 'A clone linked to the wrong state creates a cycle or a length inversion.'
        },
        {
          name: 'count(v) = Σ count(link children) + [v is a prefix state]',
          why: 'Endpos sets are unions of their link children\'s plus the state\'s own prefix position.',
          breaks: 'A missing clone or a clone given an initial count of 1 violates it immediately.'
        },
        {
          name: 'The state and transition counts stay inside 2n − 1 and 3n − 4',
          why: 'They are proved bounds, so exceeding them is a construction bug rather than bad luck.',
          breaks: 'Cloning when the condition does not hold inflates both.'
        }
      ],
      complexity: [
        { operation: 'extend(c)', average: 'O(1) amortised', worst: 'O(|Σ|)', note: 'the link walk is amortised over the build' },
        { operation: 'construction', average: 'Θ(n)', worst: 'Θ(n log |Σ|)', note: 'with a map per state' },
        { operation: 'exists(P)', average: 'Θ(m)', worst: 'Θ(m log |Σ|)', note: 'one transition per character' },
        { operation: 'count(P)', average: 'Θ(m)', worst: 'Θ(m)', note: 'with occurrence counts precomputed' },
        { operation: 'distinct substrings', average: 'Θ(states)', worst: 'Θ(states)', note: 'one pass over the link tree' },
        { operation: 'space', average: 'Θ(n)', worst: 'Θ(n)', note: '17 to 35 bytes per character, measured' }
      ],
      failureModes: [
        {
          symptom: 'The automaton accepts strings that do not occur in the text.',
          cause: 'The clone case was skipped, producing a factor oracle rather than a suffix automaton.',
          fix: 'Implement the clone; check with brute force on non-substrings or with the endpos identity.'
        },
        {
          symptom: 'Occurrence counts are too high on repetitive text.',
          cause: 'A clone was seeded with a count of 1; a clone is not itself a prefix of the text.',
          fix: 'Seed only the prefix states, then propagate in decreasing len order.'
        },
        {
          symptom: 'Every membership test passes and the distinct-substring count is wrong.',
          cause: 'A membership test cannot detect over-acceptance, and the count can.',
          fix: 'Assert the count against the suffix array\'s n(n+1)/2 − Σ lcp on every corpus.'
        },
        {
          symptom: 'The state count exceeds 2n − 1.',
          cause: 'Cloning unconditionally rather than only when len(q) > len(p) + 1.',
          fix: 'Check the condition; the bound is proved, so violating it is always a bug.'
        }
      ],
      inTheWild: [
        { system: 'Competitive programming libraries', how: 'the standard tool for substring counting and longest common substring' },
        { system: 'BOM and set-BOM string matching', how: 'the factor oracle variant, as a filter with verification' },
        { system: 'Music and pattern-discovery systems', how: 'the factor oracle for repeated-motif detection' }
      ],
      sources: [
        { title: 'Blumer et al. — The smallest automaton recognizing the subwords of a text (TCS 1985)', where: 'the structure and its bounds' },
        { title: 'Crochemore — Transducers and repetitions (TCS 1986)', where: 'the online construction' },
        { title: 'Allauzen, Crochemore, Raffinot — Factor oracle: a new structure for pattern matching (1999)', where: 'the oracle, and what it gives up' },
        { title: 'Crochemore, Hancart, Lecroq — Algorithms on Strings (2007)', where: 'the modern treatment, with proofs of both bounds' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
