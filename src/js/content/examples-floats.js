/** Worked examples for IEEE 754, its hazards, and exact representations (M17.4-M17.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'ieee-754': [
      {
        title: 'Decoding 0.1 by hand, and finding out what it actually is',
        goal: 'Take one double apart into its three fields and rebuild the exact rational it ' +
          'stands for, so "0.1 is not exactly 0.1" becomes a specific other number.',
        setup: 'The demo’s default value, 0.1, with the sign, exponent and mantissa fields shown ' +
          'separately.',
        steps: [
          {
            do: 'Read the stored exponent and remove the bias.',
            why: 'The stored value is offset so the whole pattern sorts like the number; the ' +
              'unbiased exponent is the scale.',
            work: 'stored 1019, minus the bias of 1023, gives −4',
            result: '0.1 sits in the binade from 2⁻⁴ to 2⁻³, that is 0.0625 to 0.125'
          },
          {
            do: 'Restore the implicit leading one to the fraction.',
            why: 'A normal number does not store its leading bit, which is where the free bit of precision comes from.',
            work: 'the significand with the leading one restored is 7 205 759 403 792 794',
            result: 'a 53-bit integer, which is the whole precision the format has'
          },
          {
            do: 'Assemble the value as that integer times a power of two.',
            why: 'This is the definition of the format, not an approximation of it.',
            work: '3 602 879 701 896 397 / 2⁵⁵, once the fraction is reduced',
            result: 'an exact rational, with a power of two in the denominator'
          },
          {
            do: 'Expand that fraction in decimal, all of it.',
            why: 'A denominator that is a power of two always terminates, and the length is the ' +
              'number of factors of two.',
            work: '0.1000000000000000055511151231257827021181583404541015625 — fifty-five places',
            result: 'not "0.1 with error" but a different, entirely specific number'
          },
          {
            do: 'Ask what the two neighbouring doubles are.',
            why: 'To see that there is nothing in between, and how far apart they are.',
            work: 'the gap above and below are both 1.3878e-17',
            result: '0.1 is the closest double to one tenth, and the closest is 5.55e-18 away'
          }
        ],
        answer: 'One tenth is not representable in binary for the same reason one third is not ' +
          'representable in decimal: the denominator has a factor the base does not. What is ' +
          'stored is 3 602 879 701 896 397 / 2⁵⁵, which is the nearest double and is larger than ' +
          'one tenth by about 5.55e-18. Every subsequent surprise — that 0.1 + 0.2 lands one ' +
          'representable value above 0.3, that a decimal string round-trips and a sum does not — ' +
          'follows from that single substitution, made once at parse time.'
      },
      {
        title: 'Reading the spacing ladder, and finding the boundary it names',
        goal: 'Invert the first example: instead of taking one value apart, sweep the magnitudes ' +
          'and find where the format stops being able to count.',
        setup: 'The demo’s ladder, from 2⁻¹⁰²² to 2⁷⁰, with the gap between neighbouring doubles ' +
          'reported at each.',
        steps: [
          {
            do: 'Read the gap at 1.0 and check it against machine epsilon.',
            why: 'Machine epsilon is defined as exactly this gap, and the two are constantly confused.',
            work: 'the gap above 1.0 is 2.2204e-16, which is 2⁻⁵²',
            result: 'epsilon is a gap at one specific magnitude, not a universal tolerance'
          },
          {
            do: 'Follow the gap upwards and confirm it doubles at every power of two.',
            why: 'The mantissa width is fixed, so the spacing scales with the value.',
            work: '2.3283e-10 at 2²⁰, 2.4414e-4 at 2⁴⁰, and exactly 1 at 2⁵²',
            result: 'a straight line on a log-log chart, with a slope of one'
          },
          {
            do: 'Read the two rows either side of 2⁵³.',
            why: 'This is the boundary the whole ladder exists to locate.',
            work: 'the gap is 1 at 2⁵² and 2 at 2⁵³',
            result: 'above 2⁵³ half the integers are not representable at all'
          },
          {
            do: 'Check the "x + 1 changes x" column at those two rows.',
            why: 'To turn the gap into an observable behaviour rather than a number.',
            work: 'yes at 2⁵² and no at 2⁵³ — adding one to 9 007 199 254 740 992 returns it unchanged',
            result: 'this is exactly what `Number.MAX_SAFE_INTEGER` names'
          },
          {
            do: 'Read the far end of the ladder.',
            why: 'To size what happens well past the boundary rather than just at it.',
            work: 'the gap is 256 at 2⁶⁰ and 262 144 at 2⁷⁰',
            result: 'at 10²¹ consecutive representable values are a quarter of a million apart'
          }
        ],
        answer: 'The single boundary worth memorising is 2⁵³, and the ladder shows why it is a ' +
          'boundary rather than a convention: it is where the spacing between representable ' +
          'doubles reaches 2. Below it every integer exists and integer arithmetic in a double is ' +
          'exact; above it half of them do not, `x + 1 === x` becomes true, and any identifier ' +
          'passing through a JSON number is silently rounded. That is why a 64-bit database id has ' +
          'to cross a JSON boundary as a string, and it is a property of the format rather than ' +
          'of any particular language.'
      }
    ],

    'floating-point-hazards': [
      {
        title: 'Four orderings of one array, and none of them is the bug',
        goal: 'Sum the same values in four orders, score each against the exact total, and settle ' +
          'what "the two systems disagree" actually means.',
        setup: '200 001 values — one of 10¹⁶ followed by 200 000 small positives — summed naively ' +
          'and with Kahan compensation, in four orders, against the exact BigInt sum.',
        steps: [
          {
            do: 'Establish the reference before comparing anything.',
            why: 'Without an exact total, "these disagree" cannot be turned into "this one is wrong".',
            work: 'the exact sum of exactly these doubles is 1.000000000010e+16, computed in BigInt',
            result: 'one number every ordering can be scored against'
          },
          {
            do: 'Sum in the order the values were generated, naively.',
            why: 'This is what a serial loop does, and the large value arrives first.',
            work: '50 078 representable doubles away from the exact total',
            result: 'every small value is absorbed into an accumulator already at 10¹⁶'
          },
          {
            do: 'Sum smallest first.',
            why: 'The folk advice, and it is genuinely right for same-signed data.',
            work: '0 doubles away — it lands exactly on the correctly rounded total',
            result: 'the small values accumulate to a magnitude that survives the large one'
          },
          {
            do: 'Sum largest first and shuffled.',
            why: 'To show the spread rather than a best and a worst.',
            work: '50 078 and 41 434 doubles away, and 3 distinct sums across the four orders',
            result: 'the answer depends on a scheduling decision made elsewhere'
          },
          {
            do: 'Repeat all four with Kahan compensation.',
            why: 'The real argument for compensation is not accuracy, it is determinism.',
            work: '0 doubles away in all four orderings, at 800 004 operations against 200 001',
            result: 'one answer, independent of the order'
          }
        ],
        answer: 'Floating-point addition is commutative and not associative, so these are four ' +
          'different computations of one quantity and all four are correctly rounded at every ' +
          'step. Sorting smallest-first is the best of them and it is also the ordering a parallel ' +
          'reduction cannot give you. What compensation buys is that the answer stops depending on ' +
          'the schedule at all — which is why "the batch job and the streaming job produce ' +
          'different totals" is usually a summation-order question rather than a bug in either.'
      },
      {
        title: 'The formula that is wrong by a factor of 260 000, and the two that are not',
        goal: 'Invert the first example: instead of an error that accumulates over many steps, ' +
          'find one that arrives fully formed in a single subtraction.',
        setup: '200 000 values clustered around 10⁹, with the variance computed three ways and ' +
          'scored against an exact rational reference.',
        steps: [
          {
            do: 'Compute the variance with the textbook one-pass formula.',
            why: 'It is the identity everybody writes first, and it is in spreadsheet software.',
            work: 'Σx² − (Σx)²/n over n gives 2.18103808e+4',
            result: 'a number that looks like a variance'
          },
          {
            do: 'Compare it against the exact answer.',
            why: 'It looks plausible, which is the entire problem.',
            work: 'the true variance is 8.32836041e-2 — a relative error of 2.619e+5',
            result: 'wrong by a factor of about 260 000, with nothing raised'
          },
          {
            do: 'Explain the failure from the shape of the expression.',
            why: 'To recognise it elsewhere rather than memorising this one case.',
            work: 'both terms are near 2 × 10²³ and the answer is near 0.08 — large minus large, answer small',
            result: 'the digits the two terms agreed on are thrown away, and only the noise is left'
          },
          {
            do: 'Compute it in two passes instead.',
            why: 'Subtracting the mean first means nothing large is ever subtracted from anything large.',
            work: '8.32836041e-2, a relative error of 7.010e-11',
            result: 'nine orders of magnitude better, for one extra pass over the data'
          },
          {
            do: 'Compute it with Welford in one pass.',
            why: 'A streaming pipeline cannot afford two passes, so this is the constrained answer.',
            work: '8.32835944e-2, a relative error of 1.167e-7',
            result: 'worse than two passes by four orders of magnitude and better than the textbook by twelve'
          }
        ],
        answer: 'Cancellation cannot be compensated away, because the error was in the operands ' +
          'before the subtraction — what the subtraction does is delete the digits they agreed on. ' +
          'The only fix is to rewrite the expression so it never forms, which for variance means ' +
          'subtracting the mean first. Welford is the right default because it is the most ' +
          'accurate method that reads the data once and keeps constant state, and quoting it as ' +
          '"the accurate one" without the two-pass column overstates it: two passes is four orders ' +
          'of magnitude better still, and a batch job can afford them.'
      }
    ],

    'fixed-and-decimal': [
      {
        title: 'Where a double ledger actually breaks, measured rather than assumed',
        goal: 'Test the usual claim — that summing money in doubles loses cents — against a ' +
          'rational reference, and find the failure that is really there.',
        setup: 'A stream of transactions in whole cents, totalled three ways: as doubles, as ' +
          'scaled integers, and as exact rationals.',
        steps: [
          {
            do: 'Total a thousand transactions and compare against the exact rational sum.',
            why: 'This is the size at which the folk claim is usually made.',
            work: 'the double total is out by 1.019e-8 of a cent',
            result: 'eight orders of magnitude below the smallest unit that exists'
          },
          {
            do: 'Push it to a million transactions.',
            why: 'If the error grows with n, this is where it should start to matter.',
            work: 'out by 6.855e-5 of a cent, still not crossing half a cent',
            result: 'the total rounds to the correct cent at every size tested'
          },
          {
            do: 'Ask whether the total compares equal to the exact value.',
            why: 'Formatting correctly and being equal are different properties.',
            work: 'across 500 independent ledgers: 442 unequal, and 0 that formatted differently',
            result: '88.4% of ledgers produce a value that displays right and is not equal'
          },
          {
            do: 'Apply a rate to every line instead of adding them.',
            why: 'Multiplication is where an inexact factor meets a rounding boundary.',
            work: 'at 8.75% over 200 000 lines: 2 554 exact ties, 1 026 rounded the wrong way',
            result: '1 026 cents — ten dollars — lost on one batch'
          },
          {
            do: 'Change the rate to 20% and repeat.',
            why: 'To check whether the reader could have predicted which rates are safe.',
            work: '0 disagreements over the same 200 000 lines',
            result: 'that rate produces no exact ties at all, and nothing about the rate says so'
          }
        ],
        answer: 'The usual justification is wrong and the real ones are worse. Addition holds up ' +
          'at any volume a business reaches; what a double loses is *equality*, on 88.4% of ' +
          'ledgers, in a way that displays correctly and breaks reconciliation, cache keys and ' +
          'tests. And the cent really is lost the moment a rate is applied: 1 026 line items in ' +
          '200 000 at 8.75%, none at 20%, with no way to tell from the rate which you have. A ' +
          'scaled integer removes the question rather than shrinking the error.'
      },
      {
        title: 'Pricing the rounding policy, and pricing exactness',
        goal: 'Invert the first example: instead of measuring what an inexact representation ' +
          'costs, measure what the two exact ones cost.',
        setup: 'The same 200 000-line batch with a rate applied, run under all six rounding ' +
          'policies, and a separate exact-rational summation with its denominator tracked.',
        steps: [
          {
            do: 'Count how many line items land exactly on a half-cent boundary.',
            why: 'A rounding policy only differs from another one on a tie.',
            work: '2 554 exact ties in 200 000 lines',
            result: 'about 1.3% of the batch is where every policy disagreement lives'
          },
          {
            do: 'Total the batch under half-even and under half-up.',
            why: 'These are the two policies real systems actually choose between.',
            work: 'drift of 177.60 cents against 1 459.60 — a gap of 1 282 cents',
            result: 'half-up sends every tie the same way, so its bias accumulates'
          },
          {
            do: 'Check that the gap is close to half the ties, and say why it is not exactly.',
            why: 'A round number that is nearly right is worth pinning down rather than rounding to.',
            work: '1 282 against 2 554 ties, so 1 277 would be exactly half',
            result: 'half-even rounds up only when the digit below is odd, and ties do not split evenly on that'
          },
          {
            do: 'Read the floor and ceiling rows for scale.',
            why: 'To see that the half-rules are close together and the directed ones are not.',
            work: '−98 677.40 and +98 848.60 cents of drift; the six policies span 197 526',
            result: 'nearly two thousand dollars between the extremes on one batch'
          },
          {
            do: 'Now price exactness: sum 1/1 + 1/2 + … + 1/200 as rationals.',
            why: 'Rationals have no rounding policy at all, and that is what they cost.',
            work: 'the denominator reaches 293 bits while the value stays at 6.878031',
            result: 'unbounded growth in the operand, for a value that fits in a double'
          }
        ],
        answer: 'The rounding policy is worth thousands of cents on a single batch and it is a ' +
          'business rule, not an implementation detail — which is the argument for it living in ' +
          'one function with a test rather than at every formatting site. Half-even is roughly ' +
          'eight times less biased than half-up here, and the reason is exactly that half-up sends ' +
          'all 2 554 ties in one direction. Exact rationals dodge the choice entirely and pay for ' +
          'it with denominators that grow without bound, which is why they belong in the test ' +
          'oracle and not in the ledger.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
