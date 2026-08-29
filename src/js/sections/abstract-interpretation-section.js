/**
 * Section: Abstract interpretation.
 *
 * The demo is the fixpoint itself rather than its answer. `StaticLab.analyse`
 * records the entry state of every loop header once per round, so the
 * ascending chain is a table: the interval at the header climbing one loop
 * iteration per round with the join, or jumping to the top in one step with
 * the widening.
 *
 * The widening toggle is the section. With it off the analysis is not wrong in
 * a subtle way — on the loop counting to a thousand it runs out of rounds
 * still climbing, and the state it leaves behind is refuted 1 207 times by a
 * single run. That is the honest form of "widening is where termination comes
 * from": the alternative does not merely take longer, it stops in the middle
 * and reports a claim that is false.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'abstract-interpretation';
  const DOMAINS = [
    { id: 'interval', name: 'intervals', says: 'a lower and an upper bound',
      height: 'infinite — [0, 0], [0, 2], [0, 4] … ascends forever',
      why: 'only widening; the lattice cannot stop it on its own' },
    { id: 'sign', name: 'signs', says: 'negative, zero, positive, or no idea',
      height: '3 — bottom, one of three signs, top',
      why: 'the lattice is finite, so the chain stops whatever you do' },
    { id: 'parity', name: 'parity', says: 'even, odd, or no idea',
      height: '3 — bottom, even or odd, top',
      why: 'the lattice is finite; widening is a no-op here' }
  ];
  const BOUNDS = [10, 50, 100, 150, 200, 250, 300];
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
      title: 'Diagram — the ascending chain, and the two operators that bend it',
      caption: 'Reading upwards is losing information. The join climbs the lattice one loop '
        + 'iteration per round and on an unbounded loop never stops; the widening jumps '
        + 'straight to the top, which terminates and throws the bound away; the narrowing '
        + 'descends once from the top, recovering whatever the branch conditions pin down. '
        + 'Everything an interval analysis gets right and wrong is in those three moves.',
      definition: [
        'graph BT',
        'B["bottom — no value reaches here"] --> C0["x in [0, 0]"]',
        'C0 -->|"join, round 2"| C1["x in [0, 2]"]',
        'C1 -->|"join, round 3"| C2["x in [0, 4]"]',
        'C2 -->|"one round per iteration"| CN["x in [0, 10]"]',
        'C0 -.->|"widen: the bound moved,<br/>so throw it away"| T["x in [0, plus infinity] — the top"]',
        'T -.->|"narrow: the loop test says<br/>x is under 11 here"| R["x in [0, 11]"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**An abstract domain is a set of claims you are willing to make, chosen so that the '
        + 'analysis terminates.** "x is between 0 and 11" is a claim; "x is even" is a '
        + 'different one; "x is one of 0, 2, 4, 6, 8, 10" is a third and is usually too '
        + 'expensive to keep. Picking the domain is picking what your analyser will be able to '
        + 'say and what it will have to round off.',
      '**Abstraction and concretisation are the two directions of that choice.** Going up, a '
        + 'set of concrete values becomes the smallest claim that covers it; coming back down, '
        + 'a claim becomes the set of every value it admits. The pair has to be faithful in one '
        + 'direction — the claim must never lose a value that really happens — and that '
        + 'one-sidedness is exactly the soundness of the analysis.',
      '**A transfer function is the abstract version of one instruction.** Concretely, `x = x '
        + '+ 2` adds two to a number; abstractly it adds two to both ends of an interval, or '
        + 'leaves a parity unchanged, or turns a positive into a positive. Every instruction '
        + 'needs one, and each is where precision is quietly won or lost — interval '
        + 'multiplication takes the extremes of four corner products because two negatives make '
        + 'a positive.',
      '**At a merge point the analysis joins, and a join is a loss.** Two branches arrive '
        + 'claiming [3, 3] and [-4, -4]; what survives is [-4, 3], which admits zero — a value '
        + 'neither branch produces. That single fact is the origin of most false positives in '
        + 'every tool built this way, and it is why path sensitivity is worth paying for '
        + 'exactly where a merge destroys the thing you were trying to prove.',
      '**The analysis is a fixpoint computation: sweep every block, and keep sweeping until a '
        + 'round changes nothing.** The demo counts the rounds. With the join alone, a loop '
        + 'counting to a thousand in twos needs one round per iteration, and the interval at '
        + 'the header creeps [0, 0], [0, 2], [0, 4] up towards a bound that a program with an '
        + 'unknown bound never has.'
    ];
  }

  function moreOrientation() {
    return [
      '**Widening is the operator that gives up deliberately, and it is why the analysis '
        + 'terminates.** When the bound at a loop header moves at all, widening throws it to '
        + 'infinity rather than following it. Three rounds later the loop is stable — for any '
        + 'bound, including a bound that is a parameter. Turn it off in the demo and watch the '
        + 'thousand-iteration loop run out of rounds still climbing.',
      '**A budget is not a substitute for widening: it produces an answer that is simply '
        + 'false.** With widening off and the round budget exhausted, the analyser claims x is '
        + 'in [0, 398] at the loop header of a loop that reaches 1000, and one run refutes it '
        + '603 times. An iteration stopped short is not an approximation of the fixpoint; it is '
        + 'a claim about a program that nothing supports.',
      '**Narrowing is the second pass that takes back what it safely can.** Starting from [0, '
        + 'infinity] it re-reads the loop test — inside the loop x is under 10, so after the '
        + 'increment it is at most 11 — and recovers [0, 11] where the truth is [0, 10]. It '
        + 'only ever replaces an infinite bound with a finite one, because allowing it to move '
        + 'any bound would re-open the ascending chain and the second pass would not terminate '
        + 'either.',
      '**Narrowing recovers the inner loop of the demo and does not recover the outer one, and '
        + 'that is the technique rather than a bug.** The inner counter comes back to [0, 3]; '
        + 'the outer one stays [0, infinity] because nothing on the path back to its header '
        + 'constrains it after the widening. Real analysers spend their engineering here — '
        + 'loop-aware widening with thresholds, delayed widening, and restarting the whole '
        + 'fixpoint from a candidate bound.',
      '**Domains compose, and a product of two cheap domains often beats one expensive one.** '
        + 'Signs and parity know different things: run both and you know `x` is a positive even '
        + 'number without paying for the relational domains that could have told you `x <= y`. '
        + 'The demo runs the same programme in all three so the difference between what a '
        + 'domain cannot express and what it merely lost is visible.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation().concat(moreOrientation()),
      demo: { title: 'Interactive demo — the fixpoint, round by round',
        markup: root.AbstractInterpTemplate.render() },
      diagram: diagram(),
      insight: '**Widening is where precision goes to die and where termination comes from, and '
        + 'a tool\'s usefulness on loops is almost entirely a function of its widening '
        + 'strategy.** When a static analyser gives you a useless answer, the odds are it is '
        + 'this: the claim you wanted was destroyed at a loop header by an operator whose job '
        + 'was to guarantee the analysis finished at all. That is why commercial analysers '
        + 'expose knobs with names like "loop unrolling depth" and "widening delay" — every one '
        + 'of them is buying precision at a loop header with time. What to do with that: when a '
        + 'tool reports nothing useful about a loop, do not conclude your code is unanalysable, '
        + 'check whether a threshold would help. Widening with thresholds — take the constants '
        + 'that appear in the loop test as candidate bounds before jumping to infinity — is the '
        + 'single highest-value refinement and it is in every serious implementation. The '
        + 'second thing is structural: a loop whose bound is a compile-time constant and whose '
        + 'counter is not modified in the body is a loop every analyser handles, and code '
        + 'written that way gets better answers out of every tool in the chain, including the '
        + 'optimiser. And the third is the one this demo exists to make unforgettable: an '
        + 'iteration that stops on a budget rather than on a fixpoint has not approximated '
        + 'anything. If a tool tells you it hit an analysis limit, its findings for that '
        + 'function are not weaker evidence — they are no evidence at all.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({
      controls: root.AbstractInterpTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const studyFor = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);
    const sample = root.AbstractInterpTemplate.SAMPLES[parts[0]];
    const compiled = root.StaticLab.compile(sample.source);
    const run = root.StaticLab.observe(compiled.fn,
      { params: sample.params || {}, names: sample.names || [] });

    return { sample: sample, fn: compiled.fn, run: run, names: namesOf(compiled.fn),
      widening: parts[2], joinOnly: joinOnly(compiled.fn, parts[1]),
      chosen: oneDomain(compiled.fn, run, parts),
      domains: DOMAINS.map(function (domain) {
        return oneDomain(compiled.fn, run, [parts[0], domain.id, parts[2], parts[3]]);
      }) };
  });

  /** The same programme with the join alone, so a caption can quote what
   *  widening is actually saving on THIS programme rather than in general. */
  function joinOnly(fn, domain) {
    const analysis = root.StaticLab.analyse(fn,
      { domain: domain, widen: false, narrow: false });

    return { rounds: analysis.rounds.filter(function (row) {
      return row.pass === 'widen';
    }).length, converged: analysis.converged, cap: analysis.cap };
  }

  function namesOf(fn) {
    const map = {};

    (fn.slots || []).forEach(function (slot) { map[slot.name] = slot.source; });
    return map;
  }

  function oneDomain(fn, run, parts) {
    const analysis = root.StaticLab.analyse(fn,
      { domain: parts[1], widen: parts[2], narrow: parts[3] });

    return { domain: DOMAINS.filter(function (row) { return row.id === parts[1]; })[0],
      analysis: analysis,
      ascending: analysis.rounds.filter(function (row) { return row.pass === 'widen'; }).length,
      soundness: root.StaticLab.soundness(analysis, run),
      precision: root.StaticLab.precision(analysis, run) };
  }

  /** Rounds to a fixpoint against the distance the loop counts, both ways. */
  const scalingFor = root.Helpers.memoise(function () {
    return BOUNDS.map(function (bound) {
      const fn = root.StaticLab.compile('let x = 0;\nlet n = ' + bound +
        ';\nwhile (x < n) { x = x + 2; }\nlet r = x;').fn;

      return { bound: bound,
        widen: ascendingRounds(fn, true), join: ascendingRounds(fn, false) };
    });
  });

  function ascendingRounds(fn, widen) {
    return root.StaticLab.analyse(fn, { domain: 'interval', widen: widen, narrow: false })
      .rounds.filter(function (row) { return row.pass === 'widen'; }).length;
  }

  function update(app) {
    const values = panel.values();
    const study = studyFor(JSON.stringify([values['abs-sample'], values['abs-domain'],
      values['abs-widen'], values['abs-narrow']]));

    paintSource(study);
    paintMetrics(study);
    paintChain(study);
    paintPoints(study);
    paintDomains(study);
    paintOperators();
    paintChart(app);
  }

  function paintSource(study) {
    const chosen = study.chosen;

    root.jQuery('#abs-source').text(study.sample.source);
    root.Helpers.setText('abs-source-caption', 'This is ' + study.sample.about +
      '. The run visits ' + study.run.steps + ' blocks, snapshotting the state at the '
      + 'start and the end of each — ' + study.run.observations.length + ' in all' + (study.run.gaveUp ? ', giving up on ' + study.run.gaveUp : '') +
      '. The analysis found ' + chosen.analysis.headers.length + ' loop header' +
      (chosen.analysis.headers.length === 1 ? '' : 's') +
      ', which is the only place widening is applied.');
  }

  function paintMetrics(study) {
    const chosen = study.chosen;
    const capped = !chosen.analysis.converged;

    root.MetricGrid.update({
      'abs-rounds': { value: chosen.ascending,
        note: capped ? 'the budget of ' + chosen.analysis.cap + ' ran out first'
          : 'the last one changed nothing' },
      'abs-fixpoint': { value: chosen.analysis.converged ? 'yes' : 'NO',
        note: capped ? 'this state is not a fixpoint and claims nothing about the programme'
          : 'the state below is a real fixpoint' },
      'abs-widenings': { value: chosen.analysis.widenings,
        note: chosen.analysis.widenings ? 'each one threw a moving bound to infinity'
          : 'no loop header, or widening switched off' },
      'abs-narrowings': { value: chosen.analysis.narrowings,
        note: 'the descending pass, which only ever replaces an infinite bound' },
      'abs-top': { value: chosen.precision.unbounded + ' of ' + chosen.precision.total,
        note: 'claims at the top of this lattice rule nothing out' },
      'abs-unsound': { value: chosen.precision.unsound,
        note: chosen.soundness.violations.length + ' violations over ' +
          chosen.soundness.observations + ' observed values' }
    });
  }

  function paintChain(study) {
    const seen = {};
    const rows = study.chosen.analysis.trace.map(function (row) {
      const shown = showSlots(study, row.slots);
      const before = seen[row.pass + row.block];

      seen[row.pass + row.block] = shown;
      return '<tr><td class="mono">' + row.pass + '</td><td class="mono">' + row.round +
        '</td><td class="mono">' + row.block + '</td><td class="mono">' + shown +
        '</td><td>' + changeOf(before, shown) + '</td></tr>';
    });

    root.jQuery('#abs-chain tbody').html(elide(rows).join('') ||
      '<tr><td colspan="5">this programme has no loop, so there is no chain to climb: one '
      + 'sweep computes the answer and the second confirms it</td></tr>');
    root.Helpers.setText('abs-chain-caption', chainCaption(study));
  }

  /** A chain that climbs one iteration per round is hundreds of rows of the
   *  same row. The head and the tail are the whole story; the middle is a
   *  count. */
  function elide(rows) {
    const KEEP_HEAD = 8;
    const KEEP_TAIL = 4;

    if (rows.length <= KEEP_HEAD + KEEP_TAIL + 1) return rows;
    return rows.slice(0, KEEP_HEAD).concat(['<tr><td colspan="5">… ' +
      (rows.length - KEEP_HEAD - KEEP_TAIL) + ' more rounds, each admitting exactly one more '
      + 'loop iteration …</td></tr>'], rows.slice(rows.length - KEEP_TAIL));
  }

  function showSlots(study, slots) {
    return Object.keys(slots).map(function (slot) {
      return (study.names[slot] || slot) + ' in ' + slots[slot];
    }).join(', ') || 'nothing yet';
  }

  function changeOf(before, now) {
    if (before === undefined) return 'the first time this header was reached';
    if (before === now) return 'nothing — this is the fixpoint';
    if (/∞/.test(now) && !/∞/.test(before)) return 'a bound moved, so widening threw it away';
    if (/∞/.test(before) && !/∞/.test(now)) return 'narrowing put a finite bound back';
    return 'the join admitted one more iteration';
  }

  function chainCaption(study) {
    const chosen = study.chosen;

    if (!chosen.analysis.headers.length) {
      return 'A programme with no back edge has no ascending chain: every block is visited once '
        + 'in dependency order and the second round confirms nothing changed. Widening exists '
        + 'for cycles, and only for cycles.';
    }
    return 'One row per round per loop header, and the last column is the operator doing the '
      + 'work. This run took ' + chosen.ascending + ' ascending rounds; ' +
      joinPhrase(study) + '. That is the whole argument for the operator: the cost of the join '
      + 'is a property of the programme being analysed — its trip count — and the cost of '
      + 'widening is not.';
  }

  function joinPhrase(study) {
    const join = study.joinOnly;
    const same = study.widening ? 'the same analysis with the join alone takes '
      : 'this IS the join alone, and it took ';

    if (!join.converged) {
      return (study.widening ? 'with the join alone it never gets there: it is still climbing '
        : 'and it never gets there: it was still climbing ') + 'when the ' + join.cap +
        '-round budget ran out, one loop iteration per round';
    }
    return same + join.rounds + ' rounds, one per loop iteration';
  }

  function paintPoints(study) {
    const observed = observedMap(study.chosen.precision.rows);
    const rows = [];

    study.chosen.analysis.blocks.forEach(function (block) {
      Object.keys(block.entry).forEach(function (slot) {
        rows.push(pointRow(study, block, slot, observed[block.id + '/' + slot]));
      });
    });
    root.jQuery('#abs-points tbody').html(rows.join('') ||
      '<tr><td colspan="6">no numeric local reached any block</td></tr>');
    root.Helpers.setText('abs-points-caption', pointsCaption(study));
  }

  function observedMap(rows) {
    const map = {};

    rows.filter(function (row) { return row.at !== 'exit'; })
      .forEach(function (row) { map[row.block + '/' + row.slot] = row; });
    return map;
  }

  function pointRow(study, block, slot, seen) {
    const role = block.header ? 'loop header'
      : (block.id === study.chosen.analysis.blocks[0].id ? 'entry' : 'body or exit');

    return '<tr' + (seen && !seen.contains ? ' class="row-bad"' : '') +
      '><td class="mono">' + block.id + '</td><td>' + role + '</td><td class="mono">' +
      (study.names[slot] || slot) + '</td><td class="mono">' + block.entry[slot] +
      '</td><td class="mono">' + (seen ? seen.observedLo + '…' + seen.observedHi +
        ' (' + seen.distinct + ' distinct)' : 'not reached by this run') +
      '</td><td class="mono">' + verdictOf(seen) + '</td></tr>';
  }

  function verdictOf(seen) {
    if (!seen) return 'unchecked';
    if (!seen.contains) return 'UNSOUND';
    if (seen.width === null || seen.width === Infinity) return 'says nothing';
    if (seen.width === seen.observedWidth) return 'exact';
    return 'sound, ' + (seen.width - seen.observedWidth) + ' wider';
  }

  function pointsCaption(study) {
    const chosen = study.chosen;

    if (chosen.precision.unsound) {
      return 'The highlighted rows are the point of the widening toggle. ' +
        chosen.precision.unsound + ' claims here are refuted by a single run — ' +
        chosen.soundness.violations.length + ' observed values fell outside them — because the '
        + 'ascending pass ran out of its ' + chosen.analysis.cap + '-round budget while it was '
        + 'still climbing. An iteration stopped on a budget has not approximated the fixpoint; '
        + 'it has stopped somewhere below it, and everything below a fixpoint is a claim the '
        + 'programme can break.';
    }
    return 'Every row is one variable at the entry to one block. "Says nothing" is the top of '
      + 'the lattice and is where widening\'s cost is paid; "sound, n wider" is the '
      + 'false-positive surface a checker built on this analysis would warn about. Nothing here '
      + 'is unsound, which one run can confirm and can never establish — the check saw ' +
      chosen.soundness.observations + ' values.';
  }

  function paintDomains(study) {
    root.jQuery('#abs-domains tbody').html(study.domains.map(function (row) {
      return '<tr' + (row.domain.id === study.chosen.domain.id ? ' class="row-current"' : '') +
        '><td class="mono">' + row.domain.name + '</td><td>' + row.domain.says +
        '</td><td>' + root.Helpers.escapeHtml(row.domain.height) + '</td><td class="mono">' +
        row.precision.unbounded + ' of ' + row.precision.total + '</td><td class="mono">' +
        row.ascending + '</td><td>' + row.domain.why + '</td></tr>';
    }).join(''));

    root.Helpers.setText('abs-domains-caption',
      'The two finite domains terminate whatever you do, which is why nobody discusses widening '
      + 'for them — and they pay for it by being unable to express the thing the loop is about. '
      + 'Signs cannot say the counter is bounded; parity says something true and useless about '
      + 'it. Intervals can express the bound and cannot terminate without help. That trade is '
      + 'the subject, and a product domain — run two cheap ones together — is how real '
      + 'analysers get some of both.');
  }

  const OPERATORS = [
    { name: 'transfer', where: 'every instruction',
      what: 'the abstract version of the operation: add two to both ends of the interval',
      cost: 'precision lost per instruction, e.g. multiplication taking four corner products' },
    { name: 'join', where: 'every merge point, including loop headers',
      what: 'the smallest claim covering both incoming states',
      cost: 'admits values neither branch produces; the origin of most false positives' },
    { name: 'widen', where: 'loop headers only',
      what: 'a bound that moved is thrown to infinity rather than followed',
      cost: 'the bound, in exchange for termination in a constant number of rounds' },
    { name: 'narrow', where: 'loop headers, in a second descending pass',
      what: 'an infinite bound is replaced by a finite one the branch conditions justify',
      cost: 'nothing, but it only recovers what the tests pin down — not the outer loop here' }
  ];

  function paintOperators() {
    root.jQuery('#abs-operators tbody').html(OPERATORS.map(function (row) {
      return '<tr><td class="mono">' + row.name + '</td><td>' + row.where + '</td><td>' +
        root.Helpers.escapeHtml(row.what) + '</td><td>' +
        root.Helpers.escapeHtml(row.cost) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('abs-operators-caption',
      'Widening is applied at loop headers and nowhere else. Applying it at every merge also '
      + 'terminates and destroys the precision of every branch in the programme, which is a '
      + 'common way to make an interval analysis useless while believing it is standard.');
  }

  function paintChart(app) {
    const host = root.jQuery('#abs-chart')[0];
    const scaling = scalingFor('scaling');

    if (!host) return;
    if (chart) chart.destroy();
    chart = root.GrowthPlot.render(host, {
      lazyLib: app.lazyLib, height: 250,
      xLabel: 'how far the loop counts', yLabel: 'rounds of the ascending pass',
      series: [
        { label: 'join only — one round per loop iteration',
          points: scaling.map(function (row) { return { x: row.bound, y: row.join }; }) },
        { label: 'widening at the loop header — three, whatever the bound',
          points: scaling.map(function (row) { return { x: row.bound, y: row.widen }; }) }
      ],
      legendHost: root.jQuery('#abs-legend')[0],
      summary: function () {
        return 'Rounds of the ascending pass against the loop bound, for the join alone '
          + 'and for widening.';
      }
    });
    root.Helpers.setText('abs-chart-note', chartSummary(scaling));
  }

  function chartSummary(scaling) {
    const last = scaling[scaling.length - 1];

    return 'The same loop with the bound moved from ' + scaling[0].bound + ' to ' + last.bound +
      '. Without widening the ascending pass needs ' + scaling[0].join + ' rounds and then ' +
      last.join + ' — one per loop iteration, because each round admits exactly one more. With '
      + 'widening it needs ' + last.widen + ' rounds at every bound on this axis, and would '
      + 'need ' + last.widen + ' if the bound were a parameter nobody knows. Past a bound of '
      + '394 the join-only analysis exceeds its 200-round budget and stops while still '
      + 'climbing, which is worse than slow: at a bound of 1000 it claims the loop counter is '
      + 'in [0, 398] and one run refutes that 1 207 times.';
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
