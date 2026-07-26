/* app.js — routing, page assembly, and the interactive pieces.
 *
 * Static site, hash routing, no framework. Everything renders from the same engine the
 * generator and tests use, so what a lesson claims is what the solver actually found.
 */
(function () {
  'use strict';

  var S = window.Sudoku, T = window.Techniques, L = window.Lessons,
      D = window.Drills, H = window.Hypothesis, BoardView = window.BoardView,
      G = window.Glossary;

  // ------------------------------------------------------------------ dom

  function h(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined && html !== null) e.innerHTML = html;
    return e;
  }
  function add(parent, child) { parent.appendChild(child); return child; }
  function clear(e) { while (e.firstChild) e.removeChild(e.firstChild); return e; }
  function btn(label, cls, fn) {
    var b = h('button', cls || 'btn', label);
    b.addEventListener('click', fn);
    return b;
  }

  // ------------------------------------------------- pencil-mark emphasis

  /**
   * One piece of state, several buttons: the persistent one in the top bar and a local
   * one beside every grid. `peek` is the press-and-hold case — a temporary boost that
   * never touches the stored preference, so holding it does not change what you get back
   * on your next visit.
   */
  var Marks = (function () {
    var KEY = 'sudoku-teach-bold-marks';
    var persistent = [], local = [];
    var on = false, peeking = false;

    function apply() {
      document.body.classList.toggle('marks-bold', on || peeking);
      persistent.concat(local).forEach(syncOne);
    }
    function syncOne(b) {
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.textContent = on ? 'Normal marks' : 'Bolder marks';
    }
    return {
      init: function () {
        try { on = localStorage.getItem(KEY) === '1'; } catch (e) {}
        apply();
      },
      toggle: function () {
        on = !on;
        try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) {}
        apply();
      },
      peek: function (v) { peeking = v; apply(); },
      register: function (b, keep) {
        (keep ? persistent : local).push(b);
        syncOne(b);
      },
      // Lesson pages are built detached and appended afterwards, so `isConnected` is false
      // for a button that was registered moments ago. Prune on navigation instead, when we
      // actually know the old page is gone.
      dropLocal: function () { local = []; }
    };
  })();

  /** A local emphasis control to sit next to a grid. Click toggles; hold peeks. */
  function emphasisButton(container) {
    var b = h('button', 'btn small emphasis', 'Bolder marks');
    b.title = 'Click to keep pencil marks bold. Press and hold to peek without changing the setting.';
    var held = false, timer = null;

    b.addEventListener('pointerdown', function () {
      held = false;
      timer = setTimeout(function () { held = true; Marks.peek(true); }, 220);
    });
    function end(cancelled) {
      clearTimeout(timer);
      if (held) { Marks.peek(false); held = false; return; }
      if (!cancelled) Marks.toggle();
    }
    b.addEventListener('pointerup', function () { end(false); });
    b.addEventListener('pointerleave', function () { end(true); });
    b.addEventListener('pointercancel', function () { end(true); });
    b.addEventListener('click', function (ev) { ev.preventDefault(); });
    b.addEventListener('keydown', function (ev) {
      if (ev.key === ' ' || ev.key === 'Enter') { ev.preventDefault(); Marks.toggle(); }
    });

    Marks.register(b);
    container.appendChild(b);
    return b;
  }

  // ------------------------------------------------------------- progress

  var PROGRESS_KEY = 'sudoku-teach-progress';
  function loadProgress() {
    try { return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function markDone(id) {
    var p = loadProgress();
    p[id] = true;
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch (e) {}
    buildNav();
  }

  // ------------------------------------------------------------------ nav

  var navEl, mainEl;
  var pageCleanup = [];

  /** Register a listener that route() will tear down on the next navigation. */
  function onPage(target, type, fn) {
    target.addEventListener(type, fn);
    pageCleanup.push(function () { target.removeEventListener(type, fn); });
  }

  function buildNav() {
    var progress = loadProgress();
    clear(navEl);
    var top = add(navEl, h('div', 'nav-top'));
    top.appendChild(link('#/watch', 'Watch a solve', 'nav-link' + (location.hash === '#/watch' ? ' active' : '')));
    top.appendChild(link('#/mixed', 'Mixed drill', 'nav-link' + (location.hash === '#/mixed' ? ' active' : '')));
    top.appendChild(link('#/play', 'Playground', 'nav-link' + (location.hash === '#/play' ? ' active' : '')));
    var done = L.LESSONS.filter(function (l) { return progress[l.id]; }).length;
    add(top, h('div', 'nav-progress', done + ' of ' + L.LESSONS.length + ' done'));

    L.GROUPS.forEach(function (g) {
      var lessons = L.LESSONS.filter(function (l) { return l.group === g.id; });
      if (!lessons.length) return;
      add(navEl, h('div', 'nav-group', g.title));
      lessons.forEach(function (l) {
        var cls = 'nav-link' + (location.hash === '#/lesson/' + l.id ? ' active' : '') +
          (progress[l.id] ? ' done' : '');
        navEl.appendChild(link('#/lesson/' + l.id, l.title, cls));
      });
    });
  }

  function link(href, text, cls) {
    var a = h('a', cls || '', text);
    a.href = href;
    return a;
  }

  // --------------------------------------------------------- lesson page

  function lessonPage(lesson, startStep) {
    var page = h('article', 'page');
    var head = add(page, h('header', 'page-head'));
    var eyebrow = add(head, h('div', 'eyebrow', groupTitle(lesson.group)));
    // "SE 3.2" appears on twenty pages and is explained on none of them. The scanner skips
    // the eyebrow (it would mark the group name too), so this badge is wired up by hand.
    if (lesson.se) {
      eyebrow.appendChild(document.createTextNode(' '));
      var seTag = add(eyebrow, h('span', 'se'));
      seTag.appendChild(G.trigger(lesson.se, G.byId('se')));
    }
    add(head, h('h1', null, lesson.title));
    if (lesson.tagline) add(head, h('p', 'tagline', lesson.tagline));

    // A skip offered *on* the page, where the reader can see what they would be skipping,
    // rather than a self-assessment on the front page against a standard they can't see.
    if (lesson.skippable) {
      var nxt = L.LESSONS[L.LESSONS.indexOf(lesson) + 1];
      if (nxt) {
        var skip = add(head, h('p', 'skip-line'));
        skip.appendChild(link('#/lesson/' + nxt.id,
          'Know this already? Skip to ' + nxt.title + ' →', 'skip'));
      }
    }

    if (lesson.intro) add(page, h('div', 'prose', lesson.intro));

    if (lesson.custom) {
      customStage(page, lesson);
      // Concept pages have no drill, so without this they could never be ticked off and
      // the progress column looks broken on the very first lesson.
      var doneCard = add(page, h('section', 'card done-card'));
      var doneBtn = btn(loadProgress()[lesson.id] ? '✓ Marked as read' : 'Mark as read',
        'btn' + (loadProgress()[lesson.id] ? ' ghost' : ''), function () {
          markDone(lesson.id);
          doneBtn.textContent = '✓ Marked as read';
          doneBtn.className = 'btn ghost';
        });
      add(doneCard, h('span', null, 'No drill on this page. Tick it off when you are done. '));
      doneCard.appendChild(doneBtn);
    } else {
      walkthroughStage(page, lesson, startStep);
    }

    // How to *find* it, as opposed to how to recognize it once found — the gap the
    // walkthroughs kept leaving.
    if (lesson.hunt || lesson.huntWidget) {
      var hu = add(page, h('section', 'card hunt'));
      add(hu, h('h2', null, 'How to hunt these'));
      if (lesson.huntWidget === 'scan') scanTrainer(hu);
      if (lesson.huntWidget === 'fish') fishScanner(hu);
      if (lesson.huntWidget === 'paint') paintTrainer(hu);
      if (lesson.huntWidget === 'table') positionTable(hu);
      if (lesson.hunt) add(hu, h('div', 'prose', lesson.hunt));
    }
    if (lesson.rule) {
      var r = add(page, h('section', 'card rule'));
      add(r, h('h2', null, 'The rule'));
      add(r, h('div', 'prose', lesson.rule));
    }
    if (lesson.mistakes && lesson.mistakes.length) {
      var m = add(page, h('section', 'card mistakes'));
      add(m, h('h2', null, 'What goes wrong'));
      var ul = add(m, h('ul'));
      lesson.mistakes.forEach(function (t) { add(ul, h('li', null, t)); });
    }
    if (lesson.technique) drillSection(page, lesson);

    var idx = L.LESSONS.indexOf(lesson);
    var nav = add(page, h('nav', 'page-nav'));
    if (idx > 0) nav.appendChild(link('#/lesson/' + L.LESSONS[idx - 1].id,
      '← ' + L.LESSONS[idx - 1].title, 'prev'));
    if (idx < L.LESSONS.length - 1) nav.appendChild(link('#/lesson/' + L.LESSONS[idx + 1].id,
      L.LESSONS[idx + 1].title + ' →', 'next'));
    return page;
  }

  function groupTitle(id) {
    var g = L.GROUPS.filter(function (x) { return x.id === id; })[0];
    return g ? g.title : id;
  }

  // ------------------------------------------------------- the walkthrough

  function walkthroughStage(page, lesson, startStep) {
    var drill = D.makeDrill(lesson.technique, 0);
    if (!drill) {
      add(page, h('div', 'card warn', 'No generated example is available for this ' +
        'technique. Run <code>node tools/generate.js</code> to build the puzzle bank.'));
      return;
    }
    var finding = drill.primary;
    var steps = L.scriptFor(finding);

    var stage = add(page, h('section', 'stage'));
    var boardPane = add(stage, h('div', 'board-pane'));
    var narrative = add(stage, h('div', 'narrative'));

    // #/lesson/x-wing/4 opens straight at step 4 — handy for linking to a specific frame.
    var state = {
      step: Math.max(0, Math.min(steps.length - 1, (startStep | 0) || 0)),
      whatIf: null
    };

    var bv = new BoardView(boardPane, {
      label: lesson.title + ' walkthrough grid',
      onCandidate: function (cell, digit) {
        state.whatIf = { cell: cell, digit: digit, frame: 0 };
        render();
      },
      onDigitKey: function (cell, digit) {
        if (!drill.board.has(cell, digit)) return;
        state.whatIf = { cell: cell, digit: digit, frame: 0 };
        render();
      }
    });

    var controls = add(boardPane, h('div', 'controls'));
    var everFilters = steps.some(function (st) { return st.view && st.view.solo; });
    var soloBtn = btn('Show all digits', 'btn small', function () {
      state.forceAll = !state.forceAll;
      soloBtn.textContent = state.forceAll ? 'Follow the lesson' : 'Show all digits';
      render();
    });
    if (everFilters) controls.appendChild(soloBtn);
    emphasisButton(controls);
    controls.appendChild(h('span', 'hint-text',
      'Click any pencil mark to test it by contradiction.'));

    // step dots
    var dots = add(narrative, h('div', 'dots'));
    steps.forEach(function (_, i) {
      var d = h('button', 'dot', '');
      d.title = 'Step ' + (i + 1);
      d.setAttribute('aria-label', 'Step ' + (i + 1) + ' of ' + steps.length);
      d.addEventListener('click', function () { state.step = i; state.whatIf = null; render(); });
      dots.appendChild(d);
    });

    var textEl = add(narrative, h('div', 'step-text'));
    textEl.setAttribute('aria-live', 'polite');
    var navRow = add(narrative, h('div', 'step-nav'));
    function goBack() {
      if (state.whatIf) { state.whatIf = null; render(); return; }
      if (state.step > 0) { state.step--; render(); }
    }
    function goNext() {
      if (state.whatIf) { state.whatIf = null; render(); return; }
      if (state.step < steps.length - 1) { state.step++; render(); }
    }
    var backBtn = btn('Back', 'btn ghost', goBack);
    var nextBtn = btn('Next', 'btn', goNext);
    navRow.appendChild(backBtn);
    navRow.appendChild(nextBtn);

    // Reaching the end used to just gray out Next, leaving the drill ~800px below with
    // nothing pointing at it.
    var toDrill = btn('Now you try →', 'btn primary', function () {
      var d = page.querySelector('.drill');
      if (d) { d.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
    toDrill.style.display = 'none';
    navRow.appendChild(toDrill);

    // Five to seven mouse trips to a small button is most of what "clunky" meant.
    onPage(document, 'keydown', function (ev) {
      if (!page.isConnected) return;
      if (ev.target && ev.target.closest && ev.target.closest('.board-grid')) return;  // grid owns arrows
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      var tag = ev.target && ev.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (ev.key === 'ArrowRight') { goNext(); ev.preventDefault(); }
      else if (ev.key === 'ArrowLeft') { goBack(); ev.preventDefault(); }
    });

    var whatIfPane = add(narrative, h('div', 'whatif'));

    function render() {
      if (state.whatIf) return renderWhatIf();

      clear(whatIfPane).style.display = 'none';
      textEl.classList.remove('superseded');
      dots.style.display = '';
      navRow.style.display = '';
      var st = steps[state.step];
      textEl.innerHTML = '<span class="step-n">' + (state.step + 1) + '/' + steps.length +
        '</span>' + st.text;
      Array.prototype.forEach.call(dots.children, function (d, i) {
        d.className = 'dot' + (i === state.step ? ' active' : (i < state.step ? ' seen' : ''));
        if (i === state.step) d.setAttribute('aria-current', 'step');
        else d.removeAttribute('aria-current');
      });
      backBtn.disabled = state.step === 0;
      var last = state.step === steps.length - 1;
      nextBtn.disabled = last;
      nextBtn.style.display = last ? 'none' : '';
      toDrill.style.display = (last && page.querySelector('.drill')) ? '' : 'none';

      var v = {};
      Object.keys(st.view).forEach(function (k) { v[k] = st.view[k]; });
      v.board = drill.board;
      v.givens = drill.givens;
      if (state.forceAll) { v.solo = null; v.dim = false; }
      bv.render(v);
    }

    function renderWhatIf() {
      navRow.style.display = 'none';
      textEl.classList.add('superseded');   // it describes a picture no longer on screen
      dots.style.display = 'none';
      whatIfPane.style.display = '';
      var wi = state.whatIf;
      var result = wi.result || (wi.result = H.run(drill.board, { cell: wi.cell, digit: wi.digit }, 24));

      if (result.outcome === 'impossible') {
        state.whatIf = null;
        render();
        return;
      }
      var upto = Math.min(wi.frame, result.frames.length - 1);
      var b = drill.board.clone();
      for (var i = 0; i <= upto; i++) b.place(result.frames[i].cell, result.frames[i].digit);

      var marks = [];
      var focus = result.frames.slice(0, upto + 1).map(function (f) { return f.cell; });
      var last = result.frames[upto];

      var done = upto >= result.frames.length - 1;
      var verdict = '';
      if (done) {
        if (result.outcome === 'contradiction') {
          verdict = '<p class="verdict bad"><b>Contradiction.</b> ' + result.deadReason + '</p>';
          if (result.dead !== undefined) focus.push(result.dead);
        } else if (result.outcome === 'solved') {
          verdict = '<p class="verdict good"><b>The grid completes.</b> That assumption was ' +
            'in fact correct.</p>';
        } else {
          verdict = '<p class="verdict"><b>No contradiction — the ripple runs out.</b> ' +
            'Forced moves alone do not settle it. That is what the technique on this ' +
            'page is for.</p>';
        }
      }

      clear(whatIfPane);
      add(whatIfPane, h('div', 'whatif-head', 'What if ' + S.cellName(wi.cell) +
        ' were ' + wi.digit + '?'));
      add(whatIfPane, h('div', 'step-text',
        '<span class="step-n">' + (upto + 1) + '/' + result.frames.length + '</span>' +
        last.reason + verdict));
      var row = add(whatIfPane, h('div', 'step-nav'));
      row.appendChild(btn('Step', 'btn', function () {
        if (wi.frame < result.frames.length - 1) { wi.frame++; render(); }
      })).disabled = done;
      row.appendChild(btn('Run it out', 'btn ghost', function () {
        wi.frame = result.frames.length - 1; render();
      }));
      row.appendChild(btn('Back to the lesson', 'btn ghost', function () {
        state.whatIf = null; render();
      }));

      bv.render({
        board: b, givens: drill.givens, focus: focus, dim: true,
        marks: marks,
        // Derived placements get their own tint rather than borrowing the amber that
        // means "the pattern" everywhere else on the site.
        cellClass: (function () {
          var c = {};
          result.frames.slice(1, upto + 1).forEach(function (fr) { c[fr.cell] = 'trial'; });
          c[wi.cell] = 'pivot';
          if (done && result.dead !== undefined && result.outcome === 'contradiction') c[result.dead] = 'dead';
          return c;
        })()
      });
      bv.pulse([last.cell]);
    }

    render();
  }

  // -------------------------------------------------- shared UI components

  /**
   * Digit-first input: pick a digit, then tap whole cells. This is how mobile sudoku apps
   * work, and here it also solves a real problem — a pencil mark is a ~13px target on a
   * phone, while a cell is three times that in each direction.
   */
  function digitPad(parent, opts) {
    var pad = add(parent, h('div', 'digit-pad'));
    var labelEl = add(pad, h('span', 'pad-label', opts.label || 'Pick a digit, then tap cells:'));
    var buttons = [];
    for (var d = 1; d <= 9; d++) {
      (function (dd) {
        var b = btn(String(dd), 'btn digit', function () {
          api.active = api.active === dd ? null : dd;
          api.sync();
          if (opts.onPick) opts.onPick(api.active);
        });
        pad.appendChild(b);
        buttons.push(b);
      })(d);
    }
    var api = {
      el: pad, active: null,
      setLabel: function (t) { labelEl.innerHTML = t; labelEl.className = 'pad-label' + (t && api.active ? ' armed' : ''); },
      sync: function () {
        buttons.forEach(function (b, i) {
          var on = api.active === i + 1;
          b.className = 'btn digit' + (on ? ' active' : '');
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
          b.setAttribute('aria-label', 'Digit ' + (i + 1));
        });
      }
    };
    api.sync();
    return api;
  }

  /**
   * The stepped narration player, so a drill's "show me" is the same experience as the
   * lesson walkthrough rather than a bare answer dump.
   */
  function stepPlayer(container, bv, base, steps) {
    var idx = 0;
    var dots = add(container, h('div', 'dots'));
    steps.forEach(function (_, i) {
      var d = h('button', 'dot', '');
      d.setAttribute('aria-label', 'Step ' + (i + 1) + ' of ' + steps.length);
      d.addEventListener('click', function () { idx = i; draw(); });
      dots.appendChild(d);
    });
    var textEl = add(container, h('div', 'step-text'));
    textEl.setAttribute('aria-live', 'polite');
    var nav = add(container, h('div', 'step-nav'));
    var back = btn('Back', 'btn ghost', function () { if (idx > 0) { idx--; draw(); } });
    var next = btn('Next', 'btn', function () { if (idx < steps.length - 1) { idx++; draw(); } });
    nav.appendChild(back); nav.appendChild(next);

    function draw() {
      var st = steps[idx];
      textEl.innerHTML = '<span class="step-n">' + (idx + 1) + '/' + steps.length + '</span>' + st.text;
      Array.prototype.forEach.call(dots.children, function (d, i) {
        d.className = 'dot' + (i === idx ? ' active' : (i < idx ? ' seen' : ''));
      });
      back.disabled = idx === 0;
      next.disabled = idx === steps.length - 1;
      var v = {};
      Object.keys(st.view).forEach(function (k) { v[k] = st.view[k]; });
      Object.keys(base).forEach(function (k) { if (v[k] === undefined) v[k] = base[k]; });
      bv.render(v);
    }
    draw();
    return { nav: nav };
  }

  // ------------------------------------------------------------- the drill

  function drillSection(page, lesson) {
    var sec = add(page, h('section', 'card drill'));
    add(sec, h('h2', null, 'Your turn'));
    var body = add(sec, h('div', 'drill-body'));

    var attempt = 0;
    function build() {
      clear(body);
      var drill = D.makeDrill(lesson.technique, 1 + attempt);
      if (!drill) { add(body, h('p', null, 'No practice grid available.')); return; }

      var wrap = add(body, h('div', 'stage'));
      var boardPane = add(wrap, h('div', 'board-pane'));
      var side = add(wrap, h('div', 'narrative'));

      var phase = 'pattern';
      var selection = [];
      var picks = [];
      var found = null;
      var hintLevel = -1, hintView = {};
      var pad = null;
      var singleTarget = null;   // set when the answer is one digit for one known cell

      function togglePick(cell, digit) {
        say('', '');   // a stale red error must not outlive the action that fixed it
        // In single-placement mode the answer is "which digit", so any further tap on the
        // target cell should re-state it, never silently cancel what was already chosen.
        if (singleTarget !== null) {
          if (cell !== singleTarget || !drill.board.has(cell, digit)) return false;
          picks = [{ cell: cell, digit: digit }];
          if (pad) { pad.active = digit; pad.sync(); }
          return true;
        }
        if (!drill.board.has(cell, digit)) return false;
        var key = cell * 10 + digit;
        var k = picks.map(function (p) { return p.cell * 10 + p.digit; }).indexOf(key);
        if (k >= 0) picks.splice(k, 1); else picks.push({ cell: cell, digit: digit });
        return true;
      }

      var soloFilter = [];   // several digits at once: a triple needs all three visible
      var bv = new BoardView(boardPane, {
        label: 'Practice grid',
        onDigitKey: function (cell, digit) {
          if (phase === 'consequence' && togglePick(cell, digit)) draw();
        },
        onCell: function (cell) {
          if (phase === 'pattern') {
            var i = selection.indexOf(cell);
            if (i >= 0) selection.splice(i, 1); else selection.push(cell);
            draw();
          } else if (phase === 'consequence' && pad && pad.active) {
            if (togglePick(cell, pad.active)) draw();
            else if (singleTarget === null) {
              say('There is no ' + pad.active + ' in ' + S.cellName(cell) + ' to mark.', 'warn');
            }
          }
        },
        onCandidate: function (cell, digit, ev) {
          ev.stopPropagation();
          if (phase === 'pattern') {
            var i = selection.indexOf(cell);
            if (i >= 0) selection.splice(i, 1); else selection.push(cell);
            draw();
          } else if (phase === 'consequence') {
            // The candidate grid covers the whole cell, so "tap a cell" and "tap a mark"
            // are the same gesture — landing on the 5's slot in the middle used to mark a
            // 5 no matter which digit was armed. If a digit is armed it wins; the pad is
            // the mode, and the mode has to be honoured everywhere.
            var d = (pad && pad.active) ? pad.active : digit;
            if (togglePick(cell, d)) draw();
            else if (pad && pad.active) {
              say('There is no ' + d + ' in ' + S.cellName(cell) + ' to remove.', 'warn');
              draw();
            }
          }
        }
      });

      var filterRow = add(boardPane, h('div', 'filter-row'));
      add(filterRow, h('span', 'label', 'Show only:'));
      var filterBtns = [];
      for (var fd = 1; fd <= 9; fd++) {
        (function (dd) {
          var b = btn(String(dd), 'btn digit', function () {
            var at = soloFilter.indexOf(dd);
            if (at >= 0) soloFilter.splice(at, 1); else soloFilter.push(dd);
            syncFilter();
            draw();
          });
          b.setAttribute('aria-label', 'Show only the ' + dd + 's');
          filterRow.appendChild(b);
          filterBtns.push(b);
        })(fd);
      }
      var allBtn = btn('all', 'btn small ghost', function () {
        soloFilter = []; syncFilter(); draw();
      });
      filterRow.appendChild(allBtn);
      emphasisButton(filterRow);
      function syncFilter() {
        filterBtns.forEach(function (b, i) {
          var on = soloFilter.indexOf(i + 1) >= 0;
          b.className = 'btn digit' + (on ? ' active' : '');
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        allBtn.className = 'btn small ghost' + (soloFilter.length ? '' : ' active');
      }
      syncFilter();

      var prompt = add(side, h('div', 'prompt'));
      prompt.setAttribute('aria-live', 'polite');
      var padHost = add(side, h('div', 'pad-host'));
      var feedback = add(side, h('div', 'feedback'));
      feedback.setAttribute('role', 'status');
      var actions = add(side, h('div', 'step-nav'));

      var hintBtn, showBtn;
      var checkBtn = btn('Check', 'btn', function () {
        if (phase === 'pattern') {
          var res = D.checkPattern(drill, selection);
          if (res.state === 'empty') {
            say('Tap the cells that make up the pattern.', '');
          } else if (res.state === 'correct') {
            found = res.finding;
            phase = 'consequence';
            selection = res.finding.cells.slice();
            hintView = {};
            buildPad();
            say('', '');   // the prompt now states the new question; stale praise would confuse

          } else {
            // 'inert' is a right answer to the wrong question — teach, don't scold
            say(res.message, res.state === 'bad' ? 'bad' :
              (res.state === 'partial' || res.state === 'inert') ? 'warn' : 'bad');
          }
        } else if (phase === 'consequence') {
          var r2 = D.checkConsequences(found, picks);
          if (r2.state === 'correct') {
            say('Correct — the pattern and its eliminations. ' +
              '<a href="#/lesson/' + nextLessonId(lesson) + '">Next lesson &rarr;</a>', 'good');
            markDone(lesson.id);
            phase = 'done';
            checkBtn.disabled = true;
            hintBtn.disabled = true;
            showBtn.disabled = true;
            clear(padHost);
          } else {
            say(r2.message, r2.state === 'partial' ? 'warn' : 'bad');
          }
        }
        draw();
      });
      actions.appendChild(checkBtn);

      hintBtn = btn('Hint', 'btn ghost', function () {
        if (hintLevel >= 2) return;
        hintLevel++;
        var hint = D.hintFor(drill, hintLevel, phase);
        // merge, don't replace: hint 2 used to discard hint 1's single-digit filter and
        // restore the full wall of pencil marks, leaving you worse off than before.
        // A hint's digit filter is mirrored into the filter row, which is the single
        // source of truth for `solo`. Keeping a copy in hintView too meant that emptying
        // the row (or pressing "all") silently handed control back to the stale copy —
        // the filter looked broken and the hint looked stuck on.
        Object.keys(hint.view).forEach(function (k) {
          if (k !== 'solo') hintView[k] = hint.view[k];
        });
        if (hint.view.solo) {
          soloFilter = (typeof hint.view.solo === 'number' ? [hint.view.solo] : hint.view.solo).slice();
          syncFilter();
        }
        say(hint.text + ' <span class="muted">(hint ' + (hintLevel + 1) + ' of 3)</span>', 'warn');
        hintBtn.disabled = hintLevel >= 2;
        draw();
      });
      actions.appendChild(hintBtn);

      // The escape hatch has to teach, or being stuck just ends the session.
      showBtn = btn('Show me', 'btn ghost', function () { reveal(); });
      actions.appendChild(showBtn);
      actions.appendChild(btn('New grid', 'btn ghost', function () { attempt++; build(); }));

      function buildPad() {
        clear(padHost);
        singleTarget = null;
        var cons = D.consequences(found);
        // When the answer is a digit for one already-identified cell, requiring a second
        // tap on that cell is a step with nothing in it — and invisible if you don't
        // guess it's expected. Choosing the digit is the whole answer.
        singleTarget = cons.mode === 'places' && cons.places.length === 1
          ? cons.places[0].cell : null;
        var single = singleTarget;
        var idleLabel = 'Tap a pencil mark to strike it — or pick a digit here to work ' +
          'whole cells at a time:';
        pad = digitPad(padHost, {
          label: single !== null ? '' : idleLabel,
          onPick: function (d) {
            if (single !== null) { picks = d ? [{ cell: single, digit: d }] : []; draw(); return; }
            // say which mode you are now in, rather than leaving it to be discovered
            pad.setLabel(d
              ? 'Armed: tapping any cell now strikes its ' + d + '. Tap the ' + d +
                ' again to go back to tapping marks.'
              : idleLabel);
          }
        });
      }

      function reveal() {
        clear(side);
        clear(padHost);
        phase = 'reveal';
        var f = drill.primary;
        add(side, h('div', 'prompt', 'Here it is, worked through. Then try a fresh grid.'));
        var player = stepPlayer(side, bv,
          { board: drill.board, givens: drill.givens }, L.scriptFor(f));
        player.nav.appendChild(btn('Try another grid', 'btn', function () {
          attempt++; build();
        }));
      }

      function say(msg, cls) { feedback.className = 'feedback ' + (cls || ''); feedback.innerHTML = msg; }

      function draw() {
        if (phase === 'reveal') return;
        var findText = (lesson.drill && lesson.drill.find) || 'the pattern';
        if (phase === 'pattern') {
          // Say how many. One template appended "tap each cell" to every drill, which read
          // wrong for single-cell answers — and the count is the scope of the task, not a
          // spoiler: without it, "the cells forming the subset" is a 2-or-3 coin flip.
          var want = drill.primary.cells.length;
          prompt.innerHTML = 'Find <b>' + findText + '</b>.<br>' +
            (want === 1 ? 'Tap it' : 'Tap all ' + want + ' cells') + ', then press Check. ' +
            '<span class="muted">' + selection.length + ' of ' + want + ' selected</span>';
        } else if (phase === 'consequence') {
          var cons2 = D.consequences(found);
          prompt.innerHTML = '<span class="got-it">✓ That is the pattern.</span> ' +
            (cons2.mode === 'places' && cons2.places.length === 1
              ? 'Now: which digit goes in <b class="rc">' + S.cellName(cons2.places[0].cell) +
                '</b>?'
              : 'Now mark every candidate it kills. <span class="muted">' + picks.length +
                ' of ' + cons2.kills.length + ' marked</span>');
        } else {
          prompt.innerHTML = 'Done.';
        }

        var cellClass = {};
        selection.forEach(function (c) { cellClass[c] = phase === 'pattern' ? 'pick' : 'a'; });
        var v = {
          board: drill.board, givens: drill.givens, cellClass: cellClass,
          marks: picks.map(function (p) {
            return { cell: p.cell, digit: p.digit, kind: 'elim' };
          })
        };
        Object.keys(hintView).forEach(function (k) { v[k] = hintView[k]; });
        if (soloFilter.length) v.solo = soloFilter.slice();
        if (phase === 'done' && found) {
          v.focus = found.cells;
          v.links = found.links;
          var cons = D.consequences(found);
          v.marks = cons.kills.map(function (e) {
            return { cell: e.cell, digit: e.digit, kind: 'elim' };
          }).concat(cons.places.map(function (e) {
            return { cell: e.cell, digit: e.digit, kind: 'true' };
          }));
        }
        bv.render(v);
      }
      draw();
      say('', '');
    }
    build();
  }

  function nextLessonId(lesson) {
    var i = L.LESSONS.indexOf(lesson);
    return L.LESSONS[Math.min(i + 1, L.LESSONS.length - 1)].id;
  }

  // ------------------------------------------------------- custom stages

  function customStage(page, lesson) {
    if (lesson.custom === 'geometry') return geometryStage(page);
    if (lesson.custom === 'strong-links') return strongLinkStage(page);
    if (lesson.custom === 'aic') return aicStage(page);
    if (lesson.custom === 'frontier') return frontierStage(page);
  }

  function anyPosition(technique, index) {
    var d = D.makeDrill(technique || 'x-wing', index || 0);
    return d;
  }

  function geometryStage(page) {
    var drill = anyPosition('naked-pair', 0);
    if (!drill) return;
    var stage = add(page, h('section', 'stage'));
    var boardPane = add(stage, h('div', 'board-pane'));
    var side = add(stage, h('div', 'narrative'));
    var info = add(side, h('div', 'step-text', 'Pick a cell on the left.'));

    var bv = new BoardView(boardPane, {
      onCell: function (cell) { show(cell); },
      onCandidate: function (cell) { show(cell); }
    });

    function show(cell) {
      var hs = S.housesOf[cell];
      info.innerHTML = '<p><b class="rc">' + S.cellName(cell) + '</b> belongs to ' +
        hs.map(function (x) { return S.houseName(S.HOUSE_META[x]); }).join(', ') + '.</p>' +
        '<p>It has <b>' + S.peers[cell].length + '</b> peers — every cell tinted here. ' +
        'Anything it "sees".</p>' +
        (drill.board.values[cell]
          ? '<p>It already holds <b class="dig">' + drill.board.values[cell] + '</b>, so none ' +
            'of its peers can.</p>'
          : '<p>Its candidates are <b class="dig">' + drill.board.candidates(cell).join('</b> <b class="dig">') +
            '</b> — the digits no peer has taken.</p>');
      bv.render({
        board: drill.board, givens: drill.givens,
        houses: hs.map(function (x) { return { house: x, kind: 'base' }; }),
        // the peers are the whole point of this page — keep them bright, dim the rest
        focus: [cell], keep: S.peers[cell], dim: true,
        cellClass: (function () { var c = {}; c[cell] = 'pivot'; return c; })()
      });
    }
    bv.render({ board: drill.board, givens: drill.givens });
  }

  /**
   * Strong links, taught by operating one.
   *
   * The first version of this page was a catalogue: pick a digit, read a list of its
   * strong links. It restated the definition and left unshown the two things people
   * actually get stuck on — that "at least one of these is true" is a switch you can push
   * (turn one end off, the other lights up), and that two of them chained give a real
   * elimination without ever revealing which end holds the digit. Both are things you find
   * out by doing. Neither survives being written down. Hence three acts and little prose.
   */
  function strongLinkStage(page) {
    var stage = add(page, h('section', 'stage'));
    // The tabs span both columns rather than sitting in the narrative: they choose what
    // the whole page is doing, and on a phone the stage stacks, which would otherwise
    // bury them under the board and its buttons.
    var tabs = add(stage, h('div', 'act-tabs'));
    var boardPane = add(stage, h('div', 'board-pane'));
    var side = add(stage, h('div', 'narrative'));

    // whichever act is on screen owns the clicks
    var onPick = null;
    var bv = new BoardView(boardPane, {
      onCell: function (c) { if (onPick) onPick(c); },
      onCandidate: function (c) { if (onPick) onPick(c); }
    });
    // Each panel owns actControls and clears it freely; the emphasis button sits outside
    // so a panel that rebuilds its buttons on every step does not re-register it each time.
    var controls = add(boardPane, h('div', 'controls'));
    var actControls = add(controls, h('div', 'controls act-controls'));
    emphasisButton(controls);
    var info = add(side, h('div', 'step-text'));

    var ACTS = [
      { label: 'Switch one off', run: seesawAct },
      { label: 'Chain two together', run: chainAct },
      { label: 'Find your own', run: findAct }
    ];
    ACTS.forEach(function (a, i) {
      tabs.appendChild(btn(a.label, 'btn small act-tab', function () { open(i); }));
    });

    function open(i) {
      Array.prototype.forEach.call(tabs.children, function (b, k) {
        b.className = 'btn small act-tab' + (k === i ? ' active' : '');
        b.setAttribute('aria-pressed', k === i ? 'true' : 'false');
      });
      clear(actControls);
      onPick = null;
      ACTS[i].run({
        bv: bv, info: info, controls: actControls,
        picks: function (fn) { onPick = fn; }
      });
    }
    open(0);
  }

  function cellTag(c) { return '<b class="rc">' + S.cellName(c) + '</b>'; }
  function digTag(d) { return '<b class="dig">' + d + '</b>'; }

  /**
   * Every strong link on a board, one entry per (digit, pair), best example first.
   *
   * "Best" is not cosmetic. A row with only two empty cells in it has a strong link on
   * every digit it is missing, and that link teaches nothing — of course the digit has two
   * homes, there are only two places left. The instructive link is the one in a house with
   * plenty of room where the digit has still been squeezed down to two, so the count is a
   * fact about the digit rather than about the leftovers. Order by elbow room.
   */
  function allStrongLinks(board) {
    var out = [], seen = Object.create(null);
    for (var d = 1; d <= 9; d++) {
      T.strongLinks(board, d).forEach(function (l) {
        var k = l.digit + ':' + Math.min(l.a, l.b) + ':' + Math.max(l.a, l.b);
        if (seen[k]) return;
        seen[k] = 1;
        l.room = S.HOUSES[l.house].filter(function (c) { return !board.values[c]; }).length;
        out.push(l);
      });
    }
    // ties break by house index, which puts rows and columns before boxes: a link inside a
    // box is the hardest one to read as "two homes" the first time you meet one
    return out.sort(function (a, b) { return (b.room - a.room) || (a.house - b.house); });
  }

  /** The house a link lives in: for a strong link, the one where the digit is down to two. */
  function linkHouse(board, a, b, digit, strong) {
    var shared = S.housesOf[a].filter(function (x) { return S.housesOf[b].indexOf(x) >= 0; });
    if (strong) {
      for (var i = 0; i < shared.length; i++) {
        if (board.cellsFor(shared[i], digit).length === 2) return shared[i];
      }
    }
    return shared[0];
  }

  /* Act 1. A strong link behaves like a see-saw, and the way to learn a see-saw is to push
   * on it. Switch one end off and the widget lights the other. Try to switch off both and
   * it shows you the house with nowhere left to put the digit — so the definition arrives
   * as the result of doing the illegal thing, rather than as a warning against it. */
  function seesawAct(ui) {
    var drill = anyPosition('x-wing', 0);
    if (!drill) return;
    var board = drill.board;
    var links = allStrongLinks(board);
    if (!links.length) return;
    var idx = 0, off = [];

    ui.controls.appendChild(btn('Another link', 'btn small', function () {
      idx = (idx + 1) % links.length; off = []; draw();
    }));
    ui.controls.appendChild(btn('Start over', 'btn small ghost', function () {
      off = []; draw();
    }));
    ui.picks(function (cell) {
      var l = links[idx];
      if (cell !== l.a && cell !== l.b) return;
      var at = off.indexOf(cell);
      if (at >= 0) off.splice(at, 1); else off.push(cell);
      // Pulse whatever the tap just decided, not the cell that was tapped: the point of
      // the panel is that pushing one end moves the *other* one.
      draw(off.length === 1 ? (off[0] === l.a ? l.b : l.a) : cell);
    });

    function draw(pulse) {
      var l = links[idx], d = l.digit;
      var house = S.houseName(S.HOUSE_META[l.house]);
      var marks = [], cellClass = {};

      if (!off.length) {
        ui.info.innerHTML =
          '<p>Only the ' + digTag(d) + ' is showing. In ' + house + ' it has exactly two ' +
          'homes left, ' + cellTag(l.a) + ' and ' + cellTag(l.b) + '. No other cell in ' +
          house + ' can take it.</p>' +
          '<p><b>Tap either outlined cell</b> to suppose the ' + digTag(d) + ' is ' +
          '<em>not</em> there.</p>';
      } else if (off.length === 1) {
        var gone = off[0], lit = gone === l.a ? l.b : l.a;
        marks.push({ cell: gone, digit: d, kind: 'elim' });
        marks.push({ cell: lit, digit: d, kind: 'true' });
        cellClass[lit] = 'trial';
        ui.info.innerHTML =
          '<p class="verdict good">No ' + d + ' in ' + cellTag(gone) + ', so the only home ' +
          'left in ' + house + ' is ' + cellTag(lit) + '. <b>' + S.cellName(lit) + ' is the ' +
          d + '.</b></p>' +
          '<p>You did not have to look at ' + cellTag(lit) + ' at all. The count in ' +
          house + ' settled it.</p>' +
          '<p class="muted">Now try ruling that one out too.</p>';
      } else {
        marks.push({ cell: l.a, digit: d, kind: 'elim' });
        marks.push({ cell: l.b, digit: d, kind: 'elim' });
        S.HOUSES[l.house].forEach(function (c) {
          if (!board.values[c]) cellClass[c] = 'dead';
        });
        ui.info.innerHTML =
          '<p class="verdict bad">Both off — and now ' + house + ' has nowhere at all to put ' +
          'its ' + digTag(d) + '. That cannot happen.</p>' +
          '<p>So <b>they cannot both be off.</b> At least one of ' + cellTag(l.a) + ' and ' +
          cellTag(l.b) + ' is the ' + d + '. A pair of cells tied together that way is a ' +
          '<b>strong link</b>.</p>' +
          '<p class="muted">Tap either one again to put it back, or try another link.</p>';
      }

      if (!off.length) { cellClass[l.a] = 'tap'; cellClass[l.b] = 'tap'; }
      ui.bv.render({
        board: board, givens: drill.givens, solo: d,
        houses: [{ house: l.house, kind: 'base' }],
        links: [{ a: l.a, b: l.b, digit: d, kind: 'strong' }],
        focus: [l.a, l.b], keep: S.HOUSES[l.house], dim: true,
        marks: marks, cellClass: cellClass
      });
      if (pulse !== undefined && pulse !== null) ui.bv.pulse([pulse]);
    }
    draw();
  }

  /* Act 2. What a second link buys you — the part that makes the object worth learning.
   * The learner walks a skyscraper one link at a time, from whichever end they like, and
   * lands on "one of these two far ends is the digit". Then the closing panel: claim
   * either end, and the same cells die. You never find out which end it was, and the
   * elimination never depended on it. That is the argument the whole chain family runs on,
   * and it is the one that reads as a shrug when it is written down. */
  function chainAct(ui) {
    var drill = D.makeDrill('skyscraper', 0);
    if (!drill) { ui.info.innerHTML = '<p>No example available.</p>'; return; }
    var f = drill.primary, d = f.digits[0], board = drill.board;
    var path = [f.links[0].a, f.links[0].b, f.links[1].b, f.links[2].b];
    var kinds = [f.links[0].kind, f.links[1].kind, f.links[2].kind];
    var ends = [path[0], path[3]];
    var victims = f.eliminations.map(function (e) { return e.cell; });

    var from = null;      // the end we supposed empty
    var step = 0;         // links walked so far
    var claim = null;     // the end the learner then insisted on
    var claimed = Object.create(null);   // ends claimed at least once, for the closing line

    ui.picks(function (cell) {
      if (from === null && ends.indexOf(cell) >= 0) { from = cell; step = 0; draw(cell); }
    });

    // The chain reads the same from either end. Walking it backwards is not a variation,
    // it is the same deduction — and being able to do it is half of why neither end is
    // special.
    function walk() {
      var backwards = from === path[3];
      return {
        cells: backwards ? path.slice().reverse() : path.slice(),
        kinds: backwards ? kinds.slice().reverse() : kinds.slice()
      };
    }

    function reason(o, i) {
      var a = o.cells[i], b = o.cells[i + 1], strong = o.kinds[i] === 'strong';
      var hn = S.houseName(S.HOUSE_META[linkHouse(board, a, b, d, strong)]);
      if (strong) {
        return 'In ' + hn + ' the ' + digTag(d) + ' has only ' + cellTag(a) + ' and ' +
          cellTag(b) + ' to choose from, and ' + cellTag(a) + ' is out. So <b>' +
          S.cellName(b) + ' is the ' + d + '</b>. <span class="muted">(strong link)</span>';
      }
      return cellTag(a) + ' and ' + cellTag(b) + ' are both in ' + hn + ', and ' +
        cellTag(a) + ' is the ' + d + '. So <b>' + S.cellName(b) + ' is not</b>. ' +
        '<span class="muted">(weak link)</span>';
    }

    function draw(pulse) {
      clear(ui.controls);
      var marks = [], cellClass = {}, arrows = [], html;
      var keep = [];

      if (from === null) {
        // The two ends are the only things to tap, and until now they were tinted exactly
        // like the two middle cells — so "tap either far end" meant counting squares to
        // find out which two of the four it meant.
        ends.forEach(function (e) { cellClass[e] = 'tap'; });
        html = '<p>Four cells, joined by three lines. The two <b>solid</b> lines are strong ' +
          'links; the <b>dashed</b> one between them is weak.</p>' +
          '<p><b>Tap either outlined cell</b> — ' + cellTag(ends[0]) + ' or ' +
          cellTag(ends[1]) + ' — to suppose the ' + digTag(d) + ' is <em>not</em> there.</p>' +
          '<p class="muted">Either end works. Try one, then start over and try the other.</p>';
      } else {
        var o = walk();
        for (var i = 0; i <= step; i++) {
          var on = i % 2 === 1;
          marks.push({ cell: o.cells[i], digit: d, kind: on ? 'true' : 'elim' });
          if (on) cellClass[o.cells[i]] = 'trial';
        }
        var list = '';
        for (var k = 0; k < step; k++) {
          list += '<li' + (k === step - 1 ? ' class="now"' : '') + '>' + reason(o, k) + '</li>';
        }

        html = '<p>Suppose ' + cellTag(o.cells[0]) + ' is <em>not</em> the ' + digTag(d) +
          '.</p>' + (list ? '<ol class="chain-steps">' + list + '</ol>' : '');

        if (step < 3) {
          // Naming the cell the link leads to means you know where to look before you
          // press, instead of hunting the grid afterwards for whatever just changed.
          var nextCell = o.cells[step + 1];
          ui.controls.appendChild(btn('Follow the link to ' + S.cellName(nextCell),
            'btn small primary', function () { step++; draw(nextCell); }));
        } else {
          html += '<p class="verdict good">Supposing ' + cellTag(o.cells[0]) + ' had no ' +
            d + ' forced ' + cellTag(o.cells[3]) + ' to be one. So <b>at least one of ' +
            S.cellName(ends[0]) + ' and ' + S.cellName(ends[1]) + ' is the ' + d + '</b>.</p>';

          if (claim === null) {
            html += '<p>Which one is not determined. Claim either and see what happens:</p>';
            ends.forEach(function (e) {
              ui.controls.appendChild(btn('Say ' + S.cellName(e) + ' is the ' + d,
                'btn small', function () { claim = e; draw(); }));
            });
          } else {
            claimed[claim] = 1;
            marks.length = 0; cellClass = {};
            marks.push({ cell: claim, digit: d, kind: 'true' });
            cellClass[claim] = 'trial';
            keep = victims;      // they become readable only now that they are the subject
            victims.forEach(function (v) {
              marks.push({ cell: v, digit: d, kind: 'elim' });
              cellClass[v] = 'dead';
              arrows.push({ a: claim, b: v, digit: d });
            });
            html += '<p class="verdict bad">If ' + cellTag(claim) + ' is the ' + d + ', then ' +
              S.cellList(victims) + ' cannot be — each one shares a house with it.</p>';
            if (ends.every(function (e) { return claimed[e]; })) {
              html += '<p class="verdict good"><b>Same cells, either way.</b> ' +
                S.cellList(victims) + ' lose the ' + d + ' whichever end holds it, so the ' +
                'elimination stands without deciding which.</p>';
            } else {
              html += '<p class="muted">Now claim the other end and watch what changes.</p>';
            }
            ends.forEach(function (e) {
              ui.controls.appendChild(btn('Say ' + S.cellName(e) + ' is the ' + d,
                'btn small' + (e === claim ? ' active' : ''), function () { claim = e; draw(); }));
            });
          }
        }
        ui.controls.appendChild(btn('Start over', 'btn small ghost', function () {
          from = null; step = 0; claim = null; draw();
        }));
      }

      ui.info.innerHTML = html;
      ui.bv.render({
        board: board, givens: drill.givens, solo: d,
        houses: f.houses.map(function (x) { return { house: x, kind: 'base' }; }),
        links: f.links, arrows: arrows,
        focus: path, keep: keep, dim: true,
        marks: marks, cellClass: cellClass
      });
      if (pulse !== undefined && pulse !== null) ui.bv.pulse([pulse]);
    }

    draw();
  }

  /* Act 3. Spotting them, which is the part nobody can do for you. A strong link has no
   * shape to pattern-match — it is a count — so the only practice that helps is counting.
   * Pick two cells; the widget works out which house you must have meant and tells you how
   * many homes the digit really has there. Getting it wrong is the useful case: the miss
   * lights up the homes you did not count. */
  function findAct(ui) {
    var drill = anyPosition('x-wing', 0);
    if (!drill) return;
    var board = drill.board;

    var digits = [];
    for (var dd = 1; dd <= 9; dd++) if (T.strongLinks(board, dd).length) digits.push(dd);
    if (!digits.length) return;

    var di = 0, picked = [], found = Object.create(null), message = '', spoil = [], revealed = false;

    function digit() { return digits[di]; }
    function links() { return allStrongLinks(board).filter(function (l) { return l.digit === digit(); }); }
    function key(a, b) { return Math.min(a, b) + ':' + Math.max(a, b); }

    ui.picks(function (cell) {
      if (picked.length >= 2) picked = [];
      if (picked.indexOf(cell) >= 0) return;
      picked.push(cell);
      message = ''; spoil = [];
      if (picked.length === 2) judge();
      draw();
    });

    function judge() {
      var a = picked[0], b = picked[1], d = digit();
      if (!board.has(a, d) || !board.has(b, d)) {
        var bad = board.has(a, d) ? b : a;
        message = '<p class="verdict bad">' + cellTag(bad) + ' cannot hold a ' + d + ' at ' +
          'all, so it is not one of its homes. A strong link joins two <em>candidates</em>.</p>';
        return;
      }
      var shared = S.housesOf[a].filter(function (x) { return S.housesOf[b].indexOf(x) >= 0; });
      if (!shared.length) {
        message = '<p class="verdict bad">' + cellTag(a) + ' and ' + cellTag(b) + ' share no ' +
          'row, column or box. A strong link is a count taken inside one house — with no ' +
          'house in common there is nothing to count.</p>';
        return;
      }
      var hit = shared.filter(function (x) { return board.cellsFor(x, d).length === 2; })[0];
      if (hit !== undefined) {
        found[key(a, b)] = 1;
        message = '<p class="verdict good">Yes. In ' + S.houseName(S.HOUSE_META[hit]) +
          ' the ' + digTag(d) + ' has exactly these two homes, so at least one of them is ' +
          'the ' + d + '.</p>';
        return;
      }
      var counts = shared.map(function (x) {
        var homes = board.cellsFor(x, d);
        spoil = spoil.concat(homes);
        return 'in ' + S.houseName(S.HOUSE_META[x]) + ' the ' + d + ' has <b>' + homes.length +
          '</b> homes (' + S.cellList(homes) + ')';
      });
      message = '<p class="verdict bad">Not a strong link: ' + counts.join(', and ') +
        '. A strong link needs exactly two. With three or more, knocking one out proves ' +
        'nothing about the others.</p>';
    }

    ui.controls.appendChild(btn('Another digit', 'btn small', function () {
      di = (di + 1) % digits.length; picked = []; message = ''; spoil = []; revealed = false;
      found = Object.create(null);
      draw();
    }));
    ui.controls.appendChild(btn('Show me all of them', 'btn small ghost', function () {
      revealed = !revealed; draw();
    }));

    function draw() {
      var d = digit(), ls = links();
      var got = ls.filter(function (l) { return found[key(l.a, l.b)]; }).length;
      var cellClass = {}, marks = [], focus = [];

      picked.forEach(function (c) { cellClass[c] = 'pick'; focus.push(c); });
      spoil.forEach(function (c) { marks.push({ cell: c, digit: d, kind: 'pattern' }); });
      ls.forEach(function (l) {
        if (!found[key(l.a, l.b)]) return;
        marks.push({ cell: l.a, digit: d, kind: 'true' });
        marks.push({ cell: l.b, digit: d, kind: 'true' });
      });

      ui.info.innerHTML =
        '<p>Only the ' + digTag(d) + ' is showing. Somewhere on this grid a house is down ' +
        'to <b>two</b> homes for it. <b>Tap the two cells</b> you think are the pair.</p>' +
        message +
        '<p class="hint-text">Found ' + got + ' of the ' + ls.length + ' strong ' +
        (ls.length === 1 ? 'link' : 'links') + ' on the ' + d + '.</p>';

      ui.bv.render({
        board: board, givens: drill.givens, solo: d,
        marks: marks, cellClass: cellClass,
        links: (revealed ? ls : ls.filter(function (l) { return found[key(l.a, l.b)]; }))
          .map(function (l) { return { a: l.a, b: l.b, digit: d, kind: 'strong' }; })
      });
    }
    draw();
  }

  function aicStage(page) {
    var rows = [
      ['Skyscraper', 'skyscraper', 'Two strong links joined by a weak link in a line'],
      ['2-String Kite', 'two-string-kite', 'Two strong links joined by a weak link in a box'],
      ['X-Chain', 'x-chain', 'Any number of alternating links on one digit'],
      ['XY-Chain', 'xy-chain', 'The nodes are bi-value cells instead of single digits'],
      ['Remote pairs', 'remote-pairs', 'An XY-chain where every cell holds the same pair']
    ];
    var stage = add(page, h('section', 'stage'));
    var boardPane = add(stage, h('div', 'board-pane'));
    var side = add(stage, h('div', 'narrative'));
    var bv = new BoardView(boardPane, {});
    var info = add(side, h('div', 'step-text'));
    var list = add(side, h('div', 'aic-list'));

    var current = null;
    rows.forEach(function (row) {
      var drill = D.makeDrill(row[1], 0);
      var item = h('button', 'aic-item', '<b>' + row[0] + '</b><span>' + row[2] + '</span>');
      item.addEventListener('click', function () {
        if (!drill) { info.innerHTML = '<p>No example available.</p>'; return; }
        current = row[1];
        Array.prototype.forEach.call(list.children, function (c, i) {
          c.className = 'aic-item' + (rows[i][1] === current ? ' active' : '');
        });
        var f = drill.primary;
        info.innerHTML = '<p><b>' + row[0] + '</b> — written as an AIC:</p>' +
          '<p class="chain big">' + notation(f) + '</p>' +
          '<p>Read <span class="chain">=</span> as <em>at least one of these is true</em> ' +
          'and <span class="chain">-</span> as <em>at most one of these is true</em>. ' +
          'Alternate them, start and end on <span class="chain">=</span>, and the two ' +
          'endpoints give you the elimination.</p>' +
          '<p class="muted">' + L.helpers.elimSummary(f) + '</p>';
        bv.render({
          board: drill.board, givens: drill.givens,
          solo: f.digits.length === 1 ? f.digits[0] : null,
          links: f.links, focus: f.cells, dim: true,
          marks: f.eliminations.map(function (e) {
            return { cell: e.cell, digit: e.digit, kind: 'elim' };
          })
        });
      });
      list.appendChild(item);
    });

    info.innerHTML = '<p>Pick one on the right. Each is the same theorem with different ' +
      'nodes.</p>';
    if (list.firstChild) list.firstChild.click();
  }

  /**
   * Render a finding's links as standard chain notation. Detectors emit links as a path
   * but not necessarily each one a→b in path order, so walk it and flip as needed —
   * a chain printed in the wrong direction is worse than none at all.
   */
  function notation(f) {
    if (f.technique === 'xy-chain' || f.technique === 'remote-pairs') return bivalueNotation(f);
    if (!f.links || !f.links.length) return '(no chain)';
    var links = f.links.slice();
    var first = links[0], second = links[1];
    var cur;
    if (second && (second.a === first.a || second.b === first.a)) cur = first.b;
    else cur = first.a;

    var d0 = first.digit || (f.digits && f.digits[0]) || '';
    var out = '(' + d0 + ')' + S.cellName(cur);
    for (var i = 0; i < links.length; i++) {
      var l = links[i];
      var next = l.a === cur ? l.b : (l.b === cur ? l.a : null);
      if (next === null) break;              // not a simple path; stop rather than lie
      var d = l.digit || (f.digits && f.digits[0]) || '';
      out += ' <b>' + (l.kind === 'strong' ? '=' : '-') + '</b> (' + d + ')' + S.cellName(next);
      cur = next;
    }
    return out;
  }

  /**
   * Chains whose nodes are digits within bi-value cells. Each cell contributes a strong
   * link between its two candidates; consecutive cells are joined weakly on the digit
   * they share. That alternation is the thing the AIC page claims, so it has to be real.
   */
  function bivalueNotation(f) {
    var links = f.links || [];
    if (!links.length) return '(no chain)';
    var path = [links[0].a];
    links.forEach(function (l) { path.push(l.b); });

    // Remote pairs carry no per-link digit: every cell holds the same {x,y}, and the
    // chain simply alternates between them.
    if (f.technique === 'remote-pairs') {
      var ds = f.digits || [];
      if (ds.length !== 2) return '(no chain)';
      var cur = ds[0];
      var flip = function (d) { return d === ds[0] ? ds[1] : ds[0]; };
      var str = '(' + cur + ')' + S.cellName(path[0]);
      for (var k = 0; k < path.length - 1; k++) {
        str += ' <b>=</b> (' + flip(cur) + ')' + S.cellName(path[k]);
        cur = flip(cur);
        str += ' <b>-</b> (' + cur + ')' + S.cellName(path[k + 1]);
      }
      str += ' <b>=</b> (' + flip(cur) + ')' + S.cellName(path[path.length - 1]);
      return str;
    }

    var entry = f.extra && f.extra.z;                 // xy-chain: the digit at both ends
    var first = links[0].digit;
    var startDigit = entry || otherDigitOf(f, path[0], first) || first;

    var out = '(' + startDigit + ')' + S.cellName(path[0]);
    for (var i = 0; i < links.length; i++) {
      var l = links[i];
      // inside the cell: not-startDigit forces the shared digit
      out += ' <b>=</b> (' + l.digit + ')' + S.cellName(l.a);
      out += ' <b>-</b> (' + l.digit + ')' + S.cellName(l.b);
      startDigit = l.digit;
    }
    var endDigit = entry || startDigit;
    out += ' <b>=</b> (' + endDigit + ')' + S.cellName(path[path.length - 1]);
    return out;
  }

  function otherDigitOf(f, cell, digit) {
    var ds = (f.digits || []).filter(function (d) { return d !== digit; });
    return ds.length ? ds[0] : null;
  }

  function frontierStage(page) {
    add(page, h('div', 'prose', [
      '<p>Everything so far has been a pattern you can learn to see. Past this point the ',
      'techniques are searches. This page describes them; it does not teach them.</p>',

      '<h3>Almost Locked Sets</h3>',
      '<p>A set of <em>n</em> cells holding <em>n+1</em> candidates is <b>almost</b> a naked ',
      'subset — it becomes one the moment any single candidate is removed. ALS techniques ',
      '(ALS-XZ, ALS-XY-Wing, Sue de Coq, Death Blossom) link two or more such sets and use ',
      'the "if this one collapses, that one does not" argument. They are powerful and hard ',
      'to find by eye on a real grid.</p>',

      '<h3>Grouped chains and nice loops</h3>',
      '<p>An AIC node need not be a single cell: it can be all the candidates for a digit ',
      'within a box-row intersection. Allowing grouped nodes makes chains much shorter, and ',
      'a chain that closes into a loop gives eliminations at every weak link around it.</p>',

      '<h3>Forcing chains and nets</h3>',
      '<p>Pick a cell, try each of its candidates in turn, and follow the consequences of ',
      'each. Anything <em>all</em> branches agree on is true. This is the "what if?" button ',
      'you have been using, run systematically. It always works, it needs no pattern ',
      'recognition, and it is exhausting by hand.</p>',

      '<h3>And then, guessing</h3>',
      '<p>At the very hard end the distinction between "technique" and "structured trial ',
      'and error" dissolves. Bowman\'s Bingo, templates, and full backtracking are all ',
      'guess-and-check with bookkeeping. Sudoku Explainer ratings above about 9.0 describe ',
      'puzzles that essentially nobody solves by pure pattern recognition.</p>',

      '<h3>Where to go next</h3>',
      '<ul>',
      '<li><b>Practice the ones you have.</b> Almost every published puzzle, including most ',
      'labeled "fiendish", needs nothing past locked candidates and subsets. The techniques ',
      'here are for the hard end of the hobby and for going faster.</li>',
      '<li><b>Learn Snyder notation</b> if you have not — marking a digit in a box only when ',
      'it has exactly two homes there. It turns strong links into something you can see ',
      'rather than hunt for.</li>',
      '<li><b>Try variants.</b> Killer, thermo, sandwich, arrow. Everything here transfers ',
      'directly, and the variant scene is where most of the interesting puzzles are now.</li>',
      '</ul>'
    ].join('')));
  }

  /**
   * The scanning trainer. Rather than telling someone that digits with 3-5 placed pay
   * best and that cross-hatching a band is fast, this makes them choose a digit and then
   * performs the cross-hatch in front of them: every row and column holding that digit is
   * struck through, and whatever survives in each box lights up. The heuristic is
   * something you notice from the tally, not something you are told.
   */
  function scanTrainer(host) {
    var entries = D.entriesFor('hidden-single');
    if (!entries.length) return;

    add(host, h('p', 'prose', 'Pick a digit and watch the cross-hatch: every row and ' +
      'column already holding it gets struck out, and whatever survives in each box is ' +
      'where it could still go. A box down to one surviving cell is a hidden single.'));

    var stage = add(host, h('div', 'stage'));
    var boardPane = add(stage, h('div', 'board-pane'));
    var side = add(stage, h('div', 'narrative'));
    var bv = new BoardView(boardPane, { label: 'Scanning practice grid' });

    var strip = add(side, h('div', 'digit-strip'));
    var report = add(side, h('div', 'step-text'));
    report.setAttribute('aria-live', 'polite');
    var tallyEl = add(side, h('div', 'tally'));
    var nav = add(side, h('div', 'step-nav'));

    var picks = 0, hits = 0, hitCounts = [], missCounts = [];
    var board, givens, tried;

    function load(i) {
      var pos = D.positionOf(entries[i % entries.length]);
      board = pos.board; givens = pos.givens; tried = {};
      buildStrip();
      report.innerHTML = '<p>Which digit would you scan first?</p>';
      bv.render({ board: board, givens: givens });
    }

    function placedCount(d) {
      var n = 0;
      for (var i = 0; i < 81; i++) if (board.values[i] === d) n++;
      return n;
    }

    function buildStrip() {
      clear(strip);
      for (var d = 1; d <= 9; d++) {
        (function (dd) {
          var wrap = add(strip, h('div', 'pick'));
          var b = btn(String(dd), 'btn digit', function () { scan(dd, wrap); });
          b.setAttribute('aria-label', 'Scan the ' + dd + 's, ' + placedCount(dd) + ' placed');
          wrap.appendChild(b);
          add(wrap, h('span', 'count', placedCount(dd) + ' placed'));
        })(d);
      }
    }

    function scan(d, wrap) {
      var strikes = [];
      for (var r = 0; r < 9; r++) {
        if (S.HOUSES[r].some(function (c) { return board.values[c] === d; }))
          strikes.push({ type: 'row', index: r });
      }
      for (var c = 0; c < 9; c++) {
        if (S.HOUSES[9 + c].some(function (x) { return board.values[x] === d; }))
          strikes.push({ type: 'col', index: c });
      }

      // Survivors in a box that still has choices are shown faintly — they are the
      // cross-hatch doing its work. A box down to one is the answer, and must be the only
      // thing that shouts.
      var cellClass = {}, forced = [];
      for (var b2 = 0; b2 < 9; b2++) {
        var spots = board.cellsFor(18 + b2, d);
        if (!spots.length) continue;
        if (spots.length === 1) {
          cellClass[spots[0]] = 'forced';
          forced.push(spots[0]);
        } else {
          spots.forEach(function (c2) { cellClass[c2] = 'survivor'; });
        }
      }

      bv.render({
        board: board, givens: givens, solo: d, strikes: strikes, cellClass: cellClass,
        marks: forced.map(function (c3) { return { cell: c3, digit: d, kind: 'true' }; })
      });

      var n = placedCount(d);
      if (!tried[d]) {
        tried[d] = true;
        picks++;
        if (forced.length) { hits++; hitCounts.push(n); } else { missCounts.push(n); }
        wrap.className = 'pick tried' + (forced.length ? ' good' : '');
      }

      report.innerHTML = forced.length
        ? '<p><b>Yes.</b> ' + plural(forced.length, 'One box is', forced.length + ' boxes are') +
          ' down to a single surviving cell: ' + forced.map(function (c4) {
            return '<b class="rc">' + S.cellName(c4) + '</b>'; }).join(', ') +
          '. The ' + d + ' has to go there.</p>' +
          '<p class="muted">' + n + ' of the ' + d + 's were already placed.</p>'
        : '<p><b>Nothing forced.</b> Every box still has room for the ' + d +
          ' in more than one cell.</p>' +
          '<p class="muted">' + n + ' of the ' + d + 's were already placed.</p>';

      updateTally();
    }

    function plural(n2, one, many) { return n2 === 1 ? one : many; }

    function avg(a) {
      return a.length ? (a.reduce(function (x, y) { return x + y; }, 0) / a.length).toFixed(1) : '–';
    }

    function updateTally() {
      var msg = picks + ' digit' + (picks === 1 ? '' : 's') + ' scanned, ' + hits + ' paid off.';
      if (hitCounts.length && missCounts.length) {
        msg += ' Digits that paid averaged <b>' + avg(hitCounts) + '</b> already placed; ' +
          'the empty-handed ones averaged <b>' + avg(missCounts) + '</b>.';
      }
      tallyEl.innerHTML = msg;
    }

    var idx = 0;
    nav.appendChild(btn('New position', 'btn ghost', function () { load(++idx); }));
    load(0);
  }

  /**
   * The fish scanner. A reviewer finished the X-Wing lesson and reported they still could
   * not find one unaided — because the walkthrough hands you the digit and then hands you
   * the rows. The search itself ("for one digit, list every row with exactly two homes,
   * then compare their column pairs") appeared nowhere. This runs that search with you.
   */
  function fishScanner(host) {
    var entries = D.entriesFor('x-wing');
    if (!entries.length) return;

    add(host, h('p', 'prose', 'The search has two moves. Pick one digit and find the lines ' +
      'where it has exactly <b>two</b> homes left. Then check whether two of those lines ' +
      'use the <b>same pair</b> of columns.'));

    var stage = add(host, h('div', 'stage'));
    var boardPane = add(stage, h('div', 'board-pane'));
    var side = add(stage, h('div', 'narrative'));
    var bv = new BoardView(boardPane, { label: 'Fish scanning grid' });

    var strip = add(side, h('div', 'digit-strip'));
    var table = add(side, h('div', 'scan-table'));
    var report = add(side, h('div', 'step-text'));
    report.setAttribute('aria-live', 'polite');
    var nav = add(side, h('div', 'step-nav'));

    var board, givens, digit = null, orient = 0, chosen = [];

    function lines() {
      var out = [];
      for (var k = 0; k < 9; k++) {
        var houseIdx = orient ? 9 + k : k;
        var spots = board.cellsFor(houseIdx, digit);
        if (!spots.length) continue;
        out.push({ k: k, house: houseIdx, spots: spots,
                   pos: spots.map(orient ? S.rowOf : S.colOf) });
      }
      return out;
    }

    function twoHomeCount(d) {
      var n = 0;
      for (var k = 0; k < 9; k++) {
        if (board.cellsFor(orient ? 9 + k : k, d).length === 2) n++;
      }
      return n;
    }

    function buildStrip() {
      clear(strip);
      for (var d = 1; d <= 9; d++) {
        (function (dd) {
          var wrap = add(strip, h('div', 'pick' + (digit === dd ? ' on' : '')));
          var b = btn(String(dd), 'btn digit' + (digit === dd ? ' active' : ''), function () {
            digit = dd; chosen = []; draw();
          });
          var n = twoHomeCount(dd);
          b.setAttribute('aria-label', 'Scan the ' + dd + 's, ' + n + ' lines with two homes');
          wrap.appendChild(b);
          add(wrap, h('span', 'count' + (n >= 2 ? ' good' : ''), n + ' pair' + (n === 1 ? '' : 's')));
        })(d);
      }
    }

    function draw() {
      buildStrip();
      clear(table);
      var word = orient ? 'Column' : 'Row', cross = orient ? 'rows' : 'columns';

      if (digit === null) {
        report.innerHTML = '<p>Pick a digit. The number under each is how many ' +
          (orient ? 'columns' : 'rows') + ' have exactly two homes left for it — you need ' +
          'at least two of those for a fish.</p>';
        bv.render({ board: board, givens: givens });
        return;
      }

      var ls = lines();
      ls.forEach(function (l) {
        var two = l.spots.length === 2;
        var picked = chosen.indexOf(l.k) >= 0;
        var row = add(table, h('div', 'scan-row' + (two ? ' two' : ' many') + (picked ? ' picked' : '')));
        var label = word + ' ' + (l.k + 1);
        if (two) {
          var b = btn(label + ' — ' + cross + ' ' + l.pos.map(function (p) { return p + 1; }).join(' & '),
            'btn small scan-pick', function () {
              var i = chosen.indexOf(l.k);
              if (i >= 0) chosen.splice(i, 1);
              else { chosen.push(l.k); if (chosen.length > 2) chosen.shift(); }
              draw();
            });
          row.appendChild(b);
        } else {
          add(row, h('span', 'scan-dead', label + ' — ' + l.spots.length + ' homes'));
        }
      });

      var pickedLines = ls.filter(function (l) { return chosen.indexOf(l.k) >= 0; });
      var cells = [], houses = [];
      pickedLines.forEach(function (l) {
        cells = cells.concat(l.spots);
        houses.push({ house: l.house, kind: 'base' });
      });

      if (chosen.length < 2) {
        report.innerHTML = '<p>' + (twoHomeCount(digit) < 2
          ? 'Only ' + twoHomeCount(digit) + ' line here has exactly two homes for the ' +
            digit + '. No fish is possible on this digit — try another.'
          : 'Now pick <b>two</b> of the two-home lines and compare their ' + cross + '.') + '</p>';
      } else {
        var a = pickedLines[0], b2 = pickedLines[1];
        var same = a.pos.slice().sort().join() === b2.pos.slice().sort().join();
        if (same) {
          var covers = a.pos.map(function (p) { return orient ? p : 9 + p; });
          covers.forEach(function (hh) { houses.push({ house: hh, kind: 'cover' }); });
          var kills = [];
          covers.forEach(function (hh) {
            board.cellsFor(hh, digit).forEach(function (c) {
              if (cells.indexOf(c) < 0) kills.push({ cell: c, digit: digit, kind: 'elim' });
            });
          });
          report.innerHTML = '<p><b>Same pair — that is an X-Wing.</b> ' + word + 's ' +
            (a.k + 1) + ' and ' + (b2.k + 1) + ' both put the ' + digit + ' in ' + cross +
            ' ' + a.pos.map(function (p) { return p + 1; }).join(' and ') + '.</p>' +
            (kills.length
              ? '<p>Those ' + cross + ' are used up, so ' + kills.length + ' other ' +
                digit + (kills.length === 1 ? '' : 's') + ' can go: ' +
                kills.map(function (e) { return '<b class="rc">' + S.cellName(e.cell) + '</b>'; }).join(', ') + '.</p>'
              : '<p class="muted">This one eliminates nothing, so it is a real pattern but not a useful move.</p>');
          bv.render({ board: board, givens: givens, solo: digit, houses: houses,
                      focus: cells.concat(kills.map(function (e) { return e.cell; })),
                      dim: true, marks: kills });
          return;
        }
        report.innerHTML = '<p><b>Different ' + cross + '.</b> ' + word + ' ' + (a.k + 1) +
          ' uses ' + a.pos.map(function (p) { return p + 1; }).join(' & ') + ', ' + word + ' ' +
          (b2.k + 1) + ' uses ' + b2.pos.map(function (p) { return p + 1; }).join(' & ') +
          '. No fish — try another pair.</p>';
      }
      bv.render({ board: board, givens: givens, solo: digit, houses: houses,
                  focus: cells, dim: chosen.length > 0 });
    }

    var idx = 0;
    nav.appendChild(btn('Scan columns instead', 'btn ghost', function (ev) {
      orient = 1 - orient;
      ev.target.textContent = orient ? 'Scan rows instead' : 'Scan columns instead';
      chosen = []; draw();
    }));
    nav.appendChild(btn('New position', 'btn ghost', function () {
      var pos = D.positionOf(entries[++idx % entries.length]);
      board = pos.board; givens = pos.givens; digit = null; chosen = []; draw();
    }));

    var pos0 = D.positionOf(entries[0]);
    board = pos0.board; givens = pos0.givens;
    draw();
  }

  /**
   * Paint-it-yourself coloring. The lesson says "color a cell, color its strong-link
   * partner the opposite, and keep going" — an algorithm stated in words, illustrated with
   * a finished network. Here you run it: click a cell to start, then click any cell joined
   * to something already painted, and the site tells you which color it is forced to take
   * and why. When the network is complete it offers to look for the payoff.
   */
  function paintTrainer(host) {
    var entries = D.entriesFor('coloring-wrap').concat(D.entriesFor('coloring-trap'));
    if (!entries.length) return;

    add(host, h('p', 'prose', 'Every solid line is a strong link: one end or the other is ' +
      'the digit. So neighbors must take opposite colors. Click any cell to start, then ' +
      'keep clicking cells joined to what you have already painted.'));

    var stage = add(host, h('div', 'stage'));
    var boardPane = add(stage, h('div', 'board-pane'));
    var side = add(stage, h('div', 'narrative'));
    var report = add(side, h('div', 'step-text'));
    report.setAttribute('aria-live', 'polite');
    var nav = add(side, h('div', 'step-nav'));

    var board, givens, digit, links, adj, colors, done, comp;

    /** The connected network reachable from `start` — coloring works one at a time. */
    function componentOf(start) {
      var seen = {}, queue = [start], out = [];
      seen[start] = 1;
      while (queue.length) {
        var cur = queue.shift();
        out.push(cur);
        (adj[cur] || []).forEach(function (n) {
          if (!seen[n]) { seen[n] = 1; queue.push(n); }
        });
      }
      return out;
    }

    function draw(msg) {
      var cellClass = {};
      Object.keys(colors).forEach(function (c) { cellClass[c] = colors[c] === 0 ? 'a' : 'b'; });
      var shown = comp || Object.keys(adj).map(Number);
      bv.render({
        board: board, givens: givens, solo: digit,
        links: links.filter(function (l) {
          return !comp || (comp.indexOf(l.a) >= 0 && comp.indexOf(l.b) >= 0);
        }).map(function (l) {
          return { a: l.a, b: l.b, digit: digit, kind: 'strong' };
        }),
        focus: shown, dim: true, cellClass: cellClass
      });
      if (msg) report.innerHTML = msg;
    }

    var bv = new BoardView(boardPane, {
      label: 'Coloring practice grid',
      onCell: function (cell) { paint(cell); },
      onCandidate: function (cell, d, ev) { ev.stopPropagation(); paint(cell); }
    });

    function paint(cell) {
      if (done) return;
      if (!adj[cell]) {
        draw('<p>' + S.cellName(cell) + ' has no strong link on the ' + digit +
          ', so it is not part of any network. Pick a cell with a line running from it.</p>');
        return;
      }
      if (colors[cell] !== undefined) {
        draw('<p>' + S.cellName(cell) + ' is already painted.</p>');
        return;
      }
      var painted = Object.keys(colors).map(Number);
      if (!painted.length) {
        colors[cell] = 0;
        comp = componentOf(cell);   // follow this network only; the rest fades away
        draw('<p>Started at <b class="rc">' + S.cellName(cell) + '</b>. The color itself ' +
          'means nothing yet — it is a label, not a claim that it is true.</p>' +
          '<p class="muted">Everything not joined to this cell has faded out: ' + comp.length +
          ' cells form one network. Other networks are separate arguments.</p>');
        return;
      }
      var neighbor = (adj[cell] || []).filter(function (n) { return colors[n] !== undefined; })[0];
      if (neighbor === undefined) {
        draw('<p><b class="rc">' + S.cellName(cell) + '</b> is in the network, but not ' +
          'strong-linked to anything you have painted yet. Work outwards from what you have.</p>');
        return;
      }
      colors[cell] = 1 - colors[neighbor];
      var total = Object.keys(colors).length, size = comp.length;
      var msg = '<p><b class="rc">' + S.cellName(cell) + '</b> is strong-linked to <b class="rc">' +
        S.cellName(neighbor) + '</b>, so it must take the opposite color. ' +
        '<span class="muted">' + total + ' of ' + size + ' painted.</span></p>';
      if (total === size) {
        done = true;
        msg += payoff();
      }
      draw(msg);
    }

    function payoff() {
      var groups = [[], []];
      Object.keys(colors).forEach(function (c) { groups[colors[c]].push(+c); });

      // trap: two cells of one color sharing a house
      for (var g = 0; g < 2; g++) {
        for (var i = 0; i < groups[g].length; i++) {
          for (var j = i + 1; j < groups[g].length; j++) {
            if (S.sees(groups[g][i], groups[g][j])) {
              return '<p><b>Network complete — and one color just contradicted itself.</b> ' +
                '<b class="rc">' + S.cellName(groups[g][i]) + '</b> and <b class="rc">' +
                S.cellName(groups[g][j]) + '</b> share a house but share a color, which ' +
                'would put two ' + digit + 's in one house. So every cell of that color is ' +
                'false, and every cell of the other color <em>is</em> the ' + digit + '.</p>';
            }
          }
        }
      }
      // wrap: an outsider seeing both colors
      var victims = [];
      for (var c2 = 0; c2 < 81; c2++) {
        if (!board.has(c2, digit) || colors[c2] !== undefined) continue;
        if (groups[0].some(function (x) { return S.sees(c2, x); }) &&
            groups[1].some(function (x) { return S.sees(c2, x); })) victims.push(c2);
      }
      if (victims.length) {
        return '<p><b>Network complete.</b> One color is true and the other false — you ' +
          'still do not know which, and you do not need to. Look at ' +
          victims.map(function (v) { return '<b class="rc">' + S.cellName(v) + '</b>'; }).join(', ') +
          ': ' + (victims.length === 1 ? 'it sees' : 'each sees') + ' <em>both</em> colors, ' +
          'so ' + (victims.length === 1 ? 'it' : 'they') + ' cannot hold the ' + digit +
          ' either way.</p>';
      }
      return '<p><b>Network complete</b> — but nothing outside it sees both colors, so this ' +
        'one pays nothing. That happens; try another position.</p>';
    }

    var idx = -1;
    function load() {
      idx++;
      var entry = entries[idx % entries.length];
      var pos = D.positionOf(entry);
      board = pos.board; givens = pos.givens;
      var f = T.findAll(board, 'coloring-wrap')[0] || T.findAll(board, 'coloring-trap')[0];
      digit = f ? f.digits[0] : 1;
      links = T.strongLinks(board, digit);
      adj = {};
      links.forEach(function (l) {
        (adj[l.a] = adj[l.a] || []).push(l.b);
        (adj[l.b] = adj[l.b] || []).push(l.a);
      });
      colors = {}; done = false; comp = null;
      draw('<p>Here is every strong link on the <b class="dig">' + digit + '</b>. ' +
        'Click any cell with a line to start painting.</p>');
    }
    nav.appendChild(btn('Start over', 'btn ghost', function () {
      colors = {}; done = false; comp = null;
      draw('<p>Cleared. Click a cell to start again.</p>');
    }));
    nav.appendChild(btn('New position', 'btn ghost', load));
    load();
  }

  /**
   * The digit-position table. Hidden subsets are hard to see because the evidence is
   * spread across a house rather than sitting in one cell — so this collects it into one
   * place: for a chosen house, every missing digit against every empty cell.
   *
   * Read down a row and you are asking "where can this digit go?", which is the question
   * hidden subsets are phrased in. A digit with one dot is a hidden single. Two digits
   * with dots in the *same two cells* are a hidden pair, and that is visible as two
   * identical rows rather than as something you have to hold in your head.
   */
  function positionTable(host) {
    var entries = D.entriesFor('hidden-pair');
    if (!entries.length) return;

    add(host, h('p', 'prose', 'Pick a house — tap any cell in the grid, and use the toggle ' +
      'to look at its box, row or column. The table shows where each missing digit can ' +
      'still go. Two digits whose dots land in the <b>same two cells</b> are a hidden pair.'));

    var stage = add(host, h('div', 'stage'));
    var boardPane = add(stage, h('div', 'board-pane'));
    var side = add(stage, h('div', 'narrative'));

    var board, givens, houseType = 'box', houseIdx = null, chosen = [];

    var bv = new BoardView(boardPane, {
      label: 'House-inspection grid',
      onCell: function (cell) { pick(cell); },
      onCandidate: function (cell, d, ev) { ev.stopPropagation(); pick(cell); }
    });

    var typeRow = add(boardPane, h('div', 'controls'));
    ['box', 'row', 'col'].forEach(function (t) {
      var b = btn(t === 'col' ? 'column' : t, 'btn small', function () {
        houseType = t; chosen = []; syncType(); draw();
      });
      b.dataset.type = t;
      typeRow.appendChild(b);
    });
    function syncType() {
      Array.prototype.forEach.call(typeRow.children, function (b) {
        var on = b.dataset.type === houseType;
        b.className = 'btn small' + (on ? ' active' : '');
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }

    var tableHost = add(side, h('div', 'pos-table'));
    var report = add(side, h('div', 'step-text'));
    report.setAttribute('aria-live', 'polite');
    var nav = add(side, h('div', 'step-nav'));

    function pick(cell) {
      houseIdx = houseType === 'box' ? 18 + S.boxOf(cell)
        : houseType === 'row' ? S.rowOf(cell) : 9 + S.colOf(cell);
      chosen = [];
      draw();
    }

    function draw() {
      syncType();
      clear(tableHost);
      if (houseIdx === null) {
        report.innerHTML = '<p>Tap a cell to inspect the house it belongs to.</p>';
        bv.render({ board: board, givens: givens });
        return;
      }
      var cells = board.emptyCells(houseIdx);
      var missing = [];
      for (var d = 1; d <= 9; d++) {
        var spots = board.cellsFor(houseIdx, d);
        if (spots.length) missing.push({ digit: d, spots: spots });
      }

      var table = add(tableHost, h('table', 'ptable'));
      var head = add(add(table, h('thead')), h('tr'));
      add(head, h('th', 'corner', ''));
      cells.forEach(function (c) {
        add(head, h('th', null, S.cellName(c).replace(/^r(\d)c(\d)$/, '$1·$2')));
      });
      var body = add(table, h('tbody'));
      missing.forEach(function (row) {
        var tr = add(body, h('tr', 'digit-row' +
          (row.spots.length === 2 ? ' twospot' : '') +
          (chosen.indexOf(row.digit) >= 0 ? ' chosen' : '') +
          (row.spots.length === 1 ? ' single' : '')));
        var th = add(tr, h('th', 'digit-cell', String(row.digit)));
        if (row.spots.length === 2) {
          th.style.cursor = 'pointer';
          th.setAttribute('role', 'button');
          th.setAttribute('tabindex', '0');
          var toggle = function () {
            var at = chosen.indexOf(row.digit);
            if (at >= 0) chosen.splice(at, 1);
            else { chosen.push(row.digit); if (chosen.length > 2) chosen.shift(); }
            draw();
          };
          th.addEventListener('click', toggle);
          th.addEventListener('keydown', function (ev) {
            if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggle(); }
          });
        }
        cells.forEach(function (c) {
          add(tr, h('td', row.spots.indexOf(c) >= 0 ? 'dot' : 'blank',
            row.spots.indexOf(c) >= 0 ? '●' : ''));
        });
      });

      var twos = missing.filter(function (r) { return r.spots.length === 2; });
      var singles = missing.filter(function (r) { return r.spots.length === 1; });
      var cellClass = {}, focus = S.HOUSES[houseIdx].slice();
      var picked = missing.filter(function (r) { return chosen.indexOf(r.digit) >= 0; });
      picked.forEach(function (r) { r.spots.forEach(function (c) { cellClass[c] = 'a'; }); });

      var msg = '<p>' + S.houseName(S.HOUSE_META[houseIdx]) + ': ' + cells.length +
        ' empty cells, ' + missing.length + ' digits still to place. <b>' + twos.length +
        '</b> of them have exactly two homes' + (twos.length ? ' — those are the rows worth ' +
        'comparing' : '') + '.</p>';

      if (singles.length) {
        msg += '<p><b>Before anything else:</b> the ' + singles.map(function (r) {
          return r.digit; }).join(' and ') + ' has only one home here — that is a hidden ' +
          'single, take it first.</p>';
      }

      if (chosen.length === 2) {
        var a = picked[0], b2 = picked[1];
        var same = a.spots.slice().sort().join() === b2.spots.slice().sort().join();
        if (same) {
          var extra = 0;
          a.spots.forEach(function (c) {
            extra += board.candidates(c).filter(function (d2) {
              return d2 !== a.digit && d2 !== b2.digit; }).length;
          });
          msg += '<p><b>Same two cells — that is a hidden pair.</b> The ' + a.digit +
            ' and the ' + b2.digit + ' have nowhere else to go, so between them they fill ' +
            S.cellList(a.spots) + '.' + (extra
              ? ' Everything else in those two cells goes: ' + extra + ' candidate' +
                (extra === 1 ? '' : 's') + ' struck.'
              : ' Those cells hold nothing else, so it clears nothing here.') + '</p>';
          a.spots.forEach(function (c) { cellClass[c] = 'pivot'; });
        } else {
          msg += '<p><b>Different cells.</b> The ' + a.digit + ' can go in ' +
            S.cellList(a.spots) + ', the ' + b2.digit + ' in ' + S.cellList(b2.spots) +
            '. Not a pair — try another two rows.</p>';
        }
      } else if (twos.length >= 2) {
        msg += '<p>Click two of the highlighted digits to compare them.</p>';
      }
      report.innerHTML = msg;

      bv.render({
        board: board, givens: givens, focus: focus, dim: true,
        houses: [{ house: houseIdx, kind: 'base' }], cellClass: cellClass,
        solo: picked.length ? picked.map(function (r) { return r.digit; }) : null
      });
    }

    var idx = -1;
    function load() {
      idx++;
      var pos = D.positionOf(entries[idx % entries.length]);
      board = pos.board; givens = pos.givens;
      var f = T.findAll(board, 'hidden-pair')[0];
      houseIdx = f ? f.houses[0] : null;
      houseType = f ? S.HOUSE_META[f.houses[0]].type : 'box';
      chosen = [];
      draw();
    }
    nav.appendChild(btn('New position', 'btn ghost', load));
    load();
  }

  /**
   * Watch a solve. The lessons show one technique on a position chosen to suit it, which
   * quietly hides two things: how much looking each move costs, and how rarely the exotic
   * techniques are the answer. This plays a whole puzzle out move by move, and for every
   * move shows the ladder of techniques that were tried and rejected first, measured in
   * candidate configurations actually examined.
   */
  function watchPage() {
    var page = h('article', 'page');
    var head = add(page, h('header', 'page-head'));
    add(head, h('div', 'eyebrow', 'Watch'));
    add(head, h('h1', null, 'A whole puzzle, move by move'));
    add(head, h('p', 'tagline', 'Each move tries the easy techniques first and mostly fails. ' +
      'The failed attempts are shown here alongside the one that worked.'));

    // technique -> the lesson that teaches it
    var lessonFor = {};
    L.LESSONS.forEach(function (l) { if (l.technique) lessonFor[l.technique] = l.id; });

    // hard puzzles: the ones the bank needed its most advanced techniques to crack
    var pool = [];
    ['x-chain', 'xy-chain', 'coloring-trap', 'finned-x-wing', 'swordfish', 'remote-pairs']
      .forEach(function (t) {
        D.entriesFor(t).forEach(function (e) {
          if (pool.indexOf(e.puzzle) < 0) pool.push(e.puzzle);
        });
      });
    if (!pool.length) return page;

    var stage = add(page, h('section', 'stage'));
    var boardPane = add(stage, h('div', 'board-pane'));
    var side = add(stage, h('div', 'narrative'));

    var state = {
      puzzleIdx: 0, board: null, givens: [], move: 0, finding: null,
      steps: [], stepIdx: 0, ladder: [], totalWork: 0, moves: [], playing: false, timer: null,
      phase: 'setup', setupStep: 0, upkeep: 0, fillCost: 0
    };

    var bv = new BoardView(boardPane, { label: 'Solve in progress' });
    var controls = add(boardPane, h('div', 'controls'));
    emphasisButton(controls);

    var status = add(side, h('div', 'watch-status'));
    var narr = add(side, h('div', 'step-text'));
    narr.setAttribute('aria-live', 'polite');
    var nav = add(side, h('div', 'step-nav'));
    var ladderHost = add(side, h('div', 'ladder'));

    function findNext() {
      state.ladder = [];
      var chosen = null;
      for (var i = 0; i < T.REGISTRY.length && !chosen; i++) {
        var entry = T.REGISTRY[i];
        var m = T.measure(function () { return entry.run(state.board); });
        state.totalWork += m.work;
        state.ladder.push({ id: entry.id, work: m.work, hits: m.result.length });
        if (m.result.length) chosen = m.result[0];
      }
      state.finding = chosen;
      state.steps = chosen ? L.scriptFor(chosen) : [];
      state.stepIdx = 0;
      if (chosen) state.moves.push({ id: chosen.technique, work: state.ladder.reduce(
        function (a, r) { return a + r.work; }, 0) });
      draw();
    }

    function applyAndAdvance() {
      if (!state.finding) return;
      // Playing a move is not free either: a placement means visiting all 20 peers to
      // rub the digit out; an elimination means striking the marks it named.
      var placements = (state.finding.placements || []).length;
      state.upkeep += placements * 20 +
        (placements ? 0 : state.finding.eliminations.length);
      T.applyFinding(state.board, state.finding);
      state.move++;
      if (state.board.isSolved()) {
        state.finding = null; state.steps = []; stopPlay(); draw();
        return;
      }
      findNext();
    }

    function stopPlay() {
      state.playing = false;
      if (state.timer) { clearInterval(state.timer); state.timer = null; }
    }

    function draw() {
      clear(nav);
      var solved = state.board.isSolved();
      var left = state.board.unsolvedCount();

      status.innerHTML = '<b>' + (state.phase === 'setup' ? 'Before move 1' :
        'Move ' + (state.move + (solved ? 0 : 1))) + '</b> · ' +
        left + ' cells left · <span class="muted">' +
        state.totalWork.toLocaleString() + ' checks searching · ' +
        (state.fillCost + state.upkeep).toLocaleString() + ' keeping the marks</span>';

      if (state.phase === 'setup') {
        clear(ladderHost);
        var bare = state.setupStep === 0;
        narr.innerHTML = bare
          ? '<div class="eyebrow">Step zero</div>' +
            '<p>Nothing has been searched yet, because there is nothing to search. A grid ' +
            'arrives like this — clues only.</p>' +
            '<p>Every technique on this site is phrased in terms of <b>candidates</b>, so ' +
            'before any of them can run, the pencil marks have to exist.</p>'
          : '<div class="eyebrow">Step zero</div>' +
            '<p>There they are. Working them out meant taking each of the <b>' + left +
            '</b> empty cells and checking it against all <b>20</b> of its peers: <b>' +
            state.fillCost.toLocaleString() + '</b> checks, before a single technique ran.</p>' +
            '<p class="muted">This site fills them for you and the cost is invisible. By ' +
            'hand it is the longest single job in the puzzle — and it is why solvers who ' +
            'scan instead of marking up are often faster on easy grids.</p>';
        bv.render({ board: state.board, givens: state.givens, hideCandidates: bare });
        if (bare) {
          nav.appendChild(btn('Fill the pencil marks', 'btn primary', function () {
            state.setupStep = 1; draw();
          }));
        } else {
          nav.appendChild(btn('Now start searching →', 'btn primary', function () {
            state.phase = 'solving'; findNext();
          }));
        }
        nav.appendChild(btn('Another puzzle', 'btn ghost', nextPuzzle));
        return;
      }

      if (solved) {
        narr.innerHTML = '<p><b>Solved</b> in ' + state.move + ' moves, ' +
          state.totalWork.toLocaleString() + ' candidate checks.</p>' + tally();
        bv.render({ board: state.board, givens: state.givens });
        nav.appendChild(btn('Another puzzle', 'btn', nextPuzzle));
        clear(ladderHost);
        return;
      }
      if (!state.finding) {
        narr.innerHTML = '<p>Nothing in the repertoire fits this position — it needs ' +
          'something past the frontier page.</p>' + tally();
        bv.render({ board: state.board, givens: state.givens });
        nav.appendChild(btn('Another puzzle', 'btn', nextPuzzle));
        return;
      }

      var st = state.steps[state.stepIdx] || { text: '', view: {} };
      var pretty = D.prettyName(state.finding.technique);
      var lid = lessonFor[state.finding.technique];
      narr.innerHTML = '<div class="eyebrow">' + pretty +
        (lid ? ' <a class="teach-link" href="#/lesson/' + lid + '">learn this →</a>' : '') +
        '</div><span class="step-n">' + (state.stepIdx + 1) + '/' + state.steps.length +
        '</span>' + st.text;

      var back = btn('Back', 'btn ghost', function () {
        if (state.stepIdx > 0) { state.stepIdx--; draw(); }
      });
      back.disabled = state.stepIdx === 0;
      nav.appendChild(back);
      if (state.stepIdx < state.steps.length - 1) {
        nav.appendChild(btn('Next', 'btn', function () { state.stepIdx++; draw(); }));
      } else {
        nav.appendChild(btn('Play it & find the next move', 'btn primary', applyAndAdvance));
      }
      nav.appendChild(btn(state.playing ? 'Pause' : 'Autoplay', 'btn ghost', function () {
        if (state.playing) { stopPlay(); draw(); return; }
        state.playing = true;
        state.timer = setInterval(function () {
          if (!page.isConnected) { stopPlay(); return; }
          if (state.stepIdx < state.steps.length - 1) { state.stepIdx++; draw(); }
          else applyAndAdvance();
        }, 1400);
        draw();
      }));
      // A hard puzzle still opens with a run of singles. Watching thirty of those teaches
      // nothing, but hiding them would misrepresent what solving is — so offer to play
      // them and say how many there were.
      var easy = state.finding && T.detector(state.finding.technique) &&
        T.detector(state.finding.technique).rank <= 2;
      if (easy) {
        nav.appendChild(btn('Play all the easy ones', 'btn ghost', function () {
          var n = 0, guard = 0;
          while (guard++ < 200) {
            var f = T.nextStep(state.board, 2);
            if (!f || !T.applyFinding(state.board, f)) break;
            state.moves.push({ id: f.technique, work: 0 });
            state.upkeep += (f.placements || []).length * 20;
            state.move++; n++;
            if (state.board.isSolved()) break;
          }
          state.skipped = n;
          if (state.board.isSolved()) { state.finding = null; draw(); } else findNext();
        }));
      }
      nav.appendChild(btn('Restart', 'btn ghost', function () { load(state.puzzleIdx); }));

      var v = {};
      Object.keys(st.view).forEach(function (k) { v[k] = st.view[k]; });
      v.board = state.board; v.givens = state.givens;
      bv.render(v);

      drawLadder();
    }

    function drawLadder() {
      clear(ladderHost);
      add(ladderHost, h('h3', null, 'What it had to look at for this move'));
      var max = state.ladder.reduce(function (a, r) { return Math.max(a, r.work); }, 1);
      state.ladder.forEach(function (r) {
        var row = add(ladderHost, h('div', 'ladder-row' + (r.hits ? ' hit' : '')));
        add(row, h('span', 'ladder-name', D.prettyName(r.id)));
        var bar = add(row, h('span', 'ladder-bar'));
        var i = add(bar, h('i'));
        i.style.width = Math.max(2, Math.round(100 * r.work / max)) + '%';
        add(row, h('span', 'ladder-n', String(r.work)));
        add(row, h('span', 'ladder-mark', r.hits ? '✓' : '·'));
      });
      var total = state.ladder.reduce(function (a, r) { return a + r.work; }, 0);
      add(ladderHost, h('p', 'muted', total.toLocaleString() + ' checks for this one move. ' +
        'Everything above the ✓ was tried and found nothing — that is the part you do not ' +
        'see when a solver just announces the answer.'));
      add(ladderHost, h('p', 'muted', 'Running totals: <b>' +
        state.totalWork.toLocaleString() + '</b> checks searching, <b>' +
        (state.fillCost + state.upkeep).toLocaleString() + '</b> keeping the pencil marks ' +
        'up to date (' + state.fillCost.toLocaleString() + ' of that was the initial fill).'));
      if (state.skipped) {
        add(ladderHost, h('p', 'muted', 'Played ' + state.skipped + ' singles in one go to ' +
          'get here.'));
      }
      if (state.moves.length) add(ladderHost, h('div', 'run-tally', tally()));
    }

    function tally() {
      var byTech = {};
      state.moves.forEach(function (m) { byTech[m.id] = (byTech[m.id] || 0) + 1; });
      var rows = Object.keys(byTech).sort(function (a, b) { return byTech[b] - byTech[a]; });
      return '<p class="muted">Moves used: ' + rows.map(function (k) {
        return D.prettyName(k) + ' &times;' + byTech[k];
      }).join(', ') + '.</p>';
    }

    function load(i) {
      stopPlay();
      state.puzzleIdx = i;
      var b = S.Board.fromString(pool[i % pool.length]);
      state.board = b;
      state.givens = b.values.map(Boolean);
      state.move = 0; state.totalWork = 0; state.moves = []; state.skipped = 0;
      state.phase = 'setup'; state.setupStep = 0; state.upkeep = 0;
      state.fillCost = b.unsolvedCount() * 20;
      draw();
    }
    function nextPuzzle() { load(state.puzzleIdx + 1); }

    add(page, h('p', 'muted footnote', 'Puzzle ' + 1 + ' of ' + pool.length +
      ' in the bank that needed the site\'s harder techniques.'));
    load(0);
    return page;
  }

  // -------------------------------------------------------- mixed drill page

  function mixedPage() {
    var page = h('article', 'page');
    var head = add(page, h('header', 'page-head'));
    add(head, h('div', 'eyebrow', 'Practice'));
    add(head, h('h1', null, 'Mixed drill'));
    add(head, h('p', 'tagline', 'Recognizing a technique you were told to look for is easy. ' +
      'Choosing it is the actual skill.'));
    add(page, h('div', 'prose', '<p>Each position below has at least one deduction ' +
      'available. Say which technique finds it — the answer is always the <em>simplest</em> ' +
      'one that works, because that is the move you should actually play.</p>'));

    // Only ask about techniques the learner has actually finished, unless they opt in to
    // the full set. Being quizzed on a lesson you have not opened is not interleaving.
    var learned = L.LESSONS.filter(function (l) { return loadProgress()[l.id] && l.technique; })
      .map(function (l) { return l.technique; });
    var scopeAll = learned.length < 2;   // one technique is not a quiz

    var scopeRow = add(page, h('div', 'controls'));
    var scopeBtn = btn('', 'btn small', function () {
      scopeAll = !scopeAll;
      round();
    });
    scopeRow.appendChild(scopeBtn);
    var scopeNote = add(scopeRow, h('span', 'hint-text'));

    var body = add(page, h('section', 'card'));
    var n = Math.floor(Math.random() * 1000);
    function round() {
      scopeBtn.textContent = scopeAll ? 'Only what I have finished' : 'Include everything';
      scopeNote.innerHTML = scopeAll
        ? 'Drawing on every technique on the site.'
        : 'Drawing on the ' + learned.length + ' ' +
          (learned.length === 1 ? 'technique' : 'techniques') + ' you have finished.';
      clear(body);
      var q = D.makeMixed(n++, scopeAll ? null : learned);
      if (!q) { add(body, h('p', null, 'No puzzle bank available.')); return; }
      var stage = add(body, h('div', 'stage'));
      var boardPane = add(stage, h('div', 'board-pane'));
      var side = add(stage, h('div', 'narrative'));
      var bv = new BoardView(boardPane, {});
      bv.render({ board: q.board, givens: q.givens });

      add(side, h('div', 'prompt', 'Which technique applies here?'));
      var opts = add(side, h('div', 'options'));
      var feedback = add(side, h('div', 'feedback'));
      feedback.setAttribute('role', 'status');
      q.options.forEach(function (o) {
        opts.appendChild(btn(D.prettyName(o), 'btn option', function () {
          if (o === q.answer) {
            feedback.className = 'feedback good';
            feedback.innerHTML = 'Yes — ' + D.prettyName(q.answer) + '. ' +
              (q.finding ? L.helpers.elimSummary(q.finding) : '');
            if (q.finding) {
              bv.render({
                board: q.board, givens: q.givens, focus: q.finding.cells, dim: true,
                links: q.finding.links, solo: q.finding.digits.length === 1 ? q.finding.digits[0] : null,
                marks: q.finding.eliminations.map(function (e) {
                  return { cell: e.cell, digit: e.digit, kind: 'elim' };
                })
              });
            }
            Array.prototype.forEach.call(opts.children, function (b) { b.disabled = true; });
          } else {
            feedback.className = 'feedback bad';
            feedback.innerHTML = 'Not ' + D.prettyName(o) + ' — or at least, not the ' +
              'simplest thing available. Look again.';
          }
        }));
      });
      add(side, h('div', 'step-nav')).appendChild(btn('Next position', 'btn ghost', round));
    }
    round();
    return page;
  }

  // --------------------------------------------------------- playground

  function playPage() {
    var page = h('article', 'page');
    var head = add(page, h('header', 'page-head'));
    add(head, h('div', 'eyebrow', 'Playground'));
    add(head, h('h1', null, 'Solve, and ask why'));
    add(head, h('p', 'tagline', 'A grid with the whole solver behind it. Get stuck, ' +
      'press Explain, and see which technique applies and why.'));

    var stage = add(page, h('section', 'stage'));
    var boardPane = add(stage, h('div', 'board-pane'));
    var side = add(stage, h('div', 'narrative'));

    var state = { board: null, givens: [], sel: null, steps: null, stepIdx: 0, finding: null };

    var pad;

    /** Digit-first when a pad digit is armed, cell-first otherwise. */
    function tapCell(cell) {
      if (pad && pad.active && !state.givens[cell]) {
        if (state.board.values[cell] === pad.active) {
          state.board.values[cell] = 0;
          state.board.recomputeCandidates();
        } else {
          state.board.place(cell, pad.active);
        }
        state.steps = null;
        draw();
        return;
      }
      state.sel = cell;
      state.steps = null;
      draw();
    }

    var bv = new BoardView(boardPane, {
      label: 'Playground grid',
      onCell: tapCell,
      onCandidate: function (cell, digit, ev) {
        ev.stopPropagation();
        if (ev.shiftKey) { state.board.eliminate(cell, digit); state.steps = null; draw(); }
        else tapCell(cell);
      },
      onDigitKey: function (cell, digit) {
        if (state.givens[cell]) return;
        state.board.place(cell, digit);
        state.sel = cell;
        state.steps = null;
        draw();
      },
      onDelete: function (cell) {
        if (state.givens[cell]) return;
        state.board.values[cell] = 0;
        state.board.recomputeCandidates();
        state.steps = null;
        draw();
      }
    });

    pad = digitPad(boardPane, {
      label: 'Tap a digit, then tap cells (or select a cell and type):'
    });
    pad.el.appendChild(btn('⌫', 'btn digit', function () {
      if (state.sel !== null && !state.givens[state.sel]) {
        state.board.values[state.sel] = 0;
        state.board.recomputeCandidates();
        state.steps = null;
        draw();
      }
    }));

    var controls = add(boardPane, h('div', 'controls'));
    controls.appendChild(btn('Random puzzle', 'btn small', function () { loadRandom(); }));
    controls.appendChild(btn('Explain next step', 'btn small primary', function () { explain(); }));
    controls.appendChild(btn('Apply it', 'btn small', function () {
      if (state.finding) {
        T.applyFinding(state.board, state.finding);
        state.steps = null; state.finding = null;
        draw();
      }
    }));
    controls.appendChild(btn('Undo all', 'btn small ghost', function () { reset(); }));
    emphasisButton(controls);

    var pasteRow = add(boardPane, h('div', 'controls'));
    var input = h('input', 'paste');
    input.placeholder = 'paste an 81-character puzzle string';
    pasteRow.appendChild(input);
    pasteRow.appendChild(btn('Load', 'btn small', function () {
      try {
        var b = S.Board.fromString(input.value);
        if (S.solve(b, 2).count !== 1) {
          info.innerHTML = '<p class="verdict bad">That grid does not have exactly one ' +
            'solution.</p>';
          return;
        }
        state.board = b; state.original = b.clone();
        state.givens = b.values.map(Boolean);
        state.steps = null; draw();
      } catch (e) {
        info.innerHTML = '<p class="verdict bad">' + e.message + '</p>';
      }
    }));

    var info = add(side, h('div', 'step-text'));
    info.setAttribute('aria-live', 'polite');
    var navRow = add(side, h('div', 'step-nav'));

    function loadRandom() {
      var keys = Object.keys(window.PuzzleBank || {});
      var pool = [];
      keys.forEach(function (k) { window.PuzzleBank[k].forEach(function (e) { pool.push(e); }); });
      if (!pool.length) return;
      var e = pool[Math.floor(Math.random() * pool.length)];
      var b = S.Board.fromString(e.puzzle);
      state.original = b.clone();
      state.board = b;
      state.givens = b.values.map(Boolean);
      state.steps = null; state.finding = null;
      draw();
    }

    function reset() {
      if (state.original) { state.board = state.original.clone(); state.steps = null; state.finding = null; draw(); }
    }

    function explain() {
      // Uniqueness techniques are only sound on a grid with exactly one solution. The
      // loaded puzzle has one; a grid the user has typed into might not, so check before
      // offering a deduction that leans on it.
      var solutions = S.solve(state.board, 2).count;
      if (solutions === 0) {
        info.innerHTML = '<p class="verdict bad"><b>This grid has no solution.</b> ' +
          'Something placed so far is wrong — undo back to a position that works.</p>';
        state.finding = null;
        bv.render({ board: state.board, givens: state.givens, sel: state.sel });
        return;
      }
      var f = T.nextStep(state.board, null, { noUniqueness: solutions !== 1 });
      if (!f && solutions !== 1) {
        info.innerHTML = '<p class="verdict"><b>This grid now has more than one ' +
          'solution</b>, so the uniqueness techniques (unique rectangles, BUG+1) do not ' +
          'apply — they assume exactly one. Nothing else in the repertoire fits either.</p>';
        state.finding = null;
        bv.render({ board: state.board, givens: state.givens, sel: state.sel });
        return;
      }
      if (!f) {
        info.innerHTML = state.board.isSolved()
          ? '<p class="verdict good">Solved.</p>'
          : '<p class="verdict">Nothing in the site\'s repertoire applies here. That means ' +
            'either an error crept into the grid, or the puzzle needs something past ' +
            'the frontier page.</p>';
        state.finding = null;
        draw();
        return;
      }
      state.finding = f;
      state.steps = L.scriptFor(f);
      state.stepIdx = 0;
      draw();
    }

    function draw() {
      clear(navRow);
      if (!state.board) {
        info.innerHTML = '<p>Load a random puzzle, or paste one in.</p>';
        return;
      }
      if (state.steps) {
        var st = state.steps[state.stepIdx];
        info.innerHTML = '<div class="eyebrow">' + D.prettyName(state.finding.technique) +
          '</div><span class="step-n">' + (state.stepIdx + 1) + '/' + state.steps.length +
          '</span>' + st.text;
        navRow.appendChild(btn('Back', 'btn ghost', function () {
          if (state.stepIdx > 0) { state.stepIdx--; draw(); }
        })).disabled = state.stepIdx === 0;
        navRow.appendChild(btn('Next', 'btn', function () {
          if (state.stepIdx < state.steps.length - 1) { state.stepIdx++; draw(); }
        })).disabled = state.stepIdx === state.steps.length - 1;

        var v = {};
        Object.keys(st.view).forEach(function (k) { v[k] = st.view[k]; });
        v.board = state.board; v.givens = state.givens; v.sel = state.sel;
        bv.render(v);
        return;
      }
      info.innerHTML = '<p>' + state.board.unsolvedCount() + ' cells left.</p>' +
        '<p class="muted">Tap a digit below the grid then tap cells, or select a cell and ' +
        'type. Shift-click a pencil mark to rub it out.</p>' +
        '<p class="muted">Press <b>Explain next step</b> whenever you want to know what ' +
        'the position is hiding.</p>';
      bv.render({ board: state.board, givens: state.givens, sel: state.sel });
    }

    loadRandom();
    return page;
  }

  // ---------------------------------------------------------------- router

  /**
   * There is no front page. A lobby whose only job is a Start button is a page between
   * the reader and the thing they came for, and the sidebar already lists every lesson,
   * so a card grid would only say it twice.
   *
   * "/" resumes: the first lesson you have not finished.
   */
  function resumeLesson() {
    var progress = loadProgress();
    for (var i = 0; i < L.LESSONS.length; i++) {
      if (!progress[L.LESSONS[i].id]) return L.LESSONS[i];
    }
    return L.LESSONS[0];
  }

  function route() {
    var hash = location.hash || '#/';
    // In-page anchors (the skip link) must not be mistaken for routes and re-render.
    if (hash && hash.indexOf('#/') !== 0) return;
    pageCleanup.forEach(function (fn) { fn(); });
    pageCleanup = [];
    Marks.dropLocal();
    var page;
    if (hash.indexOf('#/lesson/') === 0) {
      var parts = hash.slice('#/lesson/'.length).split('/');
      var lesson = L.byId(parts[0]);
      page = lesson ? lessonPage(lesson, +parts[1] || 0) : notFound();
    } else if (hash === '#/mixed') {
      page = mixedPage();
    } else if (hash === '#/play') {
      page = playPage();
    } else if (hash === '#/watch') {
      page = watchPage();
    } else {
      page = lessonPage(resumeLesson(), 0);
    }
    clear(mainEl).appendChild(page);
    buildNav();
    mainEl.scrollTop = 0;
    window.scrollTo(0, 0);
  }

  function notFound() {
    var p = h('article', 'page');
    add(p, h('h1', null, 'Not found'));
    p.appendChild(link('#/', 'Back to the overview'));
    return p;
  }

  document.addEventListener('DOMContentLoaded', function () {
    navEl = document.getElementById('nav');
    mainEl = document.getElementById('main');
    window.addEventListener('hashchange', route);
    var marksBtn = document.getElementById('marks-toggle');
    if (marksBtn) {
      Marks.register(marksBtn, true);
      marksBtn.addEventListener('click', function () { Marks.toggle(); });
    }
    Marks.init();

    var skip = document.querySelector('.skip-to-content');
    if (skip) skip.addEventListener('click', function (ev) {
      ev.preventDefault();
      mainEl.focus();
      mainEl.scrollIntoView();
    });
    var toggle = document.getElementById('nav-toggle');
    if (toggle) toggle.addEventListener('click', function () {
      var open = document.body.classList.toggle('nav-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    navEl.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') document.body.classList.remove('nav-open');
    });
    route();

    // Glossary last: it watches #main for added nodes, so it wants the first page already
    // in place. It needs the lesson titles to label its "read the lesson" links, which
    // keeps the lesson names in one file rather than duplicated into the term list.
    if (G) {
      var titles = {};
      L.LESSONS.forEach(function (l) { titles[l.id] = l.title; });
      G.install(mainEl, titles);
    }
  });
})();
