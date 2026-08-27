/**
 * Section: JIT compilation.
 *
 * The measurement is a tier timeline: a function crossing a hotness
 * threshold, being compiled, being recompiled with guards the profile
 * justified, and — on the deopt fixture — falling back to the interpreter
 * when a guard does not hold. Every one of those is an event with a cause
 * rather than a claim.
 *
 * The second is the differential. The JIT's answer is compared against a run
 * that never compiled anything, so a speculation that is wrong shows up as a
 * disagreement rather than as a faster wrong number. Reporting the deopt
 * count beside the agreement is what stops the check passing because nothing
 * was ever speculated on.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'jit-compilation';
  let panel = null;
  let chart = null;
  let application = null;

  const TIER_COSTS = [
    { tier: 'interpreter', what: 'switch dispatch over the bytecode', cost: 'none',
      wrong: 'nothing — it is the reference' },
    { tier: 'baseline', what: 'one closure per instruction, decoded once',
      cost: 'one pass over the code', wrong: 'nothing — it makes no assumptions' },
    { tier: 'optimising', what: 'guarded fast paths chosen from the profile',
      cost: 'one pass, plus a guard per speculated site',
      wrong: 'every assumption the profile suggested, which is what the guards catch' }
  ];

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — a function moving between tiers, including back down',
      caption: 'A function starts interpreted. Cross a counter and it is compiled without '
        + 'assumptions; cross a second and it is recompiled with fast paths the profile '
        + 'justified, each behind a guard. When a guard fails the function DEOPTIMISES: '
        + 'control returns to the interpreter at the same instruction, on the same frame, and '
        + 'the program continues. The arrow back down is the one that makes speculation safe, '
        + 'and it is why a benchmark whose types change halfway measures the deopt path rather '
        + 'than the optimised one.',
      definition: [
        'stateDiagram-v2',
        '[*] --> Interpreter',
        'Interpreter --> Baseline: entry counter crosses',
        'Interpreter --> Baseline: back edge counter crosses (OSR)',
        'Baseline --> Optimising: hot, and the profile is monomorphic',
        'Optimising --> Interpreter: a guard fails',
        'Interpreter --> Baseline: hot again',
        'Optimising --> [*]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Compiling costs time the program is not running, so a JIT compiles only what is worth '
        + 'it.** Every function starts interpreted. A counter on entries and on loop back edges '
        + 'says how hot it is, and crossing a threshold triggers compilation. The thresholds '
        + 'are the whole policy, and the demo makes them sliders because there is no right '
        + 'value — only a trade between warm-up and steady state.',
      '**Tiering exists because one compiler cannot be both fast to run and fast to produce.** '
        + 'A baseline tier compiles quickly and makes no assumptions; an optimising tier '
        + 'compiles slowly and speculates. Most functions never leave the first, a few reach '
        + 'the second, and the counters are what sort them — which is why a profile has to '
        + 'exist before the second tier can.',
      '**Speculation is the whole point, and a profile is what justifies it.** A site that has '
        + 'only ever seen numbers can be compiled to a machine addition instead of a dispatch '
        + 'through an arithmetic table. That is not sound — the next call may pass a string — '
        + 'so the fast path is preceded by a guard, and the guard is what makes the unsound '
        + 'assumption safe.',
      '**Deoptimisation is the mechanism, and its correctness rests on one rule: the guard is '
        + 'checked before anything changes.** When it fires, the program counter is rewound and '
        + 'the interpreter runs the same instruction on the same frame. Get the ordering wrong '
        + '— pop the operands, then check — and a deopt resumes an instruction that has already '
        + 'half-run, which is a miscompilation that only appears on the rare failing input.',
      '**On-stack replacement exists because a program in one long loop never re-enters '
        + 'anything.** A counter on function entry never crosses for `main`, so the hot loop '
        + 'inside it would run interpreted forever. OSR compiles at a back edge and transfers '
        + 'the RUNNING frame into the compiled code — which here is nearly free, because the '
        + 'compiled code operates on the same frame object.',
      '**A function that deoptimises twice stops being speculated on.** Without that rule, a '
        + 'genuinely polymorphic function recompiles and falls back on every pass through the '
        + 'loop, which costs more than the interpreter it was trying to beat. The symptom is a '
        + 'program that gets slower the longer it runs, and every production engine has some '
        + 'version of this blacklist.',
      '**Warm-up is a phase of the program, not a measurement artefact.** Before the profile '
        + 'exists there is nothing to speculate on, so the first thousand iterations of a loop '
        + 'genuinely run at a different speed from the millionth. A benchmark that averages '
        + 'over both is measuring a number that describes neither, which is what 30.10 is '
        + 'about.',
      '**The JIT has to compute what the interpreter computes, and that is checkable.** Run the '
        + 'program with every tier enabled and again with none, and compare the value, the '
        + 'output and every binding. A speculation that is wrong then shows up as a '
        + 'disagreement rather than as a faster wrong answer, which is the same gate M29 put on '
        + 'every optimisation pass.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: { title: 'Interactive demo — tiers, guards and the fall back down',
        markup: root.JitTemplate.render() },
      diagram: diagram(),
      insight: '**Deoptimisation is what makes speculation safe, and it is why a benchmark that '
        + 'changes types halfway through measures the deopt path rather than the optimised '
        + 'one.** Every fast path a JIT emits rests on an assumption the profile suggested and '
        + 'nothing proved: this site only ever sees numbers, this call only ever reaches one '
        + 'function, this object only ever has one shape. None of those is a theorem. What '
        + 'makes the whole approach sound rather than reckless is that each one is a guard '
        + 'with a way out — and the way out has to restore the interpreter\'s state exactly, '
        + 'which means the compiled frame has to carry enough metadata to be turned back into '
        + 'an interpreter frame at any guarded point. That metadata is the real cost of '
        + 'speculation, and it is why deoptimisation shows up in the same part of a runtime as '
        + 'stack maps and source-level stack traces in 30.9: all three are asking a compiled '
        + 'frame to explain itself in the interpreter\'s terms. The practical consequence for '
        + 'anyone measuring a JIT-compiled language is blunt: if your workload changes shape '
        + 'partway through, you are timing the fallback, not the optimiser, and the number you '
        + 'get describes a state the program was only briefly in.'
    };
  }

  function render(app) {
    application = app;
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({
      controls: root.JitTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  const compiledFor = root.Helpers.memoise(function (id) {
    const program = root.Berugo.IrLower.compile(root.JitTemplate.SAMPLES[id]).program;

    return root.Berugo.Bytecode.compile(program, { mode: 'register' });
  });

  const runFor = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);
    const compiled = compiledFor(parts[0]);

    return root.Berugo.Jit.differential(compiled, { budget: 2000000, speculate: parts[3],
      thresholds: { baselineAt: parts[1], optimiseAt: parts[2], osrAt: parts[1] * 3 } });
  });

  const sweepFor = root.Helpers.memoise(function (id) {
    return root.Berugo.Jit.thresholdSweep(compiledFor(id), [5, 10, 20, 50, 100, 200]);
  });

  function update() {
    const values = panel.values();
    const key = JSON.stringify([values['jc-sample'], Number(values['jc-baseline']),
      Number(values['jc-optimise']), Boolean(values['jc-speculate'])]);
    const state = runFor(key);

    paintTimeline(state);
    paintMetrics(state);
    paintEvents(state);
    paintTiers();
    paintProfile(state);
    paintSweep(values['jc-sample']);
  }

  function paintTimeline(state) {
    if (chart && chart.chart) chart.chart.destroy();
    const events = state.jit.timeline.concat(state.jit.deopts.map(function (row) {
      return { fn: row.fn, tier: 0, at: row.at, name: 'deopt' };
    }));

    chart = root.BytecodeView.timeline(document.getElementById('jc-timeline'), {
      lazyLib: application.lazyLib, events: events, total: state.jit.dispatches,
      summary: 'One lane per function; blue is a promotion, amber is a fall back down.' });

    root.Helpers.setText('jc-timeline-caption', timelineCaption(state, events));
  }

  function timelineCaption(state, events) {
    if (!events.length) {
      return 'Nothing crossed a threshold: this program finishes before any function gets warm, '
        + 'which is the common case and the reason a JIT starts interpreted.';
    }
    return events.length + ' transitions over ' + state.jit.dispatches + ' dispatches. The '
      + 'horizontal axis is dispatches rather than time, because a dispatch is deterministic '
      + 'and a millisecond on this machine is not. Amber marks a fall back to the interpreter.';
  }

  function paintMetrics(state) {
    root.MetricGrid.update({
      'jc-compiles': { value: state.compiles,
        note: state.osr + ' of them entered through a loop back edge rather than a call' },
      'jc-fast': { value: state.fastPaths,
        note: state.fastPaths ? 'each one a guard the profile justified'
          : 'nothing was hot enough, or nothing was monomorphic' },
      'jc-deopts': { value: state.deopts,
        note: state.deopts ? state.jit.deopts[0].why + ' at ' + state.jit.deopts[0].fn
          : 'every guard held for the whole run' },
      'jc-agrees': { value: state.agree ? 'yes' : 'NO',
        note: state.agree ? 'compared against a run with every tier disabled' : state.why }
    });
  }

  function paintEvents(state) {
    const rows = state.jit.timeline.concat(state.jit.deopts.map(function (row) {
      return { at: row.at, fn: row.fn, tier: 0, name: 'interpreter', why: row.why };
    })).sort(function (a, b) { return a.at - b.at; });

    root.jQuery('#jc-events tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + row.at + '</td><td class="mono">' + row.fn +
        '</td><td class="mono">' + row.name + '</td><td>' +
        root.Helpers.escapeHtml(row.why || '') + '</td></tr>';
    }).join('') || '<tr><td colspan="4">no function reached a threshold in this run</td></tr>');

    root.Helpers.setText('jc-events-caption',
      rows.length + ' events. Reading down the "why" column is reading the policy: a counter '
      + 'crossed, a loop back edge was hot enough to transfer a running frame, or a guard did '
      + 'not hold and the function went back to being interpreted at the same instruction.');
  }

  function paintTiers() {
    root.jQuery('#jc-tiers tbody').html(TIER_COSTS.map(function (row) {
      return '<tr><td class="mono">' + row.tier + '</td><td>' + row.what + '</td><td>' +
        row.cost + '</td><td>' + row.wrong + '</td></tr>';
    }).join(''));

    root.Helpers.setText('jc-tiers-caption',
      'Three tiers, and the last column is the one that matters. The first two cannot be wrong '
      + 'about anything — they make no assumptions, so they need no guards and can never '
      + 'deoptimise. Everything speculative is in the third, which is why a runtime can ship '
      + 'the first two and add the third later, and why a bug in the third is found by running '
      + 'the program against the first.');
  }

  function paintProfile(state) {
    const rows = state.jit.profile.slice(0, 10);

    root.jQuery('#jc-profile tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + row.site + '</td><td class="mono">' + row.samples +
        '</td><td class="mono">' + row.kinds.join(', ') + '</td><td>' + row.state +
        '</td></tr>';
    }).join('') || '<tr><td colspan="4">nothing was profiled: this program has no arithmetic '
      + 'that ran more than once</td></tr>');

    root.Helpers.setText('jc-profile-caption', profileCaption(state));
  }

  function profileCaption(state) {
    const mono = state.jit.profile.filter(function (row) {
      return row.state === 'monomorphic';
    }).length;

    return state.jit.profile.length + ' profiled sites, ' + mono + ' of them monomorphic. Only '
      + 'a monomorphic site can be speculated on, and "monomorphic" here means one kind of '
      + 'operand rather than one type — which is the same distinction 30.8 draws about object '
      + 'shapes, and the same reason a site that has seen two things is worth far less than '
      + 'twice a site that has seen one.';
  }

  function paintSweep(id) {
    const rows = sweepFor(id);

    root.jQuery('#jc-sweep tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + row.threshold + '</td><td class="mono">' + row.compiles +
        '</td><td class="mono">' + row.deopts + '</td><td class="mono">' + row.osr +
        '</td><td class="mono">' + row.compiled + '</td><td class="mono">' +
        (row.share * 100).toFixed(1) + '%</td></tr>';
    }).join(''));

    root.Helpers.setText('jc-sweep-caption', sweepCaption(rows));
  }

  function sweepCaption(rows) {
    const best = rows.reduce(function (top, row) {
      return row.share > top.share ? row : top;
    }, rows[0]);

    return 'The baseline threshold swept from 5 to 200, with the optimising one at four times '
      + 'it. The share column is what the policy is trying to maximise — the fraction of the '
      + 'run that happened in compiled code — and it peaks at ' + best.threshold + ' on this '
      + 'program. A lower threshold compiles things that never pay for themselves; a higher one '
      + 'leaves the hot loop interpreted for longer. There is no setting that is right for '
      + 'every program, which is why real engines tune these per workload class and still get '
      + 'it wrong sometimes.';
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
