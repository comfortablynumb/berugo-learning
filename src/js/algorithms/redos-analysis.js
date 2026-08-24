/**
 * Catastrophic backtracking, detected structurally rather than by fuzzing.
 *
 * A backtracking matcher blows up when the pattern is INFINITELY AMBIGUOUS:
 * when there is a state q and a non-empty word w with two distinct paths from
 * q back to q on w. Pumping w then multiplies the number of paths, and a
 * matcher that tries them one at a time takes exponential time on a string
 * that never matches. `(a+)+$` and `(a|a)*$` are the canonical shapes and both
 * have exactly that structure.
 *
 * The detection is a search in the PRODUCT of the NFA with itself: a path from
 * (q, q) back to (q, q) that passes through an off-diagonal pair is precisely
 * two different runs on the same word. That makes ReDoS a property you can
 * check in CI rather than an incident you find in production, which is the
 * point of the section.
 *
 * The measurement is the pair of step counts: a backtracking matcher against
 * the NFA simulation on the same generated string. One is exponential in the
 * repeat count and the other is linear, and both are counted rather than
 * asserted.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.RedosAnalysis = api;
}(this, function (root) {
  'use strict';

  const Automaton = root && root.Automaton ? root.Automaton
    : require('../machines/automaton.js');
  const Regex = root && root.RegexCompile ? root.RegexCompile
    : require('./regex-compile.js');

  const STEP_CAP = 4000000;

  /* ------------------------------------------------------------ detection */

  /**
   * Is there a state with two distinct runs on one word back to itself?
   *
   * The search is over triples (p, q, sawOffDiagonal): start at (q, q, false),
   * follow one symbol in BOTH components at once, and set the flag whenever the
   * two components differ. Reaching (q, q, true) means the same word was read
   * two different ways.
   */
  function ambiguity(pattern, alphabet) {
    const nfa = Regex.thompson(pattern, alphabet);
    const positions = Regex.glushkov(pattern, alphabet);
    const findings = overlapFindings(positions).concat(nestingFindings(pattern, nfa));

    return { nfa: nfa, glushkov: positions, vulnerable: findings.length > 0,
      findings: findings, pattern: pattern };
  }

  /**
   * Rule one — OVERLAPPING ALTERNATIVES. Search the position automaton for a
   * state with two distinct runs back to itself on one word.
   *
   * The position automaton is the right machine for this and Thompson's is
   * not: Glushkov has exactly one state per literal, no ε-edges, and two
   * parallel successors mean two genuinely different ways of assigning input
   * characters to pattern positions. Thompson's ε-edges make "one step"
   * ambiguous, so the same run shows up as two and every pattern looks
   * vulnerable.
   */
  function overlapFindings(positions) {
    const findings = [];

    positions.states.forEach(function (state) {
      const found = pumpFrom(positions, state);

      if (found) {
        findings.push({ kind: 'overlap', state: state, word: found.word, paths: 2,
          detail: 'two runs from ' + state + ' back to itself on "' + found.word + '"' });
      }
    });
    return findings;
  }

  /**
   * Rule two — NESTED QUANTIFIERS. A repetition whose body is itself a
   * repetition, or whose body can match the empty string.
   *
   * The position automaton cannot see this one: `(a*)*` and `a*` have the same
   * positions and the same follow sets, so they are the same machine. The
   * difference is in the DERIVATION — a backtracking engine has to decide how
   * many characters each level of nesting consumes, and there are exponentially
   * many ways to split a run of one symbol. That is a property of the pattern's
   * shape, so it is checked on the syntax tree.
   */
  function nestingFindings(pattern, nfa) {
    const findings = [];

    walk(Regex.parse(pattern), function (node) {
      if (node.type !== 'star' && node.type !== 'plus') return;
      const inner = node.child;

      if (inner.type !== 'star' && inner.type !== 'plus' && !nullable(inner)) return;
      findings.push({ kind: 'nesting', state: null,
        word: shortestNonEmpty(nfa.alphabet, inner),
        detail: 'a ' + node.type + ' over a body that is ' +
          (inner.type === 'star' || inner.type === 'plus'
            ? 'itself a ' + inner.type : 'nullable') });
    });
    return findings;
  }

  function walk(node, visit) {
    if (!node) return;
    visit(node);
    ['left', 'right', 'child'].forEach(function (key) {
      if (node[key]) walk(node[key], visit);
    });
  }

  function nullable(node) {
    if (!node || node.type === 'empty') return true;
    if (node.type === 'literal' || node.type === 'any' || node.type === 'none') return false;
    if (node.type === 'star' || node.type === 'opt') return true;
    if (node.type === 'plus') return nullable(node.child);
    if (node.type === 'alt') return nullable(node.left) || nullable(node.right);
    return nullable(node.left) && nullable(node.right);
  }

  /** The shortest non-empty string the repeated body matches — the word the
   *  attack pumps. */
  function shortestNonEmpty(alphabet, node) {
    const body = Regex.thompson(showBody(node), alphabet);
    const words = Automaton.strings(alphabet, 3);

    for (let i = 1; i < words.length; i += 1) {
      if (Automaton.accepts(body, words[i])) return words[i];
    }
    return alphabet[0] || 'a';
  }

  function showBody(node) {
    if (node.type === 'literal') return node.symbol;
    if (node.type === 'any') return '.';
    if (node.type === 'empty') return 'ε';
    if (node.type === 'none') return '∅';
    if (node.type === 'star') return '(' + showBody(node.child) + ')*';
    if (node.type === 'plus') return '(' + showBody(node.child) + ')+';
    if (node.type === 'opt') return '(' + showBody(node.child) + ')?';
    if (node.type === 'alt') return '(' + showBody(node.left) + '|' + showBody(node.right) + ')';
    return '(' + showBody(node.left) + showBody(node.right) + ')';
  }

  /**
   * Two distinct runs from `origin` back to `origin` on one word.
   *
   * The search must track SINGLE states in each component, not state sets:
   * advancing a set collapses the two runs into one and the off-diagonal pair
   * that proves the ambiguity never appears. That collapse is the whole reason
   * the ε-free machine is built first — a run is only a well-defined sequence
   * of states once ε-edges are gone.
   */
  function pumpFrom(free, origin) {
    const seen = {};
    const queue = [{ left: origin, right: origin, off: false, word: '' }];

    seen[key(origin, origin, false)] = true;
    while (queue.length) {
      const node = queue.shift();

      if (node.off && node.word.length > 0
        && node.left === origin && node.right === origin) {
        return { word: node.word };
      }
      if (node.word.length > 8) continue;
      expand(free, node, seen, queue);
    }
    return null;
  }

  function expand(free, node, seen, queue) {
    free.alphabet.forEach(function (symbol) {
      const lefts = Automaton.step(free, node.left, symbol);
      const rights = Automaton.step(free, node.right, symbol);

      lefts.forEach(function (left) {
        rights.forEach(function (right) {
          const off = node.off || left !== right;
          const id = key(left, right, off);

          if (seen[id]) return;
          seen[id] = true;
          queue.push({ left: left, right: right, off: off, word: node.word + symbol });
        });
      });
    });
  }

  function key(left, right, off) {
    return left + '|' + right + '|' + (off ? '1' : '0');
  }

  /* ------------------------------------------------------- attack strings */

  /**
   * A string that pumps the ambiguous word and then fails, so the matcher must
   * exhaust every path before giving up. The failing tail is what makes it
   * catastrophic: a string that MATCHES stops at the first success.
   */
  function attackString(report, repeats, tail) {
    if (!report.vulnerable) return null;
    const finding = report.findings[0];
    const prefix = reachWord(report.nfa, finding.state);
    const suffix = tail === undefined ? failingTail(report.nfa) : tail;

    return { text: prefix + repeat(finding.word, repeats) + suffix,
      prefix: prefix, pumped: finding.word, repeats: repeats, suffix: suffix };
  }

  function repeat(word, times) {
    let out = '';

    for (let i = 0; i < times; i += 1) out += word;
    return out;
  }

  /** The shortest word that reaches the ambiguous state from the start. */
  function reachWord(nfa, target) {
    const start = Automaton.epsilonClosure(nfa, nfa.start);
    const seen = {};
    const queue = [{ states: start, word: '' }];

    seen[start.join(',')] = true;
    while (queue.length) {
      const node = queue.shift();

      if (node.states.indexOf(target) !== -1) return node.word;
      for (let i = 0; i < nfa.alphabet.length; i += 1) {
        const next = Automaton.advance(nfa, node.states, nfa.alphabet[i]);
        const id = next.join(',');

        if (next.length === 0 || seen[id]) continue;
        seen[id] = true;
        queue.push({ states: next, word: node.word + nfa.alphabet[i] });
      }
    }
    return '';
  }

  /** A symbol the machine cannot be made to accept after the pump — the tail
   *  that forces the matcher to try every path and fail on all of them. */
  function failingTail(nfa) {
    return nfa.alphabet.length > 1 ? nfa.alphabet[nfa.alphabet.length - 1] + '!' : '!';
  }

  /* --------------------------------------------------------- measurement */

  /**
   * A backtracking matcher, counted. This is what a PCRE-style engine does:
   * try one path, and on failure back up and try the next. It is written
   * recursively over the NFA so the step count is the real number of paths
   * explored rather than a model of one.
   */
  function backtrackSteps(nfa, input) {
    const symbols = String(input).split('');
    const counter = { steps: 0, overflow: false };

    const walk = function (state, at) {
      counter.steps += 1;
      if (counter.steps >= STEP_CAP) { counter.overflow = true; return false; }
      if (at === symbols.length && Automaton.isAccepting(nfa, state)) return true;
      const epsilons = Automaton.step(nfa, state, Automaton.EPSILON);

      for (let i = 0; i < epsilons.length; i += 1) {
        if (walk(epsilons[i], at)) return true;
      }
      if (at >= symbols.length) return false;
      const next = Automaton.step(nfa, state, symbols[at]);

      for (let i = 0; i < next.length; i += 1) {
        if (walk(next[i], at + 1)) return true;
      }
      return false;
    };

    const matched = walk(nfa.start[0], 0);

    return { matched: matched, steps: counter.steps, overflow: counter.overflow };
  }

  /** The same match by simulating the state SET, which visits each position
   *  once whatever the ambiguity. */
  function simulationSteps(nfa, input) {
    const symbols = String(input).split('');
    let active = Automaton.epsilonClosure(nfa, nfa.start);
    let steps = active.length;

    for (let i = 0; i < symbols.length; i += 1) {
      active = Automaton.advance(nfa, active, symbols[i]);
      steps += active.length + 1;
      if (active.length === 0) break;
    }
    return { matched: active.some(function (s) { return Automaton.isAccepting(nfa, s); }),
      steps: steps };
  }

  /**
   * Both matchers over a range of repeat counts, which is the table the demo
   * prints. `ratio` is the honest headline: how many times more work the
   * backtracking engine did for the identical answer.
   */
  function blowUp(pattern, repeats, alphabet) {
    const report = ambiguity(pattern, alphabet);

    return repeats.map(function (n) {
      const attack = attackString(report, n);

      if (attack === null) return { repeats: n, length: 0, backtrack: 0, simulation: 0 };
      const back = backtrackSteps(report.nfa, attack.text);
      const sim = simulationSteps(report.nfa, attack.text);

      return { repeats: n, length: attack.text.length, backtrack: back.steps,
        simulation: sim.steps, overflow: back.overflow,
        ratio: back.steps / Math.max(1, sim.steps), matched: back.matched };
    });
  }

  /** Patterns worth checking a detector against: the known-bad ones, and the
   *  safe rewrites that are the actual fix. */
  function samples() {
    return [
      { pattern: '(a|a)*b', label: 'alternation of identical branches', expected: true },
      { pattern: '(a*)*b', label: 'star over a nullable star', expected: true },
      { pattern: '(a+)+b', label: 'the classic (a+)+', expected: true },
      { pattern: '(aa|a)*b', label: 'overlapping alternatives', expected: true },
      { pattern: '(a|b|ab)*c', label: 'an alternative that spans the others', expected: true },
      { pattern: 'a*b', label: 'the safe rewrite of the first three', expected: false },
      { pattern: '(ab)*c', label: 'unambiguous repetition', expected: false },
      { pattern: '(a|ab)*c', label: 'alternatives that look overlapping and are not',
        expected: false },
      { pattern: 'a(b|c)*d', label: 'disjoint alternatives', expected: false }
    ];
  }

  return {
    ambiguity: ambiguity, attackString: attackString, blowUp: blowUp,
    backtrackSteps: backtrackSteps, simulationSteps: simulationSteps,
    reachWord: reachWord, samples: samples, STEP_CAP: STEP_CAP
  };
}));
