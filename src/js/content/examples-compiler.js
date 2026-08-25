/** Worked examples for language design, the lexer and the parser (M28.1-M28.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'designing-a-language': [
      {
        title: 'Scoring eleven features twice, and getting two different rankings',
        goal: 'Turn "a feature is cheap in the parser and expensive later" into a table.',
        setup: 'Each of the eleven v1 features is given a parser cost and a post-parser cost in ' +
          'the same relative units, and the two columns are sorted independently.',
        steps: [
          { do: 'Sum both columns over all eleven features.',
            why: 'The overall shape of the language before looking at any one feature.',
            work: '21 units of parser work against 25 after it — a ratio of 1.19' },
          { do: 'Find the feature that costs most after the parser.',
            why: 'This is the one that will dominate the next three milestones.',
            work: 'sum types and pattern matching, at 5 units, against 4 to parse' },
          { do: 'Find the worst ratio.',
            why: 'The ratio is what "cheap to add" hides.',
            work: 'arrays and modules, both 1 unit to parse and 3 after it — 3.00 times' },
          { do: 'Sort by parser cost alone and see where operators and literals land.',
            why: 'This is the ranking a language designed from the parser outwards would use.',
            work: 'joint second at 3 units each, against joint last by later cost at 1 each' },
          { do: 'Find the two features that cost about the same everywhere.',
            why: 'This is what a genuinely cheap feature looks like.',
            work: 'conditionals at 1 and 1, and annotations at 2 and 2' }
        ],
        answer: 'The two rankings disagree at the top and at the bottom. Operators are the most ' +
          'expensive thing to parse and among the cheapest afterwards; arrays and modules are ' +
          'the cheapest to parse and cost three times as much again in stages nobody is looking ' +
          'at while writing the grammar. That inversion is the reason to score both columns ' +
          'before committing to a production, and it is why the pipeline diagram is a design ' +
          'tool rather than documentation.'
      },
      {
        title: 'The coverage column finding a feature nobody had run',
        goal: 'Show that "every feature is covered" is a test, not a claim.',
        setup: 'Each conformance program names the features it exercises; the coverage table ' +
          'inverts that and reports any feature with no programs.',
        steps: [
          { do: 'Count the conformance programs and the features.',
            why: 'The two ends of the mapping.',
            work: '17 programs against 11 features' },
          { do: 'Read the coverage column on the first page load.',
            why: 'This is the check running for real rather than being described.',
            work: 'modules showed 0 programs and a verdict of NO' },
          { do: 'Ask what was actually broken.',
            why: 'A gap in coverage is not the same as a broken feature.',
            work: 'nothing — imports resolved and checked correctly by 2 stages, and 0 programs ' +
              'had ever run either path' },
          { do: 'Add one program that imports two modules and uses both.',
            why: 'The smallest thing that closes the gap.',
            work: '17 programs, 11 of 11 features covered' },
          { do: 'Compare with the other gap this milestone found the same way.',
            why: 'Two gaps, one from coverage and one from a missing shape.',
            work: '0 of the 15 programs had a let inside a function either, and the type checker ' +
              'crashed on every such program for the whole build' }
        ],
        answer: 'The modules gap was harmless and the let-inside-a-function gap was fatal, and ' +
          'neither was visible from reading the spec. That asymmetry is the argument for the ' +
          'column: it costs nothing to compute, it cannot tell you which kind of gap you have, ' +
          'and the only way to find out is to close it. Fifteen green conformance rows said ' +
          'nothing about a construct nobody had written down.'
      }
    ],

    'the-lexer': [
      {
        title: 'Three malformed literals, and the scanner carrying on past all of them',
        goal: 'Show that error tokens are what make an editor possible.',
        setup: 'A six-line file with a comment, an unterminated string, a number with two ' +
          'decimal points, a hex literal Berugo does not have, and two lines that are fine.',
        steps: [
          { do: 'Count the tokens and the trivia.',
            why: 'Every character of the file must be reachable from the stream.',
            work: '26 tokens carrying 23 pieces of trivia across 138 characters' },
          { do: 'Count the error tokens.',
            why: 'One per malformed literal, and no exceptions.',
            work: '3 — one E-LEX-STRING at 2:9 and two E-LEX-NUMBER at 3:9 and 4:9' },
          { do: 'Read the token that follows each error token.',
            why: 'This is what "scanning continued" means concretely.',
            work: 'keyword let, punctuation ; and punctuation ; — 3 real tokens, 1 after each error' },
          { do: 'Check the two good lines.',
            why: 'A file with three mistakes must still be usable.',
            work: '2 lines scan cleanly, including 1 string interpolation' },
          { do: 'Ask what a throwing scanner would have produced.',
            why: 'The counterfactual is the argument.',
            work: '1 message and 0 tokens, so an editor would have nothing to colour' }
        ],
        answer: 'Three mistakes produce three diagnostics and a complete token stream. The ' +
          'alternative is not "three mistakes produce one diagnostic" — it is one diagnostic ' +
          'and no stream at all, which means no syntax colouring, no folding and no completion ' +
          'in a file whose only problem is a missing quote on line two.'
      },
      {
        title: 'The numeral that used to scan as two perfectly good tokens',
        goal: 'Show why a malformed number has to be one error rather than a valid split.',
        setup: 'Nine numeric forms, each scanned in the context let n = FORM; and the resulting ' +
          'token inspected.',
        steps: [
          { do: 'Scan the five well-formed cases.',
            why: 'Establish that separators, points and exponents all work.',
            work: '42, 3.5, 1_000_000 giving 1000000, 1_000.5e2 giving 100050, and 2e-3 giving 0.002' },
          { do: 'Scan 1.2.3.',
            why: 'Two decimal points is unambiguously a typo.',
            work: 'one error token — not "1.2 followed by .3", which would send the reader to ' +
              'the wrong place' },
          { do: 'Scan 0x1 with no trailing-letter check.',
            why: 'Maximal munch stops at the first character a number cannot use.',
            work: 'number 0 followed by name x1 — 2 valid tokens, and the parser then reports a ' +
              'missing semicolon further right' },
          { do: 'Scan 0x1 with the check.',
            why: 'The fix is to consume the identifier tail.',
            work: 'one error token spanning all 3 characters, reported where the numeral is' },
          { do: 'Scan 1e, which has no digits after the exponent marker.',
            why: 'The e is not consumed, so this reduces to the same case.',
            work: 'one error token — without the check it would be 1 followed by the name e' }
        ],
        answer: '4 of the 9 forms are rejected, and 3 of those 4 would otherwise have produced a ' +
          'valid token stream for a program nobody wrote. That is the failure worth designing ' +
          'against: not a crash, but a plausible parse of something else, reported several ' +
          'tokens away from the mistake.'
      }
    ],

    'the-parser': [
      {
        title: 'Two broken statements, one good one, and a tree either way',
        goal: 'Measure totality rather than assert it.',
        setup: 'A three-line file: an unclosed parenthesis, an expression with a missing operand, ' +
          'and a statement that is fine.',
        steps: [
          { do: 'Parse it and count the nodes.',
            why: 'A tree must exist.',
            work: '13 nodes, depth 4, nothing thrown' },
          { do: 'Count the error nodes and the reported problems.',
            why: 'These are different: not every problem needs a node.',
            work: '1 error node against 3 problems' },
          { do: 'Read the three problems.',
            why: 'Each one names a recovery.',
            work: 'E-PARSE-EXPECTED at 1:15 wanted a closing parenthesis, E-PARSE-EXPR at 2:13 ' +
              'wanted an expression, E-PARSE-EXPECTED at 3:1 wanted a semicolon' },
          { do: 'Ask which recovery each used.',
            why: 'Two kinds: a node in the tree, or a token treated as present.',
            work: '1 produced an error node; the other 2 inserted the required token and carried on' },
          { do: 'Check the third statement.',
            why: 'Recovery is only useful if it recovers.',
            work: 'let c = 4 + 5; parses normally, with no error node anywhere in it' }
        ],
        answer: 'Three problems, one error node, and the statement after the damage parses ' +
          'correctly. The resynchronisation point is the semicolon, which is why one broken ' +
          'statement costs one diagnostic — resynchronising inside a construct instead is how a ' +
          'compiler produces forty errors for one missing brace.'
      },
      {
        title: 'Eleven expressions printed back, and the two that lose brackets',
        goal: 'Show that the printer is minimal, not merely faithful.',
        setup: 'Each expression is parsed, then printed with the fewest parentheses the parser ' +
          'needs, and the two texts compared.',
        steps: [
          { do: 'Count the expressions that print back unchanged.',
            why: 'Faithfulness is the easy half.',
            work: '9 of 11' },
          { do: 'Read the two that change.',
            why: 'These are the ones that show minimality.',
            work: '1 + (2 * 3) becomes 1 + 2 * 3, and ((1)) + 2 becomes 1 + 2 with the node ' +
              'count dropping from 5 to 3' },
          { do: 'Check the case that must keep its brackets.',
            why: 'Minimal must not mean wrong.',
            work: '1 - (2 - 3) prints unchanged, because removing them would regroup it' },
          { do: 'Check left association without brackets.',
            why: 'The other direction of the same rule.',
            work: '1 - 2 - 3 prints unchanged, because left association already groups it that way' },
          { do: 'Read the precedence table the printer consulted.',
            why: 'This is the same table the parser used.',
            work: '13 operators over 6 levels, every right power exactly 1 more than its left' }
        ],
        answer: 'A printer that only managed the first case would be faithful and would test ' +
          'nothing, because it would never have to decide. Minimality forces it to consult ' +
          'precedence at every binary node, which is what makes a disagreement with the parser ' +
          'observable — and sharing one table is what makes that disagreement impossible. This ' +
          'is the machinery 28.4 turns into a property over ten thousand programs.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
