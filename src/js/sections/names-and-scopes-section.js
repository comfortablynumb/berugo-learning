/**
 * Section: Names, scopes and resolution.
 *
 * The measurement is the shadowing table: how many occurrences a spelling has,
 * and how many DISTINCT bindings those occurrences resolve to. In the default
 * fixture `a` is used three times and means two different things, and `b` twice
 * meaning two. A rename that works on spelling gets both wrong, and it gets
 * them wrong in a way that still compiles.
 *
 * The same fixture carries a capture — the returned lambda uses the `b` bound
 * inside `f` — so the default shows both claims at once rather than making the
 * capture table say "nothing here" on arrival.
 *
 * The rename below therefore checks itself, and it takes TWO checks. It
 * applies its edits and re-resolves from scratch; then it compares the
 * reference-to-binding structure, which catches a rename that changes what an
 * existing name refers to, and separately compares the resolver's errors,
 * which catches one that binds a name twice in a scope. Neither implies the
 * other — a clash leaves every reference resolving exactly as before — and
 * either alone accepts a rename it should not.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'names-and-scopes';
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — the scope tree, and the arrow that makes a closure',
      caption: 'Scopes nest, and a name is found by walking outward until something binds it. ' +
        'The two `a` bindings in the default fixture are in different boxes, so `a` inside `f` ' +
        'and `a` at the top are different bindings that happen to share a spelling — which is ' +
        'the entire content of shadowing and the entire difficulty of rename. The dashed ' +
        'arrow is a capture: a reference inside a function to a binding the function does not ' +
        'own. Recording which function captured what is not bookkeeping, it is exactly the ' +
        'input M29\'s escape analysis needs, and it is free here because the walk that ' +
        'resolves the name already knows which function it is standing in.',
      definition: [
        'graph TD',
        'G["global scope — a, f, b, c"] --> F["fn f — parameter a"]',
        'F --> FB["body of f — b"]',
        'G --> L["a lambda inside f"]',
        'FB -.->|"a resolves here, not in global"| F',
        'L -.->|"capture: uses a binding it does not own"| FB',
        'G --> BI["builtins — print, len, some, none"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Resolution is a separate pass that produces a TABLE, and that is the whole design.** ' +
        'The shortcut is to resolve names inside the type checker, where the scope is already ' +
        'on hand. It works, and it means nothing else can ever answer "what does this name ' +
        'refer to" — not the optimiser, not go-to-definition, not rename. One extra pass makes ' +
        'every one of those a map lookup.',
      '**The table is keyed by OCCURRENCE, not by name.** Two references spelled the same in ' +
        'the same file can resolve to different bindings, and a rename must touch one and not ' +
        'the other. Keying by name would make that impossible to express, which is why a ' +
        'find-and-replace rename is wrong in a way that still compiles — the program keeps ' +
        'building and quietly means something else.',
      '**Shadowing across scopes is legal; rebinding within one is not.** `let a` inside a ' +
        'function may shadow `let a` outside it, because they are different scopes and a ' +
        'reader can see which is nearer. Two `let a` in the SAME scope is almost always a ' +
        'mistake, and it is reported with both spans so the message can show the earlier one.',
      '**Capture analysis falls out of the same walk, at no extra cost.** A reference whose ' +
        'binding lives outside the function containing it is a capture, and the walk already ' +
        'knows which function it is standing in. Recording the pair is what M29\'s escape ' +
        'analysis will read, and computing it later would mean walking the tree again with ' +
        'less information than the resolver had.',
      '**A capture propagates through every function in between.** If a lambda three levels ' +
        'deep uses a name bound at the top, all three functions have to carry it — the ' +
        'innermost cannot reach a frame the outer ones did not keep. The demo shows the whole ' +
        'chain rather than just the innermost user, because the memory cost is paid by every ' +
        'link.',
      '**An unresolved name should arrive with a suggestion, and the suggestion has a ' +
        'threshold.** The nearest name in scope by edit distance is offered, capped at three ' +
        'edits — beyond that the "suggestion" is noise that makes the message longer and less ' +
        'trustworthy. The demo includes a name that is close to nothing, precisely so the ' +
        'blank suggestion is visible as a deliberate answer.',
      '**Modules resolve to a binding like anything else.** `import math;` binds the name ' +
        '`math`, and `math.square` is a field access on it. That means an unknown module and ' +
        'an unknown export are two different errors with two different spans, and neither ' +
        'needs machinery the rest of resolution does not already have.',
      '**Forward references are a policy, and Berugo\'s is that functions hoist and `let` does ' +
        'not.** Two mutually recursive functions must both be visible before either body is ' +
        'walked; a `let` may not be used before its initialiser has run. Getting this wrong in ' +
        'either direction produces a language where some correct programs are rejected or some ' +
        'incorrect ones read uninitialised values.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — the binding table, and a rename that checks itself',
        markup: root.NamesScopesTemplate.render()
      },
      diagram: diagram(),
      insight: '**Resolving names in a separate pass, into an explicit table, is what lets the ' +
        'type checker, the optimiser and the editor all agree about what a name means — and ' +
        'resolving inline in the checker is the shortcut that eventually forces a rewrite.** ' +
        'The shortcut is genuinely tempting, because the checker is already walking the tree ' +
        'with a scope in hand and building a second data structure feels like duplication. ' +
        'What it costs is not obvious until something else needs the answer. Go-to-definition ' +
        'needs it. Rename needs it, and needs it per occurrence rather than per name. Escape ' +
        'analysis needs it. Dead-code elimination needs it. Each of those, implemented against ' +
        'a checker that resolved inline, either re-implements resolution — three ' +
        'implementations, two of which are subtly wrong about shadowing — or forces the ' +
        'checker to be restructured around a table it should have produced in the first ' +
        'place. The test for whether a compiler got this right is embarrassingly simple: ask ' +
        'it for the definition of a name. If it cannot answer without running the type ' +
        'checker, name resolution is not a data structure, and everything downstream will be ' +
        'harder than it needed to be.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.NamesScopesTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  const analyseFor = root.Helpers.memoise(function (source) {
    const analysis = root.Berugo.Ide.analyse(source);

    return Object.assign({ spots: identifierSpots(analysis),
      summary: root.Berugo.Resolve.summary(analysis.table) }, analysis);
  });

  /** Every identifier token, which is what the cursor slider indexes. */
  function identifierSpots(analysis) {
    return analysis.tokens.filter(function (token) {
      return token.kind === 'name';
    }).map(function (token) {
      return { start: token.start, end: token.end, name: token.value };
    });
  }

  const shadowFor = root.Helpers.memoise(function (source) {
    const analysis = analyseFor(source);
    const byName = new Map();

    analysis.table.references.forEach(function (entry) {
      if (!byName.has(entry.binding.name)) byName.set(entry.binding.name, []);
      byName.get(entry.binding.name).push(entry);
    });
    return shadowRows(byName, analysis);
  });

  function shadowRows(byName, analysis) {
    const rows = [];

    byName.forEach(function (entries, name) {
      const bindings = entries.map(function (entry) { return entry.binding; })
        .filter(function (binding, index, all) { return all.indexOf(binding) === index; });

      if (binding_isBuiltinOnly(bindings)) return;
      rows.push({ name: name, occurrences: entries.length, distinct: bindings.length,
        where: bindings.map(function (binding) {
          return binding.kind + ' at ' + binding.span.start;
        }).join(', ') });
    });
    return rows.sort(function (a, b) { return b.distinct - a.distinct; })
      .filter(function (row) { return analysis && row.occurrences > 0; });
  }

  function binding_isBuiltinOnly(bindings) {
    return bindings.every(function (binding) { return binding.kind === 'builtin'; });
  }

  /**
   * The memoise key is JSON, not a delimited string. A key built by joining
   * source code to other values needs a separator the source cannot contain,
   * and there is no such character: a newline appears in every program, and
   * the invisible one this used instead is exactly the kind of thing that
   * survives review and breaks later. JSON needs no separator at all.
   */
  const renameFor = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);

    return root.Berugo.Ide.rename(parts[0], parts[1], parts[2]);
  });

  function update() {
    const values = panel.values();
    const source = root.NamesScopesTemplate.SAMPLES[values['ns-sample']];
    const analysis = analyseFor(source);
    const index = Math.min(Number(values['ns-cursor']), analysis.spots.length - 1);
    const spot = analysis.spots[index] || null;

    paintSource(source, analysis, spot);
    paintMetrics(analysis, spot);
    paintScopes(analysis);
    paintShadowing(source);
    paintCaptures(analysis);
    paintErrors(analysis);
    paintRename(source, spot, values['ns-rename']);
  }

  function paintSource(source, analysis, spot) {
    const spans = spot ? root.Berugo.Ide.references(analysis, spot.start) : [];
    const definition = spot ? root.Berugo.Ide.definition(analysis, spot.start) : null;

    root.AstView.render(document.getElementById('ns-source'),
      root.AstView.multiMarkup(source, spans.concat(definition ? [definition.span] : [])));

    root.Helpers.setText('ns-source-caption', sourceCaption(spot, spans, definition));
  }

  function sourceCaption(spot, spans, definition) {
    if (!spot) return 'No identifier under the cursor.';
    return 'The cursor is on `' + spot.name + '`, which resolves to the ' +
      (definition ? definition.kind + ' bound at offset ' + definition.span.start
        : 'nothing — this name is unresolved') + '. ' + spans.length + ' reference' +
      (spans.length === 1 ? ' is' : 's are') + ' highlighted, plus the binding site. Any ' +
      'other occurrence of the same spelling that is NOT highlighted is a different binding, ' +
      'and that is the case a spelling-based rename destroys.';
  }

  function paintMetrics(analysis, spot) {
    const summary = analysis.summary;
    const definition = spot ? root.Berugo.Ide.definition(analysis, spot.start) : null;

    root.MetricGrid.update({
      'ns-scopes': { value: root.Format.exact(summary.scopes),
        note: 'the global scope plus one for each function, block, match arm and loop' },
      'ns-bindings': { value: root.Format.exact(summary.bindings),
        note: summary.references + ' references resolve to them; the builtins are excluded' },
      'ns-captured': { value: root.Format.exact(summary.captured),
        note: summary.captured
          ? 'each one has to be carried by every function between the use and the binding'
          : 'nothing in this fixture is used outside the function that owns it' },
      'ns-under-cursor': { value: spot ? spot.name : '—',
        note: definition ? 'the ' + definition.kind + ' bound at offset ' +
          definition.span.start : (spot ? 'unresolved' : 'move the cursor') }
    });
  }

  function paintScopes(analysis) {
    const rows = root.Berugo.Resolve.scopeRows(analysis.table);

    root.jQuery('#ns-scope-table tbody').html(rows.map(function (row) {
      const names = row.bindings.map(function (entry) { return entry.name; });
      const uses = row.bindings.reduce(function (sum, entry) { return sum + entry.uses; }, 0);
      const captured = row.bindings.filter(function (entry) { return entry.captured; });

      return '<tr><td class="mono">' + new Array(row.depth + 1).join('· ') + row.id +
        '</td><td>' + row.kind + '</td><td class="mono">' +
        root.Helpers.escapeHtml(names.join(', ') || '—') + '</td><td class="mono">' + uses +
        '</td><td class="mono">' +
        root.Helpers.escapeHtml(captured.map(function (e) { return e.name; }).join(', ') || '—') +
        '</td></tr>';
    }).join(''));

    root.Helpers.setText('ns-scope-table-caption',
      rows.length + ' scopes, indented by nesting depth. A name is resolved by starting in ' +
      'the scope of the reference and walking up this tree until something binds it — so a ' +
      'binding in a deeper row hides one with the same name in a shallower row for every ' +
      'reference underneath it, and only for those. The builtins live in the global scope and ' +
      'are excluded from the counts, which is why a file with no declarations shows zero ' +
      'bindings rather than four.');
  }

  function paintShadowing(source) {
    const rows = shadowFor(source);
    const shadowed = rows.filter(function (row) { return row.distinct > 1; });

    root.jQuery('#ns-shadow-table tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + root.Helpers.escapeHtml(row.name) +
        '</td><td class="mono">' + row.occurrences + '</td><td class="mono">' + row.distinct +
        '</td><td class="mono">' + root.Helpers.escapeHtml(row.where) + '</td></tr>';
    }).join('') || '<tr><td colspan="4">no resolved references in this fixture</td></tr>');

    root.Helpers.setText('ns-shadow-table-caption', shadowCaption(rows, shadowed));
  }

  function shadowCaption(rows, shadowed) {
    if (!shadowed.length) {
      return 'Every spelling in this fixture means exactly one thing, so a find-and-replace ' +
        'rename would happen to be correct here. That is the case people test on. Switch to ' +
        'the shadowing or nested fixture for the case they do not.';
    }
    return shadowed.length + ' of ' + rows.length + ' spellings resolve to more than one ' +
      'binding: ' + shadowed.map(function (row) {
        return '`' + row.name + '` has ' + row.occurrences + ' occurrences and ' +
          row.distinct + ' bindings';
      }).join(', ') + '. This is the column a rename has to respect, and the reason the ' +
      'binding table is keyed by occurrence rather than by name — the third column is exactly ' +
      'the number of different answers the question "what does this name mean" has in one file.';
  }

  /**
   * A function record is `{ node, parent, captures, params }` — the name and
   * the span live on the node, not on the record. A binding owned by nothing
   * is owned by the file itself, which is a real answer rather than a missing
   * one, so it is named rather than left blank.
   */
  function functionLabel(fn) {
    if (!fn) return 'the top level';
    if (fn.node && fn.node.name) return fn.node.name;
    if (fn.node && fn.node.span) return 'a lambda at ' + fn.node.span.start;
    return 'the top level';
  }

  function paintCaptures(analysis) {
    const rows = [];

    analysis.table.functions.forEach(function (fn) {
      (fn.captures || []).forEach(function (binding) {
        rows.push({ fn: functionLabel(fn), name: binding.name,
          owner: functionLabel(binding.owner) });
      });
    });

    root.jQuery('#ns-capture-table tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + root.Helpers.escapeHtml(row.fn) + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row.name) + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row.owner) + '</td><td>the use is inside ' +
        root.Helpers.escapeHtml(row.fn) + ' and the binding is not</td></tr>';
    }).join('') || '<tr><td colspan="4">no captures in this fixture — every name is used ' +
      'inside the function that owns it</td></tr>');

    root.Helpers.setText('ns-capture-table-caption',
      rows.length + ' capture' + (rows.length === 1 ? '' : 's') + '. A function appearing ' +
      'more than once in the first column carries more than one value in its closure, and a ' +
      'binding appearing more than once in the second is carried by more than one function — ' +
      'which is what "a capture propagates through every function in between" means in ' +
      'practice. This table is the input to escape analysis: a captured binding cannot live ' +
      'only on the stack frame that created it, because the closure outlives the frame.');
  }

  function paintErrors(analysis) {
    const rows = analysis.table.errors.filter(function (entry) {
      return entry.code === 'E-RESOLVE-UNBOUND';
    });

    root.jQuery('#ns-error-table tbody').html(rows.map(function (entry) {
      const written = analysis.source.slice(entry.span.start, entry.span.end);
      const at = root.Berugo.Lexer.position(analysis.source, entry.span.start);

      return '<tr><td class="mono">' + root.Helpers.escapeHtml(written) +
        '</td><td class="mono">' + at.line + ':' + at.column + '</td><td class="mono">' +
        root.Helpers.escapeHtml(entry.suggestion || 'none offered') + '</td><td class="mono">' +
        (entry.suggestion
          ? root.Berugo.Resolve.distance(written, entry.suggestion) : '> 3') +
        '</td></tr>';
    }).join('') || '<tr><td colspan="4">every name in this fixture resolves</td></tr>');

    root.Helpers.setText('ns-error-table-caption', errorCaption(rows));
  }

  function errorCaption(rows) {
    const offered = rows.filter(function (row) { return row.suggestion; }).length;

    if (!rows.length) {
      return 'Every name resolves here. Switch to the typo fixture to see the suggestions, ' +
        'including the one deliberately too far from anything to earn one.';
    }
    return offered + ' of ' + rows.length + ' unresolved names got a suggestion. The cap is ' +
      'three edits, and the row without one is the point: a "did you mean" that is four edits ' +
      'away is not a suggestion, it is the compiler guessing out loud, and after the second ' +
      'wrong guess a reader stops reading the line at all. Withholding it costs nothing and ' +
      'keeps the ones that are offered worth reading.';
  }

  function paintRename(source, spot, target) {
    const outcome = spot && target
      ? renameFor(JSON.stringify([source, spot.start, target]))
      : { ok: false, why: 'no identifier under the cursor', touched: 0, verified: false };
    const rows = [
      ['Requested', spot ? '`' + spot.name + '` → `' + target + '`' : '—'],
      ['Allowed', outcome.ok ? 'yes' : 'no — ' + outcome.why],
      ['Occurrences edited', String(outcome.touched)],
      ['Verified by re-resolving', outcome.verified ? 'yes, the binding structure is identical'
        : 'the edit was not applied'],
      ['Result', outcome.ok ? outcome.source.replace(/\n/g, ' ⏎ ') : '—']
    ];

    root.jQuery('#ns-rename-table tbody').html(rows.map(function (row) {
      return '<tr><td>' + root.Helpers.escapeHtml(row[0]) + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row[1]) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('ns-rename-table-caption', renameCaption(outcome));
  }

  function renameCaption(outcome) {
    return (outcome.ok
      ? 'The rename touched ' + outcome.touched + ' occurrence' +
        (outcome.touched === 1 ? '' : 's') + ' and nothing else. '
      : 'The rename was refused. ') +
      'The verification is the part worth copying: the edits are applied, the result is ' +
      'resolved from scratch, and the reference-to-binding structure is compared against the ' +
      'original. Renaming is a change of spelling, so that structure must come out identical; ' +
      'if it does not, the new name captured something and the answer is a refusal rather ' +
      'than an edit that silently changes the program. A renamer that only inspects the scope ' +
      'it is renaming in cannot see a capture three scopes down — try renaming the parameter ' +
      '`a` to `b` in the shadowing fixture and watch it be refused for exactly that reason.';
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
