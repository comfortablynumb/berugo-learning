/** Worked examples for integer representation, bit tricks and bitsets (M17.1-M17.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'integer-representation': [
      {
        title: 'Two flags from one adder, and which one was your bug',
        goal: 'Add the same pair of operands at one width and read both flags, so that "it ' +
          'overflowed" becomes a statement about which range was left.',
        setup: 'An eight-bit width with the demo’s default operands, a = 100 and b = 100, read ' +
          'once as signed and once as unsigned.',
        steps: [
          {
            do: 'Compute the exact answer before narrowing it.',
            why: 'Every overflow question is a comparison between the true value and a range, and ' +
              'doing it in the other order is how the two flags get confused.',
            work: 'a + b = 200, exactly, with no width involved',
            result: 'one number to compare against two different ranges'
          },
          {
            do: 'Compare 200 against the unsigned range 0 … 255.',
            why: 'That comparison is what the carry flag reports.',
            work: '200 is inside 0 … 255, so carry is not raised',
            result: 'as an unsigned addition this did not overflow at all'
          },
          {
            do: 'Compare 200 against the signed range −128 … 127.',
            why: 'That comparison is what the overflow flag reports.',
            work: '200 is above 127, so overflow IS raised',
            result: 'the demo reads "overflow only" — the two flags disagree on one addition'
          },
          {
            do: 'Read what the width actually stored, and what each policy would have given.',
            why: 'The stored value is the same under every policy that stores anything; the ' +
              'policies differ only in what they do about the flag.',
            work: 'wrapping −56, saturating 127, checked refuses to answer',
            result: 'only the third of those can be handled by the caller'
          },
          {
            do: 'Repeat with the multiplication the demo also shows.',
            why: 'To see the flags land the other way round.',
            work: 'a × b = 10 000 raises carry AND overflow; wrapping gives 16, saturating gives 127',
            result: 'both flags on one operation and neither on the subtraction beside it'
          }
        ],
        answer: 'One adder raised both flags and the hardware could not know which was the error — ' +
          'the types in the source decide that, and they exist only in the source. At eight bits ' +
          '100 + 100 overflows without carrying, and 0xFF + 0x01 carries without overflowing: the ' +
          'two are genuinely independent, and a check written against the wrong one passes for ' +
          'exactly the inputs it was written to catch. Of the four operations the demo runs, 2 ' +
          'leave the range and 2 do not.'
      },
      {
        title: 'Choosing a width from a requirement, and paying for the asymmetry',
        goal: 'Invert the first example: instead of reading the flags a width raises, pick the ' +
          'width from what the values need — and find the one value the choice cannot hold.',
        setup: 'A counter that must hold values from −2 000 to +2 000, in a format that will be ' +
          'sent over the wire and negated somewhere in the middle.',
        steps: [
          {
            do: 'Reject the eight-bit width by range alone.',
            why: 'The range is the first filter and it is arithmetic, not judgement.',
            work: 'int8 spans −128 … 127, which is short of 2 000 by more than an order of magnitude',
            result: 'sixteen bits is the smallest signed width that fits'
          },
          {
            do: 'Confirm sixteen bits, and note how much headroom is left.',
            why: 'Headroom is what decides whether a later requirement change is a data migration.',
            work: 'int16 spans −32 768 … 32 767, so 2 000 uses about 6% of the range',
            result: 'the width is not marginal, which is the whole reason to check'
          },
          {
            do: 'Ask what negation does at the bottom of the range.',
            why: 'The requirement said the value gets negated, and negation is not a total function.',
            work: 'negating −32 768 at int16 gives −32 768, because +32 768 is not representable',
            result: 'one input in 65 536 makes `-x` return a negative number'
          },
          {
            do: 'Decide whether that input can occur, and write the decision down.',
            why: 'A bound that is not written down is a bound that a later change silently removes.',
            work: 'the stated range −2 000 … 2 000 excludes it with a margin of 30 768',
            result: 'the asymmetry is unreachable here, and that is a property of the requirement'
          },
          {
            do: 'Fix the byte order at the boundary, since the value crosses a wire.',
            why: 'Endianness is a property of the mapping to addresses, so it must be agreed once.',
            work: 'network order is big-endian; 0x12345678 written little-endian and read big-endian is 2 018 915 346',
            result: 'the disagreement is invisible on one-byte values and on palindromes, so it must be specified rather than tested into existence'
          }
        ],
        answer: 'The width came from the range in one step; everything after that was about the ' +
          'edges. Sixteen bits holds ±2 000 with 94% of the range spare, negation has exactly one ' +
          'input it cannot answer and the requirement excludes it by 30 768, and the byte order ' +
          'has to be written into the protocol because no test built from small or symmetric ' +
          'values will ever notice it is missing. That last point is the general one: the ' +
          'boundary cases here are not rare inputs, they are inputs a test suite is systematically ' +
          'unlikely to contain.'
      }
    ],

    'bit-manipulation': [
      {
        title: 'Reading a population count off the SWAR stages',
        goal: 'Follow one word through the four pairwise sums and see why twelve operations ' +
          'answer for any input, not just this one.',
        setup: 'The demo’s default input, 0xDEADBEEF, through `popcountSwar` with every ' +
          'intermediate value shown.',
        steps: [
          {
            do: 'Start with the input and read it as 32 one-bit counters.',
            why: 'Each bit is already the count of itself, which is what makes the first stage a sum.',
            work: '0xDEADBEEF is the starting state, 32 counters each holding 0 or 1',
            result: 'nothing has been computed yet; the framing is the trick'
          },
          {
            do: 'Subtract the odd bits: v − ((v >> 1) & 0x55555555).',
            why: 'This adds each pair of neighbouring bits in place, without a carry crossing the pair.',
            work: 'the word becomes 0x9959699A — 16 two-bit counters, each holding 0, 1 or 2',
            result: 'half as many counters, twice as wide'
          },
          {
            do: 'Mask and add pairs of those: (v & 0x33..) + ((v >> 2) & 0x33..).',
            why: 'A four-bit counter can hold up to 4, so still no carry escapes.',
            work: 'the word becomes 0x33233334 — 8 four-bit counters',
            result: 'the nibbles now each hold the count of their own four bits'
          },
          {
            do: 'Add and mask once more: (v + (v >> 4)) & 0x0f0f0f0f.',
            why: 'A byte holds up to 8, so the addition can be done before the mask this time.',
            work: 'the word becomes 0x06050607 — 4 byte counters reading 6, 5, 6 and 7',
            result: '6 + 5 + 6 + 7 = 24, but the four are still in separate bytes'
          },
          {
            do: 'Sum the four bytes with one multiply: (v × 0x01010101) >>> 24.',
            why: 'That constant places a copy of the value at every byte offset and adds them, so the top byte is the total.',
            work: 'the answer is 24, in 12 operations against the loop’s 96',
            result: 'a saving of 8.00×, identical for every possible input'
          }
        ],
        answer: 'Twelve operations, no branches and no data dependence — the cost is the same for ' +
          '0, for 0xFFFFFFFF and for 0xDEADBEEF, which is what makes this the version to reach ' +
          'for when the input is adversarial. Kernighan’s loop answers the same question in 29.59 ' +
          'operations on the mean, which is better than the 96-operation scan and worse than SWAR, ' +
          'and its worst case is 78. Over 85 536 checked inputs all three agree exactly.'
      },
      {
        title: 'The trick that loses, and the column that says so',
        goal: 'Invert the first example: instead of a trick that wins on every input, find the one ' +
          'that loses on the mean and wins ninefold in the tail, and decide when to use it.',
        setup: 'The same sweep — all 65 536 low words plus 20 000 random 32-bit ones — with the ' +
          'mean and worst-case operation counts reported separately.',
        steps: [
          {
            do: 'Read the De Bruijn count-trailing-zeros against its naive loop, on the mean.',
            why: 'This is the number a profiler on ordinary data would report.',
            work: '5.00 operations against 4.00 — a saving of 0.80×, which is a loss',
            result: 'the showpiece trick of every bit-twiddling article is slower here'
          },
          {
            do: 'Explain the loss before assuming it is a mistake.',
            why: 'A random word has a set bit near the bottom, so the loop almost never runs long.',
            work: 'the expected number of trailing zeros in a random word is just under 1',
            result: 'the loop exits after about one iteration, and one iteration is cheap'
          },
          {
            do: 'Read the same two routines in the worst case.',
            why: 'A latency budget is set by the worst case, not the mean.',
            work: '5 operations against 46 — a saving of 9.20×',
            result: 'the same pair of routines, ranked the opposite way'
          },
          {
            do: 'Compare against a row where the two columns agree.',
            why: 'To see that this is a property of the routine rather than of the measurement.',
            work: 'SWAR popcount is 12 against 96 on the mean and 12 against 96 at the worst — 8.00× both ways',
            result: 'constant-cost routines have nothing to trade off'
          },
          {
            do: 'Check that neither routine is wrong before ranking them at all.',
            why: 'A speed comparison between a correct routine and a subtly wrong one is meaningless.',
            work: 'every row reports 0 disagreements over 85 536 inputs',
            result: 'the operation columns are the only thing left to decide on'
          }
        ],
        answer: 'The honest answer is "it depends on the input", and the demo makes that a pair of ' +
          'numbers rather than a shrug. Reach for the constant-time form when the data is ' +
          'adversarial, when the branch is unpredictable, or when a latency budget has to hold — ' +
          'and leave the loop alone when the data is friendly, because 4.00 operations beat 5.00. ' +
          'In cryptography the question does not arise: there the branchless form is required ' +
          'whatever it costs, because a branch on secret data is a timing channel.'
      }
    ],

    'bitsets-and-swar': [
      {
        title: 'Solving for the density where a bitset stops being the answer',
        goal: 'Turn "bitsets are compact" into a crossing point, and check it against a swept table.',
        setup: 'A universe of 1 000 000 elements, with a `Set` entry modelled at 32 bytes — one ' +
          'hash slot plus one entry record.',
        steps: [
          {
            do: 'Compute the bitset’s cost, which does not depend on the contents.',
            why: 'A flat line and a diagonal cross exactly once, so this is half of a solvable equation.',
            work: '1 000 000 bits is 31 250 words of four bytes, so 125 000 bytes — 122.1 KB',
            result: 'the same figure whether the set holds one element or a million'
          },
          {
            do: 'Write the hash set’s cost as a function of the population.',
            why: 'The other half of the equation, and the only one with the assumption in it.',
            work: 'population × 32 bytes, with 32 stated rather than measured',
            result: 'a straight diagonal on a log-log chart'
          },
          {
            do: 'Solve for the population where the two are equal.',
            why: 'This is the crossing, and it needs no experiment.',
            work: '125 000 / 32 = 3 906.25 elements, which is 0.391% of the universe',
            result: 'below that density the Set is genuinely smaller'
          },
          {
            do: 'Check the solution against the swept table.',
            why: 'A derived number that the measurement does not reproduce is a mistake in one of them.',
            work: 'the 0.390% row reports a ratio of 1.00× and names the Set as smaller',
            result: 'the sweep and the arithmetic agree'
          },
          {
            do: 'Read the ratio at the ends of the range.',
            why: 'To size how much is at stake on each side of the crossing.',
            work: '128.00× in the bitset’s favour at 50% density, 0.26× at 0.1%',
            result: 'two orders of magnitude in each direction'
          }
        ],
        answer: 'The crossing is at 3 906 elements — 0.391% — and it moves in direct proportion to ' +
          'the 32-byte model: halve that estimate and the crossing doubles. That is why the ' +
          'assumption is reported alongside every ratio rather than folded into it. The practical ' +
          'reading is that a bitset is the right answer far more often than the density suggests, ' +
          'because 0.4% is very sparse — and that below it the honest answer is to use the ' +
          'general-purpose structure.'
      },
      {
        title: 'The one case where the general-purpose set wins on speed as well',
        goal: 'Invert the first example: find the workload where the bitset’s branchless word ' +
          'loop is the wrong shape, and say what makes it so.',
        setup: 'The same million-element universe, intersecting two sets whose populations are far ' +
          'smaller than the number of words the bitset spans.',
        steps: [
          {
            do: 'Count the words a bitset intersection touches, whatever the answer is.',
            why: 'The loop length is a property of the universe, not of either population.',
            work: '31 250 words for every one of union, intersection and difference',
            result: 'the same cost for an answer of 417 elements and one of 39 583'
          },
          {
            do: 'Count what a hash-set intersection does instead.',
            why: 'It walks one set and probes the other, so its cost is a population.',
            work: '20 000 probes for the intersection, one per element of the smaller side',
            result: 'below the word count, and it falls as the sets get sparser'
          },
          {
            do: 'Find where those two cross for this universe.',
            why: 'The comparison is the same shape as the memory one and has its own crossing.',
            work: '31 250 words against one probe per element: below about 31 250 elements the probes are fewer',
            result: 'sparse intersection is the hash set’s case on work as well as memory'
          },
          {
            do: 'Resist concluding the hash set is therefore faster there.',
            why: 'Operation counts are not cycles, and the two operations are not comparable units.',
            work: '31 250 sequential word reads prefetch perfectly; 20 000 hash probes are 20 000 potential cache misses',
            result: 'the crossing in cycles is at a far lower density than the crossing in operations'
          },
          {
            do: 'Check that both structures are answering the same question.',
            why: 'A performance comparison between two structures that disagree is worthless.',
            work: 'all three operations report 0 disagreements against a real `Set`',
            result: 'the comparison is about cost alone'
          }
        ],
        answer: 'The bitset’s branchless loop is its strength and its only real weakness: it costs ' +
          'the universe whatever the answer is, so a sparse intersection over a large universe is ' +
          'the shape it handles worst. But "fewer operations" is not "faster" — the word loop is ' +
          'sequential and prefetchable and the probes are scattered, so the crossing measured in ' +
          'cycles sits far below the crossing measured in operations. The structure that resolves ' +
          'this properly is neither: it is Roaring, which chooses per 65 536-element block.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
