/**
 * Curriculum - the single ordered definition of what this platform teaches.
 *
 * The sidebar, the header title, the home map, the search index and the
 * previous/next links are all rendered from this file. There is no
 * hand-written navigation anywhere, so the two cannot drift apart.
 *
 * Shape: tracks -> groups (one per milestone) -> sections.
 *   kind: 'page'    chrome (home, settings) - no lab, not counted as teaching
 *   kind: 'section' a teaching section - carries demo, lab, concepts, reference
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Curriculum = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  /*
   * Tracks are the top level of the syllabus and of the sidebar. A track that
   * is not built yet still appears, with its milestones listed as `planned`:
   * a plan is part of what this platform teaches, and a category that appears
   * only once it is finished is a map with holes in it.
   *
   * `planned` entries carry no sections, so sections(), the wiring audit, the
   * search index and prev/next never see them.
   *
   * The track *data* lives in `curriculum-algorithms.js`,
   * `curriculum-data-structures.js` and `curriculum-other-tracks.js`, because
   * the syllabus passed a thousand lines at M12 and will keep growing. This
   * file is still the single source of truth - it is the only place the tracks
   * are ordered, and everything else reads the syllabus through the API below.
   */

  /* The order the sidebar and the home map present, and the order prev/next
     walks. Declared here rather than implied by which file loaded first,
     because "the order depends on the script tags" is exactly the kind of
     coupling this file exists to remove. */
  const TRACK_ORDER = ['using-this-site', 'algorithms', 'data-structures', 'architecture',
    'operating-systems', 'automata-and-compilers', 'networking', 'data-systems',
    'distributed-systems', 'engineering-practice', 'practice-and-mastery'];

  function loadTracks() {
    if (typeof module !== 'undefined' && module.exports) {
      return [].concat(require('./curriculum-other-tracks.js'),
        require('./curriculum-algorithms.js'), require('./curriculum-data-structures.js'));
    }
    return [].concat(scope.CurriculumOtherTracks, scope.CurriculumAlgorithms,
      scope.CurriculumDataStructures);
  }

  /** Assembled in `TRACK_ORDER`; a track present in the data but missing from
   *  the order is a wiring mistake rather than something to sort around. */
  function orderTracks(loaded) {
    const byId = {};

    loaded.forEach(function (track) { byId[track.id] = track; });
    const ordered = TRACK_ORDER.map(function (id) { return byId[id]; }).filter(Boolean);

    if (ordered.length === loaded.length) return ordered;
    throw new Error('curriculum: TRACK_ORDER lists ' + ordered.length + ' of ' +
      loaded.length + ' loaded tracks');
  }

  const TRACKS = orderTracks(loadTracks());

  let flatCache = null;
  let indexCache = null;

  function sections() {
    if (flatCache) return flatCache;

    flatCache = [];
    TRACKS.forEach(function (track) {
      track.groups.forEach(function (group) {
        group.sections.forEach(function (section) {
          flatCache.push(Object.assign({}, section, {
            kind: section.kind || 'section',
            tags: section.tags || [],
            trackId: track.id,
            trackTitle: track.title,
            groupId: group.id,
            groupTitle: group.title
          }));
        });
      });
    });

    return flatCache;
  }

  function index() {
    if (indexCache) return indexCache;

    indexCache = {};
    sections().forEach(function (section, position) {
      indexCache[section.id] = { section: section, position: position };
    });

    return indexCache;
  }

  function byId(id) {
    const entry = index()[id];
    return entry ? entry.section : null;
  }

  function positionOf(id) {
    const entry = index()[id];
    return entry ? entry.position : -1;
  }

  function neighbour(id, offset) {
    const position = positionOf(id);
    if (position < 0) return null;
    return sections()[position + offset] || null;
  }

  /** Sections a track has today; `plannedCount` is what it will have. */
  function builtCount(track) {
    return track.groups.reduce(function (total, group) {
      return total + group.sections.length;
    }, 0);
  }

  function plannedCount(track) {
    return (track.planned || []).reduce(function (total, milestone) {
      return total + milestone.sections;
    }, 0);
  }

  function teachingSections() {
    return sections().filter(function (section) { return section.kind === 'section'; });
  }

  function search(query) {
    const needle = String(query || '').trim().toLowerCase();
    if (!needle) return [];

    return sections().filter(function (section) {
      const haystack = [section.title, section.summary || '', section.groupTitle, section.trackTitle]
        .concat(section.tags)
        .join(' ')
        .toLowerCase();
      return haystack.indexOf(needle) !== -1;
    });
  }

  return {
    tracks: function () { return TRACKS; },
    builtCount: builtCount,
    plannedCount: plannedCount,
    sections: sections,
    teachingSections: teachingSections,
    byId: byId,
    has: function (id) { return Boolean(byId(id)); },
    positionOf: positionOf,
    next: function (id) { return neighbour(id, 1); },
    prev: function (id) { return neighbour(id, -1); },
    firstId: function () { return sections()[0].id; },
    search: search
  };
}));
