/**
 * Minimisation three ways, plus the brute-force reference that decides whether
 * any of them is right.
 *
 * The minimal DFA for a language is UNIQUE up to state naming, which is the
 * fact the whole section rests on: it makes "are these two patterns
 * equivalent" a decidable question with a yes-or-no answer rather than a
 * testing exercise. Three algorithms reach it:
 *
 *   - Moore's partition refinement: start with accepting/rejecting and split
 *     any block whose members disagree about where a symbol leads. O(n²·|Σ|),
 *     and the one whose intermediate partitions are worth animating.
 *   - Hopcroft's: refine against a worklist of splitters, always choosing the
 *     smaller half. O(n log n), and the standard implementation.
 *   - Brzozowski's: reverse, determinise, reverse, determinise. Two lines, and
 *     exponential in the worst case — included because it is the one people do
 *     not believe until they run it.
 *
 * `myhillNerode` computes the equivalence classes directly from the language
 * by exhaustive string testing. It is the oracle: a claim that a machine is
 * minimal means its state count equals the number of classes, and that is
 * checked rather than assumed.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.Minimization = api;
}(this, function (root) {
  'use strict';

  const Automaton = root && root.Automaton ? root.Automaton
    : require('../machines/automaton.js');

  function target(machine, state, symbol) {
    const next = Automaton.step(machine, state, symbol);

    return next.length ? next[0] : null;
  }

  /* ------------------------------------------------------ Moore refinement */

  /**
   * Partition refinement, keeping every intermediate partition so the demo can
   * show the split that separated two states rather than only the result.
   */
  function moore(machine) {
    const dfa = Automaton.complete(Automaton.trim(machine));
    const rounds = [];
    let blocks = initialBlocks(dfa);

    rounds.push({ round: 0, blocks: describe(blocks), splitter: null });
    for (let round = 1; round <= dfa.states.length + 1; round += 1) {
      const split = refineOnce(dfa, blocks);

      rounds.push({ round: round, blocks: describe(split.blocks),
        splitter: split.splitter });
      if (split.blocks.length === blocks.length) {
        blocks = split.blocks;
        break;
      }
      blocks = split.blocks;
    }
    return { minimal: rebuild(dfa, blocks), blocks: blocks, rounds: rounds,
      before: dfa.states.length, after: blocks.length };
  }

  function initialBlocks(dfa) {
    const accepting = [];
    const rejecting = [];

    dfa.states.forEach(function (state) {
      (Automaton.isAccepting(dfa, state) ? accepting : rejecting).push(state);
    });
    return [accepting, rejecting].filter(function (block) { return block.length > 0; });
  }

  function blockIndex(blocks, state) {
    for (let i = 0; i < blocks.length; i += 1) {
      if (blocks[i].indexOf(state) !== -1) return i;
    }
    return -1;
  }

  /** One pass: give each state the signature of where every symbol takes it,
   *  and split any block whose members do not agree. */
  function refineOnce(dfa, blocks) {
    const out = [];
    let splitter = null;

    blocks.forEach(function (block) {
      const groups = {};

      block.forEach(function (state) {
        const key = dfa.alphabet.map(function (symbol) {
          return blockIndex(blocks, target(dfa, state, symbol));
        }).join(',');

        if (!groups[key]) groups[key] = [];
        groups[key].push(state);
      });
      const keys = Object.keys(groups).sort();

      if (keys.length > 1 && splitter === null) {
        splitter = distinguishing(dfa, blocks, groups[keys[0]][0], groups[keys[1]][0]);
      }
      keys.forEach(function (key) { out.push(groups[key]); });
    });
    return { blocks: out, splitter: splitter };
  }

  function distinguishing(dfa, blocks, left, right) {
    for (let i = 0; i < dfa.alphabet.length; i += 1) {
      const symbol = dfa.alphabet[i];

      if (blockIndex(blocks, target(dfa, left, symbol))
        !== blockIndex(blocks, target(dfa, right, symbol))) {
        return { symbol: symbol, left: left, right: right };
      }
    }
    return null;
  }

  function describe(blocks) {
    return blocks.map(function (block) { return block.slice().sort(); });
  }

  /** One state per block, named after the block's members. */
  function rebuild(dfa, blocks) {
    const names = blocks.map(function (block) { return '{' + block.slice().sort().join(',') + '}'; });
    const delta = {};
    const accepting = [];

    blocks.forEach(function (block, i) {
      delta[names[i]] = {};
      dfa.alphabet.forEach(function (symbol) {
        const to = blockIndex(blocks, target(dfa, block[0], symbol));

        if (to !== -1) delta[names[i]][symbol] = [names[to]];
      });
      if (Automaton.isAccepting(dfa, block[0])) accepting.push(names[i]);
    });
    return Automaton.create({
      states: names, alphabet: dfa.alphabet,
      start: names[blockIndex(blocks, dfa.start[0])],
      accepting: accepting, delta: delta,
      label: 'min(' + (dfa.label || 'dfa') + ')'
    });
  }

  /* ------------------------------------------------------------- Hopcroft */

  /**
   * The same partition, reached by refining against a worklist of splitters and
   * always enqueuing the SMALLER half — which is what turns the quadratic
   * refinement into O(n log n), because a state can be in the smaller half at
   * most log n times.
   */
  function hopcroft(machine) {
    const dfa = Automaton.complete(Automaton.trim(machine));
    const state = startPartition(dfa);
    let passes = 0;

    while (state.work.length && passes < 10000) {
      passes += 1;
      const splitter = state.work.shift();

      dfa.alphabet.forEach(function (symbol) {
        applySplitter(dfa, state, splitter, symbol);
      });
    }
    return { minimal: rebuild(dfa, state.blocks), blocks: state.blocks, passes: passes,
      before: dfa.states.length, after: state.blocks.length };
  }

  function startPartition(dfa) {
    const blocks = initialBlocks(dfa);
    const work = blocks.length > 1
      ? [blocks[0].length <= blocks[1].length ? blocks[0] : blocks[1]]
      : [];

    return { blocks: blocks, work: work };
  }

  function applySplitter(dfa, state, splitter, symbol) {
    const incoming = dfa.states.filter(function (from) {
      return splitter.indexOf(target(dfa, from, symbol)) !== -1;
    });
    const next = [];

    state.blocks.forEach(function (block) {
      const inside = block.filter(function (s) { return incoming.indexOf(s) !== -1; });
      const outside = block.filter(function (s) { return incoming.indexOf(s) === -1; });

      if (inside.length === 0 || outside.length === 0) {
        next.push(block);
        return;
      }
      next.push(inside);
      next.push(outside);
      enqueueSmaller(state, block, inside, outside);
    });
    state.blocks = next;
  }

  function enqueueSmaller(state, block, inside, outside) {
    const at = state.work.indexOf(block);
    const smaller = inside.length <= outside.length ? inside : outside;

    if (at !== -1) {
      state.work.splice(at, 1, inside, outside);
      return;
    }
    state.work.push(smaller);
  }

  /* ----------------------------------------------------------- Brzozowski */

  /**
   * Reverse, determinise, reverse, determinise. That is the whole algorithm,
   * and it lands on the minimal DFA every time.
   *
   * The result is completed so it matches Moore and Hopcroft: all three return
   * the minimal TOTAL DFA, which is the object Myhill–Nerode is a theorem
   * about. Left trimmed, this one returns a machine one state smaller and the
   * three disagree for no reason but convention.
   */
  function brzozowski(machine) {
    const first = Automaton.toDfa(Automaton.reverse(machine));
    const second = Automaton.toDfa(Automaton.reverse(Automaton.trim(first.dfa)));
    const minimal = Automaton.complete(Automaton.trim(second.dfa));

    return { minimal: minimal, before: machine.states.length, after: minimal.states.length,
      intermediate: first.dfa.states.length };
  }

  /* ------------------------------------------------- Myhill–Nerode oracle */

  /**
   * The equivalence classes computed from the LANGUAGE rather than from any
   * machine: two prefixes are equivalent when no suffix up to the bound tells
   * them apart. This is the reference every minimality claim is checked
   * against, and it also produces the witness suffix for each split.
   */
  function myhillNerode(machine, maxLength) {
    const bound = maxLength === undefined ? 6 : maxLength;
    const prefixes = Automaton.strings(machine.alphabet, bound);
    const suffixes = Automaton.strings(machine.alphabet, bound);
    const classes = [];

    prefixes.forEach(function (prefix) {
      const found = classes.filter(function (entry) {
        return witness(machine, entry.representative, prefix, suffixes) === null;
      })[0];

      if (found) { found.members.push(prefix); return; }
      classes.push({ representative: prefix, members: [prefix] });
    });
    return { classes: classes, count: classes.length, bound: bound,
      witnesses: witnessTable(machine, classes, suffixes) };
  }

  /** The shortest suffix that tells two prefixes apart, or null if none does. */
  function witness(machine, left, right, suffixes) {
    for (let i = 0; i < suffixes.length; i += 1) {
      if (Automaton.accepts(machine, left + suffixes[i])
        !== Automaton.accepts(machine, right + suffixes[i])) return suffixes[i];
    }
    return null;
  }

  function witnessTable(machine, classes, suffixes) {
    const rows = [];

    for (let i = 0; i < classes.length; i += 1) {
      for (let j = i + 1; j < classes.length; j += 1) {
        rows.push({ left: classes[i].representative, right: classes[j].representative,
          suffix: witness(machine, classes[i].representative, classes[j].representative,
            suffixes) });
      }
    }
    return rows;
  }

  /**
   * Is this machine minimal? Compared against the oracle, not against itself.
   *
   * The comparison is made on the TOTAL machine in both directions, because
   * Myhill–Nerode partitions all of Σ* — including the prefixes from which
   * nothing is accepted, which form the dead class. Comparing a trimmed
   * machine against a total count is the off-by-one that makes three correct
   * algorithms look like they disagree.
   */
  function isMinimal(machine, maxLength) {
    const total = Automaton.complete(Automaton.trim(machine));
    const oracle = myhillNerode(total, maxLength);

    return { minimal: total.states.length === oracle.count,
      states: total.states.length, classes: oracle.count };
  }

  return {
    moore: moore, hopcroft: hopcroft, brzozowski: brzozowski,
    myhillNerode: myhillNerode, isMinimal: isMinimal, witness: witness,
    rebuild: rebuild, initialBlocks: initialBlocks, blockIndex: blockIndex
  };
}));
