/**
 * Section: greedy algorithms and exchange arguments.
 *
 * Four criteria, one instance, and an oracle. The oracle is the point: greedy
 * failures are silent, so the only way to know a criterion is wrong is to
 * compute the optimum and compare. The counter-examples are searched for at
 * page load rather than stored, because "here is an instance where this loses"
 * is a much stronger statement when the search that found it reports how many
 * instances it had to look at.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'greedy-algorithms';
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — an exchange argument',
      caption: 'Take any optimal solution that disagrees with greedy at the first position. Swapping in ' +
        'greedy\'s choice cannot make the solution worse or infeasible, so an optimal solution agreeing with ' +
        'greedy one step further exists. Induction finishes it.',
      definition: [
        'flowchart LR',
        '    O["an optimal solution OPT"] --> D["first position where OPT differs from greedy"]',
        '    D --> S["swap greedy\'s choice into OPT"]',
        '    S --> F["still feasible — greedy finishes no later"]',
        '    F --> V["still optimal — the size did not change"]',
        '    V --> I["an optimum agreeing with greedy one step further"]',
        '    I --> C["induction: greedy is optimal"]'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'A greedy algorithm commits to a locally best choice and never reconsiders. That is the whole ' +
          'definition, and it is why greedy algorithms are short, fast, and the paradigm most often applied ' +
          'without proof. The proof is not optional: the failure mode is not a crash or a hang, it is a valid ' +
          'answer that is not the best one, returned confidently and indistinguishable from a correct answer ' +
          'unless somebody computes the optimum.',
        'Interval scheduling is the standard demonstration because four plausible criteria exist and exactly ' +
          'one is optimal. Earliest start, shortest duration and fewest conflicts all schedule sensibly on ' +
          'most instances; each has an instance where it loses, and the demo finds those instances by search. ' +
          'Earliest start loses on four intervals after five random instances. Fewest conflicts needs nine ' +
          'intervals and tens of thousands of instances - which is exactly how a wrong criterion survives ' +
          'testing and reaches production.',
        'Two proof techniques certify a greedy algorithm. An exchange argument transforms any optimal ' +
          'solution into the greedy one without making it worse. A staying-ahead argument shows that after k ' +
          'choices greedy is at least as well placed as any competitor - for interval scheduling, that its ' +
          'k-th interval finishes no later, so it never runs out of room first. The table below is that ' +
          'comparison, computed rather than asserted.'
      ],
      demo: {
        title: 'Interactive demo — four criteria, an oracle, and the instances that break three of them',
        markup: root.GreedyAlgorithmsTemplate.render()
      },
      diagram: diagram(),
      insight: 'When somebody proposes a greedy rule, ask for the certificate before asking for the ' +
        'benchmark. If they cannot produce an exchange or staying-ahead argument, the rule is a heuristic, ' +
        'and a heuristic in a place that reports an exact answer is a defect waiting for the right input. ' +
        'The cheap version of this discipline is what the demo does: implement the exponential-but-correct ' +
        'oracle, run both on random instances in a test, and let the search look for the disagreement. It ' +
        'costs an hour and it is the difference between "greedy works here" and "greedy worked on the ' +
        'instances I tried".'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.GreedyAlgorithmsTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  const instanceFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|').map(Number);
    const random = root.Random.seeded(parts[2]);
    const intervals = [];
    for (let i = 0; i < parts[0]; i += 1) {
      const start = random.int(parts[1]);
      intervals.push({ id: i, start: start, end: start + 1 + random.int(Math.max(1, parts[1] - start)) });
    }
    return intervals;
  });

  const counterFor = root.Helpers.memoise(function (key) {
    return root.Greedy.counterExample(key, { seed: 5 });
  });

  function keyFor(values) {
    return values['grd-count'] + '|' + values['grd-span'] + '|' + values['grd-seed'];
  }

  function update() {
    const values = panel.values();
    const intervals = instanceFor(keyFor(values));
    const optimum = root.Greedy.optimalSchedule(intervals);

    paintMetrics(values, intervals, optimum);
    paintIntervals(values, intervals);
    paintCriteria(intervals, optimum);
    paintCounters();
    paintAhead(intervals);
    paintCoins(values);
  }

  function paintMetrics(values, intervals, optimum) {
    const run = root.Greedy.schedule(intervals, values['grd-criterion']);
    const coins = values['grd-coins'].split(',').map(Number);
    const canonical = root.Greedy.isCanonical(coins);

    root.MetricGrid.update({
      'grd-chosen': {
        value: root.Format.exact(run.size),
        note: run.label + ', over ' + root.Format.exact(intervals.length) + ' intervals'
      },
      'grd-optimal': {
        value: root.Format.exact(optimum.size),
        note: 'weighted interval scheduling with unit weights'
      },
      'grd-gap': {
        value: root.Format.exact(optimum.size - run.size),
        note: run.size === optimum.size ? 'optimal on this instance' : 'this criterion lost here'
      },
      'grd-canonical': {
        value: canonical.canonical ? 'optimal' : 'not optimal',
        note: canonical.witness
          ? root.Format.exact(canonical.witness.amount) + ' needs ' + canonical.witness.optimal +
            ' coins and greedy uses ' + canonical.witness.greedy
          : 'checked to ' + root.Format.exact(canonical.limit) + ', the bound that settles it'
      }
    });
  }

  function paintIntervals(values, intervals) {
    const span = Math.max.apply(null, intervals.map(function (interval) { return interval.end; }));
    const chosen = new Set(root.Greedy.schedule(intervals, values['grd-criterion']).chosen
      .map(function (interval) { return interval.id; }));

    const rows = intervals.slice().sort(function (a, b) { return a.start - b.start; }).map(function (interval) {
      const left = (interval.start / span) * 100;
      const width = Math.max(1.5, ((interval.end - interval.start) / span) * 100);
      const tone = chosen.has(interval.id) ? 'var(--hue-blue)' : 'var(--hue-gray)';
      return '<div style="position:relative;height:14px;margin-bottom:3px">' +
        '<div style="position:absolute;left:' + left.toFixed(2) + '%;width:' + width.toFixed(2) + '%;' +
        'height:12px;border-radius:3px;background:' + tone + '"></div></div>';
    }).join('');

    root.jQuery('#grd-intervals').html(rows);
    root.jQuery('#grd-intervals-note').text('Blue intervals were scheduled by the selected criterion; grey ' +
      'ones were rejected because they overlapped something already taken. The picture is worth reading when ' +
      'a criterion loses: it is always the same story, a short or early interval that blocks two later ones.');
  }

  function paintCriteria(intervals, optimum) {
    const html = root.Greedy.criterionKinds.map(function (kind) {
      const run = root.Greedy.schedule(intervals, kind);
      return '<tr' + (run.claimsOptimal ? ' style="font-weight:600"' : '') + '>' +
        '<td>' + run.label + '</td>' +
        '<td class="mono">' + root.Format.exact(run.size) + '</td>' +
        '<td class="mono">' + root.Format.exact(optimum.size) + '</td>' +
        '<td class="mono">' + (run.size === optimum.size ? 'yes' : 'no') + '</td>' +
        '<td class="mono">' + (run.claimsOptimal ? 'yes — exchange argument' : 'no') + '</td></tr>';
    }).join('');

    root.jQuery('#grd-criteria tbody').html(html);
    root.jQuery('#grd-criteria-note').text('On most instances all four columns agree, which is precisely the ' +
      'problem: three of these criteria pass any test suite built from random instances of this size. The ' +
      'last column is the only one that does not depend on the instance, and it is the only one worth ' +
      'trusting. Move the seed slider and watch the fourth column flicker while the fifth does not.');
  }

  function paintCounters() {
    const html = root.Greedy.criterionKinds.map(function (kind) {
      const found = counterFor(kind);
      const label = root.Greedy.criteria[kind].label;
      if (!found.intervals) {
        return '<tr style="font-weight:600"><td>' + label + '</td><td class="mono">—</td>' +
          '<td class="mono">' + root.Format.exact(found.attempts) + '</td>' +
          '<td class="mono">—</td><td class="mono">none found</td></tr>';
      }
      return '<tr><td>' + label + '</td>' +
        '<td class="mono">' + root.Format.exact(found.count) + '</td>' +
        '<td class="mono">' + root.Format.exact(found.attempts) + '</td>' +
        '<td class="mono">' + root.Format.exact(found.greedy) + '</td>' +
        '<td class="mono">' + root.Format.exact(found.optimal) + '</td></tr>';
    }).join('');

    root.jQuery('#grd-counter tbody').html(html);
    root.jQuery('#grd-counter-note').text('The search climbs a ladder of instance sizes and stops at the ' +
      'first disagreement. The third column is the number that should worry anyone shipping a greedy rule: ' +
      'earliest start is caught by the fifth random instance, and fewest conflicts survives tens of ' +
      'thousands. Earliest finish is searched over the whole ladder and never loses, which is not a proof — ' +
      'the exchange argument is — but it is the right kind of evidence to have as well.');
  }

  function paintAhead(intervals) {
    const trace = root.Greedy.stayingAheadTrace(intervals);
    const html = trace.map(function (row) {
      return '<tr><td class="mono">' + row.k + '</td>' +
        '<td class="mono">' + root.Format.exact(row.greedyEnd) + '</td>' +
        '<td class="mono">' + (row.otherEnd === null ? '— (it has already run out)' : root.Format.exact(row.otherEnd)) + '</td>' +
        '<td class="mono">' + (row.ahead ? 'yes' : 'NO') + '</td></tr>';
    }).join('');

    root.jQuery('#grd-ahead tbody').html(html);
    root.jQuery('#grd-ahead-note').text('This is the induction, tabulated. Greedy\'s k-th interval finishes ' +
      'no later than the k-th interval of the optimal schedule, for every k — so at every point greedy has ' +
      'at least as much of the timeline left, and it can never be the one that runs out first. When the ' +
      'right-hand column runs out before the left one, that is the optimum having no k-th interval, which is ' +
      'the case that ends the argument in greedy\'s favour.');
  }

  const COIN_SYSTEMS = [[1, 5, 10, 25], [1, 2, 5, 10, 20, 50], [1, 3, 4], [1, 7, 10], [1, 15, 25]];

  function paintCoins(values) {
    const selected = values['grd-coins'];
    const html = COIN_SYSTEMS.map(function (coins) {
      const verdict = root.Greedy.isCanonical(coins);
      const key = coins.join(',');
      return '<tr' + (key === selected ? ' style="font-weight:600"' : '') + '>' +
        '<td class="mono">' + coins.join(', ') + '</td>' +
        '<td class="mono">' + (verdict.canonical ? 'canonical' : 'not canonical') + '</td>' +
        '<td class="mono">' + (verdict.witness ? root.Format.exact(verdict.witness.amount) : '—') + '</td>' +
        '<td class="mono">' + (verdict.witness ? verdict.witness.greedy : '—') + '</td>' +
        '<td class="mono">' + (verdict.witness ? verdict.witness.optimal : '—') + '</td></tr>';
    }).join('');

    root.jQuery('#grd-coin-table tbody').html(html);
    root.jQuery('#grd-coin-note').text('Greedy change-making is optimal for some denomination sets and not ' +
      'others, and inspection does not settle it: 1, 3, 4 fails at 6 (greedy pays 4+1+1, the answer is 3+3) ' +
      'while 1, 5, 10, 25 is fine. Pearson\'s result bounds the search — a non-canonical system has a ' +
      'counter-example below the sum of the two largest coins — so a finite sweep decides it. That is the ' +
      'shape to look for whenever a greedy rule is proposed: not "does it work on my examples" but "is there ' +
      'a bounded region in which a counter-example must live if one exists".');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
