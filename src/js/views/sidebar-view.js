/**
 * SidebarView - navigation rendered from the curriculum.
 *
 * There is no hand-written nav markup anywhere in the project, so the sidebar
 * cannot disagree with the syllabus: deleting a section from curriculum.js
 * removes it from the sidebar, the home map, the search index and the
 * prev/next links at once.
 *
 * The nav lists top-level tracks and nothing else until something is opened.
 * With 634 sections planned a flat list stops being navigable long before the
 * curriculum is finished, so a track opens to its milestones, a milestone
 * opens to its sections, and the pair holding the current section opens
 * itself. Search bypasses all of it and returns a flat list, because a search
 * result has no useful parent.
 *
 * Tracks that are planned and not built appear too, with their milestones
 * listed and marked. Hiding them would make the sidebar a description of what
 * happens to be finished rather than of what the platform teaches - and the
 * plan is the more useful of the two while the build is in progress.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SidebarView = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  function helpers() {
    if (scope && scope.Helpers) return scope.Helpers;
    return require('../utils/helpers.js');
  }

  function esc(value) {
    return helpers().escapeHtml(value);
  }

  function isOpen(open, id) {
    return open.indexOf(id) !== -1;
  }

  function item(section, status) {
    return '<a class="sidebar-item" href="#' + section.id + '" data-nav="' + section.id + '" ' +
      'title="' + esc(section.summary || section.title) + '">' +
      '<span class="status-dot ' + status + '"></span>' +
      '<span>' + esc(section.title) + '</span></a>';
  }

  function group(groupNode, progress, open) {
    const sections = groupNode.sections.map(function (section) {
      return item(section, progress.statusOf(section.id));
    }).join('');
    const shown = isOpen(open, groupNode.id);

    return '<div class="sidebar-milestone' + (shown ? ' open' : '') + '" data-group="' + groupNode.id + '">' +
      '<button type="button" class="sidebar-milestone-toggle" data-group-toggle="' + groupNode.id + '" ' +
      'aria-expanded="' + (shown ? 'true' : 'false') + '">' +
      '<span class="sidebar-caret" aria-hidden="true"></span>' +
      '<span class="sidebar-milestone-title">' + esc(groupNode.id + ' · ' + groupNode.title) + '</span>' +
      '<span class="sidebar-count">' + groupNode.sections.length + '</span>' +
      '</button>' +
      '<div class="sidebar-milestone-body"' + (shown ? '' : ' hidden') + '>' + sections + '</div></div>';
  }

  function countSections(trackNode) {
    return trackNode.groups.reduce(function (total, groupNode) {
      return total + groupNode.sections.length;
    }, 0);
  }

  function countPlanned(trackNode) {
    return (trackNode.planned || []).reduce(function (total, milestone) {
      return total + milestone.sections;
    }, 0);
  }

  /** A milestone with no sections yet: listed, labelled, and not a link. */
  function plannedMilestone(milestone) {
    return '<div class="sidebar-milestone planned" data-group="' + milestone.id + '">' +
      '<div class="sidebar-milestone-toggle" aria-disabled="true">' +
      '<span class="sidebar-caret placeholder" aria-hidden="true"></span>' +
      '<span class="sidebar-milestone-title">' + esc(milestone.id + ' · ' + milestone.title) + '</span>' +
      '<span class="sidebar-count">' + milestone.sections + '</span>' +
      '</div></div>';
  }

  function trackBadge(trackNode) {
    const built = countSections(trackNode);
    if (built) return '<span class="sidebar-count">' + built + '</span>';
    return '<span class="sidebar-count planned">' + countPlanned(trackNode) + '</span>';
  }

  function track(trackNode, progress, open) {
    const shown = isOpen(open, trackNode.id);
    const built = trackNode.groups.map(function (groupNode) {
      return group(groupNode, progress, open);
    }).join('');
    const planned = (trackNode.planned || []).map(plannedMilestone).join('');
    const empty = !countSections(trackNode);

    return '<div class="sidebar-track' + (shown ? ' open' : '') + (empty ? ' planned' : '') +
      '" data-track="' + trackNode.id + '">' +
      '<button type="button" class="sidebar-track-toggle" data-track-toggle="' + trackNode.id + '" ' +
      'aria-expanded="' + (shown ? 'true' : 'false') + '">' +
      '<span class="sidebar-caret" aria-hidden="true"></span>' +
      '<span class="sidebar-track-title">' + esc(trackNode.title) + '</span>' +
      trackBadge(trackNode) +
      '</button>' +
      '<div class="sidebar-track-body"' + (shown ? '' : ' hidden') + '>' + built + planned + '</div></div>';
  }

  /** The track and milestone a section sits in, so both can open themselves. */
  function pathOf(curriculum, sectionId) {
    let found = null;
    curriculum.tracks().forEach(function (trackNode) {
      trackNode.groups.forEach(function (groupNode) {
        groupNode.sections.forEach(function (section) {
          if (section.id === sectionId) found = { track: trackNode.id, group: groupNode.id };
        });
      });
    });
    return found;
  }

  function markup(curriculum, progress, openIds) {
    const open = openIds || [];
    return curriculum.tracks().map(function (trackNode) {
      return track(trackNode, progress, open);
    }).join('');
  }

  function resultsMarkup(matches) {
    if (!matches.length) return '<div class="sidebar-note">no matches</div>';
    return matches.map(function (section) {
      return '<a class="sidebar-item" href="#' + section.id + '" data-nav="' + section.id + '">' +
        '<span class="status-dot"></span><span>' + esc(section.title) + '</span></a>';
    }).join('');
  }

  /**
   * One track and one milestone open at a time.
   *
   * Additive expansion looks friendlier and is not: browsing twenty sections
   * opens twenty groups and the sidebar is a flat list again by lunchtime. An
   * accordion keeps it the same height forever, which is the only property
   * that survives 634 sections.
   */
  function mount(options) {
    const $ = scope.jQuery;
    const $host = options.$host;
    const curriculum = options.curriculum;
    const progress = options.progress;
    const state = { track: null, group: null, revealedFor: null };

    function revealOnce(sectionId) {
      if (!sectionId || sectionId === state.revealedFor) return;
      state.revealedFor = sectionId;
      const path = pathOf(curriculum, sectionId);
      if (!path) return;
      state.track = path.track;
      state.group = path.group;
    }

    function refresh() {
      const active = scope.BerugoApp && scope.BerugoApp.navigation
        ? scope.BerugoApp.navigation.current() : null;
      revealOnce(active);
      $host.html(markup(curriculum, progress, [state.track, state.group]));
      if (active) $host.find('[data-nav="' + active + '"]').addClass('active');
    }

    function openTrack(id) {
      const closing = state.track === id;
      state.track = closing ? null : id;
      if (closing || !groupBelongs(curriculum, state.group, id)) state.group = null;
      refresh();
    }

    function openGroup(id) {
      state.group = state.group === id ? null : id;
      refresh();
    }

    $host.on('click', '[data-track-toggle]', function () {
      openTrack(String($(this).attr('data-track-toggle')));
    });
    $host.on('click', '[data-group-toggle]', function () {
      openGroup(String($(this).attr('data-group-toggle')));
    });

    refresh();
    return {
      refresh: refresh,
      openIds: function () { return [state.track, state.group].filter(Boolean); }
    };
  }

  function groupBelongs(curriculum, groupId, trackId) {
    if (!groupId) return false;
    return curriculum.tracks().some(function (trackNode) {
      return trackNode.id === trackId && trackNode.groups.some(function (groupNode) {
        return groupNode.id === groupId;
      });
    });
  }

  return { markup: markup, mount: mount, pathOf: pathOf, resultsMarkup: resultsMarkup };
}));
