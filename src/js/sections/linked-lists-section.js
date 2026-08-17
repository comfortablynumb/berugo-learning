/**
 * Section: Linked lists and pointer chasing.
 *
 * The same values, held two ways, walked the same number of times. The list's
 * asymptotics are identical to the array's and its memory behaviour is not,
 * which the access log shows directly.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'linked-lists';
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
        'A linked list buys O(1) insertion and deletion at a known position, and pays for it with a ' +
          'pointer per element and no guarantee about where the next element sits. Both halves of that ' +
          'trade are visible below.',
        'The classic argument — "insertion is O(1)" — quietly omits the O(n) search that gets you to ' +
          'the position, and the cache miss that each step of that search costs. Nodes allocated over ' +
          'time end up scattered, and the walk turns into a random tour of memory.',
        'Note what the demo does *not* measure: distinct cache lines. One full traversal touches every ' +
          'line holding a node exactly once whatever the placement, so that number is identical for ' +
          'both layouts. Misses against a bounded cache are the number that moves, and only once the ' +
          'list stops fitting in it.',
        'Lists survive in kernels and allocators for a different reason: an intrusive list needs no ' +
          'allocation at all, because the link fields live inside the object being linked.'
      ],
      demo: { title: 'Interactive demo — walk the list, watch the addresses', markup: root.LinkedListsTemplate.render() },
      diagram: {
        title: 'Diagram — the same logical list, two placements',
        caption: 'Logical order is identical; physical order is what the memory system sees.',
        definition: [
          'flowchart LR',
          '    subgraph SEQ["sequential placement"]',
          '        S1["node 0 @0"] --> S2["node 1 @8"] --> S3["node 2 @16"] --> S4["node 3 @24"]',
          '    end',
          '    subgraph SCAT["scattered placement"]',
          '        C1["node 0 @1096"] --> C2["node 1 @24"] --> C3["node 2 @8320"] --> C4["node 3 @512"]',
          '    end'
        ].join('\n')
      },
      insight: 'The asymptotics are identical and the constant is not. An intrusive list — link ' +
        'fields inside the object — is what kernels use, because it removes the allocation, not ' +
        'because the walk is fast.'
    }));

    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.LinkedListsTemplate.controls,
      onChange: function () { update(); }
    });

    update();
  }

  function update() {
    const values = panel.values();
    const nodes = values['list-nodes'];
    const list = root.LinearStructures.createLinkedList({
      slots: nodes,
      order: values['list-order'],
      rng: root.Random.seeded(31),
      bytes: Math.max(1 << 20, nodes * 16)
    });

    for (let i = 0; i < nodes; i += 1) list.push(i);
    const walk = list.traverse();
    const arrayWalk = measureArray(nodes);

    root.MetricGrid.update({
      'list-lines': {
        value: root.Format.exact(walk.cacheMisses),
        note: root.Format.bytes(walk.bytesFetched) + ' fetched to read ' +
          root.Format.bytes(walk.bytesRead) + ' over ' + root.Format.exact(walk.steps) + ' steps'
      },
      'list-jumps': {
        value: root.Format.percent(walk.jumpRate, 1),
        note: root.Format.exact(walk.jumps) + ' of ' + root.Format.exact(walk.steps) + ' steps left the previous node'
      },
      'list-array': {
        value: root.Format.exact(arrayWalk.cacheMisses),
        note: values['list-compare'] ? 'same values, contiguous i32 array' : 'comparison hidden'
      },
      'list-ratio': {
        value: root.Format.ratio(walk.cacheMisses, arrayWalk.cacheMisses),
        note: walk.cacheMisses > arrayWalk.cacheMisses * 1.5
          ? 'the list fetches more memory for the same answer'
          : 'at this size the list still fits in cache, so placement barely matters'
      }
    });

    paintCanvas(list, nodes);
    paintCycle(nodes);
  }

  function measureArray(nodes) {
    const memory = root.MemoryModel.create({ bytes: Math.max(1 << 20, nodes * 8) });
    memory.setLogging(false);
    for (let i = 0; i < nodes; i += 1) memory.write(i * 4, 'i32', i, 'fill');
    memory.setLogging(true);
    memory.resetCounters();
    memory.clearLog();

    let total = 0;
    for (let i = 0; i < nodes; i += 1) total += memory.read(i * 4, 'i32', 'scan');

    const cache = root.CacheSim.replay({ log: memory.log(), lines: 512 });
    return {
      total: total,
      cacheLines: cache.distinctLines,
      cacheMisses: cache.misses,
      bytesRead: memory.counters().bytesRead
    };
  }

  function paintCanvas(list, nodes) {
    const host = root.jQuery('#list-canvas')[0];
    if (!host) return;

    const width = host.parentNode.getBoundingClientRect().width - 24;
    const ratio = window.devicePixelRatio || 1;
    host.width = Math.max(240, width) * ratio;
    host.height = 160 * ratio;
    host.style.width = '100%';

    const ctx = host.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, host.width, host.height);

    const log = list.memory.log().filter(function (entry) { return entry.label === 'value'; });
    const maxAddress = log.reduce(function (max, entry) { return Math.max(max, entry.address); }, 1);
    const plotWidth = Math.max(240, width);

    ctx.fillStyle = root.Palette.hue('blue');
    log.forEach(function (entry, step) {
      const x = (step / Math.max(1, log.length - 1)) * (plotWidth - 8) + 4;
      const y = 154 - (entry.address / maxAddress) * 148;
      ctx.fillRect(x, y, 2, 2);
    });

    ctx.fillStyle = root.Palette.token('text-muted');
    ctx.font = '10px system-ui';
    ctx.fillText(root.Format.exact(nodes) + ' nodes · highest address ' + root.Format.bytes(maxAddress), 6, 12);
  }

  /** Brent's cycle detection over a deliberately looped index array. */
  function paintCycle(nodes) {
    const size = Math.min(64, nodes);
    const next = new Array(size);
    for (let i = 0; i < size; i += 1) next[i] = i + 1;
    const cycleStart = Math.floor(size / 2);
    next[size - 1] = cycleStart;

    const found = brent(function (i) { return next[i]; }, 0);
    root.jQuery('#list-cycle').text(
      'list of ' + size + ' nodes with a loop back to index ' + cycleStart + ' → Brent reports ' +
      'cycle length ' + found.length + ', starting at index ' + found.start +
      ' (' + found.steps + ' pointer reads)');
  }

  function brent(nextOf, start) {
    let power = 1;
    let length = 1;
    let tortoise = start;
    let hare = nextOf(start);
    let steps = 1;

    while (tortoise !== hare) {
      if (power === length) { tortoise = hare; power *= 2; length = 0; }
      hare = nextOf(hare);
      steps += 1;
      length += 1;
    }

    let first = start;
    let second = start;
    for (let i = 0; i < length; i += 1) { second = nextOf(second); steps += 1; }
    while (first !== second) { first = nextOf(first); second = nextOf(second); steps += 2; }

    return { length: length, start: first, steps: steps };
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
