/**
 * The harness for the language-theory sections: a catalogue of languages with
 * a real recogniser for each, the exponential subset-construction family, and
 * the two ways of proving a language is not regular.
 *
 * The catalogue exists because "which class is this language in" is a question
 * with a checkable answer, and the honest way to show that is to run a
 * recogniser of the weakest kind that works. A regular language gets a finite
 * automaton; `aⁿbⁿ` gets a counter, which is a pushdown machine with one
 * symbol; `aⁿbⁿcⁿ` needs two counters and is therefore not context-free. Each
 * entry says what it needs and the demo runs it, so the boundary is a
 * measurement rather than a claim.
 *
 * The pumping lemma is implemented as the GAME it actually is, because the
 * quantifier alternation is what people get wrong: the adversary picks the
 * pumping length, you pick the string, the adversary decomposes it, and you
 * pick the exponent. Myhill–Nerode is the other tool and the better one — it
 * proves non-regularity by exhibiting an infinite pairwise-distinguishable
 * family, and when the language IS regular the same construction builds the
 * minimal automaton.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.LanguageLab = api;
}(this, function (root) {
  'use strict';

  const Automaton = root && root.Automaton ? root.Automaton
    : require('./automaton.js');
  const Regex = root && root.RegexCompile ? root.RegexCompile
    : require('../algorithms/regex-compile.js');

  /* ------------------------------------------------------- the catalogue */

  function counts(word, symbol) {
    return word.split('').filter(function (ch) { return ch === symbol; }).length;
  }

  /**
   * Every entry carries the machine class that is SUFFICIENT, the reason, and a
   * recogniser written at that level — a finite automaton for the regular
   * rows, an explicit counter for the context-free ones, and so on.
   */
  function catalogue() {
    return [
      { id: 'even-a', description: 'strings over {a,b} with an even number of a',
        klass: 'regular', machine: 'finite automaton, 2 states',
        why: 'one bit of memory: the parity of the count so far',
        accepts: function (w) { return counts(w, 'a') % 2 === 0; },
        pattern: '(b|ab*a)*' },
      { id: 'ends-abb', description: 'strings over {a,b} ending in abb',
        klass: 'regular', machine: 'finite automaton, 4 states',
        why: 'remember only the last three characters',
        accepts: function (w) { return w.slice(-3) === 'abb'; },
        pattern: '(a|b)*abb' },
      { id: 'div3', description: 'binary numerals divisible by three',
        klass: 'regular', machine: 'finite automaton, 3 states',
        why: 'the remainder modulo three is all you need to carry',
        accepts: function (w) {
          return w.length > 0 && parseInt(w, 2) % 3 === 0;
        }, pattern: null },
      { id: 'anbn', description: 'aⁿbⁿ — as many b as a, in that order',
        klass: 'context-free', machine: 'pushdown automaton, one stack symbol',
        why: 'n is unbounded, so no fixed number of states can count it',
        accepts: function (w) {
          const n = counts(w, 'a');

          return w === 'a'.repeat(n) + 'b'.repeat(w.length - n) && counts(w, 'b') === n;
        }, pattern: null },
      { id: 'palindrome', description: 'palindromes over {a,b}',
        klass: 'context-free', machine: 'pushdown automaton, nondeterministic',
        why: 'the stack reverses the first half; no deterministic PDA does it',
        accepts: function (w) { return w === w.split('').reverse().join(''); },
        pattern: null },
      { id: 'anbncn', description: 'aⁿbⁿcⁿ — equal runs of all three',
        klass: 'context-sensitive', machine: 'linear-bounded automaton',
        why: 'one stack matches one pair of counts; two pairs need two',
        accepts: function (w) {
          const a = counts(w, 'a');

          return w === 'a'.repeat(a) + 'b'.repeat(a) + 'c'.repeat(a) && w.length === 3 * a;
        }, pattern: null },
      { id: 'squares', description: 'a to a square length',
        klass: 'context-sensitive', machine: 'linear-bounded automaton',
        why: 'the gaps between accepted lengths grow, which no pumping survives',
        accepts: function (w) {
          const n = Math.round(Math.sqrt(w.length));

          return w === 'a'.repeat(w.length) && n * n === w.length;
        }, pattern: null },
      { id: 'halting', description: 'programs that halt on their own source',
        klass: 'undecidable', machine: 'none — no machine decides it',
        why: 'M26 proves it; a decider for it decides its own negation',
        accepts: null, pattern: null }
    ];
  }

  function entry(id) {
    return catalogue().filter(function (row) { return row.id === id; })[0] || null;
  }

  /**
   * Run the recogniser over every string up to a bound, and — where the entry
   * names a regular expression — check the automaton agrees with it. That
   * agreement is what makes "this one is regular" a measurement.
   */
  function study(id, maxLength) {
    const row = entry(id);
    const bound = maxLength === undefined ? 6 : maxLength;
    const alphabet = alphabetFor(row);

    if (row.accepts === null) {
      return { row: row, accepted: [], tested: 0, machineAgrees: null, alphabet: alphabet };
    }
    const words = Automaton.strings(alphabet, bound);
    const accepted = words.filter(row.accepts);

    return { row: row, accepted: accepted, tested: words.length, alphabet: alphabet,
      machineAgrees: row.pattern === null ? null : checkPattern(row, alphabet, words) };
  }

  function alphabetFor(row) {
    if (row.id === 'div3') return ['0', '1'];
    if (row.id === 'anbncn') return ['a', 'b', 'c'];
    if (row.id === 'squares') return ['a'];
    return ['a', 'b'];
  }

  /**
   * The state count reported is the MINIMAL DFA's, not Thompson's: the
   * catalogue claims "a finite automaton with k states recognises this", and
   * the minimal machine is the one that claim is about. Thompson's NFA for the
   * same pattern has three times as many and would make the row look wrong.
   */
  function checkPattern(row, alphabet, words) {
    const machine = Regex.thompson(row.pattern, alphabet);
    const wrong = words.filter(function (word) {
      return Automaton.accepts(machine, word) !== row.accepts(word);
    });
    const minimal = Minimization().hopcroft(Automaton.toDfa(machine).dfa);

    return { agrees: wrong.length === 0, disagreements: wrong.length,
      states: minimal.after, nfaStates: machine.states.length };
  }

  /* -------------------------------------------- the exponential NFA family */

  /**
   * `(a|b)*a(a|b)^n` — the canonical family where determinisation blows up.
   * The NFA needs n + 2 states because it can guess where the marked `a` is;
   * the DFA must remember which of the last n + 1 positions held an `a`, which
   * is a subset of n + 1 positions, so 2^(n+1) states.
   */
  function exponentialFamily(n) {
    const tail = new Array(n).fill('(a|b)').join('');

    return '(a|b)*a' + tail;
  }

  /**
   * The measured state counts against the predicted 2^(n+1).
   *
   * The subset construction lands one state ABOVE the bound at every n,
   * because two of the subsets it builds denote the same language and it has
   * no way to know. Minimisation removes exactly that one and hits the
   * predicted number on the nose — which is the honest version of "the subset
   * construction is exponential": the exponent is right, and the constant
   * needs a second pass.
   */
  function blowUp(maxN) {
    const rows = [];

    for (let n = 1; n <= maxN; n += 1) {
      const pattern = exponentialFamily(n);
      const nfa = Regex.thompson(pattern, ['a', 'b']);
      const dfa = Automaton.toDfa(nfa).dfa;
      const minimal = Minimization().hopcroft(dfa);

      rows.push({ n: n, nfaStates: Automaton.removeEpsilon(nfa).states.length,
        positions: Regex.glushkov(pattern, ['a', 'b']).states.length,
        dfaStates: dfa.states.length, minimalStates: minimal.after,
        predicted: Math.pow(2, n + 1) });
    }
    return rows;
  }

  /* Loaded lazily so `minimization.js` may keep depending on this file's
     siblings without a require cycle at load time. */
  function Minimization() {
    return root && root.Minimization ? root.Minimization
      : require('../algorithms/minimization.js');
  }

  /* --------------------------------------------------------- pumping game */

  /**
   * One round of the game. The adversary has already fixed a pumping length p;
   * the challenger picks a word in the language of length at least p; the
   * adversary picks a split xyz with |xy| ≤ p and |y| ≥ 1; the challenger picks
   * an exponent i. The word wins if xy^i z leaves the language.
   *
   * Written as a search over the adversary's choices, so the demo can play
   * either side: `everySplitLoses` is the challenger's victory condition and it
   * quantifies over ALL splits, which is the part people skip.
   */
  function pumpingRound(config) {
    const word = config.word;
    const accepts = config.accepts;
    const splits = splitsOf(word, config.pumpingLength);
    const results = splits.map(function (split) {
      return { split: split, escape: firstEscape(split, accepts, config.maxExponent || 3) };
    });

    return {
      word: word, splits: results,
      everySplitLoses: results.every(function (entry) { return entry.escape !== null; }),
      survivors: results.filter(function (entry) { return entry.escape === null; })
        .map(function (entry) { return entry.split; })
    };
  }

  function splitsOf(word, pumpingLength) {
    const out = [];
    const cap = Math.min(pumpingLength, word.length);

    for (let x = 0; x < cap; x += 1) {
      for (let y = 1; x + y <= cap; y += 1) {
        out.push({ x: word.slice(0, x), y: word.slice(x, x + y), z: word.slice(x + y) });
      }
    }
    return out;
  }

  /** The smallest exponent that pushes the pumped word out of the language. */
  function firstEscape(split, accepts, maxExponent) {
    for (let i = 0; i <= maxExponent; i += 1) {
      const pumped = split.x + repeat(split.y, i) + split.z;

      if (!accepts(pumped)) return { exponent: i, word: pumped };
    }
    return null;
  }

  function repeat(word, times) {
    let out = '';

    for (let i = 0; i < times; i += 1) out += word;
    return out;
  }

  /* ------------------------------------------------------- Myhill–Nerode */

  /**
   * A family of prefixes no two of which can be followed by the same suffixes.
   * If the family is infinite the language is not regular, because each member
   * would need its own state — which is a proof, and unlike the pumping lemma
   * it also works in the positive direction.
   */
  function distinguishingFamily(config) {
    const prefixes = config.prefixes;
    const rows = [];

    for (let i = 0; i < prefixes.length; i += 1) {
      for (let j = i + 1; j < prefixes.length; j += 1) {
        rows.push(distinguishPair(prefixes[i], prefixes[j], config));
      }
    }
    return { prefixes: prefixes.slice(), pairs: rows,
      allDistinguished: rows.every(function (row) { return row.suffix !== null; }),
      states: prefixes.length };
  }

  function distinguishPair(left, right, config) {
    const suffixes = config.suffixes;

    for (let i = 0; i < suffixes.length; i += 1) {
      const suffix = suffixes[i];

      if (config.accepts(left + suffix) !== config.accepts(right + suffix)) {
        return { left: left, right: right, suffix: suffix,
          leftAccepts: config.accepts(left + suffix) };
      }
    }
    return { left: left, right: right, suffix: null, leftAccepts: null };
  }

  /** The standard family for `aⁿbⁿ`: a, aa, aaa, … distinguished by bⁿ. */
  function anbnFamily(size) {
    const prefixes = [];
    const suffixes = [];

    for (let i = 1; i <= size; i += 1) {
      prefixes.push('a'.repeat(i));
      suffixes.push('b'.repeat(i));
    }
    return distinguishingFamily({ prefixes: prefixes, suffixes: suffixes,
      accepts: entry('anbn').accepts });
  }

  return {
    catalogue: catalogue, entry: entry, study: study, alphabetFor: alphabetFor,
    exponentialFamily: exponentialFamily, blowUp: blowUp,
    pumpingRound: pumpingRound, splitsOf: splitsOf, firstEscape: firstEscape,
    distinguishingFamily: distinguishingFamily, anbnFamily: anbnFamily, counts: counts
  };
}));
