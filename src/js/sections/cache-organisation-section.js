/**
 * Section: Cache organisation.
 *
 * Three divisions and a table. The whole of cache organisation is that an
 * address splits into a tag, an index and an offset, and that the index comes
 * from the MIDDLE - which is the fact that explains most mysterious
 * performance cliffs and the one a formula on a slide never makes stick.
 *
 * The set/way grid is here to make it visible rather than explicable. Run the
 * conflicting stride and the picture is a table with one occupied row and
 * sixty-three empty ones: a 32 KiB cache holding 256 bytes, because every
 * address the program used had the same middle bits.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'cache-organisation';
  const Lab = root.MemoryLab;
  const Table = root.DataTable;
  const Cache = root.Memory.Cache;
  const View = root.CacheView;
  let panel = null;

  const STRIDES = [64, 128, 256, 512, 1024, 2048, 4096, 8192];
  const LINES = [16, 32, 64, 128, 256];

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  /* ------------------------------------------------------------- the frame */

  function diagram() {
    return {
      title: 'Diagram — one address, three fields, one lookup',
      caption: 'The index picks the row and the tag is compared against every way in it. Note '
        + 'where the index comes from: the middle of the address, above the offset and below '
        + 'the tag. Two addresses that differ only in their high bits therefore land in the '
        + 'SAME set however far apart they are in memory, which is why a stride that is a '
        + 'multiple of sets times line size turns the whole table into one row.',
      definition: [
        'flowchart LR',
        '    A["address"] --> T["tag: the high bits"]',
        '    A --> I["index: the middle bits"]',
        '    A --> O["offset: the low bits"]',
        '    I --> S["pick set number index"]',
        '    S --> W{"compare the tag against every way"}',
        '    T --> W',
        '    W -->|"one matches"| H["hit: use the offset to pick the byte"]',
        '    W -->|"none matches"| M["miss: choose a victim in this set and fetch"]',
        '    O --> H'
      ].join('\n')
    };
  }

  function orientation() {
    return opening().concat(closing());
  }

  function opening() {
    return [
      '**A cache is a table, and an address is three numbers.** The offset says which byte '
        + 'within a line; the index says which row the line must live in; the tag is everything '
        + 'left over, and it is what distinguishes this line from the others that map to the '
        + 'same row. Every lookup is: pick the row, compare the tag against each column, and '
        + 'either hit or choose a victim.',
      '**The index comes from the middle of the address, and almost every cache surprise '
        + 'follows from that.** Addresses that differ only in their high bits have the same '
        + 'index, so they compete for the same row however far apart they are. A stride that is '
        + 'a multiple of `sets x lineBytes` reaches exactly one set — and the demo shows a 64-set '
        + 'cache with sixty-three empty rows.',
      '**Associativity is the number of columns, and it is the direct answer to that.** One way '
        + 'is direct mapped: an address has exactly one home, and two addresses that share an '
        + 'index cannot both be resident. More ways means more places, at the cost of comparing '
        + 'more tags in parallel. The stride table shows the same access pattern going from 0% '
        + 'to a working hit rate purely by widening the table.',
      '**Line size trades two things against each other and the sparse walk shows both.** A '
        + 'bigger line means fewer misses for a sequential walk, because one fetch serves '
        + 'several accesses. It also means more bytes fetched that nobody wanted when the '
        + 'accesses are sparse: at 64 bytes this walk fetches eight times the data it uses, and '
        + 'at 256 it fetches the same waste in a quarter of the misses.',
      '**Capacity is the product of the three, and it is not the interesting number.** Two '
        + 'caches of the same capacity with different shapes behave completely differently on '
        + 'the same trace, and the demo lets you hold the capacity fixed while moving sets '
        + 'against ways to see it.'
    ];
  }

  function closing() {
    return [
      '**A direct-mapped cache is not a bad cache; it is a fast one with a specific failure '
        + 'mode.** One tag comparison instead of eight means a shorter hit time, which is why '
        + 'the very first level of some designs is direct mapped or two-way. The failure mode is '
        + 'the one on this page, and it is worth being able to recognise rather than avoid by '
        + 'reflex.',
      '**Virtual or physical indexing is a real design question and it constrains the size.** '
        + 'Indexing with the virtual address lets the lookup start before translation finishes, '
        + 'which is why L1 caches usually do; but then the index bits must come from within the '
        + 'page offset, or two virtual addresses for one physical line can land in different '
        + 'sets. That constraint — sets times line size no larger than the page — is why L1 data '
        + 'caches sat at 32 KiB for so many years.',
      '**The set/way picture is the fastest diagnostic there is.** A heat map over sets that '
        + 'is uniform means the addresses are spread; one hot row means they are not, and the '
        + 'fix is a layout change rather than a bigger cache. That distinction is 37.4\'s whole '
        + 'subject and this is where you can see it.',
      '**Everything here is one level.** Multi-level behaviour, write policies and replacement '
        + 'are the next two sections, and the reason to separate them is that each one changes '
        + 'a different number: organisation moves where a line can go, policy moves which one '
        + 'leaves, and the hierarchy moves what happens next.'
    ];
  }

  function insight() {
    return '**"The index bits come from the middle of the address" is one sentence, and it '
      + 'explains a class of bug that otherwise looks like magic.** A program allocates several '
      + 'arrays, each a power-of-two size, and walks them together — and runs several times '
      + 'slower than the same program with one array made one element larger. Nothing about the '
      + 'algorithm changed and no profiler line points anywhere useful. What happened is that '
      + 'the arrays were all a multiple of the set span apart, so the corresponding elements of '
      + 'each one landed in the same set, and an eight-way cache with four arrays and two '
      + 'temporaries has run out of ways. The fix is padding, and it looks like superstition '
      + 'until you have seen the set/way grid. The same shape appears everywhere addresses are '
      + 'hashed by taking a slice of bits: a hash table that indexes with the low bits of a '
      + 'pointer degenerates when every pointer is aligned, a disk that stripes by block number '
      + 'hot-spots when the access stride matches the stripe width, and a sharded queue keyed '
      + 'by a rounded timestamp puts every message in one shard. Whenever a structure picks a '
      + 'slot by taking part of a key, ask what happens when the keys are regular — because '
      + 'real keys usually are.';
  }

  function config() {
    return { sectionId: SECTION_ID, orientation: orientation(),
      demo: { title: 'Interactive demo — decompose an address, then watch the table fill',
        markup: root.CacheOrgTemplate.render() },
      diagram: diagram(), insight: insight() };
  }

  /* ------------------------------------------------------------- plumbing */

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({ controls: root.CacheOrgTemplate.controls(),
      onChange: function () { update(app); } });
    update(app);
  }

  function parseAddress(text) {
    const cleaned = String(text || '').trim();
    const value = /^0[xX]/.test(cleaned) ? parseInt(cleaned, 16) : Number(cleaned);

    return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
  }

  function reading() {
    const values = panel.values();
    const settings = { sets: Number(values['org-sets']), ways: Number(values['org-ways']),
      lineBytes: Number(values['org-line']), hitCycles: 4 };

    return { settings: settings, address: parseAddress(values['org-address']),
      workload: values['org-workload'], run: Lab.level(values['org-workload'], settings) };
  }

  function update() {
    const view = reading();

    paintMetrics(view);
    paintDecompose(view);
    paintGrid(view);
    paintStride();
    paintAssociativity();
    paintLineSize();
  }

  function paintMetrics(view) {
    const parts = Cache.decode(view.run.cache, view.address);
    const resident = Cache.resident(view.run.cache);
    const spread = View.spread(view.run.cache, resident);
    const summary = view.run.summary;

    root.MetricGrid.update({
      'org-capacity': { value: bytes(summary.capacity),
        note: summary.sets + ' x ' + summary.ways + ' x ' + summary.lineBytes + ' bytes' },
      'org-tag': { value: parts.tag, note: 'the high bits, compared against every way' },
      'org-index': { value: parts.index,
        note: 'of ' + summary.sets + ' sets - the middle bits, and the whole problem' },
      'org-offset': { value: parts.offset,
        note: 'of ' + summary.lineBytes + ' bytes in the line' },
      'org-hitrate': { value: (100 * summary.hitRate).toFixed(1) + '%',
        note: summary.hits + ' hits of ' + summary.accesses + ' accesses' },
      'org-spread': { value: spread.used + ' of ' + spread.sets,
        note: spread.used === spread.sets ? 'the workload reaches the whole table'
          : 'the rest of the table is idle: this is a conflict problem' }
    });
  }

  function bytes(value) {
    if (value >= 1024) return (value / 1024) + ' KiB';
    return value + ' B';
  }

  function paintDecompose(view) {
    const parts = Cache.decode(view.run.cache, view.address);

    Table.paint('org-decompose',
      View.decomposition(view.run.cache, parts, view.address).map(function (row) {
        return [row.field, row.value, row.about];
      }),
      'Change the set count and watch the index and the tag move: the same address lands in a '
      + 'different row of a differently shaped table, and nothing about the address changed. '
      + 'That is the sense in which the mapping is a property of the cache rather than of the '
      + 'program - and the sense in which a program can nevertheless be written to fight it.');
  }

  function paintGrid(view) {
    const resident = Cache.resident(view.run.cache);
    const parts = Cache.decode(view.run.cache, view.address);
    const spread = View.spread(view.run.cache, resident);

    root.jQuery('#org-grid').html(View.markup(view.run.cache,
      { resident: resident, sets: 32, highlight: parts.index }));
    root.jQuery('#org-legend').html(View.legend());
    root.Helpers.setText('org-grid-note', gridNote(view, spread));
  }

  function gridNote(view, spread) {
    if (spread.used <= 2 && spread.sets > 4) {
      return 'One occupied row and ' + (spread.sets - spread.used) + ' empty ones. This is a '
        + bytes(view.run.summary.capacity) + ' cache holding '
        + bytes(spread.lines * view.run.summary.lineBytes) + ', because every address the '
        + 'workload used had the same middle bits. No amount of extra capacity helps: the fix '
        + 'is to change the stride or the layout so the addresses spread.';
    }
    return 'The highlighted row is the set the address in the control panel maps to; the last '
      + 'column is how full each set is. A table whose rows are evenly occupied is a workload '
      + 'whose addresses are spread, and it is the picture you want. Switch the workload to '
      + '"conflicting" to see the other kind.';
  }

  function paintStride() {
    const base = { sets: 64, ways: 8, lineBytes: 64, hitCycles: 4 };

    Table.paint('org-stride', STRIDES.map(function (stride) {
      const cache = Cache.create(base);
      const lines = stride / base.lineBytes;
      const reach = reachable(stride, base);

      for (let pass = 0; pass < 3; pass += 1) {
        for (let at = 0; at < 32; at += 1) Cache.access(cache, { address: at * stride });
      }
      const summary = Cache.summary(cache);

      return [stride + ' B', reach, (100 * summary.hitRate).toFixed(1) + '%', summary.misses,
        reach >= 32 ? 'spread across the table'
          : (summary.hitRate > 0.5 ? 'crowded but it still fits'
            : 'more lines than ways in the sets it can reach')];
    }), 'Thirty-two lines touched three times, on a fixed 64-set eight-way cache. The only '
      + 'thing that changes down the table is the stride, and the hit rate falls off a cliff at '
      + '2048 bytes - which is 32 sets times 64 bytes, so consecutive accesses land two sets '
      + 'apart and only half the table is reachable. At 4096 the whole walk lands in one set.');
  }

  /** How many distinct sets a stride can reach, which is the set count divided
   *  by the greatest common divisor of the stride in lines and the set count. */
  function reachable(stride, settings) {
    const lines = Math.max(1, Math.round(stride / settings.lineBytes));

    return settings.sets / gcd(lines % settings.sets || settings.sets, settings.sets);
  }

  function gcd(left, right) {
    return right === 0 ? left : gcd(right, left % right);
  }

  function paintAssociativity() {
    const total = 64 * 8;

    Table.paint('org-assoc', [1, 2, 4, 8, 16, 32].map(function (ways) {
      const sets = Math.max(1, Math.round(total / ways));
      const settings = { sets: sets, ways: ways, lineBytes: 64, hitCycles: 4 };
      const cache = Cache.create(settings);

      for (let pass = 0; pass < 4; pass += 1) {
        for (let at = 0; at < 16; at += 1) Cache.access(cache, { address: at * 4096 });
      }
      const summary = Cache.summary(cache);
      const spread = View.spread(cache, Cache.resident(cache));

      return [ways === 1 ? 'direct mapped' : ways + '-way set associative', sets, ways,
        (100 * summary.hitRate).toFixed(1) + '%', spread.used + ' of ' + spread.sets];
    }), 'The capacity is held at 32 KiB in every row - only the shape changes. Sixteen lines '
      + 'at a 4 KiB stride all map to one set, so the hit rate is decided entirely by how many '
      + 'ways that set has: nothing until the ways reach the number of conflicting lines, then '
      + 'everything. This is what "raise the associativity" buys, and it buys nothing at all '
      + 'against a working set that simply does not fit.');
  }

  function paintLineSize() {
    Table.paint('org-line-table', LINES.map(function (lineBytes) {
      const sets = Math.max(1, Math.round(32768 / (8 * lineBytes)));
      const cache = Cache.create({ sets: sets, ways: 8, lineBytes: lineBytes, hitCycles: 4 });

      for (let at = 0; at < 256; at += 1) Cache.access(cache, { address: at * 64 });
      const summary = Cache.summary(cache);
      const fetched = summary.misses * lineBytes;

      return [lineBytes + ' B', summary.misses, fetched + ' B', '2048 B',
        (fetched / 2048).toFixed(1) + 'x'];
    }), 'One eight-byte element every 64 bytes, on caches of the same 32 KiB capacity. Bigger '
      + 'lines mean fewer misses - 256 at 64 bytes, 64 at 256 bytes - and exactly the same '
      + 'wasted traffic, because the bytes beside each element are fetched either way and never '
      + 'used. That is the line-size trade in one table: spatial locality is a bet, and a '
      + 'sparse access pattern is the case where it loses.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
