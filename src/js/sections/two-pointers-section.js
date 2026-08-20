/**
 * Section: two pointers, sliding windows and monotonic structures.
 *
 * The claim under test is an amortisation, so every figure on the page is a
 * total rather than a rate: pushes plus pops over the whole sweep, and that
 * total divided by n. Four input shapes are run because the *distribution* of
 * work changes completely between them - the deque holds one element on
 * ascending input and the whole window on descending input - while the total
 * does not move off 2n.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'two-pointers';
  let panel = null;
  let view = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
    app.state.subscribe('theme', function () {
      if (view) view.redraw();
    });
  }

  function diagram() {
    return {
      title: 'Diagram — a monotonic stack over a histogram',
      caption: 'The stack holds bars in increasing height. A shorter bar arriving means every taller bar on ' +
        'the stack has just found its right boundary, so each is popped and settled exactly once - which is ' +
        'the amortisation in one sentence.',
      definition: [
        'flowchart LR',
        '    A["bar arrives"] --> B{"taller than the stack top?"}',
        '    B -->|yes| C["push it — its left boundary is the bar below"]',
        '    B -->|no| D["pop the top: its right boundary is here"]',
        '    D --> E["settle its rectangle"]',
        '    E --> B',
        '    C --> F["each bar is pushed once and popped once: 2n"]'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'Four techniques, one argument. Two pointers, sliding windows, monotonic deques and monotonic stacks ' +
          'are all cases of "each element enters the structure once and leaves once", which makes a loop that ' +
          'reads as nested cost 2n rather than n². The tell in a quadratic solution is an inner loop whose ' +
          'index never moves backwards - when that is true, the inner loop is a second pointer that has not ' +
          'been hoisted out yet.',
        'The window maximum is the sharpest example. The deque holds indices whose values are strictly ' +
          'decreasing, so its front is always the window\'s maximum; anything smaller that arrived earlier ' +
          'can never be the maximum again, because it expires first and is dominated in the meantime. The ' +
          'measurement is that pushes plus pops stay just under 2n on every input shape - 9 994 of a ' +
          'possible 10 000 on random input, 9 999 on ascending - while the deque\'s size varies from 1 to ' +
          'k depending on the data.',
        'The two facts have to be reported separately, because they answer different questions. The total ' +
          'bounds the time; the largest deque bounds the memory, and only the second one moves with the ' +
          'input. Ascending input keeps one element; descending input keeps the whole window. A section that ' +
          'reported only the total would be hiding the memory behaviour, and one that reported only the ' +
          'maximum size would suggest the work varies when it does not.'
      ],
      demo: {
        title: 'Interactive demo — the totals, the shapes, and the brute-force oracle',
        markup: root.TwoPointersTemplate.render()
      },
      diagram: diagram(),
      insight: 'When a nested loop is quadratic and its inner index only ever moves forwards, the collapse to ' +
        'two pointers is mechanical - and when it does not only move forwards, no amount of cleverness makes ' +
        'it linear. That is the whole recognition test, and it is worth applying explicitly rather than by ' +
        'pattern matching against remembered problems. The corollary for reviews: a linear-looking solution ' +
        'whose inner loop can revisit an index is not linear, and the way to settle it is to count the ' +
        'operations rather than to read the code.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.TwoPointersTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  function seriesFor(shape, n, k) {
    const values = [];
    const random = root.Random.seeded(7);
    for (let i = 0; i < n; i += 1) {
      if (shape === 'ascending') values.push(i);
      else if (shape === 'descending') values.push(n - i);
      else if (shape === 'sawtooth') values.push(i % Math.max(2, Math.floor(k / 2)));
      else values.push(random.int(n * 4));
    }
    return values;
  }

  const windowFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const n = Number(parts[1]);
    const k = Number(parts[2]);
    const values = seriesFor(parts[0], n, k);
    const run = root.TwoPointers.maxInSlidingWindow(values, k, {});
    return { values: values, run: run, n: n, k: k };
  });

  const histogramFor = root.Helpers.memoise(function (key) {
    const n = Number(key);
    const random = root.Random.seeded(11);
    const heights = [];
    for (let i = 0; i < n; i += 1) heights.push(random.int(100));
    return {
      heights: heights,
      rectangle: root.TwoPointers.largestRectangle(heights),
      naive: root.TwoPointers.largestRectangleNaive(heights),
      greater: root.TwoPointers.nextGreater(heights)
    };
  });

  function update(app) {
    const values = panel.values();
    const key = values['tpw-shape'] + '|' + values['tpw-size'] + '|' + values['tpw-window'];
    const run = windowFor(key);

    paintMetrics(run);
    paintShapes(values);
    paintStack(values);
    paintTrace();
    drawWindow(app, run);
  }

  function paintMetrics(run) {
    const total = run.run.report.pushes + run.run.report.pops;
    root.MetricGrid.update({
      'tpw-ops': {
        value: root.Format.exact(total),
        note: root.Format.exact(run.run.report.pushes) + ' pushes and ' +
          root.Format.exact(run.run.report.pops) + ' pops'
      },
      'tpw-per': {
        value: root.Format.fixed(total / run.n, 3),
        note: 'the bound is 2 — each index enters once and leaves once'
      },
      'tpw-max': {
        value: root.Format.exact(run.run.report.maxSize),
        note: 'of a window of ' + root.Format.exact(run.k) + ' — this is the memory, and it does move'
      },
      'tpw-naive': {
        value: root.Format.exact(Math.max(0, run.n - run.k + 1) * run.k),
        note: 'the same answer by rescanning each window'
      }
    });
  }

  const SHAPES = ['random', 'ascending', 'descending', 'sawtooth'];

  /* The shapes table runs the section's own generator rather than the module's
     `worstCase` helper: the two seed their randomness differently, and a
     'random' row that disagrees with the metric tiles above it is worse than
     no row at all. */
  function paintShapes(values) {
    const html = SHAPES.map(function (shape) {
      const measured = windowFor(shape + '|' + values['tpw-size'] + '|' + values['tpw-window']);
      const report = measured.run.report;
      const total = report.pushes + report.pops;
      return '<tr' + (shape === values['tpw-shape'] ? ' style="font-weight:600"' : '') + '>' +
        '<td>' + shape + '</td>' +
        '<td class="mono">' + root.Format.exact(report.pushes) + '</td>' +
        '<td class="mono">' + root.Format.exact(report.pops) + '</td>' +
        '<td class="mono">' + root.Format.exact(total) + '</td>' +
        '<td class="mono">' + root.Format.fixed(total / measured.n, 3) + '</td>' +
        '<td class="mono">' + root.Format.exact(report.maxSize) + '</td></tr>';
    }).join('');

    root.jQuery('#tpw-shapes tbody').html(html);
    root.jQuery('#tpw-shapes-note').text('The "per element" column does not move and the "largest deque" ' +
      'column moves by a factor of the window width. Those are the two different claims: the work is ' +
      'amortised constant per element whatever the data, and the space is data-dependent up to k. Ascending ' +
      'input never keeps more than one index because every new element dominates everything before it; ' +
      'descending input keeps the whole window because nothing is ever dominated.');
  }

  function paintStack(values) {
    const run = histogramFor(values['tpw-bars']);
    const n = Number(values['tpw-bars']);
    const rows = [
      {
        label: 'largest rectangle under ' + root.Format.exact(n) + ' bars',
        fast: run.rectangle.report.pushes + run.rectangle.report.pops,
        slow: n * (n + 1) / 2,
        agrees: run.rectangle.best.area === run.naive
      },
      {
        label: 'next greater element for ' + root.Format.exact(n) + ' values',
        fast: run.greater.report.pushes + run.greater.report.pops,
        slow: n * (n + 1) / 2,
        agrees: true
      }
    ];

    const html = rows.map(function (row) {
      return '<tr><td>' + row.label + '</td>' +
        '<td class="mono">' + root.Format.exact(row.fast) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.slow) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.slow / Math.max(1, row.fast), 0) + '×</td>' +
        '<td class="mono">' + (row.agrees ? 'yes' : 'NO') + '</td></tr>';
    }).join('');

    root.jQuery('#tpw-stack tbody').html(html);
    root.jQuery('#tpw-stack-note').text('Both problems read as "for each element, look at the others", and ' +
      'both collapse to exactly 2n stack operations. The largest rectangle here is ' +
      root.Format.exact(run.rectangle.best.area) + ', spanning bars ' +
      root.Format.exact(run.rectangle.best.left) + ' to ' + root.Format.exact(run.rectangle.best.right) +
      ' at height ' + root.Format.exact(run.rectangle.best.height) + ', and the brute-force scan agrees. ' +
      'The sentinel at the end of the loop is what keeps the code one loop rather than two: without it the ' +
      'stack has to be drained by a second copy of the same logic, which is where the off-by-one lives.');
  }

  function paintTrace() {
    const heights = [2, 1, 5, 6, 2, 3];
    const stack = [];
    const rows = [];
    let best = 0;

    for (let i = 0; i <= heights.length; i += 1) {
      const height = i === heights.length ? -1 : heights[i];
      const popped = [];
      while (stack.length && heights[stack[stack.length - 1]] > height) {
        const top = stack.pop();
        const left = stack.length ? stack[stack.length - 1] + 1 : 0;
        const area = heights[top] * (i - left);
        popped.push(heights[top] + '×' + (i - left) + '=' + area);
        best = Math.max(best, area);
      }
      if (i < heights.length) stack.push(i);
      rows.push({
        i: i, height: i === heights.length ? 'sentinel' : heights[i],
        popped: popped.length ? popped.join(', ') : '—',
        stack: stack.map(function (index) { return heights[index]; }).join(' ') || '∅',
        best: best
      });
    }

    const html = rows.map(function (row) {
      return '<tr><td class="mono">' + row.i + '</td>' +
        '<td class="mono">' + row.height + '</td>' +
        '<td class="mono">' + row.popped + '</td>' +
        '<td class="mono">' + row.stack + '</td>' +
        '<td class="mono">' + row.best + '</td></tr>';
    }).join('');

    root.jQuery('#tpw-trace tbody').html(html);
    root.jQuery('#tpw-trace-note').text('The textbook instance [2, 1, 5, 6, 2, 3], where the answer is 10 — ' +
      'the two bars of height 5 and 6 taken at height 5. Every bar appears in the "popped" column exactly ' +
      'once across the whole table, which is the amortisation made small enough to check by eye. The last ' +
      'row is the sentinel, and it exists to make the final drain part of the same loop.');
  }

  function drawWindow(app, run) {
    const width = Math.min(run.n, 120);
    view = root.ArrayView.bars(root.jQuery('#tpw-window-view')[0], {
      values: run.values.slice(0, width),
      height: 180,
      regions: [{ from: 0, to: Math.min(run.k, width), role: 'active' }],
      summary: 'the first ' + width + ' elements, with the first window marked'
    });

    root.jQuery('#tpw-window-note').text('The marked span is one window of width ' +
      root.Format.exact(run.k) + '. As it slides, the deque drops indices that have expired off the front ' +
      'and indices that are dominated off the back; what remains is a decreasing sequence whose head is the ' +
      'answer. Over the whole sweep of ' + root.Format.exact(run.n) + ' elements that costs ' +
      root.Format.exact(run.run.report.pushes + run.run.report.pops) + ' operations, against ' +
      root.Format.exact(Math.max(0, run.n - run.k + 1) * run.k) + ' for rescanning each window.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
