/**
 * A lexer generated from regular definitions, with maximal munch and priority.
 *
 * A tokeniser is a finite automaton plus two rules, and both rules are places
 * real lexers get things wrong:
 *
 *   - MAXIMAL MUNCH: at each position take the LONGEST match, not the first
 *     one that succeeds. `>>=` must not come back as `>>` then `=`, and the
 *     only way to know is to keep scanning past a match that already worked
 *     and remember the last accepting position.
 *   - PRIORITY: when two definitions match the same longest string, the one
 *     declared first wins. That is how `if` is a keyword rather than an
 *     identifier, and reordering the rule list silently changes the language.
 *
 * The scanner is built by running every rule's DFA in lockstep over the input,
 * which is what a generated lexer does after the rules are merged into one
 * machine. Keeping them separate here costs a constant factor and makes the
 * winning rule at each position observable, which is what the demo needs.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.LexerGen = api;
}(this, function (root) {
  'use strict';

  const Automaton = root && root.Automaton ? root.Automaton
    : require('../machines/automaton.js');
  const Regex = root && root.RegexCompile ? root.RegexCompile
    : require('./regex-compile.js');

  /**
   * Compile a rule list into a scanner. Each rule is
   * `{ name, pattern, skip }`; declaration order IS priority order.
   */
  function build(rules, alphabet) {
    const symbols = alphabet || alphabetOf(rules);

    return {
      rules: rules.map(function (rule, index) {
        return {
          name: rule.name, pattern: rule.pattern, skip: rule.skip === true,
          priority: index,
          machine: Automaton.toDfa(Regex.thompson(rule.pattern, symbols)).dfa
        };
      }),
      alphabet: symbols
    };
  }

  function alphabetOf(rules) {
    const seen = {};

    rules.forEach(function (rule) {
      Regex.alphabetOf(Regex.parse(rule.pattern)).forEach(function (symbol) {
        seen[symbol] = true;
      });
    });
    return Object.keys(seen).sort();
  }

  /**
   * The longest match at `from`, and which rule produced it. Every rule is
   * advanced one character at a time and the last accepting length is
   * remembered — that remembering is maximal munch.
   */
  function longestAt(scanner, input, from) {
    const active = scanner.rules.map(function (rule) {
      return { rule: rule, states: Automaton.epsilonClosure(rule.machine, rule.machine.start) };
    });
    let best = null;
    const attempts = [];

    for (let at = from; at < input.length; at += 1) {
      advanceAll(active, input[at]);
      if (active.length === 0) break;
      const winner = acceptingWinner(active);

      if (winner === null) continue;
      best = { rule: winner, length: at - from + 1, text: input.slice(from, at + 1) };
      attempts.push({ length: best.length, rule: winner.name, text: best.text });
    }
    return { match: best, attempts: attempts };
  }

  function advanceAll(active, symbol) {
    for (let i = active.length - 1; i >= 0; i -= 1) {
      const next = Automaton.advance(active[i].rule.machine, active[i].states, symbol);

      if (next.length === 0) { active.splice(i, 1); continue; }
      active[i].states = next;
    }
  }

  /** Among the rules still alive and accepting, the one declared first. */
  function acceptingWinner(active) {
    let winner = null;

    active.forEach(function (entry) {
      const accepting = entry.states.some(function (state) {
        return Automaton.isAccepting(entry.rule.machine, state);
      });

      if (!accepting) return;
      if (winner === null || entry.rule.priority < winner.priority) winner = entry.rule;
    });
    return winner;
  }

  /**
   * Scan the whole input. A rule that matches the empty string would loop
   * forever, so a zero-length match is reported as an error rather than
   * consumed — which is the failure mode of a rule list written with `a*`
   * where `a+` was meant.
   */
  function scan(scanner, input) {
    const tokens = [];
    const decisions = [];
    let at = 0;

    while (at < input.length) {
      const found = longestAt(scanner, input, at);

      if (found.match === null || found.match.length === 0) {
        return { tokens: tokens, decisions: decisions, ok: false, errorAt: at,
          errorChar: input[at] };
      }
      decisions.push({ at: at, chosen: found.match.rule.name, length: found.match.length,
        text: found.match.text, attempts: found.attempts });
      if (!found.match.rule.skip) {
        tokens.push({ type: found.match.rule.name, text: found.match.text, at: at });
      }
      at += found.match.length;
    }
    return { tokens: tokens, decisions: decisions, ok: true, errorAt: -1, errorChar: null };
  }

  /**
   * The rules that would be shadowed if priority were reversed — the check
   * that catches "my keywords come back as identifiers".
   */
  function shadowing(scanner, samples) {
    return samples.map(function (text) {
      const found = longestAt(scanner, text, 0);
      const all = scanner.rules.filter(function (rule) {
        return Automaton.accepts(rule.machine, text);
      });

      return { text: text, chosen: found.match ? found.match.rule.name : null,
        matchedBy: all.map(function (rule) { return rule.name; }),
        shadowed: all.length > 1 };
    });
  }

  /** A small language's rules, ordered so keywords beat identifiers. */
  function sampleRules() {
    return [
      { name: 'if', pattern: 'if' },
      { name: 'in', pattern: 'in' },
      { name: 'int', pattern: 'int' },
      { name: 'shift-assign', pattern: '>>=' },
      { name: 'shift', pattern: '>>' },
      { name: 'ge', pattern: '>=' },
      { name: 'gt', pattern: '>' },
      { name: 'assign', pattern: '=' },
      { name: 'identifier', pattern: '(a|b|c|f|i|n|t|x|y|z)(a|b|c|f|i|n|t|x|y|z|0|1|2)*' },
      { name: 'number', pattern: '(0|1|2)(0|1|2)*' },
      { name: 'space', pattern: ' ( )*', skip: true }
    ];
  }

  return {
    build: build, scan: scan, longestAt: longestAt, shadowing: shadowing,
    sampleRules: sampleRules, alphabetOf: alphabetOf
  };
}));
