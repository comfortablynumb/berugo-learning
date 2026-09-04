/** Concepts for conditioning, root finding and linear systems (M18.1-M18.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'conditioning-and-error': [
      {
        term: 'The residual answers a different question from the error',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["the residual"] --> B["does my answer satisfy<br/>the equations?"]',
            '    C["the error"] --> D["is my answer the right one?"]',
            '    B --> E["you can compute this"]',
            '    D --> F["you usually cannot —<br/>it needs the true answer"]',
            '    E --> G["a tiny residual with a huge error<br/>is exactly what ill-conditioning is"]',
            '    F --> G'
          ].join('\n'),
          caption: 'Reporting a small residual as if it were a small error is the most common numerical mistake there is. Only the condition number connects the two.'
        },
        plain: 'One asks whether your answer satisfies the equations; the other asks whether it is the answer.',
        formal: 'the residual is ‖Ax − b‖ and the error is ‖x − x*‖, and only the first is computable without x*',
        readAs: 'The residual is how far the equations are from being satisfied by the answer you ' +
          'produced. The error is how far that answer is from the true one, which you would need ' +
          'to already know to measure.',
        detail: [
          'On a well-conditioned problem the two move together, and the habit of reporting a ' +
            'residual is harmless.',
          'On an ill-conditioned one they separate completely. The demo holds the residual at ' +
            'machine precision across nine orders of conditioning while the error climbs from ' +
            '1.65e-16 to 1.89e-1.',
          'The asymmetry that makes this dangerous is that the residual is the one you can compute ' +
            'without knowing the answer. So it is the one that ends up in the log line, the ' +
            'assertion and the dashboard.'
        ],
        example: 'At κ = 1.07e16 the demo reports a relative residual of 1.93e-16 beside a relative ' +
          'error of 1.89e-1 — the residual is 9.8e14 times smaller than the error.'
      },
      {
        term: 'The condition number belongs to the problem, not to any algorithm',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["a small wobble in the input"] --> B["how much can it be magnified<br/>on the way to the output?"]',
            '    B --> C["that factor is the condition number"]',
            '    C --> D["it is a property of the question"]',
            '    D --> E["a better algorithm cannot lower it"]',
            '    D --> F["only a better-posed question can"]'
          ].join('\n'),
          caption: 'If the problem is ill-conditioned, no implementation rescues it. Chasing precision in the code is answering a question the condition number already settled.'
        },
        plain: 'It is how much a relative wobble in the input can be magnified on the way to the output.',
        formal: 'κ(A) = σ_max / σ_min, and the relative error is bounded by κ times the relative input perturbation',
        readAs: 'Kappa of A is the largest singular value divided by the smallest, and the ' +
          'relative error you should expect is that number multiplied by however inaccurate the ' +
          'input already was.',
        detail: [
          'Defining it before any algorithm is chosen is the whole point. It says what is ' +
            'achievable, so it tells you whether an answer you dislike is a bug or the best the ' +
            'data supports.',
          'Storing the input already perturbed it by about 10⁻¹⁶. So a condition number of 10⁸ ' +
            'means half your digits may be gone before any code runs, and 10¹⁶ means all of them.',
          'Nothing about the implementation appears anywhere in that sentence.'
        ],
        example: 'The Hilbert ladder in the demo goes from κ = 5.24e2 at n = 3 to 1.73e18 at ' +
          'n = 13. The relative error goes from 8.02e-15 to 2.01e0 alongside it.'
      },
      {
        term: 'Backward stability is a claim about the problem you actually solved',
        plain: 'A stable algorithm returns the exact answer to a slightly different question.',
        formal: 'a backward-stable algorithm returns x̂ that exactly solves (A + δA)x̂ = b with ‖δA‖ / ‖A‖ ≈ ε',
        readAs: 'The computed answer is the perfect answer to a problem within rounding distance ' +
          'of the one you asked. That distance is about machine epsilon relative to the size of ' +
          'the matrix.',
        detail: [
          'This is the right definition of "the code is not the problem".',
          'It is worth internalising because it explains why a stable algorithm on an ' +
            'ill-conditioned problem still gives a bad answer without that being a contradiction.',
          'The perturbation δA is tiny, the condition number multiplies it, and the product is the ' +
            'error you see. Gaussian elimination with partial pivoting is backward stable, and its ' +
            'answer on a Hilbert matrix is worthless — both statements are true at once.'
        ],
        example: 'Every row of the demo’s sweep sits inside the bound εκ, which is exactly what ' +
          'the definition promises, including the row where the answer has no correct digits.'
      },
      {
        term: 'Digits lost is the log of the condition number, and it is a subtraction',
        plain: 'A double carries about sixteen decimal digits; the conditioning takes some of them and you keep the rest.',
        formal: 'digits kept ≈ 16 − log₁₀ κ',
        readAs: 'Take sixteen, subtract the number of zeros in the condition number, and what is ' +
          'left is roughly how many correct digits the answer can have.',
        detail: [
          'It is a rule of thumb rather than a theorem, and it is accurate enough to plan with, ' +
            'which makes it one of the most useful numbers in the subject.',
          'It tells you before you write anything whether double precision is enough, and it turns ' +
            '"should I use extended precision here" from a matter of taste into arithmetic.',
          'It also tells you when the answer is not to reach for more precision. At κ above 10¹⁶ the ' +
            'data does not determine the answer, and quadruple precision buys you a more precisely ' +
            'computed meaningless result.'
        ],
        example: 'The demo shows six digits lost at κ = 10⁶, and eighteen at the Hilbert matrix of ' +
          'size 13, where the answer has none left.'
      },
      {
        term: 'Catastrophic cancellation destroys digits that were never wrong',
        plain: 'Subtracting two nearly equal numbers keeps the difference and throws away the significance.',
        formal: 'if a and b agree to k digits, a − b loses k significant digits even though a and b were exact',
        detail: [
          'The subtraction itself is exact — IEEE arithmetic rounds the true difference — and the ' +
            'loss happens because the leading digits that cancelled were the ones carrying the ' +
            'precision.',
          'What remains is normalised, so the result looks like a full-precision number and is not ' +
            'one.',
          'This is why the quadratic formula is rewritten for the root that would cancel, and why ' +
            'variance is never computed as E[x²] − E[x]². It is also why the reference answer in ' +
            'the pivoting demo had to be derived in the one arrangement that avoids it.'
        ],
        example: 'The exact solution to the tiny-pivot system must be derived as x₁ = 1/(1 − ε). ' +
          'The algebraically identical (1 − x₂)/ε cancels to zero at ε = 1e-18 and returns the ' +
          'wrong answer.'
      },
      {
        term: 'Forward and backward error are related by exactly one factor',
        plain: 'Backward error times the condition number bounds the forward error, and that is the whole theory.',
        formal: 'forward error ≲ κ(problem) × backward error',
        readAs: 'How wrong the answer is, is at most how wrong the question was, multiplied by ' +
          'how sensitive the question is.',
        detail: [
          'Almost everything in this milestone is an application of this one inequality.',
          'It says the two diagnoses are separable. Measure the backward error to judge the code, ' +
            'and the condition number to judge the problem, and their product explains the forward ' +
            'error you observed.',
          'If the backward error is at machine precision the algorithm has done everything available ' +
            'to it. Any remaining inaccuracy is the problem’s property, which means the fix is ' +
            'reformulation or better data, never a rewrite.'
        ],
        example: 'The sweep’s fourth column is εκ, the bound this inequality produces, and every ' +
          'measured error sits under it.'
      },
      {
        term: 'Relative error is the one that means anything across scales',
        plain: 'Being off by a millimetre matters differently on a screw and on a bridge.',
        formal: 'relative error = |x̂ − x| / |x|, which is dimensionless and comparable',
        detail: [
          'Floating point itself is built around relative error. The spacing between representable ' +
            'numbers grows with magnitude, so a double gives you roughly sixteen significant digits ' +
            'whatever the exponent.',
          'That makes relative error the natural currency: it is what machine epsilon bounds, what ' +
            'the condition number multiplies, and what a tolerance should be expressed in.',
          'The exception worth knowing is near zero, where the denominator vanishes and a mixed ' +
            'absolute-plus-relative tolerance is the standard fix.'
        ],
        example: 'Every column in this section’s tables is a relative quantity, which is why they ' +
          'can be compared across systems of different sizes and scalings.'
      },
      {
        term: 'Interval arithmetic gives you a certified bound and usually a useless one',
        plain: 'Carry a low and a high through every operation and the answer arrives with a proven range.',
        formal: '[a, b] + [c, d] = [a + c, b + d], with each endpoint rounded outwards',
        detail: [
          'It is the only technique here that produces a guarantee rather than an estimate, and it ' +
            'is genuinely valuable as a diagnostic. Run a computation in intervals, and a wide ' +
            'output localises where the precision was lost.',
          'The catch is the dependency problem. The interval does not know that the x in two places ' +
            'is the same x, so x − x comes out as a range around zero rather than zero. Widths grow ' +
            'pessimistically through any long computation.',
          'That is why it diagnoses rather than replaces.'
        ],
        example: 'On an ill-conditioned solve the interval width grows to cover the whole answer, ' +
          'which is a correct statement that the data does not determine the result.'
      }
    ],

    'root-finding': [
      {
        term: 'Bisection is the only method here with a guarantee, and it never speeds up',
        plain: 'A sign change brackets a root, and halving cannot lose it.',
        formal: 'if f is continuous and f(a)f(b) < 0 then a root lies in [a, b]; bisection gains exactly one bit per step',
        readAs: 'If the function is continuous and its values at the two ends have opposite signs, ' +
          'a root is between them, and each halving pins down one more bit of its position.',
        detail: 'This is the intermediate value theorem turned into an algorithm, and its cost is ' +
          'fixed: reaching 10⁻¹² from a bracket of width one takes about forty steps regardless of ' +
          'what the function looks like in between. That predictability is its whole value — no ' +
          'starting-point sensitivity, no divergence, no wrong basin. It is also why it is the ' +
          'fallback inside every hybrid rather than a method anyone runs alone.',
        example: 'The demo measures bisection at 41 iterations with a bracket contraction of ' +
          'exactly 0.5000 per step, on the same cubic where Newton takes 6.'
      },
      {
        term: 'Newton converges quadratically and the order is measurable from the iterates',
        plain: 'Each step roughly squares the error, so the number of correct digits doubles.',
        formal: 'x_{k+1} = x_k − f(x_k)/f′(x_k), with |e_{k+1}| ≈ C|e_k|²',
        readAs: 'Step from the current guess to where the tangent line crosses the axis; the new ' +
          'error is proportional to the square of the old one.',
        detail: 'The tangent is the first two terms of the Taylor series, so the error left over ' +
          'is the quadratic term — that is where the exponent comes from, and it is why the ' +
          'convergence is so fast once you are close. The demo fits the exponent from the actual ' +
          'iterate errors rather than quoting 2, which matters: a measured order well below the ' +
          'claim is the standard symptom of a repeated root, where the derivative vanishes at the ' +
          'root and the convergence degrades to linear.',
        example: 'The demo fits 1.957 for Newton and 1.580 for the secant method on x³ − 2x − 5, ' +
          'against theoretical values of 2 and 1.618.'
      },
      {
        term: 'Newton has three failure modes and none of them raises an error',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["the derivative is nearly flat"] --> B["the step is enormous —<br/>it lands somewhere unrelated"]',
            '    C["the function is symmetric<br/>about the guess"] --> D["it cycles between two points<br/>forever"]',
            '    E["another root is nearer"] --> F["it converges, to the wrong one"]',
            '    B --> G["all three return a number"]',
            '    D --> G',
            '    F --> G'
          ].join('\n'),
          caption: 'Bisection is slower and cannot do any of this. Which is why production root-finders bracket first and only use Newton inside a bracket they can fall back from.'
        },
        plain: 'A flat derivative throws it away, a symmetric function makes it cycle, and a nearby root may not be the one it finds.',
        formal: 'a small f′(x_k) makes the step enormous; some functions admit a 2-cycle; the basin boundary is where f′ = 0',
        detail: 'The third is the one that costs real time, because the returned value is a ' +
          'genuine root correct to fifteen digits and simply not the root anywhere near where you ' +
          'started. Nothing in the return value records which basin it came from. On x³ − 2x, ' +
          'whose derivative vanishes at ±√(2/3) ≈ 0.8165, starting at 0.75 lands on −1.414 — ' +
          'crossing the root at zero to get there — and the boundary flips within a thousandth of ' +
          'that point.',
        example: 'Three of the demo’s nine starting points converge to a root that is not the ' +
          'nearest one, and the switch happens between 0.8150 and 0.8165.'
      },
      {
        term: 'The secant method trades order for evaluations, and often wins on cost',
        plain: 'Use the last two points instead of the derivative, and get 1.618 instead of 2 for half the work.',
        formal: 'the secant error satisfies |e_{k+1}| ≈ C|e_k||e_{k−1}|, whose order is the golden ratio φ = 1.618',
        readAs: 'The new error is proportional to the product of the previous two errors, and ' +
          'solving that recurrence gives an exponent of one point six one eight.',
        detail: 'The golden ratio is not a coincidence: substituting a power law into that ' +
          'recurrence gives p² = p + 1, whose positive root is φ. The practical point is the ' +
          'accounting. Newton needs f and f′ at every step; the secant needs only f, reusing the ' +
          'previous value. On a function whose derivative is expensive — or unavailable, which is ' +
          'common — the lower order finishes first on the metric that is actually paid.',
        example: 'The demo has Newton at 6 iterations and 12 evaluations against the secant’s 8 ' +
          'iterations and 9 evaluations, and the secant is the cheapest method in the table.'
      },
      {
        term: 'False position keeps a bracket and can still be worse than bisection',
        plain: 'It interpolates towards the root, and on a convex function one endpoint sticks forever.',
        formal: 'the retained endpoint never moves when f is convex, so the bracket width tends to a non-zero limit',
        detail: 'It looks strictly better than bisection — same guarantee, smarter step — and ' +
          'that intuition is wrong in a way worth seeing measured. Because the interpolated point ' +
          'always lands on the same side of a convex function, one end of the bracket is never ' +
          'replaced, and the interval stops shrinking even though the iterate converges. The ' +
          'contraction rate is the diagnostic: bisection is exactly 0.5 and false position is ' +
          'essentially 1.0, meaning it is not contracting at all.',
        example: 'The demo measures false position’s bracket contraction at 1.0000, and on eˣ − 4 ' +
          'it stalls on 99 of its 100 iterations.'
      },
      {
        term: 'Brent is a hybrid with a progress test, not a fast method with a safety net',
        plain: 'It tries the fastest available step and bisects whenever that step fails to make guaranteed progress.',
        formal: 'the interpolated step is accepted only if it lands in the bracket’s upper quarter and has halved the interval since the last bisection',
        detail: 'The two acceptance conditions are what make the guarantee hold, and they are the ' +
          'transferable idea. Without them, "interpolate, and fall back if it fails" would inherit ' +
          'false position’s stalling. With them, the bracket is forced to shrink at a bounded rate ' +
          'whatever the function does, so the method has the speed of an open method and the ' +
          'worst-case behaviour of a bracketing one. This shape — fast path plus a floor enforced ' +
          'by a progress test — recurs in introsort, in JIT compilation and in adaptive quadrature.',
        example: 'The demo has Brent at 9 iterations, taking 7 interpolated steps and 1 bisection, ' +
          'with a measured bracket contraction of 0.7273.'
      },
      {
        term: 'Fixed-point iteration converges exactly when the rearrangement contracts',
        plain: 'Rewrite f(x) = 0 as x = g(x) and iterate; whether it works is decided by |g′| at the root.',
        formal: 'the iteration converges locally if |g′(x*)| < 1, and the error falls by that factor each step',
        readAs: 'If the size of the derivative of g at the root is below one, each step multiplies ' +
          'the error by that number and the iteration closes in; at one or above it does not.',
        detail: 'The valuable part is that the test is available before you run anything: the same ' +
          'equation rearranged two ways gives two iterations with different derivatives, and ' +
          'differentiating tells you which will work. It also unifies the section — Newton is ' +
          'fixed-point iteration with g(x) = x − f/f′, whose derivative vanishes at a simple root, ' +
          'and a contraction factor of zero is exactly what quadratic convergence looks like from ' +
          'this angle.',
        example: 'Both of the demo’s iterations solve x² − x − 1 = 0; the one with |g′| = 0.3820 ' +
          'converges in 28 steps and the one with 3.2361 never does.'
      },
      {
        term: 'A tolerance on the step is not a tolerance on the error',
        plain: 'Stopping when the iterates stop moving says the method slowed down, not that you are close.',
        formal: 'near a flat function a small |f(x)| can accompany a large |x − x*|, and vice versa near a steep one',
        detail: 'Both stopping tests are wrong on their own and for opposite reasons. Stopping on ' +
          '|f(x)| being small accepts anything on a nearly flat stretch, which can be far from the ' +
          'root; stopping on the step being small accepts a method that has merely stalled, which ' +
          'is exactly what false position does. Production root finders test both, add an absolute ' +
          'floor so a root at zero is reachable, and cap the iterations — which is three guards ' +
          'because there are three distinct ways to be fooled.',
        example: 'False position in the demo satisfies a step-size test long before its bracket ' +
          'has contracted at all; its contraction of 1.0000 is the evidence.'
      }
    ],

    'linear-systems': [
      {
        term: 'Pivoting is about stability, not about zeros',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["a zero pivot"] --> B["division by zero —<br/>impossible to miss"]',
            '    C["a merely SMALL pivot"] --> D["a huge multiplier"]',
            '    D --> E["the intermediate entries blow up"]',
            '    E --> F["and the answer is destroyed,<br/>with nothing raising an error"]',
            '    F --> G["so pivot on the largest available,<br/>not on the first non-zero"]'
          ].join('\n'),
          caption: 'Textbooks introduce pivoting as a way to avoid dividing by zero, which makes it look like an edge case. The real reason is the small pivot that no check catches.'
        },
        plain: 'A pivot that is merely small is enough to destroy the answer, and nothing checks for small.',
        formal: 'the multiplier is aᵢₖ / aₖₖ, so a small pivot makes it huge and the elimination adds huge numbers to ordinary ones',
        readAs: 'Each row below the pivot is scaled by its own leading entry divided by the pivot ' +
          'entry, so when the pivot is tiny that scale factor is enormous and the numbers it ' +
          'creates swamp everything already in the row.',
        detail: 'The textbook reason to swap rows is to avoid dividing by zero, and that reason is ' +
          'almost never the one that matters. With a pivot of 1e-18 the first multiplier is 1e18, ' +
          'so every entry it creates is astronomically larger than what was already in the row — ' +
          'and adding a huge number to an ordinary one rounds the ordinary one away entirely. The ' +
          'information is gone before any division by zero could have occurred, and no singularity ' +
          'check fires because the pivot is not singular.',
        example: 'On [[1e-18, 1], [1, 1]] x = [1, 2] the demo returns [0, 1] without pivoting and ' +
          '[1, 1] with it, at a growth factor of 1e18 against 1.'
      },
      {
        term: 'The growth factor is the term an algorithm can actually control',
        plain: 'It measures how much bigger the intermediate entries got than the original ones.',
        formal: 'ρ = max|aᵢⱼ^(k)| / max|aᵢⱼ|, and the backward error bound is proportional to ρ',
        readAs: 'Rho is the largest entry that appeared at any point during elimination divided by ' +
          'the largest entry the matrix started with, and the error bound is proportional to it.',
        detail: 'The condition number is fixed by the problem, so the growth factor is the only ' +
          'knob in the error bound that pivoting or any other choice can move. Partial pivoting ' +
          'bounds every multiplier by one, which caps growth at 2ⁿ⁻¹ — a bound that sounds useless ' +
          'and in practice is a small constant. That gap between the bound and reality is why ' +
          'partial pivoting rather than complete pivoting is the default: complete pivoting has a ' +
          'far better bound and costs an O(n³) search, and nobody needs it.',
        example: 'Wilkinson’s matrix attains the bound exactly: the demo measures growth of 2ⁿ⁻¹ at ' +
          'every size from 4 to 24, with zero row swaps performed.'
      },
      {
        term: 'LU is the factorisation, and the point of it is reuse',
        plain: 'The expensive part depends only on the matrix, so extra right-hand sides are cheap.',
        formal: 'PA = LU costs about n³/3 operations; each solve afterwards is two triangular substitutions at n² each',
        detail: 'This is why every serious library separates `factor` from `solve` in its API — ' +
          'the split is the entire performance story, not an implementation detail leaking out. ' +
          'Code that calls a one-shot `solve(A, b)` inside a loop pays the cubic cost on every ' +
          'pass, and the fix is one line. It is also the reason a determinant is computed as the ' +
          'product of the LU diagonal rather than by cofactor expansion, which is factorially ' +
          'expensive and no more accurate.',
        example: 'The demo’s reuse study performs 1 factorisation for 20 right-hand sides against ' +
          '20 for the same answers, at identical accuracy.'
      },
      {
        term: 'Never invert a matrix to solve a system — it is slower and less accurate',
        plain: 'The explicit inverse costs more to build and gives worse answers than the factorisation it came from.',
        formal: 'A⁻¹ requires n solves to build, and applying it accumulates their rounding before the caller asks anything',
        detail: 'This is a numerical rule rather than a stylistic one, and the demo prices it. ' +
          'Every column of the inverse is itself a solve that has already been rounded, so ' +
          'multiplying by it applies n rounded answers instead of one; the factorisation, by ' +
          'contrast, rounds once per solve. It is also more work: n solves to build, and then the ' +
          'same n² to apply as a triangular substitution pair. `inv(A) @ b` is worse than ' +
          '`solve(A, b)` on both axes in every library that offers both.',
        example: 'The demo measures the inverse route at several times the worst relative error '
          + 'of the factorisation it was built from - 8.4x on one engine and 6.0x on another, '
          + 'which is why the claim is a band.'
      },
      {
        term: 'Cholesky is half the work when the matrix is symmetric positive definite',
        plain: 'A symmetric matrix with positive curvature factors as LLᵀ, at half the cost and with no pivoting needed.',
        formal: 'A = LLᵀ costs about n³/6 operations, and the factorisation exists precisely when A is positive definite',
        detail: 'It is the standard example of a structured algorithm beating a general one by ' +
          'exploiting a property, and it comes with a bonus: the factorisation is provably stable ' +
          'without any pivoting, because the diagonal dominates by construction. The failure mode ' +
          'is also useful — attempting Cholesky and hitting a negative square root is the standard ' +
          'test for positive definiteness, used in optimisation to check that a Hessian describes ' +
          'a minimum rather than a saddle.',
        example: 'The covariance matrices behind least squares and the Hessians in 18.10 are the ' +
          'usual customers, and both are symmetric positive definite by construction.'
      },
      {
        term: 'Stationary iterations trade an exact finish for a cheap step',
        plain: 'Jacobi and Gauss–Seidel need only a matrix-vector product per sweep and never create fill-in.',
        formal: 'Jacobi uses the previous sweep’s values throughout; Gauss–Seidel uses each new value immediately',
        detail: 'Direct factorisation of a sparse matrix creates entries where there were zeros — ' +
          'fill-in — and on a large sparse system that can exhaust memory long before it exhausts ' +
          'patience. An iterative method touches only the non-zeros, so its cost per step is ' +
          'proportional to the number of them. Jacobi’s updates are independent, which is why it ' +
          'parallelises perfectly and converges slowest; Gauss–Seidel uses each value as soon as ' +
          'it has it, converges faster, and is inherently sequential.',
        example: 'On the demo’s Poisson system of size 40, Jacobi takes 7 621 sweeps and ' +
          'Gauss–Seidel 2 711 — the same arithmetic, differing only in when a value is used. ' +
          'Over-relaxing Gauss–Seidel by a factor ω takes its 2 163 sweeps on the size-32 system ' +
          'down to 153 at the swept optimum of ω = 1.85.'
      },
      {
        term: 'Conjugate gradient’s rate depends on the square root of the condition number',
        plain: 'It is the reason preconditioning is worth more than tuning the iteration.',
        formal: 'the error after k steps is bounded by 2((√κ − 1)/(√κ + 1))^k, and in exact arithmetic it terminates in n steps',
        readAs: 'The error shrinks by a factor built from the square root of the condition number ' +
          'each step, and after n steps of exact arithmetic it would be zero.',
        detail: 'The square root is what makes preconditioning so valuable: reducing κ by a factor ' +
          'of a hundred speeds convergence by a factor of ten, which no amount of optimising the ' +
          'inner loop can match. CG applies only to symmetric positive definite systems, which ' +
          'sounds restrictive and covers most of what large-scale computation actually solves — ' +
          'finite element stiffness matrices, graph Laplacians, and the normal equations behind ' +
          'every least-squares problem.',
        example: 'The demo plots the measured residual against this bound; the measurement sits ' +
          'below it, because the bound assumes the worst possible spectrum.'
      },
      {
        term: 'A preconditioner is only worth anything against the structure it was chosen for',
        plain: 'Jacobi preconditioning rescales each row by its own diagonal, so on a uniform diagonal it does nothing at all.',
        formal: 'solve M⁻¹Ax = M⁻¹b where M approximates A and is cheap to invert; Jacobi takes M = diag(A)',
        detail: 'The whole art is picking an M that is close to A and easy to invert, and those ' +
          'two goals pull in opposite directions: M = A converges in one step and costs as much as ' +
          'the original problem, while M = I costs nothing and changes nothing. The demo makes the ' +
          'honest case visible by defaulting to a matrix whose diagonal is already uniform, where ' +
          'Jacobi preconditioning is exactly the identity and the condition number does not move.',
        example: 'With the rows scaled, the demo’s condition number falls from 1.75e7 to 6.81e2 ' +
          'and CG goes from 196 iterations to 40; without scaling, both numbers are unchanged.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
