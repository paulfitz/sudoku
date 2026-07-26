/* checks/walkthroughs.js — Every lesson renders, and every frame of every walkthrough produces narration.
 *
 * Part of the inside-knowledge suite: these may use window.Sudoku, window.Drills
 * and friends to compute the right answer. Tests that must NOT do that — the ones
 * asking whether a person can actually get through — live in tests/naive-user.spec.js.
 *
 * Run everything with: node tools/drive.js tools/smoke.js /tmp
 */
'use strict';

module.exports = async function (page) {
  await page.goto('#/');
  var lessonIds = await page.eval('window.Lessons.LESSONS.map(function(l){return l.id;})');
  page.log(lessonIds.length + ' lessons');

  // --- every lesson, every step ------------------------------------------
  for (var i = 0; i < lessonIds.length; i++) {
    var id = lessonIds[i];
    await page.hash('#/lesson/' + id);
    var title = await page.text('h1');
    if (!title) page.fail(id + ': no title rendered');

    // the frontier page is deliberately prose-only; everything else shows a grid
    var hasStage = await page.count('.board-grid');
    if (!hasStage && id !== 'frontier') page.fail(id + ': no board rendered');

    var dots = await page.count('.dot');
    for (var s = 1; s < dots; s++) {
      await page.click('.narrative .step-nav .btn:not(.ghost)');
      var txt = await page.text('.step-text');
      if (!txt || txt.length < 20) page.fail(id + ' step ' + s + ': empty narration');
      if (/undefined|NaN/.test(txt)) page.fail(id + ' step ' + s + ': "' + txt.slice(0, 80) + '"');
    }
    if (dots) page.log(id + ': ' + dots + ' steps ok');
    else page.log(id + ': custom page ok');
  }
};
