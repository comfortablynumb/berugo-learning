/**
 * Section: choosing a cost model.
 *
 * The demo puts four predictions of one workload in one table and they differ
 * by four orders of magnitude — a million comparisons, ten thousand cache
 * misses, four thousand block transfers, two hundred and fifty-six dependent
 * steps. All four are correct arithmetic and at most one of them predicts the
 * runtime. Which one does is a property of where the data sits and how many
 * processors are free, and it is decidable before any code is written.
 *
 * The second table is the one to use at work: four access patterns measured
 * against the same cache, with the bytes fetched next to the bytes used. A
 * random probe fetching fifty-six bytes for every eight it needs is not a
 * profiling result, it is an arithmetic consequence of the line size, and no
 * amount of optimising the inner loop touches it.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'choosing-a-cost-model';
  let panel = null;
  let chart = null;

  const CHECKLIST = [
    { question: 'Does the working set fit in cache?',
      yes: 'the RAM model predicts well; count operations',
      no: 'count cache misses, and look at the layout before the loop',
      how: 'working-set size against the cache size, or a miss-rate counter' },
    { question: 'Does the data fit in memory?',
      yes: 'stay with the cache-aware model',
      no: 'count block transfers; the algorithm choice changes, not just its constants',
      how: 'input size against available RAM, minus everything else on the machine' },
    { question: 'Is the access pattern blockwise or random?',
      yes: 'blockwise — the transfer count is size over block size',
      no: 'random — the transfer count is one per access, a factor of B worse',
      how: 'bytes fetched divided by bytes used, which the demo measures' },
    { question: 'Are there processors with nothing to do?',
      yes: 'span bounds the speed-up; compute work over span before buying cores',
      no: 'the parallel model predicts nothing useful; work is what costs',
      how: 'utilisation under load, not core count on the invoice' },
    { question: 'Is the bottleneck off the machine entirely?',
      yes: 'count round trips; none of the four models here applies',
      no: 'one of the four applies, and the questions above say which',
      how: 'time in system calls and network waits against time on the CPU' }
  ];

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — from a workload’s shape to the model that predicts it',
      caption: 'Each branch is answerable before writing code, from two numbers you already ' +
        'have: the size of the working set and the size of the machine. The order matters — ' +
        'asking about parallelism before asking where the data sits produces a beautifully ' +
        'parallel algorithm that is bound by transfers and does not speed up. The last branch ' +
        'is the one that catches most real systems: when the time is going into round trips, ' +
        'every model on this page predicts a quantity that is not the bottleneck, and the ' +
        'honest answer is that none of them applies.',
      definition: [
        'flowchart TD',
        '    A{"where does the time go?"} -- "off the machine" --> N["count round trips<br/>none of these models applies"]',
        '    A -- "on the machine" --> B{"does the data fit in memory?"}',
        '    B -- "no" --> C["external memory:<br/>count block transfers"]',
        '    B -- "yes" --> D{"does the working set fit in cache?"}',
        '    D -- "no" --> E["cache-aware:<br/>count misses, fix the layout"]',
        '    D -- "yes" --> F{"are there idle processors?"}',
        '    F -- "yes" --> G["parallel:<br/>count span, then work"]',
        '    F -- "no" --> H["RAM:<br/>count operations"]'
      ].join('\n')
    };
  }

  function orientationModels() {
    return [
      '**Every model in this milestone counts something different, and at most one of them ' +
        'predicts your runtime.** The demo makes four predictions of the same sort and they ' +
        'differ by four orders of magnitude.',
      'All four are correct arithmetic. Three of them are answers to questions nobody asked.',
      '**The RAM model predicts well exactly when the working set fits in cache.** Then every ' +
        'access really does cost the same, comparison counts really do rank algorithms, and the ' +
        'analysis in every textbook applies.',
      'That is a large and important region, and it is most of what runs inside a single request.',
      'The mistake is not using it. The mistake is using it outside that region.',
      '**Once the working set leaves the cache, the layout matters more than the algorithm.** A ' +
        'miss costs a hundred or so instructions, so a loop with a bad access pattern is dominated ' +
        'by the pattern.',
      'The demo measures four patterns against one cache, and the miss rates run from 12.5% to ' +
        '100% on the same number of useful bytes.',
      '**Once the data leaves memory, the algorithm changes rather than its constants.** A hash ' +
        'join is optimal in the RAM model and terrible once the table spills, because every probe ' +
        'is a random block.',
      'The external-memory model is what a query planner uses, and it is why a planner’s decisions ' +
        'look wrong from a RAM-model point of view.'
    ];
  }

  function orientationChoosing() {
    return [
      '**The parallel model applies only when there are processors with nothing to do, and it ' +
        'binds on span rather than on count.** Work over span is the ceiling on speed-up, it is a ' +
        'property of the algorithm, and it is computable on paper.',
      'An algorithm with linear span does not go faster on more cores, no matter how the ' +
        'implementation looks.',
      '**Bytes fetched over bytes used is the single most useful diagnostic here.** A random probe ' +
        'over eight-byte values on a sixty-four-byte line fetches eight times what it uses, and ' +
        'that ratio is arithmetic rather than a profiling result.',
      'It tells you immediately whether the fix is a better loop or a different layout.',
      '**Measure the resource that binds before optimising anything.** The order of the questions ' +
        'matters.',
      'Asking about parallelism before asking where the data sits produces a beautifully parallel ' +
        'algorithm that is bound by transfers and does not speed up. The demo’s checklist is in ' +
        'the order that avoids that.',
      '**And validate the model against a measurement, because a model that is not checked is a ' +
        'preference.** The demo runs the external-memory prediction against a real simulated sort ' +
        'and they agree exactly.',
      'That agreement is what licenses using the formula for sizes too large to run.',
      'A model nobody has ever compared against reality is a confident, precise, useless prediction.'
    ];
  }

  function orientation() {
    return orientationModels().concat(orientationChoosing());
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — four predictions, one measurement, and the binding resource',
        markup: root.ChoosingACostModelTemplate.render()
      },
      diagram: diagram(),
      insight: '**The highest-value analytical skill in this whole milestone is knowing which ' +
        'cost model applies before optimising, because the wrong model produces confident, ' +
        'precise, useless predictions.** It costs two numbers, the size of the working set and ' +
        'the size of the machine, and it changes what you do rather than how well you do it. ' +
        'The failure it prevents is specific and common. A team profiles the inner loop, ' +
        'optimises the comparison count and ships a 15% improvement. The workload was bound by ' +
        'block transfers the whole time, where the available win was a factor of B. Ask where ' +
        'the data sits first. Everything else in this milestone is a technique for one of the ' +
        'answers.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.ChoosingACostModelTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const bakeFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.ModelLab.bakeOff({ n: Number(parts[0]), M: Number(parts[1]) });
  });

  const bindingFor = root.Helpers.memoise(function (key) {
    return root.ModelLab.bindingResource({ lines: Number(key) });
  });

  function update(app) {
    const values = panel.values();
    const bake = bakeFor(values['ccm-records'] + '|' + values['ccm-memory']);
    const binding = bindingFor(values['ccm-cache']);

    paintMetrics(bake, binding);
    paintChart(app, bake);
    paintModels(bake);
    paintBinding(binding);
    paintChecklist();
  }

  function paintMetrics(bake, binding) {
    const values = bake.rows.map(function (row) { return row.prediction; });
    const memoryBound = binding.rows.filter(function (row) { return row.binding === 'memory'; });
    const worst = binding.rows.reduce(function (best, row) {
      const waste = row.bytesFetched / (row.accesses * 8);
      return waste > best.waste ? { waste: waste, row: row } : best;
    }, { waste: 0, row: binding.rows[0] });

    root.MetricGrid.update({
      'ccm-spread': { value: root.Format.fixed(Math.max.apply(null, values) /
        Math.min.apply(null, values), 0) + '×',
        note: 'from ' + root.Format.exact(Math.min.apply(null, values)) + ' to ' +
          root.Format.exact(Math.max.apply(null, values)) + ', on one workload' },
      'ccm-measured': { value: root.Format.exact(bake.measured.transfers),
        note: 'on ' + root.Format.exact(bake.measured.records) + ' records, against a prediction ' +
          'of ' + root.Format.exact(bake.measured.predicted) },
      'ccm-binding': { value: root.Format.exact(memoryBound.length) + ' of ' +
        root.Format.exact(binding.rows.length),
        note: 'measured against a cache of ' + root.Format.exact(binding.rows[0].accesses) +
          ' possible accesses' },
      'ccm-waste': { value: root.Format.fixed(worst.waste, 1) + '×',
        note: worst.row.name + ' — bytes fetched for every byte used' }
    });
  }

  function paintChart(app, bake) {
    const host = root.jQuery('#ccm-chart')[0];
    if (!host) return;
    if (chart) chart.destroy();

    chart = root.ErrorBandView.bars(host, {
      lazyLib: app.lazyLib, height: 250, logY: true,
      xLabel: 'cost model', yLabel: 'predicted cost (log scale)',
      values: bake.rows.map(function (row) {
        return { label: row.model.split(' (')[0], value: Math.max(1, row.prediction) };
      })
    });

    const ram = bake.rows[0];
    const dam = bake.rows[2];
    root.Helpers.setText('ccm-chart-note',
      'Four predictions of sorting ' + root.Format.exact(bake.n) + ' records, on a logarithmic ' +
      'axis because they do not fit on a linear one. The RAM model says ' +
      root.Format.exact(ram.prediction) + ' comparisons; the external-memory model says ' +
      root.Format.exact(dam.prediction) + ' block transfers. Those are not competing estimates ' +
      'of the same quantity — they are counts of different things, in different units, and the ' +
      'bar chart is only meaningful because all four are being used as proxies for one runtime. ' +
      'The question the section is about is which of the four the runtime actually tracks, and ' +
      'the answer is decided by where the data sits rather than by which number is largest.');
  }

  function paintModels(bake) {
    root.jQuery('#ccm-models tbody').html(bake.rows.map(function (row) {
      return '<tr><td>' + row.model + '</td><td>' + row.counts + '</td><td class="mono">' +
        root.Format.exact(row.prediction) + '</td><td class="mono">' + row.unit + '</td><td>' +
        row.rightWhen + '</td></tr>';
    }).join(''));

    root.Helpers.setText('ccm-models-note',
      'The measured column is not in this table on purpose: three of these four predictions ' +
      'cannot be compared against a runtime because they count something else. What CAN be ' +
      'checked is the model against its own simulator, and the external-memory row is: sorting ' +
      root.Format.exact(bake.measured.records) + ' records under the DAM simulator costs ' +
      root.Format.exact(bake.measured.transfers) + ' transfers against a prediction of ' +
      root.Format.exact(bake.measured.predicted) + ', an exact match. That agreement is what ' +
      'licenses using the formula at sizes too large to run, and a model nobody has ever ' +
      'compared against anything is a preference rather than a prediction.');
  }

  function paintBinding(binding) {
    root.jQuery('#ccm-patterns tbody').html(binding.rows.map(function (row) {
      const used = row.accesses * 8;
      return '<tr><td>' + row.name + '</td><td class="mono">' +
        root.Format.exact(row.accesses) + '</td><td class="mono">' +
        root.Format.exact(row.misses) + '</td><td class="mono">' +
        root.Format.percent(row.missRate, 1) + '</td><td class="mono">' +
        root.Format.exact(row.bytesFetched) + '</td><td class="mono">' +
        root.Format.exact(used) + '</td><td class="mono">' +
        root.Format.fixed(row.bytesFetched / used, 1) + '×</td><td class="mono">' +
        row.binding + '</td></tr>';
    }).join(''));

    const sequential = binding.rows[0];
    const random = binding.rows[binding.rows.length - 1];
    root.Helpers.setText('ccm-patterns-note',
      'Four patterns over the same ' + root.Format.exact(binding.n) + '-element array against ' +
      'the same cache. A sequential scan misses on one access in eight — one per cache line — ' +
      'and fetches ' + root.Format.fixed(sequential.bytesFetched / (sequential.accesses * 8), 1) +
      ' bytes for every byte it uses, which is the compulsory minimum. A random probe misses on ' +
      root.Format.percent(random.missRate, 0) + ' and fetches ' +
      root.Format.fixed(random.bytesFetched / (random.accesses * 8), 1) + '×. The strided rows ' +
      'are the interesting ones: once the stride exceeds a line, EVERY access misses however ' +
      'few of them there are, so a loop that touches one field of every struct in an array is ' +
      'paying the full line cost per element. That is a layout problem and no amount of ' +
      'optimising the loop body touches it.');
  }

  function paintChecklist() {
    root.jQuery('#ccm-checklist tbody').html(CHECKLIST.map(function (row) {
      return '<tr><td>' + row.question + '</td><td>' + row.yes + '</td><td>' + row.no +
        '</td><td>' + row.how + '</td></tr>';
    }).join(''));

    root.Helpers.setText('ccm-checklist-note',
      'The order is the point. Asking about parallelism before asking where the data sits ' +
      'produces a beautifully parallel algorithm bound by block transfers, which is a real and ' +
      'expensive failure. Asking about the network last is deliberate too: it is placed at the ' +
      'top of the diagram because when it applies nothing else does, and it is at the bottom of ' +
      'this table because it is the question most teams have already answered. Every row’s last ' +
      'column is a measurement rather than a judgement, and each of them is available in an ' +
      'afternoon.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
