/** Worked examples for minimisation, closure, non-regularity and transducers (M24.5-M24.8). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'minimisation-and-canonical-forms': [
      {
        title: 'Four routes to the same minimal machine',
        goal: 'Check three minimisation algorithms against a reference that never builds a machine.',
        setup: 'The 5-state DFA the subset construction produces for (a|b)*abb.',
        steps: [
          { do: 'Start refinement from the coarsest partition that could be right.',
            why: 'Accepting and rejecting states are separated by the empty suffix.',
            work: 'round 0: 2 blocks' },
          { do: 'Split any block whose members send a symbol into different blocks.',
            why: 'That symbol is the witness that they are different states.',
            work: 'round 1: 3 blocks, split on b; round 2: 4 blocks, split on b again' },
          { do: 'Stop when a round splits nothing.',
            why: 'The partition is then stable and is the answer.',
            work: 'round 3: still 4 blocks' },
          { do: 'Run Hopcroft and Brzozowski on the same machine.',
            why: 'Three algorithms agreeing is worth more than one asserting.',
            work: 'both return 4 states' },
          { do: 'Compute the Myhill–Nerode classes straight from the language.',
            why: 'This reference never looks at a machine, so it cannot share a bug with one.',
            work: '4 classes — all four numbers agree' }
        ],
        answer: 'Five states become four, and four independent computations agree on that number. ' +
          'Refinement took 3 rounds, and the classes computed from the language alone confirm ' +
          'the result.'
      },
      {
        title: 'The case that inverts it: the off-by-one that makes correct algorithms disagree',
        goal: 'Show that "minimal" needs a convention, and that mixing conventions looks like a bug.',
        setup: 'The language a*b*, minimised once as a total machine and once trimmed.',
        steps: [
          { do: 'Determinise the pattern and count.',
            why: 'The subset construction is the starting point for every algorithm here.',
            work: '4 states' },
          { do: 'Minimise as a TOTAL machine, keeping the trap.',
            why: 'Myhill–Nerode partitions all of Σ*, so the dead prefixes are a class of their ' +
              'own.',
            work: '3 states: seen only a, seen a b, and everything after a stray a' },
          { do: 'Minimise and then trim, dropping the trap.',
            why: 'A trimmed machine has no state from which nothing is accepted.',
            work: '2 states for the same language' },
          { do: 'Count the equivalence classes over every prefix, including the dead ones.',
            why: 'The oracle must use the same convention as the algorithm.',
            work: '3 classes — matching the total machine' },
          { do: 'See what happens when the conventions are mixed.',
            why: 'This is the failure that looks like a broken algorithm.',
            work: '2 states against 3 classes — a false "not minimal"' }
        ],
        answer: 'The language a*b* has a 3-state minimal total machine and a 2-state minimal ' +
          'trimmed one, and both are correct. Comparing one against the other is the off-by-one ' +
          'that makes three correct algorithms appear to disagree — and (a|b)*abb hides it ' +
          'entirely, because that language has no dead prefix and both conventions give 4.'
      }
    ],

    'closure-and-the-product': [
      {
        title: 'Deciding containment with a witness',
        goal: 'Answer "does A match anything B does not" by construction rather than by testing.',
        setup: 'A = (a|b)*abb and B = (a|b)*b, both minimised over the alphabet {a, b}.',
        steps: [
          { do: 'Complement B.',
            why: 'Determinise and complete first, or the flip accepts everything that fell off ' +
              'the end.',
            work: 'B has 2 states; its complement is total with the same 2' },
          { do: 'Build the product of A with complement(B).',
            why: 'The result accepts exactly what A accepts and B does not.',
            work: '5 reachable pairs out of a possible 8' },
          { do: 'Search for the shortest accepted word.',
            why: 'Emptiness is reachability, and the path is the counter-example.',
            work: 'no accepting state is reachable in 5 pairs — the language is empty' },
          { do: 'Conclude, and check the other direction.',
            why: 'Equivalence needs containment both ways.',
            work: 'A ⊆ B holds with 0 counter-examples; B ⊆ A fails' },
          { do: 'Take the witness from the failing direction and run both originals on it.',
            why: 'A bug in the complement or the product would give a confident wrong witness.',
            work: '"b": B accepts, A rejects — 1 character' }
        ],
        answer: 'A is contained in B, they are not equivalent, and the shortest string proving it ' +
          'is "b" — produced by the construction and confirmed by running both original machines ' +
          'on it.'
      },
      {
        title: 'The case that inverts it: one construction, four answers',
        goal: 'Show that only the accepting rule changes between the Boolean operations.',
        setup: 'The same A and B, with all four Boolean operations built from one set of pairs.',
        steps: [
          { do: 'Build the reachable pairs once.',
            why: 'This is the expensive part and it is shared.',
            work: '5 pairs, identical for all four operations' },
          { do: 'Take intersection: accept when both components accept.',
            why: 'One accepting rule over the same graph.',
            work: 'shortest word "abb", 3 characters' },
          { do: 'Take union: accept when either does.',
            why: 'Same graph, different rule.',
            work: 'shortest word "b", 1 character' },
          { do: 'Take difference: accept when the first does and the second does not.',
            why: 'This is the containment construction.',
            work: 'empty — 0 strings that A accepts are outside B' },
          { do: 'Take symmetric difference: accept when exactly one does.',
            why: 'Empty exactly when the two languages are equivalent.',
            work: 'shortest word "b", 1 character — so they are not equivalent' }
        ],
        answer: 'Four operations, 5 states each, one construction. The state counts are identical ' +
          'because only the accepting set differs, which is why difference and symmetric ' +
          'difference come free once intersection exists.'
      }
    ],

    'proving-non-regularity': [
      {
        title: 'Playing the pumping game against aⁿbⁿ',
        goal: 'Beat every decomposition the adversary may choose, and count them.',
        setup: 'The language aⁿbⁿ, with the adversary\'s pumping length fixed at 4.',
        steps: [
          { do: 'Choose the word, knowing the adversary picked p = 4.',
            why: 'The choice is the skill: it must constrain where y can sit.',
            work: 'w = aaaabbbb, length 8' },
          { do: 'Enumerate every split with |xy| ≤ 4 and |y| ≥ 1.',
            why: 'The claim quantifies over all of them, not over a convenient one.',
            work: '10 decompositions' },
          { do: 'Note where the constraint forces y.',
            why: 'This is why the word was chosen.',
            work: '|xy| ≤ 4 puts y entirely inside the run of a' },
          { do: 'Find an exponent that escapes for each split.',
            why: 'Pumping changes the count of a and never the count of b.',
            work: 'i = 0 works for most; every split escapes at some i ≤ 3' },
          { do: 'Count the survivors.',
            why: 'One survivor loses the round.',
            work: '0 of 10 — the language is not regular' }
        ],
        answer: 'All 10 decompositions can be pumped out of the language, so aⁿbⁿ is not regular. ' +
          'Deleting the pumped block — i = 0 — defeats most of them, which is usually easier ' +
          'than repeating it.'
      },
      {
        title: 'The case that inverts it: the same tools on a language that IS regular',
        goal: 'Show what it looks like when a proof technique correctly declines.',
        setup: 'The language of strings with an even number of a, run through both tools with ' +
          'the same budgets.',
        steps: [
          { do: 'Pick a word of length at least p = 4 and enumerate the splits.',
            why: 'Same procedure, same word length.',
            work: 'w = aaaaaaaa, 10 decompositions' },
          { do: 'Try to pump each one out of the language.',
            why: 'The language survives whenever the pumped block has even length.',
            work: '4 of 10 splits survive every exponent' },
          { do: 'Conclude what the lemma proves.',
            why: 'A surviving split means the argument fails, and a failed argument proves ' +
              'nothing.',
            work: 'no conclusion from 4 survivors — and the language is in fact regular' },
          { do: 'Build a distinguishing family of 6 prefixes and look for witnesses.',
            why: 'Myhill–Nerode answers in both directions.',
            work: '9 of 15 pairs have a witness; the other 6 do not' },
          { do: 'Read what the missing witnesses mean.',
            why: 'Prefixes with no separating suffix are the same state.',
            work: 'the family collapses to 2 classes — which is the minimal machine' }
        ],
        answer: 'The pumping lemma declines with 4 surviving splits, and Myhill–Nerode not only ' +
          'declines but hands back the answer: 2 equivalence classes, which is the 2-state ' +
          'machine for even parity.'
      }
    ],

    transducers: [
      {
        title: 'Composing two text machines into one pass',
        goal: 'Build a machine that folds case and collapses spaces in a single traversal.',
        setup: 'A case folder over 54 symbols and a space collapser over the lowercase alphabet.',
        steps: [
          { do: 'Count the states of each machine alone.',
            why: 'Each remembers only what it needs.',
            work: 'case folder: 1 state; space collapser: 2 states' },
          { do: 'Compose them and count the reachable pairs.',
            why: 'The bound is the product; only reachable pairs are built.',
            work: '1 × 2 = 2 bound, 2 reachable' },
          { do: 'Run the composed machine on a sample.',
            why: 'Deletions make the output shorter than the input.',
            work: '"Hello   World ." → "hello world .", 15 characters in and 13 out' },
          { do: 'Run the same input through both machines in sequence.',
            why: 'The composition must be the same function, not an approximation.',
            work: 'identical output, 13 characters both ways' },
          { do: 'Repeat over a generated corpus.',
            why: 'Hand-written samples exercise only the cases the author thought of.',
            work: '4 samples plus 200 generated strings: 204 of 204 agreements' }
        ],
        answer: 'A 2-state composed machine reproduces the chained result on all 204 inputs, ' +
          'reading the text once instead of twice and never materialising the intermediate ' +
          'string.'
      },
      {
        title: 'The case that inverts it: what Moore form costs',
        goal: 'Show why Mealy is smaller and Moore is easier to reason about.',
        setup: 'The same case folder, converted from Mealy form to Moore form.',
        steps: [
          { do: 'Count the Mealy machine.',
            why: 'The output depends on what was just read, not on where you are.',
            work: '1 state' },
          { do: 'Ask how many distinct outputs arrive at that state.',
            why: 'Moore must split a state per distinct arriving output.',
            work: '28 distinct outputs — 26 lowercase letters, a space and a full stop' },
          { do: 'Convert and count.',
            why: 'One state per (origin, output) pair that is actually reachable.',
            work: '29 states' },
          { do: 'Check the conversion preserves the function.',
            why: 'A Moore machine emits one extra symbol for its start state.',
            work: '"AbC" → "abc" in both forms, 3 characters each' },
          { do: 'State when the larger form is worth it.',
            why: 'The output being a property of the state is the whole advantage.',
            work: '29 states, but you can point at one and say what it emits' }
        ],
        answer: 'The same transducer is 1 state as Mealy and 29 as Moore, because Moore splits a ' +
          'state per distinct output. Hardware and protocol specifications pay that cost for the ' +
          'readability; text processing does not.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
