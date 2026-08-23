/**
 * Section: bitsets and SWAR algorithms.
 *
 * The section's job is to replace "bitsets are compact" with a density. A
 * bitset's memory is a property of the *universe* and a hash set's is a
 * property of the *population*, so the comparison has one crossing point and
 * the demo solves for it rather than asserting a direction. At a universe of a
 * million and a modelled 32 bytes per Set entry, that crossing is at 3 906
 * elements — a density of 0.39%, which is far sparser than most people guess.
 * Above it the bitset wins by up to 128x; below it the Set is genuinely
 * smaller and the honest answer is to use one.
 *
 * The memory model is stated rather than measured, because JavaScript does not
 * expose the size of a Set. `SET_BYTES_PER_ENTRY` carries the assumption and
 * every derived number reports it, so a reader who disagrees with 32 bytes can
 * move the crossing themselves rather than being told a ratio to believe.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'bitsets-and-swar';
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
      title: 'Diagram — a word-wise intersection, and why it has no branches',
      caption: 'Both sets are arrays of 32-bit words over the same universe, so element 33 is bit ' +
        '1 of word 1 in both. Intersecting them is one AND per word with no comparison, no hash ' +
        'and no pointer chase — the loop is the same length whatever the populations are, which is ' +
        'both the strength (perfect prefetching, no branches to mispredict) and the weakness ' +
        '(intersecting two sets of ten elements over a million-element universe still reads ' +
        '31 250 words).',
      definition: [
        'flowchart LR',
        '    A["set A: Uint32Array<br/>31 250 words"] --> C["for each index i:<br/>out[i] = A[i] & B[i]"]',
        '    B["set B: Uint32Array<br/>31 250 words"] --> C',
        '    C --> D["result: Uint32Array<br/>31 250 words"]',
        '    D --> E["popcount each word<br/>for the size"]',
        '    D --> F["iterate with x & −x<br/>once per SET BIT"]',
        '    F --> G["cost is the population"]',
        '    C --> H["cost is the UNIVERSE"]'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'A bitset stores a set of small integers as **one bit per possible element**, in a typed ' +
          'array. Membership is a shift and a mask; union, intersection and difference are one ' +
          'word-wise OR, AND or AND-NOT per word, with no comparisons, no hashing and no ' +
          'pointers. A million-element universe is 125 000 bytes — 122 KB — which fits in L2 ' +
          'cache on any machine made this decade, while a `Set` holding half of those elements is ' +
          '15 MB and misses on every lookup.',
        '**The deciding question is density, and the answer is a number.** A bitset costs the ' +
          'same whatever it holds; a hash set costs per element. So there is exactly one ' +
          'crossing point, and at a million-element universe it is around 0.4% occupancy — below ' +
          'that the `Set` really is smaller and using a bitset is a mistake. This is the ' +
          'reasoning behind Roaring bitmaps in M09, which switch representation per 65 536-element ' +
          'block precisely because real data is dense in some blocks and sparse in others.',
        '**Iterating a bitset must not scan the universe.** The naive loop tests every possible ' +
          'element and costs the universe size; the loop built on `x & −x` and `x & (x − 1)` ' +
          'visits one position per *set bit* and costs the population plus one step per word. On ' +
          'a thousand elements in a million-element universe that is the difference between ' +
          '32 250 steps and 1 000 000.',
        '**A bitboard is the same idea on a fixed 8 × 8 grid**, and it is where the technique is ' +
          'most visibly worth it. A chess position is a handful of 64-bit words, and "where can ' +
          'this knight move" is eight shifts and eight masks producing all destinations at once. ' +
          'The masks are the entire difficulty: shifting east moves a piece off the h file and ' +
          'back on at a, and forgetting to mask that does not look like a bug, it looks like a ' +
          'rook that occasionally teleports.'
      ],
      demo: {
        title: 'Interactive demo — density, word operations, a sieve and a board',
        markup: root.BitsetsAndSwarTemplate.render()
      },
      diagram: diagram(),
      insight: 'The mistake worth naming is reaching for a bitset because the elements are ' +
        'integers. They have to be integers *and* dense *and* bounded — and the bound has to be ' +
        'one you can defend, because a bitset over user ids is fine until the ids become UUIDs ' +
        'and the universe becomes 2¹²⁸. When the density is unknown or varies across the range, ' +
        'do not choose: use a structure that chooses per block. And when a bitset is right, the ' +
        'thing that makes it fast is not the memory saving alone — it is that the word loop has ' +
        'no branches to mispredict and a perfectly predictable access pattern, which is worth ' +
        'more on modern hardware than the byte count suggests.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.BitsetsAndSwarTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const DENSITIES = [0.5, 0.25, 0.1, 0.05, 0.02, 0.01, 0.005, 0.0039, 0.002, 0.001];

  const densityFor = root.Helpers.memoise(function (key) {
    return root.NumberLab.densitySweep(Number(key), DENSITIES);
  });

  const crossoverFor = root.Helpers.memoise(function (key) {
    return root.NumberLab.crossoverDensity(Number(key));
  });

  const operationsFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.NumberLab.setOperationRun({ universe: Number(parts[0]),
      population: Number(parts[1]), seed: 11 });
  });

  const iterationFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.NumberLab.iterationCost(Number(parts[0]), Number(parts[1]), 13);
  });

  /* The sieve is fixed at a million rather than following the universe
     control: it is a separate experiment about a dense set, and letting it
     follow a control that also drives a sparse experiment invites the reader
     to compare two numbers that are not comparable. */
  const SIEVE_LIMIT = 1000000;
  const sieveFor = root.Helpers.memoise(function (key) {
    return root.NumberLab.sieveComparison(Number(key));
  });

  const boardFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.NumberLab.bitboardScene({ piece: parts[0], file: Number(parts[1]),
      rank: Number(parts[2]), blockers: BLOCKERS });
  });

  const BLOCKERS = [{ file: 3, rank: 6 }, { file: 6, rank: 3 }, { file: 1, rank: 3 }];

  function update(app) {
    const values = panel.values();
    const universe = String(values['bs-universe']);
    const population = String(Math.min(Number(values['bs-population']), Number(universe)));

    paintMetrics(universe, population);
    paintChart(app, universe);
    paintDensity(densityFor(universe), crossoverFor(universe));
    paintOperations(operationsFor(universe + '|' + population));
    paintSieve(sieveFor(String(SIEVE_LIMIT)));
    paintBoard(boardFor(values['bs-piece'] + '|' + values['bs-file'] + '|' + values['bs-rank']));
  }

  function paintMetrics(universe, population) {
    const crossover = crossoverFor(universe);
    const iteration = iterationFor(universe + '|' + population);
    const setBytes = Number(population) * root.NumberLab.SET_BYTES_PER_ENTRY;

    root.MetricGrid.update({
      'bs-bytes': { value: root.Format.bytes(crossover.bitsetBytes),
        note: 'one bit for each of ' + root.Format.exact(Number(universe)) + ' elements' },
      'bs-setbytes': { value: root.Format.bytes(setBytes),
        note: root.Format.exact(Number(population)) + ' entries at ' +
          crossover.bytesPerEntry + ' bytes, a stated model' },
      'bs-crossover': { value: root.Format.fixed(100 * crossover.density, 3) + '%',
        note: root.Format.exact(Math.round(crossover.population)) + ' elements — below this the ' +
          'Set is smaller' },
      'bs-iteration': { value: root.Format.fixed(iteration.saving, 1) + '×',
        note: root.Format.exact(iteration.fastSteps) + ' steps against ' +
          root.Format.exact(iteration.slowSteps) }
    });
  }

  function paintChart(app, universe) {
    const host = root.jQuery('#bs-chart')[0];
    if (!host) return;
    const rows = densityFor(universe);
    if (chart) chart.destroy();

    chart = root.GrowthPlot.render(host, {
      lazyLib: app.lazyLib,
      height: 240,
      logX: true,
      logY: true,
      xLabel: 'density (fraction of the universe present)',
      yLabel: 'bytes',
      series: [
        { label: 'bitset', dots: true,
          points: rows.map(function (row) { return { x: row.density, y: row.bitsetBytes }; }) },
        { label: 'Set, modelled at 32 bytes an entry', dots: true,
          points: rows.map(function (row) { return { x: row.density, y: row.setBytes }; }) }
      ],
      legendHost: root.jQuery('#bs-legend')[0]
    });

    const crossover = crossoverFor(universe);
    root.Helpers.setText('bs-chart-note',
      'Both axes are logarithmic. The bitset line is flat because its cost does not depend on ' +
      'how many elements are present; the Set line is a straight diagonal because its cost is ' +
      'proportional to them. They cross at a density of ' +
      root.Format.fixed(100 * crossover.density, 3) + '%, and everything this section claims ' +
      'about bitsets is a claim about being on the right of that crossing.');
  }

  function paintDensity(rows, crossover) {
    root.jQuery('#bs-density tbody').html(rows.map(function (row) {
      return '<tr><td>' + root.Format.fixed(100 * row.density, 3) + '%</td><td>' +
        root.Format.exact(row.population) + '</td><td>' + root.Format.bytes(row.bitsetBytes) +
        '</td><td>' + root.Format.bytes(row.setBytes) + '</td><td>' +
        root.Format.fixed(row.ratio, 2) + '×</td><td>' +
        (row.bitsetWins ? 'bitset' : 'the Set') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('bs-density-note',
      'The ratio column is the Set’s bytes over the bitset’s, so above 1 the bitset wins and ' +
      'below it the Set does. The crossing is at ' +
      root.Format.exact(Math.round(crossover.population)) + ' elements — ' +
      root.Format.fixed(100 * crossover.density, 3) + '% — and it moves in direct proportion to ' +
      'the ' + crossover.bytesPerEntry + '-byte model for a Set entry: halve that estimate and ' +
      'the crossing doubles. The model is stated because it cannot be measured from inside ' +
      'JavaScript, not because it is precise.');
  }

  function paintOperations(rows) {
    root.jQuery('#bs-ops tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.operation + '</td><td>' + root.Format.exact(row.size) +
        '</td><td>' + root.Format.exact(row.referenceSize) + '</td><td>' +
        root.Format.exact(row.disagreements) + '</td><td>' +
        root.Format.exact(row.wordsTouched) + '</td><td>' +
        root.Format.exact(row.setProbes) + '</td></tr>';
    }).join(''));

    const wrong = rows.reduce(function (total, row) { return total + row.disagreements; }, 0);
    root.Helpers.setText('bs-ops-note',
      root.Format.exact(wrong) + ' disagreements with a real `Set` across all three operations, ' +
      'which is what makes the last two columns worth reading. The word count is identical for ' +
      'all three and independent of the answer’s size — an intersection that returns ' +
      root.Format.exact(rows[0].size) + ' elements still reads every word. That is the cost of ' +
      'having no branches, and it is why a sparse intersection is the one case where the ' +
      'general-purpose set is faster as well as smaller.');
  }

  function paintSieve(sieve) {
    const rows = [
      { name: 'bitset over a typed array', writes: sieve.bitWrites, bytes: sieve.bitsetBytes },
      { name: 'a Set of composites', writes: sieve.setWrites, bytes: sieve.setBytes }
    ];

    root.jQuery('#bs-sieve tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.name + '</td><td>' + root.Format.exact(row.writes) + '</td><td>' +
        root.Format.bytes(row.bytes) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('bs-sieve-note',
      'The sieve of Eratosthenes to ' + root.Format.exact(sieve.limit) + ': ' +
      root.Format.exact(sieve.primes) + ' primes, ' + root.Format.exact(sieve.composites) +
      ' composites, and the two representations write exactly the same ' +
      root.Format.exact(sieve.bitWrites) + ' marks — it is the same algorithm. The whole ' +
      'difference is ' + root.Format.fixed(sieve.ratio, 1) + '× the memory, at the ' +
      sieve.bytesPerEntry + '-byte model. A sieve is the friendliest case a bitset has: the set ' +
      'is dense by construction and the universe is known before the first write.');
  }

  /**
   * The board in reading order. `boardBits` is indexed by square number, which
   * runs a1 to h8 - so rendering it directly gives a board upside down and
   * mirrored. Eight cells per group is one rank, top rank first, a file on the
   * left, which is how a chess board is drawn everywhere else.
   */
  function boardRows(bits) {
    const out = [];
    for (let rank = 7; rank >= 0; rank -= 1) {
      for (let file = 0; file < 8; file += 1) out.push(bits[rank * 8 + file]);
    }
    return out;
  }

  function paintBoard(scene) {
    const host = root.jQuery('#bs-board')[0];
    if (!host) return;

    root.BitView.render(host, {
      value: boardRows(scene.bits),
      bits: 64,
      groups: [{ label: 'attacked squares', from: 0, to: 63, hue: 'teal' }],
      caption: scene.piece + ' on file ' + scene.from.file + ', rank ' + scene.from.rank +
        ' — eight cells to a rank, rank 8 on top, the a file on the left',
      readings: [
        { label: 'squares attacked', value: String(scene.squares) },
        { label: 'shift-and-mask operations', value: String(scene.operations) },
        { label: 'square-by-square walk', value: String(scene.referenceOperations) + ' squares' },
        { label: 'disagreements with the walk', value: String(scene.disagreements) }
      ]
    });

    root.Helpers.setText('bs-board-note',
      'The same attack set computed two ways: ' + scene.operations + ' shift-and-mask operations ' +
      'against a walk that considers all ' + scene.referenceOperations + ' squares, with ' +
      scene.disagreements + ' disagreements. The masks are what make the shift version correct — ' +
      'a knight leaving the g file eastwards lands two files over, so both g and h have to be ' +
      'excluded after that shift and only h after the one-file shifts. Getting that wrong ' +
      'produces a legal-looking move list with a piece that has wrapped around the board.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
