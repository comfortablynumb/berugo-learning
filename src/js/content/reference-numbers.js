/** Reference entries for integer representation, bit tricks and bitsets (M17.1-M17.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'integer-representation': {
      summary: 'Fixed-width integers as bit patterns plus an agreement, the two flags one adder ' +
        'raises, the four overflow policies, and the asymmetry that makes negation a partial ' +
        'function.',
      intuition: 'The processor raises carry and overflow on every addition and cannot know which ' +
        'one was your error; the types in your source decide that, and they exist only in your source.',
      formulation: {
        equations: [
          {
            label: 'The two readings of one pattern',
            expr: 'unsigned reads the bits directly; signed subtracts 2ⁿ once the pattern passes the halfway point',
            terms: [
              { sym: 'range, unsigned', meaning: '0 … 2ⁿ − 1 — at eight bits, 0 … 255' },
              { sym: 'range, signed', meaning: '−2ⁿ⁻¹ … 2ⁿ⁻¹ − 1 — at eight bits, −128 … 127' },
              { sym: 'why two’s complement', meaning: 'one adder, one subtractor and one zero serve both readings' },
              { sym: 'measured', meaning: '128 negatives against 127 positives at eight bits' }
            ]
          },
          {
            label: 'The two flags',
            expr: 'carry is about the unsigned range; overflow is about the signed one',
            terms: [
              { sym: 'carry only', meaning: '0xFF + 0x01 at eight bits: 256 leaves 0 … 255 and not −128 … 127' },
              { sym: 'overflow only', meaning: '0x7F + 0x01, and the demo’s 100 + 100 = 200' },
              { sym: 'both', meaning: '100 × 100 = 10 000 leaves both ranges' },
              { sym: 'neither', meaning: '100 − 100 = 0, and 100 ÷ 100 = 1' }
            ]
          },
          {
            label: 'The four overflow policies',
            expr: 'wrap, saturate, refuse, or declare it undefined',
            terms: [
              { sym: 'wrapping', meaning: '100 + 100 at int8 gives −56; JavaScript’s bitwise operators, Go, release-mode Rust' },
              { sym: 'saturating', meaning: 'gives 127; audio and fixed-point pipelines' },
              { sym: 'checked', meaning: 'gives no answer at all, which is the only one a caller can handle' },
              { sym: 'undefined', meaning: 'C, for signed overflow — the compiler may delete a check written after the addition' }
            ]
          },
          {
            label: 'JavaScript’s two hidden widths',
            expr: 'bitwise operators are int32; `>>>` is the one that yields uint32; plain arithmetic is a double',
            terms: [
              { sym: '1 << 31', meaning: '−2 147 483 648 — the shift lands on the sign bit' },
              { sym: '1 << 32', meaning: '1 — the shift count is taken modulo 32' },
              { sym: '4294967296 | 0', meaning: '0 — ToInt32 wraps rather than clamping or throwing' },
              { sym: '(2**53) + 1 === 2**53', meaning: 'true, with no operator involved at all' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The stored value is the exact value taken modulo 2ⁿ, read at the chosen signedness',
          why: 'It makes "what did it store" a computation rather than a guess.',
          breaks: 'Masking as you go instead gets the common cases right and disagrees at the boundaries.'
        },
        {
          name: 'Carry and overflow are computed from the exact result against two different ranges',
          why: 'They are independent, and code that treats them as one is wrong for half its inputs.',
          breaks: 'An overflow check that consults the wrong flag passes for exactly the inputs it was written to catch.'
        },
        {
          name: 'Negation is total on an unsigned width and partial on a signed one',
          why: 'There is one more negative value than positive, so −INT_MIN does not exist.',
          breaks: '`abs()` returns a negative number and `INT_MIN / −1` traps.'
        },
        {
          name: 'Sign extension is chosen by the source type, never the destination',
          why: 'Widening a value has to preserve its meaning, and only the source knows what that was.',
          breaks: 'A signed byte of −1 widens to 255 and an array index goes somewhere unexpected.'
        }
      ],
      complexity: [
        { operation: 'add, subtract, compare', average: 'one instruction at any width up to the word size', worst: 'both flags raised on the same operation, as at 100 × 100' },
        { operation: 'checked arithmetic', average: 'the operation plus one comparison', worst: 'returns nothing, which is the point' },
        { operation: 'saturating arithmetic', average: 'the operation plus a clamp, or one SIMD instruction', worst: 'silently bounded rather than silently wrapped' },
        { operation: 'exact reference in BigInt', average: 'far slower than the width it models', worst: 'unbounded, which is why it is the oracle rather than the implementation' }
      ],
      failureModes: [
        {
          symptom: 'An overflow check compiles away entirely at −O2.',
          cause: 'Signed overflow is undefined behaviour in C, so the compiler may assume it did not happen.',
          fix: 'Check before the operation using the range, or use the compiler’s checked builtin.'
        },
        {
          symptom: 'A parser works on one platform and indexes an array at a negative value on another.',
          cause: '`char` is signed on some platforms and unsigned on others, so a byte above 127 sign-extends or does not.',
          fix: 'Read bytes through an explicitly unsigned type at the boundary.'
        },
        {
          symptom: 'A protocol round-trips in tests and corrupts values in production.',
          cause: 'The byte order was never specified, and every test value was one byte, symmetric or zero.',
          fix: 'Fix the order in the specification and test with an asymmetric multi-byte value.'
        },
        {
          symptom: 'A hash function drifts from its reference implementation above a certain input size.',
          cause: '`a * b` in JavaScript is a double multiplication and stops being exact above 2⁵³.',
          fix: 'Use `Math.imul` for 32-bit multiplication, which wraps the way the reference does.'
        },
        {
          symptom: 'An id arrives in the browser off by one.',
          cause: 'A 64-bit database id passed through JSON as a number, and the double could not hold it.',
          fix: 'Serialise identifiers above 2⁵³ as strings.'
        }
      ],
      inTheWild: [
        { system: 'The Ariane 5 flight 501 loss', how: 'a 64-bit float converted to a 16-bit signed integer overflowed, and the unhandled exception took down both inertial reference systems.' },
        { system: 'Rust', how: 'panics on overflow in debug builds and wraps in release, with `checked_*`, `saturating_*` and `wrapping_*` making the policy explicit at the call site.' },
        { system: 'Linux kernel networking', how: 'uses `__be32` and `__le32` types so that a byte-order mismatch is a compile-time error rather than a wire-format bug.' }
      ],
      sources: [
        { title: 'Hacker’s Delight, chapter 2', author: 'Henry S. Warren, Jr.', note: 'Two’s complement, overflow detection and the identities that follow from them.' },
        { title: 'What every C programmer should know about undefined behavior', author: 'Chris Lattner', note: 'Why the signed-overflow check disappears, written by the person whose compiler removes it.' },
        { title: 'ECMAScript specification, ToInt32 and ToUint32', author: 'Ecma International', note: 'The normative definition of what JavaScript’s bitwise operators do to their operands.' },
        { title: 'Computer Organization and Design', author: 'Patterson and Hennessy', note: 'The adder that raises both flags, drawn at the gate level.' }
      ]
    },

    'bit-manipulation': {
      summary: 'The bit-manipulation toolkit with every routine measured against the loop it ' +
        'replaces, over all 65 536 low words plus a random 32-bit sweep — and two routines whose ' +
        'mean and worst-case rankings disagree.',
      intuition: 'Some of these win on every input and some only win in the tail; the way to tell ' +
        'them apart is a counter, and the showpiece trick is one of the second kind.',
      formulation: {
        equations: [
          {
            label: 'The two identities',
            expr: 'x & (x − 1) clears the lowest set bit; x & −x isolates it',
            terms: [
              { sym: 'why clearing works', meaning: 'subtracting one flips the lowest set bit and sets everything below it' },
              { sym: 'why isolating works', meaning: 'two’s-complement negation leaves the lowest set bit and clears everything above' },
              { sym: 'what they build', meaning: 'Kernighan’s popcount, the De Bruijn bit scan, a bitset iterator, a free-block search' },
              { sym: 'measured', meaning: '0 failures over 20 001 inputs including zero' }
            ]
          },
          {
            label: 'Operations, measured over 85 536 inputs',
            expr: 'mean and worst case are separate columns because they rank the routines differently',
            terms: [
              { sym: 'popcount, SWAR', meaning: '12.00 against 96.00 on the mean and 12 against 96 at the worst — 8.00× both' },
              { sym: 'popcount, Kernighan', meaning: '29.59 against 96.00 — 3.24× on the mean, 1.23× at the worst' },
              { sym: 'count trailing zeros', meaning: '5.00 against 4.00 — a LOSS of 0.80× on the mean, a win of 9.20× at the worst' },
              { sym: 'count leading zeros', meaning: '1.00 against 40.77 — 40.77× on the mean, 94.00× at the worst' },
              { sym: 'reverse the bits', meaning: '17.00 against 128.00 — 7.53× both ways' }
            ]
          },
          {
            label: 'The SWAR reduction',
            expr: '32 one-bit counters → 16 two-bit → 8 four-bit → 4 eight-bit → one multiply',
            terms: [
              { sym: 'the masks', meaning: '0x55555555, 0x33333333 and 0x0f0f0f0f, each keeping carries inside their counter' },
              { sym: 'the final multiply', meaning: '× 0x01010101 places a copy at every byte offset and adds them, so the top byte is the total' },
              { sym: 'traced', meaning: '0xDEADBEEF → 0x9959699A → 0x33233334 → 0x06050607 → 24' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every routine agrees with its naive twin on all 65 536 low words',
          why: 'The failures cluster at zero, at powers of two and at the sign bit, which a sample avoids.',
          breaks: 'A routine that is right on the values you tried ships and is wrong on one input in a million.'
        },
        {
          name: 'Disagreements are counted, never thrown',
          why: 'A bit trick fails by returning a plausible number, so the count is the finding.',
          breaks: 'Throwing on the first mismatch cannot say whether the bug fires once or always.'
        },
        {
          name: 'The mean and the worst case are reported separately',
          why: 'For data-dependent routines they point in opposite directions.',
          breaks: 'Quoting one of them makes a trick look universally better or universally worse than it is.'
        },
        {
          name: 'Rounding up to a power of two is guarded at zero',
          why: 'The unguarded routine returns 0, which is Hacker’s Delight’s stated behaviour and not what a caller wants.',
          breaks: 'A growth policy allocates a zero-length buffer on the first push.'
        }
      ],
      complexity: [
        { operation: 'popcount by SWAR or byte table', average: '12 operations', worst: '12 operations, independent of the input' },
        { operation: 'popcount by Kernighan', average: '29.59 operations on random words', worst: '78 operations, one iteration per set bit' },
        { operation: 'count trailing zeros, De Bruijn', average: '5 operations', worst: '5 operations against the loop’s 46' },
        { operation: 'count trailing zeros, loop', average: '4.00 operations on random words', worst: '46 operations on a value with 31 trailing zeros' },
        { operation: 'bit reversal, SWAR', average: '17 operations', worst: '17 against the loop’s 128' }
      ],
      failureModes: [
        {
          symptom: 'A buffer of length zero is allocated on the first push.',
          cause: 'The round-up-to-a-power-of-two trick returns 0 for an input of 0.',
          fix: 'Guard the zero case explicitly; the smear-and-increment cannot handle it.'
        },
        {
          symptom: '`abs()` of one specific value comes back negative.',
          cause: 'The branchless absolute value wraps at INT_MIN, whose negation is not an int32.',
          fix: 'Nothing at that width can be right; widen the type or exclude the input, and say which.'
        },
        {
          symptom: 'A "faster" bit routine makes the program slower.',
          cause: 'A constant-cost routine replaced a data-dependent one on data that was friendly.',
          fix: 'Measure the mean on your data as well as the worst case, and keep the loop if it wins.'
        },
        {
          symptom: 'A shift by the word width returns the original value.',
          cause: 'The shift count is taken modulo the width, so a shift of 32 is a shift of 0.',
          fix: 'Build full-width masks by shifting in two steps, never as `(1 << n) − 1` at n = 32.'
        }
      ],
      inTheWild: [
        { system: 'x86-64 and ARM', how: 'expose POPCNT, LZCNT and TZCNT as single instructions, so these routines are the portable fallback rather than the fast path.' },
        { system: 'Chess engines', how: 'generate every legal move of a piece type at once from bitboards using exactly these shifts, masks and bit scans.' },
        { system: 'Garbage collectors', how: 'count live objects and find free blocks in mark bitmaps with popcount and count-trailing-zeros.' }
      ],
      sources: [
        { title: 'Hacker’s Delight', author: 'Henry S. Warren, Jr.', note: 'The canonical collection, with the derivations rather than just the code.' },
        { title: 'Using de Bruijn sequences to index a 1 in a computer word', author: 'Leiserson, Prokop and Randall', note: 'The paper the bit-scan trick comes from.' },
        { title: 'Bit Twiddling Hacks', author: 'Sean Eron Anderson', note: 'The web reference everyone actually uses, with the caveats most copies drop.' },
        { title: 'The Chess Programming Wiki, Bitboards', author: 'community', note: 'Where these routines are load-bearing rather than decorative.' }
      ]
    },

    'bitsets-and-swar': {
      summary: 'A bitset against a general-purpose set, with the crossing density solved for ' +
        'rather than asserted, every operation checked against a real `Set`, and the per-entry ' +
        'memory model stated because it cannot be measured.',
      intuition: 'A bitset’s cost is a property of the universe and a hash set’s is a property of ' +
        'the population, so there is exactly one crossing point and it is far sparser than anybody guesses.',
      formulation: {
        equations: [
          {
            label: 'The crossing',
            expr: 'universe / 8 bytes against population × 32 bytes',
            terms: [
              { sym: 'bitset, 10⁶ universe', meaning: '31 250 words — 125 000 bytes, 122.1 KB, whatever it holds' },
              { sym: 'the model', meaning: 'SET_BYTES_PER_ENTRY = 32, one hash slot plus one entry record; stated, not measured' },
              { sym: 'the crossing', meaning: '125 000 / 32 = 3 906 elements — a density of 0.391%' },
              { sym: 'the stakes', meaning: '128.00× in the bitset’s favour at 50% density, 0.26× at 0.1%' }
            ]
          },
          {
            label: 'Work, measured at a 10⁶ universe and 20 000 elements a side',
            expr: 'word operations cost the universe; probes cost a population',
            terms: [
              { sym: 'intersect, union, difference', meaning: '31 250 words each, for answers of 417, 39 583 and 19 583 elements' },
              { sym: 'the hash-set side', meaning: '20 000 probes for the intersection and the difference, 40 000 for the union' },
              { sym: 'iteration', meaning: '51 031 steps against 1 000 000 for the scan — 19.6×' },
              { sym: 'agreement', meaning: '0 disagreements against a real `Set` on all three operations' }
            ]
          },
          {
            label: 'A sieve, the friendliest case',
            expr: 'same algorithm, same marks, different memory',
            terms: [
              { sym: 'to 10⁶', meaning: '78 498 primes, 921 501 composites' },
              { sym: 'marks written', meaning: '2 122 048 by both representations — it is the same algorithm' },
              { sym: 'memory', meaning: '122.1 KB against 28.1 MB — 235.9× under the stated model' }
            ]
          },
          {
            label: 'Bitboards',
            expr: 'one 64-bit word per piece type, and the mask goes AFTER the shift',
            terms: [
              { sym: 'a knight from d4', meaning: '8 destinations from 16 shift-and-mask operations against a 64-square walk' },
              { sym: 'the two masks', meaning: 'one-file jumps exclude a or h; two-file jumps exclude a and b, or g and h' },
              { sym: 'getting it wrong', meaning: 'produces a legal-looking move list with a piece that wrapped around the board' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Both operands of a word operation agree on the universe',
          why: 'The word loop reads by index, so a shorter operand is read past silently.',
          breaks: 'The answer comes back as a subset and nothing complains.'
        },
        {
          name: 'Every set operation is checked against a real `Set` over the same data',
          why: 'A word-loop bug produces a plausible answer, not an exception.',
          breaks: 'A missing element is indistinguishable from an element that was never added.'
        },
        {
          name: 'Iteration visits one position per set bit, not one per possible element',
          why: 'Otherwise a sparse bitset costs the universe on every pass.',
          breaks: 'A thousand elements in a million-element universe cost a million tests.'
        },
        {
          name: 'The memory model is reported with every ratio derived from it',
          why: 'The number cannot be measured from inside JavaScript, so it has to be declarable.',
          breaks: 'A ratio with an invisible assumption in it cannot be checked or disagreed with.'
        }
      ],
      complexity: [
        { operation: 'add, remove, test', average: 'one shift, one mask, one word access', worst: 'the same — there is no probe sequence' },
        { operation: 'union, intersection, difference', average: 'one pass over ⌈universe / 32⌉ words', worst: 'identical: 31 250 words at a 10⁶ universe, whatever the answer' },
        { operation: 'iterate the set bits', average: 'one step per set bit plus one per word — 51 031 at 20 000 elements', worst: 'the population plus the word count' },
        { operation: 'iterate by scanning', average: 'one step per possible element — 1 000 000', worst: 'the universe, always' },
        { operation: 'memory', average: '⌈universe / 8⌉ bytes', worst: 'the same; it does not depend on the contents' }
      ],
      failureModes: [
        {
          symptom: 'A bitset uses more memory than the hash set it replaced.',
          cause: 'The density is below the crossing — under 0.4% at a million-element universe.',
          fix: 'Solve for the crossing with your own per-entry estimate, or use a structure that switches per block.'
        },
        {
          symptom: 'An intersection returns a plausible subset of the right answer.',
          cause: 'The two operands had different universes, so the word loop stopped at the shorter one.',
          fix: 'Reject mismatched universes at the call, which is a one-line guard.'
        },
        {
          symptom: 'A sparse bitset is slower than the `Set` it replaced.',
          cause: 'Iteration scanned the universe instead of walking the population.',
          fix: 'Iterate with `x & −x` and `x & (x − 1)`; the saving is the sparsity.'
        },
        {
          symptom: 'A piece on the h file appears on the a file of the next rank.',
          cause: 'The wrap mask was applied before the shift, or the wrong mask was used for a two-file jump.',
          fix: 'Mask after shifting, and use the two-file mask for the two-file jumps.'
        },
        {
          symptom: 'The structure has to be abandoned when ids change format.',
          cause: 'The universe bound was a coupling to a decision made elsewhere and was never written down.',
          fix: 'State the bound where the structure is chosen, and prefer a per-block structure when it may move.'
        }
      ],
      inTheWild: [
        { system: 'Roaring bitmaps', how: 'partition the universe into 65 536-element blocks and choose array, bitmap or run encoding per block, because real data is dense in some regions and sparse in others.' },
        { system: 'Lucene and Elasticsearch', how: 'hold posting-list intersections as bitsets when the postings are dense and as sorted arrays when they are not.' },
        { system: 'Stockfish and every strong chess engine', how: 'represent a position as a handful of 64-bit boards and generate moves with shifts, masks and bit scans.' }
      ],
      sources: [
        { title: 'Better bitmap performance with Roaring bitmaps', author: 'Chambi, Lemire, Kaser and Godin', note: 'The paper for the per-block choice, with the measurements that motivate it.' },
        { title: 'Consistently faster and smaller compressed bitmaps with Roaring', author: 'Lemire, Ssi-Yan-Kai and Kaser', note: 'The run-length container and when it pays.' },
        { title: 'The Chess Programming Wiki, General Setwise Operations', author: 'community', note: 'The mask-after-shift rules, written out per direction.' },
        { title: 'Hacker’s Delight, chapter 5', author: 'Henry S. Warren, Jr.', note: 'Population count and bit-scan, which are what make a bitset iterable.' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
