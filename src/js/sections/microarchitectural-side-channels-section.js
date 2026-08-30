/**
 * Section: Microarchitectural side channels.
 *
 * A working cache-timing channel, run against the same cache the out-of-order
 * core uses, with the speculation driven by the same bimodal predictor M35
 * built. Training the predictor with in-bounds indices makes the out-of-bounds
 * call mispredict, the dependent load runs before the bounds check resolves,
 * and the line it touched is still resident afterwards.
 *
 * The point the demo exists to make is the one everybody gets wrong: the
 * speculative instructions ARE discarded, their registers ARE reclaimed, and
 * the leak happens anyway - because the cache is not part of the architectural
 * state that a squash restores. A machine that undid its cache fills on a
 * misprediction would be a machine whose cache never helped.
 *
 * Nothing here leaves the simulator: there is no timer, no real memory and no
 * victim process. It is a model of a channel, built so the mitigation can be
 * switched on and the recovery rate measured falling to chance.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'microarchitectural-side-channels';
  const Table = root.DataTable;
  const Lab = root.SideChannelLab;
  const ROUNDS = [1, 3, 7, 15, 31, 63, 127];
  const MITIGATIONS = ['none', 'fence', 'mask'];
  const cache = {};
  let panel = null;
  let chart = null;

  const STEPS = [
    { step: 'the bounds check is predicted taken', arch: 'unchanged',
      cacheState: 'unchanged', recoverable: 'nothing has happened yet' },
    { step: 'the out-of-bounds read executes speculatively',
      arch: 'a physical register holds the secret byte', cacheState: 'unchanged',
      recoverable: 'yes — the register is speculative' },
    { step: 'the dependent probe load executes', arch: 'another speculative register',
      cacheState: 'ONE LINE IS NOW RESIDENT, chosen by the secret',
      recoverable: 'the register yes, the line no' },
    { step: 'the branch resolves: the guess was wrong',
      arch: 'both registers freed, both instructions squashed',
      cacheState: 'the line is still resident',
      recoverable: 'the machine believes it has fully recovered' },
    { step: 'the attacker times every probe line', arch: 'nothing of the victim\'s',
      cacheState: 'one line is fast and the rest are slow',
      recoverable: 'the secret has already left' }
  ];

  const MITIGATION_ROWS = [
    { name: 'none', stops: 'nothing', leak: 'the secret, at 100% with no noise',
      cost: 'none — this is the fast version' },
    { name: 'speculation barrier (fence)',
      stops: 'the dependent load, until the bounds check has resolved',
      leak: 'nothing at all — every round abstains',
      cost: 'the speculation itself: the branch latency on every call' },
    { name: 'index masking',
      stops: 'the out-of-bounds ADDRESS from ever existing',
      leak: 'the in-bounds array, deterministically — public data through a working channel',
      cost: 'one AND instruction, and the array size must be a power of two' }
  ];

  const RECEIVERS = [
    { name: 'Flush+Reload',
      needs: 'shared memory with the victim — a shared library, a deduplicated page',
      recovers: 'the value exactly: it names the line it asks about',
      here: 'CAFEBABE, character for character',
      ambiguity: 'none' },
    { name: 'Prime+Probe',
      needs: 'nothing shared — only the same cache',
      recovers: 'the SET, which is a few address bits',
      here: 'a candidate list containing the right answer',
      ambiguity: 'as many values as share a set' }
  ];

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  /* -------------------------------------------------------- the machinery */

  function cached(key, compute) {
    const found = JSON.stringify(key);

    if (!(found in cache)) cache[found] = compute();
    return cache[found];
  }

  function attack(options) {
    return cached(['attack', options], function () {
      const lab = Lab.create(options);

      return { lab: lab, found: Lab.recover(lab) };
    });
  }

  function reliability(options, rounds) {
    return cached(['reliability', options, rounds], function () {
      return Lab.reliability(options, { seeds: 8, rounds: rounds });
    });
  }

  /* ------------------------------------------------------------- the frame */

  function diagram() {
    return {
      title: 'Diagram — the access is undone, the footprint is not',
      caption: 'Every arrow above the dashed line is work the machine threw away: the '
        + 'registers were freed, the instructions squashed, and nothing the program could '
        + 'read was changed. The one thing that survives is a cache line, chosen by the value '
        + 'that was never supposed to be read. That is the entire mechanism, and it is why '
        + '"we roll back the registers" was never a mitigation — the registers were never '
        + 'the problem.',
      definition: [
        'sequenceDiagram',
        '    participant A as attacker',
        '    participant P as predictor',
        '    participant V as victim gadget',
        '    participant C as shared cache',
        '    A->>V: call with in-bounds indices, many times',
        '    V->>P: update: the bounds check was taken',
        '    Note over P: the counter saturates at "in bounds"',
        '    A->>C: flush every probe line',
        '    A->>V: call with an out-of-bounds index',
        '    P-->>V: predicted: in bounds',
        '    V->>C: speculative read of data[index] — the secret',
        '    V->>C: speculative read of probe[secret * stride]',
        '    Note over V: the branch resolves: WRONG. Both squashed.',
        '    Note over C: the probe line is still resident',
        '    A->>C: time every probe line',
        '    C-->>A: one line is fast, and its index is the secret'
      ].join('\n')
    };
  }

  function orientation() {
    return opening().concat(closing());
  }

  function opening() {
    return [
      '**The general shape: a shared microarchitectural resource whose state depends on what '
        + 'was accessed, and whose timing reveals that state.** A cache is the clearest '
        + 'example and not the only one — branch predictor tables, TLBs, the store queue and '
        + 'the ports themselves are all shared and all stateful. Any of them can carry a '
        + 'channel, and the recipe is always the same three parts: put the resource in a known '
        + 'state, let the victim run, and measure.',
      '**Flush+Reload is the cleanest receiver and it needs shared memory.** Evict every line '
        + 'of a probe array, let the victim run, then time a read of each line: the one that '
        + 'is fast is the one the victim touched. On this cache a hit is 1 cycle and a miss is '
        + '20, and the demo prints all sixteen timings so the signal is visible rather than '
        + 'asserted.',
      '**Spectre is that channel plus a mispredicted bounds check.** `if (index < size) y = '
        + 'probe[data[index] * stride]` is correct code. The bounds check is a branch, branches '
        + 'are predicted, and the attacker trains the predictor by calling with in-bounds '
        + 'indices first. The out-of-bounds call then runs the two dependent loads before the '
        + 'check resolves. Set the training control to zero and the leak stops entirely, which '
        + 'is the mechanism rather than a switch.',
      '**The leak is not in the discarded instructions — it is in the cache state they left '
        + 'behind.** The step table below walks it line by line. The registers holding the '
        + 'secret really are freed and the instructions really are squashed; the machine has '
        + 'done everything precise exceptions require. One cache line is resident that was not '
        + 'before, and no squash touches a cache, because a cache that undid its fills on a '
        + 'misprediction would be a cache that never helped.',
      '**Meltdown was the same channel with an exception instead of a branch.** A load from a '
        + 'kernel address faults, but on affected designs the data reached the dependent load '
        + 'before the fault was taken at commit. Same footprint, same receiver; the fix was '
        + 'unmapping the kernel from user page tables, at a real cost to every system call.'
    ];
  }

  function closing() {
    return [
      '**Noise is what makes repetition necessary, and it is modelled in both directions.** '
        + 'Other activity can evict the victim\'s line (hiding a real signal) or touch an '
        + 'unrelated one (manufacturing a false one). At 30% noise a single round recovers 6% '
        + 'of the secret — chance — and 127 rounds recover 100%. A channel is a channel; the '
        + 'error rate only decides how long it takes.',
      '**The two mitigations fail in completely different ways and both are instructive.** A '
        + 'speculation barrier stops the access, so the receiver sees no hit at all and every '
        + 'round abstains. Index masking leaves the channel working perfectly and puts PUBLIC '
        + 'data through it — the recovered string becomes the in-bounds array, deterministically. '
        + 'A mitigation\'s job is not to break the channel; it is to keep the secret out of it.',
      '**Prime+Probe is the weaker attack and the more dangerous one.** It needs nothing '
        + 'shared with the victim — only the same cache — so it works across processes, across '
        + 'containers and between SMT threads on one core (36.7). It recovers the cache SET '
        + 'rather than the value, so where more values map to a set than there are sets, the '
        + 'reading is ambiguous, and the demo reports the collisions rather than hiding them.',
      '**This is why constant-time programming is about addresses as well as branches.** M23 '
        + 'made the point for comparisons; this section is the mechanism behind it. A lookup '
        + 'table indexed by a key byte leaks that byte through the cache even if every branch '
        + 'in the code is data-independent, which is why constant-time AES implementations '
        + 'avoid S-box tables and why the rule is "no secret-dependent addresses" and not '
        + 'merely "no secret-dependent branches".'
    ];
  }

  function insight() {
    return '**The lesson that generalises past processors is that isolation has to be '
      + 'reasoned about at the level where the sharing actually happens, and almost nobody '
      + 'does that by default.** Every layer above this one — the type system, the bounds '
      + 'check, the process boundary, the hypervisor, the language runtime — was doing '
      + 'exactly its job while the secret walked out. Nothing was violated: no memory was '
      + 'corrupted, no permission was bypassed, and the machine\'s own correctness guarantee, '
      + 'that squashed instructions leave no architectural trace, held perfectly. The secret '
      + 'left through a resource that no layer above considered part of its interface, '
      + 'because it is shared for performance and invisible by design. That pattern is not '
      + 'unique to caches. A web application that leaks account existence through response '
      + 'time, a compression scheme that leaks plaintext through ciphertext length, a '
      + 'deduplicating filesystem that leaks file contents through write latency, and a '
      + 'rate limiter that leaks whether a key is valid are all the same shape: a shared, '
      + 'stateful, performance-motivated resource that the security model never listed. The '
      + 'discipline is to ask, of any optimisation that remembers something across a trust '
      + 'boundary, what an observer could learn from how fast it is — and to ask it before '
      + 'the optimisation ships, because retrofitting the answer is what the last several '
      + 'years of processor mitigations have cost.';
  }

  function config() {
    return { sectionId: SECTION_ID, orientation: orientation(),
      demo: { title: 'Interactive demo — a channel that works, and a mitigation that closes it',
        markup: root.ChannelTemplate.render() },
      diagram: diagram(), insight: insight() };
  }

  /* ------------------------------------------------------------- plumbing */

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({ controls: root.ChannelTemplate.controls,
      onChange: function () { update(app); } });
    update(app);
  }

  function reading() {
    const values = panel.values();
    const options = { mitigation: values['chan-mitigation'],
      noise: Number(values['chan-noise']), rounds: Number(values['chan-rounds']),
      train: Number(values['chan-train']) };

    return { options: options, rounds: options.rounds, run: attack(options),
      mean: reliability({ mitigation: options.mitigation, noise: options.noise,
        train: options.train }, options.rounds) };
  }

  function update(app) {
    const view = reading();

    paintMetrics(view);
    paintTimings(view);
    paintAttack(view);
    paintRounds(view);
    paintMitigations();
    paintReceivers(view);
    paintSteps();
    paintChart(app, view);
  }

  function paintMetrics(view) {
    const found = view.run.found;

    root.MetricGrid.update({
      'chan-recovered': { value: found.recovered,
        note: found.recovered === view.run.lab.secret ? 'exactly right'
          : 'a question mark is a round where no single line was fast' },
      'chan-accuracy': { value: (100 * found.accuracy).toFixed(1) + '%',
        note: found.correct + ' of ' + found.total + ' characters, at ' + view.rounds +
          ' rounds each' },
      'chan-mean': { value: (100 * view.mean.mean).toFixed(1) + '%',
        note: 'eight independent seeds — eight characters is far too few to quote alone' },
      'chan-chance': { value: (100 * found.chance).toFixed(1) + '%',
        note: 'a mitigated channel should land near this, not at zero' },
      'chan-speculative': { value: found.counters.speculated,
        note: 'out-of-bounds reads that never architecturally happened' },
      'chan-blocked': { value: found.counters.blocked + found.counters.masked,
        note: found.counters.blocked ? 'stopped by the barrier'
          : (found.counters.masked ? 'the index was forced back in range' : 'nothing blocked') }
    });
  }

  function paintTimings(view) {
    const rows = view.run.found.rows[0];
    const timings = rows && rows.timings ? rows.timings : [];

    Table.paint('chan-timings', timings.map(function (row) {
      return [row.letter, '0x' + Lab.probeAddress(view.run.lab, row.value).toString(16),
        row.set, row.cycles,
        { value: row.hit ? 'HIT — the victim touched this line' : 'miss',
          className: row.hit ? 'good' : '' }];
    }), timingCaption(view, timings));
  }

  function timingCaption(view, timings) {
    const hits = timings.filter(function (row) { return row.hit; });

    return 'The receiver, in full: sixteen lines flushed, the victim run once, then every '
      + 'line timed. ' + (hits.length === 1
        ? 'Exactly one is a hit, and its position in the probe array IS the secret byte.'
        : hits.length + ' lines are hits, so this round abstains — the vote across rounds is '
          + 'what turns an unreliable reading into a reliable one.')
      + ' A hit is ' + view.run.lab.config.cache.hitCycles + ' cycle and a miss is '
      + view.run.lab.config.cache.missCycles + ', which on real hardware is roughly the '
      + 'difference between an L1 hit and a trip to DRAM — comfortably measurable from '
      + 'ordinary user code.';
  }

  function paintAttack(view) {
    Table.paint('chan-attack', view.run.found.rows.map(function (row) {
      const votes = Object.keys(row.votes).map(function (value) {
        return row.votes[value];
      }).sort(function (left, right) { return right - left; })[0] || 0;

      return [row.at, row.expected, row.guessed,
        { value: row.correct ? 'yes' : 'no', className: row.correct ? 'good' : 'bad' },
        votes + ' of ' + view.rounds];
    }), 'One row per character of the secret, each recovered by ' + view.rounds
      + ' independent rounds and a majority vote. The vote column is the confidence: a '
      + 'character carried by 30 of 31 rounds is not a lucky guess, and one carried by 3 is. '
      + 'An attacker with no time limit simply raises the round count, which is why "the '
      + 'channel is noisy" has never been a defence.');
  }

  function paintRounds(view) {
    Table.paint('chan-rounds-table', ROUNDS.map(function (rounds) {
      return [rounds].concat(MITIGATIONS.map(function (mitigation) {
        const found = reliability({ mitigation: mitigation, noise: view.options.noise,
          train: view.options.train }, rounds);

        return (100 * found.mean).toFixed(1) + '%';
      }));
    }), 'Mean over eight seeds, so the numbers mean something — a single run of an '
      + 'eight-character secret is eight Bernoulli trials and will happily report 12.5% for a '
      + 'channel that is at chance. Unmitigated, repetition takes the channel from chance to '
      + 'complete recovery. With the barrier it stays at chance however many rounds are '
      + 'spent, which is the assertion the test suite makes: the mitigation does not make the '
      + 'attack slower, it removes the signal.');
  }

  function paintMitigations() {
    Table.paint('chan-mitigations', MITIGATION_ROWS.map(function (row) {
      return [row.name, row.stops, row.leak, row.cost];
    }), 'Neither mitigation tries to undo anything, and that is the point of the pair. The '
      + 'barrier prevents the access; the mask prevents the out-of-bounds address from '
      + 'existing. Rolling back is what the machine already does perfectly well, and it is '
      + 'not where the leak was. Note the masking row: the channel still works, it just '
      + 'carries public data — which is the correct mental model for what a mitigation '
      + 'achieves.');
  }

  function paintReceivers(view) {
    const probed = Lab.primeProbe(Lab.create(view.options), 0);
    const ambiguity = Lab.ambiguity(view.run.lab);

    Table.paint('chan-receivers', RECEIVERS.map(function (row, at) {
      return [row.name, row.needs, row.recovers,
        at === 0 ? view.run.found.recovered : probed.candidates.join('') +
          ' (the answer is ' + probed.expected + ')',
        at === 0 ? 'none' : ambiguity.worst + ' values share the busiest set'];
    }), 'Prime+Probe recovers a candidate list rather than a value, and on a cache with more '
      + 'possible values than sets it always will: 16 values over 8 sets means every reading '
      + 'has at least two answers. Real caches are worse — 256 possible byte values over 64 '
      + 'sets — which is why Prime+Probe is usually one stage of an attack rather than the '
      + 'whole of it. It is also the one that works between two SMT threads with nothing '
      + 'shared but the core.');
  }

  function paintSteps() {
    Table.paint('chan-steps', STEPS.map(function (row) {
      return [row.step, row.arch, row.cacheState, row.recoverable];
    }), 'Read the fourth row twice. Everything the architecture promises has been kept: the '
      + 'registers are freed, the instructions squashed, the state precise. The machine is '
      + 'correct. The secret is already outside, in a column the correctness argument never '
      + 'mentioned.');
  }

  function paintChart(app, view) {
    const host = root.jQuery('#chan-chart')[0];

    if (!host) return;
    if (chart) chart.destroy();
    chart = root.GrowthPlot.render(host, { lazyLib: app.lazyLib, height: 260,
      xLabel: 'rounds per character', yLabel: 'mean recovery rate',
      series: MITIGATIONS.map(function (mitigation) {
        return { label: mitigation, points: ROUNDS.map(function (rounds) {
          return { x: rounds, y: reliability({ mitigation: mitigation,
            noise: view.options.noise, train: view.options.train }, rounds).mean };
        }) };
      }) });
    root.Helpers.setText('chan-chart-note', 'Three curves at ' +
      (100 * view.options.noise).toFixed(0) + '% noise. The unmitigated one climbs from '
      + 'chance to complete recovery as the attacker spends more time, which is what a noisy '
      + 'channel with repetition always does. The other two are flat lines near chance and '
      + 'stay flat however long the attacker waits — the difference between a channel that is '
      + 'slow and a channel that is not there.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
