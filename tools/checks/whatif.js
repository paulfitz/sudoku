/* checks/whatif.js — The what-if engine: assert a candidate, watch the consequences, come back.
 *
 * Part of the inside-knowledge suite: these may use window.Sudoku, window.Drills
 * and friends to compute the right answer. Tests that must NOT do that — the ones
 * asking whether a person can actually get through — live in tests/naive-user.spec.js.
 *
 * Run everything with: node tools/drive.js tools/smoke.js /tmp
 */
'use strict';

module.exports = async function (page) {
  // --- the what-if engine -------------------------------------------------
  await page.hash('#/lesson/x-wing');
  var cand = await page.eval(
    '(function(){var c=document.querySelector(".board-grid .cand:not(.off)");' +
    'if(!c) return null; c.click(); return c.dataset.cell+":"+c.dataset.digit;})()');
  if (!cand) page.fail('what-if: found no clickable candidate');
  await page.eval('void 0');
  var wi = await page.text('.whatif-head');
  if (!wi || wi.indexOf('What if') < 0) page.fail('what-if: panel did not open (got ' + wi + ')');
  else page.log('what-if opened: ' + wi.trim());

  await page.clickText('.whatif .btn', 'Run it out');
  var verdict = await page.text('.whatif .step-text');
  if (!verdict || verdict.length < 20) page.fail('what-if: no outcome text');
  else page.log('what-if outcome: ' + verdict.replace(/\s+/g, ' ').trim().slice(-90));
  await page.shot('whatif');

  await page.clickText('.whatif .btn', 'Back to the lesson');
  var back = await page.count('.whatif-head');
  if (back) page.fail('what-if: did not return to lesson');
};
