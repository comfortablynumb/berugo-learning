/**
 * Section: Virtual memory and the TLB.
 *
 * Reach is the number this page exists to make memorable: entries times page
 * size. A 64-entry buffer over 4 KiB pages describes 256 KiB, which is smaller
 * than the L2 cache sitting behind it - so a program whose data fits
 * comfortably in cache can still spend most of its time finding out where that
 * data is, and no cache miss rate will say so.
 *
 * The demo shows the cliff exactly where the arithmetic puts it: 99.5% hit
 * rate at 256 KiB and 49.7% at 512 KiB. Turning on huge pages moves the reach
 * from 256 KiB to 128 MiB and the cost per access from 106 cycles to 1, which
 * is a large enough effect to explain why the option exists and specific
 * enough to explain why it fixes nothing else.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'virtual-memory-and-the-tlb';
  const Table = root.DataTable;
  const Tlb = root.Memory.Tlb;
  const Microbench = root.CacheMicrobench;
  const SIZES = [64, 128, 256, 512, 1024, 2048, 4096];
  const cache = {};
  let panel = null;
  let chart = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  /* ------------------------------------------------------------- the frame */

  function diagram() {
    return {
      title: 'Diagram — four levels of page table, and the shortcut past them',
      caption: 'Each level is a memory access whose address depends on the one before, so a '
        + 'walk is a four-deep pointer chase with nothing to overlap - the pattern 36.6 showed '
        + 'is the worst possible one. The buffer on the left turns all of that into a single '
        + 'lookup, and it is the only reason paging is affordable. When the working set '
        + 'outgrows what the buffer can describe, the whole chase reappears on nearly every '
        + 'access.',
      definition: [
        'flowchart LR',
        '    V["virtual address"] --> T{"in the TLB?"}',
        '    T -->|"hit"| P["physical address, 1 cycle"]',
        '    T -->|"miss"| L1["level 1 table: one memory access"]',
        '    L1 --> L2["level 2: another, at an address level 1 returned"]',
        '    L2 --> L3["level 3: another"]',
        '    L3 --> L4["level 4: the frame number"]',
        '    L4 --> F["fill the TLB, then the physical address"]',
        '    L4 -->|"nothing mapped"| X["page fault: the operating system decides"]'
      ].join('\n')
    };
  }

  function orientation() {
    return opening().concat(closing());
  }

  function opening() {
    return [
      '**Every access on a machine with virtual memory is two accesses: where is it, and what '
        + 'is there.** The page table answers the first, and on a 64-bit machine it takes four '
        + 'levels — four memory accesses, each at an address the previous one returned. That is '
        + 'a pointer chase, with everything 36.6 said about pointer chases, and it is why the '
        + 'buffer exists.',
      '**Reach is entries times page size, and it is the number to carry.** Sixty-four entries '
        + 'over 4 KiB pages describes 256 KiB — smaller than the L2 cache behind it. So a '
        + 'workload can fit entirely in cache and still be translation-bound, and a profile '
        + 'that only looks at cache misses will show nothing wrong at all.',
      '**The cliff is exactly where the arithmetic puts it.** The demo walks working sets from '
        + '64 KiB upwards: 99.5% hit rate at 256 KiB, 49.7% at 512 KiB, 12.5% at 2 MiB, and the '
        + 'cost per access goes from 1.6 cycles to 106. Nobody told the measurement where the '
        + 'reach was; it is the size at which the curve breaks.',
      '**Huge pages fix that specific problem completely and nothing else.** Two-megabyte '
        + 'pages take the reach from 256 KiB to 128 MiB, and the same 2 MiB working set goes '
        + 'from a 12.5% hit rate at 106 cycles per access to 100% at 1. What they cost is '
        + 'internal fragmentation, a slower page fault when one does occur, and a memory '
        + 'allocator that has to find contiguous physical memory.',
      '**The address-space identifier is what makes a context switch cheap.** Without one, '
        + 'switching has to flush the whole buffer, so the cost of the switch is paid in walks '
        + 'for thousands of accesses afterwards. With one, two address spaces coexist — and the '
        + 'property that matters more than the performance is that neither can see the other\'s '
        + 'translations, which the demo asserts rather than describes.'
    ];
  }

  function closing() {
    return [
      '**Level count is a control because it is a design decision.** Fewer levels means a '
        + 'cheaper walk and a larger table; more levels means a sparse address space costs '
        + 'almost nothing to describe and every miss costs more. Five levels exist on machines '
        + 'that needed the address space, and the walk got 25% more expensive for everyone.',
      '**A virtually indexed, physically tagged cache is how the lookup and the translation '
        + 'overlap.** The index bits come from the page offset, which translation does not '
        + 'change, so the set lookup can start before the frame number arrives. The constraint '
        + 'is that sets times line size must not exceed the page size — which is exactly why L1 '
        + 'data caches sat at 32 KiB for a decade.',
      '**Page-table walk caches are the cache for the cache.** The upper levels of the table '
        + 'are shared by enormous ranges of address space, so caching them turns a four-access '
        + 'walk into a one- or two-access walk most of the time. Not modelled here, and worth '
        + 'knowing exists before you conclude a walk always costs four accesses.',
      '**Shootdown is the part that belongs to M43 and M47.** Changing a mapping means every '
        + 'other core with a stale copy has to be told, which is an interrupt and a '
        + 'synchronous wait — and it is why unmapping memory is far more expensive than '
        + 'mapping it, in a way that surprises people writing allocators.'
    ];
  }

  function insight() {
    return '**A workload can be memory-bound in a way that has nothing to do with the data and '
      + 'everything to do with finding it, and almost nobody looks for that.** The instinct '
      + 'when a program is slow on memory is to check the cache miss rate, and on a large '
      + 'sparse working set the cache miss rate can look entirely reasonable while the machine '
      + 'spends most of its cycles walking page tables. The reason is the arithmetic on this '
      + 'page: a translation buffer describes entries-times-page-size of memory, and that '
      + 'product is usually a fraction of the last-level cache. A hash table with a hundred '
      + 'megabytes of buckets touched randomly will hit in cache reasonably often and miss in '
      + 'the TLB almost every time, and the two failure modes are indistinguishable from a '
      + 'stopwatch. The practical consequence is that "try huge pages" is a real diagnostic '
      + 'move rather than a folk remedy — it is a single, targeted change to one quantity, and '
      + 'if it helps a lot then the problem was translation, which tells you something no '
      + 'other experiment does. It is also the reason database and JVM people reach for them '
      + 'so readily and general application developers so rarely: the workloads that are TLB-'
      + 'bound are exactly the ones with large sparse in-memory structures, and that is what a '
      + 'buffer pool or a heap is.';
  }

  function config() {
    return { sectionId: SECTION_ID, orientation: orientation(),
      demo: { title: 'Interactive demo — the reach, and the cliff on the other side of it',
        markup: root.TlbTemplate.render() },
      diagram: diagram(), insight: insight() };
  }

  /* ------------------------------------------------------------- plumbing */

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({ controls: root.TlbTemplate.controls,
      onChange: function () { update(app); } });
    update(app);
  }

  function measure(bytes, settings) {
    const key = bytes + ' ' + JSON.stringify(settings);

    if (cache[key]) return cache[key];
    const built = Tlb.create(settings);

    cache[key] = Tlb.replay(built,
      Microbench.pointerChase({ bytes: bytes, passes: 3, seed: 2 }).trace);
    return cache[key];
  }

  function reading() {
    const values = panel.values();
    const settings = { entries: Number(values['tlb-entries']),
      hugePages: Boolean(values['tlb-huge']), levels: Number(values['tlb-levels']) };
    const bytes = Number(values['tlb-working']) * 1024;

    return { settings: settings, bytes: bytes, found: measure(bytes, settings) };
  }

  function update(app) {
    const view = reading();

    paintMetrics(view);
    paintWalk(view);
    paintReach(view);
    paintHuge(view);
    paintAsid();
    paintSwitch(view);
    paintChart(app, view);
  }

  function reachOf(settings) {
    return settings.entries * (settings.hugePages ? Tlb.HUGE_BYTES : Tlb.PAGE_BYTES);
  }

  function bytes(value) {
    if (value >= 1048576) return (value / 1048576) + ' MiB';
    return (value / 1024) + ' KiB';
  }

  function paintMetrics(view) {
    const reach = reachOf(view.settings);
    const found = view.found.summary;
    const bound = found.hitRate < 0.9;

    root.MetricGrid.update({
      'tlb-reach': { value: bytes(reach),
        note: view.settings.entries + ' entries x ' + bytes(found.pageBytes) + ' pages' },
      'tlb-fits': { value: (view.bytes / reach).toFixed(2) + 'x',
        note: view.bytes <= reach ? 'the working set fits inside the reach'
          : 'the working set is larger than the buffer can describe' },
      'tlb-hitrate': { value: (100 * found.hitRate).toFixed(1) + '%',
        note: found.hits + ' of ' + found.accesses + ' translations' },
      'tlb-walks': { value: found.walks,
        note: found.walkAccesses + ' dependent memory accesses in total' },
      'tlb-cost': { value: view.found.perAccess.toFixed(1),
        note: 'translation alone, before the data access it precedes' },
      'tlb-verdict': { value: bound ? 'yes' : 'no',
        note: bound ? 'most accesses are paying for a walk'
          : 'the buffer is describing the whole working set' }
    });
  }

  function paintWalk(view) {
    const levels = view.settings.levels;
    const rows = [['TLB lookup', 'the buffer, by virtual page number', '1 cycle on a hit']];

    for (let at = 1; at <= levels; at += 1) {
      rows.push(['level ' + at,
        at === 1 ? 'the root table, at a fixed physical address'
          : 'a table whose address level ' + (at - 1) + ' returned',
        '30 cycles, and it cannot start until the level above finishes']);
    }
    rows.push(['fill and retry', 'the frame number goes into the buffer',
      'free, and it is why the next access to this page is a hit']);
    Table.paint('tlb-walk', rows, 'The levels are DEPENDENT: each address comes from the '
      + 'previous read, so nothing overlaps and the walk costs ' + levels
      + ' full round trips. That is the same shape as the pointer chase in 36.6 and it is why '
      + 'a translation miss costs far more than the "one extra access" people expect.');
  }

  function paintReach(view) {
    const reach = reachOf(view.settings);

    Table.paint('tlb-reach-table', SIZES.map(function (kb) {
      const found = measure(kb * 1024, view.settings);

      return [kb + ' KiB', (kb * 1024 / reach).toFixed(2) + 'x',
        (100 * found.summary.hitRate).toFixed(1) + '%', found.summary.walks,
        found.perAccess.toFixed(1)];
    }), 'The second column is the only one that predicts the third. Below 1.00x the hit rate '
      + 'is near perfect; above it the curve falls away, and the cost per access rises by a '
      + 'factor of sixty. Nobody told the measurement where ' + bytes(reach) + ' was - it is '
      + 'the size at which the buffer stops being able to describe the working set, and it is '
      + 'entries times page size and nothing else.');
  }

  function paintHuge(view) {
    Table.paint('tlb-huge-table', [false, true].map(function (huge) {
      const settings = Object.assign({}, view.settings, { hugePages: huge });
      const found = measure(view.bytes, settings);

      return [huge ? '2 MiB' : '4 KiB', bytes(reachOf(settings)),
        (100 * found.summary.hitRate).toFixed(1) + '%', found.perAccess.toFixed(1),
        huge ? 'internal fragmentation, a slower fault, and contiguous physical memory to find'
          : 'nothing: this is the default'];
    }), 'The same working set, the same buffer, and a page size five hundred times larger. '
      + 'That is the whole mechanism - huge pages do not make translation faster, they make '
      + 'each entry describe more, so the same sixty-four entries cover a working set that '
      + 'previously needed thousands. It is a complete fix for this problem and it does '
      + 'nothing whatever for a cache miss.');
  }

  function paintAsid() {
    const built = Tlb.create({});
    const rows = [];

    [1, 2].forEach(function (asid) {
      Tlb.switchTo(built, asid);
      const found = Tlb.translate(built, 4096);

      rows.push([asid, 1, found.frame, 'no']);
    });
    Tlb.switchTo(built, 1);
    Table.paint('tlb-asid', rows, 'The same virtual page in two address spaces, resolving to '
      + 'different frames, with both entries resident at once. The identifier is part of the '
      + 'key, so one space simply cannot match the other\'s entry - which is a correctness '
      + 'property before it is a performance one. A buffer that returned the wrong space\'s '
      + 'frame would be a memory-protection hole rather than a slow machine.');
  }

  function paintSwitch(view) {
    const rows = [true, false].map(function (asids) {
      const built = Tlb.create(view.settings);

      Tlb.switchTo(built, 1);
      for (let page = 0; page < 16; page += 1) Tlb.translate(built, page * 4096);
      const before = built.entries.size;

      Tlb.switchTo(built, 2, { asids: asids });
      const after = built.entries.size;
      const walksBefore = built.counters.walks;

      Tlb.switchTo(built, 1, { asids: asids });
      for (let page = 0; page < 16; page += 1) Tlb.translate(built, page * 4096);
      return [asids ? 'with identifiers' : 'flush on every switch', after,
        built.counters.walks - walksBefore,
        asids ? 'a few bits per entry and a register to hold the current space'
          : 'every translation after the switch is a full walk'];
    });

    Table.paint('tlb-switch', rows, 'Sixteen pages touched, a switch away and a switch back. '
      + 'With identifiers the entries are still there and the second pass costs nothing; '
      + 'without them the buffer is empty and all sixteen have to be walked again. On a machine '
      + 'switching a thousand times a second that difference is a real fraction of the '
      + 'context-switch cost, and it is why address-space identifiers exist.');
  }

  function paintChart(app, view) {
    const host = root.jQuery('#tlb-chart')[0];

    if (!host) return;
    if (chart) chart.destroy();
    chart = root.GrowthPlot.render(host, { lazyLib: app.lazyLib, height: 250, logX: true,
      xLabel: 'working set (bytes)', yLabel: 'translation cycles per access',
      series: [false, true].map(function (huge) {
        const settings = Object.assign({}, view.settings, { hugePages: huge });

        return { label: huge ? '2 MiB pages' : '4 KiB pages',
          points: SIZES.map(function (kb) {
            return { x: kb * 1024, y: measure(kb * 1024, settings).perAccess };
          }) };
      }),
      markers: [{ x: reachOf(Object.assign({}, view.settings, { hugePages: false })),
        label: 'reach', anchor: 'start' }] });
    root.Helpers.setText('tlb-chart-note', 'Two curves and one marker. The 4 KiB curve is flat '
      + 'until the working set passes the reach and then climbs to sixty times its floor; the '
      + '2 MiB curve never leaves the floor at these sizes, because its reach is five hundred '
      + 'times larger. The marker is entries times page size, calculated rather than fitted, '
      + 'and the knee lands on it.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
