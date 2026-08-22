/** Worked examples for regular-expression engines and text processing (M15.10-M15.11). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'regex-engines': [
      {
        title: 'One pattern, two engines, and a gap that widens with the input',
        goal: 'Run `(a+)+b` against a string of `a`s with no `b` on both engines, and watch the ' +
          'ratio rather than the timing.',
        setup: 'The pattern `(a+)+b`, compiled to a Thompson NFA, against inputs of 6 to 22 `a`s. ' +
          'The backtracking engine is given a budget of two million steps; both engines are counted ' +
          'in steps, not seconds.',
        steps: [
          {
            do: 'Compile the pattern and count the machine.',
            why: 'The state count is the bound on the simulation\'s per-character cost.',
            work: '5 states: one char state per literal, 2 split states for the quantifiers, 1 accept',
            result: 'linear in the pattern, before any input is seen'
          },
          {
            do: 'Run the backtracking engine on 18 `a`s.',
            why: 'The input almost matches, so every path must be exhausted before it fails.',
            work: '1 048 576 steps, four times the 262 144 it took at 16 characters',
            result: 'a million steps for eighteen characters'
          },
          {
            do: 'Run the state-set simulation on the same input.',
            why: 'It carries both successors of a split instead of choosing one.',
            work: '142 steps, with a state-set peak of 4 out of 5 states',
            result: 'the set never grew past the machine'
          },
          {
            do: 'Take the ratio, then take it again at other lengths.',
            why: 'A single ratio is a benchmark; the growth is the liability.',
            work: '7384.3x at length 18, and 5.6x, 16.5x, 52.5x, 174.3x, 595.8x, 2080.5x at 6 through 16',
            result: 'about 16x more for every four extra characters'
          },
          {
            do: 'Push to 20 and 22 characters.',
            why: 'To see which engine has a bound and which has a budget.',
            work: 'backtracking exhausts 2 000 000 steps; the simulation takes 158 and 174',
            result: 'one engine stops answering; the other adds 16 steps'
          }
        ],
        answer: '1 048 576 steps against 142 at eighteen characters, and no answer at all against ' +
          '158 at twenty. The state-set peak of 4 is the reason: it is bounded by the 5-state ' +
          'machine, so the per-character cost was fixed when the pattern was compiled, and the ' +
          'input cannot change it. That is what makes it safe to accept a pattern from a user.'
      },
      {
        title: 'Which patterns are dangerous, and the fixture table that has to come first',
        goal: 'Separate the patterns that blow up from the ones that do not, and establish that ' +
          'the two engines agree before quoting any speed number.',
        setup: 'Six patterns, each run at input lengths 12 and 20 on both engines, plus twelve ' +
          'pattern-and-input fixtures whose verdicts are compared.',
        steps: [
          {
            do: 'Run the three nested-quantifier patterns.',
            why: 'Nesting lets two quantifiers consume the same characters.',
            work: '`(a+)+b` 16 384 steps at n = 12, `(a|a)*b` 32 766, `(a*)*b` 16 385 — all three exhausted at n = 20',
            result: 'unbounded growth, not a large constant'
          },
          {
            do: 'Run the three that are not nested.',
            why: 'To check that length and quantifiers alone are not the trigger.',
            work: '`a*b` 28 to 44 steps, `(ab)*c` 6 to 6, `(a|b)*abb` 68 to 108 — growth 1.6x, 1.0x and 1.6x',
            result: 'flat, at the same input lengths'
          },
          {
            do: 'Compare `a*b` with `(a*)*b`.',
            why: 'The pair isolates the cause.',
            work: '3 characters of difference: 44 steps against a 2 000 000-step budget exhausted',
            result: 'ambiguity is the trigger, not size'
          },
          {
            do: 'Read the Thompson column across all six rows.',
            why: 'To see what ambiguity costs the simulation.',
            work: '158, 205, 164, 123, 8 and 244 steps at n = 20 — the same order of magnitude for all six',
            result: 'the set already holds every alternative, so ambiguity is free'
          },
          {
            do: 'Run the twelve verdict fixtures through both engines.',
            why: 'A faster engine that accepts a different language is not a faster engine.',
            work: '0 of 12 disagree, across empty matches, alternation, `.`, `+` and `?`',
            result: 'the speed columns are now statements about speed'
          }
        ],
        answer: 'Three of six patterns are catastrophic and the difference is nesting over the same ' +
          'characters — `a*b` and `(a*)*b` differ by three characters and by everything. The ' +
          'Thompson column stays between 8 and 244 steps on all six, because a state set holds ' +
          'every alternative already. And none of that means anything until the twelve fixtures ' +
          'agree, which they do, 12 for 12.'
      }
    ],

    'text-processing': [
      {
        title: 'Four templates from three hundred lines, and the one knob that decides',
        goal: 'Extract log templates with no schema and no regular expressions, then sweep the ' +
          'similarity threshold to see how little the algorithm decides for you.',
        setup: '300 raw log lines in a format nobody documented, tokenised by whitespace, grouped by ' +
          'token-level similarity at a default threshold of 0.50.',
        steps: [
          {
            do: 'Group the lines and freeze the positions where a group agrees.',
            why: 'A position that varies within a group is by definition a variable field.',
            work: '4 templates from 300 lines, at 1 348 token comparisons',
            result: 'a four-row table instead of a log file'
          },
          {
            do: 'Read the largest template.',
            why: 'The wildcards should land on the fields, without being told where they are.',
            work: '`GET <*> <*> <*>` covers 182 lines with 3 of its 4 positions wildcarded',
            result: 'path, status and duration identified, from the data alone'
          },
          {
            do: 'Read the other three.',
            why: 'A template with no wildcards is a line that simply repeats.',
            work: '41, 39 and 38 lines, 0 of 4 wildcards each',
            result: 'literal lines, correctly not generalised'
          },
          {
            do: 'Sweep the threshold from 0.20 to 0.90.',
            why: 'Both ends are degenerate and the algorithm is happy at both.',
            work: '3, 4, 4, 4, 7, 7, 8, 8 templates; the largest falls from 182 lines to 46; wildcards in it go 3 of 4 down to 0 of 4',
            result: 'the useful setting is in the middle and is not computed'
          },
          {
            do: 'Read the comparison count beside it.',
            why: 'A tighter threshold means more groups and more comparisons per line.',
            work: '1 188 comparisons at 0.20 against 2 832 at 0.90 — 2.4x',
            result: 'the knob costs something too, but far less than it decides'
          }
        ],
        answer: '4 templates covering 300 lines, the largest wildcarding 3 of its 4 positions over ' +
          '182 of them. Move the threshold to 0.20 and the corpus collapses to 3 templates; move it ' +
          'to 0.90 and it fragments into 8 whose largest covers 46 lines with no wildcards at all. ' +
          'Nothing in the algorithm finds the setting, so the honest way to ship it is to print ' +
          'this sweep beside the output.'
      },
      {
        title: 'The metric that merges two accounts, and the filter that must not',
        goal: 'Score six pairs with four similarity metrics, find the pairs every single metric ' +
          'gets wrong, then measure what blocking changes and what it must not change.',
        setup: 'Six name and identifier pairs, four metrics — Levenshtein ratio, Jaro-Winkler, and ' +
          'Jaccard and cosine over 2-grams — and a 267-record linkage pipeline with 4 expected matches.',
        steps: [
          {
            do: 'Score the pair that should match and is spelled two ways.',
            why: 'This is the case every metric is supposed to handle.',
            work: '`Jon Smyth` / `John Smith`: 0.800 Levenshtein, 0.917 Jaro-Winkler, 0.417 Jaccard, 0.589 cosine',
            result: 'the character metrics agree; the token metrics are already unsure'
          },
          {
            do: 'Score the two pairs that must NOT match.',
            why: 'A cutoff is decided by the highest scoring non-match, not by the matches.',
            work: '`service-a` / `service-b` and `user-1234` / `user-1235` both score 0.956 Jaro-Winkler and 0.889 Levenshtein',
            result: 'above any cutoff that keeps the real matches'
          },
          {
            do: 'Score the same name written in the other order.',
            why: 'Reorderings and typos want different invariances.',
            work: '`Elizabeth Windsor` / `Windsor Elizabeth`: 0.059 by Levenshtein ratio, 0.778 by Jaccard on 2-grams',
            result: 'a factor of 13 between two defensible metrics on one pair'
          },
          {
            do: 'Look for a metric that is right on all six rows.',
            why: 'This is the step people skip.',
            work: 'there is none: each of the 4 metrics scores at least one wrong pair above a correct one',
            result: 'choose per field, not per system'
          },
          {
            do: 'Run the pipeline with blocking and then without it.',
            why: 'To separate what the filter changes from what the verifier decides.',
            work: '267 records to 12 candidates, selectivity 0.045, against 267 to 267 at 1.000 — precision 50% and recall 100% in both',
            result: 'the filter moved the cost by 22x and the answer not at all'
          }
        ],
        answer: 'Jaro-Winkler scores two different services at 0.956 and two different accounts at ' +
          '0.956, while Levenshtein scores one name against itself reordered at 0.059 — no single ' +
          'metric here is right on all six pairs. Blocking then cuts 267 records to 12 candidates ' +
          'without moving precision off 50% or recall off 100%, which is exactly the property that ' +
          'makes it a filter rather than a second verifier.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
