/**
 * OooLab - the measurement layer the nine M36 sections share.
 *
 * Every section here runs the same core over the same programs and asks it a
 * different question, so the runs have to be cached and they have to be cached
 * in one place. Nine sections each memoising their own runs would be nine
 * chances for two pages to quote different numbers for the same configuration,
 * which is the failure this file exists to prevent.
 *
 * The cache key is `JSON.stringify` of the name and the options rather than a
 * concatenation, because an option value can contain any character a separator
 * might use and a key collision here would silently show one program's numbers
 * under another program's name.
 *
 * The catalogue is the six matched-pair kernels from `machines/ooo/workloads.js`
 * plus four of M34's real programs. The pairs are what most of the milestone
 * measures - each pair has the same instruction count and differs in one
 * structural property - and the real programs are there so that no section
 * rests entirely on a fixture built to prove it.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.OooLab = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const Core = scope.OooCore;
  const Workloads = scope.Ooo.Workloads;
  const Trace = scope.Ooo.Trace;
  const Ilp = scope.IlpAnalysis;
  const Topdown = scope.Topdown;
  const Assembler = scope.Brv32.Assembler;
  const Programs = scope.Brv32.Programs;

  /** A cache small enough to hold every program at every width, which is what
   *  a control sweep asks for and what a demo must not recompute per keystroke. */
  const cache = {};

  function cached(kind, key, compute) {
    const full = kind + ' ' + JSON.stringify(key);

    if (!(full in cache)) cache[full] = compute();
    return cache[full];
  }

  /* ------------------------------------------------------------- catalogue */

  const REAL = ['sum', 'factorial', 'arrayMax', 'strlen'];

  const ABOUT = {
    sum: 'a counted loop adding 1 to 10',
    factorial: 'recursion, with calls and returns',
    arrayMax: 'a scan over an array in memory',
    strlen: 'byte loads until a zero'
  };

  function catalogue() {
    const out = {};

    Workloads.names().forEach(function (name) {
      const entry = Workloads.get(name);

      out[name] = { title: entry.title, about: entry.about, pair: entry.pair,
        source: entry.source, kind: 'fixture' };
    });
    REAL.forEach(function (name) {
      out[name] = { title: name, about: ABOUT[name], pair: null,
        source: Programs.CATALOGUE[name].source, kind: 'program' };
    });
    return out;
  }

  const CATALOGUE = catalogue();

  function names() {
    return Object.keys(CATALOGUE);
  }

  /**
   * Short labels for chart axes, written out rather than truncated.
   *
   * Slicing the names to a fixed width collides `hiddenAlias` with
   * `hiddenDisjoint`, and a band scale with a duplicate key silently stacks
   * two bars on top of each other: the chart loses bars and still looks
   * plausible, which is the worst way for a picture to be wrong.
   */
  const SHORT = { chain: 'chain', independent: 'indep', stride: 'stride', chase: 'chase',
    alias: 'alias', disjoint: 'disjnt', hiddenAlias: 'hidAls', hiddenDisjoint: 'hidDsj',
    sum: 'sum', factorial: 'fact', arrayMax: 'arrMax', strlen: 'strlen' };

  function shortName(name) {
    return SHORT[name] || name;
  }

  function get(name) {
    return CATALOGUE[name] || null;
  }

  /** The options list every program selector in the milestone uses, so no two
   *  sections disagree about what a kernel is called. */
  function programOptions(only) {
    return (only || names()).map(function (name) {
      return { value: name, label: name + ' — ' + CATALOGUE[name].about };
    });
  }

  function pairs() {
    const seen = {};

    return names().filter(function (name) {
      const entry = CATALOGUE[name];

      if (!entry.pair || seen[entry.pair]) return false;
      seen[name] = true;
      return true;
    }).map(function (name) {
      return { left: name, right: CATALOGUE[name].pair };
    });
  }

  /* ----------------------------------------------------------------- runs */

  function imageFor(name) {
    return cached('image', name, function () {
      return Assembler.assemble(CATALOGUE[name].source, { origin: 0 }).bytes;
    });
  }

  /**
   * One run of one program under one configuration.
   *
   * The cycle budget is generous rather than tuned: a pointer chase on a small
   * cache is four hundred cycles and a budget that cut it short would report a
   * lower cycle count for a slower machine, which is the wrong direction for
   * every conclusion on these pages.
   */
  function run(name, options) {
    return cached('run', [name, options || {}], function () {
      const core = Core.create(Object.assign({ image: imageFor(name), entry: 0 },
        options || {}));

      Core.run(core, { cycles: 20000, stopOnTrap: true });
      return { core: core, summary: Core.summary(core) };
    });
  }

  function summary(name, options) {
    return run(name, options).summary;
  }

  function trace(name) {
    return cached('trace', name, function () {
      return Trace.of({ image: imageFor(name), entry: 0 });
    });
  }

  function ilp(name, options) {
    return cached('ilp', [name, options || {}], function () {
      return Ilp.analyse(trace(name).rows, options || {});
    });
  }

  function topdown(name, options) {
    return cached('topdown', [name, options || {}], function () {
      return Topdown.classify(run(name, options).core);
    });
  }

  /* --------------------------------------------------------------- sweeps */

  const WIDTHS = [1, 2, 4, 8];

  /** The same program at every issue width, which is the picture 36.4 is
   *  about and which three other sections quote. */
  function widthSweep(name, options) {
    return WIDTHS.map(function (width) {
      const found = summary(name, Object.assign({}, options, { width: width }));

      return { width: width, cycles: found.cycles, ipc: found.ipc,
        portConflicts: found.scheduler.portConflicts,
        dispatchStalls: found.dispatchStalls, retired: found.retired };
    });
  }

  /**
   * Why this configuration stopped going faster.
   *
   * The top-down category is the honest answer and the port count is the
   * detail underneath it, so both are reported rather than one being guessed
   * from the other.
   */
  function limitFor(name, options) {
    const found = topdown(name, options);
    const measured = summary(name, options);
    const bound = ilp(name, { unitLatency: true });

    if (measured.ipc >= bound.ilp - 1e-9) {
      return { name: 'the dependence chain', detail: 'the code has no more parallelism in it' };
    }
    return { name: found.dominant.name,
      detail: found.dominant.detail.length ? found.dominant.detail[0].reason
        : found.dominant.about };
  }

  /** A sweep over any single option, which four sections need and none of them
   *  should implement twice. */
  function sweep(name, option, values, base) {
    return values.map(function (value) {
      const options = Object.assign({}, base || {});

      options[option] = value;
      const found = summary(name, options);

      return { value: value, cycles: found.cycles, ipc: found.ipc, summary: found };
    });
  }

  return { CATALOGUE: CATALOGUE, WIDTHS: WIDTHS, SHORT: SHORT, names: names,
    get: get, shortName: shortName,
    programOptions: programOptions, pairs: pairs, imageFor: imageFor, run: run,
    summary: summary, trace: trace, ilp: ilp, topdown: topdown,
    widthSweep: widthSweep, limitFor: limitFor, sweep: sweep };
}));
