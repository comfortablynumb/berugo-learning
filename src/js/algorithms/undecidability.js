/**
 * Diagonalisation, mapping reductions, and Rice's theorem — as runnable
 * constructions rather than as proofs on a page.
 *
 * The halting problem cannot be demonstrated by running anything, because the
 * whole content of the theorem is that a certain program does not exist. What
 * CAN be demonstrated, and is here, is the construction: given any candidate
 * total decider a learner supplies, build the machine that contradicts it, run
 * both, and print the contradiction. The candidate can be as clever as you
 * like; the construction is mechanical and it wins every time.
 *
 * That is the honest shape of a computability demo. It does not prove the
 * theorem — the proof is the observation that the construction always works —
 * but it makes the argument concrete in a way the table-of-machines picture
 * alone does not, and it lets the learner attack it.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.Undecidability = api;
}(this, function () {
  'use strict';

  /* ------------------------------------------------------- diagonalisation */

  /**
   * The table the diagonal argument is about: machines down the side, inputs
   * across the top, and each cell holding what machine i does on input j.
   *
   * `behaviour(i, j)` returns 'halts' or 'loops'. The diagonal is the cells
   * where a machine meets its own encoding, and the contradictory machine is
   * the one that does the opposite of every diagonal entry.
   */
  function diagonalTable(behaviour, size) {
    const rows = [];

    for (let i = 0; i < size; i += 1) {
      const cells = [];

      for (let j = 0; j < size; j += 1) cells.push(behaviour(i, j));
      rows.push({ machine: i, cells: cells, diagonal: cells[i] });
    }
    return rows;
  }

  /**
   * The machine that cannot be in the table: it does the opposite of the
   * diagonal. Its row differs from row i in column i, for every i, so it is
   * not row i for any i — and every machine IS a row, so it is not a machine.
   *
   * The construction returns the row it would occupy, and the index at which
   * it differs from each existing row, which is the part that makes the
   * argument concrete rather than magical.
   */
  function diagonalMachine(behaviour, size) {
    const row = [];
    const differences = [];

    for (let i = 0; i < size; i += 1) {
      const opposite = behaviour(i, i) === 'halts' ? 'loops' : 'halts';

      row.push(opposite);
      differences.push({ machine: i, column: i, itDoes: behaviour(i, i), weDo: opposite });
    }
    return { row: row, differences: differences,
      why: 'It differs from every row of the table at the diagonal cell, so it is no row of ' +
        'the table — and every machine is a row.' };
  }

  /* ------------------------------------------- attacking a proposed decider */

  /**
   * Given a candidate `halts(source, input)` that claims to decide halting for
   * JavaScript-like source strings, build the program that defeats it.
   *
   * The classic construction: `contrary(x)` asks the oracle what `x` does on
   * `x`, then does the opposite. Running `contrary(contrary)` forces the
   * contradiction into the open — whatever the oracle says, the program does
   * the other thing.
   *
   * The candidate is a real function here, so it is genuinely consulted. What
   * cannot be done is running `contrary` to completion when the oracle says it
   * loops — so the construction reports what each side CLAIMS, and the
   * disagreement is the proof.
   */
  function defeat(candidate) {
    const source = CONTRARY_SOURCE;
    const verdict = candidate(source, source);
    const actual = verdict === 'halts' ? 'loops' : 'halts';

    return {
      source: source,
      askedAbout: 'contrary applied to its own source',
      oracleSaid: verdict,
      actuallyDoes: actual,
      contradiction: verdict !== actual,
      why: verdict === 'halts'
        ? 'The oracle said it halts, so by construction it enters the infinite loop — it does ' +
          'not halt.'
        : 'The oracle said it loops, so by construction it returns immediately — it halts.'
    };
  }

  const CONTRARY_SOURCE = [
    'function contrary(source) {',
    '  if (halts(source, source) === "halts") {',
    '    while (true) { /* deliberately never finish */ }',
    '  }',
    '  return "done";',
    '}'
  ].join('\n');

  /**
   * A candidate decider that is right about everything it recognises and
   * guesses otherwise — the shape every real static analyser has. Running
   * `defeat` on it produces the contradiction, and running it on the fixtures
   * shows it is genuinely useful on most of them.
   */
  function heuristicDecider() {
    return function (source) {
      if (String(source).indexOf('while (true)') !== -1) return 'loops';
      if (String(source).indexOf('for (;;)') !== -1) return 'loops';
      return 'halts';
    };
  }

  /** A decider that always says "halts", which is right about most programs
   *  and is what an unsound analyser amounts to. */
  function optimisticDecider() {
    return function () { return 'halts'; };
  }

  /** And one that always says "loops", which is sound for the halting question
   *  in the other direction and useless. */
  function pessimisticDecider() {
    return function () { return 'loops'; };
  }

  /* ------------------------------------------------------------ reductions */

  /**
   * A mapping reduction from halting to another problem, as a program
   * TRANSFORMATION. That is the part that gets lost in the notation: a
   * reduction is a compiler, and the proof is that the compiled program has
   * the target property exactly when the original halts.
   *
   * Each entry names the target problem, gives the transformation, and states
   * the equivalence a reader can check by looking at the transformed source.
   */
  const REDUCTIONS = [
    {
      target: 'does this program ever print?',
      transform: function (source) {
        return 'function transformed(x) {\n  ' + indent(source) +
          '\n  run(x);\n  print("reached");\n}';
      },
      equivalence: 'The transformed program prints exactly when the original halts, because the ' +
        'print is the first statement after it.',
      consequence: 'A decider for "ever prints" would decide halting, so there is none.'
    },
    {
      target: 'is this variable ever assigned?',
      transform: function (source) {
        return 'function transformed(x) {\n  let touched = false;\n  ' + indent(source) +
          '\n  run(x);\n  touched = true;\n}';
      },
      equivalence: 'The assignment is reached exactly when the original halts.',
      consequence: 'Dead-store elimination cannot be exact, which is why every optimiser is ' +
        'conservative here.'
    },
    {
      target: 'is this line dead code?',
      transform: function (source) {
        return 'function transformed(x) {\n  ' + indent(source) +
          '\n  run(x);\n  doSomething(); // reachable iff the program above halts\n}';
      },
      equivalence: 'The line is reachable exactly when the original halts.',
      consequence: 'Exact dead-code detection decides halting, so every linter over-reports or ' +
        'under-reports and has to choose which.'
    },
    {
      target: 'do these two programs compute the same function?',
      transform: function (source) {
        return 'function left(x) {\n  ' + indent(source) +
          '\n  run(x);\n  return 1;\n}\nfunction right(x) { return 1; }';
      },
      equivalence: 'The two agree on every input exactly when the original halts on every input.',
      consequence: 'Program equivalence is undecidable, which is why a compiler cannot verify ' +
        'its own optimisations in general.'
    },
    {
      target: 'does this program terminate on every input?',
      transform: function (source) {
        return 'function transformed(x) {\n  ' + indent(source) + '\n  run(fixedInput);\n}';
      },
      equivalence: 'The transformed program ignores its input, so it terminates on all inputs ' +
        'exactly when the original terminates on the one.',
      consequence: 'Totality is undecidable too — and it is not even recognisable, unlike ' +
        'halting.'
    }
  ];

  function indent(source) {
    return String(source).split('\n').join('\n  ');
  }

  function reduce(index, source) {
    const entry = REDUCTIONS[index];

    return { target: entry.target, source: source, transformed: entry.transform(source),
      equivalence: entry.equivalence, consequence: entry.consequence };
  }

  /* ------------------------------------------------------ Rice's theorem */

  /**
   * Rice's theorem: every non-trivial SEMANTIC property of programs is
   * undecidable. Non-trivial means some program has it and some does not;
   * semantic means the property depends on what the program COMPUTES rather
   * than on how it is written.
   *
   * The classification below is the practical content: it separates the
   * properties Rice forbids from the syntactic ones that are perfectly
   * decidable, and the separation is not obvious from the wording alone.
   */
  const PROPERTIES = [
    { name: 'Does it ever halt?', semantic: true, trivial: false,
      note: 'The original undecidable question.' },
    { name: 'Does it compute the constant zero function?', semantic: true, trivial: false,
      note: 'Undecidable by Rice, and a common "surely this is easy" example.' },
    { name: 'Is its language empty?', semantic: true, trivial: false,
      note: 'Undecidable; also not recognisable.' },
    { name: 'Does it ever divide by zero?', semantic: true, trivial: false,
      note: 'Undecidable, which is why the checker warns instead of proving.' },
    { name: 'Does it contain a division operator?', semantic: false, trivial: false,
      note: 'SYNTACTIC and decidable — grep does it. This is the escape hatch.' },
    { name: 'Is it more than 100 lines long?', semantic: false, trivial: false,
      note: 'Syntactic, decidable, and the reason line-count metrics exist at all.' },
    { name: 'Does it halt within 10 000 steps?', semantic: false, trivial: false,
      note: 'Decidable — run it for 10 000 steps. The bound is what makes it so.' },
    { name: 'Is it a valid program at all?', semantic: false, trivial: false,
      note: 'Syntactic: this is what a parser does, and M25 is entirely about it.' },
    { name: 'Does it compute SOME function?', semantic: true, trivial: true,
      note: 'Trivially true of every program, so Rice does not apply and it is decidable.' },
    { name: 'Does it accept a string no program accepts?', semantic: true, trivial: true,
      note: 'Trivially false, so decidable — and only because it is trivial.' }
  ];

  /**
   * Rice's verdict for a property, with the reason. The three-way answer
   * matters: "undecidable", "decidable because syntactic", and "decidable
   * because trivial" are different facts and only the first is Rice's.
   */
  function riceVerdict(property) {
    if (!property.semantic) {
      return { decidable: true, reason: 'syntactic — it depends on how the program is written, ' +
        'not on what it computes, and Rice says nothing about those' };
    }
    if (property.trivial) {
      return { decidable: true, reason: 'trivial — every program has it, or none does, so the ' +
        'decider is a constant' };
    }
    return { decidable: false, reason: 'non-trivial and semantic, so Rice’s theorem applies: ' +
      'no decider exists' };
  }

  function classify() {
    return PROPERTIES.map(function (property) {
      const verdict = riceVerdict(property);

      return { name: property.name, semantic: property.semantic, trivial: property.trivial,
        decidable: verdict.decidable, reason: verdict.reason, note: property.note };
    });
  }

  /* ------------------------------------------------- the decidability tower */

  /** Where each problem sits: decidable, recognisable, co-recognisable, or
   *  neither — the distinction that says which side a semi-algorithm can work
   *  from. */
  const TOWER = [
    { problem: 'Does this string parse?', decidable: true, recognisable: true,
      coRecognisable: true, note: 'M25 in one line.' },
    { problem: 'Does this machine halt within k steps?', decidable: true, recognisable: true,
      coRecognisable: true, note: 'The bound is the whole difference.' },
    { problem: 'Does this machine halt?', decidable: false, recognisable: true,
      coRecognisable: false, note: 'Run it: if it halts you find out. If not, you wait forever.' },
    { problem: 'Does this machine loop forever?', decidable: false, recognisable: false,
      coRecognisable: true, note: 'The complement of halting, and recognisable from the other side.' },
    { problem: 'Is this machine’s language empty?', decidable: false, recognisable: false,
      coRecognisable: true, note: 'You can confirm non-emptiness by finding a string; not emptiness.' },
    { problem: 'Do these two machines accept the same language?', decidable: false,
      recognisable: false, coRecognisable: false,
      note: 'Neither side is confirmable, which is why grammar equivalence is hopeless.' },
    { problem: 'Does this machine halt on EVERY input?', decidable: false, recognisable: false,
      coRecognisable: false, note: 'Totality: strictly harder than halting.' }
  ];

  return {
    CONTRARY_SOURCE: CONTRARY_SOURCE, REDUCTIONS: REDUCTIONS, PROPERTIES: PROPERTIES,
    TOWER: TOWER,
    diagonalTable: diagonalTable, diagonalMachine: diagonalMachine, defeat: defeat,
    heuristicDecider: heuristicDecider, optimisticDecider: optimisticDecider,
    pessimisticDecider: pessimisticDecider, reduce: reduce, riceVerdict: riceVerdict,
    classify: classify
  };
}));
