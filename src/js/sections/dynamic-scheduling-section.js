/**
 * Section: Dynamic scheduling — scoreboarding and Tomasulo.
 *
 * The idea the milestone turns on, and it is smaller than its reputation: the
 * thirty-two register names an instruction set defines are a convention, and
 * the hardware keeps a much larger physical set underneath with a table saying
 * which physical register each name currently means. Writing a register does
 * not overwrite anything - it allocates a new one and repoints the name.
 *
 * The measurement here is the size of the physical file, because that is the
 * lever the real machine actually has. At 34 registers there are two spare and
 * the machine can rename two deep; at 192 it can rename far enough that the
 * name dependences never bind. The gap between those two runs is what renaming
 * is worth on this program, measured rather than asserted, and the independent
 * ILP bound from 36.1 says what removing renaming entirely would cost.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'dynamic-scheduling';
  const Lab = root.OooLab;
  const Table = root.DataTable;
  const View = root.OooView;
  const Rename = root.Ooo.Rename;
  const SIZES = [34, 40, 48, 64, 96, 192];
  const NAMES = ['zero', 'ra', 'sp', 'gp', 'tp', 't0', 't1', 't2', 's0', 's1', 'a0', 'a1',
    'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9',
    's10', 's11', 't3', 't4', 't5', 't6'];
  let panel = null;
  let chart = null;

  const HAZARDS = [
    { kind: 'raw', on: 'a value', scoreboard: 'stalls the reader until the writer writes back',
      tomasulo: 'the same wait, but the reader is woken by a tag rather than by a scan' },
    { kind: 'war', on: 'a register name',
      scoreboard: 'stalls the writer until the older reader has read',
      tomasulo: 'nothing — the writer gets a different physical register' },
    { kind: 'waw', on: 'a register name',
      scoreboard: 'stalls the second writer until the first has written',
      tomasulo: 'nothing — the two writes are to different physical registers' }
  ];

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  /* ------------------------------------------------------------- the frame */

  function diagram() {
    return {
      title: 'Diagram — a waiting instruction, a tag, and the bus that wakes it',
      caption: 'The instruction does not hold its operands, it holds the NAMES of the '
        + 'physical registers that will produce them. When a result appears on the common '
        + 'data bus it carries its tag, every waiting entry compares, and the ones that match '
        + 'take the value and become ready. That comparison happening in every entry at once '
        + 'is why the wakeup logic gets more expensive as the window grows, and it is one of '
        + 'the two reasons issue width plateaued.',
      definition: [
        'flowchart LR',
        '    subgraph queue["issue queue"]',
        '        E1["add: waiting on p41, p12"]',
        '        E2["sub: waiting on p41"]',
        '        E3["xor: ready"]',
        '    end',
        '    ALU["a functional unit finishes"] -->|"tag p41 + value"| CDB["common data bus"]',
        '    CDB -->|"compare"| E1',
        '    CDB -->|"compare"| E2',
        '    E1 -->|"one operand left"| WAIT["still waiting"]',
        '    E2 -->|"last operand arrived"| READY["ready: eligible for select"]',
        '    E3 --> READY',
        '    READY --> SEL["select: oldest first, up to the issue width"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Renaming is the idea, and it is one table.** The alias table says which physical '
        + 'register each architectural name currently means. An instruction that writes takes '
        + 'a register off the free list, points the name at it, and remembers what the name '
        + 'used to mean so that commit can give it back. Nothing is ever overwritten while '
        + 'anything might still read it.',
      '**That removes two of the three dependence kinds outright.** A write-after-read hazard '
        + 'is two instructions arguing over a name; once they have different physical '
        + 'registers there is nothing to argue about. Write-after-write is the same. Only '
        + 'read-after-write survives, because it is a dependence on a value and no naming '
        + 'trick touches it.',
      '**A scoreboard is the version without renaming, and it stalls on all three.** CDC\'s '
        + '6600 scoreboard tracked which unit was writing which register and stopped anything '
        + 'that would conflict — correct, and it paid for every name collision the compiler '
        + 'left behind. Tomasulo\'s machine, three years later, renamed instead, and the '
        + 'difference is visible on any code that reuses registers, which is all code.',
      '**Wakeup and select are the two halves of every cycle, and both are expensive.** '
        + 'Wakeup broadcasts a finished result\'s tag to every waiting entry, which compares. '
        + 'Select picks, from everything now ready, as many as the ports can take. The '
        + 'comparison logic grows with the window and the select logic grows faster than the '
        + 'width, which is the hardware reason 36.4\'s curve flattens.',
      '**Selection is oldest-first, and that is not arbitrary.** Picking the youngest ready '
        + 'instruction is equally correct and much worse: the oldest one is the most likely to '
        + 'be blocking the head of the reorder buffer, and therefore the machine\'s ability to '
        + 'commit anything at all.',
      '**The size of the physical file is how deeply the machine may rename, and it is a '
        + 'measurable limit.** With 34 physical registers there are two spare and `stride` '
        + 'takes 530 cycles; with 64 it takes 126. The machine is still renaming in both — it '
        + 'simply cannot rename far enough ahead in the first, so dispatch stalls with "no '
        + 'free physical register" and the window never fills.',
      '**Registers come back at commit, and the bookkeeping is where this goes wrong.** A '
        + 'physical register is freed when the instruction that overwrote its name commits, '
        + 'because only then is every possible reader retired. Two leaks lived in this exact '
        + 'code: a restore that discarded registers freed while a branch was in flight, and a '
        + 'release that refused to recycle the thirty-one registers holding the initial '
        + 'mapping. Both had the same symptom — an empty pipeline that cannot dispatch.',
      '**The matched pair says what renaming is worth in one comparison.** `chain` and '
        + '`independent` are the same 32 additions. `chain` writes them as one dependence '
        + 'chain; `independent` writes them over four register names with no true dependence '
        + 'at all. A machine that renames sees an ILP bound of 32.00 on the second; one that '
        + 'does not sees 4.00, because eight writes to `t0` look like eight hazards.',
      '**The same trick appears twice more in this curriculum, which is the point of '
        + 'noticing it.** Static single assignment in M29 gives every assignment its own name '
        + 'so the compiler stops reasoning about reuse; multi-version concurrency control in '
        + 'M53 keeps old row versions so readers and writers stop contending. Three fields, '
        + 'one idea: when contention is over a name rather than a value, make more names.'
    ];
  }

  function insight() {
    return '**Renaming is worth learning as a pattern rather than as a processor feature, '
      + 'because the pattern is what you will meet again.** The shape is: two parties contend '
      + 'for something, and on inspection they are contending over the *identity* of a slot '
      + 'rather than over its contents. The fix is never to arbitrate better — it is to '
      + 'notice that the slot did not have to be shared, and to hand out a fresh one. A '
      + 'processor does it with a physical register file larger than the architectural set. A '
      + 'compiler does it in SSA form, where every assignment creates a new name and the '
      + 'question "does this use refer to that definition" stops being a dataflow problem. A '
      + 'database does it with multi-version concurrency control, where a writer creates a '
      + 'new version instead of overwriting, and readers stop taking locks. A functional '
      + 'language does it by not having mutation in the first place. Every one of those pays '
      + 'the same price — more storage, and bookkeeping to work out when an old version is '
      + 'unreachable — and in every one of them that bookkeeping is where the bugs live. The '
      + 'two register leaks in this simulator, garbage collection in M31, and vacuum in a '
      + 'MVCC database are all the same problem wearing different clothes: reclaiming a name '
      + 'you handed out, at the exact moment nobody can reach it any more.';
  }

  function config() {
    return { sectionId: SECTION_ID, orientation: orientation(),
      demo: { title: 'Interactive demo — the alias table, the free list and the window',
        markup: root.RenameTemplate.render() },
      diagram: diagram(), insight: insight() };
  }

  /* ------------------------------------------------------------- plumbing */

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({ controls: root.RenameTemplate.controls(),
      onChange: function () { update(app); } });
    update(app);
  }

  function reading() {
    const values = panel.values();
    const physical = Number(values['ren-physical']);
    const options = { width: 4, physical: physical };

    return { name: values['ren-program'], physical: physical, options: options,
      cycles: Number(values['ren-cycles']), run: Lab.run(values['ren-program'], options),
      found: Lab.summary(values['ren-program'], options) };
  }

  function update(app) {
    const view = reading();

    paintMetrics(view);
    paintAlias(view);
    paintWindow(view);
    paintHazards(view);
    paintDepth(view);
    paintPair(view);
    paintChart(app, view);
  }

  function paintMetrics(view) {
    const found = view.found;
    const counts = Lab.ilp(view.name, { unitLatency: true }).counts;
    const renamed = Lab.ilp(view.name, { unitLatency: true }).ilp;
    const plain = Lab.ilp(view.name, { unitLatency: true, model: 'unrenamed' }).ilp;

    root.MetricGrid.update({
      'ren-cycles-total': { value: found.cycles,
        note: found.retired + ' instructions retired' },
      'ren-ipc': { value: found.ipc.toFixed(3),
        note: 'at ' + view.physical + ' physical registers' },
      'ren-allocated': { value: found.rename.allocated,
        note: found.rename.freed + ' given back at commit' },
      'ren-stalls': { value: found.rename.stalls,
        note: found.rename.stalls ? 'dispatch waited for a register to come free'
          : 'the file was never the limit at this size' },
      'ren-removed': { value: counts.war + counts.waw,
        note: counts.war + ' write-after-read and ' + counts.waw + ' write-after-write' },
      'ren-worth': { value: (renamed / Math.max(plain, 1e-9)).toFixed(2) + 'x',
        note: 'ILP bound ' + renamed.toFixed(2) + ' renamed against ' + plain.toFixed(2) }
    });
  }

  /** The alias table at the end of the run: every name, and the physical
   *  register it currently means. */
  function paintAlias(view) {
    const state = view.run.core.rename;
    const values = Rename.architectural(state);
    const rows = [];

    for (let at = 1; at < 32; at += 1) {
      if (state.table[at] === at && !values[at]) continue;
      rows.push([NAMES[at] + ' (x' + at + ')', 'p' + state.table[at], values[at],
        state.table[at] === at ? 'never written' : 'yes']);
    }
    Table.paint('ren-alias', rows.slice(0, 14), 'A name is a pointer. `t0` does not hold a '
      + 'value here — it means whichever physical register the last instruction to write it '
      + 'was given, and reading `t0` is a lookup through this table. That indirection is the '
      + 'entire mechanism, and it is why two instructions writing the same name never '
      + 'interfere: they were given different registers before either of them ran.');
  }

  function paintWindow(view) {
    root.jQuery('#ren-window').html(View.markup(view.run.core, { cycles: view.cycles }));
    root.jQuery('#ren-legend').html(View.legend());
    root.Helpers.setText('ren-window-note', 'Read across a row for one instruction. The W '
      + 'run is time in the issue queue waiting for an operand or a port; X is execution; C '
      + 'is finished-but-not-real, waiting for every older instruction to commit first. The '
      + 'C run is the reorder buffer earning its keep, and on a machine that could not do '
      + 'that, every one of those cycles would have been a stall.');
  }

  function paintHazards(view) {
    const counts = Lab.ilp(view.name, { unitLatency: true }).counts;

    Table.paint('ren-hazards', HAZARDS.map(function (row) {
      return [row.kind, counts[row.kind], row.on, row.scoreboard, row.tomasulo];
    }), 'Two of the three rows say "nothing" in the last column, and that is the whole of '
      + 'Tomasulo. On this trace ' + (counts.war + counts.waw) + ' of the '
      + (counts.raw + counts.war + counts.waw) + ' register dependences are about names '
      + 'rather than values — a scoreboard has to respect every one of them, and a machine '
      + 'with a physical register file does not see them at all.');
  }

  function paintDepth(view) {
    const base = Lab.summary(view.name, { width: 4, physical: 64 });

    Table.paint('ren-depth', SIZES.map(function (size) {
      const found = Lab.summary(view.name, { width: 4, physical: size });

      return [size, size - 32, found.cycles, found.ipc.toFixed(3), found.rename.stalls,
        found.cycles === base.cycles ? 'the same'
          : (found.cycles / base.cycles).toFixed(2) + 'x'];
    }), depthCaption(view));
  }

  function depthCaption(view) {
    const small = Lab.summary(view.name, { width: 4, physical: 34 });
    const big = Lab.summary(view.name, { width: 4, physical: 192 });

    return 'Thirty-two of the physical registers always hold the architectural state, so a '
      + 'file of 34 leaves two spare and the machine can only rename two instructions deep. '
      + 'On ' + view.name + ' that costs ' + (small.cycles / big.cycles).toFixed(2) + 'x — '
      + small.cycles + ' cycles against ' + big.cycles + '. Note what this is NOT measuring: '
      + 'the machine renames in every row, it simply cannot rename far ahead. Removing '
      + 'renaming altogether is the ILP-bound comparison above, and it is a larger number.';
  }

  function paintPair(view) {
    const rows = ['chain', 'independent'].map(function (name) {
      const found = Lab.summary(name, { width: 4 });
      const renamed = Lab.ilp(name, { unitLatency: true });
      const plain = Lab.ilp(name, { unitLatency: true, model: 'unrenamed' });

      return [name + ' — ' + Lab.get(name).about, renamed.instructions, found.cycles,
        found.ipc.toFixed(3), renamed.ilp.toFixed(2), plain.ilp.toFixed(2)];
    });

    Table.paint('ren-pair', rows, 'Thirty-two additions either way, and the same arithmetic. '
      + '`independent` is written over four register names, which is deliberate: it looks '
      + 'obviously parallel to a reader, and to a machine without renaming it is eight '
      + 'write-after-write hazards per name and its bound falls from 32.00 to 4.00. That is '
      + 'the fixture that shows what renaming is worth, and it is exactly the code a compiler '
      + 'produces when it runs out of registers.');
  }

  function paintChart(app, view) {
    const host = root.jQuery('#ren-chart')[0];

    if (!host) return;
    if (chart) chart.destroy();
    chart = root.GrowthPlot.render(host, { lazyLib: app.lazyLib, height: 250,
      xLabel: 'physical registers', yLabel: 'cycles',
      series: ['chain', 'independent', 'stride', 'factorial'].map(function (name) {
        return { label: name, points: SIZES.map(function (size) {
          return { x: size, y: Lab.summary(name, { width: 4, physical: size }).cycles };
        }) };
      }), legendHost: null });
    root.Helpers.setText('ren-chart-note', 'Four programs against the size of the physical '
      + 'register file. Every curve falls and then flattens, and where it flattens is where '
      + 'the file stopped being the limit — 40 registers for `independent`, 64 for `stride`. '
      + 'Past that point, more registers buy nothing at all, which is why the number is '
      + 'chosen to match the reorder buffer rather than maximised.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
