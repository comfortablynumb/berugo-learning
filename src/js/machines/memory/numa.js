/**
 * MemoryNuma - several memory nodes, and the allocation rule that decides
 * which one your data ends up on.
 *
 * On a multi-socket machine, and increasingly inside one socket, memory is
 * attached to a node and reaching another node's memory costs more. The whole
 * of NUMA tuning is one sentence: allocate where you will use it. The whole of
 * NUMA trouble is that the default policy - first touch - allocates a page on
 * the node of the thread that first WRITES it, which is very often not the
 * thread that will read it a million times afterwards.
 *
 * The classic mistake has a specific shape and it is worth being able to
 * recognise: a large buffer initialised in one thread and then divided between
 * workers. Every page is on the initialising thread's node, so every worker
 * but one is remote for the whole run. A parallel-for over a freshly allocated
 * array does exactly this by default, and the resulting slowdown looks like a
 * scaling problem rather than an allocation one.
 *
 * The model here is deliberately about placement rather than about coherence.
 * Two nodes reading the same line is M38's problem, and pretending to model it
 * here would be a worse lesson than leaving it out.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Memory = scope.Memory || {};
    scope.Memory.Numa = api;
  }
}(this, function () {
  'use strict';

  const POLICIES = {
    firstTouch: { name: 'first touch',
      about: 'the page lands on the node of the thread that touches it first - the default, '
        + 'and the source of the classic mistake' },
    interleave: { name: 'interleaved',
      about: 'pages are spread round-robin across nodes: worse latency for everyone, better '
        + 'aggregate bandwidth, and no thread is unlucky' },
    localAlloc: { name: 'local to the user',
      about: 'what you would get if every thread allocated the pages it was going to use, '
        + 'which is the thing the rule tells you to arrange' }
  };

  const DEFAULTS = { nodes: 2, pageBytes: 4096, localCycles: 80, remoteCycles: 140,
    policy: 'firstTouch', migrate: false, migrateAfter: 8 };

  function create(options) {
    const settings = Object.assign({}, DEFAULTS, options || {});

    return { settings: settings, pages: {}, counters: { accesses: 0, local: 0, remote: 0,
      cycles: 0, migrations: 0, allocations: 0 } };
  }

  function pageOf(numa, address) {
    return Math.floor(address / numa.settings.pageBytes);
  }

  function costOf(numa, home, node) {
    return home === node ? numa.settings.localCycles : numa.settings.remoteCycles;
  }

  /**
   * Where a page is placed the first time anybody touches it.
   *
   * Under first touch that is the toucher's node, which is correct exactly
   * when the first toucher is also the eventual user. Under interleaving it is
   * the page number modulo the node count, which nobody is happy with and
   * nobody is starved by.
   */
  function place(numa, page, node) {
    if (numa.settings.policy === 'interleave') return page % numa.settings.nodes;
    return node;
  }

  /**
   * One access by a thread pinned to `node`. Returns the cost and whether it
   * was local, and - if migration is on - moves a page whose accesses have
   * been persistently remote.
   */
  function access(numa, request) {
    const page = pageOf(numa, request.address);
    const node = request.node || 0;
    let home = numa.pages[page];

    numa.counters.accesses += 1;
    if (home === undefined) {
      home = place(numa, page, node);
      numa.pages[page] = home;
      numa.counters.allocations += 1;
      numa.remoteRun = numa.remoteRun || {};
    }
    const local = home === node;
    const cost = costOf(numa, home, node);

    numa.counters[local ? 'local' : 'remote'] += 1;
    numa.counters.cycles += cost;
    if (numa.settings.migrate) migrate(numa, page, node, local);
    return { page: page, home: home, node: node, local: local, cycles: cost };
  }

  /**
   * Move a page to the node that keeps asking for it, after enough consecutive
   * remote accesses to be sure.
   *
   * The counter has to reset on a local access, and that is the whole
   * anti-thrash rule: two nodes alternating on one page would otherwise move
   * it back and forth forever, paying the migration cost on every access and
   * never getting a local one.
   */
  function migrate(numa, page, node, local) {
    numa.runs = numa.runs || {};
    if (local) { numa.runs[page] = null; return; }
    const run = numa.runs[page];

    if (!run || run.node !== node) {
      numa.runs[page] = { node: node, count: 1 };
      return;
    }
    run.count += 1;
    if (run.count < numa.settings.migrateAfter) return;
    numa.pages[page] = node;
    numa.runs[page] = null;
    numa.counters.migrations += 1;
  }

  /* ------------------------------------------------------------ workloads */

  /**
   * The classic mistake, and its fix, as one function.
   *
   * `initialiser` is the node that writes the buffer first. Set it to a single
   * node and every worker but that one is remote for the whole run; set it to
   * null and each worker touches its own chunk first, which is what "allocate
   * where you will use it" means in code.
   */
  function parallelFor(numa, options) {
    const settings = options || {};
    const pages = settings.pages || 64;

    if (settings.initialiser !== null && settings.initialiser !== undefined) {
      for (let page = 0; page < pages; page += 1) {
        access(numa, { address: page * numa.settings.pageBytes,
          node: settings.initialiser });
      }
    }
    /* The measurement starts here, after the initialisation.
       Counting the initialising pass in the locality figure flatters it: those
       accesses are local by construction under first touch, whoever did them,
       so including them reports 60% for a run in which every worker pass but
       one was remote. The number people care about is the steady state. */
    const before = { local: numa.counters.local, remote: numa.counters.remote,
      cycles: numa.counters.cycles, accesses: numa.counters.accesses };

    workerPasses(numa, settings, pages);
    return Object.assign(summary(numa), { steady: since(numa, before) });
  }

  function workerPasses(numa, settings, pages) {
    const workers = settings.workers || numa.settings.nodes;
    const chunk = Math.ceil(pages / workers);

    for (let pass = 0; pass < (settings.passes || 4); pass += 1) {
      for (let worker = 0; worker < workers; worker += 1) {
        const node = worker % numa.settings.nodes;

        for (let at = 0; at < chunk; at += 1) {
          const page = worker * chunk + at;

          if (page >= pages) break;
          access(numa, { address: page * numa.settings.pageBytes, node: node });
        }
      }
    }
  }

  /** The counters accumulated since a mark, so a warm-up or an initialisation
   *  pass can be excluded from the figure it would otherwise distort. */
  function since(numa, mark) {
    const accesses = numa.counters.accesses - mark.accesses;
    const local = numa.counters.local - mark.local;
    const cycles = numa.counters.cycles - mark.cycles;

    return { accesses: accesses, local: local,
      remote: numa.counters.remote - mark.remote,
      locality: accesses ? local / accesses : 0,
      cycles: cycles, average: accesses ? cycles / accesses : 0 };
  }

  /**
   * One node using a page another node allocated, over and over - which is
   * what migration exists for and what the alternating pattern is not.
   *
   * Both patterns are here because the heuristic has to get both right: move a
   * page that is persistently used from elsewhere, and refuse to move one that
   * two nodes are sharing. A rule that only passes the first test thrashes on
   * the second, paying the migration cost on every access.
   */
  function handoff(numa, options) {
    const settings = options || {};
    const pages = settings.pages || 16;
    const owner = settings.owner === undefined ? 0 : settings.owner;
    const user = settings.user === undefined ? 1 : settings.user;

    for (let page = 0; page < pages; page += 1) {
      access(numa, { address: page * numa.settings.pageBytes, node: owner });
    }
    const before = { local: numa.counters.local, remote: numa.counters.remote,
      cycles: numa.counters.cycles, accesses: numa.counters.accesses };

    for (let round = 0; round < (settings.rounds || 40); round += 1) {
      for (let page = 0; page < pages; page += 1) {
        access(numa, { address: page * numa.settings.pageBytes, node: user });
      }
    }
    return Object.assign(summary(numa), { steady: since(numa, before) });
  }

  /** Two nodes alternating on the same pages, which is the pattern a naive
   *  migration heuristic thrashes on. */
  function alternating(numa, options) {
    const settings = options || {};
    const pages = settings.pages || 8;

    for (let round = 0; round < (settings.rounds || 20); round += 1) {
      for (let page = 0; page < pages; page += 1) {
        access(numa, { address: page * numa.settings.pageBytes,
          node: round % numa.settings.nodes });
      }
    }
    return summary(numa);
  }

  function summary(numa) {
    const counters = numa.counters;
    const spread = {};

    Object.keys(numa.pages).forEach(function (page) {
      const home = numa.pages[page];

      spread[home] = (spread[home] || 0) + 1;
    });
    return { accesses: counters.accesses, local: counters.local, remote: counters.remote,
      locality: counters.accesses ? counters.local / counters.accesses : 0,
      cycles: counters.cycles,
      average: counters.accesses ? counters.cycles / counters.accesses : 0,
      migrations: counters.migrations, allocations: counters.allocations,
      spread: spread, policy: numa.settings.policy, nodes: numa.settings.nodes,
      localCycles: numa.settings.localCycles, remoteCycles: numa.settings.remoteCycles };
  }

  /** The latency matrix, which is the first thing to look at on an unfamiliar
   *  machine and the thing `numactl --hardware` prints. */
  function matrix(numa) {
    const rows = [];

    for (let from = 0; from < numa.settings.nodes; from += 1) {
      const row = [];

      for (let to = 0; to < numa.settings.nodes; to += 1) {
        row.push(costOf(numa, to, from));
      }
      rows.push({ node: from, costs: row });
    }
    return rows;
  }

  return { POLICIES: POLICIES, DEFAULTS: DEFAULTS, create: create, access: access,
    parallelFor: parallelFor, alternating: alternating, handoff: handoff,
    summary: summary, since: since, matrix: matrix, pageOf: pageOf };
}));
