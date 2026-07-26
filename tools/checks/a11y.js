/* checks/a11y.js — Roles, labels, roving focus and keyboard operation of the grid.
 *
 * Part of the inside-knowledge suite: these may use window.Sudoku, window.Drills
 * and friends to compute the right answer. Tests that must NOT do that — the ones
 * asking whether a person can actually get through — live in tests/naive-user.spec.js.
 *
 * Run everything with: node tools/drive.js tools/smoke.js /tmp
 */
'use strict';

module.exports = async function (page) {
  // --- accessibility ------------------------------------------------------
  await page.hash('#/lesson/x-wing');
  var a11y = await page.eval(
    '(function(){' +
    ' var g=document.querySelector(".board-grid");' +
    ' var cells=g.querySelectorAll(".cell");' +
    ' var roving=[].filter.call(cells,function(c){return c.getAttribute("tabindex")==="0";});' +
    ' var labeled=[].filter.call(cells,function(c){return (c.getAttribute("aria-label")||"").length>3;});' +
    ' return JSON.stringify({' +
    '  gridRole: g.getAttribute("role"),' +
    '  rows: g.querySelectorAll(\'[role="row"]\').length,' +
    '  gridcells: g.querySelectorAll(\'[role="gridcell"]\').length,' +
    '  rovingTabstops: roving.length,' +
    '  labeledCells: labeled.length,' +
    '  sampleLabel: cells[0].getAttribute("aria-label"),' +
    '  liveRegions: document.querySelectorAll(\'[aria-live],[role="status"]\').length,' +
    '  skipLink: !!document.querySelector(".skip-to-content")});})()');
  page.log('a11y: ' + a11y);
  var A = JSON.parse(a11y);
  if (A.gridRole !== 'grid') page.fail('board is not a grid role');
  if (A.rows !== 9) page.fail('expected 9 rows, got ' + A.rows);
  if (A.gridcells !== 81) page.fail('expected 81 gridcells, got ' + A.gridcells);
  if (A.rovingTabstops !== 1) page.fail('roving tabindex broken: ' + A.rovingTabstops + ' tabstops');
  if (A.labeledCells !== 81) page.fail('only ' + A.labeledCells + ' cells have labels');
  if (!A.liveRegions) page.fail('no live regions — narration changes are never announced');
  if (!A.skipLink) page.fail('no skip-to-content link');

  // keyboard: arrows move focus, a digit opens the what-if
  var kb = await page.eval(
    '(function(){' +
    ' var g=document.querySelector(".board-grid");' +
    ' var cells=g.querySelectorAll(".cell");' +
    ' cells[0].focus();' +
    ' function key(k){g.dispatchEvent(new KeyboardEvent("keydown",{key:k,bubbles:true}));}' +
    ' key("ArrowDown"); key("ArrowRight");' +
    ' var here=document.activeElement.dataset.cell;' +
    ' return "focus moved to cell "+here;})()');
  page.log('keyboard: ' + kb);
  if (kb.indexOf('cell 10') < 0) page.fail('arrow keys did not move focus to r2c2 (got ' + kb + ')');

  var whatIfByKey = await page.eval(
    '(function(){' +
    ' var g=document.querySelector(".board-grid");' +
    ' var cell=[].find.call(g.querySelectorAll(".cell"),function(c){' +
    '   return c.querySelector(".cand:not(.off)");});' +
    ' cell.focus();' +
    ' var d=cell.querySelector(".cand:not(.off)").dataset.digit;' +
    ' g.dispatchEvent(new KeyboardEvent("keydown",{key:d,bubbles:true}));' +
    ' var head=document.querySelector(".whatif-head");' +
    ' return head ? head.textContent : "NO PANEL";})()');
  page.log('keyboard what-if: ' + whatIfByKey);
  if (whatIfByKey.indexOf('What if') < 0) page.fail('digit key did not open the what-if panel');

  // --- pencil-mark contrast -----------------------------------------------
  // Marks are 8-14px, so WCAG AA wants 4.5:1. The original --ink-faint gave 3.03:1 on
  // white: the digits a learner spends most of their time reading were the least legible
  // thing on the page.
  function relLum(rgb) {
    var m = rgb.match(/\d+/g).map(Number).map(function (v) {
      var x = v / 255;
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2];
  }
  function contrast(a, b) {
    var l1 = relLum(a), l2 = relLum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }

  await page.hash('#/lesson/naked-triples');
  var probe = await page.eval(
    '(function(){var c=document.querySelector(".drill .cand:not(.off)");' +
    ' var cell=c.closest(".cell");' +
    ' var bg=getComputedStyle(cell).backgroundColor;' +
    ' if(!bg || bg==="rgba(0, 0, 0, 0)") bg=getComputedStyle(document.body).backgroundColor;' +
    ' return JSON.stringify({fg:getComputedStyle(c).color, bg:bg});})()');
  var C = JSON.parse(probe);
  var ratio = contrast(C.fg, C.bg);
  page.log('pencil-mark contrast (default): ' + ratio.toFixed(2) + ':1');
  if (ratio < 4.5) page.fail('pencil marks are ' + ratio.toFixed(2) + ':1, below the 4.5:1 AA floor');

  // and the toggle must go further, survive navigation, and not break the cell geometry
  await page.click('#marks-toggle');
  var bold = JSON.parse(await page.eval(
    '(function(){var c=document.querySelector(".drill .cand:not(.off)");' +
    ' var cell=c.closest(".cell").getBoundingClientRect();' +
    ' var cd=c.closest(".cands").getBoundingClientRect();' +
    ' var bg=getComputedStyle(c.closest(".cell")).backgroundColor;' +
    ' if(!bg || bg==="rgba(0, 0, 0, 0)") bg=getComputedStyle(document.body).backgroundColor;' +
    ' return JSON.stringify({fg:getComputedStyle(c).color, bg:bg,' +
    '   pressed:document.getElementById("marks-toggle").getAttribute("aria-pressed"),' +
    '   overflows: cd.height > cell.height + 0.5});})()'));
  var boldRatio = contrast(bold.fg, bold.bg);
  page.log('pencil-mark contrast (bolder):  ' + boldRatio.toFixed(2) + ':1');
  if (boldRatio <= ratio) page.fail('"Bolder marks" did not raise contrast');
  if (bold.pressed !== 'true') page.fail('toggle did not report its pressed state');
  if (bold.overflows) page.fail('bolder marks overflow the cell');

  await page.hash('#/lesson/x-wing');
  var stillOn = await page.eval('document.body.classList.contains("marks-bold")');
  if (!stillOn) page.fail('mark setting was lost on navigation');
  await page.click('#marks-toggle');   // leave it as we found it

  // --- the near-grid emphasis control -------------------------------------
  // Hold = temporary peek that must not touch the stored preference; click = keep.
  // Every button showing this state must agree, or the controls contradict each other.
  await page.hash('#/lesson/naked-triples');
  await page.eval('localStorage.removeItem("sudoku-teach-bold-marks")');
  await page.hash('#/lesson/naked-triples');

  var near = await page.count('.btn.emphasis');
  if (near < 1) page.fail('no emphasis control next to the grid');

  var read = '(function(){return JSON.stringify({' +
    ' bold: document.body.classList.contains("marks-bold"),' +
    ' pressed: [].map.call(document.querySelectorAll("#marks-toggle,.btn.emphasis"),' +
    '   function(b){return b.getAttribute("aria-pressed");}),' +
    ' stored: localStorage.getItem("sudoku-teach-bold-marks")});})()';

  await page.eval('(function(){document.querySelector(".drill .btn.emphasis")' +
    '.dispatchEvent(new PointerEvent("pointerdown",{bubbles:true}));})()');
  await page.eval('new Promise(function(r){setTimeout(r,350);})');
  var held = JSON.parse(await page.eval(read));
  if (!held.bold) page.fail('press-and-hold did not boost the marks');
  if (held.stored === '1') page.fail('a temporary peek wrote the stored preference');

  await page.eval('(function(){document.querySelector(".drill .btn.emphasis")' +
    '.dispatchEvent(new PointerEvent("pointerup",{bubbles:true}));})()');
  var released = JSON.parse(await page.eval(read));
  if (released.bold) page.fail('releasing the hold did not restore normal marks');

  await page.eval('(function(){var b=document.querySelector(".drill .btn.emphasis");' +
    ' b.dispatchEvent(new PointerEvent("pointerdown",{bubbles:true}));' +
    ' b.dispatchEvent(new PointerEvent("pointerup",{bubbles:true}));})()');
  var clicked = JSON.parse(await page.eval(read));
  if (!clicked.bold) page.fail('a quick click did not turn emphasis on');
  if (clicked.stored !== '1') page.fail('a click did not persist the preference');
  if (clicked.pressed.some(function (p) { return p !== 'true'; })) {
    page.fail('emphasis buttons disagree: ' + clicked.pressed.join(','));
  }
  page.log('emphasis: hold peeks without persisting, click persists, ' +
    clicked.pressed.length + ' buttons agree');

  await page.eval('localStorage.removeItem("sudoku-teach-bold-marks")');
};
