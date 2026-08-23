/**
 * Section: integer algorithms in practice.
 *
 * The locality claim - "random UUIDs destroy B-tree insert locality" - is
 * simulated rather than repeated. Each identifier is assigned the index page
 * its sort key would land on, by rank among the whole batch, and the
 * measurement is how many distinct pages the last W inserts touched: that is
 * the working set a buffer pool has to hold to avoid a read per insert. A
 * random UUID touches the whole window; a time-ordered scheme touches about a
 * dozen pages whatever the window is.
 *
 * The result that is easy to miss is the middle one. UUIDv7 and ULID do not
 * quite reach a sequential integer's locality: within a millisecond their low
 * bits are random, so consecutive inserts straddle a page boundary twice as
 * often. It is a small gap and it is real, and it is also exactly what makes
 * them unsafe as a paging cursor - they are ordered *to the millisecond*, not
 * strictly. Snowflake is strictly ordered because its low bits are a counter,
 * which is the entire practical difference between the two families.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'integer-algorithms';
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
      title: 'Diagram — a Snowflake identifier, field by field',
      caption: 'Sixty-four bits so it fits in a `bigint` column and an integer index. The ' +
        'timestamp is at the top, which is what makes the numeric order the creation order; the ' +
        'machine id is what removes the need for coordination between generators; the sequence ' +
        'is what allows more than one identifier per millisecond, and its width is a hard ' +
        'ceiling of 4 096 per machine per millisecond.',
      definition: [
        'flowchart LR',
        '    A["bit 63<br/>unused, keeps it positive"] --> B["bits 62-22<br/>41 bits: milliseconds<br/>since a custom epoch"]',
        '    B --> C["bits 21-12<br/>10 bits: machine id<br/>1 024 generators"]',
        '    C --> D["bits 11-0<br/>12 bits: sequence<br/>4 096 per ms per machine"]',
        '    B -.-> E["69 years of range<br/>from the chosen epoch"]',
        '    C -.-> F["no coordination needed<br/>if ids are assigned once"]',
        '    D -.-> G["past 4 096: wait,<br/>or borrow from the next ms"]'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        '**An identifier scheme is three decisions**: how it is generated, what it costs the ' +
          'index it becomes a key in, and what it tells someone who holds one. Uniqueness is not ' +
          'on the list, because every scheme here achieves it — arguing about collision ' +
          'probability is arguing about the one dimension where they are all fine.',
        '**Randomness in the high bits is what destroys insert locality.** A B-tree inserts where ' +
          'the key sorts, so a random key lands on a random page and consecutive inserts touch ' +
          'as many pages as your window is wide. The demo measures that directly: the working ' +
          'set for random UUIDs is the whole window, and for a time-ordered scheme it is about a ' +
          'dozen pages. At a billion rows that is the difference between an index that lives in ' +
          'memory and one that reads from disk on every insert.',
        '**Time-ordered is not the same as monotonic, and the gap matters.** UUIDv7 and ULID put ' +
          'a 48-bit millisecond timestamp in the high bits and fill the rest with randomness, so ' +
          'ids from *different* milliseconds sort correctly and ids from the *same* millisecond ' +
          'come out in a random order — about half of the same-millisecond pairs, which the demo ' +
          'counts. A cursor that pages by `id > last` silently drops rows under them. Snowflake ' +
          'has a sequence counter in the low bits instead and is strictly ordered.',
        '**Time in the identifier is time leaked out of it.** A UUIDv7 hands its holder the ' +
          'creation time to the millisecond; a Snowflake hands over the machine that made it and ' +
          'the per-millisecond sequence, from which a competitor can estimate your write rate. A ' +
          'sequential integer is worse still — the value *is* the count, so id 4 812 says how ' +
          'many rows exist. Only the random UUID leaks nothing, and it leaks nothing by giving up ' +
          'everything else.'
      ],
      demo: {
        title: 'Interactive demo — locality, ordering, a clock that misbehaves, and leakage',
        markup: root.IntegerAlgorithmsTemplate.render()
      },
      diagram: diagram(),
      insight: 'The decision worth making explicitly is whether the identifier is a *key* or a ' +
        '*name*. As a key it lives in an index and its cost is locality, so time-ordered wins; as ' +
        'a name it appears in URLs and support tickets and its cost is what it reveals, so random ' +
        'wins. Many systems want both and the answer is to have both — a time-ordered internal ' +
        'key and an opaque external identifier — rather than to compromise on one that is ' +
        'mediocre at each. And whichever you choose, the operational failure to plan for is the ' +
        'clock: a backwards step means either stalling or handing out a duplicate, the ' +
        'duplicate arrives days later as a primary-key violation nobody can reproduce, and the ' +
        'only way to know which your generator does is to test it against a clock you control.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.IntegerAlgorithmsTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const WINDOWS = [8, 16, 32, 64, 128, 256, 512];

  function settingsFor() {
    const values = panel.values();
    return {
      count: Number(values['ia-count']),
      rate: Number(values['ia-rate']),
      window: Number(values['ia-window']),
      pages: Number(values['ia-pages']),
      step: Number(values['ia-step'])
    };
  }

  const schemesFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.EntropyLab.schemeTable({ count: Number(parts[0]),
      idsPerMillisecond: Number(parts[1]), window: Number(parts[2]), pages: Number(parts[3]),
      seed: 42 });
  });

  const sweepFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.EntropyLab.localitySweep({ count: Number(parts[0]),
      idsPerMillisecond: Number(parts[1]), pages: Number(parts[2]), windows: WINDOWS, seed: 42 });
  });

  const clockFor = root.Helpers.memoise(function (key) {
    return root.EntropyLab.clockRegression({ step: Number(key), before: 5, after: 8 });
  });

  const burstFor = root.Helpers.memoise(function () {
    return root.EntropyLab.burst({ count: 5000 });
  });

  function rowFor(rows, id) {
    for (let i = 0; i < rows.length; i += 1) {
      if (rows[i].id === id) return rows[i];
    }
    return rows[0];
  }

  function update(app) {
    const settings = settingsFor();
    const key = settings.count + '|' + settings.rate + '|' + settings.window + '|' + settings.pages;
    const rows = schemesFor(key);

    paintChart(app, sweepFor(settings.count + '|' + settings.rate + '|' + settings.pages));
    paintMetrics(rows, clockFor(String(settings.step)));
    paintSchemes(rows);
    paintWord(rows);
    paintClock(clockFor(String(settings.step)), burstFor(''), settings.step);
    paintLeakage(rows);
  }

  function paintChart(app, sweep) {
    const host = root.jQuery('#ia-chart')[0];
    if (!host) return;
    if (chart) chart.destroy();

    chart = root.GrowthPlot.render(host, {
      lazyLib: app.lazyLib,
      height: 240,
      logX: true,
      xLabel: 'buffer-pool window, in inserts',
      yLabel: 'distinct index pages touched',
      series: sweep.map(function (entry) {
        return { label: entry.id, dots: true,
          points: entry.points.map(function (point) {
            return { x: point.window, y: point.peak };
          }) };
      }),
      legendHost: root.jQuery('#ia-legend')[0]
    });

    root.Helpers.setText('ia-chart-note',
      'The x axis is the window and the y axis is how many distinct pages the inserts inside it ' +
      'touched — which is what the buffer pool has to hold to avoid a read per insert. The ' +
      'random-UUID line is the diagonal y = x: every insert lands on a different page, so the ' +
      'working set is the whole window and grows without bound. Every time-ordered line is flat, ' +
      'because inserts arrive at the end of the key space and stay on one page until it fills.');
  }

  function paintMetrics(rows, clock) {
    const ordered = rows.filter(function (row) { return row.timeOrdered; }).length;
    const random = rowFor(rows, 'uuid4');
    const seven = rowFor(rows, 'uuid7');
    const duplicates = clock.reduce(function (total, row) { return total + row.duplicates; }, 0);

    root.MetricGrid.update({
      'ia-monotonic': { value: root.Format.exact(ordered) + ' of ' + rows.length,
        note: 'no inversions across milliseconds' },
      'ia-random-ws': { value: root.Format.exact(random.peakWorkingSet),
        note: 'switching page on ' + root.Format.fixed(100 * random.switchRate, 1) +
          '% of inserts' },
      'ia-ordered-ws': { value: root.Format.exact(seven.peakWorkingSet),
        note: 'switching page on ' + root.Format.fixed(100 * seven.switchRate, 1) +
          '% of inserts' },
      'ia-duplicates': { value: root.Format.exact(duplicates),
        note: duplicates === 0 ? 'both policies stay unique' : 'a policy is handing out repeats' }
    });
  }

  function paintSchemes(rows) {
    root.jQuery('#ia-schemes tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.label + '</td><td class="mono" style="word-break:break-all">' +
        row.sample + '</td><td>' + row.bits + '</td><td>' + row.randomBits + '</td><td>' +
        root.Format.exact(row.acrossTime) + '</td><td>' + root.Format.exact(row.withinTime) +
        ' of ' + root.Format.exact(row.samePairs) + '</td><td>' +
        root.Format.exact(row.peakWorkingSet) + '</td></tr>';
    }).join(''));

    const seven = rowFor(rows, 'uuid7');
    root.Helpers.setText('ia-schemes-note',
      'The two ordering columns are the ones worth separating. Across milliseconds, every ' +
      'time-ordered scheme scores 0 — they really do sort by creation time. Within a single ' +
      'millisecond, UUIDv7 and ULID come out unordered for about half their same-millisecond ' +
      'pairs (' + root.Format.exact(seven.withinTime) + ' of ' +
      root.Format.exact(seven.samePairs) + ' here), because their low bits are random. Snowflake ' +
      'scores 0 in both because its low bits are a counter. If you page a cursor by id, that ' +
      'column is the difference between a correct query and one that silently drops rows.');
  }

  function paintWord(rows) {
    const host = root.jQuery('#ia-word')[0];
    if (!host) return;
    const snowflake = rowFor(rows, 'snowflake');
    const value = BigInt(snowflake.sample);

    root.BitView.render(host, {
      value: value,
      bits: 64,
      groups: [
        { label: 'unused', from: 0, to: 0, hue: 'gray' },
        { label: 'milliseconds since the epoch', from: 1, to: 41, hue: 'blue' },
        { label: 'machine id', from: 42, to: 51, hue: 'purple' },
        { label: 'sequence', from: 52, to: 63, hue: 'teal' }
      ],
      caption: 'the first Snowflake id this run produced',
      readings: [
        { label: 'as an integer', value: String(value) },
        { label: 'milliseconds since the epoch', value: String(value >> 22n) },
        { label: 'machine id', value: String((value >> 12n) & 0x3ffn) },
        { label: 'sequence within the millisecond', value: String(value & 0xfffn) }
      ]
    });

    root.Helpers.setText('ia-word-note',
      'Every field is readable by anyone holding the id, with two shifts and a mask — that is ' +
      'not a weakness in the scheme, it is the scheme. The timestamp is what makes it sort, the ' +
      'machine id is what removes the coordination, and the twelve sequence bits are a hard ' +
      'ceiling of 4 096 identifiers per machine per millisecond. What it costs is that a ' +
      'competitor holding two of your ids can subtract the sequence numbers and estimate your ' +
      'write rate.');
  }

  function paintClock(rows, burst, step) {
    root.jQuery('#ia-clock tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.policy + '</td><td>' + root.Format.exact(row.issued) + ' of ' +
        root.Format.exact(row.requested) + '</td><td>' + root.Format.exact(row.dropped) +
        '</td><td>' + root.Format.exact(row.duplicates) + '</td><td>' +
        (row.monotonic ? 'yes' : 'NO') + '</td><td>' + root.Format.exact(row.stats.waits) +
        '</td></tr>';
    }).join(''));

    root.Helpers.setText('ia-clock-note',
      'The clock steps back ' + step + ' ms mid-run. Waiting issues every identifier and stalls ' +
      'until real time catches up; refusing keeps latency and drops ' +
      root.Format.exact(rows[1].dropped) + ' requests. Neither produces a duplicate, which is ' +
      'the point — the third option, serving from the stale reading, is the one that does, and ' +
      'the duplicate surfaces days later as a primary-key violation nobody can reproduce. The ' +
      'sequence ceiling is the same failure from the other direction: a burst of ' +
      root.Format.exact(burst.requested) + ' identifiers in one millisecond exhausts the 4 096 ' +
      'sequence values and borrows ' + root.Format.exact(burst.borrowedFromTheFuture) +
      ' millisecond' + (burst.borrowedFromTheFuture === 1 ? '' : 's') + ' from the future, with ' +
      root.Format.exact(burst.duplicates) + ' duplicates.');
  }

  function paintLeakage(rows) {
    root.jQuery('#ia-leak tbody').html(rows.map(function (row) {
      const leak = row.leakage;
      return '<tr><td>' + row.label + '</td><td>' + (leak.creationTime ? 'yes' : 'no') +
        '</td><td>' + (leak.ordering ? 'yes' : 'no') + '</td><td>' +
        (leak.volume ? 'yes' : 'no') + '</td><td>' + (leak.machine ? 'yes' : 'no') +
        '</td></tr>';
    }).join(''));

    root.Helpers.setText('ia-leak-note',
      'Read this table against the locality one and the trade is exact: the columns that make an ' +
      'identifier cheap to index are the same columns that make it informative to a stranger. ' +
      'The sequential integer is the extreme of both — perfect locality, and the value is the ' +
      'row count. Only the random UUID leaks nothing, and it pays for that with a working set ' +
      'the size of the window. There is no scheme that is good at both, which is why systems ' +
      'that need both use two.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
