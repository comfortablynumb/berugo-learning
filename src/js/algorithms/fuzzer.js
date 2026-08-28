/**
 * Coverage-guided fuzzing, and the part that is actually hard.
 *
 * The loop is simple and it is not where the difficulty is: take an input from
 * the corpus, mutate it, run the target, and if the run reached anything the
 * corpus had not reached before, keep the mutant. Coverage feedback is what
 * turns random input into a search — without it a fuzzer has no gradient and
 * finds only what a random generator finds; with it, an input that gets one
 * token deeper into the parser is preserved and built on.
 *
 * **The oracle is the hard part.** Without sanitisers, assertions or a
 * differential reference, a fuzzer can only find crashes, and most bugs are
 * not crashes. This one carries three oracles and reports them separately,
 * because they find different things: a THROW that is not a diagnostic (the
 * front end is supposed to report an error, not fall over), a DIFFERENTIAL
 * disagreement between two ways of running the same program, and an INVARIANT
 * on the output. A run with only the first is a crash finder.
 *
 * Corpus minimisation is here because a corpus grows monotonically and most
 * of it is redundant: an input is kept only if it contributes an edge no
 * smaller input already covers. That is a set-cover problem solved greedily by
 * size, and the measurement worth making is that total coverage is UNCHANGED —
 * a minimisation that loses an edge has lost a test.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Fuzzer = api;
}(typeof window !== 'undefined' ? window : null, function (root) {
  'use strict';

  const Random = root && root.Random ? root.Random : require('../utils/random.js');

  const ALPHABET = ['let ', 'fn ', 'if ', 'else ', 'while ', 'return ', 'match ',
    '(', ')', '{', '}', '[', ']', ',', ';', '=', '==', '+', '-', '*', '/', '<', '>',
    'x', 'y', 'f', '0', '1', '42', '"s"', 'true', 'false', ' ', '\n'];

  /* ------------------------------------------------------------ mutation */

  const MUTATORS = [
    { id: 'insert', about: 'splice a token in at a random position' },
    { id: 'delete', about: 'remove a run of characters' },
    { id: 'replace', about: 'overwrite a run with a token' },
    { id: 'duplicate', about: 'copy a slice of the input to another position' },
    { id: 'splice', about: 'join the head of one corpus entry to the tail of another' }
  ];

  function mutate(input, rng, corpus) {
    const choice = MUTATORS[Math.floor(rng.next() * MUTATORS.length)];

    if (choice.id === 'insert') return applyInsert(input, rng);
    if (choice.id === 'delete') return applyDelete(input, rng);
    if (choice.id === 'replace') return applyReplace(input, rng);
    if (choice.id === 'duplicate') return applyDuplicate(input, rng);
    return applySplice(input, rng, corpus);
  }

  function token(rng) {
    return ALPHABET[Math.floor(rng.next() * ALPHABET.length)];
  }

  function applyInsert(input, rng) {
    const at = Math.floor(rng.next() * (input.length + 1));

    return input.slice(0, at) + token(rng) + input.slice(at);
  }

  function applyDelete(input, rng) {
    if (!input.length) return input;
    const at = Math.floor(rng.next() * input.length);
    const span = 1 + Math.floor(rng.next() * 4);

    return input.slice(0, at) + input.slice(at + span);
  }

  function applyReplace(input, rng) {
    if (!input.length) return token(rng);
    const at = Math.floor(rng.next() * input.length);
    const span = 1 + Math.floor(rng.next() * 3);

    return input.slice(0, at) + token(rng) + input.slice(at + span);
  }

  function applyDuplicate(input, rng) {
    if (!input.length) return input;
    const from = Math.floor(rng.next() * input.length);
    const span = 1 + Math.floor(rng.next() * 8);
    const at = Math.floor(rng.next() * (input.length + 1));
    const slice = input.slice(from, from + span);

    return input.slice(0, at) + slice + input.slice(at);
  }

  function applySplice(input, rng, corpus) {
    if (!corpus || !corpus.length) return applyInsert(input, rng);
    const other = corpus[Math.floor(rng.next() * corpus.length)].input;
    const cut = Math.floor(rng.next() * (input.length + 1));
    const otherCut = Math.floor(rng.next() * (other.length + 1));

    return input.slice(0, cut) + other.slice(otherCut);
  }

  /* ------------------------------------------------------------ the loop */

  function newEdges(seen, coverage) {
    return coverage.filter(function (edge) { return !seen[edge]; });
  }

  /**
   * The coverage-guided loop. `target(input)` returns
   * `{ coverage, verdict, detail }`, and an input is added to the corpus only
   * when it covers something new — which is what makes the corpus a summary of
   * the behaviours found rather than a log of the inputs tried.
   */
  function run(target, options) {
    const settings = options || {};
    const rng = Random.seeded(settings.seed || 1);
    const state = { seen: {}, corpus: [], crashes: [], history: [],
      executions: 0, edges: 0, rejected: 0 };

    (settings.seeds || ['let x = 1;']).forEach(function (input) {
      admit(state, target, input, 'seed');
    });
    for (let at = 0; at < (settings.iterations || 500); at += 1) {
      iterate(state, target, rng, at);
    }
    return report(state);
  }

  function iterate(state, target, rng, at) {
    const parent = state.corpus.length
      ? state.corpus[Math.floor(rng.next() * state.corpus.length)]
      : { input: '' };
    const candidate = mutate(parent.input, rng, state.corpus);

    admit(state, target, candidate, 'mutation');
    state.history.push({ at: at, edges: state.edges, corpus: state.corpus.length,
      executions: state.executions });
  }

  function admit(state, target, input, why) {
    const outcome = target(input);

    state.executions += 1;
    recordCrash(state, input, outcome);
    const fresh = newEdges(state.seen, outcome.coverage || []);

    if (!fresh.length) { state.rejected += 1; return false; }
    fresh.forEach(function (edge) { state.seen[edge] = true; });
    state.edges += fresh.length;
    state.corpus.push({ input: input, coverage: (outcome.coverage || []).slice(),
      why: why, added: fresh.length });
    return true;
  }

  /**
   * Crashes are grouped by the oracle that fired and the detail it gave, which
   * is triage. A fuzzer that reported every failing input separately would
   * report the same bug a thousand times, and the count per group is the only
   * number that says how easy the bug is to hit.
   */
  function recordCrash(state, input, outcome) {
    if (outcome.verdict === 'ok') return;
    const key = outcome.verdict + ': ' + (outcome.detail || '');
    const existing = state.crashes.filter(function (row) { return row.key === key; })[0];

    if (existing) {
      existing.count += 1;
      if (input.length < existing.input.length) existing.input = input;
      return;
    }
    state.crashes.push({ key: key, verdict: outcome.verdict, detail: outcome.detail,
      input: input, count: 1 });
  }

  function report(state) {
    return { corpus: state.corpus, crashes: state.crashes, history: state.history,
      executions: state.executions, edges: state.edges, rejected: state.rejected,
      coverage: Object.keys(state.seen).sort() };
  }

  /* -------------------------------------------------------- minimisation */

  /**
   * Greedy set cover by input size: sort smallest first, keep an entry only if
   * it covers an edge nothing kept so far covers. Total coverage must be
   * identical afterwards, and asserting that is the point — a smaller corpus
   * that lost an edge has quietly lost a test.
   */
  function minimise(corpus) {
    const sorted = corpus.slice().sort(function (a, b) {
      return a.input.length - b.input.length;
    });
    const covered = {};
    const kept = [];

    sorted.forEach(function (entry) {
      const fresh = entry.coverage.filter(function (edge) { return !covered[edge]; });

      if (!fresh.length) return;
      fresh.forEach(function (edge) { covered[edge] = true; });
      kept.push(entry);
    });
    return { corpus: kept, before: corpus.length, after: kept.length,
      coverage: Object.keys(covered).sort(),
      bytesBefore: totalBytes(corpus), bytesAfter: totalBytes(kept) };
  }

  function totalBytes(corpus) {
    return corpus.reduce(function (sum, entry) { return sum + entry.input.length; }, 0);
  }

  function coverageOf(corpus) {
    const seen = {};

    corpus.forEach(function (entry) {
      entry.coverage.forEach(function (edge) { seen[edge] = true; });
    });
    return Object.keys(seen).sort();
  }

  /* ------------------------------------------------------------ shrinking */

  /**
   * Shrink a failing input by deleting the largest chunk that keeps it
   * failing the same way, repeatedly. "The same way" is the important half:
   * a shrinker that accepts any failure will happily minimise one bug into a
   * different one and hand back a reproduction for something else.
   */
  function shrink(target, input, options) {
    const settings = options || {};
    const original = target(input);
    let best = input;
    let rounds = 0;

    if (original.verdict === 'ok') return { input: input, rounds: 0, shrunk: false };
    while (rounds < (settings.rounds || 60)) {
      const next = shrinkOnce(target, best, original);

      rounds += 1;
      if (next === best) break;
      best = next;
    }
    return { input: best, rounds: rounds, shrunk: best.length < input.length,
      from: input.length, to: best.length, verdict: original.verdict,
      detail: original.detail };
  }

  function shrinkOnce(target, input, original) {
    for (let span = Math.max(1, Math.floor(input.length / 2)); span >= 1;
      span = Math.floor(span / 2)) {
      for (let at = 0; at + span <= input.length; at += 1) {
        const candidate = input.slice(0, at) + input.slice(at + span);
        const outcome = target(candidate);

        if (outcome.verdict !== original.verdict) continue;
        if ((outcome.detail || '') !== (original.detail || '')) continue;
        return candidate;
      }
      if (span === 1) break;
    }
    return input;
  }

  return { ALPHABET: ALPHABET, MUTATORS: MUTATORS, mutate: mutate, run: run,
    minimise: minimise, coverageOf: coverageOf, shrink: shrink, newEdges: newEdges };
}));
