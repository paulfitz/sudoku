/* checks/drills.js — Drill mechanics: both answer phases, feedback, hints, and input modes.
 *
 * Part of the inside-knowledge suite: these may use window.Sudoku, window.Drills
 * and friends to compute the right answer. Tests that must NOT do that — the ones
 * asking whether a person can actually get through — live in tests/naive-user.spec.js.
 *
 * Run everything with: node tools/drive.js tools/smoke.js /tmp
 */
'use strict';

module.exports = async function (page) {
  // --- the drill, answered correctly -------------------------------------
  await page.hash('#/lesson/xy-wing');
  var picked = await page.eval(
    '(function(){' +
    ' var d = window.Drills.makeDrill("xy-wing", 1);' +
    ' if(!d) return "no drill";' +
    ' var cells = d.primary.cells;' +
    ' var grid = document.querySelectorAll(".drill .board-grid")[0];' +
    ' if(!grid) return "no drill grid";' +
    ' cells.forEach(function(c){ grid.querySelector(\'.cell[data-cell="\'+c+\'"]\').click(); });' +
    ' return cells.length;})()');
  page.log('drill: selected ' + picked + ' cells');
  await page.clickText('.drill .btn', 'Check');
  var fb = await page.text('.drill .prompt');   // success is stated in the prompt now
  if (!fb || fb.indexOf('That is the pattern') < 0) page.fail('drill: correct pattern not accepted — "' + fb + '"');
  else page.log('drill: pattern accepted');

  var elims = await page.eval(
    '(function(){' +
    ' var d = window.Drills.makeDrill("xy-wing", 1);' +
    ' var grid = document.querySelectorAll(".drill .board-grid")[0];' +
    ' window.Drills.consequences(d.primary).kills.forEach(function(e){' +
    '   grid.querySelector(\'.cand[data-cell="\'+e.cell+\'"][data-digit="\'+e.digit+\'"]\').click();});' +
    ' return window.Drills.consequences(d.primary).kills.length;})()');
  page.log('drill: marked ' + elims + ' eliminations');
  await page.clickText('.drill .btn', 'Check');
  var fb2 = await page.text('.drill .feedback');
  if (!fb2 || fb2.indexOf('Correct') < 0) page.fail('drill: correct eliminations not accepted — "' + fb2 + '"');
  else page.log('drill: completed end to end');
  await page.shot('drill-solved');

  // Regression: singles conclude with a placement, not an elimination. Asking the learner
  // to "click what dies" and then checking against the digit that lives taught the
  // opposite of the lesson.
  for (const single of ['naked-single', 'hidden-single']) {
    await page.hash('#/lesson/' + single);
    var q = await page.text('.drill .prompt');
    if (/eliminat|kill|have to go/i.test(q)) {
      page.fail(single + ': drill asks for eliminations, but the finding only places a digit');
    }
    await page.eval(
      '(function(){var d=window.Drills.makeDrill("' + single + '",1);' +
      ' var g=document.querySelectorAll(".drill .board-grid")[0];' +
      ' d.primary.cells.forEach(function(c){g.querySelector(\'.cell[data-cell="\'+c+\'"]\').click();});})()');
    await page.clickText('.drill .btn', 'Check');
    var p2 = await page.text('.drill .prompt');
    page.log(single + ' phase 2 asks: "' + String(p2).replace(/\s+/g, ' ').trim() + '"');
    if (!/which digit goes in/i.test(p2)) page.fail(single + ': phase-2 wording still wrong');
    // answer with the placed digit via the digit pad, then the cell
    var ok = await page.eval(
      '(function(){var d=window.Drills.makeDrill("' + single + '",1);' +
      ' var pl=window.Drills.consequences(d.primary).places[0];' +
      ' var pads=[].slice.call(document.querySelectorAll(".drill .digit-pad .btn.digit"));' +
      ' var b=pads.filter(function(x){return x.textContent==String(pl.digit);})[0];' +
      ' if(!b) return "no pad button"; b.click();' +
      ' document.querySelectorAll(".drill .board-grid")[0]' +
      '   .querySelector(\'.cell[data-cell="\'+pl.cell+\'"]\').click();' +
      ' return "picked "+pl.digit+" into r"+((pl.cell/9|0)+1)+"c"+(pl.cell%9+1);})()');
    page.log('  digit-first entry: ' + ok);
    await page.clickText('.drill .btn', 'Check');
    var res = await page.text('.drill .feedback');
    if (!res || res.indexOf('Correct') < 0) page.fail(single + ': placement answer rejected — "' + res + '"');
    else page.log('  ' + single + ' drill completes via the digit pad');
  }

  // "Show me" must teach, not just reveal
  await page.hash('#/lesson/skyscraper');
  await page.clickText('.drill .btn', 'Show me');
  var revealSteps = await page.count('.drill .dot');
  var revealText = await page.text('.drill .step-text');
  if (revealSteps < 2) page.fail('Show me: no stepped walkthrough (' + revealSteps + ' steps)');
  else page.log('Show me: ' + revealSteps + '-step walkthrough — "' +
    String(revealText).replace(/\s+/g, ' ').trim().slice(0, 70) + '"');

  var navDone = await page.count('.nav-link.done');
  if (!navDone) page.fail('progress: lesson not marked done in the sidebar');

  // --- hint and wrong answers give specific feedback ----------------------
  await page.hash('#/lesson/skyscraper');
  await page.eval('document.querySelectorAll(".drill .cell")[0].click();' +
                  'document.querySelectorAll(".drill .cell")[40].click();');
  await page.clickText('.drill .btn', 'Check');
  var wrong = await page.text('.drill .feedback');
  if (!wrong || wrong.length < 15) page.fail('drill: no feedback on a wrong answer');
  else page.log('wrong-answer feedback: ' + wrong.replace(/\s+/g, ' ').trim().slice(0, 90));
  await page.clickText('.drill .btn', 'Hint');
  var hint = await page.text('.drill .feedback');
  if (!hint || hint.length < 5) page.fail('drill: hint produced no text');
  else page.log('hint: ' + hint.trim());

  // --- the armed digit must win over whatever slot the tap landed on ------
  // The candidate grid covers the whole cell, so tapping "a cell" always lands on some
  // mark's slot. With a digit armed, the middle of a cell used to strike a live 5.
  await page.hash('#/lesson/pointing');
  await page.eval(
    '(function(){var d=window.Drills.makeDrill("pointing",1);' +
    ' var g=document.querySelectorAll(".drill .board-grid")[0];' +
    ' d.primary.cells.forEach(function(c){g.querySelector(\'.cell[data-cell="\'+c+\'"]\').click();});})()');
  await page.clickText('.drill .btn', 'Check');
  var collide = await page.eval(
    '(function(){' +
    ' var d=window.Drills.makeDrill("pointing",1);' +
    ' var cons=window.Drills.consequences(d.primary);' +
    ' for (var i=0;i<cons.kills.length;i++){' +
    '   var k=cons.kills[i];' +
    '   var cell=document.querySelector(\'.drill .cell[data-cell="\'+k.cell+\'"]\');' +
    '   var others=[].filter.call(cell.querySelectorAll(".cand:not(.off)"),function(c){' +
    '     return +c.dataset.digit !== k.digit; });' +
    '   if (others.length) return JSON.stringify({cell:k.cell, want:k.digit, decoy:+others[0].dataset.digit});' +
    ' } return null;})()');
  if (collide) {
    var C = JSON.parse(collide);
    await page.clickText('.drill .digit-pad .btn.digit', String(C.want));
    await page.eval('document.querySelector(\'.drill .cell[data-cell="' + C.cell +
      '"] .cand[data-digit="' + C.decoy + '"]\').click()');
    var marked = await page.eval(
      '[].map.call(document.querySelectorAll(".drill .cand.mark-elim"),' +
      'function(e){return e.dataset.cell+":"+e.dataset.digit;}).join(",")');
    page.log('armed-digit collision: tapped the ' + C.decoy + " slot with " + C.want +
      ' armed -> ' + (marked || 'nothing'));
    if (marked.indexOf(C.cell + ':' + C.want) < 0) page.fail('armed digit was ignored on a cell tap');
    if (marked.indexOf(C.cell + ':' + C.decoy) >= 0) page.fail('the tapped slot won over the armed digit');
  } else {
    page.log('armed-digit collision: no suitable cell in this grid, skipped');
  }
};
