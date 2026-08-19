/**
 * Section: external, parallel and network sorting.
 *
 * Two halves that share a theme: once the machine stops being one CPU with
 * one array, the quantity to minimise stops being comparisons. External
 * sorting minimises passes over the data, and a sorting network minimises
 * depth. Both are reported here as counts rather than times, because the
 * count is the part that transfers between machines and the time is not.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'external-sorting';
  let panel = null;
  let lattice = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
    app.state.subscribe('theme', function () {
      if (lattice) lattice.redraw();
    });
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'Once the data does not fit in memory the CPU stops being what you are spending. Aggarwal and ' +
          'Vitter\'s model says a sort of N records with M resident and B per block costs (N/B)·log_{M/B}(N/B) ' +
          'block transfers, and the shape of that expression is the whole lesson: the only lever is the *base ' +
          'of the logarithm*, which is the merge order. Doubling memory does not halve the work - it lets one ' +
          'pass consume more runs, and each pass you remove is a full read and a full write of everything.',
        'Run generation is the other lever and it is the surprising one. Filling memory, sorting it and ' +
          'flushing gives runs of exactly M records - 100 runs from 10 000 records with 100 resident. ' +
          'Replacement selection keeps a heap and emits the smallest record still greater than the last one ' +
          'written, deferring the rest to the next run: measured mean run length 196.1, which is Knuth\'s 2M ' +
          'snowplough result. That halves the run count, and halving the run count removed an entire merge ' +
          'pass here - four passes down to three, 100 000 record transfers down to 80 000, for no extra I/O ' +
          'at all. On input that is already sorted it produces one run and the merge phase disappears.',
        'A sorting network is the other end of the same idea: a fixed list of compare-exchange pairs, no ' +
          'branches, no data dependence. Bitonic sort does more comparisons than merge sort - 28 160 against ' +
          'about 10 240 at 1 024 elements - and does them in 55 rounds, where every comparator in a round ' +
          'touches disjoint wires and can run simultaneously. That is the trade a GPU wants and a single CPU ' +
          'does not. It also gives the only exhaustive correctness argument in this milestone: by the zero-one ' +
          'principle a network sorts everything if it sorts all 2^n inputs of zeros and ones, so 16 wires are ' +
          'verified completely by 65 536 runs.'
      ],
      demo: {
        title: 'Interactive demo — passes, run generation, and the comparator lattice',
        markup: root.ExternalSortingTemplate.render()
      },
      diagram: {
        title: 'Diagram — a bitonic merge network for 8 inputs',
        caption: 'Three stages of comparators. Everything in one stage is independent, so the picture\'s ' +
          'width is the parallel running time and its area is the total work.',
        definition: [
          'flowchart LR',
          '    A["8 unsorted wires"] --> B["stage 1 — 4 comparators, distance 4"]',
          '    B --> C["stage 2 — 4 comparators, distance 2"]',
          '    C --> D["stage 3 — 4 comparators, distance 1"]',
          '    D --> E["sorted — 24 comparators, depth 6 in total"]',
          '    B --> F["every comparator in a stage touches disjoint wires"]'
        ].join('\n')
      },
      insight: 'External sorting is the ancestor of every shuffle stage in every data pipeline, and the ' +
        'parameter that matters is not CPU - it is the number of merge passes. That is why a job that spills ' +
        'to disk gets dramatically faster from more memory per worker and barely faster from more cores: ' +
        'memory raises the merge order and the merge order is the base of a logarithm, while cores speed up ' +
        'the part that was never the bottleneck. When a shuffle is slow, count the passes before profiling ' +
        'the comparator.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.ExternalSortingTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  const runFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const values = root.SortLab.input('random', Number(parts[3]), 5);
    const list = values.slice();
    const ops = root.SortOps.create({});
    const report = root.ExternalSort.sort(list, ops, {
      memory: Number(parts[1]), order: Number(parts[2]), runGeneration: parts[0]
    });

    let wrong = 0;
    const expected = values.slice().sort(function (a, b) { return a - b; });
    for (let i = 0; i < expected.length; i += 1) {
      if (list[i] !== expected[i]) wrong += 1;
    }
    return { report: report, stats: ops.stats(), wrong: wrong };
  });

  const networkFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const network = root.SortingNetworks.networks[parts[0]].build(Number(parts[1]));
    return { network: network, verdict: root.SortingNetworks.verifyZeroOne(network) };
  });

  function update(app) {
    const values = panel.values();
    const key = values['ext-generation'] + '|' + values['ext-memory'] + '|' + values['ext-order'] + '|' +
      values['ext-records'];
    const chosen = runFor(key);

    paintMetrics(chosen, values);
    paintGeneration(values);
    paintOrder(values);
    paintNetworks(values);
    drawLattice(values);
  }

  function paintMetrics(chosen, values) {
    root.MetricGrid.update({
      'ext-runs': {
        value: root.Format.exact(chosen.report.initialRuns),
        note: 'from ' + root.Format.exact(values['ext-records']) + ' records'
      },
      'ext-runlength': {
        value: root.Format.fixed(chosen.report.meanRunLength, 1),
        note: root.Format.fixed(chosen.report.meanRunLength / Number(values['ext-memory']), 2) +
          '× the records resident'
      },
      'ext-passes': {
        value: root.Format.exact(chosen.report.mergePasses),
        note: chosen.report.mergePasses === 0 ? 'run generation finished the job' : 'each is a full read and write'
      },
      'ext-transfers': {
        value: root.Format.exact(chosen.report.totalTransfers),
        note: root.Format.exact(chosen.report.recordReads) + ' reads, ' +
          root.Format.exact(chosen.report.recordWrites) + ' writes'
      }
    });
  }

  function paintGeneration(values) {
    const html = ['sort-and-flush', 'replacement-selection'].map(function (generation) {
      const run = runFor(generation + '|' + values['ext-memory'] + '|' + values['ext-order'] + '|' +
        values['ext-records']);
      return '<tr' + (generation === values['ext-generation'] ? ' style="font-weight:600"' : '') + '>' +
        '<td>' + generation + '</td>' +
        '<td class="mono">' + root.Format.exact(run.report.initialRuns) + '</td>' +
        '<td class="mono">' + root.Format.fixed(run.report.meanRunLength, 1) + '</td>' +
        '<td class="mono">' + run.report.mergePasses + '</td>' +
        '<td class="mono">' + root.Format.exact(run.report.totalTransfers) + '</td>' +
        '<td class="mono">' + run.wrong + '</td></tr>';
    }).join('');

    root.jQuery('#ext-generation-table tbody').html(html);
    root.jQuery('#ext-generation-note').text('Replacement selection produces runs about twice the size of ' +
      'memory — Knuth\'s snowplough: a plough going round a circular road while snow falls uniformly clears ' +
      'twice its own capacity per circuit. It reads the same records once and writes them once, so the extra ' +
      'run length is free, and halving the run count can remove a whole merge pass. Set the input to a sorted ' +
      'file and it produces a single run and no merge phase at all.');
  }

  function paintOrder(values) {
    const baseline = runFor(values['ext-generation'] + '|' + values['ext-memory'] + '|2|' + values['ext-records']);
    const html = [2, 4, 8, 16, 32].map(function (order) {
      const run = runFor(values['ext-generation'] + '|' + values['ext-memory'] + '|' + order + '|' +
        values['ext-records']);
      return '<tr' + (order === Number(values['ext-order']) ? ' style="font-weight:600"' : '') + '>' +
        '<td class="mono">' + order + '-way</td>' +
        '<td class="mono">' + run.report.mergePasses + '</td>' +
        '<td class="mono">' + root.Format.exact(run.report.totalTransfers) + '</td>' +
        '<td class="mono">' + root.Format.exact(run.stats.comparisons) + '</td>' +
        '<td class="mono">' + root.Format.fixed(
          baseline.report.totalTransfers / Math.max(1, run.report.totalTransfers), 2) + '×</td></tr>';
    }).join('');

    root.jQuery('#ext-order-table tbody').html(html);
    root.jQuery('#ext-order-note').text('The comparison column barely moves as the merge order grows — ' +
      'picking the smallest of k heads costs log₂ k however the merging is arranged, so the total is about ' +
      'the same however it is grouped. The transfer column falls sharply. That is the entire argument: the ' +
      'merge order does not buy CPU, it buys passes, and in the external model a pass is the unit of cost. ' +
      'The practical ceiling on the order is memory: one input buffer per run, plus one for output.');
  }

  function paintNetworks(values) {
    const html = [];
    root.SortingNetworks.kinds.forEach(function (kind) {
      [4, 8, 16].forEach(function (size) {
        const built = networkFor(kind + '|' + size);
        const selected = kind === values['ext-network'] && size === Number(values['ext-wires']);
        html.push('<tr' + (selected ? ' style="font-weight:600"' : '') + '>' +
          '<td>' + root.SortingNetworks.networks[kind].label + '</td>' +
          '<td class="mono">' + size + '</td>' +
          '<td class="mono">' + built.network.comparators.length + '</td>' +
          '<td class="mono">' + built.network.depth + '</td>' +
          '<td class="mono">' + root.Format.exact(built.verdict.checked) + '</td>' +
          '<td class="mono">' + built.verdict.failures + '</td></tr>');
      });
    });

    root.jQuery('#ext-networks tbody').html(html.join(''));
    root.jQuery('#ext-networks-note').text('The failures column is zero everywhere, and that is a proof ' +
      'rather than a sample: by the zero-one principle, a comparator network sorts every input if and only ' +
      'if it sorts every input of zeros and ones, so 65 536 runs settle a 16-wire network completely. Nothing ' +
      'else in this milestone can be verified that way. Compare the comparator and depth columns down the ' +
      'odd-even rows: it uses fewer comparators than bitonic at the same depth, which is why it is the one ' +
      'that gets built in hardware.');
  }

  function drawLattice(values) {
    const built = networkFor(values['ext-network'] + '|' + values['ext-wires']);
    lattice = root.NetworkView.lattice(root.jQuery('#ext-network-view')[0], {
      height: 260,
      network: built.network,
      summary: built.network.comparators.length + ' comparators in ' + built.network.depth +
        ' rounds over ' + built.network.size + ' wires.'
    });

    const sequential = Math.round(built.network.size * Math.log2(Math.max(2, built.network.size)));
    root.jQuery('#ext-network-note').text('Horizontal lines are wires and vertical connectors are ' +
      'compare-exchanges; a purple connector sorts the other way, which is what makes a bitonic sequence. ' +
      built.network.comparators.length + ' comparators arranged in ' + built.network.depth +
      ' columns, and every comparator in a column is independent — so with enough lanes this sorts in ' +
      built.network.depth + ' steps where a sequential sort needs about ' + sequential + ' comparisons one ' +
      'after another. More total work, less time, which is the whole reason the shape exists.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
