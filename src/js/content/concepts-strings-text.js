/** Concepts for regular-expression engines and text processing (M15.10-M15.11). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'regex-engines': [
      {
        term: 'Thompson construction: every parse node becomes a fragment',
        plain: 'A fragment has one entry state and a list of dangling exits, and fragments compose.',
        formal: 'the state count is linear in the pattern length, by construction',
        detail: 'Concatenation patches one fragment\'s dangling exits to the next fragment\'s entry; ' +
          'alternation makes a split state pointing at both entries and unions the exits; a star ' +
          'makes a split whose second branch is the fragment and patches the fragment back to the ' +
          'split. Each rule adds a bounded number of states, so the whole machine is linear in the ' +
          'pattern — which is the fact the running-time bound rests on.',
        example: '`(a+)+b` compiles to 5 states: one char state per literal, split states for the ' +
          'two quantifiers, and one accept.'
      },
      {
        term: 'The split state is where the non-determinism lives',
        diagram: {
          definition: [
            'flowchart LR',
            '    S["split state"] --> A["branch one"]',
            '    S --> B["branch two"]',
            '    S --> C["consumes no character"]',
            '    A --> D["a simulation follows BOTH,<br/>keeping a set of states"]',
            '    B --> D',
            '    D --> E["no backtracking, so no input<br/>can make it explode"]'
          ].join('\n'),
          caption: 'Every alternation and every star in the pattern becomes one of these. Following both successors at once, rather than trying one and backing up, is the whole difference from a backtracking engine.'
        },
        plain: 'It consumes no character and has two successors.',
        formal: 'an epsilon transition with two targets, and no rule for choosing between them',
        detail: 'Every difference between the two engines reduces to what they do at a split. A ' +
          'backtracking engine picks one successor, remembers the other on a stack, and returns to ' +
          'it if the first path fails. A state-set simulation keeps both, because a set can hold ' +
          'two things and a program counter cannot. That is the entire algorithmic difference, and ' +
          'it is worth a factor of seven thousand on the right input.',
        example: 'The compiled `(a+)+b` has two split states, and both are reachable after the ' +
          'first `a`.'
      },
      {
        term: 'The state set is bounded by the pattern, never by the input',
        plain: 'A set of NFA states cannot be larger than the number of NFA states.',
        formal: 'per character the simulation costs O(states), so the search is O(n · m)',
        readAs: 'Track the whole set of states the machine could be in at once, and each character costs one ' +
          'pass over that set. Linear in the text, linear in the pattern, and no path is ever explored ' +
          'twice — which is why this cannot blow up.',
        detail: 'The bound is almost too simple to state, and it is the whole guarantee: whatever ' +
          'the input does, the set cannot grow past the machine. So the per-character cost is ' +
          'fixed before the input is seen, which is what lets a service accept a user-supplied ' +
          'pattern at all. A backtracking engine has no such bound because its stack depth is a ' +
          'function of the input, not of the pattern.',
        example: 'On `(a+)+b` the state-set peak is 4 at every input length from 6 to 22 — it does ' +
          'not move.'
      },
      {
        term: 'Catastrophic backtracking is caused by ambiguity, not by length',
        plain: 'The engine re-explores the same split of the same characters in every arrangement.',
        formal: 'the path count is exponential when a quantifier nests inside another over the same characters',
        readAs: 'A pattern like (a+)+ can split the same run of characters in exponentially many ways, and a ' +
          'backtracking engine tries all of them. That nesting is the specific shape to look for when ' +
          'auditing a regex.',
        detail: 'In `(a+)+b` the inner `a+` and the outer `+` can divide a run of `a`s in every ' +
          'possible way, and each division is a distinct path the engine must exhaust before ' +
          'failing. That is 2^(n−1) paths. The trigger is not a long pattern or a long input — it ' +
          'is two quantifiers that can consume the same characters, which is a property of a ' +
          'handful of characters in the pattern.',
        example: '`a*b` takes 44 steps at n = 20; `(a*)*b` differs by three characters and exhausts ' +
          'a two-million-step budget.'
      },
      {
        term: 'The failing case is the expensive one',
        plain: 'A match returns at the first success; a non-match must exhaust every path.',
        formal: 'the exponent is paid only when no path accepts',
        readAs: 'A catastrophic pattern is fast on input that matches, because the first success stops the ' +
          'search. It is the near-miss — the input that almost matches — that runs every path, which is ' +
          'why the bug survives testing.',
        detail: 'This is why regular-expression denial of service is a real attack and not a ' +
          'curiosity: an attacker does not need to guess a matching input, they need an input that ' +
          'ALMOST matches. Removing the final `b` from a string of `a`s costs nothing to construct ' +
          'and forces the engine through every division of the run. Benchmarks built from matching ' +
          'inputs measure the cheap case and report that everything is fine.',
        example: 'Eighteen `a`s with no `b` costs 1 048 576 backtracking steps and 142 simulation ' +
          'steps.'
      },
      {
        term: 'Ratios grow with the input; that is what makes it an attack',
        plain: 'The gap is not a constant factor, so a bigger input widens it.',
        formal: 'each four extra characters multiply the backtracking cost by about sixteen',
        readAs: 'The cost roughly doubles per added character on these patterns, so four more characters is ' +
          'sixteen times the work. An input the attacker controls the length of is therefore a ' +
          'denial-of-service dial.',
        detail: 'A constant-factor difference is an engineering choice; a growing ratio is a ' +
          'liability, because the input size is the attacker\'s parameter. Measuring the ratio at ' +
          'one length tells you nothing about the next length, so the honest report is the growth ' +
          'column rather than a single number — and the growth column is what turns "slow on this ' +
          'input" into "unbounded".',
        example: '5.6x, 16.5x, 52.5x, 174.3x, 595.8x, 2080.5x, 7384.3x at input lengths 6 to 18.'
      },
      {
        term: 'What the state-set engine gives up: backreferences and captures',
        plain: 'A set of states does not record which path put a state in the set.',
        formal: 'backreferences make the language non-regular, so no NFA can express them',
        readAs: 'Once a pattern can refer back to what an earlier group captured, it is asking for something ' +
          'a finite automaton cannot do. That is why engines offering backreferences cannot offer the ' +
          'linear-time guarantee — not an implementation choice.',
        detail: 'Matching `(a+)\\1` requires remembering what the group captured, and the set has ' +
          'thrown that away. This is not an implementation gap to be closed later: a language with ' +
          'backreferences is not regular, so the linear bound and backreferences cannot coexist. ' +
          'Engines that guarantee linear time therefore refuse those patterns outright, which is a ' +
          'documented trade rather than a missing feature.',
        example: 'The fixture table here contains no capture or backreference patterns, and that ' +
          'omission is the price, not an oversight.'
      },
      {
        term: 'Same answer first, then faster',
        plain: 'A faster engine that accepts a different language is not a faster engine.',
        formal: 'agreement on a fixture set is the precondition for every performance claim',
        detail: 'Two engines for the same syntax can differ on empty matches, on greedy versus lazy ' +
          'quantifiers and on anchoring, and each difference silently changes what a filter admits. ' +
          'So the fixture table comes before the timing table: every pattern-and-input pair is run ' +
          'through both engines and the verdicts compared, and only once they agree everywhere does ' +
          'the step count mean anything.',
        example: '0 of 12 fixtures disagree, which is what makes the 7384.3x column a statement ' +
          'about speed rather than about semantics.'
      }
    ],

    'text-processing': [
      {
        term: 'Tokenisation is a decision about what an atom is',
        plain: 'Splitting on whitespace and splitting on character class give different answers.',
        formal: 'every downstream index, count and similarity inherits the tokeniser\'s choice',
        detail: 'Whitespace splitting treats `/api/orders` as one token, which is right for grouping ' +
          'by route and wrong for finding every request under `/api`. A rule-based tokeniser splits ' +
          'letters, digits and punctuation apart, which finds the prefix and loses the route. ' +
          'Neither is correct in general, and the choice is usually made once, early, by whoever ' +
          'wrote the first ingestion script.',
        example: '`POST /api/login 401 33ms` is 4 tokens by whitespace and 8 by character class.'
      },
      {
        term: 'Byte-pair encoding learns the vocabulary from the corpus',
        plain: 'Repeatedly merge the commonest adjacent pair into a new symbol.',
        formal: 'merge count trades vocabulary size against sequence length',
        detail: 'At zero merges it is a character tokeniser: a tiny vocabulary and very long ' +
          'sequences. Each merge adds one symbol and shortens every occurrence of that pair, so the ' +
          'vocabulary grows while the token count falls. Common sequences end up whole and rare ones ' +
          'decompose into pieces, which is why a subword tokeniser never meets an out-of-vocabulary ' +
          'word — it just spends more tokens on it.',
        example: '60 merges over this corpus reach 4.90 characters per token on a vocabulary of 84.'
      },
      {
        term: 'A log template is what survives when lines in a group disagree',
        plain: 'Group similar lines, keep the positions where they all agree, wildcard the rest.',
        formal: 'a position becomes `<*>` exactly where the group\'s tokens differ',
        detail: 'That is the whole of Drain-style extraction, and it needs no schema, no regular ' +
          'expression and no configuration from whoever produced the logs. The wildcards land ' +
          'precisely on the variable fields, because being variable is what made them disagree. It ' +
          'is the difference between grepping a log format nobody documented and reading a table of ' +
          'four rows.',
        example: '300 raw lines become 4 templates, of which `GET <*> <*> <*>` covers 182.'
      },
      {
        term: 'The similarity threshold is the only knob, and nothing finds it for you',
        plain: 'Too low and every line is one template; too high and every line is its own.',
        formal: 'the useful setting is corpus-specific and is not discoverable from the algorithm',
        detail: 'A template that is all wildcards matches everything and tells an operator nothing; ' +
          'one template per line is the raw log with extra steps. Both ends are degenerate and the ' +
          'algorithm is happy at both, so the setting has to come from looking at the output. The ' +
          'honest way to ship one is to sweep it, print the largest template and its wildcard count ' +
          'at each setting, and pick from that.',
        example: 'From 0.20 to 0.90 the template count goes 3, 4, 4, 4, 7, 7, 8, 8 while the largest ' +
          'template falls from 182 lines to 46.'
      },
      {
        term: 'No single similarity metric is right for names and identifiers alike',
        plain: 'The one that fixes spelling variants breaks on serial numbers.',
        formal: 'prefix-weighted metrics score `service-a` against `service-b` above almost any cutoff',
        detail: 'Jaro-Winkler boosts a shared prefix, which is exactly right for human names where ' +
          'variation lands at the end, and exactly wrong for identifiers where the discriminating ' +
          'character does. A system that uses one metric for both will confidently merge two ' +
          'accounts. The fix is not a better metric but a typed one: choose per field, and check ' +
          'the choice against pairs that must NOT match.',
        example: 'Jaro-Winkler gives 0.956 to `service-a` / `service-b` and 0.956 to `user-1234` / ' +
          '`user-1235` — neither pair is a match.'
      },
      {
        term: 'Token-set metrics ignore order; edit distance cannot',
        plain: 'Swapping two words costs an edit distance almost as large as the string.',
        formal: 'Jaccard and cosine over q-grams are invariant to a reordering that edit distance charges for',
        readAs: 'Set-based similarity does not care what order the pieces came in, so "John Smith" and "Smith ' +
          'John" score high. Edit distance charges the full cost of moving them, and scores the same ' +
          'pair low. Neither is wrong; they answer different questions.',
        detail: '"Elizabeth Windsor" and "Windsor Elizabeth" are the same name written twice, and a ' +
          'character-level distance sees almost nothing in common. A set-of-q-grams comparison sees ' +
          'most of it, because the shared pieces are still shared wherever they sit. The lesson is ' +
          'not that one family wins: it is that field semantics decide which invariance you want, ' +
          'and reorderings and typos want different ones.',
        example: 'That pair scores 0.059 by Levenshtein ratio and 0.778 by Jaccard on 2-grams.'
      },
      {
        term: 'Blocking decides the cost; verification decides the answer',
        plain: 'A prefilter narrows candidates; the comparison that follows produces the result.',
        formal: 'cost = records × filter + candidates × verify, and only the second term is expensive',
        readAs: 'Every record pays the cheap filter, and only the survivors pay the expensive check. So the ' +
          'number that decides your throughput is how many candidates the filter lets through, not how ' +
          'fast either step is.',
        detail: 'Comparing every record against every other is quadratic and pointless, because ' +
          'almost every pair is obviously unrelated. Blocking on a cheap key admits the plausible ' +
          'pairs and the verifier decides among them. Keeping the two jobs separate is what makes ' +
          'the pipeline tunable: the filter can be changed for cost without touching correctness, ' +
          'as long as it admits everything the verifier would accept.',
        example: 'Blocking takes 267 records to 12 candidates — a selectivity of 0.045 — while ' +
          'precision stays at 50% and recall at 100%.'
      },
      {
        term: 'Precision and recall are separate numbers and one of them is usually the point',
        plain: 'Returning everything gives perfect recall; returning nothing gives perfect precision.',
        formal: 'a single accuracy figure hides which of the two a change traded away',
        detail: 'A matching pipeline that reports one number cannot say whether tightening the ' +
          'threshold dropped a false positive or a true match, and those are opposite outcomes. ' +
          'Reporting both makes the trade visible, and makes the case for reporting the filter\'s ' +
          'selectivity beside them: a filter that changes recall is not a filter, it is a second ' +
          'verifier with no bound on its error.',
        example: 'Both pipelines here return 8 records for 4 expected — precision 50%, recall 100% — ' +
          'and differ only in the 267-against-12 candidate count.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
