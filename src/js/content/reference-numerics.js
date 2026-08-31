/** Reference entries for conditioning, root finding and linear systems (M18.1-M18.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'conditioning-and-error': {
      summary: 'The distinction between a problem’s conditioning and an algorithm’s stability, ' +
        'measured across nine orders of conditioning where the residual never moves and the ' +
        'answer loses every digit.',
      intuition: 'A small residual means the solver ran; it says nothing about whether the answer ' +
        'is right, and on exactly the problems where you most want reassurance it is reassuring ' +
        'and meaningless.',
      formulation: {
        equations: [
          {
            label: 'The two quantities that get confused',
            expr: 'residual = ‖Ax̂ − b‖; error = ‖x̂ − x*‖',
            terms: [
              { sym: 'residual', meaning: 'computable without knowing the answer, which is why it gets reported' },
              { sym: 'error', meaning: 'needs x*, which is why it usually is not' },
              { sym: 'measured at κ = 1', meaning: 'residual 1.62e-16, error 1.65e-16 — they agree' },
              { sym: 'measured at κ = 1.07e16', meaning: 'residual 1.93e-16, error 1.89e-1 — they do not' }
            ]
          },
          {
            label: 'The bound that ties them together',
            expr: 'relative error ≲ κ(A) × machine epsilon, for a backward-stable algorithm',
            terms: [
              { sym: 'κ(A)', meaning: 'the largest singular value over the smallest — a property of the problem' },
              { sym: 'machine epsilon', meaning: '2.22e-16 for binary64, the relative perturbation storing the input already caused' },
              { sym: 'digits kept', meaning: 'about 16 − log₁₀ κ' },
              { sym: 'every row of the sweep', meaning: 'sits inside this bound, which is what stability means' }
            ]
          },
          {
            label: 'The Hilbert ladder',
            expr: 'entries 1/(i + j + 1), κ multiplying by about 1000 for every two rows',
            terms: [
              { sym: 'n = 3', meaning: 'κ 5.24e2, error 8.02e-15, three digits lost' },
              { sym: 'n = 7', meaning: 'κ 4.75e8, error 1.42e-8' },
              { sym: 'n = 13', meaning: 'κ 1.73e18, error 2.01e0 — no correct digits at all' },
              { sym: 'residual throughout', meaning: 'never leaves 1e-16, at every size' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'A backward-stable algorithm’s forward error stays inside κ times machine epsilon',
          why: 'It separates the two diagnoses: inside the bound blames the problem, outside it blames the code.',
          breaks: 'An error outside the bound is an implementation bug, and is the only reliable signal of one.'
        },
        {
          name: 'The residual is bounded by machine epsilon regardless of conditioning',
          why: 'Which is exactly why it cannot be used as evidence that the answer is correct.',
          breaks: 'A large residual does mean something is wrong — it is a one-way test, not a two-way one.'
        },
        {
          name: 'The condition number is defined before any algorithm is chosen',
          why: 'It bounds what is achievable, so it says whether a disappointing answer can be improved at all.',
          breaks: 'Swapping algorithms to fix an ill-conditioned problem changes the error by a constant factor at best.'
        },
        {
          name: 'Relative error is the currency; absolute error is not comparable across scales',
          why: 'Floating point spacing grows with magnitude, so a fixed absolute tolerance means different things at different sizes.',
          breaks: 'Near zero the relative measure fails instead, which is why tolerances are mixed absolute-and-relative.'
        }
      ],
      complexity: [
        { operation: 'condition number by SVD', average: 'about 10n³ — expensive, and worth it once', worst: 'the same, and it is the number that settles whether anything else can help' },
        { operation: 'residual check', average: 'one matrix-vector product, O(n²)', worst: 'passes at every conditioning, which is the trap' },
        { operation: 'error check', average: 'free if x* is known, impossible otherwise', worst: 'the quantity you want is the one you cannot measure in production' },
        { operation: 'interval arithmetic', average: 'about 2-4× the cost of the plain computation', worst: 'the width grows pessimistically through long computations and certifies nothing useful' }
      ],
      failureModes: [
        {
          symptom: 'A solver reports a residual of 1e-16 and the downstream results are nonsense.',
          cause: 'The problem is ill-conditioned; the residual is bounded by machine epsilon whatever the answer is.',
          fix: 'Compute the condition number, apply the digit budget, and reformulate if the budget is exhausted.'
        },
        {
          symptom: 'A variance computed as E[x²] − E[x]² comes out negative.',
          cause: 'Catastrophic cancellation between two nearly equal large numbers.',
          fix: 'Use Welford’s streaming update, or the two-pass formula, both of which never form that difference.'
        },
        {
          symptom: 'Results differ in the eighth digit between two machines and both are "correct".',
          cause: 'A condition number around 10⁸, so the eighth digit was never determined by the data.',
          fix: 'Assert to the precision the conditioning supports, not to the precision the type carries.'
        },
        {
          symptom: 'Moving from single to double precision does not improve the answer.',
          cause: 'The problem is ill-conditioned enough that both precisions exhaust their budget.',
          fix: 'Change the problem — a different basis, regularisation, or better-scaled units.'
        },
        {
          symptom: 'A reference implementation used to check a solver is itself wrong.',
          cause: 'The "exact" formula was derived in an arrangement that cancels catastrophically.',
          fix: 'Derive the reference in the arrangement that avoids the subtraction, or compute it in exact rational arithmetic.'
        }
      ],
      inTheWild: [
        { system: 'LAPACK', how: 'returns `rcond`, an estimate of the reciprocal condition number, alongside every solve — so the caller can apply the digit budget without a second factorisation.' },
        { system: 'NumPy and SciPy', how: 'expose `numpy.linalg.cond` and warn on `LinAlgWarning: Ill-conditioned matrix` from `scipy.linalg.solve`, which is the library saying the answer may have no correct digits.' },
        { system: 'The Patriot missile failure at Dhahran, 1991', how: 'a 24-bit fixed-point clock accumulated a 0.34-second drift over 100 hours of uptime; the arithmetic was stable and the formulation was not.' }
      ],
      sources: [
        { title: 'Accuracy and Stability of Numerical Algorithms', author: 'Nicholas J. Higham', note: 'The standard reference for everything in this section, and the source of the modern definition of backward stability.' },
        { title: 'Numerical Linear Algebra, lectures 12-15', author: 'Trefethen and Bau', note: 'Conditioning, stability and the relationship between them, in about forty very clear pages.' },
        { title: 'What every computer scientist should know about floating-point arithmetic', author: 'David Goldberg', note: 'Cancellation, guard digits and why the naive formulas fail.' },
        { title: 'IEEE 754-2019', author: 'IEEE', note: 'The normative definition of the rounding that supplies the initial perturbation everything here is measured against.' }
      ]
    },

    'root-finding': {
      summary: 'Five root finders on one function with the convergence order fitted from the ' +
        'iterates, Newton driven into each of its three failure modes, and the bracket ' +
        'contraction that separates the two bracketing methods.',
      intuition: 'Newton is fast when it works and silently divergent when it does not; every ' +
        'production root finder is a hybrid with a bracketing guarantee for exactly that reason.',
      formulation: {
        equations: [
          {
            label: 'The iterations',
            expr: 'Newton steps to where the tangent meets the axis; the secant uses the last two points instead',
            terms: [
              { sym: 'Newton', meaning: 'x − f(x)/f′(x); order 2, two evaluations per step' },
              { sym: 'secant', meaning: 'the same with a finite-difference slope; order φ = 1.618, one evaluation per step' },
              { sym: 'bisection', meaning: 'the midpoint; no order, one bit per step' },
              { sym: 'fixed point', meaning: 'x := g(x); converges when |g′(x*)| < 1' }
            ]
          },
          {
            label: 'Measured on x³ − 2x − 5 from x₀ = 3.0, tolerance 1e-12',
            expr: 'iterations, evaluations and fitted order',
            terms: [
              { sym: 'bisection', meaning: '41 iterations, 43 evaluations, contraction exactly 0.5000' },
              { sym: 'false position', meaning: '31 iterations, contraction 1.0000 — not contracting at all' },
              { sym: 'Newton', meaning: '6 iterations, 12 evaluations, fitted order 1.957' },
              { sym: 'secant', meaning: '8 iterations, 9 evaluations, fitted order 1.580 — the cheapest in the table' },
              { sym: 'Brent', meaning: '9 iterations, 10 evaluations, 7 interpolations and 1 bisection' }
            ]
          },
          {
            label: 'Newton’s three failure modes',
            expr: 'flat derivative, cycling, and the wrong basin',
            terms: [
              { sym: 'divergence', meaning: 'arctan(x) diverges for any |x₀| ≥ 1.4' },
              { sym: 'cycling', meaning: 'x³ − 2x + 2 from x₀ = 0 alternates between 0 and 1 forever' },
              { sym: 'wrong basin', meaning: 'x³ − 2x from 0.75 returns −1.414214, crossing the root at 0' },
              { sym: 'the boundary', meaning: 'where f′ = 0, at ±√(2/3) = ±0.816497; the answer flips between 0.8150 and 0.8165' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'A bracket with a sign change contains a root and bisection cannot lose it',
          why: 'It is the one guarantee in the section, and it holds for any continuous function.',
          breaks: 'A discontinuity inside the bracket satisfies the sign test and has no root — bisection converges to the jump.'
        },
        {
          name: 'Newton’s order is 2 at a simple root and 1 at a repeated one',
          why: 'The derivative vanishes at a repeated root, so the quadratic term no longer dominates.',
          breaks: 'A measured order near 1 where 2 was expected is the standard symptom of a repeated root.'
        },
        {
          name: 'Brent never gives up the bracket, whatever step it takes',
          why: 'The progress conditions force the interval to shrink at a bounded rate.',
          breaks: 'Removing either condition reintroduces false position’s stalling.'
        },
        {
          name: 'Fixed-point iteration converges locally exactly when |g′(x*)| < 1',
          why: 'It makes convergence checkable in advance by differentiating the rearrangement.',
          breaks: 'At |g′| ≥ 1 no starting point close enough helps; the iteration is expanding.'
        }
      ],
      complexity: [
        { operation: 'bisection', average: 'one function evaluation per bit, about 40 for 1e-12', worst: 'identical — it never speeds up and never fails' },
        { operation: 'Newton', average: 'about 6 iterations at 2 evaluations each near a simple root', worst: 'never terminates: diverges, cycles, or lands in a different basin' },
        { operation: 'secant', average: 'about 8 iterations at 1 evaluation each', worst: 'divergence, and no bracket to fall back on' },
        { operation: 'Brent', average: 'close to the secant, at 9 iterations here', worst: 'bounded by about twice bisection, which is the guarantee being paid for' }
      ],
      failureModes: [
        {
          symptom: 'A solver returns a root far from the region the caller cares about.',
          cause: 'Newton crossed a basin boundary; the answer is a genuine root of a different branch.',
          fix: 'Bracket the region first and use a method that cannot leave it.'
        },
        {
          symptom: 'A bracketing method reports convergence but the bracket is as wide as when it started.',
          cause: 'False position on a convex function: one endpoint is never replaced.',
          fix: 'Use the Illinois variant, which halves the retained endpoint’s value, or use Brent.'
        },
        {
          symptom: 'Newton’s measured convergence order comes out near 1 instead of 2.',
          cause: 'A repeated root, where f′ vanishes at the solution.',
          fix: 'Use the modified iteration x − m·f/f′ for a root of multiplicity m, or find the root of f/f′ instead.'
        },
        {
          symptom: 'The iteration stops early with a wrong answer on a nearly flat function.',
          cause: 'Stopping on |f(x)| alone, which is small over a wide interval when the slope is small.',
          fix: 'Test the step size and the residual together, with an absolute floor so a root at zero is reachable.'
        },
        {
          symptom: 'A root finder loops forever on a function it cannot solve.',
          cause: 'No iteration cap, because "it always converges" was assumed rather than proved.',
          fix: 'Cap the iterations and return a failure the caller can act on.'
        }
      ],
      inTheWild: [
        { system: 'Brent’s method in SciPy', how: '`scipy.optimize.brentq` is the recommended one-dimensional root finder precisely because it keeps the bracket; `newton` is documented as not guaranteed to converge.' },
        { system: 'The fast inverse square root in Quake III', how: 'a bit-level magic constant supplies the initial guess and one Newton step refines it — Newton is safe there because the starting point is provably close.' },
        { system: 'Implicit ODE solvers', how: 'every step of a stiff solver is a root-finding problem, solved by Newton with the previous step as the starting point, which is why 18.8’s implicit method costs more per step.' }
      ],
      sources: [
        { title: 'Algorithms for Minimization Without Derivatives', author: 'Richard P. Brent', note: 'The original description of the hybrid, including the progress conditions that make the guarantee hold.' },
        { title: 'Numerical Recipes, chapter 9', author: 'Press, Teukolsky, Vetterling and Flannery', note: 'Practical root finding, with unusually frank advice about when each method fails.' },
        { title: 'Numerical Analysis', author: 'Burden and Faires', note: 'The convergence-order derivations, including the golden ratio for the secant method.' },
        { title: 'The Art of Computer Programming, volume 2', author: 'Donald E. Knuth', note: 'Iteration and convergence treated alongside the arithmetic that limits them.' }
      ]
    },

    'linear-systems': {
      summary: 'Elimination with and without pivoting on a matrix designed for it, the growth ' +
        'factor that pivoting controls, factor-and-reuse priced against the explicit inverse, and ' +
        'four iterative methods with conjugate gradient’s bound to read them against.',
      intuition: 'A pivot of 1e-18 is small and never zero, so no check fires and the answer comes ' +
        'back wrong in its first component by 100 per cent.',
      formulation: {
        equations: [
          {
            label: 'The factorisation and its reuse',
            expr: 'PA = LU at about n³/3 operations, then two triangular solves at n² per right-hand side',
            terms: [
              { sym: 'why P', meaning: 'the permutation records the row swaps partial pivoting performed' },
              { sym: 'reuse', meaning: '1 factorisation for 20 right-hand sides against 20, at identical accuracy' },
              { sym: 'the inverse', meaning: 'several times worse relative error than the factorisation it was built from — 8.4× or 6.0× depending on the engine, so read it as a band' },
              { sym: 'Cholesky', meaning: 'A = LLᵀ at n³/6 for symmetric positive definite, no pivoting needed' }
            ]
          },
          {
            label: 'Pivoting and growth, measured',
            expr: 'the multiplier is bounded by 1 under partial pivoting, which caps growth at 2ⁿ⁻¹',
            terms: [
              { sym: 'unpivoted, ε = 1e-18', meaning: 'growth 1e18, answer [0, 1], relative error 7.07e-1' },
              { sym: 'pivoted', meaning: 'growth 1, answer [1, 1], residual and error both 0' },
              { sym: 'Wilkinson’s matrix', meaning: 'attains 2ⁿ⁻¹ exactly at every size, with zero row swaps' },
              { sym: 'in practice', meaning: 'growth is a small constant; the bound is attained only by constructed matrices' }
            ]
          },
          {
            label: 'The iterative methods on a Poisson system of size 40',
            expr: 'sweeps to a relative residual of 1e-10',
            terms: [
              { sym: 'Jacobi', meaning: '7 621 sweeps — every update independent, so it parallelises perfectly' },
              { sym: 'Gauss–Seidel', meaning: '2 711 — the same arithmetic using each new value immediately' },
              { sym: 'SOR at ω = 1.8', meaning: '271; the sweep finds the optimum at ω = 1.85 and 153 sweeps against 2 163 at ω = 1' },
              { sym: 'conjugate gradient', meaning: '40 — at most n steps in exact arithmetic, and close to it in practice' }
            ]
          },
          {
            label: 'Conjugate gradient’s rate',
            expr: 'the error after k steps is at most 2((√κ − 1)/(√κ + 1))^k',
            terms: [
              { sym: 'the square root', meaning: 'why halving κ is worth more than any inner-loop optimisation' },
              { sym: 'preconditioning', meaning: 'scaled rows: κ 1.75e7 → 6.81e2, CG 196 iterations → 40' },
              { sym: 'the honest caveat', meaning: 'on a uniform diagonal Jacobi preconditioning is the identity and changes nothing' },
              { sym: 'measured against the bound', meaning: 'the observed curve sits below it, because the bound assumes the worst spectrum' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Partial pivoting bounds every multiplier by 1',
          why: 'It is the mechanism: a multiplier above 1 is what lets an eliminated entry swamp the row.',
          breaks: 'Without it a pivot of 1e-18 produces a multiplier of 1e18 and the row below is destroyed by an addition.'
        },
        {
          name: 'The factorisation depends only on the matrix, never on the right-hand side',
          why: 'It is what makes reuse free, and what makes the factor/solve API split worth honouring.',
          breaks: 'Calling a one-shot solve in a loop pays the cubic cost on every pass for no benefit.'
        },
        {
          name: 'Forming A⁻¹ is more work and less accurate than keeping the factorisation',
          why: 'Every column of the inverse is itself a rounded solve, and applying it applies all of them.',
          breaks: 'The measured penalty here is several times the relative error, for strictly more arithmetic — a ratio of two rounding errors, so its digits move with the engine and only its order transfers.'
        },
        {
          name: 'Cholesky succeeds exactly when the matrix is symmetric positive definite',
          why: 'That makes the attempt a definiteness test, used to check a Hessian describes a minimum.',
          breaks: 'A negative value under the square root means the matrix is indefinite, which is information, not an error.'
        }
      ],
      complexity: [
        { operation: 'LU with partial pivoting', average: 'about n³/3, plus an O(n²) search for the pivots', worst: 'growth up to 2ⁿ⁻¹, attained by Wilkinson’s matrix' },
        { operation: 'triangular solve', average: 'about n² per right-hand side', worst: 'the same — it has no data-dependent behaviour' },
        { operation: 'Cholesky', average: 'about n³/6, half of LU, with no pivoting', worst: 'fails cleanly on an indefinite matrix' },
        { operation: 'conjugate gradient', average: 'one matrix-vector product per step; 40 steps on a size-40 Poisson system', worst: 'n steps in exact arithmetic, more in floating point on an ill-conditioned system' }
      ],
      failureModes: [
        {
          symptom: 'A solve returns plausible numbers that are wrong by 100 per cent in one component.',
          cause: 'Elimination without pivoting on a matrix with a small leading entry.',
          fix: 'Use partial pivoting — that is, use the library routine, which does.'
        },
        {
          symptom: 'A batch job that solves many systems takes cubic time in the batch size.',
          cause: 'A one-shot `solve(A, b)` inside the loop, refactoring the same matrix each pass.',
          fix: 'Factor once outside the loop and call the solve step inside it.'
        },
        {
          symptom: 'Results degrade after refactoring `solve(A, b)` into `Ainv @ b`.',
          cause: 'The inverse accumulates the rounding of n solves before being applied.',
          fix: 'Revert; the inverse is worth forming only when the entries themselves are the answer.'
        },
        {
          symptom: 'A direct solver runs out of memory on a sparse matrix that fits comfortably.',
          cause: 'Fill-in: factorisation creates entries where the matrix had zeros.',
          fix: 'Reorder to reduce fill (AMD, nested dissection) or switch to an iterative method.'
        },
        {
          symptom: 'Adding a preconditioner changes nothing at all.',
          cause: 'Jacobi preconditioning on a matrix whose diagonal is already uniform is the identity.',
          fix: 'Check the condition number before and after; choose a preconditioner against the actual structure.'
        }
      ],
      inTheWild: [
        { system: 'LAPACK’s `dgesv`', how: 'is LU with partial pivoting, and is what NumPy, MATLAB, R and Julia all call underneath — the pivoting is not optional in any of them.' },
        { system: 'The MATLAB backslash operator', how: 'inspects the matrix and dispatches to Cholesky, banded, triangular or general LU, which is the "choose the algorithm from the structure" rule made into syntax.' },
        { system: 'Finite element and circuit simulation', how: 'assemble enormous sparse symmetric positive definite systems and solve them with preconditioned conjugate gradient, where the preconditioner is where the engineering effort goes.' }
      ],
      sources: [
        { title: 'Matrix Computations', author: 'Golub and Van Loan', note: 'The standard reference for factorisation, pivoting and the growth factor.' },
        { title: 'Numerical Linear Algebra', author: 'Trefethen and Bau', note: 'Lecture 22 on the stability of Gaussian elimination, including why the 2ⁿ⁻¹ bound does not matter in practice.' },
        { title: 'Iterative Methods for Sparse Linear Systems', author: 'Yousef Saad', note: 'Jacobi through to Krylov methods and preconditioning, freely available from the author.' },
        { title: 'An Introduction to the Conjugate Gradient Method Without the Agonizing Pain', author: 'Jonathan Richard Shewchuk', note: 'The clearest derivation of CG there is, built entirely from pictures.' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
