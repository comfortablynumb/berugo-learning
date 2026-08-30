/**
 * Section: Branch prediction, the basics.
 *
 * Four predictors on four patterns, with the accuracy measured per branch site
 * rather than only in total - because an average hides exactly the branch that
 * is costing you, and the nested-loop pattern is here to make that concrete.
 *
 * The traces come from `machines/brv32/branch-traces.js` and are built to
 * separate specific predictors: the nested loop is where a one-bit counter
 * mispredicts twice per entry, the alternating pattern is where a per-site
 * counter cannot do better than chance, and the random pattern is the floor
 * that stops any of the others being called good without a reference.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'branch-prediction-basics';
  const Predictors = root.Brv32.Predictors;
  const Traces = root.Brv32.Traces;
  const View = root.PredictorView;
  const Pipeline = root.Brv32.Pipeline;
  const Assembler = root.Brv32.Assembler;
  const Programs = root.Brv32.Programs;
  let panel = null;
  let chart = null;

  const TRACES = ['loop', 'nested', 'alternating', 'random'];
  const KINDS = ['static-not-taken', 'static-backward', 'one-bit', 'bimodal'];

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — the two-bit saturating counter',
      caption: 'Four states and one rule: a taken branch moves right, a not-taken branch moves '
        + 'left, and the ends saturate. The whole value is in the middle transition — from '
        + 'strongly taken it takes two mistakes to start predicting not-taken, so a loop that '
        + 'runs a hundred times and exits once does not lose its prediction on the exit. A '
        + 'one-bit predictor has no middle, which is why it misses twice per loop.',
      definition: [
        'stateDiagram-v2',
        '    [*] --> weaklyNotTaken',
        '    stronglyNotTaken --> weaklyNotTaken: taken',
        '    weaklyNotTaken --> stronglyNotTaken: not taken',
        '    weaklyNotTaken --> weaklyTaken: taken',
        '    weaklyTaken --> weaklyNotTaken: not taken',
        '    weaklyTaken --> stronglyTaken: taken',
        '    stronglyTaken --> weaklyTaken: not taken',
        '    stronglyNotTaken --> stronglyNotTaken: not taken',
        '    stronglyTaken --> stronglyTaken: taken'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**The prediction problem is: given only the address of a branch, will it be taken, and '
        + 'where does it go.** Fetch has nothing else — the instruction has not been decoded, '
        + 'the operands have not been read, and nothing about this execution is known yet. '
        + 'Everything a predictor does is inference from what happened at this address before.',
      '**A one-bit predictor says "whatever happened last time" and misses twice per loop.** '
        + 'It gets the exit wrong, then remembers "not taken" and gets the first iteration of '
        + 'the next entry wrong too. On a loop of five entered twenty times that is 40 misses '
        + 'where a two-bit counter has 20.',
      '**Two bits fix it by requiring two mistakes to change the prediction.** From strongly '
        + 'taken, one not-taken outcome moves to weakly taken and still predicts taken. That '
        + 'one extra state is the whole difference, and it is why almost every real predictor '
        + 'is built on this counter.',
      '**Accuracy per site is the number that matters; the average is not.** A predictor at '
        + '95% overall may be at 50% on the one branch executing a million times. The table '
        + 'here sorts by misses rather than by address for exactly that reason.',
      '**A branch history table is indexed by address and it aliases.** Two branch sites whose '
        + 'addresses collide share a counter and interfere. More bits of index costs area; '
        + 'fewer costs accuracy; and the aliasing is invisible in the accuracy number unless '
        + 'you look per site.',
      '**A direction is useless without a target, and the target is not known yet either.** A '
        + 'branch target buffer remembers where this address went when it was last taken, so '
        + 'fetch has somewhere to go. It is a cache, it can miss, and a miss costs the same as '
        + 'a mispredicted direction.',
      '**A return-address stack predicts returns almost perfectly, and it is not a target '
        + 'buffer.** A call pushes the address after it; a return pops. So a return is '
        + 'predicted from where its call was rather than from where this return site went last '
        + 'time — which matters enormously, because a function called from twenty places '
        + 'returns to twenty different addresses.',
      '**Recursion deeper than the stack silently stops being free.** The stack has a fixed '
        + 'depth — eight or sixteen entries typically — and beyond it the oldest entry is '
        + 'lost, so the returns from the outermost frames mispredict. That is a real cliff in '
        + 'deeply recursive code and it appears in no profiler as anything but "slower".'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: { title: 'Interactive demo — four predictors, four patterns, per-site accuracy',
        markup: root.PredictorBasicsTemplate.render() },
      diagram: diagram(),
      insight: insight()
    };
  }

  function insight() {
    return '**The return-address stack is the clearest example in computer architecture of a '
      + 'predictor that works because it exploits structure rather than statistics, and the '
      + 'difference in outcome is enormous.** A branch target buffer predicts a return by '
      + 'remembering where this return instruction went last time, which is wrong every time '
      + 'the function is called from somewhere new — and a function worth having is called '
      + 'from many places. A return-address stack predicts it from where the matching call '
      + 'was, which is right essentially always, because calls and returns nest. That is not a '
      + 'better statistical model of the same data; it is a different mechanism that knows '
      + 'something about the program\'s structure. The lesson generalises directly to caching '
      + 'and prefetching in software: a predictor that has been told the shape of the access '
      + 'pattern beats one that has to infer it, and by a margin no amount of history will '
      + 'close. It also has a sharp edge worth knowing about. The stack is a fixed depth, so '
      + 'recursion deeper than it silently loses the outer frames and the returns start '
      + 'mispredicting — a performance cliff that shows up in no profiler as anything more '
      + 'informative than "this got slower", and one of the real reasons deep recursion is '
      + 'discouraged in performance-critical code.';
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({
      controls: root.PredictorBasicsTemplate.controls,
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

  const traceFor = root.Helpers.memoise(function (name) {
    return Traces.build(name);
  });

  const resultFor = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);

    return Predictors.evaluate(parts.kind, traceFor(parts.trace));
  });

  /** The factorial, run on the pipeline with and without a return-address
   *  stack, so the claim about returns is measured on a real program rather
   *  than asserted from a trace. */
  const recursion = root.Helpers.memoise(function (depth) {
    const image = Assembler.assemble(Programs.CATALOGUE.factorial.source, { origin: 0 });
    const machine = Pipeline.create({ image: image.bytes, entry: 0, predictor: 'bimodal',
      depth: Number(depth) });

    Pipeline.run(machine, { cycles: 3000, stopOnTrap: true });
    return Pipeline.summary(machine);
  });

  function reading() {
    const values = panel.values();
    const key = JSON.stringify({ kind: values['bpb-predictor'], trace: values['bpb-trace'] });

    return { trace: values['bpb-trace'], kind: values['bpb-predictor'],
      penalty: Number(values['bpb-penalty']), result: resultFor(key) };
  }

  /* --------------------------------------------------------------- render */

  function update(app) {
    const view = reading();

    paintMetrics(view);
    paintSites(view);
    paintTournament(view);
    paintCounters(view);
    paintReturns(view);
    paintCost(view);
    paintChart(app);
  }

  function paintMetrics(view) {
    const result = view.result;
    const sites = View.sites(result);
    const cost = View.costOf(result, { penalty: view.penalty, instructions: 5 * result.seen });
    const withRas = recursion(8);

    root.MetricGrid.update({
      'bpb-accuracy': { value: (100 * result.accuracy).toFixed(1) + '%',
        note: result.correct + ' of ' + result.seen + ' branches' },
      'bpb-misses': { value: result.seen - result.correct, note: result.about },
      'bpb-worst': { value: sites.length ? '0x' + sites[0].pc.toString(16) : 'none',
        note: sites.length ? (100 * sites[0].accuracy).toFixed(1) + '% over ' +
          sites[0].seen + ' executions' : 'no branches in this trace' },
      'bpb-cost': { value: cost.cycles,
        note: cost.misses + ' misses x ' + view.penalty + ' cycles' },
      'bpb-share': { value: (100 * cost.share).toFixed(1) + '%',
        note: 'of a run with a branch every five instructions' },
      'bpb-ras': { value: withRas.predictions,
        note: withRas.mispredicts + ' mispredicted on the recursive factorial' }
    });
  }

  function paintSites(view) {
    fill('bpb-sites', View.sites(view.result).map(function (site) {
      return ['0x' + site.pc.toString(16), site.seen, site.right, site.misses,
        (100 * site.accuracy).toFixed(1) + '%'];
    }));
    root.Helpers.setText('bpb-sites-caption', sitesCaption(view));
  }

  function sitesCaption(view) {
    const sites = View.sites(view.result);

    if (sites.length < 2) {
      return 'One site, so the average and the per-site figure are the same number. Switch to '
        + 'the nested pattern to see them come apart.';
    }
    return 'Sorted by misses rather than by address, because the site at the top is the one '
      + 'worth working on. Overall this predictor is at '
      + (100 * view.result.accuracy).toFixed(1) + '% and its worst site is at '
      + (100 * sites[0].accuracy).toFixed(1) + '% — which is the gap an average hides, and '
      + 'the reason a real profiler reports mispredicts per branch address.';
  }

  function paintTournament(view) {
    fill('bpb-tournament', TRACES.map(function (trace) {
      const cells = KINDS.map(function (kind) {
        const result = resultFor(JSON.stringify({ kind: kind, trace: trace }));

        return (100 * result.accuracy).toFixed(1) + '%';
      });

      return [trace + (trace === view.trace ? ' <-' : '')].concat(cells);
    }));
    root.Helpers.setText('bpb-tournament-caption', 'Read the alternating row first: a per-site '
      + 'counter of either width is at 0%, because "whatever happened last time" is exactly '
      + 'wrong every time. No amount of counter width fixes that — it needs history, which is '
      + 'the next section. The random row is the floor: nothing beats chance on coin flips, '
      + 'and a demo that did not show it could claim anything.');
  }

  function paintCounters(view) {
    const counters = View.counters(view.result, { limit: 8 });

    if (!counters.length) {
      fill('bpb-counters', [['—', 'no state', 'this predictor has no table',
        'nothing changes; it is the same answer every time']]);
      root.Helpers.setText('bpb-counters-caption', 'A static predictor has no state at all, '
        + 'which is its whole appeal: no table, no area, no warm-up. Switch to a one-bit or '
        + 'two-bit predictor to see the counters.');
      return;
    }
    fill('bpb-counters', counters.map(function (row) {
      return [row.index, row.value, row.name,
        row.value >= 3 ? 'stays at 3 — saturated' : 'moves to ' + (row.value + 1)];
    }));
    root.Helpers.setText('bpb-counters-caption', 'The counters after the run. A loop branch '
      + 'sits at 3 and stays there through the exit; an unpredictable one oscillates around 1 '
      + 'and 2 and is wrong about half the time. Watching where a counter settles explains the '
      + 'accuracy above it better than any description of the state machine does.');
  }

  function paintReturns(view) {
    fill('bpb-returns', [
      ['a function called from one place',
        'right after the first call — the site always goes to the same address',
        'right after the first call', 'both work; there is only one answer to remember'],
      ['a function called from twenty places',
        'wrong on nineteen of every twenty returns, because the site changes destination',
        'right every time', 'the stack knows which call this return belongs to'],
      ['recursion within the stack depth', 'wrong on almost every return',
        'right every time', 'calls and returns nest, and a stack is the right shape for nesting'],
      ['recursion deeper than the stack', 'wrong as before',
        'right until the outermost frames, whose entries were pushed out',
        'a fixed depth means the oldest entries are lost, and nothing reports it']
    ]);
    root.Helpers.setText('bpb-returns-caption', 'The second row is the one that decides the '
      + 'design. A function worth having is called from many places, so predicting its return '
      + 'from where this return went last time is close to useless — and a stack, which costs '
      + 'a handful of entries, is close to perfect. The fourth row is its sharp edge, and it '
      + 'is a real performance cliff in deeply recursive code.');
  }

  function paintCost(view) {
    const result = view.result;

    fill('bpb-cost-table', [2, 5, 12, 20].map(function (penalty) {
      const cost = View.costOf(result, { penalty: penalty, instructions: 5 * result.seen });

      return [penalty + ' cycles', cost.cycles, (100 * cost.share).toFixed(1) + '%',
        describeMachine(penalty)];
    }));
    root.Helpers.setText('bpb-cost-table-caption', 'The same predictor, the same accuracy, '
      + 'four machines. At a 2-cycle penalty a mediocre predictor is a rounding error; at 20 '
      + 'it is a large fraction of runtime. That multiplication is why prediction accuracy '
      + 'became worth an enormous amount of silicon precisely when pipelines got deep, and it '
      + 'is why "98% accurate" is not a finished sentence.');
  }

  function describeMachine(penalty) {
    if (penalty <= 2) return 'this five-stage pipeline, resolving in execute';
    if (penalty <= 5) return 'a modest superscalar, resolving a few stages in';
    if (penalty <= 12) return 'a typical modern out-of-order core';
    return 'the deepest pipelines ever shipped, and the reason they stopped';
  }

  function paintChart(app) {
    const host = root.jQuery('#bpb-chart')[0];

    if (!host) return;
    if (chart) chart.destroy();
    chart = root.ErrorBandView.bars(host, {
      lazyLib: app.lazyLib, height: 260, yLabel: 'accuracy (%)',
      values: TRACES.reduce(function (out, trace) {
        ['one-bit', 'bimodal'].forEach(function (kind, index) {
          const result = resultFor(JSON.stringify({ kind: kind, trace: trace }));

          out.push({ label: trace + ' ' + kind, value: 100 * result.accuracy, series: index });
        });
        return out;
      }, [])
    });
    root.Helpers.setText('bpb-chart-note', 'One bit against two, on each pattern. The nested '
      + 'loop is where the extra state pays: the two-bit counter keeps its prediction through '
      + 'the inner loop\'s exit, and the one-bit counter loses it and then has to relearn on '
      + 'the next entry. On alternating outcomes both are at zero, which no counter width '
      + 'fixes.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
