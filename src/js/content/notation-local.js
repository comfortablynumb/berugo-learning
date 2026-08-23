/**
 * Section-scoped notation overrides.
 *
 * A Greek letter is a variable, and the glossary's global entry for one has to
 * hedge — α is the load factor in hashing and the inverse Ackermann function in
 * union-find, and a chip that lists both is a chip that answers neither. Where
 * a section pins a letter to exactly one meaning, it is named here and that
 * meaning wins wherever that section renders.
 *
 * Add an entry when a section uses a letter in a fixed sense throughout. Leave
 * it out when the section genuinely uses the letter for more than one thing —
 * the hedged global entry is the honest answer there.
 */
(function (root) {
  'use strict';

  const Notation = root ? root.Notation : require('./notation.js');

  const LOAD_FACTOR = {
    'α': {
      reads: 'alpha, the load factor',
      means: 'How full the table is: entries divided by slots. At α = 0.5 half the slots are ' +
        'occupied; at α = 0.9 the probe counts start climbing sharply, which is why tables grow ' +
        'well before they are full.'
    }
  };

  ['hash-functions', 'universal-hashing', 'separate-chaining', 'open-addressing',
    'robin-hood', 'swiss-tables', 'rehashing', 'hash-in-practice'].forEach(function (id) {
    Notation.registerLocal(id, LOAD_FACTOR);
  });

  Notation.registerLocal('scapegoat-trees', {
    'α': {
      reads: 'alpha, the balance parameter',
      means: 'How lopsided a node is allowed to get before the subtree under it is rebuilt: a ' +
        'child may hold at most this fraction of the subtree. It sits between ½ and 1, and moving ' +
        'it towards 1 tolerates a deeper tree in exchange for rebuilding less often.'
    }
  });

  Notation.registerLocal('disjoint-sets', {
    'α': {
      reads: 'alpha, the inverse Ackermann function',
      means: 'A function that grows so slowly it is below 5 for any n that could be stored on any ' +
        'machine that will ever be built. Not constant in theory, indistinguishable from constant ' +
        'in practice.'
    }
  });

  Notation.registerLocal('perfect-hashing', {
    'λ': {
      reads: 'lambda, the bucket load',
      means: 'The average number of keys per bucket in the first hashing round. It sets how many ' +
        'buckets there are — more keys per bucket means a smaller displacement table, and a ' +
        'harder search for a displacement that works.'
    }
  });
}(typeof window !== 'undefined' ? window : null));
