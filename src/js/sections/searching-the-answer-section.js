/**
 * Section: searching on the answer.
 *
 * The demo draws the boolean array the predicate induces, because that array
 * is the thing being searched and it is invisible in the code. Once it is on
 * screen the whole technique is obvious: it is false, then true, and the
 * search is looking for the boundary.
 *
 * The last table is the safety check. A non-monotone predicate produces a
 * confident wrong answer rather than an error, so the section runs one and
 * shows the wrong answer next to the right one.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'searching-the-answer';
  let panel = null;
  let strip = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
    app.state.subscribe('theme', function () {
      if (strip) strip.redraw();
    });
  }

  function diagram() {
    return {
        title: 'Diagram — the check that licenses the search',
        caption: 'The binary search is the easy part. The step that makes it valid is proving the predicate ' +
          'is monotone, and that step has no syntax - it is an argument about the problem.',
        definition: [
          'flowchart TD',
          '    A["name the answer and its range [lo, hi]"] --> B["write feasible(x), and nothing else"]',
          '    B --> C{"does feasible(x) imply feasible(x+1)?"}',
          '    C -- no --> D["not a binary search — the answer would be arbitrary"]',
          '    C -- yes --> E{"is it the smallest or the largest feasible x?"}',
          '    E -- smallest --> F["first-true: mid rounds down, hi = mid"]',
          '    E -- largest --> G["last-true: mid rounds UP, lo = mid"]',
          '    F --> H["log2(range) feasibility checks"]',
          '    G --> H'
        ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'Nothing in this section searches a sorted array. What is sorted is the boolean array the *predicate* ' +
          'induces: if a ship of capacity c can deliver the packages in D days then so can a ship of capacity ' +
          'c + 1, so "is capacity c enough" reads false, false, …, false, true, true, …, true across the whole ' +
          'range of capacities. That monotonicity is the only precondition, and with it the smallest working ' +
          'capacity is findable in log₂(range) feasibility checks instead of a sweep - 5 checks over a range ' +
          'of 46 for the ten-package instance, and 30 checks over a range of a billion.',
        'The discipline is four steps and the third is the one people skip. Name the answer and its range; ' +
          'write `feasible(x)` and nothing else; *check that it is monotone*; then binary-search for the ' +
          'boundary. Skipping the third step does not produce an error - a binary search over a predicate that ' +
          'flips more than once returns one of the boundaries, confidently, and which one depends on where ' +
          'the probes happened to land. The demo runs an exhaustive monotonicity check because these ranges ' +
          'are small enough to sweep in a test and too large to sweep in production, which is exactly the ' +
          'situation the technique is for.',
        'The four problems in the demo are the same problem. "Minimum ship capacity", "allocate books to ' +
          'readers" and "smallest divisor" all search for the smallest feasible value; aggressive cows ' +
          'searches for the *largest*, which is a different loop and not a negated predicate. Writing the ' +
          'last-true search as a first-true search on `!feasible` is the classic off-by-one: it is correct ' +
          'until the entire range is feasible, and then it is one too small. It also needs its midpoint to ' +
          'round up, or the interval stops shrinking and the loop never ends.'
      ],
      demo: {
        title: 'Interactive demo — the predicate, the boolean array it induces, and the search',
        markup: root.SearchingTheAnswerTemplate.render()
      },
      diagram: diagram(),
      insight: 'The reframe is the skill, and it is worth naming so you recognise it: any question of the ' +
        'form "the smallest x that works" or "minimise the maximum" is a binary search wearing a costume, ' +
        'provided working at x implies working at x + 1. What you write is the feasibility check - a simple, ' +
        'obviously-correct linear function - and the search is four lines of boilerplate around it. The ' +
        'failure mode to watch for is a predicate that is *nearly* monotone, because the search will still ' +
        'return an answer and there is nothing in the output to say it is the wrong one.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.SearchingTheAnswerTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  const PROBLEMS = {
    ships: { label: 'minimum ship capacity', answer: 'the smallest capacity that finishes in D days', last: false },
    books: { label: 'allocate books', answer: 'the smallest maximum workload', last: false },
    cows: { label: 'aggressive cows', answer: 'the largest minimum gap', last: true },
    divisor: { label: 'smallest divisor', answer: 'the smallest divisor under the threshold', last: false }
  };

  const instanceFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    /* Seed 0 is the worked example's own instance - weights 1, 2, ... n -
       so the section opens on the numbers its prose quotes rather than on a
       random package list that happens to have a different answer. */
    const seed = Number(parts[3]);
    const random = root.Random.seeded(Math.max(1, seed));
    const items = [];
    for (let i = 0; i < Number(parts[1]); i += 1) items.push(seed === 0 ? i + 1 : 1 + random.int(20));
    return solve(parts[0], items, Number(parts[2]));
  });

  function solve(problem, items, parts) {
    if (problem === 'books') return root.AnswerSearch.allocateBooks(items, parts);
    if (problem === 'cows') {
      const stalls = [];
      let at = 0;
      items.forEach(function (gap) { at += gap; stalls.push(at); });
      return root.AnswerSearch.aggressiveCows(stalls, Math.min(parts, stalls.length));
    }
    if (problem === 'divisor') {
      return root.AnswerSearch.smallestDivisor(items, Math.max(items.length, parts * items.length));
    }
    return root.AnswerSearch.shipCapacity(items, parts);
  }

  function update(app) {
    const values = panel.values();
    const key = values['ans-problem'] + '|' + values['ans-items'] + '|' + values['ans-parts'] + '|' + values['ans-seed'];
    const solved = instanceFor(key);
    const report = root.AnswerSearch.monotonicityReport(solved.low, solved.high, solved.feasible);

    paintMetrics(solved, report, values);
    paintTrace(solved, values);
    paintProblems(values);
    paintMonotone();
    drawStrip(solved, report);
  }

  function paintMetrics(solved, report, values) {
    root.MetricGrid.update({
      'ans-answer': {
        value: root.Format.exact(solved.answer),
        note: PROBLEMS[values['ans-problem']].answer
      },
      'ans-checks': {
        value: root.Format.exact(solved.checks),
        note: '⌈log₂ ' + root.Format.exact(solved.span) + '⌉ is ' +
          Math.ceil(Math.log2(Math.max(1, solved.span)))
      },
      'ans-span': {
        value: root.Format.exact(solved.span),
        note: 'values from ' + root.Format.exact(solved.low) + ' to ' + root.Format.exact(solved.high)
      },
      'ans-monotone': {
        value: report.monotone ? 'yes' : 'no',
        note: report.flips === 1 ? 'it flips exactly once, at the answer'
          : (report.flips === 0 ? 'it never flips over this range' : 'it flips ' + report.flips + ' times')
      }
    });
  }

  function paintTrace(solved, values) {
    const last = PROBLEMS[values['ans-problem']].last;
    const html = solved.trace.map(function (step, index) {
      const after = last
        ? (step.feasible ? '[' + step.mid + ', ' + step.high + ']' : '[' + step.low + ', ' + (step.mid - 1) + ']')
        : (step.feasible ? '[' + step.low + ', ' + step.mid + ']' : '[' + (step.mid + 1) + ', ' + step.high + ']');
      return '<tr><td class="mono">' + (index + 1) + '</td>' +
        '<td class="mono">[' + step.low + ', ' + step.high + ']</td>' +
        '<td class="mono">' + step.mid + '</td>' +
        '<td>' + (step.feasible ? 'yes' : 'no') + '</td>' +
        '<td class="mono">' + after + '</td></tr>';
    }).join('');

    root.jQuery('#ans-trace tbody').html(html);
    root.jQuery('#ans-trace-note').text('Every row is one call to the feasibility function — the only thing ' +
      'written by hand. ' + (last
      ? 'This is a last-true search, so a feasible candidate keeps the candidate itself and the midpoint ' +
        'rounds up: with a rounded-down midpoint and lo = mid, an interval of width one would never shrink.'
      : 'This is a first-true search, so a feasible candidate becomes the new upper end and the midpoint ' +
        'rounds down.') + ' The interval at least halves every row, which is why ' + solved.checks +
      ' checks settle a range of ' + solved.span + '.');
  }

  function paintProblems(values) {
    const html = Object.keys(PROBLEMS).map(function (name) {
      const solved = instanceFor(name + '|' + values['ans-items'] + '|' + values['ans-parts'] + '|' + values['ans-seed']);
      const brute = PROBLEMS[name].last
        ? lastFeasible(solved)
        : root.AnswerSearch.scanForFirstTrue(solved.low, solved.high, solved.feasible);
      return '<tr' + (name === values['ans-problem'] ? ' style="font-weight:600"' : '') + '>' +
        '<td>' + PROBLEMS[name].label + '</td>' +
        '<td>' + PROBLEMS[name].answer + '</td>' +
        '<td class="mono">' + solved.low + '…' + solved.high + '</td>' +
        '<td class="mono">' + solved.checks + '</td>' +
        '<td class="mono">' + solved.span + '</td>' +
        '<td>' + (brute === solved.answer ? 'yes' : '<strong>no</strong>') + '</td></tr>';
    }).join('');

    root.jQuery('#ans-problems tbody').html(html);
    root.jQuery('#ans-problems-note').text('Four problems that sound unrelated and are the same search. Each ' +
      'one is checked against a brute-force sweep of its whole range — the last column — which is affordable ' +
      'here precisely because these instances are small. That is the testing strategy the technique invites: ' +
      'verify the search against an exhaustive scan on inputs small enough to scan, then run it on inputs ' +
      'that are not.');
  }

  function lastFeasible(solved) {
    let found = -1;
    for (let x = solved.low; x <= solved.high; x += 1) {
      if (solved.feasible(x)) found = x;
    }
    return found;
  }

  function paintMonotone() {
    const rows = [
      { label: 'x ≥ 4 — monotone', predicate: function (x) { return x >= 4; } },
      { label: 'x = 3 or x ≥ 7 — not monotone', predicate: function (x) { return x === 3 || x >= 7; } },
      { label: 'x ≤ 6 — monotone the other way', predicate: function (x) { return x <= 6; } }
    ].map(function (row) {
      const report = root.AnswerSearch.monotonicityReport(0, 10, row.predicate);
      const searched = root.AnswerSearch.firstTrue(0, 10, row.predicate).answer;
      const truth = root.AnswerSearch.scanForFirstTrue(0, 10, row.predicate);
      return '<tr' + (report.monotone ? '' : ' style="font-weight:700"') + '>' +
        '<td>' + row.label + '</td>' +
        '<td class="mono">' + report.flips + '</td>' +
        '<td>' + (report.monotone ? 'yes' : 'no') + '</td>' +
        '<td class="mono">' + searched + '</td>' +
        '<td class="mono">' + truth + '</td></tr>';
    }).join('');

    root.jQuery('#ans-monotone-table tbody').html(rows);
    root.jQuery('#ans-monotone-table-note').text('A monotone predicate flips exactly once across its range; the ' +
      'middle row flips three times and is not searchable. Note what happens: the binary search still returns ' +
      'a number, and it is not the smallest true value. Nothing raised, nothing logged — which is why the ' +
      'monotonicity check belongs in the code that uses the technique and not only in the reasoning behind it.');
  }

  function drawStrip(solved, report) {
    const values = report.values.map(function (flag) { return flag ? 1 : 0; });
    const firstTrue = report.firstTrue < 0 ? values.length : report.firstTrue - solved.low;

    strip = root.ArrayView.bars(root.jQuery('#ans-strip')[0], {
      height: 200,
      values: values,
      regions: [
        { from: 0, to: firstTrue, role: 'discarded' },
        { from: firstTrue, to: values.length, role: 'sorted' }
      ],
      markers: [{ at: solved.answer - solved.low, label: 'answer', role: 'pivot' }],
      summary: 'The predicate over its whole range: false for ' + firstTrue + ' values, then true for the rest.'
    });

    root.jQuery('#ans-strip-note').text('This is the array being searched, and it exists nowhere in the code ' +
      '— it is what the feasibility function *induces* over the range of candidate answers. ' + firstTrue +
      ' infeasible values, then ' + (values.length - firstTrue) + ' feasible ones, with the boundary marked. ' +
      'Once the picture looks like this, the binary search is the obvious move; the work was proving the ' +
      'picture looks like this.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
