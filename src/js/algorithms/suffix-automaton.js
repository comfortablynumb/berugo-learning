/**
 * The suffix automaton: the minimal DFA that accepts exactly the substrings of
 * a string, built online in one left-to-right pass.
 *
 * Every state stands for a set of substrings that occur at exactly the same
 * set of end positions - its *endpos* class - and `len` is the longest of
 * them. The suffix link points at the state holding the next shorter class,
 * so the links form a tree whose parent-child relation is set containment:
 * a state's endpos set is exactly the union of its link children's, plus its
 * own occurrence if it is a prefix state. That identity is the invariant worth
 * checking, because it is the one the clone case can break.
 *
 * `extend(char)` has two branches. The easy one appends a new state and walks
 * the suffix links adding transitions. The hard one is the **clone**: a state
 * `q` reached by the new character already exists, but `len(q) > len(p) + 1`,
 * meaning `q` mixes substrings that the new character has just split into two
 * different endpos classes. A copy of `q` is made with the shorter length, the
 * transitions that should now lead to the shorter class are repointed at it,
 * and both `q` and the new state link to it. Skipping the clone gives an
 * automaton that accepts strings that never occurred - and it passes a
 * casual "does it accept every substring" test, because it accepts a superset.
 *
 * The size is bounded by 2n − 1 states and 3n − 4 transitions, both tight, and
 * the number of distinct substrings is Σ (len(v) − len(link(v))) over every
 * state but the initial one - which must equal what a suffix array computes as
 * n(n+1)/2 − Σ lcp.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SuffixAutomaton = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function newStats() {
    return { extensions: 0, statesCreated: 0, clones: 0, transitionsAdded: 0, linkWalks: 0 };
  }

  function build(text, options) {
    const settings = options || {};
    const stats = newStats();
    const trace = settings.trace ? [] : null;

    const states = [{ len: 0, link: -1, next: new Map(), cloned: false, firstPos: -1 }];
    let last = 0;

    function newState(len, link, cloned) {
      stats.statesCreated += 1;
      states.push({ len: len, link: link, next: new Map(), cloned: Boolean(cloned), firstPos: -1 });
      return states.length - 1;
    }

    function extend(symbol) {
      stats.extensions += 1;
      const current = newState(states[last].len + 1, -1, false);
      states[current].firstPos = states[current].len - 1;

      let walker = last;
      while (walker !== -1 && !states[walker].next.has(symbol)) {
        stats.linkWalks += 1;
        stats.transitionsAdded += 1;
        states[walker].next.set(symbol, current);
        walker = states[walker].link;
      }

      if (walker === -1) {
        states[current].link = 0;
        last = current;
        if (trace) trace.push({ symbol: symbol, kind: 'root', state: current, states: states.length });
        return;
      }

      const target = states[walker].next.get(symbol);

      if (states[walker].len + 1 === states[target].len) {
        /* `target` already stands for exactly the right class. */
        states[current].link = target;
        last = current;
        if (trace) trace.push({ symbol: symbol, kind: 'link', state: current, link: target, states: states.length });
        return;
      }

      /* The clone. `target` mixes two endpos classes that this character has
         just separated; the copy takes the shorter one. */
      stats.clones += 1;
      const clone = newState(states[walker].len + 1, states[target].link, true);
      states[clone].next = new Map(states[target].next);
      states[clone].firstPos = states[target].firstPos;

      while (walker !== -1 && states[walker].next.get(symbol) === target) {
        stats.linkWalks += 1;
        states[walker].next.set(symbol, clone);
        walker = states[walker].link;
      }

      states[target].link = clone;
      states[current].link = clone;
      last = current;
      if (trace) trace.push({ symbol: symbol, kind: 'clone', state: current, clone: clone, from: target, states: states.length });
    }

    for (let i = 0; i < text.length; i += 1) extend(text[i]);

    /* ------------------------------------------------------- inspection */

    function transitions() {
      return states.reduce(function (total, state) { return total + state.next.size; }, 0);
    }

    /** Accepts exactly the substrings: one transition per character. */
    function has(pattern) {
      let at = 0;
      for (let i = 0; i < pattern.length; i += 1) {
        const next = states[at].next.get(pattern[i]);
        if (next === undefined) return false;
        at = next;
      }
      return true;
    }

    /** Σ (len(v) − len(link(v))): each state contributes the substrings whose
     *  longest representative it is. */
    function distinctSubstrings() {
      let total = 0;
      for (let i = 1; i < states.length; i += 1) total += states[i].len - states[states[i].link].len;
      return total;
    }

    /** The number of occurrences of every state's class, by propagating a 1
     *  from each prefix state up the link tree. Clones start at 0 - a clone is
     *  not itself a prefix, and giving it a 1 is the second classic bug. */
    function occurrenceCounts() {
      const counts = new Array(states.length).fill(0);
      let at = 0;

      for (let i = 0; i < text.length; i += 1) {
        at = states[at].next.get(text[i]);
        counts[at] += 1;
      }

      const order = states.map(function (state, i) { return i; })
        .sort(function (a, b) { return states[b].len - states[a].len; });
      order.forEach(function (i) {
        if (states[i].link > 0 || (states[i].link === 0 && i !== 0)) {
          if (states[i].link !== -1) counts[states[i].link] += counts[i];
        }
      });
      counts[0] = 0;
      return counts;
    }

    function countOccurrences(pattern) {
      if (!pattern.length) return 0;
      let at = 0;
      for (let i = 0; i < pattern.length; i += 1) {
        const next = states[at].next.get(pattern[i]);
        if (next === undefined) return 0;
        at = next;
      }
      return occurrenceCounts()[at];
    }

    /** The longest substring occurring at least twice: the deepest state whose
     *  class occurs more than once. */
    function longestRepeated() {
      const counts = occurrenceCounts();
      let best = 0;
      let at = -1;

      for (let i = 1; i < states.length; i += 1) {
        if (counts[i] > 1 && states[i].len > best) { best = states[i].len; at = i; }
      }
      if (at === -1) return '';
      const end = states[at].firstPos + 1;
      return text.slice(end - best, end);
    }

    function checkInvariants() {
      const errors = [];
      const n = text.length;

      if (n > 1 && states.length > 2 * n - 1) {
        errors.push('the automaton has ' + states.length + ' states, over the 2n - 1 bound of ' + (2 * n - 1));
      }
      if (n > 2 && transitions() > 3 * n - 4) {
        errors.push('the automaton has ' + transitions() + ' transitions, over the 3n - 4 bound of ' + (3 * n - 4));
      }

      for (let i = 1; i < states.length; i += 1) {
        const link = states[i].link;
        if (link === -1) { errors.push('state ' + i + ' has no suffix link'); continue; }
        if (states[link].len >= states[i].len) {
          errors.push('state ' + i + ' links to ' + link + ', which is not shorter');
        }
      }

      /* The endpos identity: a state's occurrence count must equal the sum of
         its link children's, plus one if it is itself a prefix state. */
      const counts = occurrenceCounts();
      const childSum = new Array(states.length).fill(0);
      const isPrefix = new Array(states.length).fill(false);
      let at = 0;
      for (let i = 0; i < n; i += 1) { at = states[at].next.get(text[i]); isPrefix[at] = true; }
      for (let i = 1; i < states.length; i += 1) childSum[states[i].link] += counts[i];

      for (let i = 1; i < states.length; i += 1) {
        const expected = childSum[i] + (isPrefix[i] ? 1 : 0);
        if (counts[i] !== expected) {
          errors.push('state ' + i + ' occurs ' + counts[i] + ' times but its link children sum to ' +
            childSum[i] + (isPrefix[i] ? ' + 1' : ''));
          break;
        }
      }
      return { ok: errors.length === 0, errors: errors.slice(0, 5) };
    }

    return {
      name: 'suffix-automaton',
      text: text,
      states: states,
      stateCount: function () { return states.length; },
      transitions: transitions,
      has: has,
      countOccurrences: countOccurrences,
      occurrenceCounts: occurrenceCounts,
      distinctSubstrings: distinctSubstrings,
      longestRepeated: longestRepeated,
      clones: function () { return stats.clones; },
      trace: trace || [],
      /* One int for len, one for link, one map entry per transition. */
      bytes: function () { return states.length * 8 + transitions() * 9; },
      bytesPerChar: function () { return (states.length * 8 + transitions() * 9) / Math.max(1, text.length); },
      checkInvariants: checkInvariants,
      stats: function () { return Object.assign({ length: text.length, states: states.length }, stats); }
    };
  }

  /** The factor oracle: the same left-to-right shape with no clone step, so it
   *  is smaller (exactly n + 1 states) and accepts a *superset* of the
   *  substrings. It is here as the control - it is what a suffix automaton
   *  degenerates into when the clone case is skipped, and running the two side
   *  by side is how the section shows what the clone buys. */
  function factorOracle(text) {
    const n = text.length;
    const next = [];
    const supply = new Array(n + 1).fill(-1);

    for (let i = 0; i <= n; i += 1) next.push(new Map());
    supply[0] = -1;

    for (let i = 0; i < n; i += 1) {
      const symbol = text[i];
      next[i].set(symbol, i + 1);

      let walker = supply[i];
      while (walker !== -1 && !next[walker].has(symbol)) {
        next[walker].set(symbol, i + 1);
        walker = supply[walker];
      }
      supply[i + 1] = walker === -1 ? 0 : next[walker].get(symbol);
    }

    return {
      name: 'factor-oracle',
      states: n + 1,
      transitions: next.reduce(function (total, map) { return total + map.size; }, 0),
      has: function (pattern) {
        let at = 0;
        for (let i = 0; i < pattern.length; i += 1) {
          const step = next[at].get(pattern[i]);
          if (step === undefined) return false;
          at = step;
        }
        return true;
      }
    };
  }

  return { build: build, factorOracle: factorOracle, newStats: newStats };
}));
