/** Concepts for integer representation, bit tricks and bitsets (M17.1-M17.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'integer-representation': [
      {
        term: 'A bit pattern is not a number until something agrees how to read it',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["the eight bits 11111111"] --> B["read as unsigned: 255"]',
            '    A --> C["read as two\'s complement: −1"]',
            '    B --> D["the bits are identical"]',
            '    C --> D',
            '    D --> E["the type is the agreement,<br/>and it lives outside the bits"]'
          ].join('\n'),
          caption: 'Nothing in memory records which reading was intended. Every signedness bug is two pieces of code disagreeing about a convention neither of them stored.'
        },
        plain: 'The same eight bits are 255 unsigned and −1 signed, and nothing in the bits settles which.',
        formal: 'pattern 1111 1111 reads as 255 under the unsigned agreement and as −1 under two’s complement',
        detail: [
          'This is the fact every later confusion grows out of.',
          'A width does not store a number, it stores a pattern. The type in the source code is the ' +
            'only thing that says how to read it, and the hardware has no idea.',
          'That is why a C cast between `int` and `unsigned` compiles to no instructions at all, and ' +
            'why a protocol that omits the signedness of a field is under-specified. It is also why ' +
            'reading the same buffer through two typed-array views gives two different answers, ' +
            'without either being wrong.'
        ],
        example: 'At eight bits the demo shows 0xFF as 255 and as −1 simultaneously; only the ' +
          'checkbox changes, and no bit moves.'
      },
      {
        term: 'Two’s complement exists so one adder serves both readings',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["one adder circuit"] --> B["add two unsigned values"]',
            '    A --> C["add two signed values"]',
            '    B --> D["same gates, same walk<br/>around the wheel"]',
            '    C --> D',
            '    D --> E["which is why the hardware has<br/>no separate signed addition"]'
          ].join('\n'),
          caption: 'It is not a clever encoding of negative numbers. It is the encoding that makes subtraction, comparison and addition reuse one circuit.'
        },
        plain: 'Adding is the same walk clockwise around the wheel whether you call the values signed or unsigned.',
        formal: 'the signed value of a pattern p at width n is p when p < 2^(n−1), and p − 2^n otherwise',
        readAs: 'Read the bits as an ordinary positive number. If that number reaches the halfway ' +
          'point of the width, subtract the whole range from it to get the negative value it ' +
          'stands for.',
        detail: [
          'Sign-and-magnitude and ones’ complement both existed and both lost. Both need the adder ' +
            'to know which representation it is looking at, and both have two zeros.',
          'Two’s complement makes the bit patterns a circle. Adding one always steps clockwise, and ' +
            'the signed reading is just a decision about where to cut the circle.',
          'The consequence is that a processor needs one adder, one subtractor and one comparison ' +
            'circuit rather than two of each. That is the entire reason the format won.'
        ],
        example: 'The wheel in the demo marks 0, 127 and −128 on one circle at eight bits; the ' +
          'dashed line is the cut, and it is the only discontinuity.'
      },
      {
        term: 'Carry and overflow are different flags and they disagree constantly',
        plain: 'Carry says the result left the unsigned range; overflow says it left the signed one.',
        formal: '0xFF + 0x01 at eight bits raises carry and not overflow; 0x7F + 0x01 raises overflow and not carry',
        detail: [
          'One adder computes both flags on every addition, and the processor raises both. Which one ' +
            'was the error is decided by the types in the source, and the hardware cannot know.',
          'This is why an unsigned overflow check and a signed one are different pieces of code even ' +
            'though the addition is the same instruction.',
          'It is also why an assembly programmer chooses between `jc` and `jo` rather than being ' +
            'told which to use. Confusing them produces a check that passes for exactly the inputs ' +
            'it was written to catch.'
        ],
        example: 'At 100 + 100 in the demo the flags read "overflow only": 200 is inside 0 … 255 ' +
          'and outside −128 … 127.'
      },
      {
        term: 'There is one more negative value than positive, and negation is not total',
        plain: 'Zero occupies a slot on the positive side, so the most negative value has no positive counterpart.',
        formal: 'at width n the range is −2^(n−1) … 2^(n−1) − 1, so −(−2^(n−1)) is not representable',
        detail: [
          'This is not a curiosity, it is three real bugs.',
          'Negating the smallest value returns the smallest value, so `abs()` of it is negative. And ' +
            '`INT_MIN / −1` traps on x86 with the same signal as division by zero, because the true ' +
            'quotient is one past the top of the range.',
          'Any code that computes `-x` on a signed value it did not bound has a case it has not ' +
            'considered. The asymmetry is a direct consequence of the wheel having an even number of ' +
            'positions and zero taking one of them.'
        ],
        example: 'At eight bits the demo reports 128 negatives against 127 positives, and negating ' +
          '−128 gives −128.'
      },
      {
        term: 'Overflow is a policy, and there are four of them',
        plain: 'Wrap, saturate, refuse, or declare it undefined — and only one of those lets the caller respond.',
        formal: 'wrapping keeps the low bits; saturating clamps to the range; checked returns nothing; C makes signed overflow undefined',
        detail: [
          'JavaScript’s bitwise operators, Go and release-mode Rust wrap.',
          'Audio and fixed-point pipelines saturate, because a clipped sample is a quieter failure ' +
            'than a sample that jumps to the opposite extreme. Checked arithmetic refuses to answer, ' +
            'which is the only policy the caller can actually handle.',
          'C’s choice is the dangerous one. *Undefined behaviour* means the compiler may assume ' +
            'overflow cannot happen, so a check written after the addition can be deleted at −O2 and ' +
            'the binary has no check in it.'
        ],
        example: 'The demo shows 100 + 100 at int8 as −56 wrapping, 127 saturating, and no answer ' +
          'at all under the checked policy.'
      },
      {
        term: 'Widening needs the sign bit replicated, not zeros',
        plain: 'Sign extension copies the top bit outwards; zero extension does not, and picking wrong turns −1 into 255.',
        formal: 'sign-extending an 8-bit −1 to 16 bits gives 0xFFFF; zero-extending it gives 0x00FF',
        detail: [
          'Which extension is correct depends on the *source* type, not the destination, which is ' +
            'why the classic `char` bug survives so long.',
          'A platform where `char` is signed sign-extends a byte above 127 into a negative `int`, ' +
            'and one where it is unsigned does not. So the same code parses a UTF-8 continuation ' +
            'byte correctly on one machine and indexes an array at −56 on another.',
          'Every processor has separate load instructions for the two cases, precisely because the ' +
            'hardware cannot infer it either.'
        ],
        example: 'The demo’s width control re-reads the same pattern at 8, 16, 32 and 64 bits, ' +
          'and the signed reading of 0xFF stays −1 at every one of them.'
      },
      {
        term: 'Endianness is a property of the mapping to addresses, not of the number',
        plain: 'The number is the same; the order its bytes go into memory is a separate agreement.',
        formal: '0x12345678 stores as 78 56 34 12 little-endian and 12 34 56 78 big-endian; each read the other way is 0x78563412',
        detail: [
          'Nothing about the value changes. What changes is which byte lands at the lower address, ' +
            'and the disagreement only becomes visible when something reads the bytes back with the ' +
            'opposite agreement.',
          'That is why the bug survives every unit test. A one-byte value, a palindrome and a zero ' +
            'all round-trip correctly whichever end you start from, so it takes a real multi-byte ' +
            'value crossing a real boundary to expose it.',
          'Network protocols fix the order in the specification for exactly this reason.'
        ],
        example: 'At 32 bits the demo shows both byte orders and the value each produces when read ' +
          'the other way, and both come out as 2 018 915 346.'
      },
      {
        term: 'JavaScript has one number type and two integer widths hidden inside it',
        plain: 'Every bitwise operator converts to int32 first, and plain arithmetic stops being exact above 2⁵³.',
        formal: '1 << 31 is −2147483648, 1 << 32 is 1, 4294967296 | 0 is 0, and (2**53) + 1 === 2**53',
        detail: [
          'The bitwise operators are specified on int32, so `|`, `&`, `^`, `<<` and `>>` apply ' +
            'ToInt32 to their operands. That is a wrap, not a clamp and not an error.',
          '`>>>` is the single operator that yields uint32. The shift count is taken modulo 32, ' +
            'which is why a shift of 32 is a shift of zero rather than a zero result.',
          'And entirely separately, with no operator involved, the underlying double stops ' +
            'representing consecutive integers above 2⁵³. That is what ' +
            '`Number.MAX_SAFE_INTEGER` names.'
        ],
        example: 'The coercion table in the demo shows all eight of these, including `~~3.7` giving ' +
          '3 and `-1 >>> 0` giving 4 294 967 295.'
      }
    ],

    'bit-manipulation': [
      {
        term: 'Two identities carry most of the toolkit',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["x AND (x − 1)"] --> B["clears the lowest set bit"]',
            '    C["x AND −x"] --> D["isolates the lowest set bit"]',
            '    B --> E["loop on the first: iterations equal<br/>the number of set bits"]',
            '    D --> F["use the second to name<br/>which bit that is"]'
          ].join('\n'),
          caption: 'Population counts, subset enumeration and bit scans are almost all one of these two in a loop. Learning the pair is most of learning the toolkit.'
        },
        plain: '`x & (x − 1)` clears the lowest set bit and `x & −x` isolates it.',
        formal: 'x & (x − 1) has popcount(x) − 1 bits set; x & −x is a power of two, or 0 when x is 0',
        detail: 'Subtracting one flips the lowest set bit to zero and turns every zero below it ' +
          'into a one, so ANDing with the original keeps everything above and clears exactly that ' +
          'bit. Negating in two’s complement is inverting and adding one, which leaves the ' +
          'lowest set bit alone and clears everything above it — so the AND isolates it. Nearly ' +
          'every routine in this section is one of those two with a loop or a lookup wrapped ' +
          'round it, including a bitset’s iterator and an allocator’s free-block search.',
        example: 'The demo checks both over 20 001 inputs including zero and records 0 failures for ' +
          'each.'
      },
      {
        term: 'SWAR treats a word as a vector of counters',
        plain: 'Add neighbouring bits in place, halving how many counters there are and doubling how wide, four times over.',
        formal: '32 one-bit counters → 16 two-bit → 8 four-bit → 4 eight-bit, then one multiply sums the four',
        detail: 'The masks are what keep the additions from spilling between counters: at the ' +
          'two-bit stage each counter can hold up to 2 and at the four-bit stage up to 4, so no ' +
          'carry ever crosses a boundary. The final trick is the one that looks like magic and is ' +
          'not: multiplying by 0x01010101 places a copy of the value at every byte offset and adds ' +
          'them, so the top byte of the product is the sum of the four byte-counters, and one ' +
          'shift extracts it. Twelve operations, no branches, no data dependence at all.',
        example: 'The demo traces 0xDEADBEEF through 0x9959699A, 0x33233334 and 0x06050607 to the ' +
          'answer 24.'
      },
      {
        term: 'The clever bit scan loses on random data and wins in the tail',
        plain: 'De Bruijn count-trailing-zeros is five operations always; the naive loop is four on average and ninety-four at worst.',
        formal: 'measured over 85 536 inputs: 5.00 against 4.00 operations on the mean, 5 against 46 at the worst',
        detail: 'A random word usually has a set bit near the bottom, so the loop exits almost ' +
          'immediately and the trick that replaces it does more work. What the trick buys is a ' +
          'flat cost: no data dependence, no branch to mispredict, and a worst case nine times ' +
          'better. Which of those matters is a question about the input and the surrounding code ' +
          'rather than about the routine, and the only way to answer it is to count both — which ' +
          'is why the demo reports the mean and the worst case in separate columns.',
        example: 'The sweep gives count-trailing-zeros a mean saving of 0.80× and a worst-case ' +
          'saving of 9.20×, the only row where the two disagree in direction.'
      },
      {
        term: 'De Bruijn sequences turn an isolated bit into an index',
        plain: 'Multiplying a carefully chosen constant by a power of two rotates it so its top five bits name the exponent.',
        formal: 'the top 5 bits of 0x077CB531 × 2ᵏ are distinct for every k in 0 … 31, so a 32-entry table inverts them',
        detail: 'A De Bruijn sequence of order 5 contains every 5-bit pattern exactly once as a ' +
          'cyclic window. Multiplying by 2ᵏ is a left shift, so the window that lands in the top ' +
          'five bits is different for every k — which makes a 32-entry lookup table an exact ' +
          'inverse. The whole routine is one AND, one negate, one multiply, one shift and one ' +
          'load, and it is completely opaque until you know what property the constant has. That ' +
          'opacity is the real cost of the trick, not the operations.',
        example: 'The demo’s table is built at load time by multiplying the constant by each ' +
          'of the 32 powers of two, and disagrees with the naive loop 0 times in 85 536 inputs.'
      },
      {
        term: 'These tricks fail at zero, at powers of two and at the sign bit',
        plain: 'Exactly the three values a hand-written test is least likely to contain.',
        formal: 'rounding up to a power of two returns 0 for an input of 0 unless it is guarded',
        detail: 'The smear-and-increment routine subtracts one before smearing, so an input of ' +
          'zero becomes all ones, the increment carries off the top of the word, and the answer is ' +
          'zero — Hacker’s Delight’s documented behaviour, and not what a caller sizing a ' +
          'buffer wants. That is why the checks in this section are exhaustive over all 65 536 ' +
          'low words rather than sampled: the failures cluster at boundaries, and a sample of ' +
          'plausible-looking inputs is precisely a sample that avoids them.',
        example: 'Every trick in the demo is checked over 85 536 inputs — all 65 536 low words plus ' +
          '20 000 random 32-bit ones — and reports 0 disagreements.'
      },
      {
        term: 'A branchless routine is bought for the mispredict, not the operation count',
        plain: 'Removing a branch can be worth it even when it adds arithmetic, if the branch was unpredictable.',
        formal: 'x >> 31 is all ones for a negative int32 and all zeros otherwise, so (x + m) ^ m is |x| with no branch',
        detail: 'The arithmetic shift turns a sign test into a mask, and adding then XORing that ' +
          'mask is exactly two’s-complement negation when the mask is all ones and a no-op ' +
          'when it is zero. On a modern processor a mispredicted branch costs more cycles than ' +
          'every operation the branchless form added, so on data the predictor cannot learn the ' +
          'trade is worth taking — and on data it can learn, the branch is nearly free and the ' +
          'branchless version is slower. The input decides, not the routine.',
        example: 'The demo’s identity table checks the branchless absolute value against ' +
          '`Math.abs` over 20 001 inputs and names its one exclusion: INT_MIN, where no int32 ' +
          'answer exists.'
      },
      {
        term: 'Gray codes change one bit between consecutive values',
        plain: 'Encoding as `x ^ (x >> 1)` guarantees neighbours differ in exactly one position.',
        formal: 'popcount(gray(x) ^ gray(x + 1)) = 1 for every x',
        detail: 'A rotary encoder read mid-transition in ordinary binary can return an arbitrary ' +
          'value, because several bits change at once and they do not change simultaneously — ' +
          'going from 0111 to 1000 has a moment where every bit is in flight. With a Gray code ' +
          'only one bit is ever changing, so a mid-transition reading is one of the two ' +
          'neighbours and nothing else. The same property is why Gray codes appear in Karnaugh ' +
          'maps and in some genetic-algorithm encodings.',
        example: 'The demo checks the single-bit property over 20 001 consecutive pairs and ' +
          'reports 0 failures.'
      },
      {
        term: 'These are primitives under other structures, not standalone optimisations',
        plain: 'A profiler will almost never point at an arithmetic loop; these matter because something else is built from them.',
        formal: 'bitset iteration, allocator free-block search, GC mark counting and move generation are all these routines',
        detail: 'Reaching for a bit trick because a loop looks slow is nearly always misdirected ' +
          'effort. Where they earn their place is one level down: a bitset’s iterator is ' +
          '`x & −x` plus `x & (x − 1)`, a buddy allocator finds the right free list with ' +
          'count-leading-zeros, a garbage collector counts live objects in a mark bitmap with ' +
          'popcount, and a chess engine generates every knight move at once with shifts and masks. ' +
          'In cryptography the calculus inverts entirely: there branchless is a requirement, ' +
          'because a branch on secret data is a timing channel.',
        example: 'The succinct structures in M09 are rank and select built from exactly this ' +
          'machinery, and 17.3 measures a bitset iterating 19.6× faster because of it.'
      }
    ],

    'bitsets-and-swar': [
      {
        term: 'A bitset costs the universe; a hash set costs the population',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["bitset: one bit per possible value"] --> B["cost depends on the RANGE"]',
            '    C["hash set: one entry per value present"] --> D["cost depends on the COUNT"]',
            '    B --> E["10 elements from 0 to a million:<br/>the bitset is wasteful"]',
            '    D --> F["800 000 elements from 0 to a million:<br/>the bitset wins by an order of magnitude"]'
          ].join('\n'),
          caption: 'They are priced on different quantities, so neither is generally better. Density is the whole question, and it is the one people forget to ask.'
        },
        plain: 'One is flat in the number of elements present and the other is proportional to it, so they cross exactly once.',
        formal: 'bitset bytes = ⌈universe / 8⌉ regardless of contents; Set bytes grow with the count',
        readAs: 'The bitset needs one bit for every value that could be in it, rounded up to whole ' +
          'bytes, and that total never changes; a hash set needs an entry for each value actually stored.',
        detail: 'This single sentence is the whole decision. Because one line is flat and the other ' +
          'is a straight diagonal, there is exactly one crossing point and it can be solved for ' +
          'rather than guessed at. Above it the bitset wins by up to two orders of magnitude; ' +
          'below it the hash set is genuinely smaller and reaching for a bitset is a mistake. The ' +
          'crossing depends on the per-entry cost of the hash set, so any claim about it has to ' +
          'state that number or it is not a measurement.',
        example: 'At a million-element universe the demo puts the crossing at 3 906 elements — a ' +
          'density of 0.391% — under a stated model of 32 bytes for a Set entry.'
      },
      {
        term: 'The memory comparison is a model, and the model is stated',
        plain: 'JavaScript will not tell you how large a Set is, so the per-entry cost is an assumption carried through every figure.',
        formal: 'every ratio here is derived from SET_BYTES_PER_ENTRY = 32, one hash slot plus one entry record',
        detail: 'A number that cannot be measured has to be declared, and declaring it is what ' +
          'makes the conclusion checkable: halve the estimate and the crossing density doubles, ' +
          'and a reader who thinks V8 costs more per entry can move it themselves. Quoting a ' +
          'memory ratio without saying what a Set entry was assumed to cost would be inventing a ' +
          'measurement, which is a different failure from getting one wrong — nobody can tell it ' +
          'is happening.',
        example: 'The demo reports the crossing as "3 906 elements — 0.391%" and names the 32-byte ' +
          'assumption in the same note.'
      },
      {
        term: 'Word operations cost the universe whatever the answer is',
        plain: 'An intersection reads every word even when it returns four hundred elements out of forty thousand.',
        formal: 'union, intersection and difference each touch ⌈universe / 32⌉ words, independent of both populations',
        readAs: 'All three operations run one pass over the same number of machine words, found by ' +
          'dividing the universe size by thirty-two and rounding up, no matter how many elements ' +
          'either side actually holds.',
        detail: 'This is the strength and the weakness in one property. The loop has no branches to ' +
          'mispredict and a perfectly sequential access pattern, so it runs at memory bandwidth ' +
          'and the processor prefetches it flawlessly — which is worth more on modern hardware ' +
          'than the byte count alone suggests. It is also why intersecting two ten-element sets ' +
          'over a million-element universe reads 31 250 words to produce an answer a hash-set ' +
          'probe would find in ten, and that case is the one where the general-purpose structure ' +
          'wins on speed as well as on memory.',
        example: 'The demo’s three operations each touch 31 250 words while returning 417, ' +
          '39 583 and 19 583 elements, with 0 disagreements against a real `Set`.'
      },
      {
        term: 'Iterate the population, never the universe',
        plain: 'Testing every possible element costs the universe size; isolating and clearing the lowest set bit costs the population.',
        formal: 'the fast walk is one step per set bit plus one per word; the scan is one step per possible element',
        detail: 'The naive loop is the one everybody writes first and it silently makes a sparse ' +
          'bitset useless: a thousand elements in a million-element universe cost a million tests. ' +
          'The fast walk uses `x & −x` to isolate the lowest set bit, `Math.clz32` to turn that ' +
          'power of two into an index, and `x & (x − 1)` to clear it, so it visits exactly the ' +
          'positions that are set. This is the single most important reason the bit tricks of 17.2 ' +
          'are in a data-structures course at all.',
        example: 'At 20 000 elements in a million-element universe the demo measures 51 031 steps ' +
          'against 1 000 000 — a saving of 19.6×.'
      },
      {
        term: 'A sieve is the friendliest case a bitset has',
        plain: 'The set is dense by construction and the universe is known before the first write.',
        formal: 'the sieve of Eratosthenes to 10⁶ marks 921 501 composites, and both representations write the same marks',
        detail: 'Both implementations run the identical algorithm and perform the identical number ' +
          'of writes, so the comparison isolates the representation exactly: nothing about the ' +
          'work differs, only where the bits live. That makes it the clean demonstration of the ' +
          'memory argument, and it is also the shape that makes a bitset obviously right — the ' +
          'bound is known in advance, the occupancy is over ninety per cent, and every element is ' +
          'touched. Real workloads rarely offer all three.',
        example: 'The demo measures 2 122 048 marks written by both, at 122.1 KB against 28.1 MB — ' +
          'a ratio of 235.9× under the stated model.'
      },
      {
        term: 'Density is not uniform, which is why real bitmaps switch representation',
        plain: 'Data is dense in some regions of the key space and sparse in others, and one choice cannot suit both.',
        formal: 'Roaring partitions the universe into 65 536-element blocks and picks array, bitmap or run per block',
        detail: 'The crossing density is a property of a whole set, and a whole set is the wrong ' +
          'granularity for real data: user ids cluster, timestamps cluster, document ids cluster. ' +
          'Choosing one representation for the entire universe means being wrong about most of ' +
          'it. Roaring bitmaps — built in M09 — make the choice per block, which is why they beat ' +
          'both a plain bitset and a sorted array on data that has any structure at all, and lose ' +
          'to a plain bitmap on data that is uniformly dense.',
        example: 'The M09 measurements have Roaring at 41 232 bytes on sparse data where a raw ' +
          'bitmap is 630 784, and losing outright on dense data at 8 208 against 8 192.'
      },
      {
        term: 'A bitboard is the same idea on a fixed 8 × 8 grid',
        plain: 'One 64-bit word per piece type, and every destination computed at once by shifting and masking.',
        formal: 'a knight’s eight destinations are eight shifts of the source board, each masked to the files it may not wrap onto',
        detail: 'Shifting a board left by one moves every piece one file east, including the piece ' +
          'on the h file, which reappears on the a file of the next rank. The mask after the shift ' +
          'is what removes it, and the mask is different for the one-file jumps than for the ' +
          'two-file ones: a knight leaving the g file eastwards lands two files over, so both g ' +
          'and h have to be excluded. Getting this wrong does not look like a bug — it looks like ' +
          'a piece that occasionally teleports across the board.',
        example: 'The demo computes a knight’s destinations from d4 in 16 shift-and-mask ' +
          'operations against a 64-square walk, with 0 disagreements.'
      },
      {
        term: 'The bound has to be one you can defend',
        plain: 'Integers, dense and bounded — all three, and the third is the one that changes underneath you.',
        formal: 'a bitset over 32-bit ids is 512 MB; over UUIDs the universe is 2¹²⁸ and the structure does not exist',
        detail: 'A bitset over user ids is entirely reasonable while the ids are a sequence and ' +
          'entirely impossible the day they become UUIDs, and that migration happens for reasons ' +
          'that have nothing to do with this data structure — which is exactly what makes it a ' +
          'trap. The bound is a coupling to a decision made elsewhere, and it should be written ' +
          'down where the structure is chosen rather than discovered when the allocation fails. ' +
          'Where the bound is genuinely fixed — squares on a board, days in a year, flags in a ' +
          'protocol — the structure is unimprovable.',
        example: '17.10 measures exactly that migration from the other side: random UUIDs touch 64 ' +
          'index pages in a 64-insert window where a sequential id touches 14.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
