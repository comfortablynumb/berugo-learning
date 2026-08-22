/**
 * Section: text processing in production.
 *
 * The pipeline panel is the point of the whole milestone. Every matching
 * system in practice is normalise, prefilter, verify - and the number that
 * decides its throughput is candidates per result, not the verifier's speed.
 * The blocking checkbox turns the prefilter off so that number moves by an
 * order of magnitude while precision and recall do not, which is the clearest
 * way to say that the two are separate concerns.
 *
 * The metrics panel is the second point: four similarity measures on the same
 * pairs, chosen so that each one is wrong about at least one of them.
 * Jaro-Winkler weights a shared prefix, which is right for names and actively
 * misleading for identifiers like `service-a` and `service-b`.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'text-processing';
  const THRESHOLDS = [20, 30, 40, 50, 60, 70, 80, 90];
  const PAIRS = [
    { a: 'Jon Smyth', b: 'John Smith', want: 'yes — a spelling variant of one name' },
    { a: 'service-a', b: 'service-b', want: 'NO — different services' },
    { a: 'Elizabeth Windsor', b: 'Windsor Elizabeth', want: 'yes — the same name, reordered' },
    { a: 'catherine', b: 'katherine', want: 'yes — a first-letter variant' },
    { a: 'user-1234', b: 'user-1235', want: 'NO — different accounts' },
    { a: 'MacDonald', b: 'McDonald', want: 'yes — a common surname variant' }
  ];
  const NEAR = ['John Smith', 'Jon Smith', 'Jane Smith', 'John Smyth', 'Jonathan Smith',
    'J. Smith', 'John Smithson', 'Joan Smit', 'Johnny Smith', 'Jon Smythe', 'James Smith'];
  const FIRST = ['Michael', 'Sarah', 'David', 'Emma', 'Robert', 'Laura', 'Peter', 'Anna',
    'Thomas', 'Helen', 'George', 'Clara', 'Henry', 'Alice', 'Oliver', 'Grace'];
  const LAST = ['Brown', 'Jones', 'Wilson', 'Taylor', 'Davies', 'Evans', 'Thomas', 'Roberts',
    'Walker', 'Wright', 'Green', 'Hall', 'Wood', 'Clarke', 'Baker', 'Harris'];
  const EXPECTED = ['John Smith', 'Jon Smith', 'John Smyth', 'Jon Smythe'];

  /* A realistic directory rather than a handful of names: with fifteen records
     a blocking stage removes four of them and the selectivity conversation is
     unmeasurable. The interesting number needs a haystack. */
  function directory() {
    const out = NEAR.slice();

    FIRST.forEach(function (first) {
      LAST.forEach(function (last) { out.push(first + ' ' + last); });
    });
    return out;
  }

  const RECORDS = directory();
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — the prefilter/verify pipeline, with the selectivity at each stage',
      caption: 'Every stage narrows, and the cost of a stage is its input count times its per-record ' +
        'cost. The prefilter runs once per record and the verifier runs once per candidate, so the ' +
        'candidate count multiplies the expensive stage. Halving the verifier halves half the cost; ' +
        'making the filter ten times more selective removes ninety per cent of it.',
      definition: [
        'flowchart LR',
        '    R["all records"] --> N["normalise<br/>cheap, runs on everything"]',
        '    N --> B["block by q-gram<br/>cheap, runs on everything"]',
        '    B --> C["candidates"]',
        '    C --> V["verify by Jaro-Winkler<br/>EXPENSIVE, runs per candidate"]',
        '    V --> M["matches"]',
        '    C --> S["candidates per result<br/>is what decides throughput"]'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        '**Normalisation decides more matches than the metric does.** Lower-casing, stripping ' +
          'punctuation and collapsing whitespace is four lines that nobody argues about, and it ' +
          'changes the answer more than the choice between Levenshtein and Jaro-Winkler. It is also ' +
          'the step people skip when they are comparing metrics, which makes the comparison a ' +
          'comparison of two normalisers.',
        '**Tokenisation is a choice with visible consequences.** Whitespace splitting makes ' +
          '`v1.2.3` one token; a rule-based tokeniser makes it five; byte-pair encoding learns a ' +
          'vocabulary from the corpus so that common sequences become single tokens and rare ones ' +
          'decompose. The panel measures characters-per-token as the merges accumulate, which is ' +
          'the number a subword tokeniser exists to move.',
        '**Log-template extraction is clustering with a threshold**, and the threshold is the whole ' +
          'tuning surface. Too low and every line collapses into one template full of wildcards; ' +
          'too high and every line is its own template. The sweep below runs the same corpus at ' +
          'eight settings and the template count moves by an order of magnitude, which is why a ' +
          'log-parsing pipeline that was tuned once and never re-tuned degrades silently as the log ' +
          'format drifts.',
        '**The prefilter\'s selectivity decides the throughput.** The verifier runs once per ' +
          'candidate and the filter runs once per record, so the candidates-per-result ratio ' +
          'multiplies the expensive stage. Turn the blocking off in the panel below and watch that ' +
          'ratio move by an order of magnitude while precision and recall do not move at all — ' +
          'those are separate concerns, and conflating them is how a matching system ends up ' +
          'optimised in the wrong place.'
      ],
      demo: {
        title: 'Interactive demo — templates, tokenisers, four metrics, and the pipeline',
        markup: root.TextProcessingTemplate.render()
      },
      diagram: diagram(),
      insight: 'Measure candidates-per-result before optimising anything in a matching pipeline. ' +
        'It is one counter, it takes ten minutes to add, and it tells you whether the work is in ' +
        'the filter or the verifier — which is the only question that decides where the next month ' +
        'goes. Almost every "our matching is too slow" investigation ends at a prefilter that was ' +
        'admitting fifty candidates per result, and almost none of them start there.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.TextProcessingTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  /* -------------------------------------------------------------- fixtures */

  const linesFor = root.Helpers.memoise(function (key) {
    return root.TextCorpus.logs(Number(key));
  });

  const templatesFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const report = root.TextPipeline.emptyReport();

    return { run: root.TextPipeline.extractTemplates(linesFor(parts[0]),
      { threshold: Number(parts[1]) / 100, report: report }), report: report };
  });

  const sweepFor = root.Helpers.memoise(function (key) {
    return THRESHOLDS.map(function (threshold) {
      const state = templatesFor(key + '|' + threshold);
      const biggest = state.run.templates[0] || { tokens: [], count: 0 };

      return { threshold: threshold, state: state, biggest: biggest,
        wildcards: biggest.tokens.filter(function (t) { return t === '<*>'; }).length };
    });
  });

  const bpeFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const text = linesFor(parts[0]).join(' ');

    return root.TextPipeline.bytePairEncoding(text, { merges: Number(parts[1]) });
  });

  const metricsFor = root.Helpers.memoise(function () {
    return PAIRS.map(function (pair) {
      const a = root.TextPipeline.normalise(pair.a);
      const b = root.TextPipeline.normalise(pair.b);

      return { pair: pair,
        levenshtein: root.TextPipeline.levenshteinRatio(a, b),
        jaro: root.TextPipeline.jaroWinkler(a, b, {}),
        jaccard: root.TextPipeline.jaccard(root.TextPipeline.shingles(a, 2),
          root.TextPipeline.shingles(b, 2)),
        cosine: root.TextPipeline.cosine(a, b, 2) };
    });
  });

  const pipelineFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');

    return ['blocked', 'unblocked'].map(function (mode) {
      const report = root.TextPipeline.emptyReport();
      const run = root.TextPipeline.namePipeline(parts[0], RECORDS,
        { cutoff: Number(parts[1]) / 100, block: mode === 'blocked', report: report });

      return { mode: mode, run: run, report: report,
        score: root.TextPipeline.score(run.matches, EXPECTED) };
    });
  });

  /* -------------------------------------------------------------- painting */

  function update(app) {
    const values = panel.values();
    const lines = String(values['txp-lines']);
    const templates = templatesFor(lines + '|' + values['txp-threshold']);
    const bpe = bpeFor(lines + '|' + values['txp-merges']);
    const query = String(values['txp-query'] || 'Jon Smyth').trim() || 'Jon Smyth';
    const pipeline = pipelineFor(query + '|' + values['txp-cutoff']);
    const chosen = values['txp-block'] ? pipeline[0] : pipeline[1];

    paintMetrics(templates, bpe, chosen);
    paintTemplates(templates);
    paintSweep(sweepFor(lines), app);
    paintTokens(linesFor(lines), bpe);
    paintMetricsTable(metricsFor('fixed'));
    paintPipeline(pipeline);
  }

  function paintMetrics(templates, bpe, chosen) {
    root.MetricGrid.update({
      'txp-templates': { value: root.Format.exact(templates.report.templates),
        note: 'from ' + root.Format.plural(templates.report.records, 'raw line') },
      'txp-compression': { value: root.Format.fixed(bpe.characters / Math.max(1, bpe.tokens), 2),
        note: root.Format.exact(bpe.tokens) + ' tokens from ' +
          root.Format.exact(bpe.characters) + ' characters, vocabulary ' +
          root.Format.exact(bpe.vocabulary.size) },
      'txp-selectivity': { value: root.Format.fixed(chosen.run.candidatesPerResult, 1),
        note: root.Format.exact(chosen.report.candidates) + ' candidates for ' +
          root.Format.exact(chosen.report.verified) + ' results, from ' +
          root.Format.exact(chosen.report.records) + ' records' },
      'txp-quality': { value: root.Format.fixed(100 * chosen.score.precision, 0) + '% / ' +
        root.Format.fixed(100 * chosen.score.recall, 0) + '%',
      note: root.Format.exact(chosen.score.hit) + ' of ' +
        root.Format.exact(chosen.score.expected) + ' expected, ' +
        root.Format.exact(chosen.score.found) + ' returned' }
    });
  }

  function paintTemplates(state) {
    const rows = state.run.templates.slice(0, 10).map(function (entry) {
      const wildcards = entry.tokens.filter(function (t) { return t === '<*>'; }).length;

      return { cells: [entry.tokens.join(' '), String(entry.count),
        String(wildcards) + ' of ' + entry.tokens.length,
        wildcards === 0 ? 'a literal line, seen more than once'
          : (wildcards === entry.tokens.length ? 'everything is a wildcard — the threshold is too low'
            : 'the variable fields, identified')] };
    });

    root.MatrixView.render(root.jQuery('#txp-groups')[0], {
      columns: ['Template', 'Lines covered', 'Wildcards', 'Reading'], rows: rows
    });
    root.jQuery('#txp-groups-note').text(root.Format.plural(state.report.templates, 'template') +
      ' from ' + root.Format.plural(state.report.records, 'line') + ', at ' +
      root.Format.exact(state.report.comparisons) + ' token comparisons. The `<*>` positions are ' +
      'where lines in the same group disagreed, which is exactly the definition of a variable ' +
      'field — no schema, no regex, no configuration. That is what makes Drain-style extraction ' +
      'usable on a log format nobody documented, and the threshold above is the only knob.');
  }

  function paintSweep(rows, app) {
    const html = rows.map(function (row) {
      return '<tr><td class="mono">' + root.Format.fixed(row.threshold / 100, 2) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.state.report.templates) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.biggest.count) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.wildcards) + ' of ' +
          root.Format.exact(row.biggest.tokens.length) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.state.report.comparisons) + '</td></tr>';
    }).join('');
    const low = rows[0];
    const high = rows[rows.length - 1];

    root.jQuery('#txp-sweep tbody').html(html);
    drawSweepChart(rows, app);
    root.jQuery('#txp-sweep-note').text('At a threshold of ' +
      root.Format.fixed(low.threshold / 100, 2) + ' the corpus collapses to ' +
      root.Format.plural(low.state.report.templates, 'template') + ' whose largest covers ' +
      root.Format.plural(low.biggest.count, 'line') + ' with ' +
      root.Format.exact(low.wildcards) + ' of its ' +
      root.Format.exact(low.biggest.tokens.length) + ' positions wildcarded; at ' +
      root.Format.fixed(high.threshold / 100, 2) + ' there are ' +
      root.Format.exact(high.state.report.templates) + '. A template that is all wildcards matches ' +
      'every line and tells an operator nothing; one template per line is the raw log with extra ' +
      'steps. The useful setting is in between, it depends on the format, and nothing in the ' +
      'algorithm finds it for you.');
  }

  function drawSweepChart(rows, app) {
    const host = root.jQuery('#txp-chart')[0];

    if (!host) return;
    root.GrowthPlot.render(host, {
      lazyLib: app.lazyLib,
      height: 210,
      series: [
        { label: 'templates', points: rows.map(function (row) {
          return { x: row.threshold / 100, y: row.state.report.templates }; }) },
        { label: 'lines in the largest template', points: rows.map(function (row) {
          return { x: row.threshold / 100, y: row.biggest.count }; }) }
      ],
      xLabel: 'similarity threshold',
      yLabel: 'count',
      legendHost: root.jQuery('#txp-legend')[0],
      summary: function () { return 'Template count and largest-template coverage against the threshold.'; }
    });
  }

  function paintTokens(lines, bpe) {
    const sample = lines[0] || 'GET /api/orders 200 12ms';
    const rows = [
      { cells: ['whitespace', String(root.TextPipeline.whitespace(sample).length),
        root.TextPipeline.whitespace(sample).join(' · '),
        'a version string or a path is one token'] },
      { cells: ['rule-based', String(root.TextPipeline.ruleBased(sample).length),
        root.TextPipeline.ruleBased(sample).join(' · '),
        'letters, digits and punctuation split apart'] },
      { cells: ['byte-pair, ' + bpe.report.merges + ' merges',
        root.Format.fixed(bpe.characters / Math.max(1, bpe.tokens), 2) + ' chars/token',
        'vocabulary of ' + bpe.vocabulary.size,
        'common sequences become one token; rare ones decompose'] }
    ];

    root.MatrixView.render(root.jQuery('#txp-tokens')[0], {
      columns: ['Tokeniser', 'Tokens', 'Result', 'What it does to a version string'], rows: rows
    });
    root.jQuery('#txp-tokens-note').text('The same line, three ways. Whitespace splitting is fast ' +
      'and treats `/api/orders` as an atom, which is right for routing and wrong for finding every ' +
      'request under `/api`. Rule-based splits it into pieces that can be indexed separately. ' +
      'Byte-pair encoding learns which sequences are worth keeping whole from the corpus itself: at ' +
      root.Format.plural(bpe.report.merges, 'merge') + ' it reaches ' +
      root.Format.fixed(bpe.characters / Math.max(1, bpe.tokens), 2) +
      ' characters per token on a vocabulary of ' + root.Format.exact(bpe.vocabulary.size) +
      '. Move the merge slider to zero and it is a character tokeniser; move it up and the ' +
      'vocabulary grows while the token count falls, which is the whole trade a subword tokeniser ' +
      'is making.');
  }

  function paintMetricsTable(rows) {
    const html = rows.map(function (row) {
      return '<tr><td>' + row.pair.a + ' / ' + row.pair.b + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.levenshtein, 3) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.jaro, 3) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.jaccard, 3) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.cosine, 3) + '</td>' +
        '<td>' + row.pair.want + '</td></tr>';
    }).join('');
    const identifiers = rows.filter(function (row) {
      return row.pair.want.indexOf('NO') === 0;
    });
    const worst = identifiers.sort(function (a, b) { return b.jaro - a.jaro; })[0];

    root.jQuery('#txp-similarity tbody').html(html);
    root.jQuery('#txp-similarity-note').text('Read the rows marked NO. Jaro-Winkler scores "' +
      worst.pair.a + '" against "' + worst.pair.b + '" at ' +
      root.Format.fixed(worst.jaro, 3) + ' — above almost any cutoff anybody would set — because ' +
      'it weights a shared PREFIX, which is exactly right for names where variation lands at the ' +
      'end and exactly wrong for identifiers where the discriminating character does. No metric ' +
      'here is correct on all six pairs, and a matching system that uses one metric for names and ' +
      'ids alike will confidently merge two accounts.');
  }

  function paintPipeline(rows) {
    const html = rows.map(function (row) {
      return '<tr><td>' + (row.mode === 'blocked' ? 'normalise → block → verify'
        : 'normalise → verify (no blocking)') + '</td>' +
        '<td class="mono">' + root.Format.exact(row.report.records) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.report.candidates) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.run.selectivity, 3) + '</td>' +
        '<td class="mono">' + root.Format.fixed(100 * row.score.precision, 0) + '%</td>' +
        '<td class="mono">' + root.Format.fixed(100 * row.score.recall, 0) + '%</td></tr>';
    }).join('');
    const blocked = rows[0];
    const plain = rows[1];

    root.jQuery('#txp-pipeline tbody').html(html);
    root.jQuery('#txp-pipeline-note').text('Blocking cuts the candidate count from ' +
      root.Format.exact(plain.report.candidates) + ' to ' +
      root.Format.exact(blocked.report.candidates) + ' — a selectivity of ' +
      root.Format.fixed(blocked.run.selectivity, 3) + ' against ' +
      root.Format.fixed(plain.run.selectivity, 3) + ' — while precision goes from ' +
      root.Format.fixed(100 * plain.score.precision, 0) + '% to ' +
      root.Format.fixed(100 * blocked.score.precision, 0) + '% and recall from ' +
      root.Format.fixed(100 * plain.score.recall, 0) + '% to ' +
      root.Format.fixed(100 * blocked.score.recall, 0) + '%. Those are the two separate ' +
      'conversations: the filter decides the cost and the verifier decides the answer, and a ' +
      'filter that changes the answer is not a filter but a second verifier with no bound on its ' +
      'error. Report both columns or the first optimisation will be in the wrong stage.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
