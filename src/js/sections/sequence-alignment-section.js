/**
 * Section: sequence alignment DP.
 *
 * The subject is space, so every row of the methods table carries a peak-cell
 * count and a column saying whether that method can return an alignment at
 * all. The two-row variant is on the page precisely because it is the
 * temptation: three lines of change, the same distance, and the traceback
 * silently stops being possible.
 *
 * Every alignment printed here is run through `checkAlignment`, which strips
 * the gaps from each row and demands the inputs back. That is the assertion a
 * distance can never make, and it is what separates Hirschberg working from
 * Hirschberg appearing to work.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'sequence-alignment';
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — the three predecessors of an edit-distance cell',
      caption: 'Diagonal is "these two characters line up" and costs nothing when they match; the two ' +
        'orthogonal edges each consume one character against a gap. The traceback prefers the diagonal on ' +
        'a tie, because a diagonal is one column and a pair of gaps is two.',
      definition: [
        'flowchart RL',
        '    C["d[i][j]"] --> D["d[i-1][j-1] + (a_i == b_j ? 0 : sub)"]',
        '    C --> U["d[i-1][j] + remove"]',
        '    C --> L["d[i][j-1] + insert"]',
        '    D --> M["minimum"]',
        '    U --> M',
        '    L --> M'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        '**Edit distance is the two-dimensional DP everything else in this family is a ' +
          'variation of.** The state is (prefix of a, prefix of b). The three transitions are ' +
          'substitute, insert and remove, and the traceback turns the number into an alignment.',
        'Longest common subsequence is the same table with substitution forbidden, which is why ' +
          '`git diff` and spell-checking are the same algorithm wearing different costs.',
        '**Dropping to two rows keeps the distance and deletes the alignment.** The recurrence ' +
          'only ever reads the previous row, so keeping one is enough for the number. The ' +
          'traceback needs the whole table, because it walks backwards through cells that no ' +
          'longer exist.',
        'The methods table below reports peak cells, and whether each method can produce an ' +
          'alignment. The two-row row answers "no", rather than returning something that looks ' +
          'like one.',
        '**Hirschberg\'s algorithm gets both.** Run the row-only distance forwards on the top ' +
          'half and backwards on the bottom half. The column minimising the sum is where the ' +
          'optimal alignment crosses the midpoint, so recurse on the two halves. The alignment ' +
          'comes back in O(min(m, n)) space for about twice the time.',
        '**Affine gaps need three tables, because "am I already inside a gap" is state.** With a ' +
          'linear penalty a run of k gaps costs k·g however it is arranged. So the aligner has no ' +
          'reason to keep gaps together, and produces alignments shredded into single-character ' +
          'holes.',
        'Charging an opening cost once and an extension cost per character is what makes a real ' +
          'aligner produce contiguous indels. It needs a separate table for "in a gap in a", "in ' +
          'a gap in b" and "aligned".'
      ],
      demo: {
        title: 'Interactive demo — the table, the traceback, and the space trade',
        markup: root.SequenceAlignmentTemplate.render()
      },
      diagram: diagram(),
      insight: 'The traceback is the part worth testing, and the test is not "is the distance ' +
        'right". Strip the gaps from each row of the alignment. You must get the two inputs ' +
        'back, the rows must be the same length, and no column may be a gap against a gap. Those ' +
        'three checks catch every traceback bug there is, including the one that matters most: a ' +
        'traceback walked over a table that was space reduced after the traceback was written. A ' +
        'distance test cannot see any of them, because the distance is computed by code that is ' +
        'still correct.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.SequenceAlignmentTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  const runFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const a = parts[0];
    const b = parts[1];
    const costs = parts[2] === 'off' ? {} : { transpose: Number(parts[2]) };
    return {
      a: a, b: b, costs: costs,
      full: root.DpSequence.editDistance(a, b, { costs: costs }),
      rows: root.DpSequence.editDistanceRows(a, b, { costs: costs }),
      hirschberg: root.DpSequence.hirschberg(a, b, { costs: costs }),
      brute: a.length + b.length <= 20 ? root.DpSequence.editDistanceBruteForce(a, b) : null,
      lcs: root.DpSequence.longestCommonSubsequence(a, b, {}),
      diff: root.DpSequence.diffScript(a, b),
      global: root.DpSequence.alignScored(a, b, {}),
      local: root.DpSequence.alignScored(a, b, { mode: 'local' }),
      affine: root.DpSequence.alignAffine(a, b, {})
    };
  });

  /* The space claim needs a length where the two numbers actually diverge;
     eight characters against seven does not make the case. */
  const scaleFor = root.Helpers.memoise(function (key) {
    const n = Number(key);
    const random = root.Random.seeded(5);
    const letters = 'acgt';
    let a = '';
    let b = '';

    for (let i = 0; i < n; i += 1) {
      a += letters[random.int(4)];
      b += letters[random.int(4)];
    }
    return { n: n, full: (n + 1) * (n + 1), linear: 2 * (n + 1),
      measured: root.DpSequence.hirschberg(a.slice(0, 120), b.slice(0, 120), {}).report.peakCells };
  });

  function keyFor(values) {
    return values['seq-left'] + '|' + values['seq-right'] + '|' + values['seq-transpose'];
  }

  function update() {
    const values = panel.values();
    const run = runFor(keyFor(values));
    const scale = scaleFor(String(values['seq-scale']));

    paintMetrics(run, scale);
    paintAlignment(run);
    paintTable(run);
    paintMethods(run);
    paintScoring(run);
    paintDiff(run);
  }

  function paintMetrics(run, scale) {
    root.MetricGrid.update({
      'seq-distance': {
        value: root.Format.exact(run.full.distance),
        note: run.brute === null ? 'too long to enumerate exhaustively'
          : (run.brute === run.full.distance ? 'the exhaustive recursion agrees'
            : 'THE EXHAUSTIVE RECURSION DISAGREES')
      },
      'seq-full': { value: root.Format.exact(scale.full),
        note: 'at ' + scale.n + ' characters a side' },
      'seq-linear': { value: root.Format.exact(scale.linear),
        note: 'two rows, whatever the first string is' },
      'seq-saving': { value: root.Format.fixed(scale.full / scale.linear, 1) + '×',
        note: 'and it grows linearly with the length' }
    });
  }

  function paintAlignment(run) {
    const check = root.DpSequence.checkAlignment(run.a, run.b, run.full.alignment);
    const hirschbergCheck = root.DpSequence.checkAlignment(run.a, run.b, run.hirschberg.alignment);

    root.jQuery('#seq-alignment').html(
      '<pre class="mono" style="margin:0;font-size:.8rem;line-height:1.5">' +
      root.Helpers.escapeHtml(run.full.alignment.top) + '\n' +
      root.Helpers.escapeHtml(run.full.alignment.bottom) + '</pre>');
    root.jQuery('#seq-alignment-note').text(check.valid && hirschbergCheck.valid
      ? check.columns + ' columns, cost ' + root.DpSequence.alignmentCost(run.full.alignment, run.costs)
        + '. Both the full table and Hirschberg produce a valid alignment: stripping the gaps from each '
        + 'row returns the two inputs exactly.'
      : 'INVALID ALIGNMENT: ' + check.problems.concat(hirschbergCheck.problems).join('; '));
  }

  function paintTable(run) {
    const path = root.DpTableView.editPath(run.a, run.b, run.full.table);

    root.jQuery('#seq-table').html(root.DpTableView.markup({
      table: run.full.table,
      corner: 'a \\ b',
      rowLabels: ['—'].concat(run.a.split('')),
      columnLabels: ['—'].concat(run.b.split('')),
      path: path,
      depends: root.DpTableView.editDepends(run.a.length, run.b.length),
      active: [{ row: run.a.length, column: run.b.length }]
    }));
    root.jQuery('#seq-table-note').text('Green is the traceback the printed alignment came from — the same '
      + 'walk, not a second one. Amber is the three cells the answer in the bottom-right was chosen from. '
      + 'The path is read from the table rather than recomputed, which is why the drawing cannot disagree '
      + 'with the alignment above it.');
  }

  function paintMethods(run) {
    const rows = [
      { label: 'full table', distance: run.full.distance, cells: run.full.report.peakCells,
        alignment: run.full.alignment },
      { label: 'two rows', distance: run.rows.distance, cells: run.rows.report.peakCells,
        alignment: null },
      { label: "Hirschberg's algorithm", distance: run.hirschberg.distance,
        cells: run.hirschberg.report.peakCells, alignment: run.hirschberg.alignment },
      { label: 'exhaustive recursion', distance: run.brute, cells: 0, alignment: null }
    ];
    const html = rows.map(function (row) {
      const check = row.alignment
        ? root.DpSequence.checkAlignment(run.a, run.b, row.alignment) : null;
      return '<tr><td>' + row.label + '</td>' +
        '<td class="mono">' + (row.distance === null ? 'not run' : root.Format.exact(row.distance)) + '</td>' +
        '<td class="mono">' + (row.cells ? root.Format.exact(row.cells) : '—') + '</td>' +
        '<td>' + (row.alignment ? 'yes' : 'no') + '</td>' +
        '<td>' + (check ? (check.valid ? 'valid, ' + check.columns + ' columns' : 'INVALID') : '—') +
        '</td></tr>';
    }).join('');

    root.jQuery('#seq-methods tbody').html(html);
    root.jQuery('#seq-methods-note').text('Hirschberg pays ' + run.hirschberg.report.splits + ' recursive '
      + 'splits and a second pass over each half to get the alignment back in the two-row memory budget. '
      + 'The "returns an alignment" column is the one that matters: the two-row method answers no, which '
      + 'is honest, rather than returning a traceback over a table it no longer has.');
  }

  function paintScoring(run) {
    const rows = [
      { label: 'global (Needleman–Wunsch)', score: run.global.score,
        optimises: 'the best alignment of the two strings end to end',
        at: 'the bottom-right corner, always' },
      { label: 'local (Smith–Waterman)', score: run.local.score,
        optimises: 'the best-matching region, ignoring the rest',
        at: 'row ' + run.local.at.i + ', column ' + run.local.at.j },
      { label: 'affine gaps', score: run.affine.score,
        optimises: 'the same as global, with runs of gaps charged once to open',
        at: 'three tables, so "inside a gap" is a state' }
    ];
    const html = rows.map(function (row) {
      return '<tr><td>' + row.label + '</td>' +
        '<td class="mono">' + root.Format.exact(row.score) + '</td>' +
        '<td>' + row.optimises + '</td><td>' + row.at + '</td></tr>';
    }).join('');

    root.jQuery('#seq-scoring tbody').html(html);
    root.jQuery('#seq-scoring-note').text('One table, three questions. Local alignment differs from global '
      + 'by a single `Math.max(0, …)` and by where the answer is read from — and on strings that share a '
      + 'good region inside poor surroundings the two scores separate sharply. Affine scores lower here '
      + 'because opening a gap now costs something it did not before.');
  }

  function paintDiff(run) {
    const counts = { keep: 0, add: 0, remove: 0 };

    run.diff.forEach(function (step) { counts[step.op] += 1; });
    const rows = [
      { op: 'keep (context)', symbol: ' ', count: counts.keep },
      { op: 'add', symbol: '+', count: counts.add },
      { op: 'remove', symbol: '−', count: counts.remove }
    ];
    const html = rows.map(function (row) {
      return '<tr><td>' + row.op + '</td><td class="mono">' + row.symbol + '</td>' +
        '<td class="mono">' + row.count + '</td></tr>';
    }).join('');

    root.jQuery('#seq-diff tbody').html(html);
    root.jQuery('#seq-diff-note').text('The longest common subsequence is "' + run.lcs.sequence + '" at '
      + 'length ' + run.lcs.length + ', and the diff is what is left over: everything not in the LCS is '
      + 'either an addition or a removal. That is literally how a diff is defined, and M15 replaces this '
      + 'table with Myers\'s algorithm, which exploits the fact that real diffs are mostly context.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
