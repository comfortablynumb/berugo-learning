/**
 * Section: Arithmetic circuits.
 *
 * Three adders that compute the same function and differ only in how the carry
 * gets from the bottom of the word to the top, plus the multiplier that shows
 * what happens when a structure is quadratic instead of linear. Every circuit
 * is checked against integer arithmetic — exhaustively where the input space
 * allows it and by a stated sample where it does not, with the count printed
 * either way.
 *
 * The measurement that matters most here is the settling time, not the depth.
 * Depth is the worst case over all inputs; settling time is what these
 * operands actually cost, and on a ripple adder the two differ by a factor
 * that depends entirely on the data.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'arithmetic-circuits';
  const Sim = root.LogicSim;
  const Adder = root.Blocks.Adder;
  const WIDTHS = [4, 8, 16];
  const SAMPLES = 400;
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
      title: 'Diagram — generate and propagate, which is the whole idea behind fast addition',
      caption: 'A bit position generates a carry when both its inputs are 1, and propagates an '
        + 'incoming carry when exactly one of them is. Those two signals depend only on the '
        + 'operands, so every bit can compute them at the same time, in one gate delay. A '
        + 'ripple adder ignores this and passes the carry through a full adder per bit; a '
        + 'lookahead adder expands the recurrence — carry out is generate, or propagate and '
        + 'carry in — into a two-level expression per bit, so all the carries appear together. '
        + 'That is why fast addition is a prefix computation: the same associative-scan shape '
        + 'as a parallel prefix sum, and the reason a 64-bit add is one cycle.',
      definition: [
        'flowchart LR',
        'A(["a_i"]) --> G["generate<br/>a AND b"]',
        'B(["b_i"]) --> G',
        'A --> P["propagate<br/>a XOR b"]',
        'B --> P',
        'G --> C["carry out<br/>g OR (p AND carry in)"]',
        'P --> C',
        'CI(["carry in"]) --> C',
        'P --> S["sum<br/>p XOR carry in"]',
        'CI --> S',
        'C -->|"ripple: wait for it"| NEXT["the next bit"]',
        'G -.->|"lookahead: expand the recurrence"| ALL["every carry at once"]',
        'P -.-> ALL'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**A full adder is three inputs and two outputs, and the whole of addition is a chain of '
        + 'them.** Sum is the exclusive-or of all three inputs; carry is the majority of them. '
        + 'Both were built in the first section of this milestone, which is the point. Nothing '
        + 'new is needed to add, only a lot of it, arranged so the carry reaches the top of the '
        + 'word in time.',
      '**Ripple carry is correct and its delay is linear in the width.** Bit one cannot finish '
        + 'until bit zero has decided its carry, so a 64-bit ripple adder is 64 carry delays '
        + 'deep. That is fine at four bits and unusable at sixty-four, and it is the reason '
        + 'every real datapath contains one of the other two structures on this page.',
      '**Generate and propagate turn the carry chain into a prefix computation.** Bit i '
        + 'generates a carry when both operands are 1 and propagates one when exactly one is. '
        + 'Those signals are available in one gate delay everywhere at once, and the carry '
        + 'recurrence over them is associative. So it can be evaluated as a tree, which is '
        + 'exactly the parallel prefix scan from the algorithms track.',
      '**Carry lookahead trades gates for depth, quadratically.** Expanding the recurrence for '
        + 'every bit gives constant depth per carry, and a term count that grows with the square '
        + 'of the width. That is why real adders build lookahead in four-bit blocks and ripple '
        + 'between blocks, or use a Kogge–Stone tree that is log-depth with a regular layout.',
      '**Carry select buys speed with duplication instead of with fan-in.** Compute the top half '
        + 'twice, once for each possible incoming carry, and let a multiplexer choose when the '
        + 'bottom half finishes. The delay is half the ripple plus one mux, and the area is '
        + 'about 1.5 times a ripple adder — a different point on the same line.',
      '**Subtraction is addition, and that is what two\'s complement is for.** Invert the second '
        + 'operand, set the carry in, and the same adder computes a minus b. No subtractor '
        + 'exists in a datapath, and the sign bit needs no special case. Overflow is detected by '
        + 'comparing the carry into the top bit with the carry out of it.',
      '**Multiplication is quadratic in gates and linear in depth, and no identity removes that.** '
        + 'One AND gate per pair of bits gives the partial products in one delay, and then they '
        + 'have to be added. That is why multiply is three or four cycles where add is one, and '
        + 'why compilers turn a multiply by a constant into shifts and adds. Division is worse '
        + 'still.',
      '**The delay in the metrics is the worst case; the settling time is this data.** A ripple '
        + 'adder given operands that generate no carries settles in a couple of gate delays and '
        + 'given all-ones plus one takes the full chain. Real timing has to assume the worst '
        + 'case, because the clock cannot ask. That gap between typical and worst is the whole '
        + 'business of static timing analysis two sections from here.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: { title: 'Interactive demo — add with gates, and watch the carry take its time',
        markup: root.ArithTemplate.render() },
      diagram: diagram(),
      insight: insight()
    };
  }

  function insight() {
    return '**Addition is a prefix scan, and once you see that, half of parallel computing and '
      + 'most of a datapath become the same subject.** The carry recurrence is associative: '
      + 'carry out equals generate, or propagate and carry in. Any associative recurrence '
      + 'can be evaluated as a balanced tree in logarithmic depth instead of a chain in linear '
      + 'depth. That single fact is what makes a 64-bit add fit in one cycle. It is also what '
      + 'makes a parallel prefix sum, a segmented scan, a stream compaction and a parallel '
      + 'tokeniser work. It is why the algorithms track spent a section on scan. The second '
      + 'thing to carry away is the shape of the cost table. Add and subtract are one cycle '
      + 'because they are log-depth prefix networks. Shift is one cycle because it is a mux '
      + 'tree. Multiply is a few cycles because it is a quadratic array of adders that has to '
      + 'be reduced. Divide is many cycles because its recurrence is not associative — each '
      + 'step needs the previous remainder — so no tree exists to flatten it. When a compiler '
      + 'replaces `x / 10` with a multiply and a shift, it is buying its way out of exactly '
      + 'that non-associativity. The reason it can is that the divisor was known at compile '
      + 'time.';
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({
      controls: root.ArithTemplate.controls,
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

  function buildAdder(kind, width) {
    if (kind === 'lookahead') return Adder.carryLookahead({ width: width });
    if (kind === 'select') return Adder.carrySelect({ width: width });
    return Adder.rippleCarry({ width: width });
  }

  function operands(a, b, carry, width) {
    const values = {};

    for (let at = 0; at < width; at += 1) {
      values['a' + at] = (a >> at) & 1;
      values['b' + at] = (b >> at) & 1;
    }
    values.cin = carry ? 1 : 0;
    return values;
  }

  function readSum(outputs, width) {
    let total = 0;

    for (let at = 0; at < width; at += 1) total += (outputs['s' + at] ? 1 : 0) << at;
    return total + (outputs.cout ? 1 : 0) * Math.pow(2, width);
  }

  /* ------------------------------------------- checking against arithmetic */

  /** Exhaustive where the space allows it and a stated sample where it does
   *  not. The count is reported either way, because "checked" without a
   *  denominator is not a result. */
  function checkAdder(net, width) {
    const total = Math.pow(2, 2 * width + 1);

    if (total <= 4096) return walk(net, width, total, null);
    return walk(net, width, SAMPLES, root.Random.seeded(20250829 + width));
  }

  function walk(net, width, count, random) {
    const limit = Math.pow(2, width);

    for (let at = 0; at < count; at += 1) {
      const pick = vectorFor(at, width, limit, random);
      const got = readSum(Sim.outputsOf(net, Sim.evaluate(net,
        operands(pick.a, pick.b, pick.carry, width))), width);

      if (got !== pick.a + pick.b + pick.carry) {
        return { checked: at + 1, ok: false, exhaustive: !random,
          why: pick.a + ' + ' + pick.b + ' + ' + pick.carry + ' gave ' + got };
      }
    }
    return { checked: count, ok: true, exhaustive: !random,
      why: random ? 'a seeded sample of ' + count + ' of the ' +
        Math.pow(2, 2 * width + 1) + ' possible vectors'
        : 'every one of the ' + count + ' possible vectors' };
  }

  function vectorFor(at, width, limit, random) {
    /* `Random.int` takes a BOUND, not a range: int(0, n) asks for a value in
       [0, 0) and answers 0 every time. The first version of this sampled four
       hundred vectors of 0 + 0 + 0 and reported them as coverage. */
    if (random) {
      return { a: random.int(limit), b: random.int(limit), carry: random.int(2) };
    }
    return { a: at % limit, b: Math.floor(at / limit) % limit,
      carry: Math.floor(at / (limit * limit)) };
  }

  /* ---------------------------------------------------------- the measure */

  const studyFor = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);
    const net = buildAdder(parts.kind, parts.width);
    const worst = Sim.transition(net, operands(0, 0, false, parts.width),
      operands(Math.pow(2, parts.width) - 1, 1, false, parts.width), {});

    return { net: net, kind: parts.kind, width: parts.width,
      gates: Sim.gateCount(net), transistors: Sim.transistorCount(net),
      path: Sim.criticalPath(net), worst: worst.settleTime,
      check: checkAdder(net, parts.width) };
  });

  const multiplierFor = root.Helpers.memoise(function (width) {
    const net = Adder.arrayMultiplier({ width: width });

    return { net: net, width: width, gates: Sim.gateCount(net),
      path: Sim.criticalPath(net), check: checkMultiplier(net, width) };
  });

  function checkMultiplier(net, width) {
    const limit = Math.pow(2, width);

    for (let a = 0; a < limit; a += 1) {
      for (let b = 0; b < limit; b += 1) {
        const values = operands(a, b, false, width);
        const out = Sim.outputsOf(net, Sim.evaluate(net, values));
        let got = 0;

        for (let at = 0; at < 2 * width; at += 1) got += (out['p' + at] ? 1 : 0) << at;
        if (got !== a * b) return { ok: false, checked: a * limit + b + 1 };
      }
    }
    return { ok: true, checked: limit * limit };
  }

  function reading() {
    const values = panel.values();
    const width = Number(values['art-width']);
    const limit = Math.pow(2, width) - 1;

    return { study: studyFor(JSON.stringify({ kind: values['art-adder'], width: width })),
      a: Math.min(Number(values['art-a']), limit),
      b: Math.min(Number(values['art-b']), limit),
      carry: Boolean(values['art-carry']), width: width };
  }

  /* --------------------------------------------------------------- render */

  function update(app) {
    const view = reading();
    const values = operands(view.a, view.b, view.carry, view.width);
    const run = Sim.simulate(view.study.net, values, { record: false });

    paintMetrics(view, run);
    paintBits(view, run);
    paintCompare(view);
    paintScaling();
    paintMultiply(view);
    paintTricks(view);
    paintChart(app);
  }

  function paintMetrics(view, run) {
    const got = readSum(run.outputs, view.width);
    const wanted = view.a + view.b + (view.carry ? 1 : 0);
    const study = view.study;

    root.MetricGrid.update({
      'art-result': { value: view.a + ' + ' + view.b + (view.carry ? ' + 1' : '') + ' = ' + got,
        note: got === wanted ? 'which is what integer addition says'
          : 'WRONG — arithmetic says ' + wanted },
      'art-gates': { value: study.gates, note: study.transistors + ' transistors' },
      'art-depth': { value: study.path.delay, note: 'the longest gate chain in the netlist' },
      'art-settle': { value: run.settleTime,
        note: 'worst case for this adder is ' + study.worst },
      'art-checked': { value: study.check.checked, note: study.check.why },
      'art-verdict': { value: study.check.ok ? 'agrees with integer addition' : 'DISAGREES',
        note: study.check.exhaustive ? 'exhaustive' : 'sampled, seeded, reproducible' }
    });
  }

  function paintBits(view, run) {
    const width = view.width;
    const rows = [];

    for (let at = width - 1; at >= 0; at -= 1) {
      const a = (view.a >> at) & 1;
      const b = (view.b >> at) & 1;
      const carryIn = carryInto(view, at);

      rows.push([String(at), String(a), String(b), String(carryIn),
        String(run.outputs['s' + at] ? 1 : 0), String(carryInto(view, at + 1)),
        (a && b ? 'generate' : (a !== b ? 'propagate' : 'kill'))]);
    }
    fill('art-bits', rows);
    root.Helpers.setText('art-bits-caption', bitsCaption(view));
  }

  /** The carry into position `at`, from arithmetic rather than from the
   *  circuit — so the table is a check on the circuit, not a copy of it. */
  function carryInto(view, at) {
    const mask = Math.pow(2, at) - 1;
    const total = (view.a & mask) + (view.b & mask) + (view.carry ? 1 : 0);

    return total > mask ? 1 : 0;
  }

  function bitsCaption(view) {
    const generated = countWhere(view, function (a, b) { return a && b; });
    const propagated = countWhere(view, function (a, b) { return a !== b; });

    return 'The same addition bit by bit. Positions that generate a carry whatever arrives '
      + 'from below: ' + generated + '. Positions that merely pass one along: ' + propagated +
      ' — and a run of propagates is exactly what makes a ripple adder slow, because the '
      + 'carry has to walk '
      + 'through every one of them. The carry column is computed from arithmetic, not read off '
      + 'the wires, so this table is a check on the circuit rather than a picture of it.';
  }

  function countWhere(view, test) {
    let found = 0;

    for (let at = 0; at < view.width; at += 1) {
      if (test((view.a >> at) & 1, (view.b >> at) & 1)) found += 1;
    }
    return found;
  }

  function paintCompare(view) {
    fill('art-compare', Object.keys(root.ArithTemplate.ADDERS).map(function (kind) {
      const study = studyFor(JSON.stringify({ kind: kind, width: view.width }));

      return [root.ArithTemplate.ADDERS[kind].label, String(study.gates),
        String(study.transistors), String(study.path.delay), String(study.worst),
        study.check.ok ? 'yes — ' + study.check.checked + ' vectors' : 'NO'];
    }));
    root.Helpers.setText('art-compare-caption', compareCaption(view));
  }

  function compareCaption(view) {
    const ripple = studyFor(JSON.stringify({ kind: 'ripple', width: view.width }));
    const look = studyFor(JSON.stringify({ kind: 'lookahead', width: view.width }));
    const select = studyFor(JSON.stringify({ kind: 'select', width: view.width }));

    return 'Three ways to add ' + view.width + '-bit numbers. The worst-case settling column is '
      + 'measured by driving the adder from zero to all-ones-plus-one, which is the carry chain '
      + 'at its longest: ' + ripple.worst + ' for the ripple, ' + look.worst +
      ' for the lookahead and ' + select.worst + ' for the select. The gate columns are the '
      + 'price — ' + look.gates + ' against ' + ripple.gates + ' — and that ratio is what grows '
      + 'as the word gets wider.';
  }

  function paintScaling() {
    fill('art-scaling', WIDTHS.map(function (width) {
      const ripple = studyFor(JSON.stringify({ kind: 'ripple', width: width }));
      const look = studyFor(JSON.stringify({ kind: 'lookahead', width: width }));
      const select = studyFor(JSON.stringify({ kind: 'select', width: width }));

      return [width + ' bits', ripple.gates + ' / ' + ripple.path.delay,
        look.gates + ' / ' + look.path.delay, select.gates + ' / ' + select.path.delay,
        (ripple.path.delay / look.path.delay).toFixed(2) + '× shallower, ' +
          (look.gates / ripple.gates).toFixed(2) + '× the gates'];
    }));
    root.Helpers.setText('art-scaling-caption', scalingCaption());
  }

  function scalingCaption() {
    const wide = studyFor(JSON.stringify({ kind: 'lookahead', width: 16 }));
    const slow = studyFor(JSON.stringify({ kind: 'ripple', width: 16 }));

    return 'Doubling the width doubles the ripple depth and adds a constant to the lookahead '
      + 'depth — at 16 bits that is ' + slow.path.delay + ' against ' + wide.path.delay +
      ' gate delays. The gate columns go the other way: ' + wide.gates + ' against ' +
      slow.gates + '. A real 64-bit adder takes neither extreme, building lookahead in small '
      + 'blocks and rippling between them, because the quadratic term stops being affordable '
      + 'long before 64 bits.';
  }

  function paintMultiply(view) {
    fill('art-multiply', [2, 3, 4].map(function (width) {
      const mult = multiplierFor(width);
      const add = studyFor(JSON.stringify({ kind: 'ripple', width: width }));

      return [width + ' bits', String(width * width), String(mult.gates),
        String(mult.path.delay),
        (mult.gates / add.gates).toFixed(1) + '× the gates, ' +
          (mult.path.delay / add.path.delay).toFixed(2) + '× the depth' +
          (mult.check.ok ? ' · exact on all ' + mult.check.checked + ' products' : ' · WRONG')];
    }));
    root.Helpers.setText('art-multiply-caption', multiplyCaption(view));
  }

  function multiplyCaption() {
    const four = multiplierFor(4);
    const add = studyFor(JSON.stringify({ kind: 'ripple', width: 4 }));

    return 'An array multiplier is one AND per pair of bits — the partial products, all '
      + 'available in one gate delay — and then an adder array to sum them. At 4 bits that is ' +
      four.gates + ' gates at depth ' + four.path.delay + ' against ' + add.gates +
      ' at depth ' + add.path.delay + ' for the adder, and every one of the ' +
      four.check.checked + ' possible products was checked against integer multiplication. The '
      + 'gate count grows with the square of the width; the depth grows linearly. That is the '
      + 'whole answer to "why is multiply slower than add".';
  }

  function paintTricks(view) {
    const width = view.width;

    fill('art-tricks', [
      ['a − b', 'invert b, force the carry in to 1, use the same adder',
        'one inverter per bit and nothing else',
        'why there is no subtract instruction penalty, and why unsigned wrap is free'],
      ['negate', 'invert every bit and add one',
        'the same adder again',
        'why the two\'s-complement range is asymmetric: −2^' + (width - 1) + ' has no positive'],
      ['× 2^k', 'wire the bits k positions left', 'no gates at all — it is routing',
        'why the compiler turns × 8 into a shift and × 10 into shift-add-shift'],
      ['÷ by a constant', 'multiply by a reciprocal and shift',
        'one multiply plus a shift instead of a division recurrence',
        'why constant division is fast and variable division is not'],
      ['overflow', 'compare the carry into the top bit with the carry out of it',
        'one exclusive-or', 'why signed overflow is detectable but not free, and why C left it '
          + 'undefined rather than pay for it']
    ]);
    root.Helpers.setText('art-tricks-caption', 'None of these are tricks in the circuit; they '
      + 'are what the adder already does, viewed from the instruction set. The reason a '
      + 'datapath has one adder and not four is in this table.');
  }

  function paintChart(app) {
    const host = root.jQuery('#art-chart')[0];

    if (!host) return;
    if (chart) chart.destroy();
    chart = root.ErrorBandView.bars(host, {
      lazyLib: app.lazyLib, height: 260, logY: true,
      yLabel: 'gate delays and gates (log scale)', values: chartValues()
    });
    root.Helpers.setText('art-chart-note', chartNote());
  }

  function chartValues() {
    const out = [];

    WIDTHS.forEach(function (width) {
      Object.keys(root.ArithTemplate.ADDERS).forEach(function (kind, index) {
        const study = studyFor(JSON.stringify({ kind: kind, width: width }));

        out.push({ label: width + 'b ' + kind + ' depth', value: study.path.delay,
          series: index });
      });
    });
    return out;
  }

  function chartNote() {
    const ripple = studyFor(JSON.stringify({ kind: 'ripple', width: 16 }));
    const look = studyFor(JSON.stringify({ kind: 'lookahead', width: 16 }));
    const select = studyFor(JSON.stringify({ kind: 'select', width: 16 }));

    return 'Critical-path depth for the three adders at 4, 8 and 16 bits, on a log axis. The '
      + 'ripple bars double with the width; the lookahead bars grow slowly and the select bars '
      + 'sit between them. At 16 bits: ' + ripple.path.delay + ', ' + look.path.delay + ' and ' +
      select.path.delay + ' gate delays, for ' + ripple.gates + ', ' + look.gates + ' and ' +
      select.gates + ' gates.';
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
