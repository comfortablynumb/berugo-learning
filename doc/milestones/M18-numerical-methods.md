# M18 — Numerical methods, transforms and optimisation

> **Track** Algorithms · **Depends on** M17 · **Sections** 10 · **Effort** L

**Outcome.** The numerical toolkit behind graphics, simulation, signal processing, machine learning
and optimisation, taught with error and conditioning tracked at every step rather than assumed
away. A senior engineer who has done this milestone can tell "the algorithm is wrong" from "the
problem is ill-conditioned".

**Shared machinery introduced.** `algorithms/linalg.js` — dense matrices over typed arrays with
decompositions; `machines/numeric-lab.js` — condition-number estimation, exact/high-precision
reference solutions and per-step error tracking; `viz/function-plot.js` — function, vector-field
and convergence plotting reused by every section here.

---

## Sections

### 18.1 Conditioning, stability and error
- **Covers** — absolute and relative error, forward and backward error, the condition number of a
  problem versus the stability of an algorithm, why a stable algorithm on an ill-conditioned problem
  still gives a bad answer, error propagation through operations, and interval arithmetic as a
  diagnostic.
- **Demo** — solve the same linear system with a slider that increases the condition number: the
  residual stays small while the solution error explodes, on one plot, making the distinction
  unmissable.
- **Diagram** — mermaid diagram relating input perturbation, condition number and output error.
- **Lab** — implement condition-number estimation by the power method on A and A⁻¹; tests assert
  agreement with a direct SVD-based computation within tolerance.
- **Senior insight** — a small residual does not mean a correct answer. Reporting the residual as
  evidence of correctness is the single most common numerical-code mistake.

### 18.2 Root finding
- **Covers** — bisection and guaranteed convergence, the false-position trap, Newton's method with
  quadratic convergence and its failure modes (flat derivative, cycling, wrong basin), the secant
  method, Brent's hybrid, fixed-point iteration and the contraction condition, and multi-dimensional
  Newton.
- **Demo** — root-finder playground: choose a function and a start point, watch each method's
  iterates on the curve, with the convergence order estimated from the iterate errors and Newton
  driven into each of its failure modes by preset start points.
- **Diagram** — mermaid flowchart of Brent's method choosing between interpolation and bisection.
- **Lab** — implement Brent's method with the bisection fallback; tests assert convergence on
  functions where pure Newton diverges and an iteration count below a threshold on well-behaved
  functions.
- **Senior insight** — Newton is fast when it works and silently divergent when it does not; every
  production root finder is a hybrid with a bracketing guarantee for exactly that reason.

### 18.3 Linear systems
- **Covers** — Gaussian elimination and its O(n³), partial and complete pivoting and why pivoting is
  about stability rather than zeros, LU decomposition and reuse across right-hand sides, Cholesky
  for symmetric positive-definite systems, banded and sparse storage, iterative methods (Jacobi,
  Gauss–Seidel, SOR), conjugate gradient, and preconditioning.
- **Demo** — elimination stepper showing the matrix transform per pivot with growth factors tracked;
  a no-pivoting toggle produces catastrophic error on a matrix designed for it; a CG view plots the
  residual per iteration against the condition-number-derived bound.
- **Diagram** — mermaid diagram of LU factorisation reusing the factorisation across right-hand
  sides.
- **Lab** — implement LU with partial pivoting and forward/backward substitution; tests assert
  ‖Ax − b‖ below tolerance on random and ill-conditioned systems, and that the no-pivot version
  fails on the designed fixture.
- **Senior insight** — the reason to factor rather than invert is not speed alone: explicitly
  forming A⁻¹ loses accuracy and gains nothing, and "never invert a matrix" is a numerical rule,
  not a stylistic one.

### 18.4 Least squares, QR and SVD
- **Covers** — overdetermined systems, the normal equations and their squared condition number,
  QR by Gram–Schmidt (and why classical Gram–Schmidt is unstable), Householder reflections, the
  SVD and its geometric meaning, pseudo-inverse, rank determination, low-rank approximation and the
  Eckart–Young theorem, and ridge regularisation.
- **Demo** — fit a polynomial to noisy data by normal equations and by QR as the degree rises: the
  normal-equation fit degrades visibly first, with the condition number of each formulation plotted;
  an SVD view shows singular values and the effect of truncating them.
- **Diagram** — mermaid diagram of the SVD as rotate–scale–rotate.
- **Lab** — implement Householder QR and use it for least squares; tests assert residual agreement
  with a reference solution and better accuracy than the normal equations on an ill-conditioned
  Vandermonde fixture.
- **Senior insight** — forming AᵀA squares the condition number, which is why the textbook normal
  equations quietly fail on exactly the fitting problems people most want to solve.

### 18.5 Eigenvalues and Krylov methods
- **Covers** — eigenvalues and eigenvectors, the characteristic polynomial and why nobody uses it
  numerically, power iteration and its convergence rate, inverse and shifted iteration, the QR
  algorithm with shifts, Hessenberg reduction, Lanczos and Arnoldi for large sparse problems, and
  applications (PageRank from M14, PCA, vibration modes, spectral clustering).
- **Demo** — power iteration animated as a vector rotating towards the dominant eigenvector, with
  the convergence rate matching |λ₂/λ₁|; a QR-algorithm view shows the matrix converging to
  triangular form.
- **Diagram** — mermaid diagram of the power-iteration multiply-and-normalise loop.
- **Lab** — implement shifted inverse iteration to find the eigenvector nearest a target value;
  tests assert the residual ‖Av − λv‖ falls below tolerance on symmetric fixtures.
- **Senior insight** — power iteration's convergence rate is the eigenvalue gap; when PageRank
  converges slowly, the graph structure is the reason, not the implementation.

### 18.6 Interpolation and approximation
- **Covers** — Lagrange and Newton forms, the Runge phenomenon and why higher degree is not better,
  Chebyshev nodes, piecewise linear and cubic splines with continuity conditions, natural versus
  clamped boundaries, Bézier and B-spline curves with de Casteljau evaluation, monotone
  interpolation for data that must not overshoot, and least-squares approximation versus
  interpolation.
- **Demo** — drag data points and compare a high-degree polynomial, a Chebyshev-node polynomial and
  a cubic spline live; the Runge oscillation appears and disappears as nodes move.
- **Diagram** — mermaid diagram of de Casteljau's recursive subdivision.
- **Lab** — implement natural cubic-spline construction by solving the tridiagonal system; tests
  assert C² continuity at interior knots and exact interpolation at the data points.
- **Senior insight** — animation easing, colour ramps and audio envelopes are all interpolation
  problems, and overshoot is the visible bug: monotone interpolation is what stops a "smooth" curve
  from producing a negative value.

### 18.7 Differentiation, integration and autodiff
- **Covers** — finite differences and the step-size trade-off between truncation and rounding error,
  Richardson extrapolation, complex-step differentiation, numerical quadrature (trapezoid, Simpson,
  Gauss–Legendre, adaptive), Monte Carlo integration in high dimensions, and automatic
  differentiation in forward and reverse mode with dual numbers and tapes.
- **Demo** — step-size explorer: plot the error of a finite-difference derivative against h on log
  axes, showing the V shape where truncation error meets rounding error; an autodiff view shows the
  computation graph and the reverse sweep accumulating adjoints.
- **Diagram** — mermaid DAG of a computation graph with forward values and reverse adjoints.
- **Lab** — implement forward-mode autodiff with dual numbers and reverse-mode over a tape; tests
  assert gradients match analytic derivatives and central differences to tolerance on a set of
  functions.
- **Senior insight** — reverse-mode autodiff costs about the same as one forward evaluation
  regardless of the number of inputs, which is the entire reason gradient-based training scales to
  billions of parameters.

### 18.8 Differential equations and simulation
- **Covers** — initial-value problems, explicit Euler's error, midpoint and RK4, adaptive step size
  with embedded error estimates (RK45), stiffness and implicit methods, energy drift in physical
  simulation, symplectic integrators (Verlet, leapfrog) and why games use them, and fixed versus
  variable timesteps.
- **Demo** — orbital simulator integrated by Euler, RK4 and Verlet: the orbit visibly spirals,
  holds, or precesses, with total energy plotted over time for each; a stiffness demo shows explicit
  methods requiring absurdly small steps.
- **Diagram** — mermaid diagram of RK4's four stage evaluations.
- **Lab** — implement velocity Verlet and RK4 for a spring system; tests assert energy conservation
  within a bound for Verlet over 10⁵ steps and RK4's fourth-order convergence under step halving.
- **Senior insight** — game physics uses Verlet not because it is more accurate but because its
  error does not accumulate as energy; a "more accurate" RK4 integrator makes an orbit decay.

### 18.9 Fourier transforms and signal processing
- **Covers** — the DFT and its matrix form, Cooley–Tukey radix-2 FFT and its butterfly structure,
  bit-reversal permutation, real-input optimisations, the number-theoretic transform for exact
  convolution, convolution and correlation theorems, polynomial and big-integer multiplication by
  FFT, windowing and spectral leakage, and sampling, aliasing and the Nyquist limit.
- **Demo** — signal workbench: build a signal from components, view its spectrum, apply windows and
  see leakage change, then filter in the frequency domain and inverse-transform; a butterfly diagram
  animates the FFT stages with the bit-reversal step shown.
- **Diagram** — mermaid diagram of a radix-2 butterfly stage.
- **Lab** — implement iterative radix-2 FFT with bit-reversal and use it for polynomial
  multiplication; tests assert round-trip identity within tolerance and exact agreement with
  schoolbook multiplication after rounding.
- **Senior insight** — aliasing is not an audio curiosity: undersampled metrics dashboards show
  phantom periodicity for exactly the same reason, and the fix is the same (filter before you
  sample).

### 18.10 Optimisation
- **Covers** — convexity and why it is the dividing line, gradient descent with step size and
  momentum, line search and the Wolfe conditions, Newton and quasi-Newton (BFGS, L-BFGS),
  coordinate descent, constrained optimisation with Lagrange multipliers and KKT conditions, linear
  programming with the simplex method and duality, and integer programming as the hard neighbour.
- **Demo** — descend a selectable 2-D surface with each method, paths drawn over contours, with
  iteration counts and the effect of conditioning (an elongated valley) shown; a simplex view walks
  the vertices of a polytope with the objective improving.
- **Diagram** — mermaid diagram of the simplex walking the feasible polytope's vertices.
- **Lab** — implement backtracking line search satisfying the Armijo condition and plug it into
  gradient descent; tests assert monotone objective decrease and convergence on convex fixtures
  where a fixed step size diverges.
- **Senior insight** — most "the optimiser did not converge" reports are a step-size problem on an
  ill-conditioned surface; a line search removes the hyperparameter that caused it.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/algorithms/linalg.js` | Dense matrices, LU, QR (Householder), Cholesky, SVD, condition number |
| `src/js/algorithms/root-finding.js` | Bisection, Newton, secant, Brent, multivariate Newton |
| `src/js/algorithms/iterative-solvers.js` | Jacobi, Gauss–Seidel, SOR, conjugate gradient, preconditioners |
| `src/js/algorithms/eigen.js` | Power iteration, shifted inverse, QR algorithm, Lanczos |
| `src/js/algorithms/interpolation.js` | Lagrange, Newton, splines, Bézier, monotone variants |
| `src/js/algorithms/quadrature.js` | Trapezoid, Simpson, Gauss, adaptive, Monte Carlo |
| `src/js/algorithms/autodiff.js` | Dual numbers, tape-based reverse mode |
| `src/js/algorithms/ode-solvers.js` | Euler, RK4, RK45, implicit, Verlet, leapfrog |
| `src/js/algorithms/fft.js` | Radix-2 FFT, NTT, convolution, windows |
| `src/js/algorithms/optimization.js` | Gradient descent, momentum, line search, BFGS, simplex, KKT |
| `src/js/machines/numeric-lab.js` | High-precision references, condition estimation, error tracking |
| `src/js/viz/function-plot.js` | Curves, contours, vector fields, convergence plots |

---

## Acceptance criteria

- [ ] Every solver is checked against a high-precision reference, and each section reports both
      residual and solution error where they differ.
- [ ] The no-pivoting and normal-equation fixtures demonstrably fail while the stable variants pass,
      as assertions rather than prose.
- [ ] FFT round-trips within 1e-10 relative error for sizes up to 2¹⁶ and matches a naive DFT for
      small sizes exactly (to tolerance).
- [ ] Autodiff gradients match analytic derivatives for every fixture function, forward and reverse
      mode agreeing to 1e-10.
- [ ] Verlet's energy drift over 10⁵ steps stays inside the stated bound; RK4 exhibits fourth-order
      convergence under step halving, asserted numerically.
- [ ] Optimisation labs assert monotone decrease and convergence, not merely termination.

---

## Sources

- Trefethen, Bau — *Numerical Linear Algebra*
- Golub, Van Loan — *Matrix Computations*
- Press et al. — *Numerical Recipes* (used critically, with its known caveats)
- Cooley, Tukey — *An algorithm for the machine calculation of complex Fourier series*
- Nocedal, Wright — *Numerical Optimization*
- Griewank, Walther — *Evaluating Derivatives* (automatic differentiation)
- Hairer, Lubich, Wanner — *Geometric Numerical Integration* (symplectic methods)
