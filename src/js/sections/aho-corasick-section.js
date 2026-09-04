/**
 * Section: Aho-Corasick multi-pattern matching.
 *
 * The output links are the section. Failure links are KMP's borders
 * generalised and everybody gets them roughly right; output links exist for
 * one case - a pattern that is a suffix of another - and dropping them
 * produces a matcher that finds every occurrence of every pattern except the
 * nested ones, which is a bug that looks like a data problem.
 *
 * The demo can be asked to drop them, so the failure is 2 of 11 matches on
 * `he` inside `she` rather than a paragraph about why it matters.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'aho-corasick';
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — goto, failure and output',
      caption: 'The trie of patterns is the goto function. A failure link points to the state for the ' +
        'longest proper suffix of what this state spells that is also a prefix of some pattern — KMP\'s ' +
        'border, with "the pattern" replaced by "any pattern". An output link chains to the nearest ' +
        'state along that failure path that ends a pattern, and it is the only thing that reports a ' +
        'pattern nested inside another.',
      definition: [
        'flowchart LR',
        '    R["root"] -->|"s"| S["s"]',
        '    S -->|"h"| SH["sh"]',
        '    SH -->|"e"| SHE["she — ends a pattern"]',
        '    R -->|"h"| H["h"]',
        '    H -->|"e"| HE["he — ends a pattern"]',
        '    SHE -.->|"failure"| HE',
        '    SHE -.->|"output"| HE',
        '    SH -.->|"failure"| H'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Searching for `k` patterns by running a single-pattern matcher `k` times costs `k` passes ' +
        'over the text.** Aho-Corasick costs one, whatever `k` is.',
      'Build a trie of the patterns — that is the **goto** function. Then add a **failure link** ' +
        'from each state to the state for the longest proper suffix of what it spells that is also ' +
        'a prefix of some pattern.',
      'That is exactly KMP\'s border with "the pattern" replaced by "any pattern".',
      '**One breadth-first pass builds the links**, because a state\'s failure link is computed from ' +
        'its parent\'s, and BFS is precisely the order that finishes parents first.',
      'Nothing about the construction is deep. What is easy to get wrong is the *reporting*.',
      '**Output links exist for one case and it is the case that bites.** When a pattern is a suffix ' +
        'of another — `he` inside `she`, `ana` inside `banana` — reaching the state for the longer ' +
        'one must also report the shorter. Nothing in the goto trie says so.',
      'The output link chains each state to the nearest state along its failure path that ends a ' +
        'pattern, and following that chain is what makes the report complete. The checkbox below ' +
        'turns them off so the loss is a number.',
      '**The automaton conversion is the same trade as KMP\'s table.** Resolving every failure ' +
        'fallback into a dense `next[state][symbol]` table makes matching one lookup per character ' +
        'with no inner loop, at a cost of `|alphabet| × states` cells.',
      'On DNA that is free; on Unicode it is not. That is why production implementations keep the ' +
        'sparse form and follow links, and why intrusion-detection engines work over bytes.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — the automaton, the nested matches, and the scaling',
        markup: root.AhoCorasickTemplate.render()
      },
      diagram: diagram(),
      insight: 'When a multi-pattern matcher is reported as "missing some matches", the first thing ' +
        'to check is whether any pattern in the set is a suffix of another. That single question ' +
        'resolves most of these reports. It is also why keyword lists that grow organically break ' +
        'long after the matcher was written and tested — a content filter, an intrusion signature ' +
        'set, a tokeniser\'s reserved words. Nobody adds `he` to a list that already contains `she` ' +
        'on the day the matcher is built.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.AhoCorasickTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  /* -------------------------------------------------------------- fixtures */

  const SETS = {
    suffix: ['he', 'she', 'his', 'hers', 'her'],
    dna: ['GAT', 'TAC', 'ACA', 'GATTACA', 'TA'],
    logs: ['GET', 'POST', '200', '500', '/api']
  };

  const corpusFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');

    /* The nested case needs a text that actually contains one pattern inside
       another; on ordinary English "she" is rare enough that the output chain
       is never followed and a broken implementation looks correct. */
    if (parts[0] === 'fixture') {
      const built = root.AhoCorasick.suffixSet();

      return { name: 'fixture', text: built.text, pattern: 'he',
        alphabet: root.MatchLab.alphabetOf(built.text) };
    }
    return root.MatchLab.corpus(parts[0], { size: Number(parts[1]) });
  });

  function patternsOf(values) {
    if (SETS[values['ahc-set']]) return SETS[values['ahc-set']];
    const instance = corpusFor(values['ahc-corpus'] + '|' + values['ahc-size']);
    const words = instance.text.split(/[^A-Za-z]+/).filter(function (w) { return w.length >= 3; });
    const out = [];

    words.forEach(function (word) {
      if (out.length >= 8 || out.indexOf(word) !== -1) return;
      out.push(word);
    });
    return out;
  }

  const runFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const instance = corpusFor(parts[0] + '|' + parts[1]);
    const patterns = parts[2].split(',');

    return { instance: instance,
      good: root.MatchLab.multiRun(instance, { patterns: patterns, outputLinks: true }),
      broken: root.MatchLab.multiRun(instance, { patterns: patterns, outputLinks: false }) };
  });

  const scalingFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const instance = corpusFor(parts[0] + '|' + parts[1]);

    return root.MatchLab.patternCountSweep(instance, { counts: [1, 2, 4, 8, 16, 32] });
  });

  const tableFor = root.Helpers.memoise(function (key) {
    const patterns = key.split(',');

    return ['english', 'dna', 'binary', 'source'].map(function (name) {
      const instance = root.MatchLab.corpus(name, { size: 4000 });
      const automaton = root.AhoCorasick.build(patterns, {});
      const dense = root.AhoCorasick.toAutomaton(automaton, instance.alphabet);

      return { name: name, instance: instance, automaton: automaton, dense: dense };
    });
  });

  /* -------------------------------------------------------------- painting */

  function update(app) {
    const values = panel.values();
    const patterns = patternsOf(values);
    const key = values['ahc-corpus'] + '|' + values['ahc-size'] + '|' + patterns.join(',');
    const state = runFor(key);
    const chosen = values['ahc-output'] ? state.good : state.broken;

    paintMetrics(state, chosen);
    paintStates(state.good, patterns);
    paintFound(state, chosen);
    paintScaling(scalingFor(values['ahc-corpus'] + '|' + values['ahc-size']), app);
    paintLinks(state);
    paintTable(tableFor(patterns.join(',')));
  }

  function paintMetrics(state, chosen) {
    const compare = chosen.compare;

    root.MetricGrid.update({
      'ahc-matches': { value: root.Format.exact(chosen.matches.length),
        note: compare.agree ? 'every occurrence of every pattern, exactly once'
          : root.Format.exact(compare.expected) + ' expected' },
      'ahc-missing': { value: root.Format.exact(compare.missing),
        note: compare.missing === 0 ? 'nothing missed and nothing double-reported'
          : 'all of them are patterns nested inside another pattern' },
      'ahc-states': { value: root.Format.exact(state.good.states),
        note: root.Format.plural(state.good.patterns.length, 'pattern') + ', ' +
          root.Format.exact(state.good.automaton.report.edges) + ' goto edges' },
      'ahc-saving': { value: root.Format.fixed(state.good.saving, 2) + '×',
        note: root.Format.exact(state.good.comparisons) + ' against ' +
          root.Format.exact(state.good.separate) + ' for one naive scan per pattern' }
    });
  }

  function paintStates(run, patterns) {
    const states = run.automaton.states;
    const rows = [];

    for (let id = 0; id < Math.min(states.length, 16); id += 1) {
      const state = states[id];

      rows.push({ cells: [String(id), String(state.depth),
        Object.keys(state.next).map(root.AlignmentView.display).join(' ') || '—',
        String(state.fail),
        state.output === -1 || state.output === undefined ? '—' : String(state.output),
        state.ends.length === 0 ? '—'
          : state.ends.map(function (i) { return patterns[i]; }).join(', ')] });
    }
    root.MatrixView.render(root.jQuery('#ahc-automaton')[0], {
      columns: ['state', 'depth', 'goto on', 'failure link', 'output link', 'ends pattern'],
      rows: rows
    });
    root.jQuery('#ahc-automaton-note').text(root.Format.plural(states.length, 'state') + ' for ' +
      root.Format.plural(patterns.length, 'pattern') + ' — one per distinct prefix of any of them, ' +
      'which is why a large keyword set costs memory proportional to its total distinct prefix ' +
      'count rather than to its total length. The output-link column is empty for most states and ' +
      'that is expected: it points somewhere only when this state\'s failure path passes through a ' +
      'state that ends a pattern, which is exactly the nested case.');
  }

  function paintFound(state, chosen) {
    const patterns = state.good.patterns;
    const good = root.AhoCorasick.sortMatches(state.good.matches);
    const brokenKeys = new Set(state.broken.matches.map(function (m) {
      return m.pattern + '@' + m.start;
    }));
    const rows = good.slice(0, 14).map(function (match) {
      const key = match.pattern + '@' + match.start;

      return { cells: [String(match.start), patterns[match.pattern],
        String(match.end), brokenKeys.has(key) ? 'goto trie' : 'output link ONLY',
        brokenKeys.has(key) ? 'found either way' : 'lost when output links are dropped'] };
    });

    root.MatrixView.render(root.jQuery('#ahc-found')[0], {
      columns: ['start', 'pattern', 'end', 'reported by', 'without output links'], rows: rows
    });
    const onlyOutput = good.filter(function (match) {
      return !brokenKeys.has(match.pattern + '@' + match.start);
    }).length;

    root.jQuery('#ahc-found-note').text(root.Format.exact(onlyOutput) + ' of these ' +
      root.Format.exact(good.length) + ' matches are reported by the output chain alone. ' +
      (onlyOutput === 0
        ? 'On this pattern set no pattern is a suffix of another, so the chain is never followed and ' +
          'an implementation without it would look perfectly correct — which is the whole hazard.'
        : 'Every one of them is a pattern that ends inside a longer pattern, and every one of them ' +
          'disappears when the checkbox above is cleared. The matcher then reports ' +
          root.Format.exact(chosen.matches.length) + ' matches with no error and no warning.'));
  }

  function paintScaling(rows, app) {
    const html = rows.map(function (row) {
      return '<tr><td class="mono">' + root.Format.exact(row.count) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.states) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.comparisons) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.separate) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.saving, 2) + '×</td>' +
        '<td>' + (row.agree ? 'yes' : 'NO') + '</td></tr>';
    }).join('');

    root.jQuery('#ahc-scaling tbody').html(html);
    drawScalingChart(rows, app);
    const first = rows[0];
    const last = rows[rows.length - 1];

    root.jQuery('#ahc-scaling-note').text('The automaton column barely moves — ' +
      root.Format.exact(first.comparisons) + ' at ' +
      root.Format.plural(first.count, 'pattern') + ' and ' +
      root.Format.exact(last.comparisons) + ' at ' + root.Format.exact(last.count) +
      ' — because it is one pass over the text whatever the set size. The naive column is linear in ' +
      'the set: ' + root.Format.exact(first.separate) + ' against ' +
      root.Format.exact(last.separate) + '. The saving goes from ' +
      root.Format.fixed(first.saving, 2) + '× to ' + root.Format.fixed(last.saving, 2) +
      '×, and it keeps growing, which is the only reason to build an automaton at all. At one ' +
      'pattern it is a loss.');
  }

  function drawScalingChart(rows, app) {
    const host = root.jQuery('#ahc-chart')[0];

    if (!host) return;
    root.GrowthPlot.render(host, {
      lazyLib: app.lazyLib,
      logX: true,
      logY: true,
      height: 220,
      series: [
        { label: 'Aho-Corasick, one pass', points: rows.map(function (row) {
          return { x: row.count, y: row.comparisons }; }) },
        { label: 'one naive scan per pattern', points: rows.map(function (row) {
          return { x: row.count, y: row.separate }; }) }
      ],
      xLabel: 'patterns',
      yLabel: 'character comparisons',
      legendHost: root.jQuery('#ahc-legend')[0],
      summary: function () {
        return 'Work against the pattern-set size, both axes logarithmic.';
      }
    });
  }

  function paintLinks(state) {
    const rows = [
      linkRow('with output links', state.good),
      linkRow('output links dropped', state.broken)
    ].join('');

    root.jQuery('#ahc-links tbody').html(rows);
    root.jQuery('#ahc-links-note').text('Dropping the output links loses ' +
      root.Format.exact(state.broken.compare.missing) + ' of ' +
      root.Format.exact(state.good.matches.length) + ' matches and reports nothing unusual. The ' +
      'failure-link column is identical in both rows, because the links are still there and still ' +
      'followed — what changed is only whether a state reports the patterns that end along its ' +
      'failure path as well as its own. That is a five-line difference in the source and the whole ' +
      'difference between a correct multi-pattern matcher and one that quietly under-reports.');
  }

  function linkRow(name, run) {
    return '<tr><td>' + name + '</td>' +
      '<td class="mono">' + root.Format.exact(run.matches.length) + '</td>' +
      '<td class="mono">' + root.Format.exact(run.truth.length) + '</td>' +
      '<td class="mono">' + root.Format.exact(run.compare.missing) + '</td>' +
      '<td class="mono">' + root.Format.exact(run.failureFollows) + '</td>' +
      '<td class="mono">' + root.Format.exact(run.outputFollows) + '</td></tr>';
  }

  function paintTable(rows) {
    const html = rows.map(function (row) {
      const sparse = row.automaton.report.edges;

      return '<tr><td>' + row.name + '</td>' +
        '<td class="mono">' + root.Format.exact(row.instance.alphabet.length) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.dense.states) + '</td>' +
        '<td class="mono">' + root.Format.exact(sparse) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.dense.cells) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.dense.cells / Math.max(1, sparse), 1) +
          '×</td></tr>';
    }).join('');
    const dna = rows.filter(function (row) { return row.name === 'dna'; })[0];
    const source = rows.filter(function (row) { return row.name === 'source'; })[0];

    root.jQuery('#ahc-table tbody').html(html);
    root.jQuery('#ahc-table-note').text('The dense table resolves every failure fallback in ' +
      'advance, so matching is one lookup per character and the failure links are never followed at ' +
      'run time. It costs alphabet × states: ' + root.Format.exact(dna.dense.cells) +
      ' cells on DNA against ' + root.Format.exact(source.dense.cells) +
      ' on source code, for the identical automaton. That is the whole reason ' +
      'intrusion-detection and content-filter engines work over bytes rather than characters — 256 ' +
      'is affordable, a Unicode alphabet is not, and the sparse form with link-following is what ' +
      'you ship when it is not.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
