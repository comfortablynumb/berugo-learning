/** Home page: the curriculum map, rendered from the curriculum and progress. */
(function (root) {
  'use strict';

  const SECTION_ID = 'home';

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID) return;
      render(app);
    });

    app.state.subscribe('progress', function () {
      if (app.navigation.current() === SECTION_ID) render(app);
    });
  }

  function render(app) {
    const $host = root.jQuery('#' + SECTION_ID + '-content');
    $host.html(root.HomeView.markup({ curriculum: root.Curriculum, progress: app.progress }));
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
