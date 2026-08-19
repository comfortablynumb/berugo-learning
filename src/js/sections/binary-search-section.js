/**
 * Section: binary search, correctly.
 *
 * The mutation table is the demo. Seven implementations, each one character
 * from the right one, run against thirteen probe cases - and the interesting
 * column is not which are wrong but *how few inputs notice*. One of them is
 * caught by a single case out of thirteen, and one is never caught by a wrong
 * answer at all: it is only detectable because the harness watches for reads
 * past the end of the array.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'binary-search';
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — the half-open interval across iterations',
      caption: 'The invariant is the whole algorithm. Every branch preserves "the answer is in [low, high)", ' +
        'and the loop ends when the interval is empty - at which point `low` is the answer.',
      definition: [
        'flowchart TD',
        '    A["low = 0, high = length — the answer is in [low, high)"] --> B{"low < high ?"}',
        '    B -- no --> C["the interval is empty: the answer is low"]',
        '    B -- yes --> D["mid = low + (high − low) / 2 — always below high"]',
        '    D --> E{"a[mid] < target ?"}',
        '    E -- yes --> F["low = mid + 1 — discards [low, mid]"]',
        '    E -- no --> G["high = mid — discards [mid, high)"]',
        '    F --> B',
        '    G --> B'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'Bentley\'s observation - that most published binary searches were wrong - is not about carelessness. ' +
          'It is about writing a loop from a picture instead of from an invariant. Write the invariant down ' +
          'first and every line follows from it: the half-open interval [low, high) always contains the ' +
          'answer, so `high` starts at `length` rather than `length − 1`, the loop runs while `low < high` ' +
          'because an empty interval means the answer is `low`, and `mid` is always strictly below `high` so ' +
          'the interval always shrinks and the loop always ends.',
        'The two sides are deliberately not symmetric, and that asymmetry is where the plus-ones live. ' +
          '`high = mid` discards the half-open range [mid, high); `low = mid + 1` discards the closed range ' +
          '[low, mid]. Both discard the probe, both make progress, and neither needs a matching adjustment on ' +
          'the other branch. Every mutation in the demo below is a change to one of those two lines, and each ' +
          'one is a real implementation you can select and watch run.',
        'What the table shows is how weak output testing is here. The `high = mid − 1` mutation is caught by ' +
          'exactly one of thirteen probe cases; a hand-written test suite that omits "target absent, in the ' +
          'interior" ships it. The `while (low <= high)` mutation is never caught by a wrong answer at all - ' +
          'it reads `array[length]`, JavaScript returns `undefined`, every comparison against `undefined` is ' +
          'false, and the search still returns the right index. In C that read is whatever was next in memory ' +
          'and in Java it throws, so the same code is a latent crash in two languages and silent here.'
      ],
      demo: {
        title: 'Interactive demo — the invariant, and seven ways to break it',
        markup: root.BinarySearchTemplate.render()
      },
      diagram: diagram(),
      insight: 'Writing the invariant down first is the entire fix, and it is cheaper than the debugging it ' +
        'replaces. "The answer is in [low, high)" is one comment, and with it there is no decision left to ' +
        'get wrong: `high` starts at the length because the interval is half-open, the loop condition is ' +
        '`low < high` because that is what "non-empty" means, and only one of the two branches gets a plus ' +
        'one because only one of them discards a closed range. Every binary-search bug in the demo is a line ' +
        'that contradicts a stated invariant, which is exactly the class of bug that stops existing once the ' +
        'invariant is stated.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.BinarySearchTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  const ARRAYS = {
    duplicates: [1, 3, 3, 3, 5, 8, 13, 21],
    empty: [],
    single: [5],
    'all-equal': [7, 7, 7, 7],
    even: [2, 4, 6, 8]
  };

  const reportFor = root.Helpers.memoise(function () {
    return root.BinarySearch.mutationReport();
  });

  /* Two distributions with the same length. The skewed one grows
     geometrically, which is the shape interpolation search is worst on: its
     estimate is a linear extrapolation between the endpoints, so a curve that
     is anything but linear sends the guess to the wrong end of the range. */
  const variantsFor = root.Helpers.memoise(function () {
    const uniform = [];
    for (let i = 0; i < 10000; i += 1) uniform.push(i * 3);
    const skewed = [];
    for (let i = 0; i < 10000; i += 1) skewed.push(Math.floor(Math.pow(1.001, i)));
    return { uniform: uniform, skewed: skewed };
  });

  function update(app) {
    const values = panel.values();
    const array = ARRAYS[values['bin-array']];
    const target = Number(values['bin-target']);

    paintTrace(array, target);
    paintMetrics(values, array, target);
    paintMutations(values);
    paintVariants(values);
    paintMidpoint();
  }

  function paintTrace(array, target) {
    const trace = root.BinarySearch.traceLowerBound(array, target, root.SortOps.create({}));
    const html = trace.steps.map(function (step, index) {
      return '<tr><td class="mono">' + (index + 1) + '</td>' +
        '<td class="mono">[' + step.low + ', ' + step.high + ')</td>' +
        '<td class="mono">' + step.width + '</td>' +
        '<td class="mono">' + step.mid + '</td>' +
        '<td class="mono">' + step.value + '</td>' +
        '<td>' + step.went + '</td>' +
        '<td>' + (step.holds ? 'holds' : '<strong>BROKEN</strong>') + '</td></tr>';
    }).join('');

    root.jQuery('#bin-trace tbody').html(html || '<tr><td colspan="7">the interval was empty to begin with</td></tr>');
    root.jQuery('#bin-trace-note').text('Each row is one iteration of the correct implementation. The width ' +
      'column at least halves every step, which is why the loop terminates, and the invariant column is the ' +
      'claim being maintained: the answer is still inside [low, high). It returned ' + trace.result +
      ' and a linear scan says ' + trace.expected + '.');
  }

  function paintMetrics(values, array, target) {
    const mutation = root.BinarySearch.mutations[values['bin-mutation']];
    const expected = root.BinarySearch.referenceLowerBound(array, target);
    let outcome;
    try { outcome = mutation.run(array.slice(), target); }
    catch (error) { outcome = 'threw'; }
    const shown = outcome && outcome.spun ? 'did not terminate' : outcome;

    const report = reportFor('all').filter(function (entry) {
      return entry.name === values['bin-mutation'];
    })[0];
    const trace = root.BinarySearch.traceLowerBound(array, target, root.SortOps.create({}));
    const bound = Math.ceil(Math.log2(array.length + 1)) + 1;

    root.MetricGrid.update({
      'bin-result': {
        value: String(shown),
        note: shown === expected ? 'agrees on this input' : 'and the correct answer is ' + expected
      },
      'bin-expected': { value: String(expected), note: 'from a linear scan over ' + array.length + ' elements' },
      'bin-steps': { value: String(trace.steps.length), note: '⌈log₂ n⌉ + 1 is ' + bound + ' here' },
      'bin-caught': {
        value: report.caught + ' / ' + report.checks,
        note: report.caught ? 'probe cases that notice' : 'nothing catches the correct version'
      }
    });
  }

  function paintMutations(values) {
    const html = reportFor('all').map(function (entry) {
      const first = entry.failures[0];
      return '<tr' + (entry.name === values['bin-mutation'] ? ' style="font-weight:600"' : '') + '>' +
        '<td>' + entry.label + '</td>' +
        '<td>' + entry.note + '</td>' +
        '<td class="mono">' + entry.caught + ' / ' + entry.checks + '</td>' +
        '<td>' + (first ? first.probe + ', target ' + first.target + ' — ' + first.reason : '—') + '</td></tr>';
    }).join('');

    root.jQuery('#bin-mutations tbody').html(html);
    root.jQuery('#bin-mutations-note').text('Every row is a real implementation run against the same thirteen ' +
      'checks. The correct one is caught by none, which is the control. Read the "caught by" column as how ' +
      'lucky your test suite would have to be: `high = mid − 1` is caught by one case out of thirteen, and ' +
      '`while (low <= high)` is never caught by a wrong answer — it is only visible because the harness ' +
      'watches for a read past the end of the array, which is what that mutation actually does.');
  }

  function paintVariants(values) {
    const data = variantsFor('all');
    const rows = [
      {
        id: 'plain', label: 'lower bound', assumes: 'sorted, nothing else',
        run: function (array, target) {
          const ops = root.SortOps.create({});
          root.BinarySearch.lowerBound(array, target, ops);
          return ops.stats().comparisons;
        }
      },
      {
        id: 'branchless', label: 'branchless lower bound', assumes: 'sorted; the win is invisible to a counter',
        run: function (array, target) {
          const ops = root.SortOps.create({});
          root.BinarySearch.branchlessLowerBound(array, target, ops);
          return ops.stats().comparisons;
        }
      },
      {
        id: 'interpolation', label: 'interpolation search', assumes: 'keys roughly uniform',
        run: function (array, target) {
          return root.BinarySearch.interpolationSearch(array, target, root.SortOps.create({})).probes;
        }
      },
      {
        id: 'exponential', label: 'exponential search', assumes: 'the target is near the front, or n is unknown',
        run: function (array, target) {
          const ops = root.SortOps.create({});
          root.BinarySearch.exponentialSearch(array, target, ops);
          return ops.stats().comparisons;
        }
      }
    ];

    const html = rows.map(function (row) {
      const uniform = row.run(data.uniform, data.uniform[data.uniform.length - 1]);
      const skewed = row.run(data.skewed, data.skewed[9000]);
      return '<tr' + (row.id === values['bin-variant'] ? ' style="font-weight:600"' : '') + '>' +
        '<td>' + row.label + '</td>' +
        '<td class="mono">' + uniform + '</td>' +
        '<td class="mono">' + skewed + '</td>' +
        '<td>' + row.assumes + '</td></tr>';
    }).join('');

    root.jQuery('#bin-variants tbody').html(html);
    root.jQuery('#bin-variants-note').text('Both key sets have 10 000 elements. Interpolation search collapses ' +
      'to a couple of probes on uniform keys — it guesses where the target is rather than splitting in half — ' +
      'and degrades on keys whose gaps grow, because the guess is a linear extrapolation and the data is not ' +
      'linear. The branchless version does exactly the same comparisons as the plain one, which is the point: ' +
      'whatever it wins is invisible to every counter in this milestone and only a timing harness can see it.');
  }

  function paintMidpoint() {
    const rows = [[4, 10], [1000, 2000], [2000000000, 2100000000]].map(function (pair) {
      const result = root.BinarySearch.midpointComparison(pair[0], pair[1]);
      return '<tr' + (result.overflows ? ' style="font-weight:700"' : '') + '>' +
        '<td class="mono">' + root.Format.exact(result.low) + '</td>' +
        '<td class="mono">' + root.Format.exact(result.high) + '</td>' +
        '<td class="mono">' + root.Format.exact(result.naive) + '</td>' +
        '<td class="mono">' + root.Format.exact(result.safe) + '</td>' +
        '<td class="mono">' + root.Format.exact(result.bits32) + (result.overflows ? ' !' : '') + '</td></tr>';
    }).join('');

    root.jQuery('#bin-midpoint tbody').html(rows);
    root.jQuery('#bin-midpoint-note').text('JavaScript numbers are exact to 2^53, so the naive midpoint and ' +
      'the safe one agree in every row — this is the one classic binary-search bug the language hides. The ' +
      'last column is the same expression forced through 32-bit arithmetic, which is the environment it was ' +
      'found in: the sum wraps and the midpoint comes out negative. Keep the habit anyway. `low + (high − ' +
      'low) / 2` costs nothing, and the code often outlives the language it was written in.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
