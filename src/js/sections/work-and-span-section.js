/**
 * Section: parallel models and work-span analysis.
 *
 * The demo records a real dependency graph and schedules it greedily, so the
 * time column is a schedule rather than Brent's formula printed back. Two
 * facts fall out of that and both are worth having. The measured schedule is
 * always SHORTER than the bound, which is what an upper bound is for. And the
 * time stops falling exactly at the span — at 256 processors the work-efficient
 * scan takes 17 steps, its span, and adding processors does nothing at all.
 *
 * The comparison between the two parallel scans is the other half. Blelloch's
 * is 2n work and 2 log n span; Hillis–Steele is n log n work and log n span.
 * On a machine with processors to spare the second is faster; on one without,
 * it pays that extra factor in full. Neither is better — they are different
 * points on a trade, and the schedule table shows exactly where the crossover
 * is.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'work-and-span';
  let panel = null;
  let chart = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — the up-sweep and down-sweep that make a prefix sum parallel',
      caption: 'A prefix sum looks inherently sequential: each output needs the one before it. ' +
        'The up-sweep builds a reduction tree — every internal node holds the sum of its subtree ' +
        '— in n − 1 additions and log n levels. The down-sweep then walks the same tree back ' +
        'down, handing each node the sum of everything to its left, in another n − 1 additions ' +
        'and log n levels. Total work 2n, total span 2 log n: the same work as the sequential ' +
        'loop, and a critical path exponentially shorter. Every parallel compaction, radix sort ' +
        'and sparse matrix operation is built on this, which is why it is called the canonical ' +
        'primitive rather than a trick.',
      definition: [
        'flowchart TD',
        '    subgraph Up["up-sweep: build the reduction tree"]',
        '      A1["a b c d e f g h"] --> A2["_ ab _ cd _ ef _ gh"]',
        '      A2 --> A3["_ _ _ abcd _ _ _ efgh"]',
        '      A3 --> A4["_ _ _ _ _ _ _ abcdefgh"]',
        '    end',
        '    A4 --> Z["set the root to 0"]',
        '    subgraph Down["down-sweep: push partial sums back"]',
        '      Z --> B1["_ _ _ 0 _ _ _ abcd"]',
        '      B1 --> B2["_ 0 _ ab _ abcd _ abcdef"]',
        '      B2 --> B3["0 a ab abc abcd abcde abcdef abcdefg"]',
        '    end'
      ].join('\n')
    };
  }

  function orientationCosts() {
    return [
      '**A parallel algorithm has two costs and only one of them is time.** WORK is the total ' +
        'number of operations, which is what one processor would do. SPAN, or depth, is the ' +
        'longest chain that must happen in order.',
      'Everything else about parallel performance follows from those two numbers and the processor ' +
        'count.',
      '**Brent’s theorem says time on p processors is at most work/p + span, and the second term ' +
        'does not shrink.** No amount of hardware shortens a dependency chain.',
      'An algorithm with linear span will not go faster on more cores however parallel the ' +
        'implementation looks. That is what most "we parallelised it and nothing happened" ' +
        'investigations turn out to be about.',
      '**The demo schedules a recorded dependency graph rather than evaluating the formula.** ' +
        'Every operation is a node with its inputs, a greedy list scheduler runs up to p ready ' +
        'operations per step, and the reported time is the length of that schedule.',
      'It is consistently shorter than Brent’s bound, which is what an upper bound is supposed to ' +
        'be.',
      '**Prefix scan looks inherently sequential and is not, which is why it is the canonical ' +
        'primitive.** The loop is n work and n span.',
      'Blelloch’s up-sweep and down-sweep is 2n work and 2 log n span, which is the same work with ' +
        'an exponentially shorter critical path.',
      'Parallel compaction, radix sort, quicksort partitioning and sparse matrix operations are all ' +
        'built on it.'
    ];
  }

  function orientationCeilings() {
    return [
      '**Work efficiency is a separate property from short span, and the demo separates them.** ' +
        'Hillis–Steele reaches log n span too, and does n log n work, which is a factor of log n ' +
        'more than necessary.',
      'On a machine with a processor per element it is the faster of the two. On a machine with ' +
        'eight, it pays that whole factor and loses.',
      '**The speed-up ceiling is work over span, and it is reached long before the processor count ' +
        'runs out.** At 256 elements the work-efficient scan has 511 work and 17 span, so no ' +
        'schedule beats a speed-up of 30.',
      'The demo shows the measured time flattening at exactly 17 steps while the processor count ' +
        'keeps rising.',
      '**Amdahl and Gustafson answer different questions and are routinely quoted at each other.** ' +
        'Amdahl fixes the problem and asks how fast it goes, so a serial fraction s caps the ' +
        'speed-up at 1/s forever.',
      'Gustafson fixes the TIME and asks how much bigger a problem fits, and that grows without ' +
        'bound.',
      'Both are correct, and which one applies is a question about your workload rather than about ' +
        'the arithmetic.',
      '**Utilisation is the diagnostic that connects them.** A greedy schedule keeps every ' +
        'processor busy while there is ready work, so falling utilisation means the graph has run ' +
        'out of parallelism rather than that the scheduler is bad.',
      'The demo prints it per processor count, and watching it collapse is watching the span become ' +
        'the binding constraint.'
    ];
  }

  function orientation() {
    return orientationCosts().concat(orientationCeilings());
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — three scans, a real schedule, and the span as a floor',
        markup: root.WorkAndSpanTemplate.render()
      },
      diagram: diagram(),
      insight: '**Compute the span before buying cores.** Work over span is the maximum speed-up ' +
        'any scheduler can reach, and it is a property of the algorithm rather than of the ' +
        'machine. So it can be worked out on paper before a line of parallel code is written. ' +
        'When it is small the answer is a different algorithm, not more hardware, and the ' +
        'restructuring is usually the same move every time: turn a sequential accumulation into ' +
        'a tree. The second thing to check is that the work did not grow while the span shrank. ' +
        'A method with a shorter critical path and a factor of log n more work is faster only ' +
        'when there are processors to absorb it. On the machine you actually have it is often ' +
        'slower than the loop it replaced.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.WorkAndSpanTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const scanFor = root.Helpers.memoise(function (key) {
    return root.ModelLab.scanStudy({ n: Number(key) });
  });

  const speedupFor = root.Helpers.memoise(function () {
    return root.ModelLab.speedupStudy({});
  });

  function update(app) {
    const values = panel.values();
    const scans = scanFor(values['wsp-n']);
    const speedups = speedupFor('');

    paintMetrics(scans, speedups, Number(values['wsp-serial']));
    paintChart(app, scans);
    paintScans(scans);
    paintBrent(scans);
    paintAmdahl(speedups, Number(values['wsp-serial']));
  }

  function blellochRow(scans) {
    return scans.rows.filter(function (row) { return row.name.indexOf('blelloch') === 0; })[0];
  }

  function paintMetrics(scans, speedups, serial) {
    const row = blellochRow(scans);
    const amdahl = speedups.rows.filter(function (entry) { return entry.serial === serial; })[0] ||
      speedups.rows[0];

    root.MetricGrid.update({
      'wsp-work': { value: root.Format.exact(row.work),
        note: 'the work-efficient scan over ' + root.Format.exact(scans.n) +
          ' elements — about 2n' },
      'wsp-span': { value: root.Format.exact(row.span),
        note: 'about 2·log₂(' + root.Format.exact(scans.n) + ') = ' +
          root.Format.fixed(2 * scans.logN, 0) },
      'wsp-ceiling': { value: root.Format.fixed(row.work / row.span, 1) + '×',
        note: 'no scheduler beats this, on any number of processors' },
      'wsp-amdahl': { value: root.Format.fixed(amdahl.ceiling, 0) + '×',
        note: 'at a serial fraction of ' + root.Format.percent(serial, 1) +
          ', however many processors' }
    });
  }

  function paintChart(app, scans) {
    const host = root.jQuery('#wsp-chart')[0];
    if (!host) return;
    if (chart) chart.destroy();

    const blelloch = blellochRow(scans);
    chart = root.ErrorBandView.curve(host, {
      lazyLib: app.lazyLib, height: 250, logX: true, logY: true, yMin: 1,
      xLabel: 'processors (log scale)', yLabel: 'schedule length (log scale)',
      series: scans.rows.map(function (row) {
        return { label: row.name, points: row.schedules.map(function (entry) {
          return { x: entry.p, y: entry.time };
        }) };
      }).concat([
        { label: 'the work-efficient span (a floor)', dashed: true,
          points: scans.processors.map(function (p) { return { x: p, y: blelloch.span }; }) }
      ])
    });

    const last = blelloch.schedules[blelloch.schedules.length - 1];
    root.Helpers.setText('wsp-chart-note',
      'Each line is a greedy schedule of a recorded dependency graph, so the y axis is a ' +
      'measured schedule length rather than a formula. The sequential scan is flat: its span ' +
      'equals its work, so processors do nothing for it at all. The work-efficient scan falls ' +
      'until it reaches the dashed line at ' + root.Format.exact(blelloch.span) + ' steps and ' +
      'then stops — at ' + root.Format.exact(last.p) + ' processors it takes ' +
      root.Format.exact(last.time) + ', and a thousand more would take the same. That floor is ' +
      'the span, and it is the only thing in this plot that is a property of the algorithm ' +
      'rather than of the machine.');
  }

  function paintScans(scans) {
    const loop = scans.rows[0];

    root.jQuery('#wsp-scans tbody').html(scans.rows.map(function (row) {
      return '<tr><td>' + row.name + '</td><td class="mono">' + root.Format.exact(row.work) +
        '</td><td class="mono">' + root.Format.exact(row.span) + '</td><td class="mono">' +
        root.Format.fixed(row.work / row.span, 1) + '×</td><td class="mono">' +
        (row.correct === null ? '—' : (row.correct ? 'yes' : 'NO')) + '</td><td class="mono">' +
        root.Format.fixed(row.work / loop.work, 2) + '×</td></tr>';
    }).join(''));

    const blelloch = blellochRow(scans);
    const hillis = scans.rows[2];
    root.Helpers.setText('wsp-scans-note',
      'The sequential loop has span equal to work, which is what "inherently sequential" would ' +
      'mean if it were true. Blelloch’s scan does ' +
      root.Format.fixed(blelloch.work / loop.work, 2) + ' times the work with a span of ' +
      root.Format.exact(blelloch.span) + ' instead of ' + root.Format.exact(loop.span) +
      ' — a constant factor of work for an exponential reduction in depth. Hillis–Steele goes ' +
      'further on span, reaching ' + root.Format.exact(hillis.span) + ', and pays ' +
      root.Format.fixed(hillis.work / loop.work, 2) + ' times the work to get there. Neither is ' +
      'better in the abstract: the fourth column is the speed-up ceiling and the last is the ' +
      'price, and which matters depends entirely on how many processors are available.');
  }

  function paintBrent(scans) {
    const row = blellochRow(scans);

    root.jQuery('#wsp-brent tbody').html(row.schedules.map(function (entry) {
      return '<tr><td class="mono">' + root.Format.exact(entry.p) + '</td><td class="mono">' +
        root.Format.exact(entry.time) + '</td><td class="mono">' +
        root.Format.exact(entry.brent) + '</td><td class="mono">' +
        root.Format.fixed(entry.speedup, 2) + '×</td><td class="mono">' +
        root.Format.percent(entry.utilisation, 1) + '</td><td class="mono">' +
        root.Format.fixed(entry.time / row.span, 2) + '×</td></tr>';
    }).join(''));

    const first = row.schedules[0];
    const last = row.schedules[row.schedules.length - 1];
    root.Helpers.setText('wsp-brent-note',
      'The measured time is below Brent’s bound in every row — ' +
      root.Format.exact(first.time) + ' against ' + root.Format.exact(first.brent) +
      ' at one processor and ' + root.Format.exact(last.time) + ' against ' +
      root.Format.exact(last.brent) + ' at ' + root.Format.exact(last.p) + ' — which is what an ' +
      'upper bound is for. Read the utilisation column downwards: it starts at 100% and falls ' +
      'to ' + root.Format.percent(last.utilisation, 1) + ', and every point of that fall is the ' +
      'graph running out of ready work rather than the scheduler doing badly. The last column ' +
      'reaches 1.00 exactly, which is the span being attained and the point past which more ' +
      'processors are wasted.');
  }

  function paintAmdahl(speedups, serial) {
    root.jQuery('#wsp-ceilings tbody').html(speedups.rows.map(function (row) {
      const at = function (p) {
        const entry = row.amdahl.filter(function (item) { return item.p === p; })[0];
        return entry ? root.Format.fixed(entry.speedup, 1) : '—';
      };
      const gust = row.gustafson[row.gustafson.length - 1];
      const mark = row.serial === serial ? ' ●' : '';
      return '<tr><td class="mono">' + root.Format.percent(row.serial, 1) + mark +
        '</td><td class="mono">' + root.Format.fixed(row.ceiling, 0) + '×</td><td class="mono">' +
        at(8) + '</td><td class="mono">' + at(32) + '</td><td class="mono">' + at(128) +
        '</td><td class="mono">' + at(1024) + '</td><td class="mono">' +
        root.Format.fixed(gust.speedup, 0) + '×</td></tr>';
    }).join(''));

    const worst = speedups.rows[speedups.rows.length - 1];
    root.Helpers.setText('wsp-ceilings-note',
      'The second column is the ceiling and nothing in the row can pass it. At a serial fraction ' +
      'of ' + root.Format.percent(worst.serial, 0) + ' the ceiling is ' +
      root.Format.fixed(worst.ceiling, 0) + '×, so 1 024 processors deliver ' +
      root.Format.fixed(worst.amdahl[worst.amdahl.length - 1].speedup, 1) + '× and the other ' +
      'thousand are idle. The last column is Gustafson on the same fraction and it reads ' +
      root.Format.fixed(worst.gustafson[worst.gustafson.length - 1].speedup, 0) + '× — not a ' +
      'contradiction, a different question. Amdahl asks how much faster a FIXED problem runs; ' +
      'Gustafson asks how much BIGGER a problem fits in the same time. Quoting one at the other ' +
      'is the standard mistake, and the answer to "which applies to us" is whether the work ' +
      'grows when the machine does.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
