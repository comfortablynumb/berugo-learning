/**
 * Section: undecidability and diagonalisation.
 *
 * The measurement is a contradiction produced against every candidate oracle
 * the learner can pick, including one that flips a coin. The construction
 * consults the oracle for real — it is a live function call — and then reports
 * what the constructed program does, which is by definition the opposite. Two
 * hundred arbitrary oracles are defeated in the test suite, which is the
 * runnable form of "no such program exists".
 *
 * The second half is the one that is actually useful: bounded halting IS
 * decidable, the demo decides it, and every timeout in production software is
 * that substitution.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'undecidability-and-diagonalisation';
  let panel = null;
  let coin = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — the diagonal argument, and the contradiction it forces',
      caption: 'Suppose a program `halts(p, x)` existed and always answered correctly. Build ' +
        '`contrary(p)`: ask the oracle what `p` does when run on its own source, then do the ' +
        'opposite — loop forever if the oracle says it halts, return immediately if it says it ' +
        'loops. Now run `contrary` on its OWN source. Both branches are impossible: if the ' +
        'oracle says it halts, the program loops, so the oracle was wrong; if it says it loops, ' +
        'the program returns, so the oracle was wrong. There is no third branch and no escape ' +
        'clause, and nothing about the construction depended on how clever the oracle was. That ' +
        'is why the theorem is about EVERY program rather than about the ones we have tried.',
      definition: [
        'flowchart TD',
        '    A["assume halts(p, x) exists and is always right"] --> B["build contrary(p)"]',
        '    B --> C{"halts(contrary, contrary)?"}',
        '    C -->|says halts| D["contrary enters the infinite loop"]',
        '    C -->|says loops| E["contrary returns immediately"]',
        '    D --> F["so it does NOT halt — the oracle was wrong"]',
        '    E --> G["so it DOES halt — the oracle was wrong"]',
        '    F --> H["halts cannot exist"]',
        '    G --> H'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Decidable, recognisable and co-recognisable are three different things.** A problem is ' +
        'DECIDABLE if some machine always halts with the right answer. It is RECOGNISABLE if a ' +
        'machine halts and accepts on the yes instances, and may run forever on the no ones. ' +
        'Co-recognisable is the same with the roles swapped, and a problem is decidable exactly ' +
        'when it is both.',
      '**Halting is recognisable and not decidable, and the gap is entirely one-sided.** Run the ' +
        'machine: if it halts, you find out. If it does not, you wait forever and never learn ' +
        'that you are waiting forever. There is no symmetric procedure, and that asymmetry is ' +
        'the shape of every semi-decision procedure ever written.',
      '**Diagonalisation is Cantor’s argument applied to programs.** Lay out every machine as a ' +
        'row and every input as a column. Build a new row that differs from row i at column i, ' +
        'for every i. It differs from every row, so it is no row — and if every machine is a ' +
        'row, it is no machine. The demo lays out the table and marks the cells.',
      '**The halting proof is that argument with one extra step.** The constructed machine ' +
        'consults the supposed oracle and does the opposite of what it predicts, so the ' +
        'contradiction is not about a table entry but about the program\'s own behaviour. The ' +
        'demo runs it against whichever oracle you pick, and the oracle is a real function that ' +
        'is genuinely called.',
      '**The construction is mechanical, which is why the theorem is universal.** Nothing about ' +
        'it examines the oracle\'s method. A perfect oracle, a heuristic, a machine-learned ' +
        'model and a coin flip are all defeated by the same six lines, and the demo lets you ' +
        'try all four.',
      '**Bounded halting is decidable, and it is what every real tool uses.** "Does this machine ' +
        'halt within k steps?" is answered by running it for k steps. That is not a compromise ' +
        'forced by engineering; it is a different and answerable question, and the substitution ' +
        'is the single most common application of this section.',
      '**Recognisability has an enumeration reading.** A language is recognisable exactly when ' +
        'some machine can list its members, in some order, possibly never finishing. That is ' +
        'why the class is also called recursively enumerable, and why "we can find all the bugs ' +
        'eventually" is a coherent claim while "we can certify there are none" is not.',
      '**The acceptance problem is undecidable for the same reason.** "Does machine M accept ' +
        'input w?" reduces to halting immediately, and that reduction is the template the next ' +
        'section generalises into Rice\'s theorem.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — pick an oracle, and watch it be defeated',
        markup: root.DiagonalTemplate.render()
      },
      diagram: diagram(),
      insight: '**Bounded halting is decidable and useful; unbounded is not. Nearly every ' +
        'practical tool in this space — timeouts, step budgets, fuel, gas limits — is that ' +
        'substitution.** Recognising it changes how you argue about them. A request timeout is ' +
        'not a hack around a hard problem: it is the decidable version of a question that has ' +
        'no answer, and its value of k is a specification rather than a tuning parameter. The ' +
        'same reframing applies to CI time limits, to a query planner\'s cost cap, and to the ' +
        'gas metering in a smart-contract VM — each one converts an undecidable question into ' +
        'a decidable one and inherits the obligation to say what happens when the bound is hit. ' +
        'That obligation is the real engineering content of this section.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    coin = root.Random.seeded(20260824);
    panel = root.ControlPanel.mount({
      controls: root.DiagonalTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  function oracleFor(name) {
    if (name === 'optimistic') return root.Undecidability.optimisticDecider();
    if (name === 'pessimistic') return root.Undecidability.pessimisticDecider();
    if (name === 'random') {
      return function () { return coin.next() < 0.5 ? 'halts' : 'loops'; };
    }
    return root.Undecidability.heuristicDecider();
  }

  /**
   * The behaviour table. A machine's row must vary across the columns or the
   * picture teaches nothing — a table of constant rows makes the diagonal look
   * like a coincidence rather than a construction. A proper mixing hash gives
   * every row and every column both outcomes, which is what an arbitrary
   * enumeration of machines would look like.
   */
  function behaviour(i, j) {
    let h = ((i + 1) * 0x9e3779b1) ^ ((j + 1) * 0x85ebca6b);

    h = Math.imul(h ^ (h >>> 15), 0xc2b2ae35);
    h ^= h >>> 13;
    return ((h >>> 0) % 2 === 0) ? 'loops' : 'halts';
  }

  const boundedFor = root.Helpers.memoise(function (budget) {
    const names = ['increment', 'anbncn', 'palindrome', 'doubler', 'looper'];
    const inputs = { increment: '1011', anbncn: 'aaabbbccc', palindrome: '10101',
      doubler: '1111', looper: '1011' };

    return names.map(function (name) {
      const machine = root.TuringMachine.programs()[name]();
      const outcome = root.TuringMachine.run(machine, inputs[name],
        { budget: Number(budget), traceLimit: 0 });

      return { name: machine.label, input: inputs[name], halts: outcome.halted,
        steps: outcome.steps, outcome: outcome.outcome };
    });
  });

  function update() {
    const values = panel.values();
    const oracle = oracleFor(values['dia-oracle']);
    const defeat = root.Undecidability.defeat(oracle);
    const size = Number(values['dia-size']);

    paintMetrics(defeat, values['dia-budget']);
    paintSource(defeat);
    paintTable(size);
    paintDifferences(size);
    paintBounded(values['dia-budget']);
    paintTower();
  }

  function paintMetrics(defeat, budget) {
    const bounded = boundedFor(budget);
    const decided = bounded.filter(function (row) {
      return row.outcome !== 'budget';
    }).length;

    root.MetricGrid.update({
      'dia-verdict': { value: defeat.oracleSaid,
        note: 'the oracle was genuinely called, on the source printed beside it' },
      'dia-actual': { value: defeat.actuallyDoes, note: defeat.why },
      'dia-contradiction': { value: defeat.contradiction ? 'yes' : 'no',
        note: defeat.contradiction
          ? 'the construction defeats every oracle, and the test suite runs 200 of them'
          : 'no contradiction — which would mean the construction is wrong, not the theorem' },
      'dia-bounded': { value: root.Format.exact(decided) + ' of ' +
        root.Format.exact(bounded.length),
      note: 'machines whose halting was DECIDED within ' + root.Format.exact(Number(budget)) +
        ' steps; the rest are still running and that is a third answer' }
    });
  }

  function paintSource(defeat) {
    root.jQuery('#dia-source').text(defeat.source);

    root.Helpers.setText('dia-source-note',
      'Six lines, and the oracle is called on its own source. Change the oracle control and ' +
      'the verdict above changes; the contradiction does not, because the program is defined ' +
      'as the opposite of whatever it is told. That is why the theorem quantifies over every ' +
      'program rather than over the ones anybody has thought of — the construction never looks ' +
      'inside the oracle at all.');
  }

  function paintTable(size) {
    const rows = root.Undecidability.diagonalTable(behaviour, size);
    const machine = root.Undecidability.diagonalMachine(behaviour, size);
    const header = '     ' + rows[0].cells.map(function (_, j) {
      return String(j).padStart(2);
    }).join('');

    root.jQuery('#dia-table').html(
      root.Helpers.escapeHtml(header) + '<br>' +
      rows.map(function (row) {
        return root.Helpers.escapeHtml('M' + String(row.machine).padEnd(3) +
          ' ' + row.cells.map(function (cell, j) {
            return (j === row.machine ? (cell === 'halts' ? '[H' : '[L') + ']'
              : ' ' + (cell === 'halts' ? 'H' : 'L') + ' ').slice(0, 2);
          }).join(''));
      }).join('<br>') +
      '<br>' + root.Helpers.escapeHtml('D    ' + machine.row.map(function (cell) {
        return ' ' + (cell === 'halts' ? 'H' : 'L');
      }).join('')));

    root.Helpers.setText('dia-table-note',
      'Rows are machines, columns are inputs, and H or L says whether that machine halts on ' +
      'that input. The bracketed cells are the diagonal — where a machine meets its own ' +
      'encoding. The last row, D, is built to disagree with every diagonal cell, so it differs ' +
      'from row 0 at column 0, from row 1 at column 1, and so on forever. It is therefore not ' +
      'any row of the table. And every machine IS a row, because the table was built by listing ' +
      'them all.');
  }

  function paintDifferences(size) {
    const machine = root.Undecidability.diagonalMachine(behaviour, size);

    root.jQuery('#dia-differences tbody').html(machine.differences.map(function (row) {
      return '<tr><td class="mono">M' + row.machine + '</td><td class="mono">' + row.column +
        '</td><td class="mono">' + row.itDoes + '</td><td class="mono">' + row.weDo +
        '</td></tr>';
    }).join(''));

    root.Helpers.setText('dia-differences-note',
      'One row per existing machine, each naming a single column where the constructed machine ' +
      'behaves differently. A single disagreement is enough to prove two machines are not the ' +
      'same — and there is one for every row, which is what "it is no row of the table" means. ' +
      'This is Cantor\'s argument exactly: the same construction shows the reals are ' +
      'uncountable, and Turing\'s contribution was noticing it applies to programs.');
  }

  function paintBounded(budget) {
    root.jQuery('#dia-bounded-table tbody').html(boundedFor(budget).map(function (row) {
      return '<tr><td class="mono">' + root.Helpers.escapeHtml(row.name) +
        '</td><td class="mono">' + (row.outcome === 'budget' ? 'still running' :
          (row.halts ? 'yes' : 'yes — rejected, but halted')) +
        '</td><td class="mono">' + root.Format.exact(row.steps) + '</td><td class="mono">' +
        row.outcome + '</td></tr>';
    }).join(''));

    root.Helpers.setText('dia-bounded-caption',
      'This table is decided, completely and reliably, by running each machine for the budget ' +
      'and looking. Move the budget slider down far enough and machines migrate into "still ' +
      'running"; move it up and they come back — except the last one, which never halts on any ' +
      'input and never will. That is the whole difference between the bounded question and the ' +
      'unbounded one: the bounded one always has an answer, and the answer depends on k.');
  }

  function paintTower() {
    root.jQuery('#dia-tower tbody').html(root.Undecidability.TOWER.map(function (row) {
      return '<tr><td>' + root.Helpers.escapeHtml(row.problem) + '</td><td class="mono">' +
        (row.decidable ? 'yes' : 'no') + '</td><td class="mono">' +
        (row.recognisable ? 'yes' : 'no') + '</td><td class="mono">' +
        (row.coRecognisable ? 'yes' : 'no') + '</td><td>' +
        root.Helpers.escapeHtml(row.note) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('dia-tower-note',
      'The two middle columns are the ones that decide what kind of tool is possible. ' +
      'Recognisable means a semi-decision procedure exists that confirms the yes cases — so a ' +
      'bug finder can be complete-in-the-limit, listing every bug eventually and never ' +
      'certifying a clean program. Co-recognisable is the other side, which is what an ' +
      'exhaustive-search prover gives you. Neither column set means neither kind of tool is ' +
      'possible at all, and the last two rows are both in that position — which is why grammar ' +
      'equivalence and totality checking have no approximation strategy that works from one ' +
      'side.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
