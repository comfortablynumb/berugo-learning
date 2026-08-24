/**
 * Section: equivalent models of computation.
 *
 * The measurement is one function run in three models, with the answers
 * compared and the step counts printed side by side. Doubling costs the RAM
 * 2 steps regardless of the input, the counter machine 3n + 1, and the Turing
 * machine a quadratic 2n² + 4n + 2 — all three computing exactly the same
 * function on every input tested.
 *
 * That is the section in one table: equal power, and three different cost
 * curves. Church–Turing is about the first column and complexity theory is
 * about the third, and conflating them is why "Turing complete" gets used as
 * though it meant "fast enough".
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'equivalent-models-of-computation';
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — who simulates whom',
      caption: 'Every arrow is a construction somebody wrote down, and the label is what the ' +
        'simulation costs. Read it as a graph: because it is strongly connected, all these ' +
        'models compute exactly the same class of functions, and that is what the ' +
        'Church–Turing thesis is supported by. Now read the labels instead. A RAM simulates a ' +
        'Turing machine with a constant factor; a two-counter machine needs Gödel numbering and ' +
        'pays an exponential. Same class, wildly different costs — which is why "Turing ' +
        'complete" is a statement about what a system CAN do and never about what it can do in ' +
        'reasonable time.',
      definition: [
        'graph LR',
        '    TM[Turing machine] -->|constant factor| RAM',
        '    RAM -->|"polynomial (logarithmic cost model)"| TM',
        '    TM -->|"Gödel numbering, EXPONENTIAL"| CM[2-counter machine]',
        '    CM -->|direct| TM',
        '    TM -->|"Cook 2004, polynomial"| CA[Rule 110]',
        '    CA -->|direct| TM',
        '    LC[lambda calculus] -->|"Turing 1937"| TM',
        '    TM --> LC',
        '    LC -->|"bracket abstraction"| SKI[SKI combinators]',
        '    SKI --> LC'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Equivalence between models is proved by SIMULATION, and simulation is a program.** To ' +
        'show model A is at least as powerful as B, write an interpreter for B in A. That is ' +
        'the entire technique, and it is why the proofs read like engineering rather than like ' +
        'mathematics — because they are.',
      '**A counter machine has registers holding natural numbers and three instructions.** ' +
        'Increment, decrement-or-jump-if-zero, and halt. There is no way to read a register ' +
        'without destroying it, so copying a value takes a loop and a scratch register, and ' +
        'that limitation is where the inefficiency comes from.',
      '**Two counters are enough, and the encoding is the reason it is slow.** Minsky showed a ' +
        'two-register machine is Turing complete by storing k registers as one number 2^a·3^b·5^c ' +
        '— so reading register b means dividing by 3 repeatedly, which is a loop whose length is ' +
        'the value stored. The model is universal and exponentially slower, and both halves are ' +
        'the point.',
      '**The RAM is the model every algorithms course silently assumes.** Indexed registers and ' +
        'arithmetic in one step, which is why "O(n) time" means what you expect. Under the ' +
        'logarithmic cost model — charging for the bits in each operand — it is polynomially ' +
        'related to a Turing machine, and under the unit-cost model it is not, which is a real ' +
        'and usually ignored subtlety.',
      '**Rule 110 is a three-cell lookup table that is Turing complete.** Each cell is updated ' +
        'from itself and its two neighbours by an eight-entry rule, and Cook proved in 2004 ' +
        'that this one rule can simulate any Turing machine. Nothing about it looks like ' +
        'computation, which is the most useful thing about it: universality is common and ' +
        'cheap, not rare and engineered.',
      '**Tag systems are the minimal model: no tape, no registers, one queue.** Delete the ' +
        'first m symbols and append a production for whichever symbol was first. Post proved ' +
        'these universal in 1943, and they are what Cook\'s Rule 110 proof reduces to.',
      '**SKI combinators show that variable binding is not primitive.** Three rewrite rules — ' +
        '`I x → x`, `K x y → x`, `S x y z → x z (y z)` — with no variables anywhere, and every ' +
        'lambda term translates into them by bracket abstraction. The demo reduces `S(K(SI))K x ' +
        'y` to `y x`, which is function argument reversal built from nothing.',
      '**Equal power is not equal efficiency, and that gap IS complexity theory.** The demo\'s ' +
        'table is the argument: doubling costs a RAM two steps whatever the input, a counter ' +
        'machine a number of steps proportional to the input, and a Turing machine a number ' +
        'proportional to its square. Computability asks which column is finite; complexity asks ' +
        'how fast it grows.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — the same function in three models, with the costs',
        markup: root.ModelsTemplate.render()
      },
      diagram: diagram(),
      insight: '**Equal power is not equal efficiency: a two-counter machine is Turing complete ' +
        'and exponentially slower, which is exactly the distinction that makes complexity ' +
        'theory a separate subject from computability.** The practical version of that appears ' +
        'whenever someone observes that a configuration format, a template language or a type ' +
        'system is Turing complete. It is almost always true and almost never the relevant ' +
        'fact. What matters is the cost model: a build system that is Turing complete but pays ' +
        'a process spawn per step is a different engineering object from one that is Turing ' +
        'complete and compiles. "Can it?" and "at what cost?" are separate questions, and the ' +
        'first has been settled since 1936 while the second is where all the remaining ' +
        'difficulty lives.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.ModelsTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  /** One function in three models, with the answer each produced. Comparing
   *  the answers is what the equivalence claim reduces to. */
  const runFor = root.Helpers.memoise(function (key) {
    const parts = key.split('\n');
    const n = Number(parts[1]);
    const program = parts[0] === 'doubling'
      ? root.ModelZoo.doubling() : root.ModelZoo.addition();
    const registers = parts[0] === 'doubling' ? [n, 0] : [n, 4];
    const counter = root.ModelZoo.runCounter(program.counter, registers.slice());
    const ram = root.ModelZoo.runRam(program.ram, registers.slice());
    const turing = parts[0] === 'doubling'
      ? root.TuringMachine.run(root.TuringMachine.doubler(), '1'.repeat(n),
        { budget: 20000, traceLimit: 0 })
      : null;
    const expected = parts[0] === 'doubling' ? 2 * n : registers[0] + registers[1];

    return {
      expected: expected,
      counter: { answer: parts[0] === 'doubling' ? counter.output[1] : counter.output[0],
        steps: counter.steps },
      ram: { answer: parts[0] === 'doubling' ? ram.output[1] : ram.output[0],
        steps: ram.steps },
      turing: turing
        ? { answer: (turing.tape.match(/1/g) || []).length, steps: turing.steps }
        : { answer: null, steps: null },
      inputs: registers
    };
  });

  const growthFor = root.Helpers.memoise(function (name) {
    return [1, 2, 4, 6, 8, 10].map(function (n) {
      const state = runFor(name + '\n' + n);

      return { n: n, ram: state.ram.steps, counter: state.counter.steps,
        turing: state.turing.steps };
    });
  });

  const cellsFor = root.Helpers.memoise(function (rule) {
    const width = 41;
    let seed = '';

    for (let i = 0; i < width; i += 1) seed += i === Math.floor(width / 2) ? '1' : '0';
    return root.ModelZoo.runCellular(Number(rule), seed, 18);
  });

  const skiFor = root.Helpers.memoise(function (text) {
    return root.ModelZoo.runSki(root.ModelZoo.ski(text), 4000);
  });

  function update() {
    const values = panel.values();
    const state = runFor(values['mod-function'] + '\n' + values['mod-input']);

    paintMetrics(state, values['mod-function']);
    paintCompare(state, values['mod-function']);
    paintGrowth(values['mod-function']);
    paintCells(values['mod-rule']);
    paintSki(values['mod-ski']);
    paintModels();
  }

  function agrees(state, name) {
    const answers = [state.counter.answer, state.ram.answer];

    if (name === 'doubling') answers.push(state.turing.answer);
    return answers.every(function (answer) { return answer === state.expected; });
  }

  function paintMetrics(state, name) {
    root.MetricGrid.update({
      'mod-agree': { value: agrees(state, name) ? 'yes' : 'NO',
        note: agrees(state, name)
          ? 'every model returned ' + root.Format.exact(state.expected) +
            ', which is what the equivalence claim means operationally'
          : 'a model disagreed, which is a bug rather than a theorem' },
      'mod-ram': { value: root.Format.exact(state.ram.steps),
        note: 'one instruction does arithmetic on whole registers' },
      'mod-counter': { value: root.Format.exact(state.counter.steps),
        note: 'increment and decrement by one, so the cost tracks the VALUE' },
      'mod-turing': { value: state.turing.steps === null ? 'not run'
        : root.Format.exact(state.turing.steps),
      note: state.turing.steps === null
        ? 'the Turing program in this demo doubles rather than adds'
        : 'one cell at a time, so the cost tracks the value squared' }
    });
  }

  function paintCompare(state, name) {
    const rows = [
      { model: 'RAM', answer: state.ram.answer, steps: state.ram.steps,
        step: 'add two registers, or copy one to another' },
      { model: 'Counter machine', answer: state.counter.answer, steps: state.counter.steps,
        step: 'add one to a register, or subtract one and branch on zero' },
      { model: 'Turing machine', answer: state.turing.answer, steps: state.turing.steps,
        step: 'read one cell, write one cell, move one cell' }
    ].filter(function (row) { return row.steps !== null; });

    root.jQuery('#mod-compare tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + row.model + '</td><td class="mono">' +
        root.Format.exact(row.answer) +
        (row.answer === state.expected ? '' : ' (expected ' + state.expected + ')') +
        '</td><td class="mono">' + root.Format.exact(row.steps) + '</td><td>' + row.step +
        '</td></tr>';
    }).join(''));

    root.Helpers.setText('mod-compare-note',
      'The answer column is the equivalence claim and the steps column is everything the ' +
      'equivalence claim does NOT say. All three compute ' + root.Format.exact(state.expected) +
      '; one does it in a fixed two instructions, one in a number of steps proportional to the ' +
      'input, and one in a number proportional to its square. The last column says why: the ' +
      'models differ only in what counts as one step.');
  }

  function paintGrowth(name) {
    root.jQuery('#mod-growth tbody').html(growthFor(name).map(function (row) {
      return '<tr><td class="mono">' + row.n + '</td><td class="mono">' + row.ram +
        '</td><td class="mono">' + row.counter + '</td><td class="mono">' +
        (row.turing === null ? '—' : row.turing) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('mod-growth-note',
      'Three curves from one function. The RAM column is constant, because doubling is one ' +
      'addition however big the number. The counter-machine column is linear in the VALUE, ' +
      'which is exponential in the number of bits — the standard trap in this model, and the ' +
      'reason "unary" appears in so many complexity caveats. The Turing column is quadratic ' +
      'because the head walks the whole tape once per symbol. Nothing here contradicts the ' +
      'equivalence; every column is finite, which is all the equivalence claims.');
  }

  function paintCells(rule) {
    const state = cellsFor(rule);

    root.jQuery('#mod-cells').html(state.trace.map(function (row) {
      return root.Helpers.escapeHtml(row.split('0').join('·').split('1').join('█'));
    }).join('<br>'));

    root.Helpers.setText('mod-cells-note',
      'One row per generation, from a single live cell. Rule ' + rule + ' is an eight-entry ' +
      'lookup table over a cell and its two neighbours — that is the complete specification, ' +
      'and there is no state, no memory and no program. Rule 110 was proved Turing complete by ' +
      'Matthew Cook in 2004, which means this table can simulate any computation whatsoever. ' +
      'Rule 90 draws the Sierpinski triangle and is exactly XOR of the two neighbours; Rule 30 ' +
      'was used as Mathematica’s random-number generator for years.');
  }

  function paintSki(text) {
    const state = skiFor(text);

    root.jQuery('#mod-ski-trace tbody').html(state.trace.slice(0, 10).map(function (row) {
      return '<tr><td class="mono">' + row.step + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row.term) + '</td></tr>';
    }).join('') + '<tr><td class="mono">' + state.steps + '</td><td class="mono">' +
      root.Helpers.escapeHtml(state.output) + ' (normal form)</td></tr>');

    root.Helpers.setText('mod-ski-note',
      'Three rewrite rules and no variables at all: `I x → x`, `K x y → x`, and ' +
      '`S x y z → x z (y z)`. The default term reduces to `yx` — it is the combinator that ' +
      'reverses two arguments, built entirely from S and K. Every lambda term translates into ' +
      'this by bracket abstraction, which is why variable binding turns out not to be ' +
      'primitive: it is a notation, and the machine underneath does not need it.');
  }

  function paintModels() {
    const rows = [
      { model: 'Turing machine', step: 'read, write, move one cell',
        simulates: '— it is the reference', good: 'proofs; the definition of everything else' },
      { model: 'RAM', step: 'arithmetic and indexed access on whole registers',
        simulates: 'a constant factor, under the unit-cost model',
        good: 'algorithm analysis, which is why O(n) means what you expect' },
      { model: 'Counter machine (2 registers)', step: 'increment, or decrement and branch',
        simulates: 'an EXPONENTIAL slowdown, via Gödel numbering',
        good: 'minimality proofs; nothing practical' },
      { model: 'Cellular automaton (Rule 110)', step: 'update every cell from three neighbours',
        simulates: 'polynomial, by Cook (2004)',
        good: 'showing that universality is common rather than engineered' },
      { model: 'Tag system', step: 'delete m symbols, append a production',
        simulates: 'polynomial; it is what the Rule 110 proof goes through',
        good: 'the smallest universal model anyone writes down' },
      { model: 'SKI combinators', step: 'one of three rewrites',
        simulates: 'via lambda calculus, polynomial',
        good: 'compilers for functional languages; showing binding is not primitive' },
      { model: 'Lambda calculus', step: 'one beta reduction',
        simulates: 'polynomial (Turing, 1937)',
        good: 'M27, and every functional language ever designed' }
    ];

    root.jQuery('#mod-models tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + row.model + '</td><td>' + row.step + '</td><td>' +
        row.simulates + '</td><td>' + row.good + '</td></tr>';
    }).join(''));

    root.Helpers.setText('mod-models-note',
      'The third column is the one to read twice. Every entry is finite, which is the ' +
      'Church–Turing thesis in table form; and one of them says EXPONENTIAL, which is the ' +
      'reason complexity theory exists. A model can be universal and useless — the two-counter ' +
      'machine is the standard example — and the fact that this is possible is why "is it ' +
      'Turing complete?" is almost never the question you actually want answered about a ' +
      'system.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
