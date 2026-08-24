/**
 * Section: deterministic finite automata.
 *
 * The batch tester is the measurement. Every machine here is checked against
 * an independent definition — a modulo computation, a suffix test, a parity
 * count — over every string up to a length bound, and the agreement count is a
 * metric. A hand-drawn DFA that is subtly wrong accepts a plausible-looking
 * set of strings, so agreeing with the machine's own trace proves nothing;
 * agreeing with arithmetic does.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'deterministic-finite-automata';
  const BOUND = 8;
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — binary numerals divisible by three',
      caption: 'Three states, one per remainder. Reading a binary numeral left to right doubles ' +
        'the value and adds the new bit, so the remainder transforms as r → (2r + b) mod 3 — and ' +
        'that is the entire transition function. The machine is small not because the problem is ' +
        'small but because the remainder is ALL the information a longer prefix contributes: two ' +
        'numerals with the same remainder are interchangeable for every possible continuation. ' +
        'Finding that quantity is the design work, and once it is found the machine writes ' +
        'itself.',
      definition: [
        'stateDiagram-v2',
        '    [*] --> r0',
        '    r0 --> r0 : 0',
        '    r0 --> r1 : 1',
        '    r1 --> r2 : 0',
        '    r1 --> r0 : 1',
        '    r2 --> r1 : 0',
        '    r2 --> r2 : 1',
        '    r0 --> [*]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**A DFA is five things: states, an alphabet, a transition function, a start state and an ' +
        'accepting set.** The transition function is total in the textbook definition and ' +
        'partial in most implementations; the difference is one trap state, and it matters ' +
        'because complement flips the accepting set and a missing trap becomes accepting.',
      '**Designing a DFA is the exercise of naming exactly what must be remembered.** Not what ' +
        'happened — what still MATTERS about what happened. For divisibility that is a ' +
        'remainder, for a suffix test it is the last few characters, for parity it is one bit. ' +
        'Once that quantity is named the transitions follow mechanically.',
      '**Two prefixes that behave identically from here on are the same state.** That is ' +
        'Myhill–Nerode stated informally, and it is the test for whether your state set is ' +
        'right: if two states can never be told apart by any continuation, they are one state ' +
        'and the machine is not minimal.',
      '**Divisibility by k needs k states and nothing else.** The demo runs divisibility by 3 ' +
        'and by 7 side by side: three states and seven, both checked against real arithmetic ' +
        'over every binary string up to length 8. The numbers get large and the machine does not.',
      '**A trap state is where rejection becomes permanent.** Once a machine has decided no ' +
        'continuation can help, it has one state to sit in. Leaving it implicit makes the ' +
        'implementation smaller and the complement operation wrong, which is the trade the ' +
        'closure section pays for.',
      '**The batch tester is the check that matters.** A hand-drawn machine that is subtly wrong ' +
        'accepts a plausible set of strings and its own trace agrees with itself. The demo runs ' +
        'the machine against an independent definition — arithmetic, a suffix test, a count — ' +
        'over every string up to length 8, and reports the agreement.',
      '**This is the same discipline as designing component state.** "What must this remember" ' +
        'is the question behind a React reducer, a protocol endpoint and a workflow engine, and ' +
        'the answer being small is what makes any of them testable. A state machine with a ' +
        'state per possible history is a bug you have not found yet.',
      '**The minimal machine is unique, so "am I done" is decidable.** The demo checks each ' +
        'machine against a brute-force Myhill–Nerode computation and says whether it is already ' +
        'minimal. That is a question about your design that a computer can answer, which is ' +
        'rarer than it sounds.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — run a machine, and check it against arithmetic',
        markup: root.DfaTemplate.render()
      },
      diagram: diagram(),
      insight: '**Designing a DFA is the exercise of naming exactly what must be remembered, ' +
        'which is the same discipline as designing the state of a component or a protocol ' +
        'endpoint.** The divisibility machines make it concrete: a numeral of any length ' +
        'collapses to a remainder, because two prefixes with the same remainder are ' +
        'interchangeable for every possible continuation. That collapse is what a state IS. When ' +
        'a component\'s state grows a field per thing that has happened rather than per thing ' +
        'that still matters, it is the same mistake, and the symptom is the same: a set of ' +
        'states nobody can enumerate and therefore nobody can test.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.DfaTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const MACHINES = {
    div3: { alphabet: ['0', '1'], modulus: 3,
      accepts: function (w) { return binary(w) % 3 === 0; },
      means: 'the remainder of the numeral so far, modulo 3' },
    div7: { alphabet: ['0', '1'], modulus: 7,
      accepts: function (w) { return binary(w) % 7 === 0; },
      means: 'the remainder of the numeral so far, modulo 7' },
    'ends-abb': { alphabet: ['a', 'b'], pattern: '(a|b)*abb',
      accepts: function (w) { return w.slice(-3) === 'abb'; },
      means: 'how much of "abb" the tail of the input already matches' },
    'even-a': { alphabet: ['a', 'b'], pattern: '(b|ab*a)*',
      accepts: function (w) { return count(w, 'a') % 2 === 0; },
      means: 'one bit — the parity of the count of a so far' },
    'no-three': { alphabet: ['a', 'b'], pattern: '(b|ab|aab)*(ε|a|aa)',
      accepts: function (w) { return w.indexOf('aaa') === -1; },
      means: 'how many a have arrived in a row: 0, 1 or 2' }
  };

  function count(word, symbol) {
    return word.split('').filter(function (ch) { return ch === symbol; }).length;
  }

  /* The empty numeral reads as zero, which is what makes the three-state
     machine exactly right rather than right-except-for-one-string. Excluding
     it needs a fourth state that is a copy of r0 and not accepting, and that
     is the whole difference between "k states" and "k + 1". */
  function binary(word) {
    let value = 0;

    word.split('').forEach(function (bit) { value = value * 2 + Number(bit); });
    return value;
  }

  /** Divisibility machines are built from the arithmetic rather than written
   *  out, because r → (2r + b) mod k IS the transition function. */
  function modulusMachine(k) {
    const delta = {};
    const states = [];

    for (let r = 0; r < k; r += 1) {
      states.push('r' + r);
      delta['r' + r] = { 0: ['r' + ((2 * r) % k)], 1: ['r' + ((2 * r + 1) % k)] };
    }
    return root.Automaton.create({ states: states, alphabet: ['0', '1'], start: 'r0',
      accepting: ['r0'], delta: delta, label: 'divisible by ' + k });
  }

  const machineFor = root.Helpers.memoise(function (name) {
    const spec = MACHINES[name];
    const machine = spec.modulus
      ? modulusMachine(spec.modulus)
      : root.Automaton.relabel(
        root.Minimization.hopcroft(
          root.Automaton.toDfa(root.RegexCompile.thompson(spec.pattern, spec.alphabet)).dfa
        ).minimal).machine;

    return { spec: spec, machine: machine, batch: batchTest(machine, spec) };
  });

  /** Every string up to the bound, machine against definition. */
  function batchTest(machine, spec) {
    const rows = [];
    let agree = 0;
    let tested = 0;

    for (let length = 0; length <= BOUND; length += 1) {
      const words = root.Automaton.strings(spec.alphabet, length)
        .filter(function (w) { return w.length === length; });
      const row = { length: length, words: words.length, accepted: 0, expected: 0, agree: 0 };

      words.forEach(function (word) {
        const byMachine = root.Automaton.accepts(machine, word);
        const byDefinition = spec.accepts(word);

        if (byMachine) row.accepted += 1;
        if (byDefinition) row.expected += 1;
        if (byMachine === byDefinition) { row.agree += 1; agree += 1; }
        tested += 1;
      });
      rows.push(row);
    }
    return { rows: rows, agree: agree, tested: tested };
  }

  function inputFor(state, kind) {
    const words = root.Automaton.strings(state.spec.alphabet, 7);
    const accepted = words.filter(function (w) {
      return w.length > 0 && root.Automaton.accepts(state.machine, w);
    });
    const rejected = words.filter(function (w) {
      return w.length > 0 && !root.Automaton.accepts(state.machine, w);
    });

    if (kind === 'reject') return rejected[0] || 'a';
    if (kind === 'long') return accepted[accepted.length - 1] || accepted[0] || 'a';
    return accepted[0] || 'a';
  }

  function update() {
    const values = panel.values();
    const state = machineFor(values['dfa-machine']);
    const input = inputFor(state, values['dfa-input']);
    const run = root.Automaton.run(state.machine, input);

    paintGraph(state, run);
    paintMetrics(state, run, input);
    paintRun(state, run, input);
    paintTable(state);
    paintBatch(state);
    paintPatterns();
  }

  function paintGraph(state, run) {
    const host = document.getElementById('dfa-graph');
    const active = run.trace[run.trace.length - 1].states;

    root.AutomatonView.render(host, { machine: state.machine, active: active,
      layout: state.machine.states.length > 5 ? 'layers' : 'circle', width: 560, height: 300,
      ariaLabel: 'the machine with its current state highlighted' });

    root.Helpers.setText('dfa-graph-note',
      'A double ring marks an accepting state and the stub on the left marks the start. The lit ' +
      'state is where the machine sits after the whole input, which for this run is ' +
      active.join(', ') + '. Every transition is drawn, so the count of arrows out of each state ' +
      'is the alphabet size — a state missing an outgoing symbol means the transition function ' +
      'is partial and rejection there is permanent.');
  }

  function paintMetrics(state, run, input) {
    const minimal = root.Minimization.isMinimal(state.machine, 5);

    root.MetricGrid.update({
      'dfa-states': { value: root.Format.exact(state.machine.states.length),
        note: state.spec.means },
      'dfa-verdict': { value: run.accepted ? 'accepted' : 'rejected',
        note: '"' + (input === '' ? 'ε' : input) + '" ended in ' +
          run.trace[run.trace.length - 1].states.join(', ') },
      'dfa-batch': { value: root.Format.exact(state.batch.agree) + ' of ' +
        root.Format.exact(state.batch.tested),
      note: state.batch.agree === state.batch.tested
        ? 'the machine and the definition agree on every string up to length ' +
          root.Format.exact(BOUND)
        : 'THE MACHINE IS WRONG on ' +
          root.Format.exact(state.batch.tested - state.batch.agree) + ' strings' },
      'dfa-minimal': { value: minimal.minimal ? 'yes' : 'no',
        note: root.Format.exact(minimal.states) + ' states against ' +
          root.Format.exact(minimal.classes) + ' Myhill-Nerode classes' }
    });
  }

  function paintRun(state, run, input) {
    root.jQuery('#dfa-run').html(run.trace.map(function (step) {
      return '<div class="mono" style="font-size:.85rem">' +
        (step.index < 0 ? 'start' : 'read ' + step.symbol) + ' → ' +
        step.states.join(', ') + '</div>';
    }).join(''));

    root.Helpers.setText('dfa-run-note',
      'The input "' + (input === '' ? 'ε' : input) + '" is ' +
      root.Format.exact(input.length) + ' symbols long and the run has ' +
      root.Format.exact(run.trace.length) + ' rows, one per symbol plus the start. A DFA reads ' +
      'each symbol once and never looks back, so the run length is the input length however ' +
      'complicated the language is — which is the property that makes lexers linear. ' +
      (run.accepted
        ? 'The last state is accepting, so the string is in the language.'
        : 'The last state is not accepting, so it is not.'));
  }

  function paintTable(state) {
    const machine = state.machine;

    root.jQuery('#dfa-table tbody').html(machine.states.map(function (name) {
      const row = machine.delta[name] || {};
      const moves = machine.alphabet.map(function (symbol) {
        return symbol + ' → ' + ((row[symbol] || ['—'])[0]);
      }).join(', ');

      return '<tr><td class="mono">' + name + '</td><td class="mono">' +
        (machine.start.indexOf(name) !== -1 ? 'yes' : '') + '</td><td class="mono">' +
        (root.Automaton.isAccepting(machine, name) ? 'yes' : '') + '</td><td class="mono">' +
        moves + '</td><td>' + meaningOf(state, name) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('dfa-table-note',
      'The last column is the design, and everything else follows from it. For the divisibility ' +
      'machines the state is a remainder and the transition is r → (2r + b) mod k, which is ' +
      'arithmetic rather than a drawing — the demo builds those machines from the formula, so ' +
      'there is nothing to get wrong by hand. Reading the table with the meanings beside it is ' +
      'how you check a state machine somebody else wrote: a state whose meaning you cannot state ' +
      'in a sentence is either redundant or a bug.');
  }

  function meaningOf(state, name) {
    if (state.spec.modulus) {
      return 'the numeral so far leaves remainder ' + name.slice(1) + ' modulo ' +
        state.spec.modulus;
    }
    return 'reached after the prefixes that behave alike from here';
  }

  function paintBatch(state) {
    root.jQuery('#dfa-batch-table tbody').html(state.batch.rows.map(function (row) {
      return '<tr><td class="mono">' + row.length + '</td><td class="mono">' +
        root.Format.exact(row.words) + '</td><td class="mono">' +
        root.Format.exact(row.accepted) + '</td><td class="mono">' +
        root.Format.exact(row.expected) + '</td><td class="mono">' +
        (row.agree === row.words ? 'yes' : 'NO — ' + (row.words - row.agree)) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('dfa-batch-caption',
      root.Format.exact(state.batch.agree) + ' of ' + root.Format.exact(state.batch.tested) +
      ' strings agree, and the two middle columns are what makes that meaningful: one is the ' +
      'machine and the other is an independent definition — real arithmetic for the ' +
      'divisibility rows, a suffix test or a count for the others. A machine checked against ' +
      'its own trace always passes. This is the same reason the cryptography milestone checks ' +
      'primitives against published vectors: agreement with somebody else\'s answer is the ' +
      'only detector.');
  }

  function paintPatterns() {
    const rows = [
      { pattern: 'Counting modulo k', state: 'the remainder so far', count: 'exactly k',
        wild: 'divisibility, round-robin scheduling, sequence numbers with a window' },
      { pattern: 'Tracking a suffix', state: 'the longest prefix of the target that matches the tail',
        count: 'one per prefix of the target, so |target| + 1',
        wild: 'Knuth–Morris–Pratt, log-line matching, protocol delimiters' },
      { pattern: 'Parity or a flag', state: 'one bit per independent flag',
        count: '2^flags — which is why flags multiply',
        wild: 'even/odd counts, "have we seen a header yet", feature toggles' },
      { pattern: 'Bounded run length', state: 'how many identical symbols in a row, capped',
        count: 'the cap plus one, plus a trap',
        wild: 'password rules, rate limiting by consecutive failures' },
      { pattern: 'A protocol phase', state: 'which handshake step has completed',
        count: 'one per phase, plus error',
        wild: 'TCP (M49), TLS, OAuth flows, any request lifecycle' },
      { pattern: 'Remembering an unbounded count', state: 'not expressible',
        count: 'infinite — not a finite automaton at all',
        wild: 'balanced brackets, aⁿbⁿ, anything that nests' }
    ];

    root.jQuery('#dfa-patterns tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.pattern + '</td><td>' + row.state + '</td><td class="mono">' +
        row.count + '</td><td>' + row.wild + '</td></tr>';
    }).join(''));

    root.Helpers.setText('dfa-patterns-note',
      'The third column is the design budget. Flags multiply — three independent booleans is ' +
      'eight states — which is why a state machine assembled from flags becomes unreadable long ' +
      'before it becomes wrong, and why the useful move is usually to find the single quantity ' +
      'that subsumes them. The last row is the boundary from the previous section stated as a ' +
      'design rule: if the state you need is "how many", and the how-many is unbounded, no ' +
      'amount of state design will get you there.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
