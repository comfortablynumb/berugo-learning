/**
 * Section: Empirical complexity.
 *
 * Four unlabelled subjects with real implementations behind them. Run the
 * doubling experiment, read the exponent, commit, then reveal. Being wrong
 * once here is worth more than any amount of reading about the method.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'empirical-complexity';

  const SUBJECTS = {
    a: {
      truth: 'Θ(n) — one pass, a running maximum',
      run: function (values) {
        let best = -Infinity;
        for (let i = 0; i < values.length; i += 1) if (values[i] > best) best = values[i];
        return best;
      }
    },
    b: {
      truth: 'Θ(n log n) — sort, then a linear scan',
      run: function (values) {
        const sorted = values.slice().sort(function (x, y) { return x - y; });
        let total = 0;
        for (let i = 0; i < sorted.length; i += 1) total += sorted[i];
        return total;
      }
    },
    c: {
      truth: 'Θ(n²) — every pair, with an early exit that rarely fires',
      run: function (values) {
        let count = 0;
        for (let i = 0; i < values.length; i += 1) {
          for (let j = i + 1; j < values.length; j += 1) {
            if (values[i] + values[j] === -1) return count;
            count += 1;
          }
        }
        return count;
      }
    },
    d: {
      truth: 'Θ(log n) over the same array — binary search, so the input size barely matters',
      run: function (values) {
        let lo = 0;
        let hi = values.length;
        const target = values.length >> 1;
        while (lo < hi) {
          const mid = (lo + hi) >> 1;
          if (values[mid] === target) return mid;
          if (values[mid] < target) lo = mid + 1; else hi = mid;
        }
        return -1;
      },
      sortedInput: true
    }
  };

  let panel = null;
  let chart = null;
  let lastRows = null;
  let revealed = false;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
    app.state.subscribe('theme', function () { if (chart) chart.redraw(); });
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render({
      sectionId: SECTION_ID,
      orientation: [
        '**You can measure a complexity class without reading the code.** Double the input, ' +
          'measure the cost, and look at the ratio. A Θ(n^k) algorithm gives T(2n)/T(n) → 2^k, so ' +
          'the exponent is log₂ of the ratio. Four minutes of measurement settles arguments a code ' +
          'review cannot.',
        'Two independent readings are shown: the ratio table, and a least-squares fit over a basis ' +
          'of candidate curves. When they agree, the reading is solid. When they disagree, the ' +
          'measurement is telling you something about itself.',
        'Pick a subject, run the experiment, decide what it is, and only then reveal the answer.'
      ],
      demo: { title: 'Interactive demo — identify the class from measurements', markup: root.EmpiricalComplexityTemplate.render() },
      diagram: {
        title: 'Diagram — the doubling method, and its failure checks',
        caption: 'Every step can lie; the checks are what make the reading trustworthy.',
        definition: [
          'flowchart TD',
          '    A["choose sizes: n, 2n, 4n, …"] --> B["generate input<br/>(check the generator is not itself quadratic)"]',
          '    B --> C["warm up, then measure a median"]',
          '    C --> D["consume the result<br/>(or it may be optimised away)"]',
          '    D --> E["ratio T(2n)/T(n)"]',
          '    E --> F{"ratios stable?"}',
          '    F -->|yes| G["exponent = log2(ratio)"]',
          '    F -->|no| H["too small, too noisy, or not yet asymptotic"]'
        ].join('\n')
      },
      insight: 'A doubling table settles arguments that a code review cannot, and it takes four ' +
        'minutes. The discipline is to check the failure modes first: a warm cache, a result that ' +
        'was optimised away, or an input generator that is itself the bottleneck.'
    }));

    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.EmpiricalComplexityTemplate.controls,
      onChange: function (id) {
        if (id === 'emp-measure') measure(app);
        if (id === 'emp-reveal') reveal();
        if (id === 'emp-subject') { revealed = false; reveal(true); }
      }
    });

    measure(app);
  }

  /*
   * Browser timers are clamped to ~100 µs, so a single pass over a few thousand
   * items measures as either 0 or 100 µs and the ratio table reads "unknown".
   * Each measurement therefore repeats the subject until the unit of work is
   * large enough to time - the same batching 1.9 recommends, applied here.
   */
  function repeatsFor(n) {
    return Math.max(1, Math.round(4e6 / Math.max(1, n)));
  }

  function makeInput(n, sorted) {
    const rng = root.Random.seeded(n + 17);
    const values = [];
    for (let i = 0; i < n; i += 1) values.push(rng.int(n * 4));
    return sorted ? values.sort(function (a, b) { return a - b; }) : values;
  }

  function measure(app) {
    const values = panel.values();
    const subject = SUBJECTS[values['emp-subject']];
    const harness = root.BenchHarness.createHarness({ runs: values['emp-runs'], warmup: 2 });

    const sizes = [];
    let n = values['emp-start'];
    for (let i = 0; i < values['emp-doublings']; i += 1) { sizes.push(n); n *= 2; }

    panel.disable('emp-measure', true);

    const rows = harness.sweep({
      sizes: sizes,
      makeInput: function (size) { return { data: makeInput(size, subject.sortedInput), repeats: repeatsFor(size) }; },
      task: function (unit) {
        let last;
        for (let i = 0; i < unit.repeats; i += 1) last = subject.run(unit.data);
        return last;
      }
    });

    // Report cost per single pass, so the exponent is not distorted by batching.
    rows.forEach(function (row) { row.medianMs = row.medianMs / repeatsFor(row.n); });

    lastRows = rows;
    report(app, rows);
    panel.disable('emp-measure', false);
  }

  function report(app, rows) {
    const points = rows.map(function (row) { return { x: row.n, y: row.medianMs }; });
    const doubling = root.CurveFit.doubling(points);
    const fit = root.CurveFit.fit(points);
    const warnings = rows.reduce(function (all, row) { return all.concat(row.suspicious); }, []);

    root.MetricGrid.update({
      'emp-exponent': {
        value: Number.isFinite(doubling.exponent) ? doubling.exponent.toFixed(2) : '—',
        note: 'log₂ of the last ratios'
      },
      'emp-verdict': { value: doubling.label, note: 'from the ratio table alone' },
      'emp-fit': {
        value: fit.best ? fit.best.label : '—',
        note: fit.best ? 'relative residual ' + fit.best.relative.toFixed(3) : fit.note
      },
      'emp-runner': {
        value: fit.ranked[1] ? fit.ranked[1].label : '—',
        note: fit.ranked[1] ? 'residual ' + fit.ranked[1].relative.toFixed(3) +
          (fit.ranked[1].relative - fit.best.relative < 0.05 ? ' — too close to call' : '') : ''
      },
      'emp-quality': {
        value: warnings.length ? warnings.length + ' warning' + (warnings.length === 1 ? '' : 's') : 'clean',
        note: warnings.length ? warnings[0]
          : 'warm-up, sink and repetition in place; each point batches ' +
            root.Format.exact(repeatsFor(rows[0].n)) + '→' + root.Format.exact(repeatsFor(rows[rows.length - 1].n)) +
            ' passes to clear the clamped timer'
      }
    });

    paintTable(doubling, rows);
    reveal(true);
    draw(app, points, fit);
  }

  function paintTable(doubling, rows) {
    const html = rows.map(function (row, index) {
      const entry = doubling.rows[index - 1];
      return '<tr><td class="mono">' + row.n + '</td>' +
        '<td class="mono">' + root.Format.duration(row.medianMs) + '</td>' +
        '<td class="mono">' + (entry ? entry.ratio.toFixed(2) : '—') + '</td>' +
        '<td class="mono">' + (entry ? entry.exponent.toFixed(2) : '—') + '</td></tr>';
    }).join('');
    root.jQuery('#emp-table tbody').html(html);
  }

  function reveal(keepHidden) {
    if (!keepHidden) revealed = true;
    const subject = SUBJECTS[panel.values()['emp-subject']];
    root.MetricGrid.update({
      'emp-truth': {
        value: revealed ? 'revealed' : 'hidden',
        note: revealed ? subject.truth : 'commit to a reading first, then press reveal'
      }
    });
  }

  function draw(app, points, fit) {
    const series = [{ label: 'measured median', points: points, dots: true }];

    if (fit.best) {
      const candidate = root.CurveFit.basis.find(function (entry) { return entry.name === fit.best.name; });
      series.push({
        label: 'fit: ' + fit.best.label,
        dashed: true,
        points: points.map(function (point) {
          return { x: point.x, y: Math.max(1e-6, fit.best.coefficient * candidate.fn(point.x)) };
        })
      });
    }

    chart = root.GrowthPlot.render(root.jQuery('#emp-chart')[0], {
      lazyLib: app.lazyLib,
      height: 250,
      logX: true,
      logY: true,
      series: series,
      xLabel: 'n (log)',
      yLabel: 'median ms (log)',
      legendHost: root.jQuery('#emp-legend')[0],
      summary: function () {
        return 'Measured medians against input size on log-log axes; a straight line means a power ' +
          'law, and its slope is the exponent.';
      }
    });
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
