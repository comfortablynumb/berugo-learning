/**
 * Application entry point.
 *
 * Instantiates the services, wires the chrome and starts navigation. It
 * contains no section logic and no per-section list: sections register
 * themselves at load, and this file only calls initAll().
 */
(function (root) {
  'use strict';

  function buildApp() {
    const state = root.StateManager;
    const storage = root.createStorage({});

    const app = {
      state: state,
      storage: storage,
      curriculum: root.Curriculum,
      shell: root.SectionShell,
      rendered: new Set()
    };

    app.progress = root.createProgress({
      storage: storage,
      emit: state.emit,
      labIdsFor: function (sectionId) {
        return (root.ExerciseRegistry.get(sectionId) || []).map(function (exercise) { return exercise.id; });
      }
    });

    app.theme = root.createThemeManager({ storage: storage, emit: state.emit });
    app.textScale = root.createTextScale({ storage: storage, emit: state.emit });
    app.search = root.createSearchIndex({ curriculum: root.Curriculum, registries: root });
    app.installer = root.createInstaller({});
    app.lazyLib = root.createLazyLib({});
    app.mermaid = root.createMermaidRenderer({ lazyLib: app.lazyLib });
    app.runner = root.createRunner({});

    /** True the first time a section is rendered - sections render once, then
     *  update in place. */
    app.markRendered = function (sectionId) {
      if (app.rendered.has(sectionId)) return false;
      app.rendered.add(sectionId);
      return true;
    };

    return app;
  }

  function wireChrome(app) {
    const $ = root.jQuery;
    const sidebar = root.SidebarView.mount({
      $host: $('#sidebar-nav'),
      curriculum: app.curriculum,
      progress: app.progress
    });

    app.state.subscribe('progress', function () { sidebar.refresh(); });
    app.state.subscribe('navigation', function () { sidebar.refresh(); });
    app.state.subscribe('theme', function () { app.mermaid.refreshAll(); });

    $('#theme-toggle').on('click', function () { app.theme.toggle(); });

    $('#sidebar-toggle').on('click', function () {
      $('.sidebar').toggleClass('open');
      $('.sidebar-overlay').toggleClass('active');
    });

    $('.sidebar-overlay').on('click', function () {
      $('.sidebar').removeClass('open');
      $('.sidebar-overlay').removeClass('active');
    });

    wireSearch(app, $);
    wireTextScale(app, $);
    wireInstall(app, $);

    return sidebar;
  }

  /** The header search: results from the whole corpus, opened by navigation. */
  function wireSearch(app, $) {
    root.SearchView.mount({
      $input: $('#global-search'),
      $results: $('#search-results'),
      index: app.search,
      onOpen: function (result) {
        app.navigation.go(result.sectionId);
        $('.sidebar').removeClass('open');
        $('.sidebar-overlay').removeClass('active');
      }
    });
  }

  function wireTextScale(app, $) {
    const $value = $('#text-scale-value');

    function paint() {
      $value.text(app.textScale.percent() + '%');
      $('#text-smaller').prop('disabled', app.textScale.atMinimum());
      $('#text-larger').prop('disabled', app.textScale.atMaximum());
    }

    $('#text-smaller').on('click', function () { app.textScale.decrease(); paint(); });
    $('#text-larger').on('click', function () { app.textScale.increase(); paint(); });
    $value.on('click', function () { app.textScale.reset(); paint(); });
    paint();
  }

  function wireInstall(app, $) {
    const $button = $('#install-app');

    app.installer = root.createInstaller({
      onAvailable: function (available) {
        if (available) $button.removeAttr('hidden'); else $button.attr('hidden', 'hidden');
      }
    });

    $button.on('click', function () { app.installer.prompt(); });
    app.installer.init();
  }

  function start() {
    const app = buildApp();
    root.BerugoApp = app;

    app.theme.init();
    app.textScale.init();

    const failures = root.SectionRegistry.initAll(app);
    failures.forEach(function (failure) {
      console.error('section failed to init:', failure.id, failure.error);
    });

    app.navigation = root.createNavigation({
      curriculum: app.curriculum,
      state: app.state,
      onActivate: function (section) {
        if (section && section.kind === 'section') app.progress.markVisited(section.id);
      }
    });

    wireChrome(app);
    app.navigation.init();

    return app;
  }

  root.jQuery(function () { start(); });

  root.BerugoStart = start;
}(window));
