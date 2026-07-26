/* board.js — the grid renderer.
 *
 * One visual language, reused by every lesson (plan principle C4): the same tint always
 * means "pattern cell", the same red strike always means "eliminated", strong links are
 * always solid lines and weak links always dashed. A learner who has seen one chain
 * lesson can read the next one without relearning the picture.
 *
 * Rendering is: build the DOM once, then mutate classes. Links are drawn on an SVG
 * overlay anchored to individual candidate positions, not cell centers, so a line about
 * the 5s visibly starts at a 5.
 */
(function (root, factory) {
  var S = (typeof require === 'function' && typeof module === 'object')
    ? require('./sudoku.js') : root.Sudoku;
  var mod = factory(S);
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.BoardView = mod;
})(typeof self !== 'undefined' ? self : this, function (S) {
  'use strict';

  var SVGNS = 'http://www.w3.org/2000/svg';
  var CELL = 100;

  function el(tag, cls, parent) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }

  function svg(tag, parent) {
    var e = document.createElementNS(SVGNS, tag);
    if (parent) parent.appendChild(e);
    return e;
  }

  /** Center of candidate `d` inside cell `i`, in SVG units. */
  function anchor(i, d) {
    var x = S.colOf(i) * CELL, y = S.rowOf(i) * CELL;
    if (!d) return { x: x + CELL / 2, y: y + CELL / 2 };
    var sub = d - 1;
    return {
      x: x + ((sub % 3) + 0.5) * (CELL / 3),
      y: y + (((sub / 3) | 0) + 0.5) * (CELL / 3)
    };
  }

  function BoardView(container, opts) {
    this.opts = opts || {};
    this.root = el('div', 'board', container);
    this.cells = [];
    this.candEls = [];
    var self = this;

    /* Coordinate rulers. Every instruction on this site names cells as "r7c5" and the grid
     * used to give the reader nothing to count against, so following along meant counting
     * squares with a finger. They are aria-hidden: the ARIA grid already reports row and
     * column indices, so reading them out again would just double every cell's label.
     *
     * The grid and its link overlay live together in .board-plot, which is what the rulers
     * are aligned to — the overlay is inset:0 on its container, so hanging the rulers
     * inside it would have shifted every link line off its candidate. */
    el('div', 'ruler-corner', this.root).setAttribute('aria-hidden', 'true');
    var cols = el('div', 'ruler ruler-cols', this.root);
    cols.setAttribute('aria-hidden', 'true');
    var rows = el('div', 'ruler ruler-rows', this.root);
    rows.setAttribute('aria-hidden', 'true');
    for (var n = 1; n <= 9; n++) {
      el('span', null, cols).textContent = String(n);
      el('span', null, rows).textContent = String(n);
    }
    var plot = el('div', 'board-plot', this.root);

    // role=grid needs real rows; `display: contents` keeps the 9x9 CSS grid layout intact
    // while giving assistive technology the row/cell structure it expects.
    var grid = el('div', 'board-grid', plot);
    grid.setAttribute('role', 'grid');
    grid.setAttribute('aria-label', this.opts.label || 'Sudoku grid');
    grid.setAttribute('aria-rowcount', '9');
    grid.setAttribute('aria-colcount', '9');

    for (var r = 0; r < 9; r++) {
      var rowEl = el('div', 'board-row', grid);
      rowEl.setAttribute('role', 'row');
      rowEl.setAttribute('aria-rowindex', String(r + 1));
      for (var col = 0; col < 9; col++) {
        var i = r * 9 + col;
        var c = el('div', 'cell', rowEl);
        c.dataset.cell = String(i);
        c.setAttribute('role', 'gridcell');
        c.setAttribute('aria-colindex', String(col + 1));
        c.setAttribute('tabindex', i === 0 ? '0' : '-1');
        if (S.colOf(i) % 3 === 2 && S.colOf(i) !== 8) c.classList.add('edge-right');
        if (S.rowOf(i) % 3 === 2 && S.rowOf(i) !== 8) c.classList.add('edge-bottom');

        var val = el('div', 'value', c);
        var cands = el('div', 'cands', c);
        var row = [];
        for (var d = 1; d <= 9; d++) {
          var ce = el('div', 'cand', cands);
          ce.textContent = String(d);
          ce.dataset.cell = String(i);
          ce.dataset.digit = String(d);
          row.push(ce);
        }
        this.cells.push({ el: c, value: val, cands: cands });
        this.candEls.push(row);
      }
    }
    this.grid = grid;
    this.active = 0;
    this.lastView = null;

    this.svg = svg('svg', plot);
    this.svg.setAttribute('class', 'board-overlay');
    this.svg.setAttribute('viewBox', '0 0 900 900');
    this.svg.setAttribute('preserveAspectRatio', 'none');
    var defs = svg('defs', this.svg);
    ['link-strong', 'link-weak'].forEach(function (kind) {
      var m = svg('marker', defs);
      m.setAttribute('id', 'dot-' + kind);
      m.setAttribute('viewBox', '0 0 10 10');
      m.setAttribute('refX', '5'); m.setAttribute('refY', '5');
      m.setAttribute('markerWidth', '4'); m.setAttribute('markerHeight', '4');
      var circ = svg('circle', m);
      circ.setAttribute('cx', '5'); circ.setAttribute('cy', '5'); circ.setAttribute('r', '4');
      circ.setAttribute('class', 'marker ' + kind);
    });
    this.linkLayer = svg('g', this.svg);

    grid.addEventListener('click', function (ev) {
      var candEl = ev.target.closest ? ev.target.closest('.cand') : null;
      if (candEl && self.opts.onCandidate && !candEl.classList.contains('off')) {
        self.focusCell(+candEl.dataset.cell);
        self.opts.onCandidate(+candEl.dataset.cell, +candEl.dataset.digit, ev);
        return;
      }
      var cellEl = ev.target.closest ? ev.target.closest('.cell') : null;
      if (cellEl) {
        self.focusCell(+cellEl.dataset.cell);
        if (self.opts.onCell) self.opts.onCell(+cellEl.dataset.cell, ev);
      }
    });

    grid.addEventListener('focusin', function (ev) {
      var cellEl = ev.target.closest ? ev.target.closest('.cell') : null;
      if (cellEl) self.setActive(+cellEl.dataset.cell);
    });

    // Keyboard: arrows move, Enter/Space activates, a digit acts on the focused cell.
    // Without this the whole site is mouse-only, which rules out every drill.
    grid.addEventListener('keydown', function (ev) {
      var i = self.active;
      var r = S.rowOf(i), c = S.colOf(i), handled = true;
      switch (ev.key) {
        case 'ArrowUp': r = (r + 8) % 9; break;
        case 'ArrowDown': r = (r + 1) % 9; break;
        case 'ArrowLeft': c = (c + 8) % 9; break;
        case 'ArrowRight': c = (c + 1) % 9; break;
        case 'Home': c = 0; break;
        case 'End': c = 8; break;
        case 'PageUp': r = 0; break;
        case 'PageDown': r = 8; break;
        case 'Enter':
        case ' ':
          if (self.opts.onCell) self.opts.onCell(i, ev);
          ev.preventDefault();
          return;
        case 'Backspace':
        case 'Delete':
          if (self.opts.onDelete) self.opts.onDelete(i, ev);
          ev.preventDefault();
          return;
        default:
          if (ev.key >= '1' && ev.key <= '9') {
            if (self.opts.onDigitKey) { self.opts.onDigitKey(i, +ev.key, ev); ev.preventDefault(); }
            return;
          }
          handled = false;
      }
      if (!handled) return;
      ev.preventDefault();
      self.focusCell(S.cellAt(r, c));
    });
  }

  /** Move the roving tabindex without stealing focus. */
  BoardView.prototype.setActive = function (i) {
    if (this.active === i) return;
    this.cells[this.active].el.setAttribute('tabindex', '-1');
    this.active = i;
    this.cells[i].el.setAttribute('tabindex', '0');
  };

  BoardView.prototype.focusCell = function (i) {
    this.setActive(i);
    this.cells[i].el.focus();
  };

  /** What a screen reader hears for one cell. */
  function describe(view, i) {
    var board = view.board;
    var parts = [S.cellName(i)];
    if (board.values[i]) {
      parts.push(board.values[i] + (view.givens && view.givens[i] ? ', given' : ''));
    } else {
      var ds = board.candidates(i);
      var only = view.solo && (typeof view.solo === 'number' ? [view.solo] : view.solo);
      var shown = only ? ds.filter(function (d) { return only.indexOf(d) >= 0; }) : ds;
      parts.push(shown.length ? 'candidates ' + shown.join(' ') : 'empty');
    }
    (view.marks || []).forEach(function (m) {
      if (m.cell !== i) return;
      if (m.kind === 'elim') parts.push(m.digit + ' eliminated');
      else if (m.kind === 'true') parts.push(m.digit + ' confirmed');
      else if (m.kind === 'pattern') parts.push(m.digit + ' in pattern');
    });
    if (view.cellClass && view.cellClass[i]) parts.push(SELECTION_WORDS[view.cellClass[i]] || '');
    else if ((view.focus || []).indexOf(i) >= 0) parts.push('highlighted');
    return parts.filter(Boolean).join(', ');
  }

  var SELECTION_WORDS = {
    pick: 'selected', a: 'group A', b: 'group B', pivot: 'pivot',
    trial: 'placed by the trial', dead: 'contradiction',
    // A dashed outline says "tap me" to a sighted reader and nothing at all otherwise.
    tap: 'tap this one'
  };

  /**
   * view = {
   *   board, givens,                       // Board, plus optional given-cell set
   *   solo: digit|null,                    // show only this digit's candidates
   *   hideCandidates: bool,
   *   dim: bool,                           // dim everything not in focus
   *   focus: [cellIndex],                  // the pattern
   *   cellClass: {cell: 'a'|'b'|'pick'},   // coloring, user selection
   *   houses: [{house, kind}],             // tinted bands
   *   marks: [{cell, digit, kind}],        // kind: pattern|elim|gone|true|false|hint
   *   links: [{a, b, digit, kind}],
   *   sel: cellIndex|null
   * }
   */
  BoardView.prototype.render = function (view) {
    var board = view.board;
    var focus = view.focus || [];
    var focusSet = Object.create(null);
    focus.forEach(function (c) { focusSet[c] = 1; });

    // `keep` escapes dimming without taking the amber "this is the pattern" treatment —
    // for cells the narration is reasoning *from* rather than about, like a cell's peers.
    var keepSet = Object.create(null);
    (view.keep || []).forEach(function (c) { keepSet[c] = 1; });

    // house tints render as a class on member cells: no extra layer to keep aligned
    var houseTint = Object.create(null);
    (view.houses || []).forEach(function (h) {
      var idx = typeof h === 'number' ? h : h.house;
      var kind = (typeof h === 'number' ? 'base' : h.kind) || 'base';
      S.HOUSES[idx].forEach(function (c) {
        houseTint[c] = houseTint[c] ? houseTint[c] + ' house-' + kind : 'house-' + kind;
      });
    });

    var markMap = Object.create(null);
    (view.marks || []).forEach(function (m) { markMap[m.cell * 10 + m.digit] = m.kind; });

    // `solo` may be one digit or several. Multi-digit techniques need all of their digits
    // on screen — filtering a naked triple down to one of its three digits hides the
    // pattern being discussed.
    var soloSet = null;
    if (view.solo) soloSet = typeof view.solo === 'number' ? [view.solo] : view.solo.slice();

    for (var i = 0; i < 81; i++) {
      var cell = this.cells[i];
      var cls = ['cell'];
      if (S.colOf(i) % 3 === 2 && S.colOf(i) !== 8) cls.push('edge-right');
      if (S.rowOf(i) % 3 === 2 && S.rowOf(i) !== 8) cls.push('edge-bottom');
      if (houseTint[i]) cls.push(houseTint[i]);
      if (focusSet[i]) cls.push('focus');
      else if (view.dim && !keepSet[i]) cls.push('dimmed');
      if (view.cellClass && view.cellClass[i]) cls.push('tint-' + view.cellClass[i]);
      if (view.sel === i) cls.push('selected');
      if (view.givens && view.givens[i]) cls.push('given');

      var v = board.values[i];
      if (v) {
        cls.push('solved');
        cell.value.textContent = String(v);
      } else {
        cell.value.textContent = '';
        if (!board.cands[i]) cls.push('broken');
      }
      cell.el.className = cls.join(' ');
      cell.el.setAttribute('aria-label', describe(view, i));
      if (view.sel === i) cell.el.setAttribute('aria-selected', 'true');
      else cell.el.removeAttribute('aria-selected');
      if (board.values[i] && view.givens && view.givens[i]) {
        cell.el.setAttribute('aria-readonly', 'true');
      } else {
        cell.el.removeAttribute('aria-readonly');
      }

      for (var d = 1; d <= 9; d++) {
        var ce = this.candEls[i][d - 1];
        var mark = markMap[i * 10 + d];
        var on = !v && board.has(i, d) && !view.hideCandidates &&
                 (!soloSet || soloSet.indexOf(d) >= 0);
        var ccls = ['cand'];
        if (!on && mark !== 'gone') ccls.push('off');
        if (mark) ccls.push('mark-' + mark);
        ce.className = ccls.join(' ');
      }
    }

    // ------------------------------------------------------------- links
    while (this.linkLayer.firstChild) this.linkLayer.removeChild(this.linkLayer.firstChild);
    (view.links || []).forEach(function (l) {
      var a = anchor(l.a, l.digit), b = anchor(l.b, l.digit);
      var line = svg('line', this.linkLayer);
      line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
      line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);
      line.setAttribute('class', 'link link-' + (l.kind || 'strong'));
      line.setAttribute('marker-start', 'url(#dot-link-' + (l.kind || 'strong') + ')');
      line.setAttribute('marker-end', 'url(#dot-link-' + (l.kind || 'strong') + ')');
    }, this);

    // Cross-hatching, drawn the way it is done on paper: a line struck through every
    // row and column that already contains the digit.
    (view.strikes || []).forEach(function (st) {
      var line = svg('line', this.linkLayer);
      var mid = (st.index + 0.5) * CELL;
      if (st.type === 'row') {
        line.setAttribute('x1', 0); line.setAttribute('y1', mid);
        line.setAttribute('x2', 900); line.setAttribute('y2', mid);
      } else {
        line.setAttribute('x1', mid); line.setAttribute('y1', 0);
        line.setAttribute('x2', mid); line.setAttribute('y2', 900);
      }
      line.setAttribute('class', 'strike');
    }, this);

    (view.arrows || []).forEach(function (arrow) {
      var a = anchor(arrow.a, arrow.digit), b = anchor(arrow.b, arrow.digit);
      var line = svg('line', this.linkLayer);
      line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
      line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);
      line.setAttribute('class', 'link link-arrow');
    }, this);
  };

  BoardView.prototype.pulse = function (cells) {
    var self = this;
    cells.forEach(function (c) {
      self.cells[c].el.classList.remove('pulse');
      void self.cells[c].el.offsetWidth;   // restart the animation
      self.cells[c].el.classList.add('pulse');
    });
  };

  BoardView.prototype.destroy = function () {
    if (this.root.parentNode) this.root.parentNode.removeChild(this.root);
  };

  BoardView.anchor = anchor;
  return BoardView;
});
