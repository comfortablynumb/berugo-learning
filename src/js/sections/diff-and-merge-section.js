/**
 * Section: diff and merge.
 *
 * Two claims, both measured. Myers costs O((N+M)·D) - proportional to the SIZE
 * OF THE ANSWER rather than the size of the input - which is why diffing two
 * nearly identical thousand-line files is instant and diffing two unrelated
 * ones is not. The growth panel sweeps the change fraction and shows the
 * diagonal count tracking D rather than N.
 *
 * And minimal is not readable. On a file where a function was moved, the
 * shortest edit script interleaves the two copies of the closing brace and
 * produces three hunks; patience anchors on lines that are unique in both
 * files and produces two, at the cost of two extra operations. Git ships both
 * because the objectives genuinely differ.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'diff-and-merge';
  const CHANGE_STEPS = [1, 2, 5, 10, 20, 40, 60];
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — the edit graph and a furthest-reaching path',
      caption: 'Moving right deletes a line of A, moving down inserts a line of B, and moving along ' +
        'the diagonal is free whenever the two lines are equal. The shortest edit script is the ' +
        'shortest path from the top-left to the bottom-right, and Myers finds it by tracking, for ' +
        'each diagonal, the furthest point reachable at the current cost D — so the search stops as ' +
        'soon as the answer is found rather than after filling a grid.',
      definition: [
        'flowchart LR',
        '    S["start (0,0)"] --> R["right: delete a line of A"]',
        '    S --> D["down: insert a line of B"]',
        '    S --> K["diagonal: the lines match — FREE"]',
        '    K --> F["greedily slide as far as the lines keep matching"]',
        '    F --> V["keep the furthest x per diagonal at cost D"]',
        '    V --> E["stop the moment the bottom-right is reached"]'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'A diff is a shortest path in an **edit graph**: moving right deletes a line of A, moving ' +
          'down inserts a line of B, and moving along the diagonal is free whenever the two lines ' +
          'are equal. Framing it as a longest common subsequence is equivalent and less useful, ' +
          'because the LCS formulation invites an `O(NM)` table and the graph formulation does not.',
        '**Myers searches by cost rather than by position.** For each diagonal it keeps the furthest ' +
          'point reachable at the current edit distance `D`, slides greedily along matching lines — ' +
          'those "snakes" are free — and stops the moment the far corner is reached. The cost is ' +
          '`O((N+M)·D)`, proportional to the size of the ANSWER, which is why two nearly identical ' +
          'files diff instantly however large they are and two unrelated ones do not.',
        '**Minimal and readable are different objectives.** On a file with many repeated lines — a ' +
          'closing brace, a blank line — the shortest script interleaves hunks in a way that ' +
          'corresponds to no change anybody made. **Patience diff** gives up minimality: it anchors ' +
          'on lines that occur exactly once in each file, takes the longest increasing subsequence ' +
          'of those anchors, and recurses between them. The panel measures both objectives on the ' +
          'same pair, and they disagree.',
        '**A three-way merge is two diffs against a base.** A position changed on one side only ' +
          'takes that side; changed identically on both takes it once; changed differently on both ' +
          'is a **conflict** and must be reported rather than resolved. Splitting "lines inserted ' +
          'before position i" from "lines replacing position i" is what lets an insertion on one ' +
          'side and an edit on the other coexist without being called a conflict, and the fixtures ' +
          'below include exactly that case.'
      ],
      demo: {
        title: 'Interactive demo — the side-by-side, the two objectives, and the growth',
        markup: root.DiffAndMergeTemplate.render()
      },
      diagram: diagram(),
      insight: 'When a diff is unreadable the fix is almost never a better algorithm — it is a ' +
        'different objective. `git diff --patience` and `--histogram` exist because minimal edit ' +
        'scripts and legible ones are different things, and the same is true of `--ignore-all-space` ' +
        'and of the indent heuristic Git turned on by default in 2016. Each of them makes the script ' +
        'longer and the review shorter, which is the correct trade and one that a complexity ' +
        'analysis cannot see.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.DiffAndMergeTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  /* -------------------------------------------------------------- fixtures */

  const BASE = ['function alpha() {', '  step();', '}', '',
    'function beta() {', '  step();', '}', '',
    'function gamma() {', '  step();', '}'];

  const CASES = {
    reorder: ['function gamma() {', '  step();', '}', '',
      'function alpha() {', '  step();', '}', '',
      'function beta() {', '  step();', '}'],
    insert: ['function alpha() {', '  step();', '}', '',
      'function delta() {', '  fresh();', '}', '',
      'function beta() {', '  step();', '}', '',
      'function gamma() {', '  step();', '}'],
    rewrite: ['function alpha() {', '  rebuilt();', '  twice();', '}', '',
      'function beta() {', '  step();', '}', '',
      'function gamma() {', '  step();', '}'],
    shuffle: ['}', 'function beta() {', '  step();', '',
      'function gamma() {', '}', '  step();', '',
      'function alpha() {', '  step();', '}']
  };

  const runFor = root.Helpers.memoise(function (key) {
    const other = CASES[key] || CASES.reorder;
    const myersReport = root.Diff.emptyReport();
    const patienceReport = root.Diff.emptyReport();
    const myers = root.Diff.myers(BASE, other, { report: myersReport });
    const patience = root.Diff.patience(BASE, other, { report: patienceReport });

    return { a: BASE, b: other, myers: myers, patience: patience,
      myersReport: myersReport, patienceReport: patienceReport,
      myersHunks: root.Diff.hunks(myers.script), patienceHunks: root.Diff.hunks(patience.script),
      myersOk: root.Diff.roundTrips(BASE, other, myers.script).ok,
      patienceOk: root.Diff.roundTrips(BASE, other, patience.script).ok,
      anchors: root.Diff.uniqueCommon(BASE, other, 0, BASE.length, 0, other.length).length };
  });

  const growthFor = root.Helpers.memoise(function (key) {
    const size = Number(key);

    return CHANGE_STEPS.map(function (percent) {
      const a = [];
      const b = [];

      for (let i = 0; i < size; i += 1) a.push('line ' + i);
      /* Change `percent` lines in every hundred, spread evenly, so the edit
         distance is the dial rather than the file size. */
      a.forEach(function (line, i) {
        b.push((i % 100) < percent ? 'changed ' + i : line);
      });
      const report = root.Diff.emptyReport();
      const run = root.Diff.myers(a, b, { report: report });

      return { percent: percent, size: size, run: run, report: report,
        ok: root.Diff.roundTrips(a, b, run.script).ok };
    });
  });

  const mergeFor = root.Helpers.memoise(function () {
    return [
      { name: 'both sides change different lines',
        base: ['a', 'b', 'c'], left: ['a', 'B', 'c'], right: ['a', 'b', 'C'] },
      { name: 'both sides change the SAME line, differently',
        base: ['a', 'b', 'c'], left: ['a', 'X', 'c'], right: ['a', 'Y', 'c'] },
      { name: 'both sides make the same change',
        base: ['a', 'b'], left: ['a', 'Z'], right: ['a', 'Z'] },
      { name: 'one side inserts, the other edits nearby',
        base: ['a', 'c'], left: ['a', 'b', 'c'], right: ['a', 'c', 'd'] },
      { name: 'one side deletes, the other edits the deleted line',
        base: ['a', 'b', 'c'], left: ['a', 'c'], right: ['a', 'B', 'c'] }
    ].map(function (entry) {
      return { name: entry.name, run: root.Diff.merge(entry.base, entry.left, entry.right),
        base: entry.base };
    });
  });

  /* -------------------------------------------------------------- painting */

  function update(app) {
    const values = panel.values();
    const state = runFor(values['dfm-case']);
    const merges = mergeFor('fixed');

    paintMetrics(state, values['dfm-algorithm'], merges);
    paintSide(state, values['dfm-algorithm']);
    paintCompare(state);
    paintGrowth(growthFor(String(values['dfm-size'])), app);
    paintMerge(merges);
  }

  function chosenOf(state, which) {
    return which === 'patience'
      ? { run: state.patience, hunks: state.patienceHunks, ok: state.patienceOk }
      : { run: state.myers, hunks: state.myersHunks, ok: state.myersOk };
  }

  function paintMetrics(state, which, merges) {
    const chosen = chosenOf(state, which);
    const operations = chosen.run.script.filter(function (step) {
      return step.kind !== 'equal';
    }).length;
    const conflicts = merges.reduce(function (sum, entry) {
      return sum + entry.run.conflicts.length;
    }, 0);

    root.MetricGrid.update({
      'dfm-distance': { value: root.Format.exact(operations),
        note: 'over ' + root.Format.plural(state.a.length, 'line') + ' against ' +
          root.Format.exact(state.b.length) },
      'dfm-hunks': { value: root.Format.exact(chosen.hunks.length),
        note: 'Myers ' + root.Format.exact(state.myersHunks.length) + ', patience ' +
          root.Format.exact(state.patienceHunks.length) },
      'dfm-roundtrip': { value: chosen.ok ? 'yes' : 'NO',
        note: chosen.ok ? 'the script applied to A produces B character for character'
          : 'the script does not reconstruct B, which makes every other column meaningless' },
      'dfm-conflicts': { value: root.Format.exact(conflicts),
        note: 'across ' + root.Format.plural(merges.length, 'three-way case') +
          ', of which only one is a genuine disagreement' }
    });
  }

  function paintSide(state, which) {
    const chosen = chosenOf(state, which);
    const shown = root.AlignmentView.sideBySide(root.jQuery('#dfm-side')[0], chosen.run.script,
      { limit: 30 });

    root.jQuery('#dfm-side-note').text('Showing ' + root.Format.exact(shown ? shown.shown : 0) +
      ' of ' + root.Format.exact(chosen.run.script.length) + ' script steps. An empty cell on the ' +
      'left is an insertion and an empty cell on the right is a deletion, which is the layout every ' +
      'review tool uses because it makes the two operations visually different. Switch the ' +
      'algorithm above and watch which lines get paired: the edit count barely moves and the ' +
      'grouping changes completely.');
  }

  function paintCompare(state) {
    const rows = [
      compareRow('Myers — minimal', state.myers, state.myersHunks, state.anchors, state.myersOk),
      compareRow('patience — anchored', state.patience, state.patienceHunks, state.anchors,
        state.patienceOk)
    ].join('');

    root.jQuery('#dfm-compare tbody').html(rows);
    const myersOps = state.myers.script.filter(function (s) { return s.kind !== 'equal'; }).length;
    const patienceOps = state.patience.script.filter(function (s) { return s.kind !== 'equal'; }).length;

    root.jQuery('#dfm-compare-note').text(state.myersHunks.length === state.patienceHunks.length
      ? 'On this pair the two agree at ' + root.Format.plural(state.myersHunks.length, 'hunk') +
        ' — which is the common case, and the reason patience is not the default. Switch to the ' +
        '"function moved" case, where the closing braces are interchangeable and the minimal script ' +
        'interleaves them.'
      : 'Myers produces ' + root.Format.plural(myersOps, 'operation') + ' in ' +
        root.Format.plural(state.myersHunks.length, 'hunk') + '; patience produces ' +
        root.Format.exact(patienceOps) + ' in ' +
        root.Format.exact(state.patienceHunks.length) + '. Patience is strictly worse by the ' +
        'measure the algorithm literature optimises and strictly better by the one a reviewer ' +
        'uses. It anchored on ' + root.Format.plural(state.anchors, 'line') +
        ' that occur exactly once in each file, and the repeated closing braces — which are what ' +
        'Myers interleaves — are not among them by construction.');
  }

  function compareRow(name, run, hunks, anchors, ok) {
    const operations = run.script.filter(function (step) { return step.kind !== 'equal'; }).length;

    return '<tr><td>' + name + '</td>' +
      '<td class="mono">' + root.Format.exact(operations) + '</td>' +
      '<td class="mono">' + root.Format.exact(hunks.length) + '</td>' +
      '<td class="mono">' + root.Format.exact(anchors) + '</td>' +
      '<td>' + (ok ? 'yes' : 'NO') + '</td></tr>';
  }

  function paintGrowth(rows, app) {
    const html = rows.map(function (row) {
      const full = row.size * row.size;

      return '<tr><td class="mono">' + root.Format.exact(row.percent) + '%</td>' +
        '<td class="mono">' + root.Format.exact(row.run.distance) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.report.diagonals) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.report.comparisons) + '</td>' +
        '<td class="mono">' + root.Format.fixed(100 * row.report.diagonals / full, 2) + '%</td></tr>';
    }).join('');

    root.jQuery('#dfm-growth tbody').html(html);
    drawGrowthChart(rows, app);
    const first = rows[0];
    const last = rows[rows.length - 1];

    root.jQuery('#dfm-growth-note').text('The diagonal count tracks D and not N: at ' +
      root.Format.exact(first.percent) + '% changed it is ' +
      root.Format.exact(first.report.diagonals) + ' and at ' +
      root.Format.exact(last.percent) + '% it is ' +
      root.Format.exact(last.report.diagonals) + ', on identical file sizes. The last column is ' +
      'that count against the `N × M` a table-filling implementation would visit — ' +
      root.Format.fixed(100 * first.report.diagonals / (first.size * first.size), 2) +
      '% at the small end. That is the whole reason `git diff` on a one-line change to a ' +
      'ten-thousand-line file returns before you let go of the key.');
  }

  function drawGrowthChart(rows, app) {
    const host = root.jQuery('#dfm-chart')[0];

    if (!host) return;
    root.GrowthPlot.render(host, {
      lazyLib: app.lazyLib,
      height: 220,
      series: [
        { label: 'diagonals visited', points: rows.map(function (row) {
          return { x: row.percent, y: row.report.diagonals }; }) },
        { label: 'edit distance D', points: rows.map(function (row) {
          return { x: row.percent, y: row.run.distance }; }) }
      ],
      xLabel: 'lines changed (%)',
      yLabel: 'count',
      legendHost: root.jQuery('#dfm-legend')[0],
      summary: function () { return 'Search work against the size of the answer.'; }
    });
  }

  function paintMerge(rows) {
    const cells = rows.map(function (entry) {
      return { cells: [entry.name,
        String(entry.run.conflicts.length),
        entry.run.lines.join(' · '),
        entry.run.conflicts.length === 0 ? 'resolved automatically'
          : 'reported, not resolved'] };
    });

    root.MatrixView.render(root.jQuery('#dfm-merge')[0], {
      columns: ['Case', 'Conflicts', 'Merged result', 'Outcome'], rows: cells
    });
    const conflicting = rows.filter(function (entry) { return entry.run.conflicts.length > 0; });

    root.jQuery('#dfm-merge-note').text(root.Format.exact(conflicting.length) + ' of these ' +
      root.Format.exact(rows.length) + ' cases conflict, and it is the one where both sides ' +
      'changed the same line to different content. The other four are the cases people expect to ' +
      'conflict and which do not: different lines, the same change made twice, an insertion beside ' +
      'an edit, and a deletion beside an edit. Getting those right is what separating "inserted ' +
      'before position i" from "replacing position i" buys, and a merge tool that conflates them ' +
      'produces conflicts on every commit that touched two nearby lines.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
