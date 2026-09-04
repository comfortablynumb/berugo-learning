/** Concepts for IEEE 754, its hazards, and the exact representations (M17.4-M17.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'ieee-754': [
      {
        term: 'A finite double is a rational number, exactly',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["you write 0.1"] --> B["the nearest double is stored"]',
            '    B --> C["that double is not 0.1 —<br/>it is a different, exact rational"]',
            '    C --> D["printing shows 0.1 because the<br/>printer picks the shortest decimal<br/>that round-trips"]',
            '    D --> E["so the error is in the input,<br/>not in the arithmetic"]'
          ].join('\n'),
          caption: 'There is no fuzz in a double. Every one of them is an exact number — just not always the one you typed, which is a completely different problem to reason about.'
        },
        plain: 'Not "0.1 with a bit of error" — a specific other number, with a terminating decimal expansion.',
        formal: '0.1 is exactly 3602879701896397 / 2⁵⁵, which written out is 0.1000000000000000055511151231257827021181583404541015625',
        detail: [
          'The format is a sign, a 53-bit integer and a power of two, and that is the definition ' +
            'rather than an approximation of it.',
          'Because the denominator is always a power of two, the decimal expansion always ' +
            'terminates. Its length is the number of factors of two in that denominator, which is ' +
            'why 0.1 needs fifty-five places.',
          'Seeing all of them is what turns a vague unease about floating point into a specific, ' +
            'checkable fact. It is why the demo prints the whole expansion rather than a readable ' +
            'prefix.'
        ],
        example: 'The demo shows 0.1 with all fifty-five decimal places and the fraction ' +
          '3602879701896397 / 36028797018963968 beside it.'
      },
      {
        term: 'The spacing doubles at every power of two',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["between 1 and 2"] --> B["doubles are evenly spaced,<br/>a fixed gap apart"]',
            '    C["between 2 and 4"] --> D["same count of doubles,<br/>twice the range — so twice the gap"]',
            '    D --> E["and again at 4, at 8, at 16"]',
            '    E --> F["precision is relative: big numbers<br/>are coarse, small ones are fine"]'
          ].join('\n'),
          caption: 'This is why absolute tolerances fail. A gap that is invisible near 1 is larger than your epsilon near a million, and the same comparison changes meaning.'
        },
        plain: 'Representable doubles are evenly spaced within a binade and twice as far apart in the next one up.',
        formal: 'the gap is 2.2204e-16 at 1.0, exactly 1 at 2⁵², and 2 at 2⁵³',
        detail: [
          'This one sentence explains nearly everything people say about floating point.',
          'The mantissa has a fixed number of bits, so within any range from one power of two to the ' +
            'next there are exactly 2⁵² representable values evenly spread. The range itself doubles ' +
            'each time, so the spacing does too.',
          'Above 2⁵³ the gap exceeds one, half the integers stop existing, and `x + 1 === x` becomes ' +
            'true. That is the boundary `Number.MAX_SAFE_INTEGER` names.'
        ],
        example: 'The demo’s ladder reports the gap as 1 at 2⁵², 2 at 2⁵³ and 262 144 at 2⁷⁰. The ' +
          '"x + 1 changes x" column flips to no at 2⁵³.'
      },
      {
        term: 'The exponent is biased so the bit pattern sorts like the value',
        plain: 'Storing the exponent plus 1023 makes a positive double’s 64 bits increase monotonically with it.',
        formal: 'stored exponent 1 … 2046 means unbiased −1022 … 1023; 0 and 2047 are the two special cases',
        detail: [
          'Biasing rather than storing a signed exponent is what lets `nextAfter` be an integer ' +
            'increment of the raw pattern.',
          'It also lets two positive doubles be compared as integers, and lets the ULP distance ' +
            'between two values be computed by subtracting their patterns.',
          'It is why the exponent field sits above the mantissa field, too. A mantissa that carries ' +
            'into the exponent is exactly the step from the top of one binade to the bottom of the ' +
            'next. Nothing special has to be written to handle it.'
        ],
        example: 'The demo shows 0.1 with a stored exponent of 1019, which is −4 after the bias, ' +
          'and its two neighbours are one integer step away in the raw pattern.'
      },
      {
        term: 'The leading one is implied, and a subnormal is the value with no implied one',
        plain: 'A stored exponent of zero is the signal that the leading bit is not there.',
        formal: 'normal: ±1.fraction × 2^(e−1023); subnormal: ±0.fraction × 2^−1022',
        readAs: 'A normal number is the fraction bits with a one glued on the front, scaled by two ' +
          'to the stored exponent less the bias. A subnormal drops that leading one and holds the ' +
          'exponent fixed at the bottom of the range.',
        detail: [
          'Not storing the leading one buys a free bit of precision for every normal number, which ' +
            'is the whole reason for the convention.',
          'It needs an escape hatch for values too small to have one, and that is what a stored ' +
            'exponent of zero is.',
          'The result is gradual underflow: precision degrades bit by bit down to the smallest ' +
            'subnormal, instead of the format falling off a cliff into zero. That is what makes ' +
            '`a − b === 0` imply `a === b`, which would otherwise be false near the bottom of the ' +
            'range.'
        ],
        example: 'The demo reports the smallest normal at 2.2250738585072014e-308 and the smallest ' +
          'subnormal at 5e-324, and stepping down from the first lands in the subnormals.'
      },
      {
        term: 'Zero, infinity and NaN are values in the format, not error states',
        plain: 'A stored exponent of all ones is infinity when the fraction is zero and NaN when it is not.',
        formal: '2⁵³ − 2 distinct NaN patterns exist, and every comparison with a NaN except ≠ is false',
        detail: [
          'NaN carries a 52-bit payload, which is what "quiet" and "signalling" distinguish, and ' +
            'what some runtimes use to smuggle type tags into doubles.',
          'The comparison rule is the one that bites. `NaN !== NaN` is required by the standard, so ' +
            'a NaN in a sort key makes the comparator violate transitivity. A NaN in a `Set` also ' +
            'behaves differently from a NaN in an `===` test.',
          'There are two zeros as well. `-0 === 0` is true and `1 / -0` is −Infinity, so the sign ' +
            'survives division and not comparison.'
        ],
        example: 'The demo classifies any typed value as normal, subnormal, zero, infinity or NaN ' +
          'from the stored exponent and fraction alone.'
      },
      {
        term: 'nextAfter walks the representation, not the value',
        plain: 'For a positive double the integer ordering of the 64 bits is the ordering of the values, so the step is +1.',
        formal: 'the four cases that break a hand-written version are zero, the subnormal boundary, a binade crossing and the largest finite value',
        detail: [
          'Because the exponent sits above the mantissa and is biased, incrementing the raw pattern ' +
            'of a positive double gives exactly the next representable one.',
          'That includes crossing a binade boundary, where the mantissa carries into the exponent, ' +
            'and crossing the subnormal boundary, where the implicit one appears.',
          'A version written from the value instead has to special-case all four. The usual mistake ' +
            'is stepping from zero to the smallest normal rather than to the smallest subnormal.'
        ],
        example: 'The demo’s audit checks all four boundaries plus three more and reports 7 of 7 ' +
          'holding.'
      },
      {
        term: 'Every tolerance is a statement about a scale, and stops being true at another',
        plain: 'An absolute epsilon is strict near 1 and vacuous near 10⁹; a relative one breaks near zero.',
        formal: 'at a tolerance of 1e-9: 1e9 + 1 and 1e9 are "different" absolutely and "equal" relatively; 1e-12 and 2e-12 are the reverse',
        detail: [
          'Neither comparison is wrong. Each encodes a magnitude, and the encoding is invisible at ' +
            'the call site, which is why the same helper gets copied between modules operating at ' +
            'completely different scales.',
          'The measure that behaves identically everywhere is the count of representable doubles ' +
            'between the two values. That is defined in terms of the format rather than in terms of ' +
            'a number somebody picked.',
          'Almost nobody writes it, and it is four lines.'
        ],
        example: 'The demo puts 1e9 + 1 and 1e9 at 8 388 608 doubles apart, and 1e-12 and 2e-12 at ' +
          '4 503 599 627 370 496. An absolute tolerance calls the second pair equal.'
      },
      {
        term: 'binary32 is not a smaller binary64, it is a different format',
        plain: 'Narrowing costs precision measured in ULPs of the original, and the cost is enormous.',
        formal: '0.1 narrowed to binary32 and back is 107 374 182 representable doubles away',
        detail: [
          'The binary32 format has 24 bits of significand against 53, so the round trip discards 29 ' +
            'bits.',
          'That is why a `Float32Array` holding what was computed as a double is not a memory ' +
            'optimisation but a precision decision. It is also why graphics code that "works in ' +
            'floats" is making a claim about its error budget.',
          'The exponent range narrows too, so values that are ordinary doubles become infinities or ' +
            'subnormals on the way through. GPUs, neural-network inference and audio all trade ' +
            'precision for bandwidth here deliberately.'
        ],
        example: 'The demo reports the narrowing cost for any typed value; for 0.1 the stored ' +
          'binary32 is 0.10000000149011612.'
      }
    ],

    'floating-point-hazards': [
      {
        term: 'Addition is commutative and not associative',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["the same four numbers"] --> B["added left to right"]',
            '    A --> C["added largest first"]',
            '    A --> D["added in pairs"]',
            '    B --> E["three different results,<br/>all correctly rounded"]',
            '    C --> E',
            '    D --> E'
          ].join('\n'),
          caption: 'Reordering a sum is not a refactor. Parallelising a reduction changes the order, which changes the answer — and the answer was never wrong to begin with.'
        },
        plain: 'Four orderings of one array are four different computations, and they are allowed to disagree.',
        formal: 'the same 200 001 values summed four ways land 0, 41 434 and 50 078 representable doubles from the exact total',
        detail: 'This is the honest answer to "the batch job and the streaming job produce ' +
          'different totals", and it is not a bug in either of them. Reordering changes which ' +
          'roundings happen and in which direction, so a parallel reduction, a serial loop and a ' +
          'sorted sum genuinely compute different things. It also means a total is not a stable ' +
          'identifier: hashing one, comparing two for equality, or asserting a golden value in a ' +
          'test are all sensitive to a scheduling decision made somewhere else.',
        example: 'The demo’s four orderings produce 3 distinct naive sums and one Kahan sum, ' +
          'which is the real argument for compensation.'
      },
      {
        term: 'Same-signed error accumulates linearly, not as a random walk',
        plain: 'When every value has the same sign the roundings all go the same way and add up.',
        formal: 'naive summation of 200 001 values reaches an absolute error of 1.002e+5 against 7.126e-1 for Kahan',
        detail: 'The usual intuition — that rounding errors are random and mostly cancel — is ' +
          'right for mixed-sign data and wrong for the common case of adding up positive ' +
          'quantities. Once the accumulator is much larger than the addend, each addition ' +
          'discards the addend’s low bits in the same direction, so the error grows with n rather ' +
          'than with its square root. That is why a total over a million rows is far worse than ' +
          'the per-row error suggests, and why the fix is structural rather than a matter of ' +
          'being careful.',
        example: 'On the demo’s default data the naive relative error is 1.002e-11 and pairwise, ' +
          'costing no extra arithmetic at all, is 4.329e-15.'
      },
      {
        term: 'Absorption is the point at which a value contributes nothing',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["a running total of 10 million"] --> B["add 0.001"]',
            '    B --> C{"is the addend smaller than<br/>half the local gap?"}',
            '    C -->|yes| D["it rounds away completely —<br/>the total does not move"]',
            '    C -->|no| E["it registers"]',
            '    D --> F["add it a million times and<br/>the total still does not move"]'
          ].join('\n'),
          caption: 'The failure is not that the sum drifts. It is that a term stops being counted at all, silently, once the total has grown past it.'
        },
        plain: 'An addend smaller than half the local gap rounds away completely.',
        formal: 'the gap at 10¹⁶ is 2, so 10¹⁶ + 1 is 10¹⁶ and 10¹⁶ + 1.5 is not',
        detail: 'Every individual addition here is correctly rounded and no error is reported, ' +
          'which is what makes this failure so quiet: a loop adding a million small values into a ' +
          'large accumulator can lose every one of them while behaving exactly as specified. The ' +
          'threshold is half the gap because the default rounding mode is round-half-to-even, so ' +
          'an addend of exactly half the gap leaves the sum on the even neighbour — which is why ' +
          'the ladder shows 10¹⁶ + 1 unchanged and 10¹⁶ + 1.5 changed.',
        example: 'The demo’s absorption table shows the sum unchanged at addends of 0.5 and 1, and ' +
          'changed from 1.5 upwards.'
      },
      {
        term: 'Kahan carries the discarded bits forward',
        plain: '`t − sum` recovers the part of the addend that survived, so `(t − sum) − y` is the part that did not.',
        formal: 'four operations per element instead of one, for an error bound that no longer grows with n',
        detail: 'The compensation variable holds exactly what the last addition threw away, and ' +
          'subtracting it from the next addend means each step begins by repaying the previous ' +
          'one’s rounding. The bound it buys is independent of the number of terms, which is the ' +
          'property that matters: it is not that Kahan is more accurate on a thousand values, it ' +
          'is that it is still that accurate on a billion. Neumaier’s variant fixes the case ' +
          'Kahan gets wrong, where the incoming value is larger than the running sum.',
        example: 'The demo measures Kahan at 800 004 operations against naive’s 200 001, reaching ' +
          'the same double the exact BigInt sum rounds to.'
      },
      {
        term: 'Pairwise summation is nearly free and nearly as good',
        plain: 'No extra arithmetic at all — just a balanced tree instead of a chain.',
        formal: '4.329e-15 relative against naive’s 1.002e-11 and Kahan’s 7.126e-17, at 202 048 operations against 200 001',
        detail: 'Because the accumulator never gets far ahead of the addend inside a balanced ' +
          'tree, the error grows with log n rather than n, and the only cost is the recursion ' +
          'itself — which is why it is what NumPy’s `sum` does and why it is the right default ' +
          'when compensation would be over-engineering. It is also the reason a naive parallel ' +
          'reduction is often *more* accurate than the serial loop it replaced, which surprises ' +
          'people who expected parallelism to cost precision.',
        example: 'The demo shows pairwise at 202 048 operations — 1% more than naive — for four ' +
          'orders of magnitude less error.'
      },
      {
        term: 'Cancellation exposes error rather than creating it',
        plain: 'Subtracting two nearly equal numbers throws away the leading digits they agreed on, leaving the noise.',
        formal: 'the textbook quadratic root for x² + 10⁸x + 1 loses about 15 significant digits and leaves a residual of 2.549e-1',
        detail: 'No amount of compensation helps, because the error was already in the operands ' +
          'before the subtraction; what the subtraction does is remove the agreeing digits and ' +
          'promote the disagreeing ones. The only fix is to rewrite the expression so the ' +
          'subtraction does not happen — for the quadratic that means multiplying by the ' +
          'conjugate, and for variance it means never forming a sum of squares. Recognising the ' +
          'shape is the skill: any expression of the form "large minus large, answer small" is ' +
          'this.',
        example: 'The demo’s two formulations of the same root sit 1 541 029 470 702 650 ' +
          'representable doubles apart, with residuals of 2.549e-1 and 1.110e-16.'
      },
      {
        term: 'The one-pass variance formula is cancellation by construction',
        plain: 'Σx² − (Σx)²/n subtracts two enormous nearly equal numbers whenever the data sits far from zero.',
        formal: 'on values clustered around 10⁹ it is wrong by a relative 2.619e+5, and it can return a negative variance',
        readAs: 'Add up the squares of the values, subtract the square of their total divided by ' +
          'the count, and on data far from the origin those two quantities are almost the same ' +
          'size, so nearly every significant digit of the answer disappears.',
        detail: 'A negative variance is not an inaccuracy, it is an impossibility, and it is the ' +
          'clearest signal that this formula is not a numerical method but an algebraic identity ' +
          'that happens to be computable. It is still taught, still in spreadsheet software, and ' +
          'still the first thing people write. The measurement is the argument: five orders of ' +
          'magnitude wrong on data no more adversarial than a sensor reading with an offset.',
        example: 'The demo reports 2.18103808e+4 for the sum-of-squares formula against a true ' +
          '8.32836041e-2.'
      },
      {
        term: 'Welford is the accurate one-pass method, and two passes is more accurate still',
        plain: 'Welford updates the mean by a small deviation and never subtracts anything large.',
        formal: 'measured relative error 1.167e-7 for Welford against 7.010e-11 for two passes',
        detail: 'Welford is the method streaming systems rediscover every few years, and the ' +
          'reason is not that it is the most accurate — the two-pass method is, by four orders of ' +
          'magnitude here — but that it is the most accurate one that reads the data once and ' +
          'keeps constant state. That distinction is the whole engineering content: a batch job ' +
          'can afford two passes, a metrics pipeline cannot, and quoting Welford as "the accurate ' +
          'one" without the two-pass column makes it look better than it is.',
        example: 'The demo puts both beside the sum-of-squares formula, which is wrong by a factor ' +
          'of about 260 000 on the same data.'
      }
    ],

    'fixed-and-decimal': [
      {
        term: 'Doubles do not lose cents by addition, and the folk claim says they do',
        plain: 'A million transactions summed as doubles are out by less than a ten-thousandth of a cent.',
        formal: 'measured: 6.855e-5 of a cent over 10⁶ additions, and the total rounds to the correct cent every time',
        detail: 'This is worth getting right because the usual justification for not using doubles ' +
          'is false, and a false justification is fragile — somebody eventually measures it and ' +
          'concludes the whole concern was superstition. Addition of same-signed values with ' +
          'about the same magnitude is the best case floating point has, and it stays under half ' +
          'a cent at any transaction volume a business reaches. The real reasons are elsewhere, ' +
          'and they are worse.',
        example: 'The demo’s divergence ladder runs to a million transactions and the ' +
          '"crosses half a cent" column stays no at every size.'
      },
      {
        term: 'What a double loses is equality, not accuracy',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["sum a million money amounts<br/>as doubles"] --> B["the total is off by less than<br/>a ten-thousandth of a cent"]',
            '    B --> C["it formats to exactly<br/>the right cent"]',
            '    C --> D["and it does not compare<br/>equal to that cent"]',
            '    D --> E["so the bug is in the ==,<br/>not in the arithmetic"]'
          ].join('\n'),
          caption: 'The folk rule says doubles lose money. They do not; they lose the ability to be compared exactly, which is a different problem with a different fix.'
        },
        plain: 'The total formats to the right cent and does not compare equal to it.',
        formal: 'across 500 independent ledgers of 500 transactions: 442 unequal totals, 0 formatting mismatches',
        detail: 'That combination is the trap. Every display is right, every report is right, and ' +
          '`total === expected` is a coin flip — so the failure surfaces in reconciliation, in a ' +
          'cache key, in a `Map` lookup, in a JSON round trip, or in a test that passes locally ' +
          'and fails in CI, and in none of those places does it look like an arithmetic problem. ' +
          'A scaled integer removes the question rather than reducing the error, which is a ' +
          'different and much stronger property.',
        example: 'The demo reports 88.4% of ledgers producing a total that formats identically to ' +
          'the exact value and is not equal to it.'
      },
      {
        term: 'The cent is genuinely lost at multiplication',
        plain: 'Applying a rate puts the product a fraction of an ulp below a half-cent boundary, and rounding takes the whole cent the other way.',
        formal: 'at 8.75% over 200 000 lines: 2 554 exact ties, 1 026 of them rounded the wrong way, 1 026 cents lost',
        detail: 'The product of an inexact rate and an exact amount lands just below the tie ' +
          'rather than on it, so `Math.round` goes down where the exact rule goes up — and on the ' +
          'ties where the double happens to land just above, it agrees. That partial agreement is ' +
          'what makes the bug survive inspection: a spot check of a dozen line items will almost ' +
          'certainly find none of them. Which rates are affected cannot be reasoned out from the ' +
          'rate, which is the argument for not having to reason about it.',
        example: 'At 20% the demo reports 0 disagreements over the same 200 000 lines, because ' +
          'that rate produces no exact ties at all.'
      },
      {
        term: 'A scaled integer moves every decision to one place',
        plain: 'Ten cents is the integer 10; addition and comparison are exact and total, and only division needs a policy.',
        formal: 'addition, subtraction and comparison on scaled integers are exact at any scale; multiplication doubles the scale and must come back down',
        detail: 'The payoff is not more accuracy, it is that the number of places in the system ' +
          'that make a rounding decision drops to the ones that genuinely have to. That is a ' +
          'structural property: it can be reviewed, it can be tested in one place, and a new call ' +
          'site cannot quietly introduce a fourth rounding behaviour. The cost is that the scale ' +
          'has to be chosen up front and every value carries it, which is why libraries wrap it ' +
          'in a type rather than leaving it to convention.',
        example: 'The demo’s cents column matches the exact rational total exactly at every ' +
          'transaction count, where the double column never compares equal.'
      },
      {
        term: 'The rounding policy is a business rule with a measurable bias',
        plain: 'Half-up sends every tie the same way, so the drift accumulates; half-even splits them.',
        formal: 'over one batch: half-even drifts 177.60 cents, half-up 1 459.60, ceiling 98 848.60',
        detail: 'Bankers’ rounding exists for exactly this reason and the demo measures rather ' +
          'than asserts it: half-up is roughly eight times the drift of half-even on the same ' +
          'data, because it sends all 2 554 ties in one direction while half-even sends them up ' +
          'only when the digit below is odd. Floor and truncate are identical here and differ on ' +
          'negatives, which means a refund is where that choice first becomes visible — a good ' +
          'example of a policy difference that no positive-only test can find.',
        example: 'The demo’s six policies span 197 526 cents on one 200 000-line batch, and the ' +
          'two half-rules span 1 282.'
      },
      {
        term: 'Binary and decimal are exact about different things',
        plain: 'A double halves exactly and cannot hold 0.1; a scaled decimal holds 0.1 exactly and cannot halve 0.05.',
        formal: 'neither format is more accurate; each is closed under a different set of operations',
        detail: 'This is the framing that makes the choice a domain question rather than a quality ' +
          'question. Binary floating point is closed under halving and doubling, which is what ' +
          'physical simulation and signal processing need; decimal is closed under the operations ' +
          'a price list performs, which is what invoicing needs. Asking which is "more accurate" ' +
          'has no answer, and it is the question that produces the worst decisions — usually ' +
          '"use more digits", which fixes nothing.',
        example: 'The demo’s comparison table has binary floating point at yes for exact halving ' +
          'and no for exact decimals, and the scaled integer the other way round.'
      },
      {
        term: 'Exact rationals work and do not scale',
        plain: 'Every operation is a gcd, and the denominators grow without bound.',
        formal: 'summing 1/1 + 1/2 + … + 1/200 exactly reaches a denominator of 293 bits',
        detail: 'Rationals are the right tool for a test oracle, which is exactly what this ' +
          'milestone uses them for: they give an answer nothing else can be checked against. ' +
          'They are the wrong tool for a ledger, because the cost per operation is unbounded and ' +
          'grows with the history rather than with the values — two hundred additions of small ' +
          'fractions produce a denominator no machine word can hold. Every implementation ' +
          'normalises to keep that growth as slow as possible, and it is still unbounded.',
        example: 'The demo charts the denominator’s bit length climbing to 293 over 200 terms ' +
          'while the value stays at 6.878031.'
      },
      {
        term: 'The unit of account is what belongs in the integer',
        plain: 'Cents, satoshis, basis points, tenths of a cent — whatever the domain says is indivisible.',
        formal: 'the scale is chosen from the smallest unit the business can express, not from a desired precision',
        detail: 'Getting this wrong in either direction is expensive. Too coarse and a legitimate ' +
          'value cannot be represented at all — a fee of a tenth of a cent, an exchange rate, a ' +
          'per-unit price on a bulk item — which forces rounding into the *data* rather than into ' +
          'one function. Too fine and every display and every comparison has to know the scale. ' +
          'The question to ask is what the smallest amount is that the domain will ever need to ' +
          'state exactly, and that is a question for the business rather than for the code.',
        example: 'The demo works in cents throughout and applies rates as an exact numerator over ' +
          '10 000, which is basis points — a second scale, chosen for the same reason.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
