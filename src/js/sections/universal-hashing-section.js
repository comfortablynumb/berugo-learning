/**
 * Section: Universal, tabulation and keyed hashing.
 *
 * The attack is generated here, not canned: the demo brute-forces keys that
 * collide under the published hash, reports what that search cost, and then
 * shows the same payload doing nothing against a seeded table.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'universal-hashing';
  let panel = null;
  let chart = null;
  let cachedAttack = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
    app.state.subscribe('theme', function () { if (chart) chart.redraw(); });
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render({
      sectionId: SECTION_ID,
      orientation: [
        'A fixed hash function has a fixed set of colliding keys, and anyone can compute it. If your ' +
          'service turns request parameters into map keys, that set is a denial-of-service payload: ' +
          'n keys in one bucket cost Θ(n²) to insert.',
        'Universal hashing is the fix, and it is a guarantee rather than a hope. Pick the ' +
          'function at random from a family in which any two distinct keys collide with ' +
          'probability at most 1/m. Multiply-shift is two instructions and gives exactly that; ' +
          'tabulation hashing gives more independence for a few table lookups.',
        'This is why every serious runtime randomises its hash seed at start-up, and why iteration ' +
          'order is deliberately unspecified. If you persist hashes across processes, or ship a ' +
          'fixed seed, you have handed the property back.'
      ],
      demo: { title: 'Interactive demo — hash flooding, and three defences',
        markup: root.UniversalHashingTemplate.render() },
      diagram: {
        title: 'Diagram — flooding a request handler',
        caption: 'One POST body, thousands of parameters, all colliding.',
        definition: [
          'sequenceDiagram',
          '    participant A as attacker',
          '    participant S as server',
          '    participant M as parameter map',
          '    A->>S: POST with 2 000 crafted parameter names',
          '    loop for each parameter',
          '        S->>M: map.set(name, value)',
          '        M-->>M: walk the whole chain (all names hash alike)',
          '    end',
          '    Note over M: 2 000 inserts = 2 000 000 comparisons',
          '    M-->>S: done, eventually',
          '    S-->>A: 200 OK, one CPU core spent'
        ].join('\n')
      },
      insight: 'The 2011 hash-flooding disclosures are the reason your language randomises its hash ' +
        'seed. Caching hashes across processes, or persisting them to disk, reintroduces exactly ' +
        'the property the randomisation removed.'
    }));

    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.UniversalHashingTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  /**
   * Cached because the brute-force search is the expensive part of the demo.
   * The quoted cost is the cost of the payload actually used - `examinedAt`
   * remembers what each key cost - not the cost of the whole cached search,
   * and a search that ran out of budget says so instead of quietly handing
   * back a smaller payload than the slider asked for.
   */
  function attackKeys(count, buckets) {
    if (!cachedAttack || cachedAttack.buckets !== buckets || cachedAttack.keys.length < count) {
      const found = root.HashLab.collidingKeys({
        hash: root.HashFunctions.djb2, buckets: buckets, count: 6000, budget: 8000000
      });
      cachedAttack = { buckets: buckets, keys: found.keys, examinedAt: found.examinedAt };
    }

    const keys = cachedAttack.keys.slice(0, count);
    return {
      keys: keys,
      buckets: buckets,
      requested: count,
      examined: keys.length ? cachedAttack.examinedAt[keys.length - 1] : 0,
      short: keys.length < count
    };
  }

  function tableFor(defence, buckets) {
    const seed = root.Random.seeded(defence === 'seed' || defence === 'both' ? 987654321 : 1).int(1 << 30);
    const hash = defence === 'seed' || defence === 'both'
      ? function (key) { return root.HashFunctions.murmur3(key, seed); }
      : root.HashFunctions.djb2;

    return root.HashTableChained.create({
      hash: hash,
      capacity: buckets,
      maxLoad: 1e9,                            // hold the bucket count fixed for the comparison
      treeifyAt: defence === 'treeify' || defence === 'both' ? 8 : 0
    });
  }

  function measure(defence, keys, buckets) {
    const table = tableFor(defence, buckets);
    keys.forEach(function (key, i) { table.set(key, i); });
    keys.forEach(function (key) { table.get(key); });

    const stats = table.stats();
    return {
      defence: defence,
      maxChain: stats.maxChain,
      probesPerLookup: stats.lookups ? stats.lookupProbes / stats.lookups : 0,
      totalWork: stats.insertProbes,
      occupancy: table.occupancy()
    };
  }

  function update(app) {
    const values = panel.values();
    const buckets = values['uh-buckets'];
    const attack = attackKeys(values['uh-payload'], buckets);
    const result = measure(values['uh-defence'], attack.keys, buckets);
    const baseline = measure('none', attack.keys, buckets);

    root.MetricGrid.update({
      'uh-chain': {
        value: root.Format.exact(result.maxChain),
        note: values['uh-defence'] === 'none'
          ? 'every crafted key in one bucket'
          : 'against ' + root.Format.exact(baseline.maxChain) + ' undefended'
      },
      'uh-probes': {
        value: result.probesPerLookup.toFixed(1),
        note: 'undefended: ' + baseline.probesPerLookup.toFixed(1) + ' comparisons per lookup'
      },
      'uh-work': {
        value: root.Format.count(result.totalWork),
        note: root.Format.ratio(baseline.totalWork, Math.max(1, result.totalWork)) + ' less than undefended'
      },
      'uh-cost': {
        value: root.Format.count(attack.examined),
        note: 'candidates hashed offline to find ' + root.Format.exact(attack.keys.length) +
          ' colliding keys' + (attack.short
            ? ' — the search ran out of budget before reaching ' + root.Format.exact(attack.requested)
            : '')
      }
    });

    paintBuckets(result, buckets);
    paintUniversal(buckets);
    draw(app, attack, values, buckets);
  }

  function paintBuckets(result, buckets) {
    const lengths = result.occupancy.map(function (bucket) { return bucket.length; });
    root.BucketView.buckets(root.jQuery('#uh-buckets-view')[0], {
      lengths: lengths.slice(0, Math.min(buckets, 512)),
      trees: result.occupancy.map(function (bucket) { return bucket.tree; }),
      height: 170,
      caption: 'first ' + Math.min(buckets, 512) + ' buckets; purple means treeified'
    });
  }

  /**
   * Multiply-shift over a family of odd multipliers: the collision rate for a
   * fixed pair of keys averaged over the family is the universal bound.
   */
  function paintUniversal(buckets) {
    const bits = Math.round(Math.log2(buckets));
    const rng = root.Random.seeded(5);
    const pairs = [];
    for (let i = 0; i < 400; i += 1) pairs.push([rng.int(1 << 30), rng.int(1 << 30)]);

    let collisions = 0;
    const trials = 64;
    for (let t = 0; t < trials; t += 1) {
      const a = (rng.int(1 << 30) * 2 + 1) >>> 0;
      pairs.forEach(function (pair) {
        if (root.HashFunctions.multiplyShift(pair[0], a, bits) ===
          root.HashFunctions.multiplyShift(pair[1], a, bits)) collisions += 1;
      });
    }

    const rate = collisions / (trials * pairs.length);
    root.jQuery('#uh-universal').html(
      '<div>multiply-shift, ' + buckets + ' buckets (' + bits + ' bits)</div>' +
      '<div>measured collision rate over 64 random multipliers: ' + rate.toFixed(5) + '</div>' +
      '<div>universal bound 1/m = ' + (1 / buckets).toFixed(5) + '</div>' +
      '<div>tabulation: 4 tables × 256 random words = ' + root.Format.bytes(4 * 256 * 4) + ' of state</div>');
  }

  function draw(app, attack, values, buckets) {
    const sizes = [];
    for (let n = 250; n <= values['uh-payload']; n += 250) sizes.push(n);
    if (!sizes.length) sizes.push(values['uh-payload']);

    const series = { none: [], defended: [] };
    sizes.forEach(function (n) {
      const keys = attack.keys.slice(0, n);
      series.none.push({ x: n, y: Math.max(1, measure('none', keys, buckets).totalWork) });
      series.defended.push({ x: n, y: Math.max(1, measure('seed', keys, buckets).totalWork) });
    });

    chart = root.GrowthPlot.render(root.jQuery('#uh-chart')[0], {
      lazyLib: app.lazyLib,
      height: 240,
      logY: true,
      yMin: 1,
      series: [
        { label: 'fixed hash (undefended)', points: series.none, dots: true },
        { label: 'per-process seed', points: series.defended, dots: true }
      ],
      xLabel: 'crafted keys posted',
      yLabel: 'key comparisons (log)',
      legendHost: root.jQuery('#uh-legend')[0],
      summary: function () {
        return 'Total key comparisons to absorb a crafted payload, undefended and with a random seed.';
      }
    });
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
