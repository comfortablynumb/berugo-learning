/**
 * Section: Assembler, linker and loading.
 *
 * Source to object to image to running machine, with every stage inspectable
 * and nothing described that is not also built. An object file here is what
 * an object file is anywhere: bytes, the symbols it defines, and the holes it
 * could not fill. Linking places the bytes, resolves each hole against the
 * combined symbol table, and patches the instruction the hole is in.
 *
 * Two of the four scenarios fail on purpose. An undefined symbol is the
 * failure everybody has seen; an out-of-range branch is the one that explains
 * why large binaries need veneers, and the fourth scenario builds one and
 * runs it.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'assembler-linker-and-loading';
  const Linker = root.Brv32.Linker;
  const Reference = root.Brv32.Reference;
  const Isa = root.Brv32.Isa;
  let panel = null;
  let chart = null;

  const MAIN = ['_start:', '  li a0, 5', '  li a1, 5', '  beq a0, a1, target',
    '  li a0, 0', '  ecall'].join('\n');
  const MAIN_VENEER = ['_start:', '  li a0, 5', '  li a1, 5', '  beq a0, a1, veneer',
    '  li a0, 0', '  ecall'].join('\n');
  const VENEER = ['veneer:', '  j target'].join('\n');
  const PAD = '  .space 5000';
  const TARGET = ['target:', '  li a0, 42', '  ecall'].join('\n');

  const SCENARIOS = {
    both: [['main.o', MAIN], ['target.o', TARGET]],
    missing: [['main.o', MAIN]],
    far: [['main.o', MAIN], ['pad.o', PAD], ['target.o', TARGET]],
    veneer: [['main.o', MAIN_VENEER], ['veneer.o', VENEER], ['pad.o', PAD],
      ['target.o', TARGET]]
  };

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — the artefacts between the stages',
      caption: 'Each arrow produces something a person can look at, and the section shows all '
        + 'four. The relocation table is the interesting one: it is exactly the list of things '
        + 'the assembler could not know, which is why an assembler can compile a file that '
        + 'refers to a function in another file at all.',
      definition: [
        'flowchart LR',
        '    S["source<br/>labels and instructions"] -->|"assemble, two passes"| O["object<br/>bytes + symbols + relocations"]',
        '    O -->|"place"| P["layout<br/>every object given a base"]',
        '    P -->|"resolve"| T["symbol table<br/>every name, one address"]',
        '    T -->|"patch"| I["image<br/>no holes left"]',
        '    I -->|"load"| M["memory<br/>at the addresses it was linked for"]',
        '    M -->|"jump to the entry"| R["a running program"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**An assembler needs two passes because a label can be used before it is defined.** '
        + 'The first pass measures: every instruction\'s size is known, so every label gets an '
        + 'address. The second pass encodes, now that the addresses exist. One pass could only '
        + 'assemble a program with no forward branches, which is no program at all.',
      '**An object file is three things: bytes, symbols and holes.** The bytes are what could '
        + 'be encoded, the symbols are what this file offers to others, and the relocations '
        + 'are what it could not fill in — a list of "at this address, there is a hole of this '
        + 'shape, for this name". That triple is the entire content of an object format, ELF '
        + 'included.',
      '**A relocation has a shape, and patching the wrong one is worse than failing.** A '
        + 'branch offset lives in the scrambled B-format field; a jump lives in the J field; a '
        + 'data word is a plain 32 bits. Writing the value into the wrong field produces an '
        + 'instruction that decodes cleanly and goes somewhere else, which is the hardest kind '
        + 'of bug to see.',
      '**Placement decides the addresses, and the addresses decide whether relocations fit.** '
        + 'The linker gives each object a base and builds one symbol table. Only then is it '
        + 'possible to say what offset a branch needs — which is why "out of range" is a '
        + 'linker error rather than an assembler one, and why it appears only after the code '
        + 'grows.',
      '**Out of range must be reported, never truncated.** A branch that cannot reach its '
        + 'target has no correct encoding; silently keeping the low bits produces a jump to '
        + 'somewhere plausible. The linker here says "needs 5012" and refuses, which is the '
        + 'only useful answer.',
      '**A veneer is what a real linker inserts when the offset does not fit.** A short branch '
        + 'to a nearby stub, and the stub takes a longer-reaching jump to the real target. It '
        + 'costs an instruction and some space, and it is why large binaries contain thousands '
        + 'of tiny functions nobody wrote. The fourth scenario builds one and runs it.',
      '**Report every failure, not the first.** A linker that stops at the first undefined '
        + 'symbol makes you rebuild once per missing name. Collecting them all is a small '
        + 'change in the code and a large change in how the tool feels to use — which is true '
        + 'of type checkers, parsers and validators too.',
      '**Loading is placement again, at run time.** The image was linked for particular '
        + 'addresses; the loader copies it there and jumps to the entry symbol. When the '
        + 'addresses cannot be known in advance you need position-independent code or '
        + 'load-time relocation, which is where M39 begins.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: { title: 'Interactive demo — four link jobs, two of which fail on purpose',
        markup: root.LinkerTemplate.render() },
      diagram: diagram(),
      insight: insight()
    };
  }

  function insight() {
    return '**"Why does this link and that one not" is almost always a question about ranges '
      + 'and names, and both are decided by information that does not exist until the last '
      + 'possible moment.** An assembler cannot know how far away a function in another file '
      + 'is, so it leaves a hole with a shape; a linker cannot know whether the hole is big '
      + 'enough until every object has an address. That is why a program can compile perfectly, '
      + 'link perfectly for years, and then fail to link the day somebody adds a few thousand '
      + 'bytes in between — the code that broke is not the code that changed. The fix real '
      + 'toolchains apply is the veneer: a stub near enough to reach, which reaches further '
      + 'itself, and which nobody wrote. It is worth recognising this as a general shape rather '
      + 'than a linker curiosity, because deferred binding appears everywhere and always with '
      + 'the same two failure modes. A name that resolves at run time can be missing; a '
      + 'reference that is encoded with a limited reach can become unreachable. Dynamic '
      + 'libraries, plugin registries, service discovery, database foreign keys and message '
      + 'schemas are all this pattern, and the good implementations of all of them do exactly '
      + 'what this linker does: fail loudly, name the symbol, and say what it would have taken '
      + 'to succeed.';
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({
      controls: root.LinkerTemplate.controls,
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

  const jobOf = root.Helpers.memoise(function (name) {
    const objects = SCENARIOS[name].map(function (pair) {
      return Linker.compile(pair[0], pair[1]);
    });
    const linked = Linker.link(objects, { base: 0, entrySymbol: '_start' });

    return { objects: objects, linked: linked, run: linked.ok ? execute(linked) : null };
  });

  function execute(linked) {
    const machine = Reference.create({ image: linked.image, entry: linked.entry || 0 });
    const out = Reference.run(machine, { budget: 200, stopOnTrap: true });

    return { value: Reference.snapshot(machine).registers[10], steps: out.steps };
  }

  function reading() {
    const values = panel.values();

    return { scenario: values['lnk-scenario'], stage: values['lnk-stage'],
      job: jobOf(values['lnk-scenario']) };
  }

  /* --------------------------------------------------------------- render */

  function update(app) {
    const view = reading();

    paintMetrics(view);
    paintStage(view);
    paintObjects(view);
    paintRelocations(view);
    paintMap(view);
    paintKinds(view);
    paintPasses(view);
    paintChart(app, view);
  }

  function baseOf(job, name) {
    const row = job.linked.layout.placed.filter(function (placed) {
      return placed.object.name === name;
    })[0];

    return row ? row.base : 0;
  }

  function paintMetrics(view) {
    const job = view.job;
    const failure = job.linked.failed[0];

    root.MetricGrid.update({
      'lnk-objects': { value: job.objects.length,
        note: job.objects.map(function (row) { return row.name; }).join(', ') },
      'lnk-image': { value: job.linked.image.length + ' bytes',
        note: 'placed end to end, aligned to 4' },
      'lnk-symbols': { value: Object.keys(job.linked.symbols).length,
        note: Object.keys(job.linked.symbols).join(', ') || 'none' },
      'lnk-relocations': { value: job.linked.applied.length,
        note: job.linked.failed.length + ' of them could not be filled' },
      'lnk-result': { value: job.linked.ok ? 'linked' : 'refused',
        note: failure ? failure.symbol + ': ' + failure.why : 'every hole was filled' },
      'lnk-run': { value: job.run ? 'a0 = ' + job.run.value : 'nothing to run',
        note: job.run ? job.run.steps + ' instructions, then ecall'
          : 'the link failed, so there is no image' }
    });
  }

  const STAGE_NOTE = {
    object: 'Each object was assembled on its own, at origin 0, knowing nothing about the '
      + 'others. Everything it could encode is bytes; everything it could not is a relocation.',
    placed: 'Placement is the first moment any address is real. Until an object has a base, '
      + '"how far is target from here" has no answer — which is why range errors are linker '
      + 'errors.',
    relocated: 'Each hole is patched through the ISA\'s own field tables, so the linker and '
      + 'the assembler cannot disagree about where a bit goes. A hole that does not fit is '
      + 'reported with the offset it needed.',
    running: 'The image is copied to the addresses it was linked for and the machine jumps to '
      + 'the entry symbol. Loading is placement again, at run time.'
  };

  function paintStage(view) {
    fill('lnk-stage-table', stageRows(view));
    root.Helpers.setText('lnk-stage-table-caption', STAGE_NOTE[view.stage]);
  }

  function stageRows(view) {
    if (view.stage === 'object') return objectStageRows(view);
    if (view.stage === 'placed') return placedStageRows(view);
    if (view.stage === 'running') return runningStageRows(view);
    return relocatedStageRows(view);
  }

  function objectStageRows(view) {
    return view.job.objects.map(function (object) {
      return [object.name, 'origin 0', object.size + ' bytes',
        Object.keys(object.symbols).length + ' symbols, ' +
          object.relocations.length + ' holes'];
    });
  }

  function placedStageRows(view) {
    return view.job.linked.layout.placed.map(function (row) {
      return [row.object.name, '0x' + row.base.toString(16),
        row.object.size + ' bytes',
        'ends at 0x' + (row.base + row.object.size).toString(16)];
    });
  }

  function relocatedStageRows(view) {
    return view.job.linked.applied.map(function (row) {
      return [row.symbol, row.at === undefined ? 'not reached' : '0x' + row.at.toString(16),
        row.ok ? 'offset ' + row.offset : row.why,
        row.ok ? 'patched into the instruction' : 'the link stops here'];
    });
  }

  function runningStageRows(view) {
    if (!view.job.run) {
      return [['nothing', '-', 'the link failed', 'there is no image to load']];
    }
    return [['entry', '0x' + (view.job.linked.entry || 0).toString(16), '_start',
      'where the loader jumps'],
    ['instructions', String(view.job.run.steps), 'executed', 'then ecall traps'],
    ['a0', String(view.job.run.value), 'the answer',
      view.job.run.value === 42 ? 'the branch reached target' : 'the branch fell through']];
  }

  function paintObjects(view) {
    fill('lnk-objects-table', view.job.objects.map(function (object) {
      return [object.name, String(object.size),
        Object.keys(object.symbols).join(', ') || 'nothing',
        object.relocations.map(function (row) { return row.symbol; }).join(', ') || 'nothing',
        '0x' + baseOf(view.job, object.name).toString(16)];
    }));
    root.Helpers.setText('lnk-objects-table-caption', 'Read the third and fourth columns as a '
      + 'supply and a demand. main.o defines _start and needs target; target.o defines target '
      + 'and needs nothing. Linking is matching one against the other, and every failure in '
      + 'this section is a mismatch in that table or a distance between two rows of it.');
  }

  function paintRelocations(view) {
    fill('lnk-relocs', view.job.linked.applied.map(function (row, at) {
      const entry = view.job.linked.layout.placed.length ? row : row;
      const kind = kindOf(view.job, at);

      return [row.at === undefined ? '-' : '0x' + row.at.toString(16), row.symbol,
        kind ? kind.name : '?', kind ? kind.spec.low + ' to ' + kind.spec.high : '?',
        row.offset === undefined ? 'unknown — the symbol is undefined' : String(row.offset),
        row.ok ? 'patched' : row.why];
    }));
    root.Helpers.setText('lnk-relocs-caption', relocationCaption(view));
  }

  function kindOf(job, index) {
    const entries = [];

    job.linked.layout.placed.forEach(function (row) {
      row.object.relocations.forEach(function (relocation) {
        entries.push(relocation);
      });
    });
    const entry = entries[index];

    return entry ? { name: entry.kind, spec: Linker.KINDS[entry.kind] } : null;
  }

  function relocationCaption(view) {
    const failed = view.job.linked.failed[0];

    if (!failed) {
      return 'Every hole was filled. The offset column is the distance the linker computed '
        + 'once placement gave both ends an address — a number that does not exist while the '
        + 'objects are separate, which is the whole reason this stage is a separate program.';
    }
    if (failed.offset === undefined) {
      return 'The symbol is defined nowhere, so there is no offset to compute. This is the '
        + 'failure everybody has seen, and the useful part of it is the name: a linker that '
        + 'said only "link failed" would make you find it yourself.';
    }
    return 'The offset needed is ' + failed.offset + ' bytes and the field reaches '
      + Linker.KINDS.branch.high + '. There is no correct encoding, so the linker refuses '
      + 'rather than keeping the low bits — which would produce a branch that decodes '
      + 'perfectly and goes somewhere else. The veneer scenario is how a real linker fixes '
      + 'this.';
  }

  function paintMap(view) {
    fill('lnk-map', Linker.mapOf(view.job.linked).map(function (row) {
      const owner = view.job.objects.filter(function (object) {
        return Object.prototype.hasOwnProperty.call(object.symbols, row.name);
      })[0];

      return [row.name, '0x' + row.address.toString(16), owner ? owner.name : 'unknown'];
    }));
    root.Helpers.setText('lnk-map-caption', 'The map is the artefact you want when something '
      + 'ended up at an address you did not expect, and every real linker will produce one on '
      + 'request. It is also the input to a symboliser: turning an address in a crash report '
      + 'back into a name is a lookup in exactly this table.');
  }

  function paintKinds(view) {
    fill('lnk-kinds', Object.keys(Linker.KINDS).map(function (name) {
      const kind = Linker.KINDS[name];

      return [name, kind.format + ' format', kind.low + ' to ' + kind.high,
        name === 'upper' ? 'nothing — it takes the whole upper half of a constant'
          : 'reported as out of range, with the offset it needed'];
    }));
    root.Helpers.setText('lnk-kinds-caption', 'Four shapes, and the range column is the one '
      + 'that produces surprises. A branch reaches about 4 KB and a jump about 1 MB, which is '
      + 'generous until a binary is bigger than that — and then every call across the gap '
      + 'needs a veneer, which is why large programs contain thousands of two-instruction '
      + 'functions nobody wrote.');
  }

  function paintPasses(view) {
    fill('lnk-passes', [
      ['first pass', 'measure every instruction and give every label an address',
        'encode anything that refers to a label — the addresses do not exist yet',
        'a forward branch would have no target, so no loop could be assembled'],
      ['second pass', 'encode, now that every label has an address',
        'resolve a name defined in another file', 'nothing — this is where the bytes come from'],
      ['relocation record', 'note the hole: address, shape and name',
        'fill it', 'separate compilation would be impossible; one file per program'],
      ['link', 'place the objects, build one symbol table, patch the holes',
        'know anything the objects did not record',
        'the shape of the hole would be guessed, and a guess decodes cleanly']
    ]);
    root.Helpers.setText('lnk-passes-caption', 'The second row is the whole argument for '
      + 'separate compilation: a file can be assembled knowing nothing about the others as '
      + 'long as it can write down what it does not know. The relocation table is that '
      + 'writing-down, and it is why a change to one file does not mean re-assembling the '
      + 'other thousand.');
  }

  function paintChart(app, view) {
    const host = root.jQuery('#lnk-chart')[0];

    if (!host) return;
    if (chart) chart.destroy();
    chart = root.ErrorBandView.bars(host, {
      lazyLib: app.lazyLib, height: 250, logY: true, yLabel: 'bytes of forward reach (log)',
      values: Object.keys(Linker.KINDS).map(function (name, index) {
        return { label: name, value: Linker.KINDS[name].high, series: index % 3 };
      })
    });
    root.Helpers.setText('lnk-chart-note', 'Forward reach per relocation shape, on a log axis '
      + 'because they differ by three orders of magnitude: a 12-bit immediate reaches 2 047 '
      + 'bytes, a branch 4 094, a jump 1 048 574, and the upper-immediate shape carries a '
      + 'whole 20-bit constant rather than a distance. The gap between the branch bar and the '
      + 'jump bar is the reason veneers exist.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
