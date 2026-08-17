/**
 * Search index - one searchable corpus over everything the platform teaches.
 *
 * The sidebar search matched section titles and tags, which finds a section
 * you already know the name of. This indexes the content as well: every
 * concept, worked example, reference entry and exercise, each carrying the
 * section it belongs to, so "tombstone", "Little's law" or "round half to
 * even" lands on the section that explains it rather than on nothing.
 *
 * The index is built once, lazily, from the same registries the sections
 * render from - so it cannot list something the curriculum does not have, and
 * cannot miss something it does.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.createSearchIndex = api.createSearchIndex;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const KIND_WEIGHT = { section: 6, concept: 4, reference: 3, example: 2, exercise: 2 };

  function text(value) {
    return String(value === undefined || value === null ? '' : value);
  }

  function entry(section, kind, label, detail) {
    return {
      sectionId: section.id,
      sectionTitle: section.title,
      trackTitle: section.trackTitle,
      kind: kind,
      label: label,
      detail: text(detail),
      haystack: (label + ' ' + text(detail)).toLowerCase()
    };
  }

  /** A concept's detail is one paragraph or several; search reads all of it. */
  function joined(value) {
    return Array.isArray(value) ? value.map(text).join(' ') : text(value);
  }

  function conceptEntries(section, concepts) {
    return (concepts || []).map(function (concept) {
      return entry(section, 'concept', concept.term,
        text(concept.plain) + ' ' + text(concept.formal) + ' ' +
        joined(concept.detail) + ' ' + text(concept.example));
    });
  }

  function exampleEntries(section, examples) {
    return (examples || []).map(function (example) {
      const steps = (example.steps || []).map(function (step) {
        return text(step.do) + ' ' + text(step.work) + ' ' + text(step.result);
      }).join(' ');
      return entry(section, 'example', example.title,
        text(example.goal) + ' ' + text(example.setup) + ' ' + steps + ' ' + text(example.answer));
    });
  }

  function referenceEntries(section, reference) {
    if (!reference) return [];
    const invariants = (reference.invariants || []).map(function (item) { return text(item.name); }).join(' ');
    const failures = (reference.failureModes || []).map(function (mode) {
      return text(mode.symptom) + ' ' + text(mode.cause) + ' ' + text(mode.fix);
    }).join(' ');
    const wild = (reference.inTheWild || []).map(function (item) {
      return text(item.system) + ' ' + text(item.how);
    }).join(' ');

    return [entry(section, 'reference', 'Reference: ' + section.title,
      text(reference.summary) + ' ' + text(reference.intuition) + ' ' + invariants + ' ' +
      failures + ' ' + wild)];
  }

  function exerciseEntries(section, exercises) {
    return (exercises || []).map(function (exercise) {
      return entry(section, 'exercise', exercise.title, text(exercise.prompt));
    });
  }

  function sectionEntries(section, registries) {
    const base = [entry(section, 'section', section.title,
      text(section.summary) + ' ' + (section.tags || []).join(' ') + ' ' +
      text(section.groupTitle) + ' ' + text(section.trackTitle))];

    if (section.kind !== 'section') return base;

    return base
      .concat(conceptEntries(section, registries.ConceptRegistry.get(section.id)))
      .concat(exampleEntries(section, registries.ExampleRegistry.get(section.id)))
      .concat(referenceEntries(section, registries.ReferenceRegistry.get(section.id)))
      .concat(exerciseEntries(section, registries.ExerciseRegistry.get(section.id)));
  }

  /** Earlier hits and shorter labels rank higher; the kind breaks the tie. */
  function score(item, needle) {
    const at = item.haystack.indexOf(needle);
    if (at === -1) return 0;

    const labelAt = item.label.toLowerCase().indexOf(needle);
    const inLabel = labelAt === -1 ? 0 : 40 - Math.min(30, labelAt);
    const exact = item.label.toLowerCase() === needle ? 60 : 0;
    return (KIND_WEIGHT[item.kind] || 1) + inLabel + exact + Math.max(0, 20 - at / 20);
  }

  /** The words around the first hit, so a result shows why it matched. */
  function snippet(item, needle, width) {
    const size = width || 120;
    const source = item.detail || item.label;
    const at = source.toLowerCase().indexOf(needle);
    if (at === -1) return source.slice(0, size);

    const start = Math.max(0, at - Math.floor(size / 3));
    const clip = source.slice(start, start + size).trim();
    return (start > 0 ? '…' : '') + clip + (start + size < source.length ? '…' : '');
  }

  function createSearchIndex(options) {
    const settings = options || {};
    const curriculum = settings.curriculum;
    const registries = settings.registries;
    let entries = null;

    function build() {
      if (entries) return entries;
      entries = curriculum.sections().reduce(function (all, section) {
        return all.concat(sectionEntries(section, registries));
      }, []);
      return entries;
    }

    function search(query, limit) {
      const needle = String(query || '').trim().toLowerCase();
      if (needle.length < 2) return [];

      const hits = build().map(function (item) {
        return { item: item, score: score(item, needle) };
      }).filter(function (hit) { return hit.score > 0; });

      hits.sort(function (a, b) { return b.score - a.score; });

      return hits.slice(0, limit || 12).map(function (hit) {
        return {
          sectionId: hit.item.sectionId,
          sectionTitle: hit.item.sectionTitle,
          trackTitle: hit.item.trackTitle,
          kind: hit.item.kind,
          label: hit.item.label,
          snippet: snippet(hit.item, needle),
          score: hit.score
        };
      });
    }

    return {
      search: search,
      size: function () { return build().length; },
      rebuild: function () { entries = null; return build().length; }
    };
  }

  return { createSearchIndex: createSearchIndex };
}));
