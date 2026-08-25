/** Worked examples for AST tooling, resolution and type checking (M28.4-M28.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'ast-infrastructure': [
      {
        title: 'Two printers over one corpus, and why both numbers are needed',
        goal: 'Turn "the round-trip property holds" into a claim with a sensitivity.',
        setup: 'The same generated corpus is parsed, printed and reparsed twice: once with the ' +
          'real printer and once with a printer whose right operand requires no binding power.',
        steps: [
          { do: 'Run the real printer over the corpus.',
            why: 'The property under test.',
            work: '2 000 programs, 2 000 round trips, 0 failures' },
          { do: 'Run the broken printer over exactly the same corpus.',
            why: 'A property that has never failed cannot be trusted.',
            work: '2 000 programs, 1 894 round trips, 106 failures — 5.3%' },
          { do: 'Ask why the rate is not close to 100%.',
            why: 'A sabotage that fails everything locates nothing.',
            work: 'most of the 2 000 have nothing bracketable on the right, so the change is ' +
              'invisible to them' },
          { do: 'Read the first difference of one failure.',
            why: '"The trees differ" is useless; a path is actionable.',
            work: 'one failure reports root > program[2] > letDecl[0] > binary[0] > binary[0] ' +
              'with unary minus on the left and binary minus on the right' },
          { do: 'Scale the corpus to ten thousand.',
            why: 'The property is cheap enough to run at the acceptance criterion.',
            work: '10 000 programs, 0 failures, about 550 milliseconds' }
        ],
        answer: 'Zero failures is what you expect and means nothing on its own — it is equally ' +
          'consistent with a working property and with a generator that never produced anything ' +
          'hard. The 106 is what makes the 0 informative. Both belong in the report, and a ' +
          'property test suite that publishes only the first column is publishing a number ' +
          'whose meaning it has not established.'
      },
      {
        title: 'The same tree at three indent widths',
        goal: 'Show that "a formatter must not change the program" is checkable.',
        setup: 'One eighteen-node function is printed at two spaces, four spaces and a tab, and ' +
          'each result is reparsed and compared against the original tree.',
        steps: [
          { do: 'Print at two spaces and measure.',
            why: 'The baseline.',
            work: '88 characters over 7 lines' },
          { do: 'Print at four spaces.',
            why: 'A different string from the same tree.',
            work: '100 characters over 7 lines — 12 more, one per indented line' },
          { do: 'Print with a tab.',
            why: 'The third formatting.',
            work: '82 characters over 7 lines' },
          { do: 'Reparse all three and compare against the original tree.',
            why: 'This is the property.',
            work: '3 of 3 equal ignoring spans' },
          { do: 'Compare the cost against the alternative.',
            why: 'The reason this test is usually absent.',
            work: '3 extra parses, against a human reading the diff' }
        ],
        answer: 'Three different strings, one tree, and the check costs one parse per formatting. ' +
          'The usual test for a formatter is that its output looks right, which is a human ' +
          'reading a diff and is not run on every commit. Comparing trees turns "the formatter ' +
          'is probably safe" into a build step, and it is available only because the parser and ' +
          'the printer already agree about precedence.'
      }
    ],

    'names-and-scopes': [
      {
        title: 'One spelling, two bindings, and a rename that touches two of three occurrences',
        goal: 'Show why the binding table has to be keyed by occurrence.',
        setup: 'A file binding a at the top level, shadowing it with a parameter, and using both; ' +
          'the returned lambda captures a binding from the function\'s block scope.',
        steps: [
          { do: 'Count the scopes and the bindings.',
            why: 'The structure resolution produced.',
            work: '4 scopes, 7 bindings, 1 captured' },
          { do: 'Count occurrences and distinct bindings for a.',
            why: 'This is the number a rename has to respect.',
            work: '3 occurrences resolving to 2 bindings — a parameter at offset 16 and a let at ' +
              'offset 0' },
          { do: 'Do the same for b.',
            why: 'A second spelling with the same problem.',
            work: '2 occurrences, 2 bindings — a let at 23 inside the function and a let at 65 ' +
              'at the top level' },
          { do: 'Rename the outer a and count the edits.',
            why: 'A correct rename touches the occurrences of one binding.',
            work: '3 edits: the declaration and its 2 references, leaving the parameter untouched' },
          { do: 'Rename the outer a to b instead.',
            why: 'The new name is already bound in the same scope.',
            work: 'refused with 0 edits applied — the re-resolution shows a reference changing ' +
              'which binding it means' }
        ],
        answer: 'Two of the three spellings in a seven-line file mean more than one thing. A ' +
          'find-and-replace rename gets both wrong and the program still compiles, which is the ' +
          'worst possible failure mode: no error, different behaviour. The per-occurrence table ' +
          'is what makes the correct answer expressible at all.'
      },
      {
        title: 'Verifying a rename by doing it and re-resolving',
        goal: 'Show that a rename can check itself instead of reasoning about scopes.',
        setup: 'The rename applies its edits, resolves the result from scratch, and compares the ' +
          'reference-to-binding structure — for every reference in order, which binding index it ' +
          'resolves to — against the original.',
        steps: [
          { do: 'Rename the parameter a to p in the shadowing fixture.',
            why: 'The case a spelling-based rename gets wrong.',
            work: '2 edits, structure identical, allowed' },
          { do: 'Rename the outer a to b.',
            why: 'b is already bound at the top level.',
            work: 'refused with 0 of the 3 edits applied: renaming to b would change what some ' +
              'other name refers to' },
          { do: 'Rename a to a keyword.',
            why: 'A cheaper check that does not need re-resolution.',
            work: 'refused before any of the 3 edits is computed — let is not a valid identifier' },
          { do: 'Rename the function f from a use site rather than its declaration.',
            why: 'Both must give the same answer.',
            work: '2 edits and the same resulting source either way' },
          { do: 'Count what the verification costs.',
            why: 'The price of the guarantee.',
            work: '1 extra parse and 1 extra resolution per rename attempt' }
        ],
        answer: 'The verification is one parse and one resolution, and it replaces a scope ' +
          'analysis that has to be right about every case a language has. A renamer that ' +
          'inspects only the scope it is renaming in cannot see a capture three scopes down; ' +
          'this one cannot miss it, because a capture anywhere changes the structure it ' +
          'compares. Refusing with a reason is a better outcome than an edit that silently ' +
          'changes the program.'
      }
    ],

    'type-checking-in-practice': [
      {
        title: 'The same mistake with and without an annotation',
        goal: 'Show that an annotation is for the error message, not for the algorithm.',
        setup: 'Three programs, each containing one mistake, each checked twice — once as ' +
          'written and once with an annotation added at the binding.',
        steps: [
          { do: 'Check let n = true; let total = n + 1; unannotated.',
            why: 'The mistake is on line 1 and the contradiction surfaces on line 2.',
            work: 'E-TYPE-MISMATCH blaming n at offsets 26 to 27' },
          { do: 'Add the annotation: let n: Number = true;.',
            why: 'The annotation switches the checker into check mode.',
            work: 'E-TYPE-ANNOTATION blaming true at offsets 16 to 20 — a different code and a ' +
              'different span' },
          { do: 'Do the same for a record field of the wrong type.',
            why: 'A second case with the same shape.',
            work: 'E-TYPE-MISMATCH on p.x at 29 to 32 becomes E-TYPE-ANNOTATION on { x: true } ' +
              'at 23 to 34' },
          { do: 'Do the same for a function argument.',
            why: 'The case that does not move.',
            work: 'E-TYPE-CALL blaming double(true) both times — offsets 39 to 51 and 47 to 59, ' +
              'the same 12 characters' },
          { do: 'Count how many of the three moved.',
            why: 'The honest total.',
            work: '2 of 3 changed their code and 2 of 3 changed what is underlined' }
        ],
        answer: 'Two of three move and one does not, and the exception is the informative case: ' +
          'annotating the parameter of double changes nothing because the call was already ' +
          'where the two types met. An annotation only helps when it sits BETWEEN the mistake ' +
          'and the collision, which is the rule that makes "add a signature and see where the ' +
          'error goes" a technique rather than a superstition.'
      },
      {
        title: 'Reading the constraint list to see why the blame lands where it does',
        goal: 'Show that the reported location is a fact about the traversal.',
        setup: 'let n = 1; let flag = true; let bad = n + flag; is checked, and every constraint ' +
          'is printed in the order the walk produced it.',
        steps: [
          { do: 'Count the constraints and the failures.',
            why: 'The whole solving effort for a three-line program.',
            work: '2 constraints, 1 of them unsolvable' },
          { do: 'Read them in order.',
            why: 'The order is the mechanism.',
            work: 'Number against Number at 38 to 39 solved; Bool against Number at offsets ' +
              '42 to 46 not' },
          { do: 'Read the diagnostic that came from the failure.',
            why: 'Both ends of the disagreement.',
            work: 'E-TYPE-MISMATCH at 42 to 46: + needs a Number on the right, blaming flag, ' +
              'required by n + flag, expected Number, found Bool' },
          { do: 'Check what the type table says about flag.',
            why: 'A failed check must not record the expectation.',
            work: 'Bool for the 1 expression that failed its check; recording Number would make ' +
              'hover report something false' },
          { do: 'Count the type table entries.',
            why: 'The artefact the checker leaves behind.',
            work: '8 entries for a 3-line program, one per expression node' }
        ],
        answer: 'Two constraints, and the second is the one the message is about. On a larger ' +
          'program the same mechanism puts the blame wherever the walk reached the ' +
          'contradiction, which can be modules away from the mistake — and the type table is ' +
          'still built for every node, including the ones on the error path, which is why hover ' +
          'works on a file that does not compile.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
