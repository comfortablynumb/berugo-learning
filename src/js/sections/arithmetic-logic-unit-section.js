/**
 * Section: The arithmetic logic unit.
 *
 * One block that computes four functions and the four flags a branch reads,
 * built from the adder of the previous section plus a multiplexer per bit.
 * The flags are the interesting half: they are where signed and unsigned
 * interpretation of the same bits diverges, and where a processor's condition
 * codes come from.
 *
 * Everything is checked against `Blocks.Alu.reference`, which is written from
 * the definitions of the operations and the flags rather than from the
 * circuit. At four bits the check is exhaustive over operands and operation;
 * wider, it is a seeded sample and says so.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'arithmetic-logic-unit';
  const Sim = root.LogicSim;
  const Alu = root.Blocks.Alu;
  const Adder = root.Blocks.Adder;
  const WIDTHS = [4, 8, 16];
  const SAMPLES = 300;
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
      title: 'Diagram — one adder, one logic path, and a multiplexer per bit',
      caption: 'The low bit of the operation code does two jobs on the arithmetic side: it '
        + 'inverts the second operand and it supplies the carry in, which turns the adder into '
        + 'a subtractor. On the logic side the same bit picks between AND and XOR. The high bit '
        + 'then chooses between the two halves. That is why an ALU is barely more expensive '
        + 'than the adder inside it — the operations share the wide, slow structure and differ '
        + 'only in cheap multiplexing. The flags hang off the result: zero is a NOR of every '
        + 'result bit, negative is the top bit, carry is the adder carry out, and overflow '
        + 'compares the carry into the top bit with the carry out of it.',
      definition: [
        'flowchart LR',
        'A(["a"]) --> ADD["adder<br/>a + (b XOR op0) + op0"]',
        'B(["b"]) --> INV["conditional invert"]',
        'INV --> ADD',
        'OP0(["op0"]) --> INV',
        'OP0 -->|"carry in"| ADD',
        'A --> LOG["and / xor"]',
        'B --> LOG',
        'OP0 --> LOG',
        'ADD --> MUX["result mux, one per bit"]',
        'LOG --> MUX',
        'OP1(["op1"]) --> MUX',
        'MUX --> R["result"]',
        'MUX --> Z["zero flag<br/>NOR of every bit"]',
        'ADD -->|"carry out, carry into top"| F["carry and overflow"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**An ALU is one adder plus a multiplexer, and that is why it is affordable.** The wide, '
        + 'slow, expensive structure is the carry chain, and it is built once. AND and XOR are '
        + 'a gate per bit with no chain at all, so adding them to the block costs almost '
        + 'nothing next to the adder they sit beside. Sharing the expensive structure is the '
        + 'whole design.',
      '**Subtraction reuses the adder because of two\'s complement, and the operation code does '
        + 'it for free.** Inverting b and forcing a carry in computes a + (not b) + 1, which is '
        + 'a − b. The low bit of the operation code is both the invert control and the carry in, '
        + 'so the same two wires that select "subtract" also configure the datapath to perform '
        + 'it.',
      '**The flags are where signed and unsigned stop being the same bits.** Carry is the '
        + 'unsigned answer: the result did not fit in the word. Overflow is the signed one: the '
        + 'operands agreed in sign and the result disagreed. The same addition can set one, the '
        + 'other, both or neither, and which one your program should look at depends entirely '
        + 'on a type the hardware never saw.',
      '**Zero is a wide NOR, and it is on the critical path.** Deciding that every bit of the '
        + 'result is 0 needs a tree over the whole word, and that tree starts only after the '
        + 'result is final. This is why a compare-and-branch is sometimes a cycle longer than an '
        + 'arithmetic instruction, and why some architectures make the branch read the operands '
        + 'directly rather than the flags.',
      '**Flags for the logic operations are forced, not inherited.** The adder is still running '
        + 'during an AND — its output is simply not selected — so the carry it produces is '
        + 'meaningless. The block drives carry and overflow low for the logic operations rather '
        + 'than leaving whatever the adder computed, because a flag that is stale is worse than '
        + 'a flag that is wrong.',
      '**Condition codes are shared mutable state, and their cost shows up in modern cores.** '
        + 'Every arithmetic instruction writes them, so an out-of-order machine must rename them '
        + 'like a register, and a branch depends on the last writer. That is why some '
        + 'architectures dropped flags entirely and made comparison an instruction that writes a '
        + 'general register.',
      '**The operation select is part of the critical path, and widening the ALU widens it.** '
        + 'Each extra operation is another input on the result multiplexer, which is another '
        + 'level of the tree in front of every result bit. An ALU with sixteen operations pays '
        + 'for them in depth even when the program only ever adds.',
      '**Verification here is exhaustive because it can be.** A four-bit ALU has ten inputs and '
        + 'therefore 1024 combinations of operands and operation, so the demo runs all of them '
        + 'against a reference written from the definitions. At eight bits the space is 262144 '
        + 'and the demo samples it with a fixed seed and says how many — which is the honest '
        + 'version of the same claim.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: { title: 'Interactive demo — four operations, four flags, one adder',
        markup: root.AluTemplate.render() },
      diagram: diagram(),
      insight: insight()
    };
  }

  function insight() {
    return '**The flags are the place where a piece of hardware admits it does not know what '
      + 'your numbers mean, and almost every integer bug in production lives in that gap.** The '
      + 'ALU adds bit patterns. Whether the pattern 0xFF is 255 or −1 is a fact about your '
      + 'program, not about the circuit, so the block computes both answers to "did that '
      + 'overflow" — carry for the unsigned reading, overflow for the signed one — and leaves '
      + 'the choice to the instruction that reads them. That is why C has unsigned wraparound '
      + 'defined and signed overflow undefined, why `a < b` compiles to a different branch for '
      + 'each type, and why mixing the two in one expression is the reliable way to produce a '
      + 'bug that only appears at the boundary. The second thing worth taking is the sharing '
      + 'argument, because it is a design pattern rather than a fact about ALUs. One expensive '
      + 'structure, several cheap paths beside it, and a multiplexer to choose: that is how a '
      + 'floating-point unit shares a multiplier array between multiply and fused multiply-add, '
      + 'how a cache shares one tag comparator across ways, and how a well-factored piece of '
      + 'software shares one hot path between several thin wrappers. The cost is the '
      + 'multiplexer, and the multiplexer is on the critical path — so the sharing is not free, '
      + 'it is just cheaper than duplication.';
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({
      controls: root.AluTemplate.controls,
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

  function inputsFor(a, b, op, width) {
    const values = {};

    for (let at = 0; at < width; at += 1) {
      values['a' + at] = (a >> at) & 1;
      values['b' + at] = (b >> at) & 1;
    }
    values.op0 = op & 1;
    values.op1 = (op >> 1) & 1;
    return values;
  }

  function resultOf(outputs, width) {
    let value = 0;

    for (let at = 0; at < width; at += 1) value += (outputs['r' + at] ? 1 : 0) << at;
    return { value: value, zero: outputs.zero ? 1 : 0, negative: outputs.negative ? 1 : 0,
      carry: outputs.carry ? 1 : 0, overflow: outputs.overflow ? 1 : 0 };
  }

  function expected(a, b, op, width) {
    const model = Alu.reference(a, b, op, width);

    return Object.assign({ value: model.value },
      Alu.flagsOf(model.value, model.carry, model.overflow, width));
  }

  function disagreement(got, want) {
    return ['value', 'zero', 'negative', 'carry', 'overflow'].filter(function (name) {
      return got[name] !== want[name];
    });
  }

  /* ---------------------------------------------------------- the measure */

  const studyFor = root.Helpers.memoise(function (width) {
    const net = Alu.alu({ width: width });

    return { net: net, width: width, gates: Sim.gateCount(net),
      transistors: Sim.transistorCount(net), path: Sim.criticalPath(net),
      check: checkAlu(net, width) };
  });

  function runOne(net, a, b, op, width) {
    return resultOf(Sim.outputsOf(net, Sim.evaluate(net, inputsFor(a, b, op, width))), width);
  }

  /** Exhaustive at four bits, a seeded sample above it, and the denominator
   *  printed either way. */
  function checkAlu(net, width) {
    const limit = Math.pow(2, width);
    const total = limit * limit * 4;

    if (total <= 4096) return sweep(net, width, limit);
    return sample(net, width, limit);
  }

  function sweep(net, width, limit) {
    for (let a = 0; a < limit; a += 1) {
      for (let b = 0; b < limit; b += 1) {
        for (let op = 0; op < 4; op += 1) {
          const bad = disagreement(runOne(net, a, b, op, width),
            expected(a, b, op, width));

          if (bad.length) {
            return { ok: false, checked: 0, exhaustive: true,
              why: a + ' ' + op + ' ' + b + ' disagrees on ' + bad.join(', ') };
          }
        }
      }
    }
    return { ok: true, checked: limit * limit * 4, exhaustive: true,
      why: 'every operand pair and every operation' };
  }

  function sample(net, width, limit) {
    const random = root.Random.seeded(20250829 + width);

    for (let at = 0; at < SAMPLES; at += 1) {
      const a = random.int(limit);
      const b = random.int(limit);
      const op = random.int(4);
      const bad = disagreement(runOne(net, a, b, op, width), expected(a, b, op, width));

      if (bad.length) {
        return { ok: false, checked: at + 1, exhaustive: false,
          why: a + ' ' + op + ' ' + b + ' disagrees on ' + bad.join(', ') };
      }
    }
    return { ok: true, checked: SAMPLES, exhaustive: false,
      why: 'a seeded sample of ' + SAMPLES + ' of the ' + (limit * limit * 4) + ' cases' };
  }

  function reading() {
    const values = panel.values();
    const width = Number(values['alu-width']);
    const limit = Math.pow(2, width) - 1;

    return { study: studyFor(width), width: width, op: Number(values['alu-op']),
      a: Math.min(Number(values['alu-a']), limit),
      b: Math.min(Number(values['alu-b']), limit) };
  }

  function flagText(row) {
    const set = ['zero', 'negative', 'carry', 'overflow'].filter(function (name) {
      return row[name];
    });

    return set.length ? set.join(', ') : 'none';
  }

  /* --------------------------------------------------------------- render */

  function update(app) {
    const view = reading();

    paintMetrics(view);
    paintOps(view);
    paintFlagTable(view);
    paintCases(view);
    paintCost(view);
    paintIsa();
    paintChart(app);
  }

  function paintMetrics(view) {
    const got = runOne(view.study.net, view.a, view.b, view.op, view.width);
    const want = expected(view.a, view.b, view.op, view.width);
    const study = view.study;

    root.MetricGrid.update({
      'alu-result': { value: got.value,
        note: 'as a signed ' + view.width + '-bit value: ' + Alu.signed(got.value, view.width) },
      'alu-flags': { value: flagText(got),
        note: disagreement(got, want).length ? 'DISAGREES with the reference'
          : 'the reference agrees, flag for flag' },
      'alu-gates': { value: study.gates, note: study.transistors + ' transistors' },
      'alu-depth': { value: study.path.delay,
        note: 'a bare adder of this width is ' + adderDepth(view.width) },
      'alu-checked': { value: study.check.checked, note: study.check.why },
      'alu-verdict': { value: study.check.ok ? 'matches the reference' : 'DISAGREES',
        note: study.check.exhaustive ? 'exhaustive over the whole space'
          : 'sampled with a fixed seed, so it reproduces' }
    });
  }

  const adderStudy = root.Helpers.memoise(function (width) {
    const net = Adder.rippleCarry({ width: width });

    return { gates: Sim.gateCount(net), depth: Sim.criticalPath(net).delay };
  });

  function adderDepth(width) {
    return adderStudy(width).depth;
  }

  function paintOps(view) {
    fill('alu-ops', Alu.OPERATIONS.map(function (op) {
      const got = runOne(view.study.net, view.a, view.b, op.code, view.width);
      const want = expected(view.a, view.b, op.code, view.width);
      const bad = disagreement(got, want);

      return [op.name + ' — ' + op.about, String(got.value),
        String(Alu.signed(got.value, view.width)), flagText(got),
        bad.length ? 'NO — ' + bad.join(', ') : 'yes'];
    }));
    root.Helpers.setText('alu-ops-caption', opsCaption(view));
  }

  function opsCaption(view) {
    const sub = runOne(view.study.net, view.a, view.b, 1, view.width);

    return 'All four operations on the same operands, run through the gates and compared '
      + 'flag by flag with the reference. The subtract row is the one to read against the add '
      + 'row: same adder, same wires, and the operation bit that selected it also inverted the '
      + 'second operand and supplied the carry in. ' + view.a + ' − ' + view.b + ' gives ' +
      sub.value + ' with flags ' + flagText(sub) + '.';
  }

  function paintFlagTable(view) {
    fill('alu-flagtable', [
      ['zero', 'every bit of the result is 0', 'a NOR tree over the whole result',
        'branch if equal, after a compare', 'a compare that sets flags you then clobber'],
      ['negative', 'the top bit of the result is 1', 'a wire — no gates at all',
        'branch if minus', 'reading it as unsigned, where the top bit means large'],
      ['carry', 'the unsigned result did not fit', 'the carry out of the adder',
        'branch if unsigned above or below',
        'using it for signed comparison, which is the classic off-by-a-sign bug'],
      ['overflow', 'the operands agreed in sign and the result did not',
        'the carry into the top bit, exclusive-ored with the carry out of it',
        'branch if signed greater or less',
        'assuming signed overflow wraps — in C it is undefined, so the compiler assumes it '
          + 'cannot happen'],
      ['for AND and XOR', 'carry and overflow are forced to 0',
        'an AND with the inverted operation bit', 'nothing reads them',
        'leaving the adder\'s value visible instead, which is stale rather than merely wrong']
    ]);
    root.Helpers.setText('alu-flagtable-caption', 'Four flags, and the same result bits read '
      + 'two different ways. At ' + view.width + ' bits the pattern for −1 is ' +
      (Math.pow(2, view.width) - 1) + ' unsigned, so "did it overflow" has two different '
      + 'correct answers and the hardware computes both.');
  }

  function caseRows(view) {
    const width = view.width;
    const top = Math.pow(2, width - 1);
    const all = Math.pow(2, width) - 1;

    return [
      { name: 'unsigned wrap', a: all, b: 1, op: 0,
        why: 'the sum needs one more bit than the word has, so carry is set and overflow '
          + 'is not — as signed values this is −1 + 1 = 0, which is correct' },
      { name: 'signed overflow', a: top - 1, b: 1, op: 0,
        why: 'the largest positive plus one is the most negative: overflow is set and carry '
          + 'is not' },
      { name: 'subtract to zero', a: 42 % (all + 1), b: 42 % (all + 1), op: 1,
        why: 'equal operands set the zero flag, which is exactly what a compare instruction is' },
      { name: 'borrow', a: 0, b: 1, op: 1,
        why: 'zero minus one is all ones, and the carry flag is CLEAR — on this convention a '
          + 'clear carry after a subtract means a borrow happened' },
      { name: 'negate the most negative', a: 0, b: top, op: 1,
        why: 'there is no positive counterpart, so the result is itself and overflow is set' }
    ].map(function (entry) {
      const got = runOne(view.study.net, entry.a, entry.b, entry.op, width);
      const want = expected(entry.a, entry.b, entry.op, width);

      return [entry.name, entry.a + (entry.op === 1 ? ' − ' : ' + ') + entry.b,
        got.value + ' (signed ' + Alu.signed(got.value, width) + ')',
        flagText(got) + (disagreement(got, want).length ? ' — DISAGREES' : ''), entry.why];
    });
  }

  function paintCases(view) {
    fill('alu-cases', caseRows(view));
    root.Helpers.setText('alu-cases-caption', 'Five cases chosen because they are where signed '
      + 'and unsigned part company, each run through the gates at ' + view.width + ' bits and '
      + 'each checked against the reference. The borrow row is the one that surprises people: '
      + 'after a subtract, this convention leaves carry CLEAR when a borrow occurred, which is '
      + 'why the same flag is called "borrow" on some architectures and inverted on others.');
  }

  function paintCost(view) {
    const width = view.width;
    const study = view.study;
    const adder = adderStudy(width);

    fill('alu-cost', [
      ['the adder', String(adder.gates), String(adder.depth),
        (100 * adder.gates / study.gates).toFixed(0) + '%',
        'the only structure with a chain in it, and therefore the deadline'],
      ['operand inversion', String(width), '1', (100 * width / study.gates).toFixed(0) + '%',
        'one XOR per bit, which turns the adder into a subtractor'],
      ['logic paths', String(2 * width), '1',
        (100 * 2 * width / study.gates).toFixed(0) + '%',
        'AND and XOR per bit, with no chain: they finish long before the adder'],
      ['result multiplexing', String(2 * width), '2',
        (100 * 2 * width / study.gates).toFixed(0) + '%',
        'two 2:1 muxes per bit, and this is what the operation code costs'],
      ['the flags', String(width + 4), String(Math.ceil(Math.log2(width)) + 1),
        (100 * (width + 4) / study.gates).toFixed(0) + '%',
        'the zero NOR tree is the widest of them and runs after the result']
    ]);
    root.Helpers.setText('alu-cost-caption', costCaption(view));
  }

  function costCaption(view) {
    const study = view.study;
    const adder = adderStudy(view.width);

    return 'The ALU is ' + study.gates + ' gates at depth ' + study.path.delay +
      '; the adder inside it is ' + adder.gates + ' gates at depth ' + adder.depth +
      '. So three more operations and four flags cost ' + (study.gates - adder.gates) +
      ' extra gates and ' + (study.path.delay - adder.depth) + ' extra gate delays — the '
      + 'argument for sharing one expensive structure rather than building four cheap ones.';
  }

  function paintIsa() {
    fill('alu-isa', [
      ['flags as a side effect of every arithmetic instruction',
        'the flags fall out of the adder for free, so not producing them would cost nothing '
          + 'and hiding them would cost an instruction',
        'x86 and ARM condition codes; the reason an out-of-order core renames the flag register'],
      ['a compare instruction that only sets flags',
        'a compare IS a subtract with the result discarded — the same block, one operation code',
        'cmp on x86, subs with the zero register on ARM'],
      ['no subtract-with-carry on some RISC machines',
        'multi-word arithmetic needs the carry in exposed, and exposing it means the flag '
          + 'register is on the critical path of every instruction',
        'RISC-V has no flags at all: comparisons write a general register instead'],
      ['undefined signed overflow in C',
        'the hardware sets a flag the language chose not to check, so the compiler is allowed '
          + 'to assume it never happens and optimise on that',
        'why a loop with a signed induction variable optimises better than an unsigned one'],
      ['a fixed, small set of ALU operations',
        'every operation is another input on the result multiplexer, and that multiplexer is '
          + 'in front of every result bit',
        'why complex operations are separate functional units with their own latency']
    ]);
    root.Helpers.setText('alu-isa-caption', 'Five instruction-set decisions that are really '
      + 'this circuit\'s properties seen from above. None of them are arbitrary, and all of '
      + 'them are visible in the gate counts on this page.');
  }

  function paintChart(app) {
    const host = root.jQuery('#alu-chart')[0];

    if (!host) return;
    if (chart) chart.destroy();
    chart = root.ErrorBandView.bars(host, {
      lazyLib: app.lazyLib, height: 250, yLabel: 'gates',
      values: WIDTHS.reduce(function (out, width) {
        out.push({ label: width + 'b ALU', value: studyFor(width).gates, series: 0 });
        out.push({ label: width + 'b adder alone', value: adderStudy(width).gates, series: 1 });
        return out;
      }, [])
    });
    root.Helpers.setText('alu-chart-note', chartNote());
  }

  function chartNote() {
    const alu = studyFor(16);
    const adder = adderStudy(16);

    return 'Two bars per width: the whole ALU and the ripple adder inside it. The gap is what '
      + 'three extra operations and four flags cost, and it grows linearly rather than '
      + 'changing shape — at 16 bits, ' + alu.gates + ' gates against ' + adder.gates +
      ', at depth ' + alu.path.delay + ' against ' + adder.depth + '. The adder is the part '
      + 'that has to get faster when the word gets wider; everything else is per-bit and flat.';
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
