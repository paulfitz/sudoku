/* checks/glossary.js — the term markers, their panels, and the density rules.
 *
 * Part of the inside-knowledge suite: these may use window.Sudoku, window.Drills
 * and friends to compute the right answer. Tests that must NOT do that — the ones
 * asking whether a person can actually get through — live in tests/naive-user.spec.js.
 *
 * Run everything with: node tools/drive.js tools/smoke.js /tmp
 */
'use strict';

module.exports = async function (page) {
  await page.hash('#/lesson/strong-links');

  var marks = await page.count('.gloss');
  if (marks < 4) page.fail('glossary: only ' + marks + ' terms marked on a page full of jargon');
  else page.log('glossary: ' + marks + ' terms marked on strong-links');

  // Every marker must resolve to a real term with a definition. A marker whose id is not
  // in the table would render an empty panel, which is worse than no marker at all.
  var orphans = await page.eval(
    '(function(){var ids=window.Glossary.TERMS.map(function(t){return t.id;});' +
    ' return [].filter.call(document.querySelectorAll(".gloss"),function(g){' +
    '   return ids.indexOf(g.dataset.term)<0;}).map(function(g){return g.dataset.term;}).join(",");})()');
  if (orphans) page.fail('glossary: markers with no term behind them — ' + orphans);

  // One marker per term per block. Without this the rule card becomes a dotted mess.
  var dup = await page.eval(
    '(function(){var bad=[];' +
    ' [].forEach.call(document.querySelectorAll("p, li, .step-text, .prompt, .tagline"),' +
    '   function(b){var seen={};' +
    '     [].forEach.call(b.querySelectorAll(".gloss"),function(g){' +
    '       if(seen[g.dataset.term]) bad.push(g.dataset.term+" in <"+b.tagName.toLowerCase()+">");' +
    '       seen[g.dataset.term]=1;});});' +
    ' return bad.join("; ");})()');
  if (dup) page.fail('glossary: term marked more than once in one block — ' + dup);
  else page.log('glossary: no term repeats within a block');

  // A page does not offer to explain its own subject, and would otherwise link to itself.
  var selfLink = await page.eval(
    '[].map.call(document.querySelectorAll(".gloss"),function(g){return g.dataset.term;})' +
    '.filter(function(t){return t==="strong-link"||t==="weak-link";}).join(",")');
  if (selfLink) page.fail('glossary: strong-links page marks its own subject (' + selfLink + ')');
  else page.log('glossary: the page does not gloss its own subject');

  // Compound words must not be split: "chains" inside "X-chains", "Wing" inside "XY-Wing".
  var split = await page.eval(
    '(function(){var bad=[];' +
    ' [].forEach.call(document.querySelectorAll(".gloss"),function(g){' +
    '   var prev=g.parentNode.previousSibling;' +
    '   if(prev&&prev.nodeType===3&&/-$/.test(prev.nodeValue)) bad.push(g.textContent);});' +
    ' return bad.join(",");})()');
  if (split) page.fail('glossary: marked part of a hyphenated word — ' + split);
  else page.log('glossary: hyphenated compounds left alone');

  // --- the panel opens, says something, and offers the lesson --------------
  var closedFirst = await page.eval(
    'document.querySelectorAll(".gloss-wrap.open").length');
  if (closedFirst) page.fail('glossary: ' + closedFirst + ' panels open before anything was clicked');

  await page.click('.gloss[data-term="home"]');
  var open = await page.count('.gloss-wrap.open');
  if (open !== 1) page.fail('glossary: clicking a term left ' + open + ' panels open');
  var body = await page.text('.gloss-wrap.open .gloss-pop');
  if (!body || body.length < 30) page.fail('glossary: panel has no definition — "' + body + '"');
  else page.log('glossary panel: ' + String(body).replace(/\s+/g, ' ').trim().slice(0, 80));
  var href = await page.eval(
    '(document.querySelector(".gloss-wrap.open .gloss-pop a")||{}).getAttribute' +
    '? document.querySelector(".gloss-wrap.open .gloss-pop a").getAttribute("href") : null');
  if (href !== '#/lesson/hidden-single') {
    page.fail('glossary: "home" should link to the hidden singles lesson, got ' + href);
  } else page.log('glossary: term links through to its lesson (' + href + ')');
  await page.shot('glossary');

  // Escape must dismiss it and hand focus back to the term. Escape restoring focus is
  // what re-opened the panel through the focus handler, so a panel that reports itself
  // closed is not enough — check it is still closed after focus lands.
  await page.eval(
    'document.querySelector(".gloss-wrap.open .gloss")' +
    '.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}))');
  var afterEsc = await page.count('.gloss-wrap.open');
  var refocused = await page.eval(
    'document.activeElement && document.activeElement.classList.contains("gloss")');
  if (afterEsc) page.fail('glossary: Escape left ' + afterEsc + ' panels open');
  else if (!refocused) page.fail('glossary: Escape closed the panel but lost focus');
  else page.log('glossary: Escape closes it and keeps focus on the term');

  await page.click('.gloss[data-term="home"]');

  // Opening a second term closes the first — two panels at once overlap and are unreadable.
  await page.click('.gloss[data-term="house"]');
  var stillOne = await page.count('.gloss-wrap.open');
  if (stillOne !== 1) page.fail('glossary: opening a second term left ' + stillOne + ' open');
  else page.log('glossary: only one panel open at a time');

  // A panel must actually be hidden, not merely marked hidden. [hidden] loses to any
  // `display` rule in the stylesheet, which had every panel on the page visible at once.
  var reallyHidden = await page.eval(
    '(function(){var p=document.querySelector(".gloss-wrap:not(.open) .gloss-pop");' +
    ' if(!p) return "none found";' +
    ' return getComputedStyle(p).display;})()');
  if (reallyHidden !== 'none') {
    page.fail('glossary: closed panels compute to display:' + reallyHidden + ', not none');
  } else page.log('glossary: closed panels are actually not displayed');

  // --- markers reach dynamically rendered prose ---------------------------
  // The scanner runs off a MutationObserver rather than a list of call sites, so the
  // walkthrough narration — which is rewritten on every step — has to get them too.
  await page.hash('#/lesson/x-wing');
  await page.clickText('.narrative .step-nav .btn', 'Next');
  await page.clickText('.narrative .step-nav .btn', 'Next');
  var inSteps = await page.count('.step-text .gloss');
  if (!inSteps) page.fail('glossary: walkthrough narration got no markers — the observer is not seeing re-renders');
  else page.log('glossary: ' + inSteps + ' markers in a re-rendered walkthrough step');

  // --- coordinate rulers --------------------------------------------------
  //
  // Every instruction on this site names cells as "r7c5". Without rulers, following one
  // means counting squares with a finger, which is most of why the strong-links panels
  // read as opaque. The labels have to line up with the columns they name, and the SVG
  // link overlay has to stay registered with the grid rather than the ruler frame.
  var ruler = await page.eval(
    '(function(){' +
    ' var g=document.querySelector(".board-grid"), b=g.closest(".board");' +
    ' if(!b) return JSON.stringify({err:"no .board"});' +
    ' var cols=b.querySelector(".ruler-cols"), rows=b.querySelector(".ruler-rows");' +
    ' if(!cols||!rows) return JSON.stringify({err:"no rulers"});' +
    ' var worst=0;' +
    ' for (var i=0;i<9;i++){' +
    '   var cl=cols.children[i].getBoundingClientRect();' +
    '   var ce=g.querySelector(\'.cell[data-cell="\'+i+\'"]\').getBoundingClientRect();' +
    '   worst=Math.max(worst, Math.abs((cl.left+cl.width/2)-(ce.left+ce.width/2)));' +
    '   var rl=rows.children[i].getBoundingClientRect();' +
    '   var re=g.querySelector(\'.cell[data-cell="\'+(i*9)+\'"]\').getBoundingClientRect();' +
    '   worst=Math.max(worst, Math.abs((rl.top+rl.height/2)-(re.top+re.height/2)));}' +
    ' var sv=b.querySelector(".board-overlay").getBoundingClientRect(), gr=g.getBoundingClientRect();' +
    ' return JSON.stringify({worst:Math.round(worst),' +
    '   overlayOff:Math.round(Math.abs(sv.left-gr.left)+Math.abs(sv.top-gr.top)+' +
    '     Math.abs(sv.width-gr.width)+Math.abs(sv.height-gr.height)),' +
    '   labels:[].map.call(cols.children,function(e){return e.textContent;}).join("")});})()');
  var R = JSON.parse(ruler);
  if (R.err) page.fail('rulers: ' + R.err);
  else {
    if (R.labels !== '123456789') page.fail('rulers: column labels read "' + R.labels + '"');
    if (R.worst > 1) page.fail('rulers: labels are up to ' + R.worst + 'px off the cells they name');
    if (R.overlayOff > 1) {
      page.fail('rulers: the link overlay no longer covers exactly the grid (off by ' +
        R.overlayOff + 'px) — every link line will be drawn away from its candidate');
    }
    if (!R.err && R.worst <= 1 && R.overlayOff <= 1) {
      page.log('rulers: 1-9 on both axes, aligned to the cells, overlay still registered');
    }
  }

  // --- the unexplained difficulty badge -----------------------------------
  var se = await page.eval(
    '(function(){var b=document.querySelector(".se .gloss");' +
    ' if(!b) return null; b.click();' +
    ' var p=document.querySelector(".se .gloss-pop"); return p?p.textContent:"no panel";})()');
  if (!se || se.indexOf('Sudoku Explainer') < 0) {
    page.fail('glossary: the SE difficulty badge explains nothing — "' + se + '"');
  } else page.log('glossary: SE badge explains itself');
};
