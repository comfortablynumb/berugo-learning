/**
 * Section: Type-based and flow-sensitive analysis, demonstrated on taint.
 *
 * Two implementations answer two different questions about the same
 * programme. `Taint.analyse` reports the sinks a tainted value COULD reach;
 * `TaintOracle.run` runs the thing and reports what did. Every finding is
 * then confirmed or refuted rather than asserted, which is what stops a
 * results table from being a list of opinions.
 *
 * The one place that reading needs care is the `branchy` fixture, and it is in
 * the section for exactly that reason: the run takes the sanitised branch, so
 * the oracle calls a genuine vulnerability a false positive. A dynamic oracle
 * sees one execution. It can refute a claim about every execution and it can
 * never confirm one, and a table that said "false positive" without saying
 * "on this run" would be teaching the opposite.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'taint-analysis';
  const FIXTURES = ['direct', 'record', 'array', 'backedge', 'branchy', 'ignores'];
  const MODES = ['insensitive', 'sensitive'];
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
      title: 'Diagram — the three declarations the whole model rests on',
      caption: 'Taint analysis is small enough to be sound in practice for a fixed framework, '
        + 'and everything it can do follows from three lists: what introduces untrusted data, '
        + 'what must never receive it, and what is trusted to clean it. The algorithm is a '
        + 'reachability walk. The engineering — and every false negative — is in the lists.',
      definition: [
        'flowchart LR',
        'S["source<br/>readParam, readCookie"] --> P["any value derived from it<br/>is tainted too"]',
        'P --> Q{"does a sanitiser<br/>touch it?"}',
        'Q -->|"yes"| C["clean — the analysis<br/>trusts the declaration"]',
        'Q -->|"no"| K["sink<br/>query, exec, render"]',
        'K --> F["a finding, with the whole path"]',
        'U["a source nobody declared"] -.->|"no taint, no finding,<br/>no warning"| Z["the vulnerability<br/>you never hear about"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**A type system is a static analysis that the language forces you to pass, and every '
        + 'other analysis in this section is the same machinery without that leverage.** The '
        + 'type checker propagates a fact — "this expression is an int" — through the program '
        + 'and rejects what it cannot justify. Nullability, definite assignment and taint are '
        + 'the same walk carrying a different fact, and they differ mainly in whether the '
        + 'compiler refuses to build.',
      '**Flow sensitivity is what makes those analyses feel intelligent.** After `if (x != '
        + 'null)`, the type of `x` inside the branch is narrower than its declared type. That '
        + 'narrowing is a per-program-point fact, which is what "flow-sensitive" means, and it '
        + 'is why a modern checker accepts code that a declaration-only checker rejects.',
      '**Nullability tracking is the billion-dollar mistake being paid back in analysis.** '
        + 'Making the possibility of absence part of the type turns a class of run-time '
        + 'failures into a compile-time one — and the reason it took decades is that retro'
        + '-fitting it to an existing language means classifying every existing signature, '
        + 'which is annotation burden rather than algorithmic difficulty.',
      '**Definite assignment is the tiny one, and it shows the shape clearly.** "Has this '
        + 'variable been written on every path to here?" is a forward analysis over the CFG '
        + 'with one bit per variable, joining at merges by taking the AND. It is the same '
        + 'fixpoint as the interval analysis in 32.2, with the cheapest possible lattice.',
      '**Taint analysis carries the fact "this value came from somewhere untrusted".** A '
        + 'source introduces it, arithmetic and copies propagate it, a sanitiser removes it, '
        + 'and a sink reports it. The demo prints the whole path from source to sink because '
        + 'the path is the part an engineer acts on — a finding without one is a line number '
        + 'and a guess.'
    ];
  }

  function moreOrientation() {
    return [
      '**The propagation rule for an unknown function is the conservative one, and it is where '
        + 'the false positives come from.** In the `ignores` fixture a callee takes the tainted '
        + 'value and returns a constant; the analysis reports the sink anyway, because "this '
        + 'function does not pass its argument through" is a fact nobody gave it. Real tools '
        + 'ship a summary per library function for exactly this reason.',
      '**Field sensitivity is a precision axis you can switch on here and watch pay for '
        + 'itself.** Field-insensitively a record is one location, so a clean field of a record '
        + 'that also holds a tainted one is reported: one false positive on the `record` '
        + 'fixture, gone the moment each field gets its own location. The `array` fixture does '
        + 'not improve, because an array is one location under both — index sensitivity is a '
        + 'different axis and almost nobody pays for it.',
      '**The analysis needs a fixpoint, not a pass, because taint can arrive backwards.** In '
        + 'the `backedge` fixture a variable is copied before the value it will hold becomes '
        + 'tainted, so the first sweep sees nothing and the second reports it. One pass over '
        + 'the block list would be quietly wrong on every loop.',
      '**The policy is the model, and the sweep prices both ways it fails.** Undeclare a '
        + 'source or a sink and findings disappear — false negatives, silent. Undeclare a '
        + 'sanitiser and findings appear — false positives, noisy. A deployment spends its life '
        + 'on this table and almost none of it on the algorithm.',
      '**A run can refute a claim about every execution and can never confirm one.** The '
        + '`branchy` fixture is in the demo to make that concrete: the observed run takes the '
        + 'sanitised branch, so the oracle marks a real vulnerability as clean. That is why '
        + 'every column here says "on this run" and why the count of sinks the run reached is '
        + 'reported beside the verdicts.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation().concat(moreOrientation()),
      demo: { title: 'Interactive demo — what could arrive, and what did',
        markup: root.TaintTemplate.render() },
      diagram: diagram(),
      insight: '**Taint analysis is the highest-value static analysis in application security, '
        + 'and the reason is that its model is small enough to be nearly complete for a fixed '
        + 'framework.** For a given web framework there are perhaps forty places untrusted data '
        + 'enters, thirty that must not receive it, and a dozen trusted cleaners. That list is '
        + 'writable by one engineer in a week, and once it exists the algorithm is a '
        + 'reachability walk that a hundred-thousand-line codebase runs through in seconds. '
        + 'Compare that with proving a program correct. What this means in practice is that '
        + 'when you adopt such a tool, the work is not learning the tool: it is auditing its '
        + 'source and sink lists against the framework you actually use, and adding the '
        + 'internal ones — your own RPC layer, your own template renderer, the deserialiser '
        + 'somebody wrote in 2019. Every undeclared source is a silent false negative, and '
        + 'silence is what these tools produce when they are wrong in the direction that hurts. '
        + 'The second practical consequence is about sanitisers: the analysis trusts them '
        + 'absolutely, so a sanitiser that is wrong — escaping for HTML on the way into a SQL '
        + 'string — turns the tool into a machine for producing confident clean reports about '
        + 'exploitable code. Review the sanitiser list the way you would review a cryptographic '
        + 'primitive, because it occupies the same position: everything downstream is trusting '
        + 'it, and nothing downstream will check.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({
      controls: root.TaintTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  function policyFor(fields) {
    return Object.assign(root.Taint.defaultPolicy(), { fields: fields });
  }

  function sourceOf(name) {
    return root.TaintTemplate.PRELUDE + root.TaintTemplate.SAMPLES[name].body;
  }

  /** One fixture at one container precision: the static claim, the run, and
   *  the two lined up per sink call site. */
  function measure(name, fields) {
    const source = sourceOf(name);
    const compiled = root.StaticLab.compile(source);
    const main = mainOf(compiled.program);
    const policy = policyFor(fields);
    const analysis = root.Taint.analyse(main, { policy: policy });
    const observed = root.TaintOracle.run(compiled.program, { policy: policy });

    return { name: name, source: source, fields: fields, main: main,
      analysis: analysis, observed: observed,
      sweep: root.Taint.policySweep(main, policy),
      sinks: judge(source, analysis, observed) };
  }

  function mainOf(program) {
    return program.functions.filter(function (fn) { return fn.name === 'main'; })[0]
      || program.functions[0];
  }

  /**
   * One row per sink call site the run reached, plus any the analysis flagged
   * and the run never executed — those are neither confirmed nor refuted, and
   * saying so is more honest than a missing row.
   */
  function judge(source, analysis, observed) {
    const rows = {};

    observed.sinks.forEach(function (hit) {
      const key = hit.span.start;

      rows[key] = rows[key] || { at: key, sink: hit.sink, ran: 0, tainted: false,
        flagged: false, line: lineOf(source, key) };
      rows[key].ran += 1;
      rows[key].tainted = rows[key].tainted || hit.tainted;
    });
    analysis.findings.forEach(function (finding) {
      const key = finding.span.start;

      rows[key] = rows[key] || { at: key, sink: finding.sink, ran: 0, tainted: false,
        flagged: false, line: lineOf(source, key) };
      rows[key].flagged = true;
      rows[key].hops = finding.hops;
      rows[key].path = finding.path;
    });
    return Object.keys(rows).map(function (key) { return rows[key]; })
      .sort(function (a, b) { return a.at - b.at; });
  }

  function lineOf(source, at) {
    return source.slice(0, at).split('\n').length;
  }

  function verdictOf(row) {
    if (row.flagged && row.tainted) return 'confirmed';
    if (row.flagged && !row.ran) return 'never executed by this run';
    if (row.flagged) return 'clean on this run';
    if (row.tainted) return 'MISSED';
    return 'not reported, and clean';
  }

  const studyFor = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);

    return measure(parts[0], parts[1]);
  });

  /** Every fixture at both precisions, for the chart and its caption. */
  const sweepFor = root.Helpers.memoise(function () {
    return FIXTURES.map(function (name) {
      const row = { name: name };

      MODES.forEach(function (mode) {
        const study = measure(name, mode);

        row[mode] = { spurious: countOf(study, 'clean on this run'),
          confirmed: countOf(study, 'confirmed'),
          findings: study.analysis.findings.length };
      });
      return row;
    });
  });

  function countOf(study, verdict) {
    return study.sinks.filter(function (row) { return verdictOf(row) === verdict; }).length;
  }

  function update(app) {
    const values = panel.values();
    const study = studyFor(JSON.stringify([values['tnt-sample'], values['tnt-fields']]));

    paintSource(study);
    paintMetrics(study);
    paintSinks(study);
    paintPath(study);
    paintSweep(study);
    paintFamily();
    paintChart(app);
  }

  function paintSource(study) {
    const sample = root.TaintTemplate.SAMPLES[study.name];

    root.jQuery('#tnt-source').text(study.source);
    root.Helpers.setText('tnt-source-caption', 'This fixture is ' + sample.about +
      '. The prelude declares the five functions the policy classifies; the analysis reads the '
      + 'lowered IR of `main`, and the oracle runs the whole programme with a taint bit beside '
      + 'every value. The run executed ' + study.observed.reached + ' sink call' +
      (study.observed.reached === 1 ? '' : 's') + ' over ' + study.observed.steps +
      ' block visit' + (study.observed.steps === 1 ? '' : 's') + '.');
  }

  function paintMetrics(study) {
    const missed = countOf(study, 'MISSED');

    root.MetricGrid.update({
      'tnt-findings': { value: study.analysis.findings.length,
        note: 'sinks a tainted value could reach, over every execution' },
      'tnt-confirmed': { value: countOf(study, 'confirmed'),
        note: 'the run handed a tainted value to this sink' },
      'tnt-spurious': { value: countOf(study, 'clean on this run'),
        note: 'reported; the observed run delivered a clean value' },
      'tnt-missed': { value: missed,
        note: missed ? 'the analysis is unsound on this fixture'
          : 'nothing tainted arrived unreported' },
      'tnt-rounds': { value: study.analysis.rounds,
        note: study.analysis.rounds > 1 ? 'a later round found taint an earlier one missed'
          : 'one sweep was enough here' },
      'tnt-hops': { value: longestPath(study),
        note: 'copies, arithmetic and calls between the source and the sink' }
    });
  }

  function longestPath(study) {
    return study.analysis.findings.reduce(function (most, finding) {
      return Math.max(most, finding.hops);
    }, 0);
  }

  function paintSinks(study) {
    root.jQuery('#tnt-sinks tbody').html(study.sinks.map(function (row) {
      const verdict = verdictOf(row);

      return '<tr' + (verdict === 'MISSED' ? ' class="row-bad"' : '') +
        '><td class="mono">' + row.line + '</td><td class="mono">' + row.sink +
        '</td><td class="mono">' + (row.flagged ? 'tainted, in ' + row.hops + ' hops'
          : 'cannot be reached tainted') + '</td><td class="mono">' +
        (row.ran ? (row.tainted ? 'a tainted value arrived' : 'a clean value arrived')
          : 'not executed') + '</td><td class="mono">' + verdict + '</td></tr>';
    }).join('') || '<tr><td colspan="5">this fixture has no sink call</td></tr>');

    root.Helpers.setText('tnt-sinks-caption', sinksCaption(study));
  }

  function sinksCaption(study) {
    const spurious = countOf(study, 'clean on this run');
    const head = 'One row per sink call site. "Confirmed" means the run handed that call a '
      + 'value derived from a source; "clean on this run" means it did not, on the one '
      + 'execution the oracle observed. ';

    if (study.name === 'branchy' && spurious) {
      return head + 'Read this fixture carefully: the finding here is REAL — the else branch '
        + 'passes the raw value straight to the sink — and the run took the other branch, so '
        + 'the oracle reports it clean. This is what a dynamic oracle is for and what it can '
        + 'never do. It refutes; it does not confirm.';
    }
    return head + 'Only the last column can ever say MISSED, and that is the column that '
      + 'matters: a false positive costs an engineer ten minutes and a false negative costs a '
      + 'breach. This run reached ' + study.observed.reached + ' sink call' +
      (study.observed.reached === 1 ? '' : 's') + ', so the verdicts are worth exactly that '
      + 'much evidence.';
  }

  const HOPS = {
    source: 'the source produced an untrusted value',
    read: 'read out of a named local, which carries the taint with it',
    store: 'written into a named local',
    binary: 'arithmetic on a tainted operand, so the result is tainted',
    unary: 'a unary operation, which changes nothing about trust',
    makeRecord: 'put into a record, which taints the record',
    makeArray: 'put into an array, which taints the array',
    makeClosure: 'captured by a closure',
    loadField: 'read back out of the container',
    loadIndex: 'read back out of the array',
    call: 'passed to a function nobody has summarised, so the result is assumed tainted'
  };

  function hopLabel(hop) {
    if (HOPS[hop.why]) return HOPS[hop.why];
    if (hop.why.indexOf('field ') === 0) {
      return 'read from the ' + hop.why.slice('field '.length) + ' field, tracked on its own';
    }
    return hop.why;
  }

  function paintPath(study) {
    const finding = study.analysis.findings[0];
    const rows = finding ? finding.path : [];

    root.jQuery('#tnt-path tbody').html(rows.map(function (hop, at) {
      return '<tr><td class="mono">' + (at + 1) + '</td><td>' + hopLabel(hop) +
        '</td><td class="mono">' + hop.op + '</td><td class="mono">' + hop.target +
        '</td></tr>';
    }).join('') || '<tr><td colspan="4">no finding on this fixture, so there is no path to '
      + 'show</td></tr>');

    root.Helpers.setText('tnt-path-caption', finding
      ? 'The path behind the first finding, at line ' +
        lineOf(study.source, finding.span.start) + '. The path is the deliverable: a finding '
        + 'that says "line ' +
        'N is vulnerable" sends an engineer looking for the source; one that says how the '
        + 'value got there from ' + finding.origin +
        ' in ' + finding.hops + ' hops is a bug report. Every hop is one IR instruction, and '
        + 'the `store` and `read` pairs are the named local the value passed through.'
      : 'Nothing was reported here, which on this fixture is the correct answer — and is also '
        + 'what an analysis with an undeclared source would print.');
  }

  function paintSweep(study) {
    root.jQuery('#tnt-sweep tbody').html(study.sweep.map(function (row) {
      return '<tr><td>' + row.change + '</td><td class="mono">' + row.findings +
        '</td><td class="mono">' + (row.delta > 0 ? '+' + row.delta : row.delta) +
        '</td><td>' + directionOf(row) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('tnt-sweep-caption',
      'Each row drops one declaration from the policy and re-runs. Losing a source or a sink '
      + 'loses findings, and that loss is silent: the tool prints a shorter report and nothing '
      + 'indicates the difference. Losing a sanitiser gains findings, and that is noisy and '
      + 'self-correcting, because somebody triages them. The asymmetry is the whole reason to '
      + 'spend review effort on the source and sink lists rather than on the sanitiser list.');
  }

  function directionOf(row) {
    if (row.delta < 0) return 'false negatives — silently fewer reports';
    if (row.delta > 0) return 'false positives — noisier, and self-correcting';
    return 'no change on this fixture';
  }

  const FAMILY = [
    { name: 'type checking', fact: 'the set of values an expression can have',
      why: 'reject programs whose operations are undefined',
      wrong: 'rejects correct programs; the false positives are called type errors' },
    { name: 'nullability', fact: 'whether a reference may be absent here',
      why: 'turn a run-time dereference failure into a compile-time one',
      wrong: 'needs an annotation on every existing signature before it says anything useful' },
    { name: 'definite assignment', fact: 'one bit per variable: written on every path?',
      why: 'reading an uninitialised local is undefined behaviour or a silent zero',
      wrong: 'a loop that always runs once still reports the variable as possibly unwritten' },
    { name: 'taint', fact: 'whether the value came from somewhere untrusted',
      why: 'injection: the value ends up interpreted as code by something downstream',
      wrong: 'every failure is a missing declaration, and the bad direction is silent' }
  ];

  function paintFamily() {
    root.jQuery('#tnt-family tbody').html(FAMILY.map(function (row) {
      return '<tr><td class="mono">' + row.name + '</td><td>' + row.fact + '</td><td>' +
        root.Helpers.escapeHtml(row.why) + '</td><td>' +
        root.Helpers.escapeHtml(row.wrong) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('tnt-family-caption',
      'All four are the same forward fixpoint over the same CFG, carrying a different fact and '
      + 'joining it differently at merges. That is worth holding on to: once you have '
      + 'implemented one of these you have implemented the shape of all of them, and the '
      + 'difference between a research prototype and a tool people use is in the lists, the '
      + 'summaries and the reporting rather than in the algorithm.');
  }

  function paintChart(app) {
    const host = root.jQuery('#tnt-chart')[0];
    const rows = sweepFor('all');

    if (!host) return;
    if (chart) chart.destroy();
    /* Aggregated over the six fixtures rather than one bar each: twelve bars
       of height 0 or 1 is a table drawn badly, and the comparison the section
       is about is between the two precisions. */
    chart = root.ErrorBandView.bars(host, {
      lazyLib: app.lazyLib, height: 250,
      yLabel: 'findings over all six fixtures',
      values: MODES.reduce(function (out, mode, at) {
        const label = mode === 'sensitive' ? 'field-sensitive' : 'field-insensitive';

        out.push({ label: label + ': reported', value: totals(rows, mode, 'findings'),
          series: at });
        out.push({ label: label + ': confirmed', value: totals(rows, mode, 'confirmed'),
          series: at });
        out.push({ label: label + ': refuted', value: totals(rows, mode, 'spurious'),
          series: at });
        return out;
      }, [])
    });
    root.Helpers.setText('tnt-chart-note', chartNote(rows));
  }

  function totals(rows, mode, field) {
    return rows.reduce(function (sum, row) { return sum + row[mode][field]; }, 0);
  }

  function chartNote(rows) {
    const record = rows.filter(function (row) { return row.name === 'record'; })[0];
    const array = rows.filter(function (row) { return row.name === 'array'; })[0];

    return 'Six fixtures, both precisions. Field-insensitively the analysis reports ' +
      totals(rows, 'insensitive', 'findings') + ' findings of which the runs confirm ' +
      totals(rows, 'insensitive', 'confirmed') + '; field-sensitively it reports ' +
      totals(rows, 'sensitive', 'findings') + ' and confirms the same ' +
      totals(rows, 'sensitive', 'confirmed') + '. The difference is one fixture: the record '
      + 'goes from ' + record.insensitive.spurious + ' refuted finding to ' +
      record.sensitive.spurious + ', because each field gets its own abstract location. The '
      + 'array stays at ' + array.sensitive.spurious + ' under both, because an array is one '
      + 'location either way — separating elements is index sensitivity, a different axis that '
      + 'almost no production tool pays for. And one of the refuted findings is real: the '
      + '`branchy` fixture\'s else branch is a genuine vulnerability the observed run did not '
      + 'take.';
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
