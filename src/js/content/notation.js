/**
 * The notation glossary.
 *
 * Every mathematical symbol the curriculum uses, with two things a reader who
 * does not read maths needs and almost never gets: how to *say* it, and what it
 * *does*. A learner who cannot pronounce a symbol cannot hold it in their head,
 * cannot search for it and cannot ask about it, so `reads` is not decoration.
 *
 * Entries are keyed by the exact token as it appears in the prose. Order in
 * ENTRIES is match priority - `log₂` must be tried before `₂`, and `O` before
 * anything else claims the letter - so the array is ordered longest-and-most-
 * specific first and the matcher walks it in that order.
 *
 * Greek letters are variables, not operators: what α stands for depends on the
 * section it appears in. Those entries carry the letter's name, its most common
 * uses, and an honest note that the surrounding text is what fixes the meaning.
 * A section that uses one in a fixed sense calls `registerLocal` to say so, and
 * that override wins wherever that section renders.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Notation = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  /* Growth and cost notation - the symbols that carry the whole of M01. */
  const GROWTH = [
    { token: 'log₂', reads: 'log base two',
      means: 'How many times you can halve a number before reaching 1. log₂ 1024 = 10, which is why a binary search over a thousand items takes about ten steps.' },
    { token: 'O', source: 'O(?=\\s*\\()', reads: 'big oh',
      means: 'A ceiling on cost, ignoring constant factors: "never worse than this, once the input is big enough". It does not promise the cost is actually that high - O(n log n) is also truthfully O(n⁵).' },
    { token: 'o', source: '\\bo(?=\\s*\\()', reads: 'little oh',
      means: 'Strictly smaller: negligible next to this, no matter which constant factor you pick. o(n) grows so much slower than n that the ratio falls to zero.' },
    { token: 'log2', source: '\\blog_?2\\b', reads: 'log base two',
      means: 'The ASCII spelling of log₂: how many times you can halve a number before reaching 1. log2 1024 = 10.' },
    { token: 'log', source: '\\blog\\b(?!₂)', reads: 'log',
      means: 'The logarithm: how many times you must multiply the base by itself to reach this number. In algorithms the base is almost always 2, and it barely matters which - changing base only multiplies the answer by a constant.' },
    { token: 'ln', source: '\\bln\\b', reads: 'natural log',
      means: 'The logarithm to base e (about 2.718) rather than base 2. It appears whenever a sum of 1/1 + 1/2 + 1/3 + … shows up, and ln n is about 0.693 × log₂ n.' },
    { token: 'lim', source: '\\blim\\b', reads: 'the limit of',
      means: 'The value an expression settles towards as its variable grows without bound. "lim f(n)/g(n) = 0" means the ratio can be driven below any number you name by taking n large enough.' },
    { token: 'Θ', reads: 'big theta',
      means: 'A ceiling and a floor at once: the cost grows exactly like this, up to a constant factor. Θ(n) means doubling the input roughly doubles the work. It is the claim most sentences reaching for O actually want.' },
    { token: 'Ω', reads: 'big omega',
      means: 'A floor on cost: "never better than this, once the input is big enough". Used for lower bounds - the work no algorithm of this kind can avoid.' },
    { token: 'Φ', reads: 'big phi',
      means: 'The potential function in amortised analysis: credit stored in a data structure by cheap operations, which a later expensive operation spends. If it starts at zero and never goes negative, the amortised total bounds the real total.' }
  ];

  /* Logic and sets. */
  const LOGIC = [
    { token: '⟺', reads: 'if and only if',
      means: 'Both sides are true in exactly the same cases - each one implies the other. In code, an equivalence you may substitute in either direction.' },
    { token: '⇔', reads: 'if and only if',
      means: 'Both sides are true in exactly the same cases - each one implies the other.' },
    { token: '⟹', reads: 'implies',
      means: 'If the left side holds, the right side holds. It says nothing about the other direction, which is the mistake this symbol exists to prevent.' },
    { token: '⇒', reads: 'implies',
      means: 'If the left side holds, the right side holds - one direction only.' },
    { token: '⇏', reads: 'does not imply',
      means: 'The left side holding is not enough to conclude the right side; there is a counterexample.' },
    { token: '∀', reads: 'for all',
      means: 'The statement that follows holds for every value in range - no exceptions. To disprove it you need exactly one counterexample.' },
    { token: '∃', reads: 'there exists',
      means: 'At least one value makes the statement true. To prove it you name one; to disprove it you must rule out all of them.' },
    { token: '∉', reads: 'is not in',
      means: 'The thing on the left is not a member of the collection on the right.' },
    { token: '∈', reads: 'is in, or is a member of',
      means: 'The thing on the left is one of the things in the collection on the right - the maths spelling of `set.has(x)`.' },
    { token: '⊆', reads: 'is a subset of',
      means: 'Every element on the left is also on the right. The two may be equal - it is the ≤ of collections.' },
    { token: '⊇', reads: 'is a superset of',
      means: 'Everything on the right is also on the left; the left may hold more.' },
    { token: '⊊', reads: 'is a strict subset of',
      means: 'Every element on the left is on the right, and the right holds at least one more - so they are not equal.' },
    { token: '⋃', reads: 'the union of',
      means: 'Everything in any of the collections listed, merged into one, with duplicates counted once.' },
    { token: '∪', reads: 'union',
      means: 'Everything in either collection, duplicates counted once.' },
    { token: '∩', reads: 'intersection',
      means: 'Only the things that are in both collections.' },
    { token: '∖', reads: 'set minus',
      means: 'Everything in the left collection that is not in the right one.' },
    { token: '∅', reads: 'the empty set',
      means: 'A collection with nothing in it - the maths spelling of `new Set()`.' },
    { token: '∧', reads: 'and',
      means: 'Both sides must hold - logical AND.' },
    { token: '∨', reads: 'or',
      means: 'At least one side must hold - inclusive OR.' },
    { token: '¬', reads: 'not',
      means: 'The negation of what follows - logical NOT.' },
    { token: '⊥', reads: 'bottom',
      means: '"No value" - a distinguished element meaning undefined or unreachable, deliberately kept incomparable with real values so it can never win a minimum by accident.' }
  ];

  /* Relations and arithmetic. */
  const ARITHMETIC = [
    { token: '≤', reads: 'is less than or equal to',
      means: 'At most - the value may touch the bound but not pass it.' },
    { token: '≥', reads: 'is greater than or equal to',
      means: 'At least - the value may touch the bound but not fall below it.' },
    { token: '≠', reads: 'is not equal to', means: 'The two sides differ.' },
    { token: '≲', reads: 'is at most, up to a constant',
      means: 'Less than or equal to, ignoring a constant factor nobody is tracking. Used in error bounds, where the shape of the bound is the point and the leading constant is not.' },
    { token: '≈', reads: 'is approximately',
      means: 'Close enough for the point being made; the exact value is not what matters here.' },
    { token: '≡', reads: 'is congruent to, or is identical to',
      means: 'Equal in a stated sense rather than literally - in modular arithmetic, "leaves the same remainder".' },
    { token: '≪', reads: 'is much less than',
      means: 'Smaller by enough that the difference changes the conclusion, not just the arithmetic.' },
    { token: '≫', reads: 'is much greater than',
      means: 'Larger by enough that the smaller term can be ignored.' },
    { token: '∝', reads: 'is proportional to',
      means: 'Grows by the same factor - double one and you double the other - with the constant left unstated on purpose.' },
    { token: '×', reads: 'times', means: 'Multiplication. Between dimensions it reads "by", as in a 3 × 4 grid.' },
    { token: '!', source: '(?<=[0-9)]|(?<![A-Za-z])[A-Za-z])!(?![=])', reads: 'factorial',
      means: 'n! is n × (n−1) × … × 2 × 1 - the number of ways to put n things in order. It grows faster than any exponential: 20! is already about 2.4 × 10¹⁸.' },
    { token: 'E', source: 'E(?=\\[)', reads: 'the expected value of',
      means: 'The long-run average of a random quantity, weighting each outcome by how likely it is. E[X] is read "the expectation of X" and is what you would see averaged over very many runs - not what any single run must give.' },
    { token: 'mod', source: '\\bmod\\b', reads: 'modulo',
      means: 'The remainder after dividing. "a mod b" is what is left of a once every whole multiple of b is taken out, so it always lands between 0 and b−1.' },
    { token: '·', reads: 'times, or a bullet',
      means: 'Between two quantities it is multiplication, written as a raised dot so it is not mistaken for a full stop (between two vectors, the dot product). Between two labels it is only a separator: "Dijkstra 3 480 · SPFA 6 516" lists two measurements rather than multiplying them. Which one it is depends on whether the things either side are quantities or names.' },
    { token: '÷', reads: 'divided by',
      means: 'Division. Written this way rather than with a slash when the surrounding formula already uses slashes for something else.' },
    { token: '−', reads: 'minus',
      means: 'Subtraction, or a negative sign. It is a true minus sign, drawn wider than a hyphen so it lines up with + in a formula.' },
    { token: '°', reads: 'degrees',
      means: 'An angle measured in degrees: a full turn is 360° and a right angle is 90°. The other unit is radians, where a full turn is 2π — every trigonometric function in a standard library expects radians, which is the single most common unit bug in geometry code.' },
    { token: '±', reads: 'plus or minus',
      means: 'A value with a tolerance either side: 5 ± 2 covers everything from 3 to 7.' },
    { token: '√', reads: 'the square root of',
      means: 'The number that gives this one when multiplied by itself. √n grows very slowly: √1 000 000 is 1 000.' },
    { token: '∛', reads: 'the cube root of',
      means: 'The number that gives this one when multiplied by itself twice. It shrinks even more slowly than a square root: the cube root of a millionth is a hundredth.' },
    { token: '∞', reads: 'infinity',
      means: 'Unbounded. In code it is normally a sentinel - `Infinity`, or a number chosen large enough that nothing can beat it.' },
    { token: '¼', reads: 'one quarter',
      means: 'The fraction one over four. Written as one character where a formula needs it ' +
        'inline - ¼ of the interval is the same as 0.25 of it.' },
    { token: '¾', reads: 'three quarters',
      means: 'The fraction three over four, or 0.75. It pairs with ¼: the two mark the points ' +
        'either side of the midpoint of an interval.' },
    { token: '⌈', reads: 'ceiling, open',
      means: 'Opens a round-up. ⌈7/2⌉ is 4 - the whole number at or above the value.' },
    { token: '⌉', reads: 'ceiling, close',
      means: 'Closes a round-up. ⌈7/2⌉ is 4 - the whole number at or above the value.' },
    { token: '⌊', reads: 'floor, open',
      means: 'Opens a round-down. ⌊7/2⌋ is 3 - the whole number at or below the value, which is what integer division does.' },
    { token: '⌋', reads: 'floor, close',
      means: 'Closes a round-down. ⌊7/2⌋ is 3 - the whole number at or below the value.' },
    { token: '‖', reads: 'norm bars',
      means: 'The length, or magnitude, of the thing between them - the vector generalisation of absolute value.' },
    { token: '½', reads: 'one half', means: 'The fraction 1/2, or 0.5.' },
    { token: 'ℤ', reads: 'the integers',
      means: 'The whole numbers, positive, negative and zero. "ℤ mod p" means arithmetic on the remainders after dividing by p, so the values run from 0 to p minus one and wrap around.' },
    { token: 'Σ', reads: 'sigma, meaning a sum',
      means: 'Add up every term as the index runs over its range - a `for` loop whose body is `total += ...`.' },
    { token: 'Π', reads: 'big pi, meaning a product',
      means: 'Multiply every term together as the index runs over its range - a `for` loop whose body is `total *= ...`.' },
    { token: '∏', reads: 'product over',
      means: 'The same as big pi: multiply every term together as the index runs over its range. This is the dedicated product sign rather than the Greek letter.' },
    { token: '∫', reads: 'the integral of',
      means: 'The area under a curve between two limits. Read the subscript and superscript as "from" and "to", and dx as "with respect to x".' },
    { token: '⊕', reads: 'xor',
      means: 'Exclusive OR: 1 where the two bits differ, 0 where they agree. It is its own inverse, which is why applying it twice restores the original.' },
    { token: '⊖', reads: 'symmetric difference',
      means: 'The elements in exactly one of the two collections - the set version of XOR.' },
    { token: '⧺', reads: 'concatenated with',
      means: 'Join the two sequences end to end.' },
    { token: '′', reads: 'prime',
      means: 'Marks a second, related variable rather than an operation: s′ is read "s prime" and normally means the state after a step.' },
    { token: '″', reads: 'double prime',
      means: 'The second derivative: f″ is how fast the slope of f is changing, which is its curvature.' },
    { token: '∇', reads: 'gradient, or nabla',
      means: 'The vector of every partial derivative at once: ∇f points in the direction the function increases fastest, and its length is how fast.' },
    { token: '∂', reads: 'partial derivative',
      means: 'A derivative with respect to one variable while the others are held fixed. ∂f/∂x reads “the partial of f with respect to x”.' },
    { token: '∓', reads: 'minus or plus',
      means: 'The opposite sign to a ± written elsewhere in the same statement: where one is plus the other is minus.' },
    { token: '→', reads: 'goes to, or maps to',
      means: 'Approaches a value in a limit, or becomes a value in a mapping - "this on the left turns into that on the right".' },
    { token: '←', reads: 'takes the value',
      means: 'Assignment in pseudocode: the right side is computed and stored on the left, exactly like `=` in JavaScript.' },
    { token: '␀', reads: 'the null character',
      means: 'The byte with value zero, used as an end-of-string marker or a sentinel that cannot occur in the data.' }
  ];

  /* Greek letters used as variables: name first, meaning by context. */
  const CONTEXT = 'The text around it fixes what it stands for here.';

  const GREEK = [
    { token: 'α', reads: 'alpha',
      means: 'A Greek letter used as a variable. Most often the load factor in hashing - entries divided by slots - or the inverse Ackermann function in union-find, which is below 5 for any input you will ever see. ' + CONTEXT },
    { token: 'β', reads: 'beta', means: 'A Greek letter used as a variable, usually a second quantity paired with an α. ' + CONTEXT },
    { token: 'γ', reads: 'gamma', means: 'A Greek letter used as a variable, usually a third quantity after α and β. ' + CONTEXT },
    { token: 'Δ', reads: 'big delta',
      means: 'A change or difference: Δt reads "the change in t". ' + CONTEXT },
    { token: 'δ', reads: 'delta',
      means: 'A small change or difference, or a distance in a bound. ' + CONTEXT },
    { token: 'ε', reads: 'epsilon',
      means: 'A deliberately tiny positive number: an error you are willing to accept, or a tolerance you compare against. In automata it instead means the empty string - a transition taken without consuming input.' },
    { token: 'θ', reads: 'theta, lowercase',
      means: 'An angle, or a threshold. Not the same as capital Θ, which is the growth-rate symbol.' },
    { token: 'κ', reads: 'kappa',
      means: 'The condition number: how much a small relative wobble in the input can be magnified on the way to the output. It is a property of the problem rather than of any code, and log10 of it is roughly how many decimal digits you should expect to lose.' },
    { token: 'λ', reads: 'lambda',
      means: 'An anonymous function in the lambda calculus, an arrival rate in queueing, or an eigenvalue in linear algebra. ' + CONTEXT },
    { token: 'μ', reads: 'mu',
      means: 'The mean of a distribution, or a service rate in queueing - how many items a server finishes per unit time. ' + CONTEXT },
    { token: 'µ', reads: 'mu',
      means: 'The mean of a distribution, or a service rate in queueing. ' + CONTEXT },
    { token: 'π', reads: 'pi', means: 'The circle constant, 3.14159…' },
    { token: 'ρ', reads: 'rho',
      means: 'Utilisation: the fraction of the time a server is busy, arrival rate divided by service rate. Queue length blows up as it approaches 1.' },
    { token: 'σ', reads: 'sigma, lowercase',
      means: 'Standard deviation - how far values typically sit from the mean. Not the same as capital Σ, which means a sum.' },
    { token: 'τ', reads: 'tau', means: 'A time constant or a threshold. ' + CONTEXT },
    { token: 'φ', reads: 'phi, lowercase',
      means: 'Often the golden ratio, about 1.618, which is why it turns up in Fibonacci growth. ' + CONTEXT },
    { token: 'ω', reads: 'omega, lowercase',
      means: 'A tuning factor deliberately set above 1 to overshoot an update, as in successive over-relaxation, where the best value is found by sweeping rather than by formula. Not the same as capital Ω, which is the growth-rate symbol.' },
    { token: 'χ', reads: 'chi',
      means: 'Usually the chromatic number of a graph - the fewest colours needed so no edge joins two same-coloured vertices.' },
    { token: 'ℓ', reads: 'script ell', means: 'A length or a level, written in script to keep it distinct from the digit 1.' }
  ];

  /* Superscripts and subscripts, which readers skip over precisely because
     they are small - and they are where the index and the exponent live. */
  const MARKS = [
    { token: 'ⁿ', reads: 'to the power of n', means: 'A superscript: the base multiplied by itself n times. 2ⁿ doubles with every increase of 1 in n.' },
    { token: 'ᵐ', reads: 'to the power of m', means: 'A superscript exponent, with m as the count.' },
    { token: 'ᵈ', reads: 'to the power of d', means: 'A superscript exponent, with d as the count - normally a depth or a dimension.' },
    { token: 'ᵏ', reads: 'to the power of k', means: 'A superscript exponent, with k as the count - normally a number of rounds or trials. 2⁻ᵏ halves with every extra round.' },
    { token: 'ᵀ', reads: 'transpose', means: 'Flips a matrix over its diagonal, turning rows into columns.' },
    { token: '⁻', reads: 'to the power of minus', means: 'A negative exponent, meaning "one divided by": 10⁻⁶ is one millionth.' },
    { token: '⁺', reads: 'plus, as a superscript', means: 'A superscript plus. On a quantity it usually marks a corrected or pooled version of it, as in V⁺ for a variance estimate that mixes two others.' },
    { token: '⁰', reads: 'to the power of zero', means: 'Anything to the power of zero is 1.' },
    { token: '¹', reads: 'to the power of one', means: 'A superscript 1 - the value unchanged.' },
    { token: '²', reads: 'squared', means: 'A superscript 2: the value multiplied by itself. n² quadruples when n doubles.' },
    { token: '³', reads: 'cubed', means: 'A superscript 3: the value multiplied by itself three times.' },
    { token: '⁴', reads: 'to the fourth', means: 'A superscript exponent of 4.' },
    { token: '⁵', reads: 'to the fifth', means: 'A superscript exponent of 5.' },
    { token: '⁶', reads: 'to the sixth', means: 'A superscript exponent of 6 - 10⁶ is a million.' },
    { token: '⁷', reads: 'to the seventh', means: 'A superscript exponent of 7.' },
    { token: '⁸', reads: 'to the eighth', means: 'A superscript exponent of 8.' },
    { token: '⁹', reads: 'to the ninth', means: 'A superscript exponent of 9 - 10⁹ is a billion.' },
    { token: '₀', reads: 'sub zero', means: 'A subscript: it picks out one particular value rather than doing arithmetic. n₀ reads "n nought" and names a starting size.' },
    { token: '₁', reads: 'sub one', means: 'A subscript index - the first of a numbered family of values.' },
    { token: '₂', reads: 'sub two', means: 'A subscript index - the second of a numbered family, or the base of a logarithm.' },
    { token: '₃', reads: 'sub three', means: 'A subscript index - the third of a numbered family.' },
    { token: '₄', reads: 'sub four', means: 'A subscript index - the fourth of a numbered family.' },
    { token: '₅', reads: 'sub five', means: 'A subscript index - the fifth of a numbered family.' },
    { token: '₆', reads: 'sub six', means: 'A subscript six: an index or a size written below the line, as in K₆ for the complete graph on six vertices.' },
    { token: '₇', reads: 'sub seven', means: 'A subscript seven: an index or a size written below the line, as in K₇ for the complete graph on seven vertices.' },
    { token: '₈', reads: 'sub eight', means: 'A subscript eight: an index or a size written below the line.' },
    { token: '₉', reads: 'sub nine', means: 'A subscript nine: an index or a size written below the line.' },
    { token: 'ₙ', reads: 'sub n', means: 'A subscript index - the n-th, that is the last, of a numbered family.' },
    { token: 'ₘ', reads: 'sub m', means: 'A subscript index - the m-th of a numbered family.' },
    { token: 'ᵢ', reads: 'sub i', means: 'A subscript index: aᵢ reads "a sub i" and means the i-th item, the maths spelling of `a[i]`.' },
    { token: 'ⱼ', reads: 'sub j', means: 'A subscript index: the j-th item, the maths spelling of `a[j]`.' },
    { token: '₊', reads: 'plus, in a subscript', means: 'Arithmetic inside an index rather than on the value: σₖ₊₁ reads “sigma sub k plus one” and means the next one after the k-th.' },
    { token: '₋', reads: 'minus, in a subscript', means: 'Arithmetic inside an index rather than on the value: hᵢ₋₁ reads “h sub i minus one” and means the one before the i-th.' }
  ];

  const ENTRIES = GROWTH.concat(LOGIC, ARITHMETIC, GREEK, MARKS);

  const BY_TOKEN = new Map();
  ENTRIES.forEach(function (entry) {
    if (!BY_TOKEN.has(entry.token)) BY_TOKEN.set(entry.token, entry);
  });

  /* Section-scoped overrides, so a section that pins α to one meaning says so
     once instead of every paragraph re-explaining it. */
  const LOCAL = new Map();

  function registerLocal(sectionId, overrides) {
    const existing = LOCAL.get(sectionId) || new Map();
    Object.keys(overrides).forEach(function (token) {
      const base = BY_TOKEN.get(token);
      existing.set(token, Object.assign({ token: token }, base, overrides[token]));
    });
    LOCAL.set(sectionId, existing);
    return existing.size;
  }

  function entry(token, sectionId) {
    const local = sectionId ? LOCAL.get(sectionId) : null;
    if (local && local.has(token)) return local.get(token);
    return BY_TOKEN.get(token) || null;
  }

  function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /** A fresh global matcher; ENTRIES order is match priority. */
  function pattern() {
    const sources = ENTRIES.map(function (item) {
      return item.source || escapeRegex(item.token);
    });
    return new RegExp('(?:' + sources.join('|') + ')', 'gu');
  }

  return {
    entry: entry,
    pattern: pattern,
    registerLocal: registerLocal,
    tokens: function () { return ENTRIES.map(function (item) { return item.token; }); },
    size: function () { return BY_TOKEN.size; }
  };
}));
