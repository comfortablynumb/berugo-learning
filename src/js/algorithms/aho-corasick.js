/**
 * Aho-Corasick: KMP's failure link, generalised to a set of patterns.
 *
 * The trie of patterns is the goto function. A failure link points from a
 * state to the state for the longest proper suffix of what it spells that is
 * also a prefix of some pattern - exactly KMP's border, with "the pattern"
 * replaced by "any pattern". One breadth-first pass builds them, because a
 * state's failure link is computed from its parent's, which is already done.
 *
 * The output links are the part hand-rolled implementations get wrong. When
 * one pattern is a suffix of another - `he` inside `she` - reaching the state
 * for `she` must also report `he`, and nothing about the goto trie says so.
 * The output link chains a state to the nearest state along its failure path
 * that ends a pattern, and following that chain is what makes the reporting
 * complete. This module ships `outputLinks: false` so the failure can be
 * counted rather than described.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AhoCorasick = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function emptyReport() {
    return { comparisons: 0, states: 0, edges: 0, failureFollows: 0,
      outputFollows: 0, matches: 0, preprocessing: 0 };
  }

  function newState(depth) {
    return { next: {}, fail: 0, output: -1, ends: [], depth: depth };
  }

  /**
   * The trie, then one BFS for the links. Both loops are here because the
   * order matters: a failure link is read off the parent's, so the parent must
   * be finished before the child is visited, and BFS is exactly that order.
   */
  function build(patterns, options) {
    const settings = options || {};
    const report = settings.report || emptyReport();
    const states = [newState(0)];

    patterns.forEach(function (pattern, id) {
      let at = 0;

      for (let i = 0; i < pattern.length; i += 1) {
        report.preprocessing += 1;

        if (states[at].next[pattern[i]] === undefined) {
          states.push(newState(states[at].depth + 1));
          states[at].next[pattern[i]] = states.length - 1;
          report.edges += 1;
        }
        at = states[at].next[pattern[i]];
      }
      states[at].ends.push(id);
    });
    report.states = states.length;
    linkStates(states, report, settings.outputLinks !== false);
    return { states: states, patterns: patterns, report: report,
      outputLinks: settings.outputLinks !== false };
  }

  /** Failure links by BFS, and the output chain along them. */
  function linkStates(states, report, withOutput) {
    const queue = [];

    Object.keys(states[0].next).forEach(function (symbol) {
      const child = states[0].next[symbol];

      states[child].fail = 0;
      queue.push(child);
    });
    let head = 0;

    while (head < queue.length) {
      const at = queue[head];

      head += 1;

      if (withOutput) {
        const parentFail = states[at].fail;

        states[at].output = states[parentFail].ends.length > 0 ? parentFail : states[parentFail].output;
      }
      Object.keys(states[at].next).forEach(function (symbol) {
        const child = states[at].next[symbol];
        let fallback = states[at].fail;

        while (fallback !== 0 && states[fallback].next[symbol] === undefined) {
          report.preprocessing += 1;
          fallback = states[fallback].fail;
        }
        states[child].fail = states[fallback].next[symbol] === undefined
          ? 0 : states[fallback].next[symbol];

        if (states[child].fail === child) states[child].fail = 0;
        queue.push(child);
      });
    }
  }

  /**
   * One pass over the text. On a mismatch the state falls back along the
   * failure chain rather than restarting, so no text position is examined
   * twice, and every state reached reports its own pattern plus every pattern
   * on its output chain.
   */
  function search(automaton, text, options) {
    const settings = options || {};
    const report = settings.report || automaton.report;
    const states = automaton.states;
    const found = [];
    let at = 0;

    for (let i = 0; i < text.length; i += 1) {
      report.comparisons += 1;

      while (at !== 0 && states[at].next[text[i]] === undefined) {
        report.failureFollows += 1;
        at = states[at].fail;
      }
      at = states[at].next[text[i]] === undefined ? 0 : states[at].next[text[i]];
      collect(states, at, i, { found: found, report: report,
        patterns: automaton.patterns, outputLinks: automaton.outputLinks });
    }
    report.matches = found.length;
    return { matches: found, report: report };
  }

  /** The state's own patterns, then the output chain. Dropping the chain is
   *  the bug this module can be asked to reproduce. */
  function collect(states, at, index, context) {
    states[at].ends.forEach(function (id) {
      context.found.push({ pattern: id, end: index,
        start: index - context.patterns[id].length + 1 });
    });

    if (!context.outputLinks) return;
    let link = states[at].output;

    while (link !== -1 && link !== undefined) {
      context.report.outputFollows += 1;
      states[link].ends.forEach(function (id) {
        context.found.push({ pattern: id, end: index,
          start: index - context.patterns[id].length + 1 });
      });
      link = states[link].output;
    }
  }

  /**
   * The goto table: `next[state][symbol]` with every failure fallback already
   * resolved, so matching is one lookup per character and no inner loop. It
   * costs `|alphabet| x states` cells, which on a large alphabet is the reason
   * production implementations keep the sparse form and follow links.
   */
  function toAutomaton(automaton, alphabet) {
    const states = automaton.states;
    const symbols = alphabet.split('');
    const table = [];

    for (let at = 0; at < states.length; at += 1) {
      const row = {};

      symbols.forEach(function (symbol) {
        if (states[at].next[symbol] !== undefined) { row[symbol] = states[at].next[symbol]; return; }
        row[symbol] = at === 0 ? 0 : table[states[at].fail][symbol];
      });
      table.push(row);
    }
    return { table: table, cells: table.length * symbols.length, states: table.length };
  }

  /** Every pattern searched separately by the naive matcher: the oracle, and
   *  the thing Aho-Corasick replaces. */
  function bruteForce(patterns, text) {
    const found = [];

    patterns.forEach(function (pattern, id) {
      if (pattern.length === 0) return;

      for (let start = 0; start + pattern.length <= text.length; start += 1) {
        if (text.substr(start, pattern.length) !== pattern) continue;
        found.push({ pattern: id, start: start, end: start + pattern.length - 1 });
      }
    });
    return sortMatches(found);
  }

  function sortMatches(matches) {
    return matches.slice().sort(function (a, b) {
      return a.start - b.start || a.pattern - b.pattern;
    });
  }

  /** Two match lists compared as multisets, so a duplicate report is a
   *  disagreement rather than a rounding error. */
  function compare(found, truth) {
    const a = sortMatches(found).map(keyOf);
    const b = sortMatches(truth).map(keyOf);
    const seen = {};

    b.forEach(function (key) { seen[key] = (seen[key] || 0) + 1; });
    let extra = 0;

    a.forEach(function (key) {
      if (!seen[key]) { extra += 1; return; }
      seen[key] -= 1;
    });
    const missing = Object.keys(seen).reduce(function (sum, key) { return sum + seen[key]; }, 0);

    return { missing: missing, extra: extra, agree: missing === 0 && extra === 0,
      found: a.length, expected: b.length };
  }

  function keyOf(match) {
    return match.pattern + '@' + match.start;
  }

  /**
   * A pattern set where one pattern is a suffix of another, which is the case
   * output links exist for. Without them `he` is never reported inside `she`,
   * and every other pattern is reported correctly - so the bug looks like a
   * data problem rather than an algorithm problem.
   */
  function suffixSet() {
    return { patterns: ['he', 'she', 'his', 'hers', 'her'],
      text: 'ushers said he hushed his hers' };
  }

  return {
    emptyReport: emptyReport, build: build, search: search, toAutomaton: toAutomaton,
    bruteForce: bruteForce, compare: compare, sortMatches: sortMatches, suffixSet: suffixSet
  };
}));
