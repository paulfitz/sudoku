/* smoke.js — the inside-knowledge browser suite.
 *
 * Split into tools/checks/*.js; this just runs them in order against one page. Each
 * module exports an async function (page). These tests may reach into window.Drills and
 * friends to work out the right answer, which makes them good at invariants and blind to
 * whether a human could get through — that is what tests/naive-user.spec.js is for.
 *
 *   node tools/drive.js tools/smoke.js /tmp
 */
'use strict';

var CHECKS = ['walkthroughs', 'whatif', 'drills', 'hints', 'widgets', 'pages', 'a11y'];

module.exports = async function (page) {
  for (var i = 0; i < CHECKS.length; i++) {
    var name = CHECKS[i];
    page.log('');
    page.log('== ' + name + ' ' + new Array(Math.max(2, 40 - name.length)).join('='));
    await require('./checks/' + name)(page);
  }
};
