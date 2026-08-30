/**
 * Section: Advanced branch prediction.
 *
 * Five predictors on five patterns, and one fixture that exists to separate
 * them: a branch whose outcome is decided by what two earlier branches did.
 * Per-site counters see a coin flip weighted three to one; anything indexed by
 * global history sees four separate cases and learns each of them.
 *
 * The overall accuracy figure is deliberately not the headline here. On the
 * correlated fixture two thirds of the branches are unpredictable by
 * construction, so every predictor is stuck near the same ceiling and the
 * difference only appears on the one site that carries the correlation - which
 * is the whole argument for reporting accuracy per site.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'advanced-branch-prediction';
  const Predictors = root.Brv32.Predictors;
  const Traces = root.Brv32.Traces;
  const View = root.PredictorView;
  let panel = null;
  let chart = null;

  const KINDS = ['bimodal', 'gshare', 'tournament', 'tage'];
  const TRACES = ['correlated', 'alternating', 'nested', 'loop', 'random'];
  const CORRELATED_SITE = 0x308;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — gshare, and why the exclusive-or is the whole idea',
      caption: 'A bimodal predictor gives one counter to each branch address. gshare gives '
        + 'each address several, one per recent history pattern, by exclusive-oring the '
        + 'address with a shift register of recent outcomes. A branch whose behaviour depends '
        + 'on what an earlier branch did therefore gets a separate counter for each case, and '
        + 'each of those counters can be right. The price is that two unrelated sites can now '
        + 'collide in more ways than before.',
      definition: [
        'flowchart LR',
        '    PC["branch address<br/>bits 11:2"] --> X{"exclusive or"}',
        '    GH["global history<br/>a shift register of recent outcomes"] --> X',
        '    X --> T["counter table<br/>2^n two-bit counters"]',
        '    T --> P["prediction"]',
        '    P -.->|"outcome"| GH',
        '    P -.->|"outcome"| T'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Branches correlate with each other, and a per-site predictor cannot see it.** If a '
        + 'branch is taken exactly when two earlier ones were, then its own history is a coin '
        + 'flip and its behaviour is perfectly determined — by information a counter indexed '
        + 'only by address never receives.',
      '**Global history is a shift register of recent outcomes, and gshare exclusive-ors it '
        + 'with the address.** That gives one branch site several counters, one per history '
        + 'pattern, so each case gets its own answer. It is a remarkably small change to a '
        + 'bimodal predictor and it is the one that made correlation predictable.',
      '**Local history is the other kind, and it fixes a different problem.** A per-site '
        + 'history register captures a branch with its own repeating pattern — taken, taken, '
        + 'not taken, repeating — which global history mixes with everything else going on. '
        + 'Neither subsumes the other, which is why tournament predictors exist.',
      '**A tournament predictor runs two and learns which to believe, per site.** The chooser '
        + 'is itself a saturating counter, updated only when the two disagree. It costs more '
        + 'than either predictor alone and wins because real programs contain both kinds of '
        + 'branch.',
      '**TAGE indexes several tagged tables at geometrically increasing history lengths and '
        + 'takes the longest match.** A branch that needs two bits of history and one that '
        + 'needs fifty are both predicted well, because each is answered by the table whose '
        + 'history length it actually needs. It has won every prediction championship for '
        + 'nearly twenty years.',
      '**Aliasing is the cost of every indexed table, and history makes it worse.** Two sites '
        + 'that share an index share a counter and interfere. Adding history bits spreads one '
        + 'site over more entries, which helps that site and crowds everything else — so a '
        + 'table too small for the working set can make gshare worse than bimodal.',
      '**Indirect branches are a different problem and mostly an unsolved one.** A direction is '
        + 'one bit; an indirect target is a full address chosen from many. A virtual call or a '
        + 'jump table needs a target predictor with history, and it is why devirtualisation is '
        + 'worth so much to a compiler.',
      '**98% sounds finished until you multiply.** At a branch every five instructions and a '
        + '20-cycle penalty, 2% wrong is 4 mispredicts per thousand instructions and 80 lost '
        + 'cycles per thousand — around 7% of runtime spent on work that gets thrown away, '
        + 'from a predictor everybody would call excellent.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: { title: 'Interactive demo — the predictor tournament',
        markup: root.AdvancedPredictorTemplate.render() },
      diagram: diagram(),
      insight: insight()
    };
  }

  function insight() {
    return '**A prediction accuracy is not a result until it has been multiplied by what a '
      + 'mistake costs, and the multiplication is where the intuition breaks.** Ninety-eight '
      + 'per cent sounds like a solved problem. At a branch every five instructions that is '
      + 'four mispredicts per thousand instructions, and at a twenty-cycle penalty those four '
      + 'cost eighty cycles — against a thousand instructions that would ideally take a '
      + 'thousand cycles. Seven per cent of the machine, from a predictor nobody would '
      + 'criticise. Going from 98% to 99% halves that, which is why an enormous amount of '
      + 'silicon and two decades of research went into the last percentage point of something '
      + 'that already looked finished. The transferable habit is to stop quoting rates and '
      + 'start quoting the product of the rate and the cost. A cache at 95% is excellent or '
      + 'catastrophic depending entirely on whether a miss costs 10 nanoseconds or 10 '
      + 'milliseconds; a retry policy that succeeds 99% of the time is fine or fatal depending '
      + 'on what the 1% does. The number that ends an argument is always rate times cost, and '
      + 'the number that starts one is always just the rate.';
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({
      controls: root.AdvancedPredictorTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------- plumbing */

  function fill(id, rows) {
    root.jQuery('#' + id + ' tbody').html(rows.map(function (cells) {
      return '<tr>' + cells.map(function (cell) {
        return '<td>' + root.Helpers.escapeHtml(String(cell)) + '</td>';
      }).join('') + '</tr>';
    }).join(''));
  }

  const traceFor = root.Helpers.memoise(function (name) {
    return Traces.build(name);
  });

  const resultFor = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);

    return Predictors.evaluate(parts.kind, traceFor(parts.trace), { bits: parts.bits });
  });

  function keyFor(kind, trace, bits) {
    return JSON.stringify({ kind: kind, trace: trace, bits: bits });
  }

  function siteAccuracy(result, pc) {
    const found = result.sites.filter(function (site) { return site.pc === pc; })[0];

    return found ? found.right / found.seen : null;
  }

  function reading() {
    const values = panel.values();
    const bits = Number(values['abp-bits']);

    return { trace: values['abp-trace'], bits: bits,
      penalty: Number(values['abp-penalty']),
      results: KINDS.map(function (kind) {
        return resultFor(keyFor(kind, values['abp-trace'], bits));
      }) };
  }

  /* --------------------------------------------------------------- render */

  function update(app) {
    const view = reading();

    paintMetrics(view);
    paintTournament(view);
    paintSites(view);
    paintMatrix(view);
    paintDesigns();
    paintAliasing(view);
    paintChart(app, view);
  }

  function bestOf(view) {
    return view.results.reduce(function (winner, result) {
      return result.accuracy > winner.accuracy ? result : winner;
    }, view.results[0]);
  }

  function byKind(view, kind) {
    return view.results.filter(function (result) { return result.kind === kind; })[0];
  }

  function paintMetrics(view) {
    const best = bestOf(view);
    const bimodal = byKind(view, 'bimodal');
    const gshare = byKind(view, 'gshare');
    const cost = View.costOf(gshare, { penalty: view.penalty,
      instructions: 5 * gshare.seen });
    const local = siteAccuracy(bimodal, CORRELATED_SITE);
    const global = siteAccuracy(gshare, CORRELATED_SITE);

    root.MetricGrid.update({
      'abp-best': { value: best.name,
        note: (100 * best.accuracy).toFixed(1) + '% on this pattern' },
      'abp-bimodal': { value: (100 * bimodal.accuracy).toFixed(1) + '%',
        note: 'one counter per branch address' },
      'abp-gshare': { value: (100 * gshare.accuracy).toFixed(1) + '%',
        note: 'the same table, indexed with global history' },
      'abp-separation': { value: local === null ? 'not in this pattern'
        : (100 * (global - local)).toFixed(1) + ' points',
        note: local === null ? 'the correlated site only exists in the correlated pattern'
          : 'on site 0x308: ' + (100 * local).toFixed(1) + '% against ' +
            (100 * global).toFixed(1) + '%' },
      'abp-mpki': { value: View.perThousand(gshare, 5 * gshare.seen).toFixed(1),
        note: 'gshare, at a branch every five instructions' },
      'abp-cost': { value: (100 * cost.share).toFixed(1) + '%',
        note: cost.misses + ' misses x ' + view.penalty + ' cycles' }
    });
  }

  function paintTournament(view) {
    fill('abp-tournament', view.results.map(function (result) {
      const row = View.row(result, { penalty: view.penalty, instructions: 5 * result.seen });

      return [row.name, (100 * row.accuracy).toFixed(1) + '%', row.misses,
        row.perThousand.toFixed(1), row.about];
    }));
    root.Helpers.setText('abp-tournament-caption', tournamentCaption(view));
  }

  function tournamentCaption(view) {
    if (view.trace !== 'correlated') {
      return 'Overall accuracy on this pattern. The spread here is real, and the correlated '
        + 'pattern is where it is largest — switch to it and then read the per-site table '
        + 'below, because on that fixture the overall number understates the difference '
        + 'badly.';
    }
    return 'Two of the three branch sites in this fixture are coin flips by construction, so '
      + 'every predictor is stuck near the same ceiling and the overall numbers look close. '
      + 'The difference is entirely on the third site, and the table below separates them.';
  }

  function paintSites(view) {
    fill('abp-sites', KINDS.map(function (kind) {
      const result = resultFor(keyFor(kind, view.trace, view.bits));

      return [result.name].concat([0x300, 0x304, CORRELATED_SITE].map(function (pc) {
        const found = siteAccuracy(result, pc);

        return found === null ? '—' : (100 * found).toFixed(1) + '%';
      })).concat([(100 * result.accuracy).toFixed(1) + '%']);
    }));
    root.Helpers.setText('abp-sites-caption', sitesCaption(view));
  }

  function sitesCaption(view) {
    if (view.trace !== 'correlated') {
      return 'These three addresses only exist in the correlated fixture; on any other '
        + 'pattern the columns are empty and only the overall figure means anything. Switch '
        + 'to "correlated" to see the separation this section is about.';
    }
    const local = siteAccuracy(byKind(view, 'bimodal'), CORRELATED_SITE);
    const global = siteAccuracy(byKind(view, 'gshare'), CORRELATED_SITE);

    return 'The third column is the whole section. Site 0x308 is taken exactly when both of '
      + 'the others were, so a per-site counter settles on "not taken" and reaches '
      + (100 * local).toFixed(1) + '%, while a history-indexed one reaches '
      + (100 * global).toFixed(1) + '%. The first two columns stay near 50% for everybody, '
      + 'because they are coin flips and nothing predicts those.';
  }

  function paintMatrix(view) {
    fill('abp-matrix', TRACES.map(function (trace) {
      const results = KINDS.map(function (kind) {
        return resultFor(keyFor(kind, trace, view.bits));
      });
      const best = results.reduce(function (winner, result) {
        return result.accuracy > winner.accuracy ? result : winner;
      }, results[0]);

      return [trace + (trace === view.trace ? ' <-' : '')]
        .concat(results.map(function (result) {
          return (100 * result.accuracy).toFixed(1) + '%';
        }))
        .concat([best.name]);
    }));
    root.Helpers.setText('abp-matrix-caption', 'No predictor wins every row, which is the '
      + 'honest result and the reason tournament predictors exist. gshare spreads a single '
      + 'loop branch across many counters and does worse on the plain loop than a bimodal '
      + 'predictor does; on the correlated and alternating patterns it is far ahead. A design '
      + 'that runs both and learns which to trust is more area and fewer surprises.');
  }

  function paintDesigns() {
    fill('abp-designs', [
      ['bimodal', 'one saturating counter per branch address',
        'the loop-boundary double miss', 'a table, and nothing else'],
      ['gshare', 'exclusive-or the address with a global history register',
        'branches whose outcome depends on earlier branches',
        'more aliasing: one site now occupies several entries'],
      ['tournament', 'run two predictors and learn which to believe per site',
        'the fact that neither local nor global wins everywhere',
        'both tables, plus a chooser table'],
      ['TAGE', 'tagged tables at geometric history lengths; the longest match answers',
        'branches needing very different amounts of history, at the same time',
        'tags, several tables, and an allocation policy that is most of the design'],
      ['perceptron', 'a linear function of the history bits, trained online',
        'very long histories, which a table cannot index',
        'a multiply-accumulate per prediction, on the critical path']
    ]);
    root.Helpers.setText('abp-designs-caption', 'Each row fixes what the row above it could '
      + 'not, and pays for it in area or in latency. The last two are where prediction stops '
      + 'being a lookup and becomes a small machine-learning problem running inside the fetch '
      + 'stage — with a latency budget of a cycle or two, which is what rules most of machine '
      + 'learning out.');
  }

  function paintAliasing(view) {
    fill('abp-aliasing', [4, 6, 8, 10, 12].map(function (bits) {
      const result = resultFor(keyFor('gshare', view.trace, bits));

      return [bits, Math.pow(2, bits), (100 * result.accuracy).toFixed(1) + '%',
        describeAliasing(bits)];
    }));
    root.Helpers.setText('abp-aliasing-caption', 'A table too small for the working set makes '
      + 'gshare worse, not just less good: history spreads each site over many entries, so a '
      + 'small table collides more than a bimodal one would. That is the trade nobody mentions '
      + 'when describing gshare as an improvement — it is an improvement given enough entries, '
      + 'and a regression without them.');
  }

  function describeAliasing(bits) {
    if (bits <= 4) return 'sixteen counters for every site and every history — heavy collision';
    if (bits <= 6) return 'still crowded; unrelated sites share counters';
    if (bits <= 8) return 'enough for this fixture, not for a real program';
    return 'roomy here; a real program has thousands of active branch sites';
  }

  function paintChart(app, view) {
    const host = root.jQuery('#abp-chart')[0];

    if (!host) return;
    if (chart) chart.destroy();
    chart = root.ErrorBandView.bars(host, {
      lazyLib: app.lazyLib, height: 280, yLabel: 'accuracy (%)',
      values: TRACES.reduce(function (out, trace) {
        ['bimodal', 'gshare', 'tage'].forEach(function (kind, index) {
          const result = resultFor(keyFor(kind, trace, view.bits));

          out.push({ label: trace + ' ' + kind, value: 100 * result.accuracy, series: index });
        });
        return out;
      }, [])
    });
    root.Helpers.setText('abp-chart-note', 'Three predictors across five patterns. The bars '
      + 'that matter are the alternating group, where the per-site counter is at zero and the '
      + 'history-based ones are near perfect, and the loop group, where gshare is worse than '
      + 'bimodal because history spread one well-behaved branch over many counters. Neither '
      + 'result is visible in a single overall accuracy figure.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
