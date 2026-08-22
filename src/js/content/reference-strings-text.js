/** Reference entries for regular-expression engines and text processing (M15.10-M15.11). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'regex-engines': {
      summary: 'Thompson construction, a state-set simulation whose cost is fixed by the pattern, ' +
        'and a backtracking engine whose cost is fixed by the attacker — measured on the same ' +
        'patterns, with the agreement check that has to come first.',
      intuition: 'At a split, one engine chooses and remembers; the other keeps both. Everything ' +
        'else follows from that.',
      formulation: {
        equations: [
          {
            label: 'The construction',
            expr: 'each parse node becomes a fragment with one entry and a list of dangling exits',
            terms: [
              { sym: 'concatenation', meaning: 'patch the first fragment\'s exits to the second\'s entry' },
              { sym: 'alternation', meaning: 'a split state to both entries, exits unioned' },
              { sym: 'star', meaning: 'a split whose body loops back to the split' },
              { sym: 'measured', meaning: '`(a+)+b` is 5 states — the count is linear in the pattern' }
            ]
          },
          {
            label: 'The simulation',
            expr: 'per character, step the whole set of reachable states at once',
            terms: [
              { sym: 'the bound', meaning: 'the set cannot be larger than the machine, so the cost is O(n · m)' },
              { sym: 'measured', meaning: 'a state-set peak of 4 at every input length from 6 to 22' },
              { sym: 'why it matters', meaning: 'the per-character cost is fixed when the pattern compiles, before any input exists' }
            ]
          },
          {
            label: 'Backtracking on an almost-match',
            expr: 'the failing case must exhaust every path',
            terms: [
              { sym: 'lengths 6 to 18', meaning: '256, 1 024, 4 096, 16 384, 65 536, 262 144, 1 048 576 steps' },
              { sym: 'the simulation over the same range', meaning: '46, 62, 78, 94, 110, 126, 142' },
              { sym: 'the ratio', meaning: '5.6x, 16.5x, 52.5x, 174.3x, 595.8x, 2080.5x, 7384.3x — about 16x per four characters' },
              { sym: 'at 20 and 22', meaning: 'the 2 000 000-step budget is exhausted; the simulation takes 158 and 174' }
            ]
          },
          {
            label: 'What triggers it',
            expr: 'a quantifier nested inside another over the SAME characters',
            terms: [
              { sym: 'catastrophic', meaning: '`(a+)+b` 16 384, `(a|a)*b` 32 766, `(a*)*b` 16 385 at n = 12, all exhausted at n = 20' },
              { sym: 'safe', meaning: '`a*b` 28 to 44, `(ab)*c` 6 to 6, `(a|b)*abb` 68 to 108 over the same lengths' },
              { sym: 'the pair that isolates it', meaning: '`a*b` and `(a*)*b` differ by three characters' },
              { sym: 'the simulation column', meaning: '158, 205, 164, 123, 8, 244 at n = 20 — ambiguity costs it nothing' }
            ]
          },
          {
            label: 'Agreement before speed',
            expr: 'the verdict table is the precondition for the timing table',
            terms: [
              { sym: 'measured', meaning: '0 of 12 fixtures disagree, over empty matches, alternation, `.`, `+` and `?`' },
              { sym: 'what is absent', meaning: 'captures and backreferences — the set has thrown away which path put a state in it' },
              { sym: 'why absent', meaning: 'a language with backreferences is not regular, so linear time and backreferences cannot coexist' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The state count is linear in the pattern',
          why: 'It is the m in O(n · m), and it is fixed before the input arrives.',
          breaks: 'A construction that duplicates fragments for bounded repetition loses the bound quietly.'
        },
        {
          name: 'The state set never exceeds the state count',
          why: 'It is the entire safety argument for accepting a user-supplied pattern.',
          breaks: 'A simulation that pushes duplicates instead of a set degenerates to the backtracking cost.'
        },
        {
          name: 'Both engines accept the same language',
          why: 'A speed comparison between engines that disagree is a comparison of two different programs.',
          breaks: 'Differences hide in empty matches, greedy versus lazy, and anchoring — never in the obvious cases.'
        },
        {
          name: 'The dangerous cost is paid on failure, not on success',
          why: 'It is why a benchmark built from matching inputs reports that everything is fine.',
          breaks: 'An attacker supplies an almost-match, which is cheaper to construct than a match.'
        }
      ],
      complexity: [
        { operation: 'Thompson construction', average: 'Θ(m) states and Θ(m) time', worst: '5 states for `(a+)+b`' },
        { operation: 'state-set simulation', average: 'Θ(n · m)', worst: '142 steps at n = 18, 174 at n = 22' },
        { operation: 'backtracking, matching input', average: 'often linear', worst: 'the cheap case, and the one benchmarks measure' },
        { operation: 'backtracking, almost-matching input', average: 'exponential in the ambiguous run', worst: '1 048 576 steps at n = 18; budget exhausted at n = 20' },
        { operation: 'lazy DFA (what RE2 and Go add)', average: 'amortised O(n) with a bounded state cache', worst: 'not built here; the simulation above is the NFA one' },
        { operation: 'backreferences', average: 'not expressible in either machine', worst: 'NP-hard in general, and refused outright by linear-time engines' }
      ],
      failureModes: [
        {
          symptom: 'A service hangs on one request and recovers when it is killed.',
          cause: 'A user-supplied or user-influenced string hit a nested quantifier in a backtracking engine.',
          fix: 'Move to a state-set or lazy-DFA engine, or apply a step budget and a timeout per match.'
        },
        {
          symptom: 'A pattern is reviewed, looks harmless and still blows up.',
          cause: 'The trigger is nesting over the same characters, not pattern length or apparent complexity.',
          fix: 'Test the failing case: the pattern against a long almost-match, not against inputs that match.'
        },
        {
          symptom: 'Switching engines changes which inputs a filter admits.',
          cause: 'The two engines disagree somewhere — usually empty matches, laziness or anchoring.',
          fix: 'Run a verdict fixture set through both before any migration; it is the cheap half of the work.'
        },
        {
          symptom: 'A linear-time engine rejects a pattern that worked before.',
          cause: 'It contains a backreference, which cannot be simulated by a state set at all.',
          fix: 'Rewrite the pattern, or keep the backtracking engine for that one case with a hard budget.'
        }
      ],
      inTheWild: [
        { system: 'RE2 and Go regexp', how: 'Thompson simulation with a lazy DFA cache, and backreferences refused by design' },
        { system: 'PCRE, Perl, Java, JavaScript', how: 'backtracking with captures and backreferences, plus per-match limits where they exist' },
        { system: 'Cloudflare, 2 July 2019', how: 'a global outage from one regular expression with catastrophic backtracking' },
        { system: 'Rust regex and Hyperscan', how: 'linear-time guarantees, with literal prefilters in front of the automaton' }
      ],
      sources: [
        { title: 'Programming Techniques: Regular expression search algorithm', where: 'Ken Thompson — CACM, 1968' },
        { title: 'Regular Expression Matching Can Be Simple And Fast', where: 'Russ Cox, 2007 — and the two follow-up articles' },
        { title: 'Details of the Cloudflare outage on July 2, 2019', where: 'John Graham-Cumming — Cloudflare blog' },
        { title: 'Introduction to Automata Theory, Languages, and Computation', where: 'Hopcroft, Motwani, Ullman' }
      ]
    },

    'text-processing': {
      summary: 'Three decisions that look like plumbing — what a token is, what a template is, and ' +
        'what a candidate is — each measured, and each one deciding either the cost or the answer ' +
        'but never both.',
      intuition: 'A pipeline is stages that narrow. The filter owns the cost, the verifier owns the ' +
        'answer, and a filter that moves recall has quietly become a verifier.',
      formulation: {
        equations: [
          {
            label: 'Tokenisation',
            expr: 'the same line, three ways',
            terms: [
              { sym: 'whitespace', meaning: '4 tokens — `/api/login` is an atom, right for routes and wrong for prefixes' },
              { sym: 'rule-based', meaning: '8 tokens — letters, digits and punctuation split apart' },
              { sym: 'byte-pair, 60 merges', meaning: '4.90 characters per token on a vocabulary of 84' },
              { sym: 'the trade', meaning: 'more merges means a larger vocabulary and shorter sequences; zero merges is a character tokeniser' }
            ]
          },
          {
            label: 'Template extraction',
            expr: 'group by token similarity, then wildcard the positions where the group disagrees',
            terms: [
              { sym: 'measured', meaning: '4 templates from 300 lines at 1 348 token comparisons' },
              { sym: 'the largest', meaning: '`GET <*> <*> <*>` covering 182 lines, 3 of 4 positions wildcarded' },
              { sym: 'the rest', meaning: '41, 39 and 38 lines with 0 wildcards — literal lines that simply repeat' },
              { sym: 'what it needs', meaning: 'no schema, no regular expression, no cooperation from whoever wrote the log' }
            ]
          },
          {
            label: 'The threshold sweep, 0.20 to 0.90',
            expr: 'both ends are degenerate and the algorithm is content at both',
            terms: [
              { sym: 'templates', meaning: '3, 4, 4, 4, 7, 7, 8, 8' },
              { sym: 'the largest template', meaning: '182 lines down to 46' },
              { sym: 'wildcards in it', meaning: '3 of 4 down to 0 of 4' },
              { sym: 'comparisons', meaning: '1 188 up to 2 832 — the knob costs 2.4x and decides far more' }
            ]
          },
          {
            label: 'Similarity, six pairs and four metrics',
            expr: 'no metric is right on every row',
            terms: [
              { sym: 'Jon Smyth / John Smith (match)', meaning: '0.800 Levenshtein, 0.917 Jaro-Winkler, 0.417 Jaccard, 0.589 cosine' },
              { sym: 'service-a / service-b (NOT a match)', meaning: '0.889, 0.956, 0.778, 0.875 — above any workable cutoff' },
              { sym: 'user-1234 / user-1235 (NOT a match)', meaning: 'the same 0.956 by Jaro-Winkler' },
              { sym: 'Elizabeth Windsor / Windsor Elizabeth (match)', meaning: '0.059 by Levenshtein ratio against 0.778 by Jaccard on 2-grams' },
              { sym: 'why', meaning: 'prefix weighting fits names and breaks identifiers; token sets ignore order and edit distance charges for it' }
            ]
          },
          {
            label: 'The linkage pipeline',
            expr: 'cost = records × filter + candidates × verify',
            terms: [
              { sym: 'blocked', meaning: '267 records to 12 candidates, selectivity 0.045' },
              { sym: 'unblocked', meaning: '267 to 267, selectivity 1.000' },
              { sym: 'the answer', meaning: 'precision 50% and recall 100% in BOTH — 8 returned for 4 expected' },
              { sym: 'the reading', meaning: 'the filter moved the cost by about 22x and the answer not at all' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'A wildcard sits exactly where a group disagreed',
          why: 'That is the definition of a variable field, and it is why no configuration is needed.',
          breaks: 'A template with wildcards everywhere means the threshold merged unrelated lines.'
        },
        {
          name: 'The filter admits everything the verifier would accept',
          why: 'Soundness is what makes the pipeline\'s recall a property rather than an observation.',
          breaks: 'A lossy filter is a second verifier with no bound on its error, hidden in the cheap stage.'
        },
        {
          name: 'Precision and recall are reported separately',
          why: 'One number cannot say whether a change dropped a false positive or a true match.',
          breaks: 'A single accuracy figure moves for opposite reasons and is unreadable.'
        },
        {
          name: 'A cutoff is set by the highest-scoring NON-match',
          why: 'The matching pairs never constrain a threshold; the near misses do.',
          breaks: 'Tuning on positive examples produces a cutoff that merges two accounts.'
        }
      ],
      complexity: [
        { operation: 'whitespace tokenising', average: 'Θ(characters)', worst: '4 tokens on a line the rule-based tokeniser splits into 8' },
        { operation: 'byte-pair training', average: 'Θ(merges × corpus) naively', worst: '60 merges give 4.90 chars/token, vocabulary 84' },
        { operation: 'template extraction', average: 'Θ(lines × groups × tokens)', worst: '1 348 comparisons at threshold 0.50, 2 832 at 0.90' },
        { operation: 'unfiltered verification', average: 'Θ(records) verifier calls per query', worst: 'all 267 records verified, selectivity 1.000' },
        { operation: 'blocked comparison', average: 'Θ(records + candidates × verify)', worst: '12 candidates, selectivity 0.045' },
        { operation: 'Jaro-Winkler / Levenshtein per pair', average: 'Θ(len) and Θ(len²)', worst: 'the verifier is the expensive stage, so the candidate count multiplies it' }
      ],
      failureModes: [
        {
          symptom: 'Two different accounts are merged into one record.',
          cause: 'A prefix-weighted name metric was used on identifiers, where the discriminating character is last.',
          fix: 'Choose the metric per field, and validate against pairs that must not match.'
        },
        {
          symptom: 'A deduplication run misses obvious duplicates.',
          cause: 'A character-level distance was used on fields whose parts get reordered.',
          fix: 'Use a token-set metric there; "Elizabeth Windsor" and "Windsor Elizabeth" score 0.059 against 0.778.'
        },
        {
          symptom: 'Log templates are either one giant wildcard or one per line.',
          cause: 'The similarity threshold is at a degenerate end and the algorithm cannot tell.',
          fix: 'Sweep it and print the largest template and its wildcard count at each setting.'
        },
        {
          symptom: 'Making the verifier faster barely helps.',
          cause: 'The cost is the candidate count, which the filter sets.',
          fix: 'Measure selectivity and candidates per result first; it is one counter and it decides where the work goes.'
        },
        {
          symptom: 'Recall drops after a "performance-only" change to the prefilter.',
          cause: 'The filter stopped being sound, so it now decides part of the answer.',
          fix: 'Report precision and recall for every filter change, not only the throughput.'
        }
      ],
      inTheWild: [
        { system: 'Drain and Drain3', how: 'fixed-depth-tree log template extraction, the algorithm this section measures' },
        { system: 'Splunk, Elastic and Datadog', how: 'automatic log pattern detection presented as a small table of templates' },
        { system: 'SentencePiece and tiktoken', how: 'byte-pair and unigram subword vocabularies trained from the corpus' },
        { system: 'Record-linkage systems (Dedupe, Splink)', how: 'blocking keys, then per-field comparators with separate precision and recall reporting' }
      ],
      sources: [
        { title: 'Drain: An Online Log Parsing Approach with Fixed Depth Tree', where: 'He, Zhu, Zheng, Lyu — ICWS, 2017' },
        { title: 'Neural Machine Translation of Rare Words with Subword Units', where: 'Sennrich, Haddow, Birch — ACL, 2016 — byte-pair encoding' },
        { title: 'Advances in Record Linkage Methodology', where: 'Fellegi, Sunter — JASA, 1969' },
        { title: 'Data Matching', where: 'Peter Christen, 2012 — blocking, comparison functions and evaluation' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
