/**
 * OooWorkloads - small BRV32 kernels chosen so that each one isolates exactly
 * one reason a modern core goes slowly.
 *
 * The programs in M34's catalogue were written to be *read*: they compute
 * something recognisable. These are written to be *measured*. Every pair here
 * has the same instruction count and differs in one structural property, which
 * is the only way to show that the property is what costs the cycles - if two
 * programs differ in length as well, the comparison proves nothing.
 *
 * - chain / independent: the same 32 additions, arranged as one dependence
 *   chain or as none at all. The gap is instruction-level parallelism.
 * - stride / chase: the same 32 loads over the same bytes, addressed from an
 *   induction variable or from the previous load result. The gap is
 *   memory-level parallelism.
 * - alias / disjoint: the same store/load pair, to the same address or to two
 *   addresses, both known immediately. The gap is store-to-load forwarding.
 * - hiddenAlias / hiddenDisjoint: the same shape with the STORE's address
 *   loaded from memory, so nobody knows it for many cycles. That is the pair
 *   that measures memory dependence speculation, and the plain alias/disjoint
 *   pair does not - with both addresses computed in the first cycle a load
 *   never has to guess, and switching speculation off changes nothing at all.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Ooo = scope.Ooo || {};
    scope.Ooo.Workloads = api;
  }
}(this, function (root) {
  'use strict';

  const Random = root && root.Random ? root.Random : require('../../utils/random.js');

  const STRIDE = 32;
  const NODES = 32;

  function repeat(count, make) {
    const out = [];

    for (let at = 0; at < count; at += 1) out.push(make(at));
    return out;
  }

  function zeros(count) {
    return repeat(count, function () { return 0; });
  }

  /** One dependence chain: every add reads the register the one before wrote,
   *  so no amount of width or window helps. */
  function chain(count) {
    return ['  # one chain: each add needs the previous result', '  li t0, 0']
      .concat(repeat(count, function () { return '  addi t0, t0, 1'; }))
      .concat(['  ecall']).join('\n');
  }

  /**
   * The same additions with no dependences - but written over four registers,
   * so the sequence is full of write-after-write pairs. That is deliberate: an
   * unrenamed machine sees those as hazards and serialises anyway, which makes
   * this the fixture that shows what renaming is worth.
   */
  function independent(count) {
    const names = ['t0', 't1', 't2', 't3'];

    return ['  # no chain at all, but every register is written eight times']
      .concat(repeat(count, function (at) {
        return '  addi ' + names[at % names.length] + ', zero, ' + (at + 1);
      }))
      .concat(['  ecall']).join('\n');
  }

  /** A strided walk. Each address comes from the induction variable, so the
   *  loads are independent and their misses overlap. */
  function stride(nodes) {
    return ['  # one load per line, addresses known well in advance',
      '  la a0, buffer', '  li a1, ' + nodes, '  li a2, 0',
      'loop:', '  lw t0, 0(a0)', '  add a2, a2, t0',
      '  addi a0, a0, ' + STRIDE, '  addi a1, a1, -1', '  bnez a1, loop',
      '  ecall', 'buffer:', '  .word ' + strideData(nodes).join(', ')].join('\n');
  }

  function strideData(nodes) {
    const words = [];

    for (let at = 0; at < nodes * (STRIDE / 4); at += 1) words.push(at % 97);
    return words;
  }

  /**
   * The same bytes, walked as a list: the next address is the value the last
   * load returned, so the misses cannot overlap however large the window is.
   */
  function chase(nodes, seed) {
    return ['  # the next address is the result of the last load',
      '  la a0, nodes', '  li t0, 0', '  li a1, ' + nodes, '  li a2, 0',
      'loop:', '  add t1, a0, t0', '  lw t0, 0(t1)', '  addi a1, a1, -1',
      '  bnez a1, loop', '  ecall',
      'nodes:', '  .word ' + chaseData(nodes, seed).join(', ')].join('\n');
  }

  /**
   * A single cycle through every node in a shuffled order, stored as byte
   * offsets from the base so the data needs no relocation. Each word holds the
   * offset of its successor; every successor is a different cache line.
   */
  function chaseData(nodes, seed) {
    const random = Random.seeded(seed === undefined ? 7 : seed);
    const order = random.shuffle(repeat(nodes, function (at) { return at; }));
    const words = zeros(nodes * (STRIDE / 4));

    order.forEach(function (node, at) {
      const next = order[(at + 1) % order.length];

      words[node * (STRIDE / 4)] = next * STRIDE;
    });
    return words;
  }

  /** A store and a load to the same address: the load must wait or forward,
   *  and speculating cannot help because the dependence is real. */
  function alias(count) {
    return ['  # the load always reads what the store just wrote',
      '  la a0, buffer', '  li a1, ' + count, '  li t0, 7', '  li a2, 0',
      'loop:', '  sw t0, 0(a0)', '  lw t1, 0(a0)', '  add a2, a2, t1',
      '  addi t0, t0, 1', '  addi a1, a1, -1', '  bnez a1, loop',
      '  ecall', 'buffer:', '  .word ' + zeros(32).join(', ')].join('\n');
  }

  /** The same shape with the load reading a different line. Conservative
   *  ordering still makes it wait; speculation lets it go. */
  function disjoint(count) {
    return ['  # the load can never alias the store, but only speculation knows that',
      '  la a0, buffer', '  addi a3, a0, 64', '  li a1, ' + count, '  li t0, 7',
      '  li a2, 0',
      'loop:', '  sw t0, 0(a0)', '  lw t1, 0(a3)', '  add a2, a2, t1',
      '  addi t0, t0, 1', '  addi a1, a1, -1', '  bnez a1, loop',
      '  ecall', 'buffer:', '  .word ' + repeat(32, function () { return 3; }).join(', ')]
      .join('\n');
  }

  /**
   * The store's address is loaded from memory, so a younger load cannot know
   * whether it aliases until that load returns.
   *
   * This is the shape memory dependence speculation exists for, and it is
   * unfortunately not the shape of the simple alias/disjoint pair: there both
   * addresses come from registers that are ready in the first cycle, the store
   * resolves before the load is even selected, and there is nothing to guess.
   * A demo built on that pair measures a control that does nothing.
   *
   * The offsets table decides whether the store lands on the load's address.
   * All zeros and it always aliases; a large offset and it never does. The
   * instruction counts are identical, and so is every other property of the
   * two programs.
   */
  function hidden(count, offset) {
    return ['  # the store address is loaded from memory: nobody knows it for a while',
      '  la a0, offsets', '  la a4, buffer', '  li a1, ' + count, '  li t0, 9', '  li a5, 0',
      'loop:', '  lw a2, 0(a0)', '  add a3, a4, a2', '  sw t0, 0(a3)', '  lw t1, 0(a4)',
      '  add a5, a5, t1', '  addi a0, a0, 4', '  addi a1, a1, -1', '  bnez a1, loop',
      '  ecall',
      'offsets:', '  .word ' + repeat(count, function () { return offset; }).join(', '),
      'buffer:', '  .word ' + repeat(64, function () { return 3; }).join(', ')].join('\n');
  }

  const CATALOGUE = {
    chain: { title: 'dependence chain', pair: 'independent',
      about: '32 additions, each waiting on the one before',
      source: chain(32) },
    independent: { title: 'independent adds', pair: 'chain',
      about: 'the same 32 additions with no true dependence, over four names',
      source: independent(32) },
    stride: { title: 'strided walk', pair: 'chase',
      about: 'one load per cache line, addresses from an induction variable',
      source: stride(NODES) },
    chase: { title: 'pointer chase', pair: 'stride',
      about: 'the same lines, each address loaded from the line before',
      source: chase(NODES) },
    alias: { title: 'store then load, same address', pair: 'disjoint',
      about: 'a real dependence that forwarding satisfies without touching memory',
      source: alias(8) },
    disjoint: { title: 'store then load, different address', pair: 'alias',
      about: 'no dependence at all, invisible until both addresses are known',
      source: disjoint(8) },
    hiddenAlias: { title: 'the store address arrives late, and it collides', pair: 'hiddenDisjoint',
      about: 'a load that guesses it may go, and is wrong every iteration',
      source: hidden(8, 0) },
    hiddenDisjoint: { title: 'the store address arrives late, and it misses', pair: 'hiddenAlias',
      about: 'the same code where guessing is right, and worth 1.5x',
      source: hidden(8, 128) }
  };

  function names() {
    return Object.keys(CATALOGUE);
  }

  function get(name) {
    return CATALOGUE[name] || null;
  }

  return { CATALOGUE: CATALOGUE, STRIDE: STRIDE, NODES: NODES, names: names, get: get,
    chain: chain, independent: independent, stride: stride, chase: chase,
    hidden: hidden,
    chaseData: chaseData, alias: alias, disjoint: disjoint };
}));
