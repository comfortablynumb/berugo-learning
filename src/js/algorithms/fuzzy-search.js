/**
 * Three ways to answer "which dictionary words are within k edits of this
 * one", and the accuracy/latency trade each one makes.
 *
 *   - **BK-tree.** Nodes are keyed by their edit distance to the parent. The
 *     triangle inequality does the pruning: if d(query, node) = d, only
 *     children at distances d − k … d + k can hold an answer. That is the
 *     whole trick, and it is why the metric must be a *real* metric - swap in
 *     a similarity that violates the triangle inequality and the pruning
 *     silently drops correct answers rather than failing.
 *   - **Levenshtein automaton.** A DFA-shaped walk over the dictionary trie
 *     carrying the dynamic-programming row as state. A row whose minimum
 *     exceeds k cannot recover, so the subtree is cut. This is the one that
 *     scales with the alphabet rather than with the dictionary.
 *   - **N-gram index.** Every word is indexed by its character n-grams; a
 *     query retrieves candidates sharing enough of them and verifies each.
 *     Fast and *approximate*: a short word within distance k may share no
 *     n-grams at all, so recall is below 1 and the section measures it rather
 *     than claiming it.
 *
 * `bruteForce` is the reference every one of them is checked against, because
 * a fuzzy search that silently returns 97% of the answers looks exactly like
 * one that returns all of them until someone measures.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.FuzzySearch = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function newStats() {
    return { distanceCalls: 0, cellsFilled: 0, nodeVisits: 0, candidates: 0, verifications: 0, pruned: 0 };
  }

  /** Levenshtein distance, two rows rather than a full matrix. */
  function distance(a, b, stats) {
    if (stats) stats.distanceCalls += 1;
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;

    let previous = [];
    for (let j = 0; j <= b.length; j += 1) previous.push(j);

    for (let i = 1; i <= a.length; i += 1) {
      const current = [i];
      for (let j = 1; j <= b.length; j += 1) {
        if (stats) stats.cellsFilled += 1;
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        current.push(Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost));
      }
      previous = current;
    }
    return previous[b.length];
  }

  function bruteForce(words, query, budget, stats) {
    const out = [];
    words.forEach(function (word) {
      if (distance(query, word, stats) <= budget) out.push(word);
    });
    return out.sort();
  }

  /* ------------------------------------------------------------ BK-tree */

  function bkTree(words) {
    const stats = newStats();
    let root = null;
    let nodeCount = 0;

    function insert(word) {
      if (!root) { root = { word: word, children: new Map() }; nodeCount = 1; return; }
      let node = root;

      for (;;) {
        const d = distance(word, node.word, stats);
        if (d === 0) return;
        const child = node.children.get(d);
        if (!child) { node.children.set(d, { word: word, children: new Map() }); nodeCount += 1; return; }
        node = child;
      }
    }

    words.forEach(insert);

    /** Only the children whose key lies in [d − k, d + k] can hold a match.
     *  Every other subtree is skipped without a single distance call. */
    function search(query, budget) {
      const out = [];
      if (!root) return out;
      const stack = [root];

      while (stack.length) {
        const node = stack.pop();
        stats.nodeVisits += 1;
        const d = distance(query, node.word, stats);
        if (d <= budget) out.push(node.word);

        node.children.forEach(function (child, key) {
          if (key >= d - budget && key <= d + budget) stack.push(child);
          else stats.pruned += 1;
        });
      }
      return out.sort();
    }

    function depth() {
      let deepest = 0;
      const stack = [{ node: root, level: 1 }];
      while (stack.length) {
        const item = stack.pop();
        if (!item.node) continue;
        if (item.level > deepest) deepest = item.level;
        item.node.children.forEach(function (child) { stack.push({ node: child, level: item.level + 1 }); });
      }
      return deepest;
    }

    /** The triangle inequality has to hold or the pruning is unsound. This
     *  checks it on the tree's own words, which is the only honest way to
     *  justify the pruning to a reader. */
    function checkMetric(sample) {
      const errors = [];
      const list = sample || words.slice(0, 40);

      list.forEach(function (a) {
        list.forEach(function (b) {
          list.forEach(function (c) {
            const direct = distance(a, c, null);
            const detour = distance(a, b, null) + distance(b, c, null);
            if (direct > detour) {
              errors.push('d(' + a + ',' + c + ') = ' + direct + ' exceeds d(' + a + ',' + b + ') + d(' + b + ',' + c + ') = ' + detour);
            }
          });
        });
      });
      return { ok: errors.length === 0, errors: errors.slice(0, 3) };
    }

    return {
      name: 'bk-tree',
      insert: insert,
      search: search,
      nodes: function () { return nodeCount; },
      depth: depth,
      checkMetric: checkMetric,
      stats: function () { return Object.assign({ nodes: nodeCount }, stats); },
      resetStats: function () { Object.keys(stats).forEach(function (key) { stats[key] = 0; }); }
    };
  }

  /* --------------------------------------------- Levenshtein automaton */

  /** The DP row for `query` against a prefix, advanced one character at a
   *  time. Carrying the row *is* the automaton state; the classic construction
   *  numbers the states instead, and this is the same machine with the state
   *  written out. */
  function startRow(query) {
    const row = [];
    for (let i = 0; i <= query.length; i += 1) row.push(i);
    return row;
  }

  function stepRow(row, query, symbol, stats) {
    const next = [row[0] + 1];
    for (let i = 1; i <= query.length; i += 1) {
      if (stats) stats.cellsFilled += 1;
      const cost = query[i - 1] === symbol ? 0 : 1;
      next.push(Math.min(next[i - 1] + 1, row[i] + 1, row[i - 1] + cost));
    }
    return next;
  }

  /** Walk a trie-shaped dictionary, cutting a subtree the moment the row's
   *  minimum passes the budget: no descendant can bring it back down. */
  function automatonSearch(trie, query, budget, stats) {
    const out = [];
    const counters = stats || newStats();

    const visit = function (node, spelled, row) {
      counters.nodeVisits += 1;
      if (node.terminal && row[query.length] <= budget) out.push(spelled);

      const minimum = Math.min.apply(null, row);
      if (minimum > budget) { counters.pruned += 1; return; }

      node.children.forEach(function (child, symbol) {
        visit(child, spelled + symbol, stepRow(row, query, symbol, counters));
      });
    };

    visit(trie, '', startRow(query));
    return out.sort();
  }

  /** A minimal trie for the automaton to walk: children as a Map, terminal
   *  flags. Built here rather than reused from `trie.js` so the walk above has
   *  exactly the shape a Levenshtein automaton needs and nothing else. */
  function dictionaryTrie(words) {
    const root = { terminal: false, children: new Map() };
    let nodes = 1;

    words.forEach(function (word) {
      let node = root;
      for (let i = 0; i < word.length; i += 1) {
        if (!node.children.has(word[i])) {
          node.children.set(word[i], { terminal: false, children: new Map() });
          nodes += 1;
        }
        node = node.children.get(word[i]);
      }
      node.terminal = true;
    });

    return { root: root, nodes: function () { return nodes; } };
  }

  /* ---------------------------------------------------------- n-grams */

  /** Padded n-grams, so a word's start and end are matchable. */
  function ngramsOf(word, size) {
    const padded = '^' + word + '$';
    const out = [];
    for (let i = 0; i + size <= padded.length; i += 1) out.push(padded.slice(i, i + size));
    return out;
  }

  function ngramIndex(words, options) {
    const settings = options || {};
    const size = settings.size || 2;
    const stats = newStats();
    const index = new Map();

    words.forEach(function (word) {
      new Set(ngramsOf(word, size)).forEach(function (gram) {
        if (!index.has(gram)) index.set(gram, []);
        index.get(gram).push(word);
      });
    });

    /** Candidates sharing at least `threshold` n-grams, then verified. The
     *  threshold is the recall dial, and setting it by the usual
     *  |grams| − 1 − (k − 1)·size rule is what makes this approximate. */
    function search(query, budget, threshold) {
      const grams = new Set(ngramsOf(query, size));
      const tally = new Map();

      grams.forEach(function (gram) {
        (index.get(gram) || []).forEach(function (word) {
          tally.set(word, (tally.get(word) || 0) + 1);
        });
      });

      const floor = threshold === undefined
        ? Math.max(1, grams.size - 1 - (budget - 1) * size)
        : threshold;

      const out = [];
      tally.forEach(function (shared, word) {
        if (shared < floor) return;
        stats.candidates += 1;
        stats.verifications += 1;
        if (distance(query, word, stats) <= budget) out.push(word);
      });
      return out.sort();
    }

    return {
      name: 'ngram-' + size,
      size: size,
      search: search,
      grams: function () { return index.size; },
      postings: function () {
        let total = 0;
        index.forEach(function (list) { total += list.length; });
        return total;
      },
      stats: function () { return Object.assign({ grams: index.size }, stats); },
      resetStats: function () { Object.keys(stats).forEach(function (key) { stats[key] = 0; }); }
    };
  }

  /* ------------------------------------------------------ autocomplete */

  /** Top-k prefix completion with precomputed subtree maxima: each node stores
   *  the best score below it, so the walk is a best-first search that never
   *  descends into a subtree that cannot beat the current k-th answer. Without
   *  the maxima the walk has to enumerate the whole subtree and sort it. */
  function scoredTrie(entries) {
    const stats = newStats();
    const root = { terminal: false, score: 0, best: -Infinity, children: new Map() };
    let nodes = 1;

    entries.forEach(function (entry) {
      let node = root;
      node.best = Math.max(node.best, entry.score);

      for (let i = 0; i < entry.word.length; i += 1) {
        if (!node.children.has(entry.word[i])) {
          node.children.set(entry.word[i], { terminal: false, score: 0, best: -Infinity, children: new Map() });
          nodes += 1;
        }
        node = node.children.get(entry.word[i]);
        node.best = Math.max(node.best, entry.score);
      }
      node.terminal = true;
      node.score = entry.score;
    });

    function complete(prefix, k) {
      let node = root;
      for (let i = 0; i < prefix.length; i += 1) {
        stats.nodeVisits += 1;
        node = node.children.get(prefix[i]);
        if (!node) return [];
      }

      const found = [];
      /* A small max-heap would do; with k in the tens an insertion into a
         sorted array of length k is fewer operations than maintaining one. */
      const frontier = [{ node: node, text: prefix }];

      while (frontier.length) {
        frontier.sort(function (a, b) { return b.node.best - a.node.best; });
        const item = frontier.shift();
        stats.nodeVisits += 1;

        if (found.length >= k && item.node.best <= found[found.length - 1].score) {
          stats.pruned += 1;
          continue;
        }
        if (item.node.terminal) {
          found.push({ word: item.text, score: item.node.score });
          found.sort(function (a, b) { return b.score - a.score; });
          if (found.length > k) found.pop();
        }
        item.node.children.forEach(function (child, symbol) {
          frontier.push({ node: child, text: item.text + symbol });
        });
      }
      return found;
    }

    return {
      name: 'scored-trie',
      complete: complete,
      nodes: function () { return nodes; },
      stats: function () { return Object.assign({ nodes: nodes }, stats); },
      resetStats: function () { Object.keys(stats).forEach(function (key) { stats[key] = 0; }); }
    };
  }

  return {
    distance: distance,
    bruteForce: bruteForce,
    bkTree: bkTree,
    dictionaryTrie: dictionaryTrie,
    automatonSearch: automatonSearch,
    startRow: startRow,
    stepRow: stepRow,
    ngramsOf: ngramsOf,
    ngramIndex: ngramIndex,
    scoredTrie: scoredTrie,
    newStats: newStats
  };
}));
