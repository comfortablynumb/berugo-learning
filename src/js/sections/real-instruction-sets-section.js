/**
 * Section: Real instruction sets compared.
 *
 * One function - sum an array of 32-bit integers - written for RISC-V, ARM64
 * and x86-64, with every instruction's encoded length listed so the totals can
 * be checked a row at a time. The listings are reference assembly checked
 * against the published encoding rules rather than compiler output, and the
 * section says so, because there is no x86 assembler in this project.
 *
 * The measurement is more interesting than the slogans it replaces: all three
 * take ten instructions and a four-instruction loop. ARM64's post-increment
 * load saves one instruction and its condition codes cost one back. x86-64
 * ties on instruction count and is 1.7 times denser, entirely through
 * variable-length encoding.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'real-instruction-sets';
  const Compare = root.Brv32.Compare;
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
      title: 'Diagram — what the two front ends have to do before decoding',
      caption: 'A fixed-width machine knows where every instruction starts before it has '
        + 'looked at any of them, so sixteen decoders can run at once. A variable-width '
        + 'machine has to find the end of each instruction before it knows where the next one '
        + 'begins, which is a serial dependency at the very front of the pipeline — and it is '
        + 'why x86 implementations carry length predictors and micro-operation caches that '
        + 'RISC machines simply do not need.',
      definition: [
        'flowchart TB',
        '    F["16 bytes of instruction stream"] --> A{"fixed or variable width?"}',
        '    A -->|"fixed: every 4 bytes"| B["4 boundaries, known immediately"]',
        '    B --> C["4 decoders in parallel"]',
        '    A -->|"variable: 1 to 15 bytes"| D["length of instruction 1"]',
        '    D --> E["start of instruction 2"]',
        '    E --> G["length of instruction 2"]',
        '    G --> H["... a serial chain"]',
        '    H --> I["length predictors, and a cache of<br/>already-decoded operations"]',
        '    C --> J["the same internal operations"]',
        '    I --> J'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**The listings here are reference assembly, checked against the published encoding '
        + 'rules, not compiler output.** There is no x86 assembler in this project, and '
        + 'pretending there were would be worse than saying so. Every row carries its encoded '
        + 'length, and the x86 rows carry the bytes as well, so any one of them can be checked '
        + 'against the manual on its own.',
      '**All three take the same number of instructions for this function.** Ten, with a '
        + 'four-instruction loop, on RISC-V, ARM64 and x86-64. That is not the result the usual '
        + 'RISC-versus-CISC framing predicts, and it is a good reason to measure a specific '
        + 'thing rather than repeat a general one.',
      '**ARM64 buys one instruction with addressing and gives it back to condition codes.** '
        + 'Its post-increment load folds the pointer advance into the load, which RISC-V pays '
        + 'an addi for. Then its compare and branch are two instructions where RISC-V has one, '
        + 'because there is a flags register in between. The two effects cancel exactly here.',
      '**x86-64 wins on size and nothing else in this measurement: 23 bytes against 40.** The '
        + 'gain is entirely encoding. A two-byte xor to zero a register, a three-byte add that '
        + 'contains a scaled-index memory operand, and a one-byte ret — against ten fixed '
        + 'four-byte words. Density is real, it is 1.7x here, and it costs the decoder.',
      '**Condition codes are the hidden dependency.** A compare writes flags and a branch reads '
        + 'them, so two instructions that look independent are not, and an out-of-order machine '
        + 'must rename the flags register just as it renames the general ones. RISC-V left them '
        + 'out for exactly that reason, and pays an instruction for every compare that is not '
        + 'immediately branched on.',
      '**Register count is an encoding decision as much as a microarchitectural one.** x86-64 '
        + 'has 16 architectural registers because the encoding could not afford more without '
        + 'another prefix; RISC-V and ARM64 have 32 because a fixed 32-bit word had room. The '
        + 'physical register file is much larger in all three, and renaming is what connects '
        + 'the two numbers.',
      '**Variable-length decode is a serial dependency at the front of the pipeline.** The end '
        + 'of an instruction is not known until it has been decoded, so a wide fetch needs '
        + 'length predictors, a micro-operation cache, or both. That is real area and real '
        + 'power spent on a problem a fixed-width machine does not have.',
      '**Every one of these differences shows up in compiler output, which is where to look '
        + 'for them.** Not in the marketing, and not in benchmark totals that mix a hundred '
        + 'variables. Twenty lines of assembly for one function tells you more about an '
        + 'instruction set than any summary of it.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: { title: 'Interactive demo — one function, three instruction sets, counted',
        markup: root.IsaCompareTemplate.render() },
      diagram: diagram(),
      insight: insight()
    };
  }

  function insight() {
    return '**Condition codes are the clearest example in computing of an interface decision '
      + 'that looked free and was not.** A flags register saves an instruction whenever a '
      + 'compare is followed by something other than a branch, and it costs a hidden dependency '
      + 'on every instruction that touches it — which, on x86, is most arithmetic. Two '
      + 'instructions that read as independent share a register nobody wrote down, so an '
      + 'out-of-order machine has to rename the flags exactly as it renames the general '
      + 'registers, a compiler has to model them in its scheduler, and a reordering that would '
      + 'obviously be legal is not. RISC-V looked at that ledger and declined, paying an '
      + 'instruction for every compare that is not immediately branched on. Whether that was '
      + 'the right call is genuinely arguable; what is not arguable is that the cost was '
      + 'invisible in the instruction listing and enormous in the implementation. The '
      + 'transferable idea is to be suspicious of shared implicit state in any interface. A '
      + 'function that sets a global error variable, a request that mutates a session, a test '
      + 'that leaves a fixture behind — each of them makes the common case shorter and makes '
      + 'every question about independence unanswerable from the call site. The flags register '
      + 'is that pattern, etched into silicon, kept for forty years by compatibility.';
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({
      controls: root.IsaCompareTemplate.controls,
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

  function reading() {
    const values = panel.values();
    const id = values['ris-set'];

    return { id: id, view: values['ris-view'], set: Compare.BY_ID[id],
      measured: Compare.measure(id), all: Compare.all(), density: Compare.density() };
  }

  /* --------------------------------------------------------------- render */

  function update(app) {
    const view = reading();

    paintMetrics(view);
    paintListing(view);
    paintTotals(view);
    paintProperties(view);
    paintFlags(view);
    paintDecode(view);
    paintChart(app, view);
  }

  function densityOf(view) {
    return view.density.filter(function (row) { return row.id === view.id; })[0];
  }

  function paintMetrics(view) {
    const measured = view.measured;

    root.MetricGrid.update({
      'ris-instructions': { value: measured.instructions,
        note: 'the same count on all three, which is not the usual claim' },
      'ris-bytes': { value: measured.bytes,
        note: measured.bytes === 40 ? 'ten fixed 4-byte words'
          : 'lengths of ' + measured.widths.join(', ') + ' bytes' },
      'ris-loop': { value: measured.loopInstructions,
        note: 'these run once per array element' },
      'ris-loop-bytes': { value: measured.loopBytes,
        note: 'what the instruction fetcher pays per iteration' },
      'ris-widths': { value: measured.widths.join(', '),
        note: measured.widths.length === 1 ? 'fixed width, so decode needs no length'
          : 'variable, so the next instruction starts where this one ends' },
      'ris-density': { value: densityOf(view).ratio.toFixed(2) + 'x',
        note: 'bytes, against the largest of the three' }
    });
  }

  function paintListing(view) {
    const rows = view.view === 'loop'
      ? view.set.listing.filter(function (row) { return row.loop; })
      : view.set.listing;

    if (view.view === 'evidence') { paintEvidence(view); return; }
    fill('ris-listing', rows.map(function (row, at) {
      return [at + 1, row.text, row.bytes + (row.encoding ? ' (' + row.encoding + ')' : ''),
        row.loop ? 'yes' : 'no', row.about];
    }));
    root.Helpers.setText('ris-listing-caption', listingCaption(view, rows));
  }

  function paintEvidence(view) {
    fill('ris-listing', view.set.evidence.map(function (text, at) {
      return [at + 1, text, '-', '-', 'identifying evidence, not an instruction'];
    }));
    root.Helpers.setText('ris-listing-caption', 'Four things you could point at in an '
      + 'unlabelled listing to identify ' + view.set.name + '. The first one is usually not '
      + 'enough on its own — RISC-V and ARM64 are both fixed at 4 bytes — and the second is '
      + 'the one that separates them: whether a compare and a branch are one instruction or '
      + 'two.');
  }

  function listingCaption(view, rows) {
    const bytes = rows.reduce(function (sum, row) { return sum + row.bytes; }, 0);

    return view.set.name + ': ' + rows.length + ' instructions in ' + bytes + ' bytes'
      + (view.view === 'loop' ? ', which is the part that runs once per array element. '
        : '. ') + 'The last column is where the instruction set shows through — every one of '
      + 'those explanations is a design decision from the earlier sections, met in real code.';
  }

  function paintTotals(view) {
    fill('ris-totals', view.all.map(function (row) {
      const density = view.density.filter(function (d) { return d.id === row.id; })[0];

      return [row.name + (row.id === view.id ? ' <-' : ''), String(row.instructions),
        String(row.bytes), String(row.loopInstructions), String(row.loopBytes),
        density.ratio.toFixed(2) + 'x'];
    }));
    root.Helpers.setText('ris-totals-caption', 'Three instruction sets, one function, and the '
      + 'first two columns are identical everywhere: 10 instructions, 4 of them in the loop. '
      + 'The bytes column is where they differ — 40, 40 and 23 — so the entire measurable '
      + 'advantage of the variable-width machine on this function is code size, at 1.74 times '
      + 'denser. That is a real advantage and a much smaller claim than the argument usually '
      + 'makes.');
  }

  const COLUMN_ORDER = ['riscv', 'arm64', 'x86'];

  function paintProperties(view) {
    fill('ris-properties', Compare.properties().map(function (row) {
      const byId = {};

      row.values.forEach(function (value) { byId[value.id] = value.value; });
      return [row.name].concat(COLUMN_ORDER.map(function (id) { return byId[id]; }))
        .concat([row.why]);
    }));
    root.Helpers.setText('ris-properties-caption', 'Read the condition-codes row against the '
      + 'loop-instruction column above it: both machines with flags spend two instructions '
      + 'ending the loop where RISC-V spends one, and both recover it in the addressing mode — '
      + 'ARM64 with a post-increment load, x86-64 by folding the load into the add. All three '
      + 'loops are four instructions, and no row here is free.');
  }

  function paintFlags(view) {
    fill('ris-flags', [
      ['RISC-V', 'one instruction: bne a0, a3, .loop', '4',
        'nothing — there are no flags', 'an instruction whenever a comparison is reused'],
      ['ARM64', 'two: cmp then b.ne', '4',
        'a comparison can be reused by several branches, and conditional select is cheap',
        'a hidden dependency the renamer must track'],
      ['x86-64', 'two: cmp then jne', '4',
        'the same, plus most arithmetic sets them as a side effect',
        'almost every instruction writes the flags, so almost nothing is independent']
    ]);
    root.Helpers.setText('ris-flags-caption', 'The loop body is four instructions on all three '
      + 'machines, which is the interesting part: ARM64 spends an extra instruction on the '
      + 'compare and saves one on the pointer increment, so it ties with RISC-V exactly. The '
      + 'cost of condition codes is not visible in this count at all — it is visible in the '
      + 'renamer, and that is precisely why it was such an easy decision to get wrong.');
  }

  function paintDecode(view) {
    fill('ris-decode', [
      ['where does the next instruction start', 'here plus 4, always',
        'not known until this one is decoded',
        'x86 front ends carry length predictors and a micro-operation cache'],
      ['how many can be decoded at once', 'as many as you build decoders for',
        'as many as the length chain allows',
        'four to six decoders, and a cache to skip decoding entirely on hot loops'],
      ['what does the decoder cost', 'small enough to duplicate — 103 gates in our machine',
        'large, and it is on the fetch path',
        'a measurable share of the power budget in an x86 core'],
      ['what does the program pay', '4 bytes for every instruction, including trivial ones',
        '1 byte for ret, 2 to zero a register',
        'more instructions per cache line, which is a real advantage for large programs']
    ]);
    root.Helpers.setText('ris-decode-caption', 'The last row is the honest case for '
      + 'variable-length encoding and it is not a small one: instruction cache misses are '
      + 'expensive, and 23 bytes fit in a line where 40 do not. The rows above it are the '
      + 'price, paid in the front end of every implementation for as long as the instruction '
      + 'set exists.');
  }

  function paintChart(app, view) {
    const host = root.jQuery('#ris-chart')[0];

    if (!host) return;
    if (chart) chart.destroy();
    chart = root.ErrorBandView.bars(host, {
      lazyLib: app.lazyLib, height: 250, yLabel: 'count',
      values: view.all.reduce(function (out, row) {
        out.push({ label: row.id + ' · instructions', value: row.instructions, series: 0 });
        out.push({ label: row.id + ' · bytes', value: row.bytes, series: 1 });
        return out;
      }, [])
    });
    root.Helpers.setText('ris-chart-note', 'Two bars per instruction set. The instruction bars '
      + 'are identical — 10 everywhere — and only the byte bars move, from 40 down to 23. If '
      + 'you have ever seen this comparison drawn with the instruction bars differing wildly, '
      + 'it was measuring a different function, a different compiler, or a different set of '
      + 'enabled extensions, and it should have said which.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
