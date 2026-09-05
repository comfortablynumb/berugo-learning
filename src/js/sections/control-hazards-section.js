/**
 * Section: Control hazards.
 *
 * A branch is not resolved until it reaches the stage that resolves it, and
 * everything fetched in the meantime was a guess. This section moves the
 * resolution point and counts what changes: resolving in decode instead of
 * execute halves the penalty and costs a comparator in decode plus a stall
 * whenever an operand is still being computed one instruction ahead.
 *
 * Both halves of that trade are real in the model. `pipeline.js` implements
 * early resolution properly, including the stall, so the demo reports a
 * smaller flush count and a larger stall count rather than a free win.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'control-hazards';
  const Pipeline = root.Brv32.Pipeline;
  const Assembler = root.Brv32.Assembler;
  const Programs = root.Brv32.Programs;
  const View = root.PipelineView;
  let panel = null;
  let chart = null;

  const NAMES = ['sum', 'arrayMax', 'strlen', 'factorial'];

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — a branch resolves, and two instructions never happened',
      caption: 'Fetch keeps going while the branch is still in flight, because stopping would '
        + 'cost the same cycles with certainty rather than sometimes. When the branch resolves '
        + 'and disagrees with what fetch assumed, every instruction fetched since is squashed '
        + '— they leave no trace in the register file or in memory, which is the property that '
        + 'makes guessing safe.',
      definition: [
        'flowchart TB',
        '    F["cycle 1: fetch the branch"] --> F2["cycle 2: fetch the next address<br/>a guess"]',
        '    F2 --> F3["cycle 3: fetch the one after<br/>still a guess"]',
        '    F3 --> R["cycle 3: the branch resolves in execute"]',
        '    R -->|"the guess was right"| K["nothing happens; the guesses were correct"]',
        '    R -->|"the guess was wrong"| S["squash both, redirect fetch<br/>2 cycles gone"]',
        '    S --> N["cycle 4: fetch the real target"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**A control hazard is not knowing what to fetch next.** The branch is in the pipeline '
        + 'and its direction is not known until it reaches whichever stage compares the '
        + 'operands. Fetch cannot wait — waiting costs the same cycles every time instead of '
        + 'only on a mistake — so it guesses, and the wrong guesses are thrown away.',
      '**The penalty is the number of stages between fetch and resolution.** Resolving in '
        + 'execute means two instructions were fetched on the guess; resolving in decode means '
        + 'one. That is why the resolution point is worth moving, and why a deeper pipeline '
        + 'makes every mistake more expensive.',
      '**Squashing has to be total.** A flushed instruction must leave no register written, no '
        + 'memory changed and no exception raised. In this machine that is easy, because only '
        + 'write-back commits anything and everything younger than the branch is still short '
        + 'of it. That is the same property that makes precise exceptions work in 35.7.',
      '**Early resolution is not free.** Comparing the operands in decode needs a comparator '
        + 'there and its own forwarding paths. It also needs a stall whenever an operand is '
        + 'still being computed by the instruction directly ahead, because at that moment the '
        + 'value does not exist anywhere to forward from. The demo counts those stalls rather '
        + 'than hiding them.',
      '**Static prediction is nearly free and surprisingly good.** "Backward branches are '
        + 'taken" costs one comparison and captures the fact that a loop branch goes backwards '
        + 'and usually loops. It is the baseline every dynamic predictor has to beat by enough '
        + 'to justify its area.',
      '**A prediction needs a target as well as a direction.** Knowing a branch will be taken '
        + 'is no use to fetch without an address, and the address is in the instruction that '
        + 'has not been decoded yet. A branch target buffer remembers where this site went '
        + 'last time, which is why it appears alongside every direction predictor.',
      '**Delayed branches were the other answer, and they did not survive.** Some machines '
        + 'defined the instruction after a branch to execute regardless, so the slot was never '
        + 'wasted. It works at one pipeline depth and becomes an architectural liability at '
        + 'every other, which is a good lesson about encoding an implementation detail into a '
        + 'contract.',
      '**The penalty is the multiplier on every prediction miss, and that is the whole of '
        + 'M35.5 and 35.6.** A 2-cycle penalty makes a mediocre predictor tolerable; a '
        + '20-cycle penalty makes a 2% miss rate a large fraction of runtime. Deeper pipelines '
        + 'did not just need better predictors — they created the demand for them.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: { title: 'Interactive demo — move the resolution point, count the flushes',
        markup: root.ControlHazardTemplate.render() },
      diagram: diagram(),
      insight: insight()
    };
  }

  function insight() {
    return '**Deeper pipelines made every branch mistake more expensive, which is the '
      + 'self-defeating part of the whole idea and the reason branch prediction became a '
      + 'research field.** The penalty is measured in stages, so the same design change that '
      + 'shortened the clock lengthened the cost of every misprediction in proportion. At five '
      + 'stages a mistake costs two instructions and a mediocre predictor is fine. At twenty '
      + 'stages it costs fifteen or more. A predictor that is wrong 5% of the time is then '
      + 'spending a large fraction of the machine on work that gets thrown away. Everything in '
      + 'the next two sections exists because of that multiplication. The transferable shape '
      + 'is that speculation is only as good as the cost of being wrong, and that cost is '
      + 'usually set by a decision made somewhere else entirely. Prefetching a page, warming a '
      + 'cache, optimistically locking a row, speculatively executing a branch of a workflow: '
      + 'all of them are the same bet. In every case the interesting number is not the hit '
      + 'rate, but the hit rate multiplied by what a miss costs. A system that made the '
      + 'speculation cheaper to recover from would have been a better investment than one that '
      + 'made the guess slightly more accurate. That is a comparison almost nobody makes.';
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({
      controls: root.ControlHazardTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------- plumbing */

  function fill(id, rows) {
    root.jQuery('#' + id + ' tbody').html(rows.map(function (cells) {
      return '<tr>' + cells.map(function (cell) {
        return '<td>' + root.Helpers.escapeHtml(String(cell)) + '</td>';
      }).join('') + '</tr>';
    }).join(''));
  }

  const runOf = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);
    const image = Assembler.assemble(Programs.CATALOGUE[parts.name].source, { origin: 0 });
    const machine = Pipeline.create({ image: image.bytes, entry: 0,
      resolveIn: parts.resolve, predictor: parts.predict === 'none' ? null : parts.predict });

    Pipeline.run(machine, { cycles: 3000, stopOnTrap: true });
    return { machine: machine, summary: Pipeline.summary(machine) };
  });

  function keyFor(name, resolve, predict) {
    return JSON.stringify({ name: name, resolve: resolve, predict: predict });
  }

  function reading() {
    const values = panel.values();

    return { name: values['chz-program'], resolve: values['chz-resolve'],
      predict: values['chz-predict'], cycles: Number(values['chz-cycles']),
      run: runOf(keyFor(values['chz-program'], values['chz-resolve'], values['chz-predict'])) };
  }

  /* --------------------------------------------------------------- render */

  function update(app) {
    const view = reading();

    paintMetrics(view);
    paintAttribution(view);
    paintDiagram(view);
    paintResolve(view);
    paintStrategies();
    paintDepth();
    paintChart(app, view);
  }

  function paintMetrics(view) {
    const summary = view.run.summary;
    const penalty = view.resolve === 'ID' ? 1 : 2;

    root.MetricGrid.update({
      'chz-cycles-total': { value: summary.cycles,
        note: summary.retired + ' instructions retired' },
      'chz-flushes': { value: summary.flushes,
        note: summary.redirects + ' redirects x ' + penalty + ' cycles each' },
      'chz-redirects': { value: summary.redirects,
        note: summary.mispredicts + ' of them were predicted wrongly' },
      'chz-penalty': { value: penalty,
        note: view.resolve === 'ID' ? 'fetch to decode is one stage'
          : 'fetch to execute is two stages' },
      'chz-ipc': { value: summary.ipc.toFixed(3), note: 'the ideal is 1.000' },
      'chz-share': { value: (100 * summary.flushes / summary.cycles).toFixed(1) + '%',
        note: summary.flushes + ' of ' + summary.cycles + ' cycles' }
    });
  }

  function paintAttribution(view) {
    const found = View.attribution(view.run.summary);

    fill('chz-attribution', found.rows.map(function (row) {
      return [row.name, row.cycles,
        (100 * row.cycles / found.cycles).toFixed(1) + '%', row.about];
    }));
    root.Helpers.setText('chz-attribution-caption', 'Watch the flush row and the stall row '
      + 'move together when you change the resolution point: decode resolution halves the '
      + 'flushes and adds stalls, because an operand that is still being computed one '
      + 'instruction ahead cannot be compared yet. The total reconciles at ' + found.total
      + ' against ' + found.cycles + ' cycles either way.');
  }

  function paintDiagram(view) {
    root.jQuery('#chz-diagram').html(View.markup(view.run.machine, { cycles: view.cycles }));
    root.Helpers.setText('chz-diagram-note', 'Every gap in a column after a branch is an '
      + 'instruction that was fetched and thrown away. The rows simply stop — a squashed '
      + 'instruction leaves nothing behind, which is exactly what makes speculating safe. '
      + 'Hovering a marked cell gives the reason: taken when not-taken was assumed, or the '
      + 'reverse.');
  }

  function paintResolve(view) {
    fill('chz-resolve-table', NAMES.map(function (name) {
      const ex = runOf(keyFor(name, 'EX', view.predict)).summary;
      const id = runOf(keyFor(name, 'ID', view.predict)).summary;

      return [name + (name === view.name ? ' <-' : ''), ex.cycles, ex.flushes,
        id.cycles, id.flushes,
        (id.stalls - ex.stalls) + ' extra stalls, ' + (ex.cycles - id.cycles) +
          ' cycles saved overall'];
    }));
    root.Helpers.setText('chz-resolve-table-caption', 'Resolving in decode halves the flush '
      + 'count — one instruction thrown away instead of two — and gives some of it back as '
      + 'stalls, because a branch whose operand is still being computed by the instruction '
      + 'ahead has to wait for it. The last column is the net, and it is not positive '
      + 'everywhere: a program whose branches depend on the instruction immediately before '
      + 'them pays more in stalls than it saves in flushes. That is the trade, and which side '
      + 'of it a program lands on is a property of the code rather than of the machine.');
  }

  function paintStrategies() {
    fill('chz-strategies', [
      ['stall until resolved', 'nothing', 'the full penalty on every branch, taken or not',
        'nobody, once anything better existed'],
      ['predict not taken', 'the next address in order is right',
        'the penalty on taken branches only', 'the simplest real machines; it is free'],
      ['predict backward taken', 'a backward branch is a loop',
        'the penalty on the loop exit and on forward taken branches',
        'early MIPS and SPARC — one comparison, most of the benefit'],
      ['delayed branch', 'the compiler can find something useful for the slot',
        'an architectural commitment to one pipeline depth',
        'MIPS and SPARC, and both regretted it'],
      ['dynamic prediction', 'this branch will do what it did last time',
        'a table, and the area for it', 'everything since; 35.5 and 35.6 are about how']
    ]);
    root.Helpers.setText('chz-strategies-caption', 'The fourth row is the cautionary one. A '
      + 'delayed branch is free at the pipeline depth it was designed for and an '
      + 'embarrassment at every other, because the slot is architectural — it is in the '
      + 'contract, so every future implementation has to honour it. That is the M34 lesson '
      + 'about instruction sets meeting the M35 lesson about depth.');
  }

  function paintDepth() {
    fill('chz-depth', [5, 8, 12, 20].map(function (depth) {
      const stage = Math.max(2, Math.round(depth * 0.4));
      const penalty = stage - 1;

      return [depth + ' stages', 'stage ' + stage, penalty + ' cycles',
        (0.05 * 0.2 * penalty).toFixed(3) + ' cycles per instruction'];
    }));
    root.Helpers.setText('chz-depth-caption', 'At a branch every five instructions and a 5% '
      + 'miss rate, the cost per instruction grows straight in proportion to the depth — from '
      + '0.010 cycles at five stages to 0.070 at twenty. That is small until you remember the '
      + 'ideal is 1.000 cycles per instruction, and it is why a 2% improvement in prediction '
      + 'accuracy was worth an enormous amount of silicon by the time pipelines were twenty '
      + 'stages deep.');
  }

  function paintChart(app, view) {
    const host = root.jQuery('#chz-chart')[0];

    if (!host) return;
    if (chart) chart.destroy();
    chart = root.ErrorBandView.bars(host, {
      lazyLib: app.lazyLib, height: 250, yLabel: 'flush cycles',
      values: NAMES.reduce(function (out, name) {
        out.push({ label: name + ' in EX',
          value: runOf(keyFor(name, 'EX', view.predict)).summary.flushes, series: 0 });
        out.push({ label: name + ' in ID',
          value: runOf(keyFor(name, 'ID', view.predict)).summary.flushes, series: 1 });
        return out;
      }, [])
    });
    root.Helpers.setText('chz-chart-note', 'Flush cycles per program at the two resolution '
      + 'points, with whichever predictor is selected above. The decode bar is exactly half '
      + 'the execute bar wherever the redirect count is the same, because the penalty is the '
      + 'stage distance and nothing else — and where the counts differ, the predictor saw a '
      + 'different history and made different guesses.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
