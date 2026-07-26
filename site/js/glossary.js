/* glossary.js — quiet definitions for the site's vocabulary.
 *
 * Several words here are jargon that no page stops to define, and one of them ("home" —
 * a cell where a digit can still go) is this site's own coinage rather than standard
 * sudoku usage. Sending the reader back to the foundations lesson to look one up costs
 * them their place; a footnote at every use would bury the prose. So: a dotted underline,
 * a small panel on tap or hover, and a link to the lesson if they want the long version.
 *
 * The terms are found by scanning rendered text rather than by marking up the copy. Most
 * of the prose on this site is generated at runtime from findings, so hand-marked spans
 * would cover the static pages and silently miss every walkthrough frame. Scanning also
 * means a new widget gets the feature without knowing the feature exists.
 *
 * Density is deliberately capped at one mark per term per block. A page where every
 * "house" is underlined is not a page with better definitions, it is a page you cannot
 * read.
 */
(function (root, factory) {
  var mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.Glossary = mod;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* `match` lists every surface form. `lesson` is optional — a term with no lesson gets a
   * definition and no link, which is better than linking somewhere that does not cover it. */
  var TERMS = [
    { id: 'house', match: ['house', 'houses'], lesson: 'geometry',
      def: 'Any row, column or box: nine cells that must hold the digits 1 to 9 between them.' },
    { id: 'home', match: ['home', 'homes'], lesson: 'hidden-single',
      def: 'A cell where a digit can still go. A digit’s homes in a house are the cells there ' +
        'that still list it as a candidate. Not standard sudoku jargon — it is shorthand used ' +
        'throughout this site.' },
    { id: 'peer', match: ['peer', 'peers'], lesson: 'geometry',
      def: 'The 20 cells sharing a row, column or box with a given cell — the ones it sees.' },
    { id: 'candidate', match: ['candidate', 'candidates'], lesson: 'geometry',
      def: 'A digit a cell could still take, shown as a small pencil mark.' },
    { id: 'pencil-mark', match: ['pencil mark', 'pencil marks'], lesson: 'naked-single',
      def: 'The small digits written in an empty cell, listing what it could still take.' },
    { id: 'bi-value', match: ['bi-value', 'bivalue'], lesson: 'geometry',
      def: 'A cell with exactly two candidates left.' },

    { id: 'strong-link', match: ['strong link', 'strong links'], lesson: 'strong-links',
      def: 'A digit with exactly two homes in a house. At least one of the two is true, so ' +
        'ruling one out proves the other.' },
    { id: 'weak-link', match: ['weak link', 'weak links'], lesson: 'strong-links',
      def: 'Two cells sharing a house. At most one of them holds the digit, so proving one ' +
        'rules out the other.' },
    { id: 'conjugate-pair', match: ['conjugate pair', 'conjugate pairs'], lesson: 'strong-links',
      def: 'Another name for a strong link: a digit down to exactly two homes in a house.' },

    { id: 'naked-subset', match: ['naked subset', 'naked subsets'], lesson: 'naked-pairs',
      def: 'n cells holding only n candidates between them, which uses those digits up and ' +
        'clears them from the rest of the house.' },
    { id: 'hidden-subset', match: ['hidden subset', 'hidden subsets'], lesson: 'hidden-pairs',
      def: 'n digits that fit in only n cells, which fills those cells and clears everything ' +
        'else out of them.' },

    { id: 'fish', match: ['fish'], lesson: 'x-wing',
      def: 'The single-digit counting family: n lines needing a digit, covered by n crossing ' +
        'lines. X-Wing is n=2, swordfish n=3, jellyfish n=4.' },
    { id: 'fin', match: ['fin', 'fins'], lesson: 'finned-fish',
      def: 'An extra candidate that spoils an otherwise complete fish, confined to one box.' },
    { id: 'turbot-fish', match: ['turbot fish'], lesson: 'kite',
      def: 'Skyscrapers and 2-string kites together: two strong links joined by a weak one.' },

    { id: 'pivot', match: ['pivot'], lesson: 'xy-wing',
      def: 'The cell of a wing that sees both of the others.' },
    { id: 'wing', match: ['wing', 'wings'], lesson: 'xy-wing',
      def: 'One of the two outer cells of an XY-Wing, each sharing a digit with the pivot.' },

    { id: 'band', match: ['band', 'bands'], lesson: 'hidden-single',
      def: 'Three boxes side by side: rows 1–3, rows 4–6 or rows 7–9.' },
    { id: 'stack', match: ['stack', 'stacks'], lesson: 'hidden-single',
      def: 'Three boxes one above another: columns 1–3, columns 4–6 or columns 7–9.' },

    { id: 'chain', match: ['chain', 'chains'], lesson: 'aic',
      def: 'A run of links alternating strong and weak. Strong at both ends, the two ends ' +
        'give an elimination without settling which end is true.' },
    { id: 'aic', match: ['AIC', 'AICs'], lesson: 'aic',
      def: 'Alternating inference chain: links alternating strong and weak, strong at both ends.' },

    { id: 'deadly-pattern', match: ['deadly pattern'], lesson: 'unique-rectangle',
      def: 'Four rectangle corners in two boxes, all down to the same pair. It would give the ' +
        'puzzle two solutions, so a proper puzzle can never reach it.' },
    { id: 'snyder', match: ['Snyder notation'], lesson: 'hidden-pairs',
      def: 'Pencilling a digit into a box only when it has exactly two homes there.' },

    { id: 'elimination', match: ['elimination', 'eliminations'],
      def: 'Removing a candidate from a cell because a deduction has ruled it out. Most ' +
        'techniques produce eliminations rather than placements.' },
    { id: 'se', match: [],
      def: 'Sudoku Explainer rating: the difficulty of the hardest step a puzzle needs. ' +
        'Roughly 1–2 for singles, 3–4 for subsets and simple fish, 5–7 for chains, 8 and up ' +
        'for the very hard.' }
  ];

  // Blocks that own a "first use" — one mark per term per paragraph, list item or panel.
  var BLOCK_SEL = 'p, li, .step-text, .prompt, .tagline, .hint-text, .verdict, .feedback, ' +
    'td, th, .pad-label, .scan-dead';

  /* Skipped outright, subtree and all. Bold and italic are where the copy defines or
   * stresses a term itself, so a marker there is noise; .rc/.dig/.chain are grid notation;
   * headings and nav are not reading matter. */
  var SKIP_SEL = 'a, button, .gloss-wrap, b, strong, em, code, .rc, .dig, .chain, .carry, ' +
    '.board-grid, .digit-pad, .sidebar, .eyebrow, .aic-item, .ladder, h1, h2, h3, .se';

  var BY_ID = Object.create(null);
  var BY_WORD = Object.create(null);
  TERMS.forEach(function (t) {
    BY_ID[t.id] = t;
    t.match.forEach(function (w) { BY_WORD[w.toLowerCase()] = t; });
  });

  var WORDS = Object.keys(BY_WORD)
    .sort(function (a, b) { return b.length - a.length; })   // "strong link" before "link"
    .map(function (w) { return w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); });
  var PATTERN = WORDS.length ? new RegExp('\\b(' + WORDS.join('|') + ')\\b', 'gi') : null;

  var LESSON_TITLES = Object.create(null);   // filled by install(), so this file owns no copy

  // ------------------------------------------------------------- the popup

  var openWrap = null, hoverTimer = null;
  // Escape closes the panel and puts focus back on the term. Focus is also what opens a
  // panel for keyboard users, so without this the restore immediately re-opened what
  // Escape had just closed, and the panel could not be dismissed at all.
  var restoringFocus = false;

  function closeOpen() {
    // A click also fires pointerenter, which arms the hover-open timer. Without cancelling
    // it here, closing within that 120ms window let the timer re-open what was just
    // dismissed — so a quick tap-then-Escape looked like Escape did nothing.
    clearTimeout(hoverTimer);
    if (!openWrap) return;
    openWrap.classList.remove('open');
    openWrap.querySelector('.gloss').setAttribute('aria-expanded', 'false');
    openWrap.querySelector('.gloss-pop').hidden = true;
    openWrap = null;
  }

  function openWrapEl(wrap, pinned) {
    if (openWrap === wrap) { wrap.dataset.pinned = pinned ? '1' : wrap.dataset.pinned; return; }
    closeOpen();
    var pop = wrap.querySelector('.gloss-pop');
    pop.hidden = false;
    wrap.classList.add('open');
    wrap.querySelector('.gloss').setAttribute('aria-expanded', 'true');
    wrap.dataset.pinned = pinned ? '1' : '';
    openWrap = wrap;

    // Keep it on screen. A term near the right edge would otherwise open into the gutter,
    // and on a phone almost every term is near the right edge.
    //
    // clientWidth, not window.innerWidth: under device emulation innerWidth came back as
    // 421 on a 390-wide viewport, so the panel was clamped to an edge that was not there.
    pop.style.left = '0px';
    var vw = document.documentElement.clientWidth;
    var r = pop.getBoundingClientRect();
    var shift = 0;
    if (r.right > vw - 8) shift = (vw - 8) - r.right;
    if (r.left + shift < 8) shift = 8 - r.left;      // never past the left edge either
    if (shift) pop.style.left = Math.round(shift) + 'px';
  }

  function trigger(label, term) {
    var wrap = document.createElement('span');
    wrap.className = 'gloss-wrap';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'gloss';
    btn.textContent = label;
    btn.dataset.term = term.id;
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', label + ' — show definition');

    var pop = document.createElement('span');
    pop.className = 'gloss-pop';
    pop.hidden = true;
    var head = document.createElement('b');
    head.textContent = term.match.length ? term.match[0] : label;
    pop.appendChild(head);
    var body = document.createElement('span');
    body.innerHTML = term.def;
    pop.appendChild(body);
    if (term.lesson && LESSON_TITLES[term.lesson]) {
      var a = document.createElement('a');
      a.href = '#/lesson/' + term.lesson;
      a.textContent = LESSON_TITLES[term.lesson] + ' →';
      a.addEventListener('click', closeOpen);
      pop.appendChild(a);
    }

    btn.addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      clearTimeout(hoverTimer);          // an explicit tap outranks the pending hover
      if (openWrap === wrap && wrap.dataset.pinned) closeOpen();
      else openWrapEl(wrap, true);
    });
    // Hover is a convenience for mice only; on touch the tap already opens it, and a
    // pointerenter-driven open would fight the click.
    wrap.addEventListener('pointerenter', function (ev) {
      if (ev.pointerType !== 'mouse') return;
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(function () { openWrapEl(wrap, false); }, 120);
    });
    wrap.addEventListener('pointerleave', function (ev) {
      if (ev.pointerType !== 'mouse') return;
      clearTimeout(hoverTimer);
      if (openWrap === wrap && !wrap.dataset.pinned) closeOpen();
    });
    // Keyboard: focus opens, and focus leaving the whole wrapper closes — checked against
    // relatedTarget so tabbing from the term onto its own lesson link does not slam it shut.
    btn.addEventListener('focus', function () {
      if (!restoringFocus) openWrapEl(wrap, false);
    });
    wrap.addEventListener('focusout', function (ev) {
      if (!ev.relatedTarget || !wrap.contains(ev.relatedTarget)) {
        if (openWrap === wrap && !wrap.dataset.pinned) closeOpen();
      }
    });

    wrap.appendChild(btn);
    wrap.appendChild(pop);
    return wrap;
  }

  // ------------------------------------------------------------ annotation

  function isSkip(el) {
    return el.matches && el.matches(SKIP_SEL);
  }

  function blockOf(node, root) {
    var el = node.parentElement;
    var b = el && el.closest ? el.closest(BLOCK_SEL) : null;
    return (b && root.contains(b)) ? b : root;
  }

  /** Has this block already introduced the term? Read from the DOM so a re-render resets it. */
  function marked(block, id) {
    return !!block.querySelector('.gloss[data-term="' + id + '"]');
  }

  /** The lesson being read, so a page does not offer to explain its own subject to you. */
  function currentLesson() {
    var m = /^#\/lesson\/([^/]+)/.exec(location.hash || '');
    return m ? m[1] : null;
  }

  function annotate(root) {
    if (!PATTERN || !root || root.nodeType !== 1 || !root.isConnected) return;
    if (root.closest && root.closest(SKIP_SEL)) return;
    var here = currentLesson();

    var walker = document.createTreeWalker(root,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
        acceptNode: function (n) {
          if (n.nodeType === 1) {
            return isSkip(n) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP;
          }
          return /[A-Za-z]/.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
      });

    var texts = [];
    while (walker.nextNode()) texts.push(walker.currentNode);

    texts.forEach(function (node) {
      if (!node.parentNode) return;
      var block = blockOf(node, root);
      var text = node.nodeValue, frag = null, last = 0, m;
      // marked() reads the DOM, but nothing is in the DOM until this node is finished —
      // so two hits inside one text node both looked unmarked and both got a marker.
      var pending = Object.create(null);
      PATTERN.lastIndex = 0;
      while ((m = PATTERN.exec(text))) {
        var term = BY_WORD[m[1].toLowerCase()];
        if (!term || term.lesson === here) continue;
        // \b treats a hyphen as a boundary, which would underline "chains" inside
        // "X-chains" and "Wing" inside "XY-Wing". A hyphen on either side means the word
        // is part of a compound and is not the term on its own.
        if (text.charAt(m.index - 1) === '-' ||
            text.charAt(m.index + m[1].length) === '-') continue;
        if (pending[term.id] || marked(block, term.id)) continue;
        pending[term.id] = 1;
        frag = frag || document.createDocumentFragment();
        frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        frag.appendChild(trigger(m[1], term));
        last = m.index + m[1].length;
      }
      if (!frag) return;
      frag.appendChild(document.createTextNode(text.slice(last)));
      node.parentNode.replaceChild(frag, node);
    });
  }

  /**
   * Watch instead of being called. Nearly every panel on this site rewrites its own
   * innerHTML on interaction, so a list of call sites would be a list to keep in sync;
   * an observer cannot fall behind one.
   */
  function install(root, lessonTitles) {
    Object.keys(lessonTitles || {}).forEach(function (k) { LESSON_TITLES[k] = lessonTitles[k]; });
    annotate(root);

    var obs = new MutationObserver(function (muts) {
      var adds = [];
      muts.forEach(function (mu) {
        Array.prototype.forEach.call(mu.addedNodes, function (n) {
          if (n.nodeType === 1) adds.push(n);
          else if (n.nodeType === 3 && n.parentElement) adds.push(n.parentElement);
        });
      });
      if (!adds.length) return;
      obs.disconnect();                     // annotate() mutates; do not watch ourselves
      adds.forEach(annotate);
      obs.observe(root, { childList: true, subtree: true });
    });
    obs.observe(root, { childList: true, subtree: true });

    document.addEventListener('click', function (ev) {
      if (openWrap && !openWrap.contains(ev.target)) closeOpen();
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape' || !openWrap) return;
      var btn = openWrap.querySelector('.gloss');
      closeOpen();
      restoringFocus = true;
      btn.focus();
      restoringFocus = false;
    });
    window.addEventListener('hashchange', closeOpen);
    return obs;
  }

  return {
    TERMS: TERMS, byId: function (id) { return BY_ID[id]; },
    trigger: trigger, annotate: annotate, install: install, close: closeOpen
  };
});
