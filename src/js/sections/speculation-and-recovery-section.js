/**
 * Section: Speculation and recovery.
 *
 * Two things are speculated on this machine and they need different recovery
 * mechanisms, which is the part that is usually left out. A branch is a place
 * the machine KNEW it might be wrong, so it took a checkpoint there and
 * recovery is one copy. A load that passed a store whose address was not known
 * yet is a place nobody marked, so recovery is an unwind: one step per
 * squashed instruction, youngest first.
 *
 * The memory half is measured with a fixture pair built for it. The obvious
 * pair - a store and a load to the same or different addresses - measures
 * nothing at all, because both addresses are computed in the first cycle and
 * the load never has to guess. `hiddenAlias` and `hiddenDisjoint` load the
 * STORE's address from memory, so it is genuinely unknown for many cycles, and
 * the control finally does something: 43 cycles against 59.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'speculation-and-recovery';
  const Lab = root.OooLab;
  const Table = root.DataTable;
  const View = root.OooView;
  const PAIRS = ['alias', 'disjoint', 'hiddenAlias', 'hiddenDisjoint'];
  const SIZES = [8, 16, 32, 64, 128];
  let panel = null;
  let chart = null;

  const RECOVERY = [
    { name: 'checkpoint restore', used: 'branches and jumps',
      cost: 'one copy of the alias table and the free list, whatever the window holds',
      restores: 'the register mapping as it was when the branch renamed' },
    { name: 'unwind the buffer', used: 'memory misspeculation, and exceptions',
      cost: 'one step per squashed instruction, youngest first',
      restores: 'the same mapping, reached by undoing each rename in turn' }
  ];

  const KINDS = [
    { guess: 'which way a branch goes', by: 'the direction predictor',
      detected: 'when the branch executes', recovery: 'checkpoint restore',
      measured: 'the mispredict counter, and the squashed instructions after it' },
    { guess: 'where a jump goes', by: 'the branch target buffer',
      detected: 'when the target is computed', recovery: 'checkpoint restore',
      measured: 'redirects that were not predicted branches' },
    { guess: 'that a load does not alias an older store', by: 'the store-set predictor',
      detected: 'when the store resolves its address',
      recovery: 'unwind, because nobody checkpointed here',
      measured: 'the misspeculation counter and the store sets learned' },
    { guess: 'that a fault will not happen', by: 'nothing — it is the default',
      detected: 'when the address is computed or the opcode decoded',
      recovery: 'unwind at commit, then the trap',
      measured: 'the exception fixtures in 36.3' },
    { guess: 'what a value will be', by: 'nobody, on this machine',
      detected: 'when the real value arrives',
      recovery: 'would be an unwind',
      measured: 'not implemented — see the note below' }
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
      title: 'Diagram — the speculative window, and the point it is restored to',
      caption: 'Everything after the branch is speculative: fetched, renamed, executing, '
        + 'possibly finished, and none of it visible. The checkpoint taken when the branch '
        + 'was renamed is what makes recovery a copy rather than an unwind, and the '
        + 'difference between those two is most of the misprediction penalty on a modern '
        + 'machine. Note where the checkpoint is taken: at rename, not at execute — by the '
        + 'time the branch executes, the state it needs to restore is long gone.',
      definition: [
        'flowchart LR',
        '    B["branch: renamed<br/>checkpoint taken here"] --> S1["i+1"]',
        '    S1 --> S2["i+2"] --> S3["i+3, executing"] --> S4["i+4, finished"]',
        '    B -->|"resolves: the guess was wrong"| R{"recover"}',
        '    R -->|"copy the checkpoint back"| T["alias table and free list restored"]',
        '    R -->|"discard"| S1',
        '    R -->|"redirect fetch"| N["the other path"]',
        '    S4 -.->|"finished, and it never happened"| X["result dropped, register freed"]'
      ].join('\n')
    };
  }

  function orientation() {
    return opening().concat(closing());
  }

  function opening() {
    return [
      '**Speculation is doing work you are not yet entitled to do, and being able to pretend '
        + 'you did not.** Every guess on this machine has the same three parts: something '
        + 'makes the guess, something else discovers it was wrong, and a recovery mechanism '
        + 'puts the machine back. The table of guesses below lists all five and the recovery '
        + 'each one needs.',
      '**There are two recovery mechanisms and both are necessary.** A branch is a place the '
        + 'machine knew it might be wrong, so it took a checkpoint of the alias table when the '
        + 'branch was renamed; recovery is one copy, however deep the window. A memory '
        + 'misspeculation happens where nobody took a checkpoint, so recovery is an unwind — '
        + 'one step per squashed instruction, youngest first, undoing each rename by hand.',
      '**That difference is most of the misprediction penalty on a real machine.** A copy '
        + 'takes a cycle; an unwind of forty instructions takes tens of them. It is why the '
        + 'number of checkpoints a design supports is a published microarchitectural '
        + 'parameter, and why exceeding it — too many unresolved branches in flight — makes '
        + 'the next branch stall rather than speculate.',
      '**Memory dependence speculation is the guess this milestone measures directly.** A '
        + 'load cannot know whether it depends on an older store until both addresses are '
        + 'computed. Waiting for every older store is correct and slow; going anyway is fast '
        + 'and occasionally wrong. On `hiddenDisjoint` the difference is 43 cycles against 59 '
        + '— a 1.37x gain for being right.',
      '**Being wrong costs almost nothing, and the reason is the predictor rather than the '
        + 'recovery.** On `hiddenAlias`, where the load aliases every iteration, speculation '
        + 'takes 61 cycles against 60 conservative. It misspeculates exactly twice and then '
        + 'the store-set predictor has learned this load\'s address and makes it wait, which '
        + 'is Chrysos and Emer\'s result: remember the loads that were wrong, and speculate '
        + 'freely on all the others.'
    ];
  }

  function closing() {
    return [
      '**The obvious fixture for this measures nothing, which is worth knowing.** `alias` and '
        + '`disjoint` put a store and a load next to each other with both addresses in '
        + 'registers. The store resolves before the load is even selected, so switching '
        + 'speculation off changes the cycle count by zero. A control that does nothing looks '
        + 'exactly like a control that does nothing important, and the only way to tell them '
        + 'apart is to build the fixture that would have shown a difference.',
      '**Wasted work is the number nobody quotes and everyone pays for.** `factorial` fetches '
        + '323 instructions to retire 124: 61% of everything the front end did was thrown '
        + 'away. Those instructions were decoded, renamed, issued and executed, and every one '
        + 'of those steps drew power. Speculation buys time with energy, which is a real '
        + 'trade rather than a free one.',
      '**A deeper window speculates further, and throws more away.** `arrayMax` at 32 entries '
        + 'takes 52 cycles and squashes 92 instructions; at 64 entries it takes 54 cycles and '
        + 'squashes 140. Slower AND more wasteful, because the extra depth was spent running '
        + 'down a path that turned out to be wrong. That is the honest version of "bigger '
        + 'window, better machine".',
      '**Value prediction is the idea that did not pay off, and it is not implemented here.** '
        + 'Guessing a load\'s result before it arrives works — results are astonishingly '
        + 'repetitive — but the verification has to compare every prediction against every '
        + 'real value, the misprediction rate is high, and the recovery cost is the full '
        + 'unwind. It stayed a research topic, and saying so is better than adding a '
        + 'control that pretends otherwise.'
    ];
  }

  function insight() {
    return '**Speculation is why a mispredicted branch costs energy and not merely time, and '
      + 'that distinction has become a design constraint rather than a footnote.** When a '
      + 'branch goes the wrong way on the machine in this demo, everything fetched after it '
      + 'is decoded, renamed, given a physical register, issued to a port and executed before '
      + 'anybody discovers the mistake — and then discarded. On `factorial` that is 61% of '
      + 'all fetched instructions; on `arrayMax` it is 68%. The time is recovered by the '
      + 'speculation being right most of the time. The energy is not recovered at all: it was '
      + 'spent, and the only thing the correct answer buys is that some of it was useful. '
      + 'That is why the efficiency cores in a modern phone or laptop are not simply smaller '
      + 'copies of the performance cores — they speculate less, with shallower windows and '
      + 'simpler predictors, because on a battery the wasted work is a line item. It is also '
      + 'why "the machine got wider and the benchmark got faster" and "the machine got wider '
      + 'and the battery got worse" are both true statements about the same change. Whenever '
      + 'you meet an optimisation that works by doing extra work speculatively — prefetching, '
      + 'eager evaluation, warming a cache, retrying an RPC before the first attempt has '
      + 'failed — the same question applies, and it is not "is it faster" but "what is the '
      + 'hit rate, and who pays for the misses".';
  }

  function config() {
    return { sectionId: SECTION_ID, orientation: orientation(),
      demo: { title: 'Interactive demo — guessing, being wrong, and recovering',
        markup: root.SpeculationTemplate.render() },
      diagram: diagram(), insight: insight() };
  }

  /* ------------------------------------------------------------- plumbing */

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({ controls: root.SpeculationTemplate.controls(),
      onChange: function () { update(app); } });
    update(app);
  }

  function reading() {
    const values = panel.values();
    const options = { width: 4, predictor: values['spk-predictor'],
      memorySpeculation: Boolean(values['spk-memory']),
      capacity: Number(values['spk-window']) };

    return { name: values['spk-program'], options: options,
      run: Lab.run(values['spk-program'], options),
      found: Lab.summary(values['spk-program'], options) };
  }

  function update(app) {
    const view = reading();

    paintMetrics(view);
    paintRecovery(view);
    paintWindow(view);
    paintMemory();
    paintWasted();
    paintWindowSweep(view);
    paintKinds();
    paintChart(app);
  }

  function paintMetrics(view) {
    const found = view.found;
    const wasted = found.fetched ? found.squashed / found.fetched : 0;

    root.MetricGrid.update({
      'spk-cycles': { value: found.cycles, note: found.retired + ' instructions retired' },
      'spk-ipc': { value: found.ipc.toFixed(3),
        note: 'against a dependence bound of ' +
          Lab.ilp(view.name, { unitLatency: true }).ilp.toFixed(2) },
      'spk-wasted': { value: (100 * wasted).toFixed(1) + '%',
        note: found.squashed + ' squashed of ' + found.fetched + ' fetched' },
      'spk-recoveries': { value: found.fastRecoveries + found.memoryMisspeculations,
        note: found.fastRecoveries + ' by checkpoint, ' + found.memoryMisspeculations +
          ' by unwind' },
      'spk-unwound': { value: found.unwound,
        note: 'buffer entries walked back one at a time' },
      'spk-storesets': { value: found.lsq.storeSets,
        note: found.lsq.storeSets ? 'these loads will wait for stores from now on'
          : 'no load has aliased yet, so every load speculates' }
    });
  }

  function paintRecovery(view) {
    const found = view.found;

    Table.paint('spk-recovery', RECOVERY.map(function (row) {
      return [row.name, row.used, row.cost, row.restores];
    }), 'This run recovered ' + found.fastRecoveries + ' times by checkpoint and '
      + found.memoryMisspeculations + ' times by unwinding, walking back ' + found.unwound
      + ' buffer entries in the process. Both mechanisms have to exist: a checkpoint is only '
      + 'available where somebody thought to take one, and the machine takes them at branches '
      + 'because that is where it knows it is guessing. A load that turns out to alias is a '
      + 'surprise, and surprises are expensive.');
  }

  function paintWindow(view) {
    root.jQuery('#spk-timeline').html(View.markup(view.run.core, { cycles: 30 }));
    root.jQuery('#spk-legend').html(View.legend());
    root.Helpers.setText('spk-timeline-note', 'The block of S cells is one recovery. Every '
      + 'instruction in it was fetched, decoded, renamed and — look at the cells before the S '
      + '— several of them executed and finished. All of that work is discarded in a single '
      + 'cycle, and nothing it computed was ever visible. The time is recovered by the '
      + 'predictor being right most of the time; the energy is not recovered at all.');
  }

  function paintMemory() {
    Table.paint('spk-memory-table', PAIRS.map(function (name) {
      const on = Lab.summary(name, { width: 4, memorySpeculation: true });
      const off = Lab.summary(name, { width: 4, memorySpeculation: false });

      return [name, off.cycles, on.cycles, (off.cycles / on.cycles).toFixed(2) + 'x',
        off.lsq.waited, on.lsq.misspeculations, on.lsq.storeSets];
    }), 'The first two rows are the fixture that does not work and it is left in on purpose. '
      + '`alias` and `disjoint` compute both addresses in the first cycle, so the store has '
      + 'always resolved before the load is selected and the control changes nothing — a '
      + 'demo built on them would have shown a switch with no effect and been believed. The '
      + 'last two load the store\'s address from memory: speculation is worth 1.37x when it '
      + 'is right, and costs about one cycle when it is wrong, because the store-set '
      + 'predictor learns after two misspeculations and stops guessing on that load.');
  }

  function paintWasted() {
    Table.paint('spk-wasted-table', Lab.names().map(function (name) {
      const found = Lab.summary(name, { width: 4 });

      return [name, found.retired, found.fetched, found.squashed,
        (100 * found.squashed / Math.max(1, found.fetched)).toFixed(1) + '%',
        found.redirects];
    }), 'The wasted column is the energy bill. `arrayMax` fetches 136 instructions to retire '
      + '42, so 68% of the front end\'s work went in the bin — decoded, renamed, issued and '
      + 'in many cases executed. On a plugged-in machine that is invisible; on a phone it is '
      + 'the reason the efficiency cores speculate less. Note that the fixtures with no '
      + 'branches waste almost nothing: the wrong path is always a branch\'s fault.');
  }

  function paintWindowSweep(view) {
    const base = Lab.summary(view.name, { width: 4, capacity: 32, physical: 192,
      queueSize: 128 });

    Table.paint('spk-window-table', SIZES.map(function (size) {
      const found = Lab.summary(view.name, { width: 4, capacity: size, physical: 192,
        queueSize: 128 });

      return [size, found.cycles, found.squashed,
        found.cycles === base.cycles ? 'the same'
          : (found.cycles / base.cycles).toFixed(2) + 'x',
        (100 * found.squashed / Math.max(1, found.fetched)).toFixed(1) + '%'];
    }), 'A deeper window runs further past an unresolved branch, which is exactly as useful '
      + 'and as dangerous as it sounds. On `arrayMax` the machine is slightly SLOWER at 64 '
      + 'entries than at 32 — 54 cycles against 52 — and squashes 140 instructions instead of '
      + '92. The extra depth was spent on a path that turned out to be wrong, and it had to '
      + 'be paid for twice: once in energy, once in the recovery.');
  }

  function paintKinds() {
    Table.paint('spk-kinds', KINDS.map(function (row) {
      return [row.guess, row.by, row.detected, row.recovery, row.measured];
    }), 'Five guesses, four of them implemented and measured on this page. The last row is '
      + 'value prediction, and it is listed as not implemented rather than sketched: it works '
      + 'in the sense that results really are repetitive, and it did not ship, because the '
      + 'verification compares every prediction against every real value and the recovery is '
      + 'a full unwind. A control that pretended to do it would be a worse lesson than the '
      + 'sentence saying it does not.');
  }

  function paintChart(app) {
    const host = root.jQuery('#spk-chart')[0];

    if (!host) return;
    if (chart) chart.destroy();
    chart = root.ErrorBandView.bars(host, { lazyLib: app.lazyLib, height: 260,
      yLabel: 'instructions',
      values: Lab.names().reduce(function (out, name) {
        const found = Lab.summary(name, { width: 4 });
        const label = Lab.shortName(name);

        out.push({ label: label + ' ret', value: found.retired, series: 0 });
        out.push({ label: label + ' sq', value: found.squashed, series: 1 });
        return out;
      }, []) });
    root.Helpers.setText('spk-chart-note', 'Two bars per program — retired, then '
      + 'squashed: instructions that became '
      + 'architectural state, and instructions that did not. On two of the twelve — '
      + '`factorial` and `arrayMax` — the second bar is the taller one. That picture is the '
      + 'cost of speculation stated in the unit it '
      + 'is actually paid in — work done — rather than in the unit it is usually reported in, '
      + 'which is the cycles it saved.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
