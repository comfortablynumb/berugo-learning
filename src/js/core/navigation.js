/**
 * Navigation - hash routing and lazy section activation.
 *
 * Exactly one event leaves this module: `navigation`. A section renders its
 * template on first activation and binds afterwards, so a section that is
 * never opened costs nothing but its script parse.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.createNavigation = api.createNavigation;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function createNavigation(options) {
    const settings = options || {};
    const curriculum = settings.curriculum;
    const state = settings.state;
    const documentRef = settings.document || (typeof document !== 'undefined' ? document : null);
    const windowRef = settings.window || (typeof window !== 'undefined' ? window : null);
    const onActivate = settings.onActivate || function () {};

    let current = null;

    function sectionElement(id) {
      return documentRef.querySelector('[data-section="' + id + '"]');
    }

    function resolveHash() {
      const raw = (windowRef.location.hash || '').replace(/^#/, '');
      return curriculum.has(raw) ? raw : curriculum.firstId();
    }

    function show(id) {
      if (current === id) return current;

      const target = sectionElement(id);
      if (!target) return current;

      Array.prototype.forEach.call(documentRef.querySelectorAll('[data-section]'), function (node) {
        const active = node === target;
        node.hidden = !active;
        node.classList.toggle('active', active);
      });

      Array.prototype.forEach.call(documentRef.querySelectorAll('[data-nav]'), function (node) {
        node.classList.toggle('active', node.getAttribute('data-nav') === id);
      });

      current = id;
      state.set('currentSection', id);
      updateHeader(id);
      onActivate(curriculum.byId(id));
      state.emit('navigation', { section: id });
      return current;
    }

    function updateHeader(id) {
      const entry = curriculum.byId(id);
      if (!entry) return;
      const title = documentRef.getElementById('header-title');
      const crumb = documentRef.getElementById('header-crumb');
      if (title) title.textContent = entry.title;
      if (crumb) crumb.textContent = entry.trackTitle + ' · ' + entry.groupId;
      documentRef.title = entry.title + ' — Berugo Learning';
    }

    function go(id) {
      if (!curriculum.has(id)) return;
      if (windowRef.location.hash === '#' + id) {
        show(id);
        return;
      }
      windowRef.location.hash = id;
    }

    function step(offset) {
      const neighbour = offset > 0 ? curriculum.next(current) : curriculum.prev(current);
      if (neighbour) go(neighbour.id);
      return neighbour;
    }

    function init() {
      windowRef.addEventListener('hashchange', function () { show(resolveHash()); });
      show(resolveHash());
      return current;
    }

    return {
      init: init,
      go: go,
      next: function () { return step(1); },
      prev: function () { return step(-1); },
      current: function () { return current; }
    };
  }

  return { createNavigation: createNavigation };
}));
