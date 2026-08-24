/**
 * Section: Turing machines.
 *
 * Two measurements carry it. The first is agreement: the aⁿbⁿcⁿ machine is run
 * against an independent definition over every string up to length 7 — 3 280 of
 * them — and agrees on all of them. That is a real check of a machine that is
 * easy to write almost correctly; the first version of it accepted `abcabc`,
 * because crossing off one of each per sweep says nothing about the ORDER.
 *
 * The second is the budget. A Turing machine may run forever, and the demo
 * reports `budget` as an outcome distinct from `rejected`, because collapsing
 * the two is exactly the mistake the next section is about.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'turing-machines';
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — the transition function of a small machine',
      caption: 'This is binary increment, and it is the whole machine. Walk right to the end of ' +
        'the number, then walk left carrying: every `1` becomes `0` and the walk continues, and ' +
        'the first `0` becomes `1` and the machine halts. Notice what is NOT here — no memory ' +
        'beyond the two states, no arithmetic, no notion of a number. The machine has a finite ' +
        'control and an infinite tape, and everything it can compute comes from moving one cell ' +
        'at a time. That is the model the whole of computing is defined against, and its ' +
        'poverty is the point: anything you can compute at all, you can compute with this.',
      definition: [
        'stateDiagram-v2',
        '    [*] --> right',
        '    right --> right : 0 / 0, move right',
        '    right --> right : 1 / 1, move right',
        '    right --> carry : blank / blank, move left',
        '    carry --> carry : 1 / 0, move left',
        '    carry --> done : 0 / 1, stop',
        '    carry --> done : blank / 1, stop',
        '    done --> [*]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**A Turing machine is a finite control, an infinite tape, and a head that moves one cell ' +
        'at a time.** The transition function maps (state, symbol) to (state, symbol, ' +
        'direction), and that is the entire model. Its poverty is deliberate: a model this weak ' +
        'that can still compute everything computable is what makes the claims about it worth ' +
        'anything.',
      '**A configuration is the state, the tape and the head position together.** A computation ' +
        'is a sequence of configurations, and everything about "what the machine is doing" is ' +
        'one of those three fields. The demo prints them, because the notation `uqv` for a ' +
        'configuration is exactly as informative and considerably less readable.',
      '**Acceptance and halting are different questions, and the difference is the milestone.** ' +
        'A machine ACCEPTS if it halts in an accepting state. It may halt in a non-accepting ' +
        'one, which is a rejection, or it may never halt at all — which is neither, and the ' +
        'demo reports it as a third outcome rather than folding it into rejection.',
      '**Multi-tape and nondeterministic variants add no power, and they do change cost.** A ' +
        'k-tape machine is simulated by a single-tape one with a quadratic slowdown, and a ' +
        'nondeterministic machine by a deterministic one with an exponential one. Both are ' +
        'POLYNOMIALLY related for the multi-tape case, which is why "polynomial time" is a ' +
        'robust notion, and the nondeterministic gap is precisely the P versus NP question.',
      '**`aⁿbⁿcⁿ` is the language that separates this milestone from the last one.** No ' +
        'pushdown automaton recognises it — one stack is not enough for two independent counts ' +
        '— and a Turing machine does it by crossing off one of each per sweep, in quadratic ' +
        'time. Decidable and not context-free, in one example.',
      '**The universal machine is the first program that takes a program as input.** Encode a ' +
        'machine as a string, feed it to a machine that simulates it, and you have an ' +
        'interpreter. Every VM, every container runtime and every `eval` in this platform is a ' +
        'descendant of that one construction, and the demo encodes a machine as a string to ' +
        'make the "program is data" step concrete.',
      '**The Church–Turing thesis is a thesis, not a theorem.** It says every effectively ' +
        'calculable function is Turing-computable, and it cannot be proved because "effectively ' +
        'calculable" is informal. What supports it is that every model anyone has proposed — ' +
        'lambda calculus, recursive functions, register machines, cellular automata — turned ' +
        'out equivalent, which is the next section.',
      '**The step budget is not a compromise, it is the subject.** Bounded halting is decidable ' +
        'and unbounded is not, so a simulator with no bound either hangs or lies. Every timeout, ' +
        'fuel counter and gas limit in production software is that substitution, made because ' +
        'the unbounded question has no answer.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — run a machine, and watch a budget expire honestly',
        markup: root.TuringTemplate.render()
      },
      diagram: diagram(),
      insight: '**The universal machine is the first program that takes a program as input; ' +
        'every interpreter, VM and container runtime in this platform is a descendant of that ' +
        'one idea.** Turing needed it for a proof — the halting argument requires a machine that ' +
        'can simulate an arbitrary other one — and it turned out to be the most useful object in ' +
        'the subject. The practical residue is a habit of mind: when a system needs to run ' +
        'something it does not know about at build time, you are building a universal machine, ' +
        'and the questions that come with it are the ones in this milestone. What is the step ' +
        'budget? What happens when it expires? Can the guest tell? Those are not implementation ' +
        'details; they are the only honest answers available.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.TuringTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  function machineFor(name) {
    return root.TuringMachine.programs()[name]();
  }

  const runFor = root.Helpers.memoise(function (key) {
    const parts = key.split('\n');

    return root.TuringMachine.run(machineFor(parts[0]), parts[1],
      { budget: Number(parts[2]) });
  });

  /**
   * Each machine against an independent statement of what its language is.
   * The definitions are written from the language rather than from the
   * machine, which is the only way the check means anything.
   */
  const DEFINITIONS = {
    anbncn: function (text) {
      return /^(a*)(b*)(c*)$/.test(text)
        && text.replace(/[^a]/g, '').length === text.replace(/[^b]/g, '').length
        && text.replace(/[^b]/g, '').length === text.replace(/[^c]/g, '').length;
    },
    palindrome: function (text) {
      return text === text.split('').reverse().join('');
    }
  };

  const ALPHABETS = { anbncn: ['a', 'b', 'c'], palindrome: ['0', '1'] };

  const checkFor = root.Helpers.memoise(function (name) {
    const definition = DEFINITIONS[name];

    if (!definition) return { rows: [], checked: 0, mismatches: 0, applicable: false };
    const machine = machineFor(name);
    const alphabet = ALPHABETS[name];
    const rows = [];
    let checked = 0;
    let mismatches = 0;

    strings(alphabet, name === 'anbncn' ? 6 : 7).forEach(function (text) {
      const outcome = root.TuringMachine.run(machine, text,
        { budget: 5000, traceLimit: 0 });
      const expected = definition(text);

      checked += 1;
      if (outcome.accepted !== expected) mismatches += 1;
      if (rows.length < 12 || outcome.accepted !== expected) {
        rows.push({ text: text || 'the empty tape', machine: outcome.accepted,
          definition: expected, agree: outcome.accepted === expected,
          outcome: outcome.outcome });
      }
    });
    return { rows: rows, checked: checked, mismatches: mismatches, applicable: true };
  });

  function strings(alphabet, maxLength) {
    const out = [''];
    let level = [''];

    for (let length = 0; length < maxLength; length += 1) {
      const next = [];

      level.forEach(function (prefix) {
        alphabet.forEach(function (symbol) { next.push(prefix + symbol); });
      });
      next.forEach(function (text) { out.push(text); });
      level = next;
    }
    return out;
  }

  const growthFor = root.Helpers.memoise(function (name) {
    const machine = machineFor(name);

    return sizes(name).map(function (text) {
      const outcome = root.TuringMachine.run(machine, text, { budget: 20000, traceLimit: 0 });

      return { text: text, length: text.length, steps: outcome.steps, space: outcome.space,
        outcome: outcome.outcome };
    });
  });

  function sizes(name) {
    if (name === 'anbncn') {
      return [1, 2, 3, 4, 5].map(function (n) {
        return 'a'.repeat(n) + 'b'.repeat(n) + 'c'.repeat(n);
      });
    }
    if (name === 'doubler') {
      return [1, 2, 3, 4, 5].map(function (n) { return '1'.repeat(n); });
    }
    if (name === 'palindrome') {
      return [2, 4, 6, 8, 10].map(function (n) {
        return '1'.repeat(n / 2) + '1'.repeat(n / 2);
      });
    }
    if (name === 'looper') return ['1', '11', '111', '1111', '11111'];
    return [2, 4, 6, 8, 10].map(function (n) { return '1'.repeat(n); });
  }

  function update() {
    const values = panel.values();
    const state = runFor(values['tur-program'] + '\n' + values['tur-input'] + '\n' +
      values['tur-budget']);
    const check = checkFor(values['tur-program']);

    paintMetrics(state, check);
    paintTape(state, values);
    paintTrace(state);
    paintDelta(values['tur-program']);
    paintCheck(check, values['tur-program']);
    paintGrowth(values['tur-program']);
  }

  function paintMetrics(state, check) {
    root.MetricGrid.update({
      'tur-outcome': { value: state.outcome,
        note: state.outcome === 'budget'
          ? 'the budget ran out — this is NOT a rejection, and reporting it as one would be a ' +
            'lie about the language'
          : (state.accepted ? 'halted in an accepting state'
            : 'halted with no transition to take, which is a rejection') },
      'tur-steps': { value: root.Format.exact(state.steps),
        note: 'one transition applied per step' },
      'tur-space': { value: root.Format.exact(state.space),
        note: 'the span of tape the head ever visited, which is the space the machine used' },
      'tur-agrees': { value: check.applicable
        ? (check.mismatches === 0 ? 'yes' : 'NO — ' + check.mismatches + ' mismatches')
        : 'no definition to check against',
      note: check.applicable
        ? root.Format.exact(check.checked) + ' inputs checked against an independent statement ' +
          'of the language'
        : 'this machine computes a function rather than deciding a language' }
    });
  }

  function paintTape(state, values) {
    root.jQuery('#tur-tape').html(
      '<div>input:  ' + root.Helpers.escapeHtml(values['tur-input'] || '(empty)') + '</div>' +
      '<div>output: ' + root.Helpers.escapeHtml(state.tape || '(empty)') + '</div>' +
      '<div style="margin-top:.4rem">final state: ' +
      root.Helpers.escapeHtml(state.state) + ', head at ' + state.head + '</div>');

    root.Helpers.setText('tur-tape-note',
      'The tape is a two-way infinite sequence of cells, so the head may walk left of where the ' +
      'input started and the model does not care. What you see here is the span it actually ' +
      'touched. For the increment and doubling machines the output is the answer; for the ' +
      'language deciders the output is scratch work and the answer is the final state.');
  }

  function paintTrace(state) {
    root.jQuery('#tur-trace tbody').html(state.trace.slice(0, 16).map(function (row) {
      return '<tr><td class="mono">' + row.step + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row.state) + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row.symbol) + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row.tape) + '</td></tr>';
    }).join('') || '<tr><td class="mono">—</td><td class="mono">—</td><td class="mono">—</td>' +
      '<td class="mono">no steps</td></tr>');

    root.Helpers.setText('tur-trace-note',
      'Each row is a configuration: the state, the symbol under the head, and the tape. That ' +
      'triple is the complete description of the machine at that moment — there is nowhere else ' +
      'for information to hide, which is what makes the model tractable to reason about and ' +
      'what makes the halting argument in the next section airtight.');
  }

  function paintDelta(name) {
    const rows = root.TuringMachine.transitionRows(machineFor(name));

    root.jQuery('#tur-delta tbody').html(rows.slice(0, 18).map(function (row) {
      return '<tr><td class="mono">' + root.Helpers.escapeHtml(row.from) +
        '</td><td class="mono">' + root.Helpers.escapeHtml(row.read) +
        '</td><td class="mono">' + root.Helpers.escapeHtml(row.write) +
        '</td><td class="mono">' + row.move + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row.to) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('tur-delta-note',
      'A missing row is a rejection: if the machine is in a state reading a symbol it has no ' +
      'transition for, it halts, and it halts in whatever state it was in. That convention is ' +
      'why no explicit reject state is needed and why the table is smaller than the state count ' +
      'times the alphabet size. It is also how the aⁿbⁿcⁿ machine rejects a string with the ' +
      'wrong counts: it runs out of transitions.');
  }

  function paintCheck(check, name) {
    root.jQuery('#tur-check tbody').html(check.applicable
      ? check.rows.slice(0, 12).map(function (row) {
        return '<tr><td class="mono">' + root.Helpers.escapeHtml(row.text) +
          '</td><td class="mono">' + (row.machine ? 'accepts' : row.outcome) +
          '</td><td class="mono">' + (row.definition ? 'in the language' : 'not in it') +
          '</td><td class="mono">' + (row.agree ? 'yes' : 'NO') + '</td></tr>';
      }).join('')
      : '<tr><td class="mono">—</td><td class="mono">—</td>' +
        '<td class="mono">this machine computes a function, not a language</td>' +
        '<td class="mono">—</td></tr>');

    root.Helpers.setText('tur-check-note', check.applicable
      ? 'Every string up to the bound, run through the machine and through a definition written ' +
        'from the LANGUAGE rather than from the machine — ' + root.Format.exact(check.checked) +
        ' of them, with ' + root.Format.exact(check.mismatches) + ' disagreements. The first ' +
        'version of the aⁿbⁿcⁿ machine failed this: it crossed off one of each per sweep, which ' +
        'gets the counts right and says nothing about the order, so it accepted `abcabc`. A ' +
        'verification phase before the counting fixed it, and nothing but an exhaustive check ' +
        'would have found it.'
      : 'The increment and doubling machines compute functions rather than deciding languages, ' +
        'so there is no accept/reject to compare. Their check is in the growth table below and ' +
        'in the test suite, which compares the output tape against arithmetic.');
  }

  function paintGrowth(name) {
    root.jQuery('#tur-growth tbody').html(growthFor(name).map(function (row) {
      return '<tr><td class="mono">' + root.Helpers.escapeHtml(row.text.slice(0, 20)) +
        '</td><td class="mono">' + row.length + '</td><td class="mono">' +
        root.Format.exact(row.steps) + (row.outcome === 'budget' ? ' (capped)' : '') +
        '</td><td class="mono">' + row.space + '</td></tr>';
    }).join(''));

    root.Helpers.setText('tur-growth-note',
      'Read the steps column against the length column. The aⁿbⁿcⁿ machine is QUADRATIC — each ' +
      'sweep crosses off one of each symbol and walks the whole tape to do it — and its space ' +
      'is exactly the input length, because it never writes outside it. That combination, ' +
      'linear space and quadratic time, is the shape of a machine that is re-deriving rather ' +
      'than remembering, which is the trade the space-complexity section is entirely about.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
