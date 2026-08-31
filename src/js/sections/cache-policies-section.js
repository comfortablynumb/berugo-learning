/**
 * Section: Policies — writes and replacement.
 *
 * Two independent choices, and the demo separates them because they answer
 * different questions. The write policy decides how much traffic a write
 * generates; the replacement policy decides which line leaves when there is no
 * room. Neither has a universally right answer and both have a workload on
 * which the usual answer loses.
 *
 * The replacement result is the one worth arriving without being told: on a
 * cyclic reference pattern one line larger than the set, true LRU gets ZERO
 * hits and random gets most of them. LRU is not an approximation of the best
 * policy; it is a specific policy with a specific pathology, and having no
 * state at all is what escapes it.
 *
 * Pseudo-LRU is the control that makes the point rather than a second winner.
 * It is cheap, not random - it tracks the order closely enough to inherit the
 * pathology exactly, and it scores zero beside the policy it approximates.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'cache-policies';
  const Lab = root.MemoryLab;
  const Table = root.DataTable;
  const Cache = root.Memory.Cache;
  const POLICIES = ['lru', 'plru', 'fifo', 'rrip', 'random'];
  const SCANS = [4, 8, 12, 16, 24, 48];
  let panel = null;
  let chart = null;

  const STATES = [
    { state: 'invalid', from: 'nothing is here yet, or it was invalidated from below',
      cost: 'nothing to write out' },
    { state: 'clean', from: 'fetched and only read since',
      cost: 'nothing to write out: the copy below is identical' },
    { state: 'dirty', from: 'written under write-back, and not yet written out',
      cost: 'a write to the next level before the line can be replaced' }
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
      title: 'Diagram — a line\'s three states under write-back',
      caption: 'Only one of the three transitions costs anything, and it is the one that '
        + 'happens later than the write that caused it. That deferral is the whole of '
        + 'write-back: a line written a thousand times generates one memory transaction '
        + 'instead of a thousand, at the price of a write-out at an unpredictable moment and a '
        + 'dirty bit per line to remember it. Write-through swaps that for one transaction per '
        + 'write and no bookkeeping at all.',
      definition: [
        'stateDiagram-v2',
        '    [*] --> invalid',
        '    invalid --> clean: fetched on a read miss',
        '    invalid --> dirty: fetched on a write miss (write allocate)',
        '    clean --> dirty: written',
        '    clean --> invalid: evicted, and nothing to write out',
        '    dirty --> invalid: evicted, and the line is written to the level below',
        '    dirty --> dirty: written again, at no extra cost'
      ].join('\n')
    };
  }

  function orientation() {
    return opening().concat(closing());
  }

  function opening() {
    return [
      '**Write-back plus write-allocate is nearly universal because it collapses repeated '
        + 'writes into one transaction.** A thousand writes to four lines cost four lines of '
        + 'traffic under write-back and a thousand under write-through — a factor of 250 on '
        + 'this fixture. The price is a dirty bit per line and a write-out that happens at an '
        + 'unpredictable moment, which is exactly the bookkeeping M38 has to reason about.',
      '**The exception is streaming writes, and it is why non-temporal stores exist.** When '
        + 'every line is written once and never read, write-allocate fetches a line only to '
        + 'overwrite all of it — 1936 transactions against 1000 for no-write-allocate on the '
        + 'streaming fixture. That is one instruction in a real instruction set (a non-temporal '
        + 'store) and it exists for precisely this case.',
      '**True LRU is not the best policy; it is a specific one with a specific pathology.** '
        + 'Loop over nine lines in an eight-way set and LRU evicts the very line about to be '
        + 'used, every single time: zero hits out of 180. Random gets 132. Having no ordering '
        + 'at all is what saves it, because there is no rule for the access pattern to be '
        + 'aligned against — a genuinely surprising result, and the reason random replacement '
        + 'is used at the levels where anything cleverer costs too much.',
      '**Pseudo-LRU is a tree of bits, and it inherits the pathology rather than escaping '
        + 'it.** True LRU needs an ordering over the ways — expensive above four of them, and '
        + 'the reason associativity has a practical ceiling. A tree of ways-minus-one bits '
        + 'picks a victim by following the "go the other way" bits down, one bit flipped per '
        + 'access, for about the same hit rate — including zero of 180 on the cyclic fixture. '
        + 'Cheaper than LRU is not the same as unlike LRU, and the table is where that shows.',
      '**RRIP is about scans rather than about thrashing, and the two are different.** Insert '
        + 'a line predicting a distant re-reference and promote it on a hit, and a burst of '
        + 'never-reused lines passing through leaves before the working set does: 156 hits of '
        + '160 where LRU gets 80. Lengthen the scan far enough and RRIP falls back to LRU, '
        + 'which the scan-length table shows rather than hides.'
    ];
  }

  function closing() {
    return [
      '**Random replacement needs no state at all and is closer to LRU than people expect.** '
        + 'It cannot be pathological, because it has no pattern to be pathological about — '
        + 'which is exactly why it is the only policy on the page that survives the cyclic '
        + 'fixture. Real designs use it at the levels where the tag array is too large for '
        + 'anything cleverer, and it is worth noticing that it is also the worst policy on the '
        + 'long-scan row, at 63 against everyone else\'s 80: no state means no pathology and '
        + 'also no protection.',
      '**Inclusion is the third policy and it belongs to the hierarchy rather than the '
        + 'level.** Inclusive means a line in L1 is also in L2, so evicting from L2 must evict '
        + 'from L1; exclusive means it lives in exactly one place; non-inclusive means neither '
        + 'rule. The first buys a simple coherence check at the cost of capacity, which is the '
        + 'trade M38 opens with.',
      '**A victim cache is the small fix for the conflict problem in 37.2.** A handful of '
        + 'fully associative entries holding the last few evictions catches exactly the lines '
        + 'that a conflicting stride keeps throwing out and asking for again — a few entries '
        + 'buying most of what a doubling of associativity would.',
      '**No row of this page is a default to apply without looking.** The write matrix has a '
        + 'different winner per workload and so does the replacement table; what transfers is '
        + 'the habit of asking which workload you have before choosing, and the demo exists so '
        + 'that the question has a measured answer rather than a folk one.'
    ];
  }

  function insight() {
    return '**The most useful thing on this page is that the obviously-best policy is worst on '
      + 'a pattern that occurs constantly, and the reason generalises well beyond caches.** '
      + 'True LRU evicts the least recently used line, which is optimal when the future looks '
      + 'like the recent past — and exactly wrong when the access pattern is a cycle slightly '
      + 'larger than the capacity, because then the least recently used item is precisely the '
      + 'one about to be needed. Every loop over an array one element too big to fit has this '
      + 'shape. The policy that survives it is the one with no rule to be aligned against: '
      + 'random, which keeps most of the working set by accident. Pseudo-LRU does not survive '
      + 'it, and that is the more useful half of the result — an approximation of a policy '
      + 'inherits the policy\'s worst case, and only a different rule escapes it. That is a '
      + 'general property of '
      + 'eviction and admission policies, and it shows up in every cache anybody writes: an '
      + 'application cache with an LRU eviction rule and a periodic full scan will evict '
      + 'exactly the hot set every time the scan runs, and the standard fixes — a scan-'
      + 'resistant admission policy, a segmented LRU, a bit of randomness — are the same three '
      + 'answers this table contains. When a caching layer behaves badly, the first question '
      + 'is not "is the cache big enough" but "does the access pattern have a period near the '
      + 'capacity", because that is the case where more capacity changes nothing at all.';
  }

  function config() {
    return { sectionId: SECTION_ID, orientation: orientation(),
      demo: { title: 'Interactive demo — the policy matrix, on workloads that disagree',
        markup: root.CachePolicyTemplate.render() },
      diagram: diagram(), insight: insight() };
  }

  /* ------------------------------------------------------------- plumbing */

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({ controls: root.CachePolicyTemplate.controls(),
      onChange: function () { update(app); } });
    update(app);
  }

  function reading() {
    const values = panel.values();
    const settings = { sets: 16, ways: 4, lineBytes: 64, hitCycles: 4,
      replacement: values['pol-replacement'], write: values['pol-write'],
      allocate: values['pol-allocate'] };

    return { workload: values['pol-workload'], settings: settings,
      summary: Lab.level(values['pol-workload'], settings).summary };
  }

  function update(app) {
    const view = reading();

    paintMetrics(view);
    paintStates();
    paintWrites();
    paintReplacement();
    paintScan();
    paintChart(app, view);
  }

  function paintMetrics(view) {
    const found = view.summary;

    root.MetricGrid.update({
      'pol-hitrate': { value: (100 * found.hitRate).toFixed(1) + '%',
        note: found.hits + ' of ' + found.accesses + ' accesses' },
      'pol-traffic': { value: found.trafficOut,
        note: 'fills, write-outs and forwarded writes together' },
      'pol-dirty': { value: found.dirtyEvictions,
        note: found.write === 'writeBack' ? 'each one a deferred write finally being paid'
          : 'none, because write-through never leaves a line dirty' },
      'pol-through': { value: found.writeThroughs,
        note: found.write === 'writeThrough' ? 'one per write, which is the policy'
          : 'only the bypassed write misses' },
      'pol-bypassed': { value: found.bypassed,
        note: found.allocate === 'noWriteAllocate' ? 'write misses that never fetched a line'
          : 'none: every write miss fetches first' },
      'pol-verdict': { value: verdict(view), note: 'measured on this workload, not assumed' }
    });
  }

  function verdict(view) {
    const rows = ['writeBack/writeAllocate', 'writeThrough/writeAllocate',
      'writeBack/noWriteAllocate'].map(function (combination) {
      const parts = combination.split('/');
      const found = Lab.level(view.workload, Object.assign({}, view.settings,
        { write: parts[0], allocate: parts[1] })).summary;

      return { name: combination, traffic: found.trafficOut };
    }).sort(function (left, right) { return left.traffic - right.traffic; });

    return rows[0].name;
  }

  function paintStates() {
    Table.paint('pol-state', STATES.map(function (row) {
      return [row.state, row.from, row.cost];
    }), 'The dirty bit is one bit per line and it is what makes write-back possible: without '
      + 'it every eviction would have to write out, because the cache could not tell which '
      + 'lines had changed. That is the general shape of a deferred write everywhere - the '
      + 'saving is real and the bookkeeping is what makes it correct.');
  }

  function paintWrites() {
    const base = { sets: 16, ways: 4, lineBytes: 64, hitCycles: 4 };

    Table.paint('pol-write-table', [
      ['writeBack', 'writeAllocate', 'a loop that rewrites the same lines'],
      ['writeThrough', 'writeAllocate', 'anything where simplicity beats traffic'],
      ['writeBack', 'noWriteAllocate', 'streaming writes that are never read back']
    ].map(function (row) {
      const settings = Object.assign({}, base, { write: row[0], allocate: row[1] });

      return [row[0] === 'writeBack' ? 'write back' : 'write through',
        row[1] === 'writeAllocate' ? 'fetch the line' : 'go straight past',
        Lab.level('hot', settings).summary.trafficOut,
        Lab.level('streamingWrites', settings).summary.trafficOut,
        row[2]];
    }), 'Two workloads, three policies, and the winner swaps. A thousand writes to four lines '
      + 'cost 4 transactions under write-back and 1000 under write-through - a factor of 250. '
      + 'A thousand writes to a thousand different lines cost 1936 under write-allocate, '
      + 'because each one fetches a line it is about to overwrite completely, and 1000 when it '
      + 'does not bother. There is no row that wins both columns.');
  }

  function paintReplacement() {
    Table.paint('pol-replace-table', POLICIES.map(function (policy) {
      return [Cache.REPLACEMENT[policy].name, Cache.REPLACEMENT[policy].bits,
        cyclicHits(policy) + ' of 180', scanHits(policy, 8) + ' of 160',
        Cache.REPLACEMENT[policy].about];
    }), 'The third column is a loop over nine lines in an eight-way set: true LRU evicts the '
      + 'line it is about to want, every time, and gets nothing at all. The fourth is a small '
      + 'working set with a scan passing through it, which is what RRIP was built for. Neither '
      + 'column has the same winner, and the second column says what each policy costs to '
      + 'build - which is the axis a table of hit rates leaves out.');
  }

  function cyclicHits(policy) {
    const cache = Cache.create({ sets: 1, ways: 8, lineBytes: 64, replacement: policy,
      seed: 3 });

    for (let pass = 0; pass < 20; pass += 1) {
      for (let at = 0; at < 9; at += 1) Cache.access(cache, { address: at * 64 });
    }
    return Cache.summary(cache).hits;
  }

  function scanHits(policy, scan) {
    const cache = Cache.create({ sets: 1, ways: 8, lineBytes: 64, replacement: policy,
      seed: 3 });
    let hits = 0;

    for (let pass = 0; pass < 20; pass += 1) {
      for (let rep = 0; rep < 2; rep += 1) {
        for (let at = 0; at < 4; at += 1) {
          if (Cache.access(cache, { address: at * 64 }).hit) hits += 1;
        }
      }
      for (let at = 0; at < scan; at += 1) {
        Cache.access(cache, { address: 100000 + at * 64 });
      }
    }
    return hits;
  }

  function paintScan() {
    Table.paint('pol-scan', SCANS.map(function (scan) {
      return [scan + ' lines'].concat(POLICIES.map(function (policy) {
        return scanHits(policy, scan);
      }));
    }), 'A four-line working set touched twice, then a scan of the given length, in an '
      + 'eight-way set. RRIP holds the whole working set through a scan of eight and loses it '
      + 'at sixteen, which is the honest shape of scan resistance: the re-reference counter '
      + 'has four values, so it buys a bounded amount of protection rather than an unlimited '
      + 'one. Past that bound every policy converges on the same answer.');
  }

  function paintChart(app, view) {
    const host = root.jQuery('#pol-chart')[0];

    if (!host) return;
    if (chart) chart.destroy();
    const workloads = ['sequential', 'chase', 'conflicting', 'random', 'hot'];

    chart = root.ErrorBandView.bars(host, { lazyLib: app.lazyLib, height: 260,
      yLabel: 'hit rate',
      values: workloads.reduce(function (out, name) {
        POLICIES.forEach(function (policy, index) {
          const found = Lab.level(name, Object.assign({}, view.settings,
            { replacement: policy })).summary;

          out.push({ label: name.slice(0, 6) + ' ' + policy.slice(0, 4),
            value: found.hitRate, series: index });
        });
        return out;
      }, []) });
    root.Helpers.setText('pol-chart-note', 'Five policies on five workloads, at a fixed '
      + 'organisation. Most groups are flat, which is the honest headline: on ordinary access '
      + 'patterns the replacement policy barely matters, and the effort is better spent on the '
      + 'layout. The groups where it does matter are the ones with a period near the capacity, '
      + 'and those are the ones the tables above are about.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
