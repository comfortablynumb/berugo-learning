/**
 * Section: Free lists, pools and arenas.
 *
 * Three allocation strategies against the same churn, with the heap drawn
 * afterwards. Fragmentation stops being an abstraction the first time you see
 * a heap that is 40% free and cannot satisfy a 256-byte request.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'pools-and-arenas';
  const HEAP_BYTES = 65536;
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render({
      sectionId: SECTION_ID,
      orientation: [
        'Allocation is part of a data structure\'s cost, and the strategy is a design choice. A bump ' +
          'allocator is one addition per allocation and cannot free individual objects. A free list ' +
          'over fixed-size slots is O(1) both ways because the list is threaded through the free ' +
          'blocks themselves. First fit handles any size and pays with fragmentation.',
        'Fragmentation is the failure this section exists to make visible: the heap has plenty of ' +
          'free bytes, they are simply not next to each other, and a request that would obviously fit ' +
          'in the total fails against every individual hole.',
        'Pooling is not free either. It trades fragmentation and lifetime bugs — use after return, ' +
          'stale state in a reused object — for allocation speed, and that is only a good trade when ' +
          'you measured the allocation cost first.'
      ],
      demo: { title: 'Interactive demo — churn the heap', markup: root.PoolsAndArenasTemplate.render() },
      diagram: {
        title: 'Diagram — a free list threaded through free blocks',
        caption: 'The free list costs no extra memory: the pointers live in the blocks it links.',
        definition: [
          'flowchart LR',
          '    H["head"] --> F1["free block 3<br/>next = 7"]',
          '    F1 --> F2["free block 7<br/>next = 12"]',
          '    F2 --> F3["free block 12<br/>next = −1"]',
          '    A1["allocated block 4"]:::used',
          '    A2["allocated block 5"]:::used',
          '    classDef used fill:#94a3b8,color:#0f172a'
        ].join('\n')
      },
      insight: '"Rebuild it periodically" and "reset the arena" are legitimate memory-management ' +
        'strategies, and usually the right ones when the work is phase-structured: a request, a ' +
        'frame, a compilation pass. Freeing one object at a time is the expensive habit.'
    }));

    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.PoolsAndArenasTemplate.controls,
      onChange: function (id) { if (id === 'alloc-run' || id === 'alloc-kind') update(); }
    });

    update();
  }

  function makeAllocator(kind) {
    if (kind === 'bump') return { kind: kind, allocator: root.BasicAllocators.createBumpAllocator({ bytes: HEAP_BYTES }) };
    if (kind === 'freeList') return { kind: kind, allocator: root.BasicAllocators.createFreeList({ slots: 512, slotBytes: 128 }) };
    return { kind: kind, allocator: root.BasicAllocators.createFirstFit({ bytes: HEAP_BYTES }) };
  }

  function update() {
    const values = panel.values();
    const made = makeAllocator(values['alloc-kind']);
    const allocator = made.allocator;

    // The bump allocator has no per-object free, so churn frees nothing there.
    const result = root.BasicAllocators.churn({
      allocator: {
        allocate: allocator.allocate,
        free: allocator.free || function () { return false; },
        stats: allocator.stats
      },
      rng: root.Random.seeded(7),
      rounds: values['alloc-rounds'],
      freeBias: made.kind === 'bump' ? 0 : values['alloc-free'],
      sizes: [16, 32, 64, 128]
    });

    const fragmentation = allocator.fragmentation ? allocator.fragmentation() : null;

    root.MetricGrid.update({
      'alloc-live': {
        value: root.Format.exact(result.live),
        note: made.kind === 'bump' ? 'a bump allocator cannot free individually' : 'still held after the churn'
      },
      'alloc-failed': {
        value: root.Format.exact(result.failures),
        note: result.failures ? 'the heap could not serve these requests' : 'every request was served'
      },
      'alloc-frag': {
        value: fragmentation ? root.Format.percent(fragmentation.ratio, 1) : 'n/a',
        note: fragmentation
          ? root.Format.bytes(fragmentation.freeBytes) + ' free across ' + fragmentation.blocks + ' blocks'
          : 'fixed-size slots cannot fragment externally'
      },
      'alloc-largest': {
        value: fragmentation ? root.Format.bytes(fragmentation.largestFree) : 'n/a',
        note: fragmentation && fragmentation.largestFree < fragmentation.freeBytes
          ? 'less than the free total: that gap is the fragmentation'
          : 'the free space is contiguous'
      }
    });

    paintMap(made.kind, allocator);
  }

  function paintMap(kind, allocator) {
    if (kind === 'freeList') {
      const map = allocator.map();
      const cells = map.slice(0, 256).map(function (live) {
        return '<span style="display:inline-block;width:8px;height:14px;margin:1px;border-radius:2px;' +
          'background:' + (live ? 'var(--hue-blue)' : 'var(--surface-sunken)') +
          ';border:1px solid var(--border-color)"></span>';
      }).join('');
      root.jQuery('#alloc-map').html(cells + '<p class="note">first 256 slots of the pool</p>');
      return;
    }

    if (kind === 'bump') {
      const stats = allocator.stats();
      const used = Math.round((stats.used / stats.size) * 100);
      root.jQuery('#alloc-map').html(
        '<div style="height:20px;background:var(--surface-sunken);border-radius:4px;overflow:hidden">' +
        '<div style="height:100%;width:' + used + '%;background:var(--hue-blue)"></div></div>' +
        '<p class="note">' + root.Format.bytes(stats.used) + ' used of ' + root.Format.bytes(stats.size) +
        ' — one pointer, no holes, and no way to free a single object</p>');
      return;
    }

    const blocks = allocator.blocks();
    const total = blocks.reduce(function (sum, block) { return sum + block.bytes; }, 0);
    const bars = blocks.slice(0, 400).map(function (block) {
      const width = Math.max(1, Math.round((block.bytes / total) * 600));
      return '<span title="' + block.bytes + ' B ' + (block.free ? 'free' : 'allocated') + '" ' +
        'style="display:inline-block;width:' + width + 'px;height:18px;' +
        'background:' + (block.free ? 'var(--surface-sunken)' : 'var(--hue-blue)') +
        ';border-right:1px solid var(--border-color)"></span>';
    }).join('');

    root.jQuery('#alloc-map').html('<div style="line-height:0">' + bars + '</div>' +
      '<p class="note">' + blocks.length + ' blocks after the churn</p>');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
