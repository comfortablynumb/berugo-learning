/**
 * Section: divide and conquer.
 *
 * Three instances, one shape, and the combine step doing all the work in every
 * one of them. Karatsuba is the headline because its improvement is a single
 * algebraic identity and its counter moves visibly; closest pair and inversion
 * counting are there because they make the same point about a different kind
 * of combine, and because both have a cheap brute-force oracle.
 *
 * Every ratio on this page is a measurement divided by a measurement. The
 * n^1.585 column is the prediction, and the gap between it and the measured
 * count is itself a result: the recursion's own additions and the odd-sized
 * splits cost about 1.7× the idealised product count.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'divide-and-conquer';
  let panel = null;
  let chart = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
    app.state.subscribe('theme', function () {
      if (chart) chart.redraw();
    });
  }

  function diagram() {
    return {
      title: 'Diagram — Karatsuba\'s three products',
      caption: 'Four half-size products are the obvious split. The middle term ad + bc is recoverable from ' +
        '(a+b)(c+d) minus the two products already computed, so three suffice - and that single subtraction ' +
        'is the whole difference between n² and n^1.585.',
      definition: [
        'flowchart TD',
        '    X["(a·B + b) × (c·B + d)"] --> P1["ac — the high product"]',
        '    X --> P2["bd — the low product"]',
        '    X --> P3["(a+b)(c+d) — the middle product"]',
        '    P3 --> M["ad + bc = P3 − ac − bd"]',
        '    P1 --> R["ac·B² + (ad+bc)·B + bd"]',
        '    M --> R',
        '    P2 --> R'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'Divide and conquer is usually stated as split, solve, combine, with the combine step treated as ' +
          'bookkeeping. It is the opposite: splitting is trivial in every algorithm here, and the combine step ' +
          'is where the algorithm lives. Merge sort\'s merge, closest pair\'s strip, Karatsuba\'s subtraction ' +
          'and Strassen\'s seven products are all the same slot in the same template, and all four are the ' +
          'part that had to be invented.',
        'Karatsuba multiplies two n-digit numbers with three half-size products instead of four, because the ' +
          'middle term is recoverable by subtraction: (a+b)(c+d) − ac − bd. That gives T(n) = 3T(n/2) + O(n), ' +
          'which is n^log₂3 ≈ n^1.585. Measured on 1 024-digit operands the schoolbook algorithm does ' +
          '1 048 576 digit products and Karatsuba does 99 958 - a factor of 10.5 - and both answers agree ' +
          'with BigInt exactly.',
        'The exponent decides the algorithm and measurement decides the threshold. At 4 digits Karatsuba does ' +
          '14 products against schoolbook\'s 16, and once the recursion\'s own additions are counted it is ' +
          'slower there. Every bignum library therefore switches to schoolbook below a cutoff in the tens of ' +
          'digits, and the cutoff is tuned per machine rather than derived. The cutoff slider is that ' +
          'decision, and it moves the measured counts rather than a model of them.'
      ],
      demo: {
        title: 'Interactive demo — three instances, and the oracle for each',
        markup: root.DivideAndConquerTemplate.render()
      },
      diagram: diagram(),
      insight: 'The asymptotics tell you which algorithm and the measurement tells you where to switch to it. ' +
        'That split is not special to multiplication: Strassen beats the triple loop on paper at every size ' +
        'and beats it in practice somewhere in the hundreds, closest pair beats the quadratic scan at a few ' +
        'dozen points, and in both cases the crossover moves with the cache and the constant. The failure ' +
        'mode is shipping the asymptotically better algorithm without measuring, and discovering that every ' +
        'real input is on the wrong side of the crossover.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.DivideAndConquerTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  function operands(n, seed) {
    let state = (seed || 3) >>> 0;
    const a = [];
    const b = [];
    for (let i = 0; i < n; i += 1) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      a.push(state % 10);
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      b.push(state % 10);
    }
    a[n - 1] = Math.max(1, a[n - 1]);
    b[n - 1] = Math.max(1, b[n - 1]);
    return { a: a, b: b };
  }

  const multiplyFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|').map(Number);
    const pair = operands(parts[0], 3);
    const fast = root.Karatsuba.karatsuba(pair.a, pair.b, { threshold: parts[1] });
    const slow = root.Karatsuba.schoolbook(pair.a, pair.b, {});
    return {
      n: parts[0], threshold: parts[1], fast: fast, slow: slow,
      agrees: root.Karatsuba.toBigInt(fast.digits) === root.Karatsuba.toBigInt(slow.digits)
    };
  });

  const crossoverFor = root.Helpers.memoise(function (key) {
    return root.Karatsuba.crossover({ threshold: Number(key), seed: 3 });
  });

  const pointsFor = root.Helpers.memoise(function (key) {
    const n = Number(key);
    let state = 11;
    const points = [];
    for (let i = 0; i < n; i += 1) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      const x = state % 1000000;
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      points.push({ x: x / 1000, y: (state % 1000000) / 1000 });
    }
    const fast = root.ClosestPair.closestPair(points, {});
    const slow = root.ClosestPair.bruteForce(points, {});
    return { n: n, fast: fast, slow: slow };
  });

  const inversionsFor = root.Helpers.memoise(function (key) {
    const n = Number(key);
    let state = 17;
    const values = [];
    for (let i = 0; i < n; i += 1) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      values.push(state % 100000);
    }
    return { n: n, fast: root.ClosestPair.countInversions(values), naive: root.ClosestPair.countInversionsNaive(values) };
  });

  const strassenFor = root.Helpers.memoise(function (key) {
    const side = Number(key);
    let state = 23;
    function matrix() {
      const out = [];
      for (let i = 0; i < side; i += 1) {
        const row = [];
        for (let j = 0; j < side; j += 1) {
          state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
          row.push(((state % 2001) - 1000) / 100);
        }
        out.push(row);
      }
      return out;
    }
    const a = matrix();
    const b = matrix();
    return {
      side: side,
      cubic: root.Strassen.cubic(a, b, {}),
      fast: root.Strassen.strassen(a, b, { cutoff: 1 }),
      error: root.Strassen.errorAgainstCubic(a, b, { cutoff: 1 })
    };
  });

  function update(app) {
    const values = panel.values();
    const run = multiplyFor(values['dnc-digits'] + '|' + values['dnc-threshold']);

    paintMetrics(run);
    paintCrossover(values, run);
    paintInstances(values);
    paintStrassen(values);
    drawChart(app, crossoverFor(values['dnc-threshold']));
  }

  function paintMetrics(run) {
    root.MetricGrid.update({
      'dnc-products': {
        value: root.Format.exact(run.fast.report.digitProducts),
        note: root.Format.exact(run.fast.report.calls) + ' recursive calls, ' +
          root.Format.exact(run.fast.report.baseCases) + ' reaching the cutoff'
      },
      'dnc-school': {
        value: root.Format.exact(run.slow.report.digitProducts),
        note: run.n + ' × ' + run.n + ' on the same operands'
      },
      'dnc-ratio': {
        value: root.Format.fixed(run.slow.report.digitProducts / Math.max(1, run.fast.report.digitProducts), 2) + '×',
        note: run.agrees ? 'and both agree with BigInt exactly' : 'THE TWO ANSWERS DISAGREE'
      },
      'dnc-depth': {
        value: root.Format.exact(run.fast.report.maxDepth),
        note: 'log₂ ' + run.n + ' = ' + root.Format.fixed(Math.log2(run.n), 1) + ' levels above the cutoff'
      }
    });
  }

  function paintCrossover(values, run) {
    const rows = crossoverFor(values['dnc-threshold']);
    const html = rows.map(function (row) {
      return '<tr><td class="mono">' + root.Format.exact(row.n) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.schoolbook) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.karatsuba) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.ratio, 2) + '×</td>' +
        '<td class="mono">' + root.Format.exact(Math.round(row.predicted)) + '</td>' +
        '<td class="mono">' + (row.agrees ? 'yes' : 'NO') + '</td></tr>';
    }).join('');

    root.jQuery('#dnc-crossover tbody').html(html);
    root.jQuery('#dnc-crossover-note').text('The ratio column is the exponent doing its work: it is not a ' +
      'constant, it grows with n, which is what an asymptotic improvement looks like in a table. The n^1.585 ' +
      'column is the idealised product count and the measurement sits about 1.7× above it, because the ' +
      'recursion also pays for its own additions and for splits that are not exactly halves. Raise the cutoff ' +
      'and the small sizes collapse onto schoolbook - which is what a real library does, at ' +
      'threshold ' + values['dnc-threshold'] + ' here and around 30 to 100 digits in production. The current ' +
      'operand pair is ' + root.Format.exact(run.n) + ' digits.');
  }

  function paintInstances(values) {
    const closest = pointsFor(values['dnc-points']);
    const inversions = inversionsFor(values['dnc-points']);
    const agree = Math.abs(closest.fast.pair.distance - closest.slow.pair.distance) < 1e-12;

    const rows = [
      {
        label: 'closest pair of ' + root.Format.exact(closest.n) + ' points',
        fast: closest.fast.report.distanceChecks, slow: closest.slow.report.distanceChecks,
        agrees: agree
      },
      {
        label: 'inversions in ' + root.Format.exact(inversions.n) + ' values',
        fast: inversions.fast.comparisons, slow: inversions.n * (inversions.n - 1) / 2,
        agrees: inversions.fast.inversions === inversions.naive
      }
    ];

    const html = rows.map(function (row) {
      return '<tr><td>' + row.label + '</td>' +
        '<td class="mono">' + root.Format.exact(row.fast) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.slow) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.slow / Math.max(1, row.fast), 1) + '×</td>' +
        '<td class="mono">' + (row.agrees ? 'yes' : 'NO') + '</td></tr>';
    }).join('');

    root.jQuery('#dnc-instances tbody').html(html);
    root.jQuery('#dnc-instances-note').text('Both rows are counted in the operation the algorithm is about - ' +
      'distance computations and comparisons - and both are checked against a quadratic oracle, because a ' +
      'closest-pair bug returns a plausible pair and an inversion-count bug returns a plausible number. The ' +
      'longest run of strip comparisons per point in this instance was ' +
      root.Format.exact(closest.fast.report.worstStripRun) + ', against the textbook bound of seven: the ' +
      'bound is worst-case and the measurement is what actually happens.');
  }

  function paintStrassen(values) {
    const run = strassenFor(values['dnc-matrix']);
    const cubic = run.cubic.report.scalarProducts;
    const fast = run.fast.report.scalarProducts;

    const html = '<tr><td class="mono">' + run.side + '</td>' +
      '<td class="mono">' + root.Format.exact(cubic) + '</td>' +
      '<td class="mono">' + root.Format.exact(fast) + '</td>' +
      '<td class="mono">' + root.Format.fixed(cubic / Math.max(1, fast), 2) + '×</td>' +
      '<td class="mono">' + run.error.worstAbsolute.toExponential(2) + '</td>' +
      '<td class="mono">' + run.error.relative.toExponential(2) + '</td></tr>';

    root.jQuery('#dnc-strassen tbody').html(html);
    root.jQuery('#dnc-strassen-note').text('At side ' + run.side + ' the cubic algorithm does ' +
      root.Format.exact(cubic) + ' scalar products and Strassen does ' + root.Format.exact(fast) +
      ' — exactly 7^k against 8^k, since the recursion here runs to 1×1. The last two columns are the caveat ' +
      'as a number rather than a warning: the block additions cancel, so the error bound involves the norms ' +
      'of the whole matrices rather than of the entries that produced each result. The relative disagreement ' +
      'here is ' + run.error.relative.toExponential(1) + ', which is small and is not zero, and in an ' +
      'ill-conditioned problem it is the difference between a usable answer and a wrong one.');
  }

  function drawChart(app, rows) {
    chart = root.ErrorBandView.curve(root.jQuery('#dnc-chart')[0], {
      lazyLib: app.lazyLib,
      height: 260,
      logY: true,
      legendHost: root.jQuery('#dnc-chart-legend')[0],
      xLabel: 'digits per operand',
      yLabel: 'digit products (log scale)',
      series: [
        { label: 'schoolbook (n²)', dashed: true,
          points: rows.map(function (row) { return { x: row.n, y: row.schoolbook }; }) },
        { label: 'Karatsuba (measured)', width: 3,
          points: rows.map(function (row) { return { x: row.n, y: row.karatsuba }; }) },
        { label: 'n^1.585', dashed: true,
          points: rows.map(function (row) { return { x: row.n, y: row.predicted }; }) }
      ]
    });

    root.jQuery('#dnc-chart-note').text('On log axes an asymptotic difference is a difference of slope, and ' +
      'that is the only reliable way to read one off a chart. The schoolbook line has slope 2, the Karatsuba ' +
      'line and the n^1.585 reference have slope 1.585, and the vertical gap between the last two is the ' +
      'constant the recursion pays for its own additions — a shift, not a bend.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
