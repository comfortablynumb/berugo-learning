/** Worked examples for conditioning, root finding and linear systems (M18.1-M18.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'conditioning-and-error': [
      {
        title: 'Budgeting the digits before writing any code',
        goal: 'Turn a condition number into a statement about how many digits the answer can have, ' +
          'so "is double precision enough here" becomes arithmetic rather than a preference.',
        setup: 'A linear system built to a condition number of 10⁸, solved in double precision, ' +
          'which carries about sixteen decimal digits.',
        steps: [
          {
            do: 'Write down what precision the input already has.',
            why: 'The input is stored in doubles, so it was perturbed before any algorithm ran.',
            work: 'machine epsilon for binary64 is 2.22e-16, so the relative input perturbation is about 1e-16',
            result: 'the error budget starts at 16 digits, not at infinity'
          },
          {
            do: 'Multiply that perturbation by the condition number to get the error bound.',
            why: 'That product is what the condition number is defined to bound.',
            work: '2.22e-16 × 1e8 = 2.22e-8',
            result: 'the answer may be wrong in the eighth decimal place no matter what algorithm runs'
          },
          {
            do: 'Convert the bound to digits.',
            why: 'Digits are what a requirement is usually written in.',
            work: 'log₁₀(1e8) = 8 digits lost, so 16 − 8 = 8 digits kept',
            result: 'eight correct significant digits available, at best'
          },
          {
            do: 'Check the measurement against the budget.',
            why: 'A prediction that is not compared to a measurement is a hope.',
            work: 'the demo at κ = 1.00e8 reports a relative error of 7.49e-10, inside the 2.22e-8 bound',
            result: 'the algorithm used slightly less than its whole budget, which is what stability means'
          },
          {
            do: 'Read the residual on the same row, and notice it says nothing about any of this.',
            why: 'This is the step that stops the residual from being reported as evidence.',
            work: 'the relative residual on that row is 1.55e-16, the same as it is at κ = 1',
            result: 'the residual is constant across the whole sweep while the error moves nine orders'
          }
        ],
        answer: 'The budget and the measurement agree: at κ = 10⁸ the bound allows 2.22e-8 and the ' +
          'solve delivers 7.49e-10, so eight digits survive and the eight the conditioning claimed ' +
          'are genuinely gone. Nothing in the code could have changed that number, which is the ' +
          'point of computing it first. And the residual — 1.55e-16, indistinguishable from its ' +
          'value on the perfectly conditioned row — would have reported success at every point on ' +
          'this calculation.'
      },
      {
        title: 'The Hilbert matrix, where the budget runs out entirely',
        goal: 'Invert the first example: instead of asking how many digits survive, find the size ' +
          'at which none do — on a matrix whose entries could not look more harmless.',
        setup: 'The Hilbert matrix, entries 1/(i + j + 1), solved at sizes 3 through 13 with a ' +
          'known exact right-hand side.',
        steps: [
          {
            do: 'Look at the matrix and form an opinion before measuring.',
            why: 'The point of this example is that the opinion is wrong.',
            work: 'at n = 3 the entries are 1, 1/2, 1/3, 1/2, 1/3, 1/4, 1/3, 1/4, 1/5 — all between 0.2 and 1',
            result: 'nothing about the entries suggests trouble'
          },
          {
            do: 'Measure the condition number at n = 3 and at n = 13.',
            why: 'To see the growth rate rather than a single value.',
            work: 'κ goes from 5.24e2 at n = 3 to 1.73e18 at n = 13, roughly ×1000 for every two rows',
            result: 'ten extra rows cost fifteen orders of magnitude of conditioning'
          },
          {
            do: 'Apply the digit budget at n = 13.',
            why: 'The same arithmetic as the first example, at a size where it runs out.',
            work: 'log₁₀(1.73e18) = 18.2 digits lost against the 16 a double carries',
            result: 'the budget is exhausted with two digits to spare on the wrong side'
          },
          {
            do: 'Read the measured error and confirm it.',
            why: 'A prediction of "no correct digits" should be checkable.',
            work: 'the relative error at n = 13 is 2.01e0 — larger than the answer itself',
            result: 'the computed solution has no relationship to the true one'
          },
          {
            do: 'Read the residual on the same row.',
            why: 'Because the residual is what an automated check would have looked at.',
            work: 'the relative residual at n = 13 is 2.04e-16, the same as at n = 3',
            result: 'every automated correctness check based on the residual passes'
          }
        ],
        answer: 'By n = 13 the answer has no correct digits and the residual is 2.04e-16 — ' +
          'unchanged from the size where the answer was good to fourteen. The reason the Hilbert ' +
          'matrix is this bad is worth carrying: its columns are samples of 1, x, x², …, and those ' +
          'functions become nearly indistinguishable over a fixed interval as the degree rises, so ' +
          'the columns become nearly parallel. That is the same mechanism that makes polynomial ' +
          'fitting by monomials fail in 18.4, and it means the fix is never a better solver — it ' +
          'is a different basis.'
      }
    ],

    'root-finding': [
      {
        title: 'Reading the convergence order off the iterates',
        goal: 'Measure Newton’s order from the errors it actually produced, rather than quoting ' +
          'the theoretical 2 — and see why the same measurement is meaningless for bisection.',
        setup: 'f(x) = x³ − 2x − 5 with its root at 2.0945514815423265, Newton started at x₀ = 3.0, ' +
          'and a tolerance of 1e-12.',
        steps: [
          {
            do: 'Take consecutive iterate errors and form the ratio log|e_{k+1}| / log|e_k|.',
            why: 'If the error follows |e_{k+1}| ≈ C|e_k|^p, that ratio estimates p.',
            work: 'the fit over the usable steps gives 1.957, against a theoretical 2',
            result: 'quadratic convergence confirmed from the data'
          },
          {
            do: 'Discard the steps at machine precision before fitting.',
            why: 'Once the error is at 1e-16 it is rounding, and including those steps fits noise.',
            work: 'the last steps sit at ~1e-16 and are excluded; the fit uses the steps above it',
            result: 'the 1.957 is measured on the region where the theory applies'
          },
          {
            do: 'Do the same for the secant method.',
            why: 'To check the golden ratio prediction, which is less well known and equally real.',
            work: 'the secant fit gives 1.580, against φ = 1.618',
            result: 'superlinear but below quadratic, exactly as the recurrence predicts'
          },
          {
            do: 'Try the same fit on bisection and reject the result.',
            why: 'Bisection halves the BRACKET, not the error, so its iterate error is not geometric.',
            work: 'an earlier version of this demo fitted 1.857 for bisection, inviting a comparison against Newton’s 1.957',
            result: 'the number is meaningless and the column is left blank'
          },
          {
            do: 'Report bisection’s bracket contraction instead.',
            why: 'That is the quantity bisection actually controls, and it is exact.',
            work: 'the measured contraction is 0.5000 per step; false position’s is 1.0000',
            result: 'two bracketing methods separated by the number that describes them'
          }
        ],
        answer: 'Newton fits 1.957 and the secant 1.580, close enough to 2 and 1.618 to confirm ' +
          'both theories from data. The instructive part is the method that has no order: fitting ' +
          'one to bisection produced a confident 1.857, which is not a convergence order at all — ' +
          'it is a curve fitted to a sequence that does not have the assumed form. The right ' +
          'characterisation is its bracket contraction of exactly 0.5000, and next to false ' +
          'position’s 1.0000 that one number explains why a bracketing method can be worse than ' +
          'halving.'
      },
      {
        title: 'The failure that returns a correct answer to the wrong question',
        goal: 'Drive Newton into its third failure mode and confirm that nothing in the return ' +
          'value distinguishes it from success.',
        setup: 'f(x) = x³ − 2x, whose roots are −√2 ≈ −1.414214, 0 and +√2 ≈ 1.414214, started ' +
          'from nine points between −2.0 and 1.5.',
        steps: [
          {
            do: 'Find where the derivative vanishes, because that is where the tangent is flat.',
            why: 'A flat tangent sends the next iterate far away, so the basin boundaries live there.',
            work: 'f′(x) = 3x² − 2 is zero at ±√(2/3) = ±0.816497',
            result: 'a boundary to test either side of'
          },
          {
            do: 'Start at 0.75, just below the boundary, and see where it lands.',
            why: 'The nearest root to 0.75 is 0, at a distance of 0.75.',
            work: 'Newton converges in 8 iterations to −1.414214, at a distance of 2.16 from the start',
            result: 'it crossed the root at zero to reach a root on the other side'
          },
          {
            do: 'Walk the start up to 0.8150 and then to 0.8165.',
            why: 'To locate the boundary rather than assert it.',
            work: '0.8150 gives −1.414214 in 19 iterations; 0.8165 gives +1.414214 in 34',
            result: 'the answer flips within 0.0015 of the point where the derivative vanishes'
          },
          {
            do: 'Inspect what the function returned in the failing cases.',
            why: 'This is the step that makes the failure mode dangerous rather than annoying.',
            work: 'f(−1.414214) = 0 to fifteen digits; the residual is at machine precision',
            result: 'the answer is a genuine root and every correctness check passes'
          },
          {
            do: 'Count how many of the nine starting points did this.',
            why: 'To see it is a region rather than a knife edge.',
            work: '3 of 9 starting points converge to a root that is not the nearest one',
            result: 'a third of a reasonable sample of starting points, silently'
          }
        ],
        answer: 'Three of nine starting points return a root that is not the one near where they ' +
          'started, and every one of those answers satisfies f(x) = 0 to fifteen digits. There is ' +
          'no error, no warning and no field in the result that records which basin was entered. ' +
          'This is why a bare Newton is unsafe as a library routine and why every production ' +
          'finder is a hybrid: a bracket is the only structure that ties the answer to the region ' +
          'you asked about, and Newton has no bracket at all.'
      }
    ],

    'linear-systems': [
      {
        title: 'A pivot small enough to lose the answer, and no error raised',
        goal: 'Follow the elimination on a two-by-two system by hand and find the exact step at ' +
          'which the information is destroyed.',
        setup: 'The system [[ε, 1], [1, 1]] x = [1, 2] with ε = 1e-18, whose exact solution is ' +
          'x₁ = 1/(1 − ε) ≈ 1 and x₂ = 2 − x₁ ≈ 1.',
        steps: [
          {
            do: 'Eliminate without pivoting and write down the multiplier.',
            why: 'The multiplier is the quantity pivoting exists to bound.',
            work: 'm = 1 / ε = 1e18',
            result: 'the second row will be scaled by a factor of 1e18'
          },
          {
            do: 'Apply it to the second row and watch the original entry disappear.',
            why: 'This is the moment the information is lost, and it is an addition, not a division.',
            work: '1 − 1e18 × 1 = −1e18 in exact arithmetic; in a double, 1 − 1e18 rounds to exactly −1e18',
            result: 'the 1 that was in that position has been rounded away entirely'
          },
          {
            do: 'Do the same to the right-hand side.',
            why: 'The same cancellation happens there, and it decides the answer.',
            work: '2 − 1e18 × 1 rounds to −1e18',
            result: 'back-substitution now gives x₂ = 1 exactly, and x₁ = (1 − x₂)/ε = 0/ε = 0'
          },
          {
            do: 'Compare the computed answer to the exact one.',
            why: 'To see the size of the failure in the units that matter.',
            work: 'computed [0, 1] against exact [1, 1]: relative error 7.07e-1, growth factor 1e18',
            result: 'the first component is wrong by 100% and no exception was raised'
          },
          {
            do: 'Swap the two rows and repeat.',
            why: 'To confirm the fix costs nothing.',
            work: 'the multiplier becomes ε = 1e-18, the growth factor is 1, and the answer is [1, 1] with a residual of 0',
            result: 'one row swap, exact answer'
          }
        ],
        answer: 'The answer was destroyed by an addition, not a division: 1 − 1e18 rounds to ' +
          '−1e18, and the entry that carried the second equation’s information vanished. ε was ' +
          '1e-18, which is small and not zero, so no singularity check fires anywhere in the ' +
          'process — the computation is well defined at every step and produces [0, 1]. Swapping ' +
          'the rows costs one comparison and returns the exact answer with a growth factor of 1. ' +
          'The lesson is that pivoting is about the size of the multiplier, and a check for zero ' +
          'catches none of it.'
      },
      {
        title: 'Pricing the three ways to apply a matrix twenty times',
        goal: 'Compare factor-and-reuse, solve-from-scratch and form-the-inverse on both axes — ' +
          'work and accuracy — and find which of the three is worse on both.',
        setup: 'A symmetric positive definite matrix of size 60 with condition number 1e6, and ' +
          'twenty right-hand sides derived from known solutions.',
        steps: [
          {
            do: 'Count the factorisations each approach performs.',
            why: 'The factorisation is the cubic-cost step; everything else is quadratic.',
            work: 'reuse: 1; from scratch: 20; inverse: 1 factorisation plus 60 solves to build it',
            result: 'the middle option does nineteen redundant cubic-cost operations'
          },
          {
            do: 'Measure the worst relative error of factor-and-reuse and of solve-from-scratch.',
            why: 'To establish that reuse costs nothing in accuracy.',
            work: 'both report the same worst relative error, around 2e-11',
            result: 'bit-identical answers — reuse is purely a saving'
          },
          {
            do: 'Measure the inverse route on the same right-hand sides.',
            why: 'This is the comparison the rule of thumb is about.',
            work: 'around 2e-10 against around 2e-11',
            result: 'several times worse than the factorisation it was built from'
          },
          {
            do: 'Read the ratio as a band rather than a decimal.',
            why: 'It divides two rounding errors, so its digits belong to the engine.',
            work: '8.4x on one JavaScript engine and 6.0x on another, from the same seed, '
              + 'because the Gaussian underneath runs on a `Math.log` that is not required '
              + 'to be correctly rounded',
            result: 'the honest statement is "several times", and the mechanism is what transfers'
          },
          {
            do: 'Explain the factor rather than just reporting it.',
            why: 'A number without a mechanism is a coincidence.',
            work: 'each of the 60 columns of A⁻¹ is itself a rounded solve, so applying it applies 60 rounded answers instead of 1',
            result: 'the inverse accumulates its rounding before the caller asks anything'
          },
          {
            do: 'Add up the cost of the inverse route.',
            why: 'To close both axes of the comparison.',
            work: 'building A⁻¹ costs 1 factorisation plus 60 solves; applying it costs the same n² as the triangular pair the factorisation already gives you',
            result: 'strictly more work, for a strictly worse answer'
          }
        ],
        answer: 'Factor-and-reuse and solve-from-scratch give bit-identical answers, around ' +
          '2e-11, so choosing between them is purely about the nineteen wasted factorisations. ' +
          'The inverse is the one to remember: around 2e-10, several times worse, for more ' +
          'work — and the ratio is quoted as a band on purpose, because dividing one rounding ' +
          'error by another lands on 8.4 under one engine\'s `Math.log` and 6.0 under ' +
          'another\'s. That is ' +
          'why "never invert a matrix" is a numerical rule and not a stylistic one — `inv(A) @ b` ' +
          'loses on both axes against `solve(A, b)` in every library that offers both, and the ' +
          'mechanism is that every column of the inverse is a solve whose rounding you inherit.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
