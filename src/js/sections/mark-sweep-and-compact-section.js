/**
 * Section: Mark-sweep and mark-compact.
 *
 * Three things are shown rather than asserted.
 *
 * The mark is stepped, with the heap map recoloured at each slice, because
 * tri-colour is a claim about an invariant holding at every intermediate
 * point and a picture of the finished state cannot show an invariant.
 *
 * The mark stack is made to overflow. The recovery is O(heap) per pass, and
 * the sweep of stack limits shows the work rising 2.74x while the reclaimed
 * set stays exactly right — which is the shape of a correct recovery, and is
 * how the defect in the first version of it was caught: it left objects grey
 * forever and swept their children while live.
 *
 * And fragmentation is drawn to scale. The same 23 080 free bytes are one
 * usable run after a compaction and 57 pieces after a sweep, with the largest
 * at 22 per cent of the total. That sentence is unbelievable until the two
 * strips are next to each other.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'mark-sweep-and-compact';
  const LIMITS = [1, 2, 4, 8, 16, 32, 64, 128];
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — the tri-colour states and the transitions between them',
      caption: 'White is not yet reached, grey is reached but not scanned, black is reached '
        + 'and scanned. The mark ends when no grey object is left, and the sweep frees exactly '
        + 'the white ones. The invariant that makes this safe is that no black object ever '
        + 'points at a white one — which holds trivially while nothing else is running, and '
        + 'stops holding the moment the program does, which is 31.5.',
      definition: [
        'graph LR',
        'W["white — not reached"] -->|"a root, or a reference<br/>from a grey object"| G',
        'G["grey — on the mark stack"] -->|"its references have<br/>been followed"| B["black — done"]',
        'W -->|"still white when the<br/>mark ends"| S["swept"]',
        'B -->|"never"| W'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Tracing asks one question: what is reachable from the roots.** The roots are the '
        + 'registers, stack slots and globals a running program holds, and M30 spent a section '
        + 'building the stack maps that say precisely which of them are references. Everything '
        + 'reachable from those is live; everything else is garbage, whatever the program '
        + 'intended.',
      '**Tri-colour is the bookkeeping, and it is three states rather than two for a reason.** '
        + 'White is unreached. Black is reached and fully scanned. Grey is the useful one: '
        + 'reached, but its own references have not been followed yet. The mark is over when no '
        + 'grey remains, and "no grey remains" is a termination condition you can test cheaply.',
      '**The grey set is a stack, and the stack is bounded.** A collector cannot allocate '
        + 'memory to collect memory — that is the situation it is in — so the mark stack has a '
        + 'fixed size, and pushing onto a full one drops the entry and sets a flag rather than '
        + 'failing. Every real collector has this path and it is the one nobody tests.',
      '**Overflow recovery is a heap scan for one shape: a black object with a white child.** '
        + 'That shape can only exist because a push was dropped, so finding it and resuming from '
        + 'there recovers everything, and repeating until a pass finds none terminates. It costs '
        + 'O(heap) per pass, which is what the stack-limit sweep prices.',
      '**Sweep is the easy half and produces a free list, not free memory.** Walk the heap, '
        + 'return every white object. What you have afterwards is the space between the '
        + 'survivors, in as many pieces as there were survivors — which is why a heap that is '
        + 'seventy per cent free can fail a sixty-four-byte allocation.',
      '**Compaction is the answer, and it costs a pass over every pointer in the heap.** Slide '
        + 'the survivors together, record where each one went in a forwarding address, then '
        + 'walk everything again rewriting references to point at the new addresses. Allocation '
        + 'afterwards is a pointer bump. The price is that every reference in the program has to '
        + 'be findable, which is a demand on the compiler.',
      '**Which is exactly what "precise" means, and why conservative collectors cannot move '
        + 'anything.** A conservative scanner treats any word that looks like a pointer as one. '
        + 'That works without compiler support, which is why Boehm-style collectors can be '
        + 'linked into C. It costs you two things: an integer that happens to look like an '
        + 'address keeps a dead object alive indefinitely, and you can never move an object, '
        + 'because updating a word you are not certain is a pointer would corrupt an integer.',
      '**The reclaimed set is checked against a liveness oracle at every collection, not at '
        + 'the end.** A collector that frees a reachable object usually produces a plausible '
        + 'run: the program carries on until it touches the freed object, which may be much '
        + 'later or never. The only way to catch it is to ask, at the moment of collection, '
        + 'what was actually reachable — and that check is what found the overflow-recovery '
        + 'defect this section ships the fix for.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: { title: 'Interactive demo — marking, overflow and the shape of free space',
        markup: root.MarkSweepTemplate.render() },
      diagram: diagram(),
      insight: '**Conservative scanning — treating any word that looks like a pointer as one — '
        + 'is what lets a collector work without stack maps, and it is why Boehm-style '
        + 'collectors retain garbage indefinitely and can never move an object.** Precise '
        + 'scanning needs compiler cooperation, which is exactly what M30 built and what most '
        + 'people never see, because it is invisible in every language that has it. The reason '
        + 'to care is that the choice is not really about the collector at all: it is about '
        + 'whether the runtime can ever compact. A collector that cannot move objects is stuck '
        + 'with a free list, which means it is stuck with fragmentation, which means its worst '
        + 'case is an allocation failure in a heap that is mostly empty — and the demo shows '
        + 'that state directly, 23 080 free bytes whose largest usable piece is 5 160. Every '
        + 'design that gets past that — copying, generational, region-based, all of them — is '
        + 'moving objects, and every one of them is therefore built on a compiler that agreed, '
        + 'instruction by instruction, to say where the references are. That is why this '
        + 'milestone depends on the last one rather than standing alone, and it is why "we will '
        + 'add a proper GC later" is usually false: the metadata has to be produced by every '
        + 'pass of a back end that was written knowing it had to.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({
      controls: root.MarkSweepTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  /** One heap, built with no collector running: what a collection is handed. */
  const heapFor = root.Helpers.memoise(function () {
    const trace = root.HeapSim.synthetic({ count: 900, seed: 5, survival: 0.2, retained: 64 });

    return root.HeapSim.build(trace, undefined, { capacity: 32768 });
  });

  /**
   * The mark, stepped. `GcIncremental` with no mutation between slices IS
   * stop-the-world marking done visibly — the same tri-colour machine, just
   * allowed to stop. Reusing it here rather than writing a second stepping
   * marker is what keeps the two sections talking about one algorithm.
   */
  const markFor = root.Helpers.memoise(function (percent) {
    const heap = root.HeapSim.clone(heapFor('one'));
    const state = root.GcIncremental.create({ barrier: 'none', slice: 4 });
    const total = root.HeapSim.reachable(heap, heap.roots).size;
    const target = Math.round((percent / 100) * total);

    root.GcIncremental.begin(heap, state);
    heap.roots.forEach(function (id) { root.GcIncremental.shade(heap, state, id); });
    while (state.marking && blackCount(heap) < target) root.GcIncremental.step(heap, state, 1);
    return { heap: heap, state: state, total: total,
      black: blackCount(heap), grey: state.grey.length };
  });

  function blackCount(heap) {
    let total = 0;

    heap.cells.forEach(function (cell) { if (cell.colour === 'black') total += 1; });
    return total;
  }

  /**
   * The stack-limit sweep. Each row is an independent collection over a clone
   * of the same heap, so the only thing that varies is the limit — and the
   * `wrong` column is the one that has to read zero at every row, because a
   * recovery that costs more work is a trade and a recovery that loses an
   * object is a bug.
   */
  const stackSweepFor = root.Helpers.memoise(function (compact) {
    return LIMITS.map(function (limit) { return stackRow(limit, compact === 'compact'); });
  });

  function stackRow(limit, compact) {
    const heap = root.HeapSim.clone(heapFor('one'));
    const want = new Set(root.HeapSim.unreachable(heap, heap.roots));
    const state = root.GcMarkSweep.create({ stackLimit: limit, compact: compact });
    const out = root.GcMarkSweep.collect(heap, state, 'sweep');

    return { limit: limit, visited: out.visited, rescans: state.rescans, work: out.work,
      reclaimed: out.reclaimed.length, want: want.size,
      wrong: out.reclaimed.filter(function (id) { return !want.has(id); }).length };
  }

  /** The same collection twice: survivors left where they are, and slid together. */
  const fragFor = root.Helpers.memoise(function () {
    const source = heapFor('one');
    const span = source.next;

    return { span: span, sweep: fragRow(source, span, false),
      compact: fragRow(source, span, true) };
  });

  function fragRow(source, span, compact) {
    const heap = root.HeapSim.clone(source);
    const state = root.GcMarkSweep.create({ compact: compact });

    root.GcMarkSweep.collect(heap, state, 'sweep');
    const runs = root.HeapMapView.runsOf(Array.from(heap.cells.values()), span);
    const free = root.HeapMapView.freeBytes(runs);

    return { heap: heap, runs: runs, live: heap.bytes, free: free,
      largest: root.HeapMapView.largestHole(runs),
      holes: runs.filter(function (run) { return run.free; }).length,
      share: free ? root.HeapMapView.largestHole(runs) / free : 1 };
  }

  function update() {
    const values = panel.values();
    const mark = markFor(values['msw-progress']);
    const sweep = stackSweepFor(values['msw-after']);
    const frag = fragFor('one');
    const chosen = values['msw-after'] === 'compact' ? frag.compact : frag.sweep;

    paintMap(mark);
    paintStrips(frag);
    paintMetrics(mark, sweep, chosen, values['msw-stack']);
    paintColours(mark);
    paintStack(sweep, values['msw-stack']);
    paintFrag(frag);
    paintScan();
  }

  function paintMap(mark) {
    root.jQuery('#msw-map').html(root.HeapMapView.map(mark.heap.cells.values(),
      { scheme: 'mark', highlight: mark.state.grey.slice(0, 24) }));

    root.Helpers.setText('msw-map-caption', mapCaption(mark));
  }

  function mapCaption(mark) {
    const white = mark.heap.cells.size - mark.black - mark.grey;

    return mark.black + ' black, ' + mark.grey + ' grey (ringed), ' + white + ' white. The '
      + 'grey set is the frontier and the mark is over when it is empty. Everything still '
      + 'white then is garbage — and while nothing else is running, that conclusion is safe '
      + 'because no black object can have acquired a white child. The moment the program is '
      + 'allowed to run between two of these steps, it can, and that is the whole of 31.5.';
  }

  function paintStrips(frag) {
    root.jQuery('#msw-strip-sweep').html(root.HeapMapView.fragmentation(frag.sweep.runs, {}));
    root.jQuery('#msw-strip-compact').html(
      root.HeapMapView.fragmentation(frag.compact.runs, {}));

    root.Helpers.setText('msw-strip-caption',
      'After a compaction: the same ' + frag.compact.free + ' free bytes, in one run. Both '
      + 'strips are the same heap after the same collection over the same ' + frag.span
      + '-byte span, and they contain the identical number of free bytes. The upper one cannot '
      + 'satisfy an allocation larger than ' + frag.sweep.largest + ' bytes and the lower one '
      + 'can satisfy anything up to ' + frag.compact.largest + '.');
  }

  function paintMetrics(mark, sweep, chosen, limit) {
    const row = sweep.find(function (entry) { return entry.limit === limit; }) || sweep[0];

    root.MetricGrid.update({
      'msw-marked': { value: mark.black + ' of ' + mark.total,
        note: mark.grey + ' grey still on the stack' },
      'msw-rescans': { value: row.rescans,
        note: row.rescans ? 'the stack overflowed at limit ' + row.limit
          : 'the stack never filled at limit ' + row.limit },
      'msw-largest': { value: chosen.largest,
        note: 'of ' + chosen.free + ' free, in ' + chosen.holes + ' pieces' },
      'msw-verdict': { value: row.reclaimed + ' of ' + row.want,
        note: row.wrong ? row.wrong + ' REACHABLE objects freed — a bug'
          : 'and no reachable object among them' }
    });
  }

  const COLOUR_NOTE = {
    white: 'free it — correct only once the mark has finished',
    grey: 'free an object that is reachable and whose children are unexamined',
    black: 'free an object known to be reachable'
  };

  function paintColours(mark) {
    const counts = { white: 0, grey: 0, black: 0 };

    mark.heap.cells.forEach(function (cell) { counts[cell.colour] += 1; });
    root.jQuery('#msw-colours tbody').html(root.GcMarkSweep.COLOURS.map(function (row) {
      return '<tr><td class="mono">' + row.name + '</td><td>' +
        root.Helpers.escapeHtml(row.means) + '</td><td class="mono">' + counts[row.name] +
        '</td><td>' + COLOUR_NOTE[row.name] + '</td></tr>';
    }).join(''));

    root.Helpers.setText('msw-colours-caption',
      'The last column is why the mark has to finish before the sweep starts. White does not '
      + 'mean garbage; it means "not reached YET", and the two are the same statement only at '
      + 'the moment the grey set empties.');
  }

  function paintStack(sweep, limit) {
    root.jQuery('#msw-stack-table tbody').html(sweep.map(function (row) {
      return '<tr' + (row.limit === limit ? ' class="row-current"' : '') +
        '><td class="mono">' + row.limit + '</td><td class="mono">' + row.visited +
        '</td><td class="mono">' + row.rescans + '</td><td class="mono">' + row.work +
        '</td><td class="mono">' + row.reclaimed + ' of ' + row.want + '</td><td class="mono">' +
        (row.wrong ? row.wrong + ' — BUG' : 'no') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('msw-stack-caption', stackCaption(sweep));
  }

  function stackCaption(sweep) {
    const worst = sweep[0];
    const best = sweep[sweep.length - 1];
    const ratio = best.work ? worst.work / best.work : 1;

    return 'At a limit of ' + worst.limit + ' the main pass reaches only ' + worst.visited +
      ' objects and the recovery does the rest over ' + worst.rescans + ' passes, for '
      + worst.work + ' units of work against ' + best.work + ' — ' + ratio.toFixed(2) + ' times '
      + 'as much. Every row reclaims the same ' + best.want + ' objects and none of them frees '
      + 'a reachable one. That last column is not decoration; it found two separate defects in '
      + 'this recovery. The first shaded the dropped children grey and then handed the grey ids '
      + 'to a marker that only accepts white ones, so they were never scanned, their own '
      + 'children stayed white, and 26 live objects were swept. The second pushed the whole '
      + 'root set at once, so a stack smaller than the root set dropped ROOTS — and a dropped '
      + 'root is unrecoverable, because the recovery looks for a black object with a white '
      + 'child and a root has no parent. Six live objects went at a limit of 2, and the rescan '
      + 'counter reported eleven successful passes while it happened.';
  }

  function paintFrag(frag) {
    const rows = [{ name: 'a sweep', row: frag.sweep }, { name: 'a compaction', row: frag.compact }];

    root.jQuery('#msw-frag tbody').html(rows.map(function (entry) {
      return '<tr><td class="mono">' + entry.name + '</td><td class="mono">' + entry.row.live +
        '</td><td class="mono">' + entry.row.free + '</td><td class="mono">' + entry.row.holes +
        '</td><td class="mono">' + entry.row.largest + '</td><td class="mono">' +
        (entry.row.share * 100).toFixed(1) + '%</td></tr>';
    }).join(''));

    root.Helpers.setText('msw-frag-caption', fragCaption(frag));
  }

  function fragCaption(frag) {
    return 'Identical live bytes, identical free bytes, and a completely different heap. The '
      + 'swept heap holds its ' + frag.sweep.free + ' free bytes in ' + frag.sweep.holes
      + ' pieces of which the largest is ' + frag.sweep.largest + ' — '
      + (frag.sweep.share * 100).toFixed(1) + ' per cent of the total, so an allocation larger '
      + 'than that fails in a heap that is ' +
      ((frag.sweep.free / (frag.sweep.free + frag.sweep.live)) * 100).toFixed(0)
      + ' per cent free. Compaction is what buys the other ' +
      (100 - frag.sweep.share * 100).toFixed(1) + ' per cent back, and it costs a pass over '
      + 'every pointer in the heap to do it.';
  }

  const SCANNERS = [
    { name: 'precise', needs: 'a stack map per safepoint, from the compiler',
      roots: 'exactly the words that are references',
      retains: 'exactly what is reachable', moves: 'yes — every reference is known' },
    { name: 'conservative', needs: 'nothing; it can be linked into C',
      roots: 'every word that could be an address',
      retains: 'that, plus whatever an integer happened to point at',
      moves: 'no — updating a word that is not a pointer corrupts an integer' }
  ];

  function paintScan() {
    root.jQuery('#msw-scan tbody').html(SCANNERS.map(function (row) {
      return '<tr><td class="mono">' + row.name + '</td><td>' + row.needs + '</td><td>' +
        row.roots + '</td><td>' + row.retains + '</td><td class="mono">' + row.moves +
        '</td></tr>';
    }).join(''));

    root.Helpers.setText('msw-scan-caption',
      'The last column is the consequence people miss. Conservatism is usually discussed as a '
      + 'retention problem — a dead object kept alive by an integer that looked like its '
      + 'address — and that is real but bounded. The unbounded consequence is that a '
      + 'conservative collector can never compact, so it is stuck with the upper strip above '
      + 'for the life of the process. Everything M30 did with stack maps was to buy the lower '
      + 'one.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
