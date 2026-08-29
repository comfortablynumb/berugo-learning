/**
 * Section: Describing hardware, and proving it right.
 *
 * The milestone closes where a real design starts: a module hierarchy written
 * as data, elaborated into one flat netlist, and then attacked. The injected
 * typo is the point of the page — with it on, the same design elaborates, the
 * same testbench runs, coverage still looks respectable, and only the
 * exhaustive equivalence check names the vector that fails.
 *
 * The coverage table exists to make a second point that transfers to software
 * unchanged: a test list can drive most of the wires and still miss the bug,
 * and a coverage number is a statement about the tests rather than about the
 * design.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'hardware-description-and-verification';
  const Sim = root.LogicSim;
  const Hdl = root.Hdl;
  const WIDTH = 4;
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
      title: 'Diagram — from a module hierarchy to a verdict',
      caption: 'A design is written as modules that instantiate other modules. Elaboration '
        + 'flattens that hierarchy into a single netlist of primitive gates, keeping the '
        + 'hierarchy only in the names — which is why a bug in elaboration is a bug in '
        + 'everything downstream, and why the flat netlist is what every later tool actually '
        + 'reads. From there the design is attacked three ways: simulation drives vectors and '
        + 'watches the waveform, equivalence checking compares every output against a model '
        + 'written from the specification, and coverage reports what the tests failed to '
        + 'exercise. Only the middle one can say "correct", and only because the input space of '
        + 'a combinational block is small enough to walk.',
      definition: [
        'flowchart TD',
        'SRC["module hierarchy<br/>modules instantiating modules"] --> EL["elaboration<br/>flatten to primitive gates"]',
        'EL --> NET["one flat netlist"]',
        'NET --> SIM["simulation<br/>drive vectors, watch the waveform"]',
        'NET --> EQ["equivalence check<br/>every vector against a model"]',
        'NET --> COV["coverage<br/>which wires never moved"]',
        'SIM --> V["verdict"]',
        'EQ --> V',
        'COV -.->|"says what the tests missed, not whether the design is right"| V'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**A hardware description is data, not a drawing, and that is the whole reason the '
        + 'industry moved to languages.** A module is a name, a list of ports and a body that '
        + 'wires things together. Being a value makes it diffable, parameterisable, '
        + 'generatable and testable — none of which a schematic is, and all of which are why a '
        + 'modern chip is written rather than drawn.',
      '**Elaboration flattens the hierarchy, and everything downstream sees only the result.** '
        + 'Modules are an organising device for people; the simulator, the timing analyser and '
        + 'the place-and-route tool all work on one flat netlist of primitive gates. The '
        + 'hierarchy survives as a naming convention, which is exactly how a linker treats your '
        + 'module boundaries.',
      '**A hardware language describes structure, not sequence, and that is the hardest '
        + 'adjustment for a programmer.** Two assignments in a description are not two steps: '
        + 'they are two pieces of hardware that exist simultaneously and forever. Order matters '
        + 'only through data dependence, which is why the mental model that works is a '
        + 'dataflow graph rather than a list of statements.',
      '**Combinational verification can be exhaustive, and that changes what "tested" means.** A '
        + 'block with ten inputs has 1024 possible vectors, so a check can cover all of them '
        + 'and the word "verified" means something precise. Past twenty or so inputs that stops '
        + 'being possible, and the honest thing is to report the fraction rather than to imply '
        + 'the rest.',
      '**Simulation shows behaviour over time; equivalence checking shows correctness.** A '
        + 'testbench tells you what happened on the vectors you thought of, including the '
        + 'glitches; an equivalence check tells you whether the netlist computes the specified '
        + 'function on every vector. They answer different questions and a design needs both.',
      '**Coverage is a statement about your tests, not about your design.** Vector coverage is '
        + 'the share of the input space visited; toggle coverage is the share of wires seen at '
        + 'both values. The demo shows a test list with respectable toggle coverage that misses '
        + 'the injected bug entirely, which is the same lesson as line coverage in software.',
      '**The injected typo is what verification is for.** With one gate changed, the design '
        + 'still elaborates, still simulates, still produces plausible waveforms, and is wrong '
        + 'on a subset of inputs. Nothing about the description looks suspicious — only the '
        + 'comparison against an independently written model finds it, and it names the exact '
        + 'vector.',
      '**Formal equivalence is what really runs in industry, and it is the same idea scaled.** '
        + 'Instead of walking every vector, a tool proves the two netlists compute the same '
        + 'function using the SAT machinery from the previous milestone. That is why a '
        + 'synthesis flow can apply thousands of transformations and still guarantee the result '
        + 'matches the source.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: { title: 'Interactive demo — elaborate, simulate, and try to hide a bug',
        markup: root.HdlTemplate.render() },
      diagram: diagram(),
      insight: insight()
    };
  }

  function insight() {
    return '**Hardware verification is the discipline software testing wishes it could afford, '
      + 'and the reason it can afford it is that the input space of a combinational block is '
      + 'finite and small.** When a block has ten inputs, "we checked every case" is a sentence '
      + 'with a proof behind it, and the whole culture that follows from that — a reference '
      + 'model written separately from the implementation, an assertion for every property, '
      + 'coverage measured and argued about, sign-off criteria that are numbers — is what a '
      + 'team does when exhaustiveness is achievable. Most software cannot do that, but the '
      + 'transferable parts are the ones this page demonstrates. Write the oracle from the '
      + 'specification, not from the implementation: a model derived from the code under test '
      + 'agrees with it by construction and proves nothing. Treat coverage as a measure of your '
      + 'tests rather than of your design: the demo\'s corner-case list has good toggle coverage '
      + 'and misses the injected bug, which is exactly how a codebase reaches ninety per cent '
      + 'line coverage with the bugs still in it. And where the space is too large to walk, say '
      + 'so and say what fraction you did walk — "sampled 400 of 131072, seeded, reproducible" '
      + 'is a claim somebody can check, and "well tested" is not. The last point is the '
      + 'strongest one: the injected typo here changes one gate, elaborates cleanly, simulates '
      + 'plausibly, and is wrong. No amount of reading the description finds it. Only a second, '
      + 'independent statement of what the thing is supposed to do does.';
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({
      controls: root.HdlTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------- plumbing */

  function fill(id, rows) {
    root.jQuery('#' + id + ' tbody').html(rows.map(function (cells) {
      return '<tr>' + cells.map(function (cell) {
        return '<td>' + root.Helpers.escapeHtml(String(cell)) + '</td>';
      }).join('') + '</tr>';
    }).join(''));
  }

  /** The library the demo elaborates, including the injectable typo, lives in
   *  `machines/hdl.js` so that a figure test can build the same broken design
   *  rather than a reimplementation of it. */
  function libraryFor(bug) {
    return Hdl.standardLibrary({ bug: bug, width: WIDTH });
  }

  /* --------------------------------------------------------------- models */

  function modelFor(name) {
    if (name === 'xor2') {
      return function (values) { return { y: values.a ^ values.b }; };
    }
    if (name === 'halfAdder') {
      return function (values) {
        return { sum: values.a ^ values.b, carry: values.a & values.b };
      };
    }
    if (name === 'fullAdder') {
      return function (values) {
        const total = (values.a ? 1 : 0) + (values.b ? 1 : 0) + (values.cin ? 1 : 0);

        return { sum: total & 1, carry: total > 1 ? 1 : 0 };
      };
    }
    return adderModel;
  }

  function adderModel(values) {
    let a = 0;
    let b = 0;

    for (let at = 0; at < WIDTH; at += 1) {
      a += (values['a' + at] ? 1 : 0) << at;
      b += (values['b' + at] ? 1 : 0) << at;
    }
    const total = a + b + (values.cin ? 1 : 0);
    const out = { cout: (total >> WIDTH) & 1 };

    for (let at = 0; at < WIDTH; at += 1) out['s' + at] = (total >> at) & 1;
    return out;
  }

  /* ---------------------------------------------------- vectors and study */

  function vectorsFor(net, kind) {
    const total = Math.pow(2, net.inputs.length);

    if (kind === 'single') return [Sim.assignmentOf(net, 0)];
    if (kind === 'corner') {
      return [0, 1, total - 1, Math.floor(total / 2)].filter(function (mask, at, list) {
        return list.indexOf(mask) === at;
      }).map(function (mask) { return Sim.assignmentOf(net, mask); });
    }
    const all = [];

    for (let mask = 0; mask < total; mask += 1) all.push(Sim.assignmentOf(net, mask));
    return all;
  }

  const studyFor = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);
    const lib = libraryFor(parts.bug);
    const net = Hdl.elaborate(lib, parts.name);
    const model = modelFor(parts.name);

    return { net: net, name: parts.name, model: model, lib: lib,
      gates: Sim.gateCount(net), path: Sim.criticalPath(net),
      instances: countInstances(net),
      equivalence: Hdl.equivalent(net, model, {}) };
  });

  /** Elaboration keeps the hierarchy in the labels, so counting the distinct
   *  prefixes recovers what was instantiated — which is how a synthesis report
   *  tells you where its gates came from. */
  function countInstances(net) {
    const seen = {};

    net.order.forEach(function (id) {
      const label = String(net.nodes[id].label || '');
      const cut = label.lastIndexOf('.');

      if (cut > 0) seen[label.slice(0, cut)] = true;
    });
    return Object.keys(seen).length;
  }

  function benchFor(view) {
    const study = view.study;
    const vectors = vectorsFor(study.net, view.tests);

    return { study: study, vectors: vectors,
      bench: Hdl.testbench(study.net, vectors, {}),
      coverage: Hdl.coverage(study.net, vectors) };
  }

  function reading() {
    const values = panel.values();

    return { name: values['hdl-module'], tests: values['hdl-tests'],
      bug: Boolean(values['hdl-bug']),
      study: studyFor(JSON.stringify({ name: values['hdl-module'],
        bug: Boolean(values['hdl-bug']) })) };
  }

  /* --------------------------------------------------------------- render */

  function update(app) {
    const view = reading();
    const run = benchFor(view);

    paintMetrics(view, run);
    paintGraph(app, view);
    paintBench(view, run);
    paintLibrary(view);
    paintCoverage(view);
    paintFlow(view);
    paintChart(app, view);
  }

  function paintMetrics(view, run) {
    const study = view.study;
    const equivalence = study.equivalence;

    root.MetricGrid.update({
      'hdl-instances': { value: study.instances,
        note: 'module instances, recovered from the flattened labels' },
      'hdl-gates': { value: study.gates,
        note: Sim.transistorCount(study.net) + ' transistors' },
      'hdl-depth': { value: study.path.delay, note: 'on the flat netlist, not the hierarchy' },
      'hdl-checked': { value: run.vectors.length,
        note: 'of ' + Math.pow(2, study.net.inputs.length) + ' possible' },
      'hdl-verdict': { value: verdict(equivalence), note: equivalence.why },
      'hdl-toggle': { value: (100 * run.coverage.toggleShare).toFixed(0) + '%',
        note: run.coverage.toggled + ' of ' + run.coverage.wires + ' wires seen at both values' }
    });
  }

  function verdict(equivalence) {
    if (!equivalence.exhaustive) return 'not attempted';
    return equivalence.ok ? 'matches the model' : 'DISAGREES';
  }

  function paintGraph(app, view) {
    const host = root.jQuery('#hdl-graph')[0];
    const built = root.CircuitGraph.definition(view.study.net,
      { critical: root.CircuitGraph.markPath(view.study.path.path) });

    if (!host) return;
    if (!built.tooLarge) app.mermaid.render(host, built.text);
    else root.jQuery(host).empty();
    root.Helpers.setText('hdl-graph-note', graphNote(view, built));
  }

  function graphNote(view, built) {
    const flat = 'The hierarchy is gone: elaboration produced ' + view.study.gates +
      ' primitive gates and kept the module names only as label prefixes.';

    if (built.tooLarge) return flat + ' Not drawn: ' + built.why + '.';
    return flat + ' The hexagons are the critical path, ' + view.study.path.delay +
      ' gate delays. Every later tool — the simulator, the timing analyser, the equivalence '
      + 'checker — reads this and not the source.';
  }

  function paintBench(view, run) {
    const rows = run.bench.rows.slice(0, 10).map(function (row) {
      const wanted = view.study.model(row.inputs);
      const bad = Object.keys(wanted).filter(function (port) {
        return (row.outputs[port] ? 1 : 0) !== (wanted[port] ? 1 : 0);
      });

      return [show(row.inputs), show(row.outputs), show(wanted),
        bad.length ? 'NO — ' + bad.join(', ') : 'yes', String(row.settleTime)];
    });

    fill('hdl-bench', rows);
    root.Helpers.setText('hdl-bench-caption', benchCaption(view, run));
  }

  function show(values) {
    return Object.keys(values).map(function (name) {
      return name + '=' + (values[name] ? 1 : 0);
    }).join(' ');
  }

  function benchCaption(view, run) {
    const shown = Math.min(10, run.bench.rows.length);
    const failing = run.bench.rows.filter(function (row) {
      const wanted = view.study.model(row.inputs);

      return Object.keys(wanted).some(function (port) {
        return (row.outputs[port] ? 1 : 0) !== (wanted[port] ? 1 : 0);
      });
    });

    return 'The first ' + shown + ' of ' + run.bench.rows.length + ' vectors, driven through '
      + 'the elaborated netlist with the model beside them. ' + failing.length + ' of the '
      + 'driven vectors disagree with the model. ' + (view.bug
        ? 'The typo is on: notice that most rows still pass, which is exactly why a bug like '
          + 'this survives a hand-written test list.'
        : 'Turn on the injected typo and watch which rows change — most of them will not.');
  }

  function paintLibrary(view) {
    fill('hdl-library', Object.keys(root.HdlTemplate.MODULES).map(function (name) {
      const study = studyFor(JSON.stringify({ name: name, bug: view.bug }));

      return [root.HdlTemplate.MODULES[name].label,
        study.net.inputs.length + ' in, ' + study.net.outputs.length + ' out',
        String(study.instances), String(study.gates), String(study.path.delay),
        study.equivalence.exhaustive
          ? study.equivalence.checked + ' vectors, ' +
            (study.equivalence.ok ? 'all agree' : 'FAILS at ' + show(study.equivalence.at))
          : 'too many inputs to walk'];
    }));
    root.Helpers.setText('hdl-library-caption', libraryCaption(view));
  }

  function libraryCaption(view) {
    const adder = studyFor(JSON.stringify({ name: 'adder4', bug: view.bug }));

    if (!view.bug) {
      return 'Four modules, each elaborated and each checked against its own model over its '
        + 'whole input space. The 4-bit adder is ' + adder.gates + ' gates built from nothing '
        + 'but repeated instantiation — which is the argument for describing hardware in a '
        + 'language rather than drawing it.';
    }
    return 'With the typo injected, the failure propagates: every module that instantiates the '
      + 'broken full adder now fails too, and each failure report names the exact input vector. '
      + 'The 4-bit adder fails at ' + (adder.equivalence.at ? show(adder.equivalence.at)
        : 'no vector') + ', which is a bug report rather than an opinion.';
  }

  function coverageRow(view, kind, label) {
    const study = view.study;
    const vectors = vectorsFor(study.net, kind);
    const coverage = Hdl.coverage(study.net, vectors);
    const caught = vectors.some(function (values) {
      const got = Sim.outputsOf(study.net, Sim.evaluate(study.net, values));
      const wanted = study.model(values);

      return Object.keys(wanted).some(function (port) {
        return (got[port] ? 1 : 0) !== (wanted[port] ? 1 : 0);
      });
    });

    return [label, String(vectors.length),
      (100 * coverage.vectorShare).toFixed(1) + '%',
      (100 * coverage.toggleShare).toFixed(0) + '%',
      view.bug ? (caught ? 'yes' : 'NO — it passes') : 'no bug injected'];
  }

  function paintCoverage(view) {
    fill('hdl-coverage', [
      coverageRow(view, 'exhaustive', 'every vector'),
      coverageRow(view, 'corner', 'corner cases, by hand'),
      coverageRow(view, 'single', 'one vector')
    ]);
    root.Helpers.setText('hdl-coverage-caption', coverageCaption(view));
  }

  function coverageCaption(view) {
    const corner = coverageRow(view, 'corner', 'corner');

    return 'Three test lists over the same netlist. The corner-case list drives ' + corner[1] +
      ' vectors — ' + corner[2] + ' of the input space — and reaches ' + corner[3] +
      ' toggle coverage, which reads like a respectable number. ' + (view.bug
        ? 'Whether it catches the injected bug is in the last column, and a high toggle '
          + 'coverage does not decide it.'
        : 'Inject the typo and see whether that number was measuring anything: toggle coverage '
          + 'says which wires moved, never whether the answer was right.');
  }

  function paintFlow(view) {
    fill('hdl-flow', [
      ['write the description', 'nothing yet — it is a structure, not a behaviour',
        'whether the structure computes what you meant',
        'writing the code'],
      ['elaborate', 'that every port is connected and every output driven',
        'anything about what the gates compute',
        'compiling: it catches shape errors, not meaning'],
      ['simulate a testbench', 'behaviour on the vectors you thought of, including glitches',
        'the vectors you did not think of',
        'unit tests with hand-written examples'],
      ['equivalence check', 'every output on every input vector, against a model',
        'anything about timing, power or the model being wrong too',
        'property-based testing, and at this scale a proof'],
      ['coverage', 'which wires your tests never moved',
        'whether the design is correct — it never looks at the outputs',
        'line and branch coverage, with the same failure mode']
    ]);
    root.Helpers.setText('hdl-flow-caption', 'Five steps, and only one of them can say '
      + '"correct". The row worth arguing about is the last: coverage measures your tests, and '
      + 'a design with excellent coverage and no reference model has been exercised rather '
      + 'than verified.');
  }

  function paintChart(app, view) {
    const host = root.jQuery('#hdl-chart')[0];

    if (!host) return;
    if (chart) chart.destroy();
    chart = root.ErrorBandView.bars(host, {
      lazyLib: app.lazyLib, height: 250, yLabel: 'percent',
      values: ['exhaustive', 'corner', 'single'].reduce(function (out, kind) {
        const coverage = Hdl.coverage(view.study.net, vectorsFor(view.study.net, kind));

        out.push({ label: kind + ' · vectors', value: 100 * coverage.vectorShare, series: 0 });
        out.push({ label: kind + ' · toggle', value: 100 * coverage.toggleShare, series: 1 });
        return out;
      }, [])
    });
    root.Helpers.setText('hdl-chart-note', chartNote(view));
  }

  function chartNote(view) {
    const corner = Hdl.coverage(view.study.net, vectorsFor(view.study.net, 'corner'));
    const single = Hdl.coverage(view.study.net, vectorsFor(view.study.net, 'single'));

    return 'Two bars per test list: the share of the input space visited and the share of wires '
      + 'seen at both values. The gap between them is the point — the corner-case list visits ' +
      (100 * corner.vectorShare).toFixed(1) + '% of the input space and still toggles ' +
      (100 * corner.toggleShare).toFixed(0) + '% of the wires, and even a single vector toggles '
      + (100 * single.toggleShare).toFixed(0) + '%. Toggle coverage saturates long before the '
      + 'testing does, which is why it is a floor rather than a goal.';
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
