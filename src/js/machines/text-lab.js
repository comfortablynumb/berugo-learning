/**
 * The M06 harness: one workload, replayed against every structure that claims
 * to answer the same question.
 *
 * Three comparisons live here, because in each case the interesting number is
 * a *ratio between implementations* and getting it means driving them through
 * one interface rather than three ad-hoc loops in three section controllers:
 *
 *   - `compareDictionaries` — trie layouts, radix trie, ternary tree and DAWG
 *     over one key set: nodes, bytes, and the cost of a lookup.
 *   - `compareSubstringIndexes` — suffix tree, suffix array and suffix
 *     automaton over one text: size, build counters, and a cross-check that
 *     all three answer "is P a substring" identically. That cross-check is the
 *     milestone's acceptance criterion, and it belongs where every section can
 *     call it.
 *   - `compareFuzzy` — BK-tree, Levenshtein automaton and n-gram index against
 *     brute force, reporting recall as well as cost, because two of the three
 *     are exact and one is not.
 *
 * Nothing here touches the DOM.
 */
(function (root, factory) {
  const api = factory(root, typeof require === 'function' ? require : null);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.TextLab = api;
}(typeof window !== 'undefined' ? window : null, function (scope, requireFn) {
  'use strict';

  function load(name, global) {
    if (scope && scope[global]) return scope[global];
    return requireFn ? requireFn(name) : null;
  }

  const Trie = load('../algorithms/trie.js', 'Trie');
  const RadixTrie = load('../algorithms/radix-trie.js', 'RadixTrie');
  const TernaryTrie = load('../algorithms/ternary-trie.js', 'TernaryTrie');
  const Dawg = load('../algorithms/dawg.js', 'Dawg');
  const SuffixTree = load('../algorithms/suffix-tree.js', 'SuffixTree');
  const SuffixArray = load('../algorithms/suffix-array.js', 'SuffixArray');
  const SuffixAutomaton = load('../algorithms/suffix-automaton.js', 'SuffixAutomaton');
  const Bwt = load('../algorithms/bwt.js', 'Bwt');
  const FuzzySearch = load('../algorithms/fuzzy-search.js', 'FuzzySearch');
  const Random = load('../utils/random.js', 'Random');

  /* ------------------------------------------------------ dictionaries */

  const DICTIONARY_FAMILIES = [
    {
      id: 'trie-map', label: 'trie, map nodes',
      build: function (keys) {
        const structure = Trie.create({ layout: 'map' });
        keys.forEach(structure.insert);
        return structure;
      }
    },
    {
      id: 'trie-array', label: 'trie, 26-slot array nodes',
      build: function (keys) {
        const structure = Trie.create({ layout: 'array' });
        keys.forEach(structure.insert);
        return structure;
      }
    },
    {
      id: 'trie-sorted', label: 'trie, sorted child arrays',
      build: function (keys) {
        const structure = Trie.create({ layout: 'sorted' });
        keys.forEach(structure.insert);
        return structure;
      }
    },
    {
      id: 'radix', label: 'radix trie',
      build: function (keys) {
        const structure = RadixTrie.create({});
        keys.forEach(structure.insert);
        return structure;
      }
    },
    {
      id: 'radix-adaptive', label: 'radix trie, ART node sizes',
      build: function (keys) {
        const structure = RadixTrie.create({ adaptive: true });
        keys.forEach(structure.insert);
        return structure;
      }
    },
    {
      id: 'ternary', label: 'ternary tree, sorted input',
      build: function (keys) { return TernaryTrie.create({ keys: keys }); }
    },
    {
      id: 'ternary-balanced', label: 'ternary tree, median order',
      build: function (keys) { return TernaryTrie.create({ keys: keys, balanced: true }); }
    },
    {
      id: 'dawg', label: 'DAWG',
      build: function (keys) { return Dawg.fromKeys(keys); }
    }
  ];

  /** Look every key up, then a set of misses, and report what it cost. The
   *  miss set matters: a structure can be fast on hits and slow on misses, and
   *  a search box is mostly misses. */
  function probe(structure, keys, misses) {
    structure.resetStats();
    let hits = 0;
    keys.forEach(function (key) { if (structure.has(key)) hits += 1; });
    let falseHits = 0;
    misses.forEach(function (key) { if (structure.has(key)) falseHits += 1; });

    const stats = structure.stats();
    const work = (stats.charSteps || 0) + (stats.charComparisons || 0) + (stats.nodeVisits || 0);
    return { hits: hits, falseHits: falseHits, work: work, perLookup: work / (keys.length + misses.length) };
  }

  /** Keys that are not in the set but look like they could be. */
  function missesFor(keys, count, seed) {
    const present = new Set(keys);
    const rng = Random.seeded(seed === undefined ? 4 : seed);
    const out = [];

    while (out.length < count) {
      const base = keys[rng.int(keys.length)];
      const at = rng.int(base.length);
      const symbol = 'abcdefghijklmnopqrstuvwxyz'[rng.int(26)];
      const candidate = base.slice(0, at) + symbol + base.slice(at + 1);
      if (!present.has(candidate)) out.push(candidate);
    }
    return out;
  }

  function compareDictionaries(options) {
    const settings = options || {};
    const keys = settings.keys || [];
    const only = settings.families;
    const misses = missesFor(keys, settings.misses || Math.max(1, Math.floor(keys.length / 4)), settings.seed);
    const reference = keys.slice().sort();

    return DICTIONARY_FAMILIES
      .filter(function (family) { return !only || only.indexOf(family.id) !== -1; })
      .map(function (family) {
        const structure = family.build(keys);
        const measured = probe(structure, keys, misses);
        const invariants = structure.checkInvariants();
        const listed = structure.keys();

        return {
          id: family.id,
          label: family.label,
          nodes: structure.nodes(),
          bytes: structure.bytes(),
          bytesPerKey: structure.bytes() / Math.max(1, keys.length),
          height: structure.height ? structure.height() : null,
          work: measured.work,
          perLookup: measured.perLookup,
          ok: invariants.ok && listed.join(',') === reference.join(',') && measured.falseHits === 0,
          errors: invariants.errors
        };
      });
  }

  /* -------------------------------------------------- substring indexes */

  /** Every structure that answers "is P a substring of T", cross-checked
   *  against brute force on the same patterns. */
  function compareSubstringIndexes(options) {
    const settings = options || {};
    const text = settings.text || '';
    const patterns = settings.patterns || samplePatterns(text, settings.probes || 200, settings.seed);

    const tree = SuffixTree.build(text);
    const array = SuffixArray.build(text, { method: settings.method || 'sais' });
    const automaton = SuffixAutomaton.build(text);
    const index = Bwt.fmIndex(text, {
      suffixArrayOf: function (withSentinel) { return SuffixArray.build(withSentinel, { method: 'sais' }).sa; }
    });

    const disagreements = crossCheck(text, patterns, { tree: tree, array: array, automaton: automaton, fm: index });

    return {
      patterns: patterns.length,
      disagreements: disagreements,
      agree: disagreements.length === 0,
      rows: sizeRows({ tree: tree, array: array, automaton: automaton, fm: index }),
      distinctSubstrings: {
        array: array.distinctSubstrings(),
        automaton: automaton.distinctSubstrings(),
        agree: array.distinctSubstrings() === automaton.distinctSubstrings()
      }
    };
  }

  /** Every structure's answer to "is P a substring", against `indexOf`. Any row
   *  where one of them disagrees is returned - which is the milestone's
   *  acceptance criterion, and the thing a skipped clone case fails. */
  function crossCheck(text, patterns, built) {
    return patterns.map(function (pattern) {
      const truth = text.indexOf(pattern) !== -1;
      return {
        pattern: pattern,
        truth: truth,
        tree: built.tree.has(pattern),
        array: built.array.rangeOf(pattern).count > 0,
        automaton: built.automaton.has(pattern),
        fm: built.fm.count(pattern) > 0
      };
    }).filter(function (row) {
      return row.tree !== row.truth || row.array !== row.truth ||
        row.automaton !== row.truth || row.fm !== row.truth;
    });
  }

  /** The size column: each structure counts a different unit, so the only
   *  comparable number is bytes per input character. */
  function sizeRows(built) {
    return [
      {
        id: 'suffix-tree', label: 'suffix tree',
        units: built.tree.nodes(), unitLabel: 'nodes',
        bytesPerChar: built.tree.bytesPerChar(), ok: built.tree.checkInvariants().ok
      },
      {
        id: 'suffix-array', label: 'suffix array + LCP',
        units: built.array.sa.length, unitLabel: 'entries',
        bytesPerChar: built.array.bytesPerChar(), ok: built.array.checkInvariants().ok
      },
      {
        id: 'suffix-automaton', label: 'suffix automaton',
        units: built.automaton.stateCount(), unitLabel: 'states',
        bytesPerChar: built.automaton.bytesPerChar(), ok: built.automaton.checkInvariants().ok
      },
      {
        id: 'fm-index', label: 'FM-index',
        units: built.fm.last.length, unitLabel: 'BWT characters',
        bytesPerChar: built.fm.bytesPerChar(), ok: built.fm.checkInvariants().ok
      }
    ];
  }

  /** Half real substrings, half near-misses, so a structure that accepts a
   *  superset is caught rather than congratulated. */
  function samplePatterns(text, count, seed) {
    const rng = Random.seeded(seed === undefined ? 6 : seed);
    const alphabet = Array.from(new Set(text.split('')));
    const out = [];

    for (let i = 0; i < count; i += 1) {
      const length = 1 + rng.int(Math.min(8, Math.max(1, text.length - 1)));
      if (i % 2 === 0 && text.length > length) {
        out.push(text.substr(rng.int(text.length - length), length));
      } else {
        let made = '';
        for (let j = 0; j < length; j += 1) made += alphabet[rng.int(alphabet.length)];
        out.push(made);
      }
    }
    return out;
  }

  /* --------------------------------------------------------- fuzzy search */

  /** Counts only the answers that are actually correct, so an approximate
   *  back-end cannot inflate its recall by returning extra words. */
  function accumulate(bucket, found, truth, visits) {
    bucket.visits += visits;
    bucket.found += found.filter(function (word) { return truth.indexOf(word) !== -1; }).length;
    if (found.join(',') !== truth.join(',')) bucket.exact = false;
  }

  function compareFuzzy(options) {
    const settings = options || {};
    const words = settings.words || [];
    const queries = settings.queries || [];
    const budget = settings.budget === undefined ? 1 : settings.budget;

    const bk = FuzzySearch.bkTree(words);
    const dictionary = FuzzySearch.dictionaryTrie(words);
    const grams = FuzzySearch.ngramIndex(words, { size: settings.gramSize || 2 });

    const totals = {
      bk: { visits: 0, found: 0, exact: true },
      automaton: { visits: 0, found: 0, exact: true },
      ngram: { visits: 0, found: 0, exact: true },
      truth: 0
    };

    queries.forEach(function (query) {
      const truth = FuzzySearch.bruteForce(words, query, budget, null);
      totals.truth += truth.length;

      bk.resetStats();
      accumulate(totals.bk, bk.search(query, budget), truth, bk.stats().nodeVisits);

      const counters = FuzzySearch.newStats();
      const fromAutomaton = FuzzySearch.automatonSearch(dictionary.root, query, budget, counters);
      accumulate(totals.automaton, fromAutomaton, truth, counters.nodeVisits);

      grams.resetStats();
      accumulate(totals.ngram, grams.search(query, budget), truth, grams.stats().candidates);
    });

    return { queries: queries.length, expected: totals.truth, rows: fuzzyRows(totals) };
  }

  /** Recall is `found / expected` with `found` already filtered to correct
   *  answers, so an exact back-end reads 1.000 and an approximate one reads
   *  what it actually returned. */
  function fuzzyRows(totals) {
    const LABELS = [
      { key: 'bk', id: 'bk-tree', label: 'BK-tree' },
      { key: 'automaton', id: 'automaton', label: 'Levenshtein automaton' },
      { key: 'ngram', id: 'ngram', label: 'n-gram index' }
    ];

    return LABELS.map(function (row) {
      const bucket = totals[row.key];
      return {
        id: row.id,
        label: row.label,
        visits: bucket.visits,
        found: bucket.found,
        exact: bucket.exact,
        recall: totals.truth ? bucket.found / totals.truth : 1
      };
    });
  }

  /** A snapshot for `TrieView`, capped by node count.
   *
   *  `childrenOf` exists because the child container is not the same object in
   *  every structure: a radix or suffix-tree node holds a Map, and a plain trie
   *  node holds whichever of three layouts it was built with. Reaching into
   *  `node.children` works for two of the four and throws for the others. */
  function snapshot(node, options) {
    const settings = options || {};
    const limit = settings.limit || 120;
    const labelOf = settings.labelOf || function (child, symbol) { return child.label || symbol; };
    const childrenOf = settings.childrenOf || function (current) {
      return current.children ? Array.from(current.children.entries()).sort() : [];
    };
    let budget = limit;

    const convert = function (current, label) {
      budget -= 1;
      const children = [];
      const entries = childrenOf(current);

      for (let i = 0; i < entries.length; i += 1) {
        if (budget <= 0) { children.push({ label: '', truncated: true, children: [] }); break; }
        children.push(convert(entries[i][1], labelOf(entries[i][1], entries[i][0])));
      }
      return { label: label, terminal: Boolean(current.terminal), children: children };
    };

    return convert(node, '');
  }

  return {
    DICTIONARY_FAMILIES: DICTIONARY_FAMILIES,
    compareDictionaries: compareDictionaries,
    compareSubstringIndexes: compareSubstringIndexes,
    compareFuzzy: compareFuzzy,
    samplePatterns: samplePatterns,
    missesFor: missesFor,
    snapshot: snapshot
  };
}));
