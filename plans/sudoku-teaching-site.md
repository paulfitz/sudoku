# Teaching Advanced Sudoku: technique landscape, presentation conventions, and a plan for an interactive site

Status: design doc for the static site in `site/`.

---

## 0. The problem

Advanced sudoku technique is taught badly almost everywhere, and it is taught badly
for a specific and interesting reason: **the techniques are about relationships between
cells that are far apart, and prose is a terrible medium for spatial relationships.**

A typical explanation of an X-Wing reads:

> If a candidate appears exactly twice in each of two rows, and in both rows it occupies
> the same two columns, then that candidate can be eliminated from all other cells of
> those two columns.

Every word is true. Almost nobody learns anything from it. The reader has to
simultaneously hold four cell positions, two row constraints, two column constraints,
and a counterfactual ("if this one were the 5, then...") in their head — and the sentence
gives them no help assembling any of it. A static diagram with four circled cells is
better, but it still shows the *conclusion* rather than the *reasoning*, and it shows one
frozen instance rather than the shape of the idea.

What actually works, and what this site is built around:

1. **See the logic move.** The user should be able to click "what if this cell were a 5?"
   and watch the consequence ripple through the grid until it contradicts itself.
2. **Meet the pattern before its name.** Recognition first, vocabulary second.
3. **Reduce the noise.** A 9×9 grid full of 250 pencil marks hides the pattern. Dim
   everything irrelevant; the pattern should be almost the only thing visible.
4. **Make the learner find it.** Reading a worked example produces recognition, not
   recall. Every technique ends with "now you find one", with the grid checking the answer.

---

## Part A — The technique landscape

Ordered roughly by the conceptual jump each one requires, not by difficulty rating.
The grouping matters pedagogically: techniques within a family are variations on one
idea, and teaching them as one idea with variants is far more efficient than teaching
them as eight separate named tricks.

### A1. Singles (the baseline)

- **Naked single** — a cell with one candidate left.
- **Hidden single** — a digit with one possible cell left in a house.

Conceptually trivial, but worth including because the *hidden* single already contains
the key mental flip that everything later depends on: stop asking "what goes in this
cell?" and start asking "where does this digit go in this house?" Learners who never make
that flip plateau permanently. Most sites rush past it.

### A2. Subsets — naked and hidden

- **Naked pair / triple / quadruple** — N cells in a house between them holding only N
  candidates; those candidates are locked into those cells and leave the rest of the house.
- **Hidden pair / triple / quadruple** — N digits in a house confined to only N cells;
  those cells can hold nothing else.

The pedagogical crux: naked and hidden subsets are the *same theorem seen from two sides*.
In a house of 9 cells, a naked triple is exactly a hidden sextuple. Teaching that
duality explicitly makes hidden subsets — which learners find much harder to spot — click.
Also worth teaching: naked triples do **not** require each cell to hold all three
candidates ({1,2}, {2,3}, {1,3} is a triple), which is the single most common
misunderstanding at this level.

### A3. Locked candidates (intersections)

- **Pointing** — a digit confined within a box to one row/column: eliminate from the rest
  of that row/column.
- **Claiming** (a.k.a. box-line reduction) — a digit confined within a row/column to one
  box: eliminate from the rest of that box.

The idea is one idea: *when two houses overlap, a digit trapped in the overlap is
excluded from the non-overlapping parts of both.* Presenting the two as one symmetric
statement, with the intersection highlighted as a distinct region, is much stronger than
two separately-named rules.

### A4. Single-digit fish

Work on one digit at a time; the rest of the grid is irrelevant and should be hidden.

- **X-Wing** — 2 rows × 2 columns.
- **Swordfish** — 3×3. **Jellyfish** — 4×4. (Beyond that, redundant on a 9×9.)
- **Finned / sashimi fish** — an almost-fish with one or two extra cells ("fin"); the
  eliminations survive only where they'd be killed by the fin too.

Crux: a fish is not a shape, it is a **counting argument**. N rows each needing the digit,
all confined to N columns, means those N columns are used up. Learners who memorise the
rectangle shape fail on swordfish (which is often not a neat 3×3 — rows may have only two
of the three columns). The counting framing generalizes; the shape framing does not.

The other crucial framing: fish are **row/column symmetric**. Every X-Wing found in rows
is also findable in columns. Showing the same instance from both directions, with a
toggle, is a strong demonstration.

### A5. Single-digit chains

Still one digit, but now using *strong links* (a house where the digit has exactly two
possible cells — one of them must be true).

- **Skyscraper** — two strong links in parallel rows, aligned in one column.
- **2-String Kite** — one row strong link, one column strong link, joined through a box.
- **Turbot fish** — the general two-strong-link-plus-weak-link form; skyscraper and kite
  are its two special cases.
- **Simple coloring / single's chain** — color a whole network of strong links in two
  alternating colors, then apply:
  - *Rule 2 (color trap)*: two cells of the same color see each other → that color is
    false everywhere.
  - *Rule 4 (color wrap)*: a cell seeing both colors can't hold the digit.
- **X-Chain** — arbitrary-length alternating chain on one digit.

Crux: **the strong link is the atom of all advanced sudoku.** Everything from here to
AICs is strong links glued together. A site that teaches "strong link" as a first-class,
visualisable object (drawn as a line between two cells) — before teaching any named
pattern that uses one — converts a dozen scary techniques into one idea with variations.
This is the single highest-leverage structural decision in the curriculum.

Coloring is also the ideal introduction to chain logic because it's *mechanical*: no
insight required, just paint and look. It gives learners a taste of chain reasoning
before they can construct chains themselves.

### A6. Multi-digit wings

- **XY-Wing** — pivot {X,Y} sees {X,Z} and {Y,Z}; cells seeing both wings lose Z.
- **XYZ-Wing** — pivot {X,Y,Z} sees {X,Z} and {Y,Z}; cells seeing all three lose Z.
- **W-Wing** — two identical bi-value cells {X,Y} joined by a strong link on X; cells
  seeing both lose Y.

Crux: these are best taught as *case splits*, not as shapes. "The pivot is either X or Y.
Follow both branches. Both end at Z in the same place." An interactive that lets the
learner click each branch and watch it resolve teaches the technique in about 30 seconds;
a diagram takes 10 minutes and often fails. XYZ-Wing then lands as "same argument, three
branches, so the elimination zone shrinks to cells seeing all three."

### A7. General chains

- **Remote pairs** — a chain of identical bi-value cells; ends of even-length chains
  constrain shared peers.
- **XY-Chain** — chain of bi-value cells, linked digit to digit.
- **AIC (alternating inference chain)** — the general theory: alternating strong and weak
  links between arbitrary nodes (cells, or digit-in-house groups). Nice loops are AICs
  that close.
- **Grouped AIC** — nodes can be *sets* of cells (a digit's cells within a box-row).

Crux: AIC subsumes nearly everything above. Once a learner can read `(5)r1c1 = (5)r1c5 -
(5)r7c5 = (5)r7c9` they have a single notation and a single mental model for X-chains,
skyscrapers, kites, XY-wings, W-wings, remote pairs, and coloring. Teaching AIC *after*
the named patterns, framed as "here is what all of those actually were", is a genuine
aha-moment and worth building the curriculum toward.

### A8. Uniqueness techniques

Rely on the puzzle having exactly one solution — logically valid for published puzzles,
philosophically contentious, and useful to flag as such.

- **Unique Rectangle** (types 1–6 + hidden UR) — four cells in two rows, two columns, two
  boxes cannot all be reduced to the same two candidates, or the puzzle would have two
  solutions by swapping.
- **BUG+1** — if every unsolved cell has exactly two candidates except one with three, the
  odd cell must take its digit that appears an odd number of times in its house.
- **Avoidable rectangle** — the UR argument applied to already-solved cells.

Crux: the argument runs *backwards* from a property of the puzzle rather than forwards
from the constraints, which is why it feels illegitimate to learners. The deadly-pattern
demo has to be shown, not asserted: put up the four cells, let the user fill them both
ways, and watch both fills validate.

### A9. Almost-locked sets and beyond

- **ALS-XZ, ALS-XY-Wing, Sue de Coq**, Death Blossom.
- **Forcing chains / nets**, Bowman's Bingo, and ultimately trial and error.

For most learners this is the far end. Worth a survey page — naming the frontier and being
honest that beyond a point the "techniques" are structured guessing — but not worth deep
interactive treatment in v1.

---

## Part B — How sudoku is presented online

Anyone building a teaching site is competing with, and inheriting conventions from, a
mature ecosystem. The conventions matter: violating them makes a teaching tool feel
broken to experienced solvers, and inventing new ones taxes beginners.

### B1. Input models

Two dominant schemes, and good implementations support both:

- **Cell-first**: select a cell, then type/tap a digit. Universal on desktop, keyboard-driven.
- **Digit-first**: select a digit, then tap cells. Dominant on mobile and preferred by
  many speed solvers, because scanning for one digit is the core solving motion.

Modes: *normal* / *corner pencil marks* / *center pencil marks* / *color*. Standard
bindings (from f-puzzles / SudokuPad, now near-universal): plain digit = fill,
Shift+digit = corner, Ctrl+digit = center, Alt+digit = color. Multi-cell selection by
drag or Ctrl+click, with digits applying to the whole selection, is expected by
experienced users and absent from most beginner sites.

### B2. Pencil-mark conventions

- **Corner marks** — historically "where can this digit go" bookkeeping; also used for
  Snyder notation (marking a digit in a box only when it has exactly two possible cells —
  a manual strong-link finder, and one of the highest-value habits an intermediate solver
  can adopt).
- **Center marks** — "what can go in this cell", i.e. the candidate set.
- **Auto-candidates** — the site computes all candidates. Convenient, and *pedagogically
  double-edged*: it removes the scanning practice that builds pattern recognition, but it
  is essential for teaching techniques, since you can't discuss an X-Wing without seeing
  candidates. The right answer for a teaching site is auto-candidates on by default with
  a clearly labeled toggle, plus an explicit note about the tradeoff.

### B3. Assist and feedback features

Near-universal: highlight all instances of the selected digit; highlight the peers
(row/col/box) of the selected cell; conflict/duplicate warnings; undo/redo; timer.

Divisive: immediate error checking. Instant "that's wrong" turns deduction into
trial-and-error. Common compromise is a mode selector — off / check on request / instant.
For teaching, *check on request* is right: mistakes should be recoverable but the learner
must commit to a claim first.

Increasingly common and very relevant here: **cell coloring tools** (usually 8–10
colors on Alt+1..9). Coloring is how humans actually execute chain and coloring
techniques by hand. A teaching site for advanced technique that lacks coloring is asking
learners to do the hard part in their heads.

### B4. Hints and solvers

The interesting split:

- **Answer hints** ("this cell is a 7") — teach nothing.
- **Technique hints** ("there is an X-Wing on 5 in rows 2 and 7") — the model used by
  SudokuWiki's step-by-step solver, and by sudoku.coach's trainer. Far better, and the
  model this site follows: name the technique, then progressively reveal the cells, the
  logic, and finally the eliminations.

The best-in-class teaching tools online are: **sudoku.coach** (per-technique campaign +
trainers that drill one technique in isolation — the strongest pedagogy currently
available), **SudokuWiki** (Andrew Stuart's strategy encyclopaedia + solver; the reference
for technique definitions and naming), **Hodoku** (desktop, but its technique
documentation and its practice-generation model are excellent), and **Cracking the
Cryptic** (video, plus the SudokuPad app — proof that *watching someone reason out loud*
is the most effective format anyone has found).

That last point is worth taking seriously: CtC's success is evidence that learners want
narrated reasoning over static reference. A site can approximate narration with stepped,
self-paced reveals — text tied to a grid state that changes as you advance.

### B5. Difficulty rating

Ratings are mostly derived from the hardest technique required:

- **SE (Sudoku Explainer) rating**, ~1.0–11.0+, is the de-facto standard: 1.2 naked
  single, 1.5 hidden single, 2.6 naked pair, 3.2 X-Wing, 3.6 XY-Wing, 4.2 unique
  rectangle, 6.6+ chains, 8+ nightmarish.
- Newspaper difficulty labels are near-meaningless across publishers. A "hard" NYT puzzle
  rarely needs anything past locked candidates; broadsheet "fiendish" puzzles usually
  don't either. This surprises learners, and is worth telling them: **most published
  puzzles never require the techniques on this site**. The techniques are for the harder
  end of the hobby, and for solving faster.

### B6. Puzzle representation and interchange

- **81-character string**, row-major, `.` or `0` for empty — the universal exchange format.
  Everything on this site uses it.
- Community formats: f-puzzles/SudokuPad compressed URLs (variant constraints), Penpa+
  (arbitrary pencil-puzzle markup), `.sdk`/`.sdm` files.
- **Rc notation**: `r4c7` for row 4 column 7, `b3` for box 3, `r4c7=5` for a placement,
  `r4c7<>5` for an elimination. Chain notation uses `=` for strong links and `-` for weak
  links. This site uses rc notation throughout — it is the lingua franca, and learners who
  don't acquire it can't read any forum, video, or solver output.

### B7. Variants (context, not scope)

Killer, thermo, sandwich, arrow, miracle, chess-constraint sudoku. The advanced *classic*
techniques transfer directly; each variant adds its own. Out of scope here, but worth a
pointer, because a learner who finishes this material and wants more will find the
variant scene is where the interesting puzzles are.

---

## Part C — Pedagogical design principles

These are the commitments the site is built on. Each is a response to a specific failure
mode observed in existing sudoku teaching material.

**C1. Concrete instance before abstract rule.**
Every lesson opens on a live grid with the pattern already present, and asks the learner
to look at it before any definition appears. The rule is stated *after* the instance, as a
summary of something already seen.

**C2. Show the counterfactual, don't describe it.**
The heart of nearly every advanced technique is "suppose this cell were X". So: clicking a
candidate asserts it and propagates the forced consequences visually, until either the
grid settles or a cell is left with nothing — the contradiction, shown as a red empty cell,
rather than asserted in a sentence. This is the site's central interaction.

**C3. Aggressive noise reduction.**
Every step has a focus set. Cells outside it are dimmed; candidates outside it are dimmed.
Single-digit techniques get a "solo digit" view that hides all other candidates entirely.
The pattern should be visible from across the room.

**C4. Build vocabulary as visible objects.**
Strong link, weak link, house, peer, intersection, bi-value cell — each is drawn (lines,
tints, outlines) and reused with the same visual language in every later lesson. A learner
should be able to *see* an alternating chain as alternating link styles.

**C5. Progressive reveal, learner-paced.**
Steps advance on click. Each step changes exactly one thing about the display and says one
sentence about it. No step should require holding more than one new fact.

**C6. Recall, not just recognition.**
Every lesson ends in a drill: a fresh grid where the technique applies, and the learner
must click the pattern cells and then the eliminations. The grid validates and gives
targeted feedback ("those two cells are right, but the pattern needs the digit confined to
exactly two cells in each row — check row 6").

**C7. Interleave.**
Recognition in isolation is much easier than recognition in the wild. A mixed drill offers
positions where *some* technique applies and asks which, since choosing the technique is
the real skill.

**C8. Honesty about scope.**
Say plainly which techniques are actually needed for which difficulty, that uniqueness
techniques rest on an assumption about the puzzle rather than the rules, and that past a
certain point the frontier is structured guessing.

---

## Part D — Site architecture

Static: no build step, no dependencies, no server. Open `site/index.html` from disk and it
works. Plain HTML/CSS/JS; scripts are classic (not ES modules) so `file://` loading is not
blocked by CORS. The same source files are loadable in Node for the offline content
generator and the test suite.

```
site/
  index.html          single page; hash routing (#/lesson/x-wing)
  css/style.css
  js/sudoku.js        grid model, houses, peers, candidates, brute-force solver
  js/techniques.js    detectors — each returns a structured finding
  js/board.js         renderer: cells, candidates, highlight layers, link overlay
  js/hypothesis.js    "what if" propagation engine (principle C2)
  js/lessons.js       curriculum content: prose + puzzles + step scripts
  js/drills.js        practice generation and answer checking
  js/app.js           routing, navigation, progress persistence
  js/puzzles.js       generated puzzle bank, tagged by technique
tools/
  generate.js         node: finds puzzles exhibiting each technique, writes puzzles.js
  test.js             node: asserts every detector and every lesson position
plans/
  sudoku-teaching-site.md
```

### D1. The finding object

The pivot of the whole design. Detectors don't return text; they return structure, and
both the lesson player and the drill checker consume the same structure:

```js
{
  technique: 'x-wing',
  digits: [5],
  cells: [r1c2, r1c8, r6c2, r6c8],   // the pattern
  houses: [{type:'row', index:0}, {type:'row', index:5}],  // where the logic lives
  links: [{a: r1c2, b: r1c8, kind: 'strong', digit: 5}, ...],
  eliminations: [{cell: r3c2, digit: 5}, ...],
  steps: [...]                        // narration, generated from the above
}
```

This means: lesson content is *derived from a real solver running on a real puzzle*, not
hand-authored. No hand-typed cell coordinates to get wrong, drills can be generated
automatically, and the "next step" hint in free-solve mode is the same code path.

### D2. Lesson format

Each lesson is: hook (live grid, a question) → guided walkthrough (stepped reveal, driven
by a detector finding) → the rule, stated compactly with rc notation → variations and
edge cases → common mistakes → drill → link forward.

### D3. Curriculum order

1. Foundations: houses, peers, candidates, both singles, the digit-first mental flip
2. Naked subsets → hidden subsets (taught as the same theorem)
3. Locked candidates (pointing + claiming as one idea)
4. **Strong links** — the atom, taught explicitly before any pattern that uses one
5. X-Wing → Swordfish (as counting, not shape) → finned fish
6. Skyscraper / 2-string kite / turbot fish
7. Simple coloring
8. XY-Wing → XYZ-Wing → W-Wing (as case splits)
9. Remote pairs → XY-chains → AIC (the unification)
10. Unique rectangles, BUG+1
11. Survey: ALS, forcing nets, and the honest edge of the map

### D4. Scope for v1

Build: engine, board, hypothesis mode, stepped lesson player, drills, and full lessons for
items 1–9 above plus uniqueness. The ALS/forcing survey is prose-with-diagram only.

---

## Part E — Build status

Built and verified. 26 lessons across 9 groups, 25 technique detectors, plus a mixed
drill and a playground that runs the solver on any puzzle you paste in.

**Interactive lessons** (walkthrough + drill, all driven by live detector output): hidden
singles, naked pairs/triples, hidden pairs/triples, pointing, claiming, X-Wing,
Swordfish/Jellyfish, finned fish, skyscraper, 2-string kite, simple coloring (wrap and
trap), X-chains, XY-Wing, XYZ-Wing, W-Wing, remote pairs, XY-chains, unique rectangle
types 1 and 2, BUG+1.

**Concept pages** (bespoke interactions, no drill): houses/peers/candidates (click a cell
to see what it sees), strong links (pick a digit, see every strong link on a real grid),
AIC (the same finding rendered as chain notation for five different techniques), and the
frontier survey — prose only, as planned.

Two things ended up more important than expected:

1. **Deriving lesson content from the solver instead of authoring it.** Narration scripts
   read the finding object, so they name whichever cells, digits and orientation the
   generated example actually has. This caught a real bug: chain notation was printing
   links in array order rather than path order, producing chains whose "weak link" joined
   two cells that don't share a house.

2. **Requiring lesson positions to be *stuck*.** The first generator accepted any position
   where the technique fired, which produced grids with an obvious naked single sitting
   next to the X-Wing being taught. Now a position only qualifies if nothing of lower rank
   applies, which is also what makes the mixed drill's "name the simplest technique that
   works" question well-defined.

3. **Treating uniqueness as a conditional premise, in the code and not just the prose.**
   Two facts have to hold together: puzzles must genuinely have one solution, and the
   deductions that lean on that must be marked as leaning on it.

   Enforcement: `makePuzzle` only removes a clue while `solve(probe, 2).count === 1`, the
   playground rejects a pasted grid that isn't unique, and all 121 bank puzzles are
   re-verified as uniquely solvable.

   Use: unique rectangles (types 1 and 2) and BUG+1 are real detectors in the registry, so
   the solver plays them. The deadly-pattern precondition is enforced where it belongs —
   `rectangles()` only yields corner sets spanning *exactly two boxes*.

   The gate: those three registry entries carry `uniqueness: true`, and `nextStep` accepts
   `{noUniqueness: true}`. The playground checks the live solution count before every hint,
   because the user can type into the grid — and a grid someone has edited may no longer be
   a proper puzzle, at which point a UR argument is simply unsound. Broken grids get told
   so rather than getting a confident wrong deduction. Verified on the 9 bank positions
   where a uniqueness technique is the next move: all 9 suppressed when the premise is
   withdrawn.

### Verification

- `tools/test.js` fuzzes every detector against ground truth. Last full run: 7,608
  findings across 370 positions in 120 puzzles, zero disagreements with the true solution.
- `tools/generate.js` re-validates every finding before admitting it to the bank; the
  shipped bank came from 2,211 puzzles with zero rejections.
- `tools/drive.js` + `tools/smoke.js` drive a real browser over CDP: every frame of every
  walkthrough, the what-if engine, a drill answered correctly end to end, wrong-answer
  feedback, hints, all four custom pages, the mixed drill and the playground. Any console
  error fails the run.

### Part F — What a beginner walkthrough exposed

Walking the site as someone arriving new found problems that no amount of solver
correctness would have caught, because they were all in the seam between a correct
finding and the question put to the learner.

**The drill asked for the opposite of the right answer on the first technique lesson.**
Singles carry their conclusion as a *placement*; everything else carries it as
*eliminations*. The drill treated both as "candidates that die", so a learner who
understood hidden singles perfectly would click the digits that go away and be marked
wrong, while the checker waited for the digit that stays. Fixed by making the distinction
explicit — `consequences()` splits a finding into `kills` and `places`, and the phase-2
question is worded from that rather than from the lesson:

- kills → "Now mark every candidate this kills."
- places → "Now mark the digit that has to go in."

The general lesson: any place where content is generated from data needs the *question*
generated from the same data too, or the two drift apart exactly where it hurts most.

**Being stuck was a dead end.** Three hints, then nothing but "New grid", which reads as
punishment. There is now a **Show me** that runs the full stepped walkthrough on the
drill's own position — the same player the lesson uses. An escape hatch that teaches costs
nothing extra, because the narration was already derivable from the finding.

**The curriculum started one rung too high.** It opened by telling the reader they already
find naked singles. There is now a naked-singles lesson before hidden singles that also
introduces pencil marks from scratch and names the auto-candidate tradeoff, plus a
"Before you start" panel on the home page stating the actual prerequisite (the rules, and
nothing else).

**Concept pages could never be completed**, so the progress column looked broken on the
very first lesson. They now carry an explicit "Mark as read".

**The mixed drill quizzed techniques you had not met.** It now draws its *answers* only
from finished lessons, while still pulling *distractors* from the whole pool so the
question does not collapse to a two-way guess for someone two lessons in.

**Phones could not use half the site.** The playground was keyboard-only — literally no
way to enter a digit on a touch device. And drill phase 2 required tapping a pencil mark,
which measures 10×12px on a 390px-wide screen against a ~44px guideline.

Both are fixed by the same thing, which turned out to be the better interaction anyway:
**digit-first input.** Pick a digit from a pad, then tap whole cells — 42px targets
instead of 12px, and it matches how solvers actually think ("where do the 5s go?") rather
than how a mouse-driven UI wants to work. Direct pencil-mark tapping still works for
anyone on a desktop.

Also: the first lesson dimmed 95% of the grid, which is a hostile first impression and hid
the candidates it was asking the reader to look at. Dimming went from 0.32 to 0.42 opacity
and the naked-singles walkthrough no longer dims at all — the tinted peer houses carry the
meaning by themselves.

### Part G — Streamlining

Two rounds of cuts after reading the site as a learner rather than as its author.

**Prose: 3284 -> ~2160 words** across the lessons. The intros were largely restating what
the walkthrough steps already said, one screen further down. On a phone the overview went
from 4789px to about 1100px.

**The self-classifying fork is gone.** The front page used to offer "Start at the
beginning" or "I can already solve" — which asks the reader to rank themselves against a
standard they cannot see. The skip now lives *on* the early pages, where the material is
visible and the judgement is cheap: "Know this already? Skip to ...".

**The front page itself is gone.** Once it was one button, it was a lobby. `#/` now
resolves to the first unfinished lesson, so the site opens on a grid and returning opens
where you stopped. The sidebar was always the real index; the card grid only said it
twice.

### Part H — Accessibility

The first version was mouse-only. The grid was 81 clickable `div`s with no roles, no
labels and no tab stop, which meant a keyboard or screen-reader user could not do a single
drill — the whole "now you find it" half of the pedagogy was unreachable. That is a
correctness bug in a teaching tool, not a nicety.

**Structure.** The board is now `role="grid"` with nine `role="row"` wrappers (styled
`display: contents`, so the 9x9 CSS grid is untouched) and 81 `role="gridcell"`. Every
cell carries a live `aria-label` built from the same view the renderer draws:
`"r5c5, candidates 7 9, group A"`, `"r2c3, 4 eliminated"`.

**Keyboard.** Roving tabindex: one cell is in the tab order, arrows move, Home/End/PageUp/
PageDown jump, Enter activates. Typing a digit acts on the focused cell — which gives
keyboard access to the two interactions that were previously mouse-only: opening the
what-if on a specific pencil mark, and marking eliminations in a drill. That replaced a
document-level keydown listener in the playground which had also been leaking one handler
per visit.

**Announcements.** Narration, drill prompts and feedback are live regions, so stepping
through a walkthrough reads out rather than changing silently.

**Not by color alone.** The two sides of a case split were blue vs violet — hue only. They
now also differ in shape: group A has a solid ring, group B a dashed one. Confirmed
candidates gained an outline so they differ from in-pattern candidates by more than
green vs amber. Strong/weak links were already solid vs dashed.

**Tested, not asserted.** `tools/smoke.js` checks the roles, that all 81 cells are
labeled, that exactly one tab stop exists, that arrow keys move focus, and that a digit
key opens the what-if panel.

Still open: the site has not been through a real screen reader, only through the DOM
contract. Contrast ratios have not been measured.

### A note on spelling

American English throughout — prose, comments, identifiers. `coloring-trap` and
`coloring-wrap` are the technique ids, which reach into the generated puzzle bank keys,
so a rename here is a data migration as much as a copy edit.

### Part I — Tests that do not cheat

A learner reported: on naked singles, found the cell, tapped it, was unsure what to do,
pressed Check, was asked for a digit, entered the only digit the cell could hold, and was
told "not quite".

Reproduced exactly. Two faults, one of them mine twice over:

1. **A step with nothing in it.** Choosing a digit on the pad only *armed* it; the answer
   registered on a subsequent tap of the cell. But in a placement the cell is already
   known — the learner identified it in phase one — so the second tap carried no
   information and no affordance said it was expected. Now choosing the digit is the whole
   answer, and the prompt names the cell: "Which digit goes in r2c3?"
2. **No stated way to submit.** Phase one said what to find and never said "then press
   Check". Now it does.

The deeper problem was the test suite. `tools/smoke.js` covered this exact drill and was
green throughout, because it did this:

    const d = window.Drills.makeDrill('naked-single', 1);
    d.primary.cells.forEach(c => grid.querySelector(...).click());

A test that asks the application for the answer and then enters it can only prove that the
checker accepts its own output. It cannot see an invisible step, a missing instruction, or
a baffling response to a reasonable action — the entire class of bug that matters in a
teaching tool.

`tests/naive-user.spec.js` is the counterweight, under one rule: **no access to internals.**
It scans the rendered grid for a cell showing one pencil mark, clicks it, reads the prompt
to find out what is wanted, presses the digit it saw, and asserts it is told it was right.
Other specs check that every drill prompt says both what to find and how to submit, that a
wrong answer explains itself rather than saying "no", that "Show me" is a walkthrough
rather than an answer dump, and that a drill can be completed with arrow keys and Enter
alone. Both viewports, desktop and phone.

Verified the way a regression test should be: the bug was reintroduced, two specs failed,
the fix restored, all sixteen passed.

### Part J — Three blind reviews

Three reviewers were sent through the site with no access to this document, the README or
any design-rationale comments, so they judged the artifact rather than the intent. Their
verdicts converged on a diagnosis I would not have reached alone:

> the picture is consistently one step ahead of the words, so several "Next" presses buy
> you nothing, while the two or three inferences that actually matter are crammed into one
> frame

**Two rendering bugs I had caused and never looked closely enough to see.** `1fr` is
`minmax(auto, 1fr)`, so a cell whose pencil marks were taller than its track stretched the
whole row — and once the accessibility work added `display: contents` row wrappers, the
9 rows became content-sized, so one row rendered 14px tall while others swelled. Raising
the candidate font from 11px to 12.5px "for legibility" is what tipped it over. In the
naked-pairs lesson the `{5,7}` pair — the drill's own target — was rendering half outside
its cell. Both axes are now pinned with `minmax(0, 1fr)` and `.cand` has `line-height: 1`.

**The clunkiness was mostly reading order and dead steps.**
- No keyboard for the walkthrough: 5–9 mouse trips per lesson. Arrow keys now step it.
- The end of a walkthrough greyed out Next and pointed at nothing, with the drill ~800px
  below. It now offers "Now you try →".
- Steps whose picture did not change: naked-single 2, naked-pair 2, x-chain 2 and 4. Each
  now has a real visual delta, and a test asserts no step ever repeats its predecessor's
  rendering.
- The skyscraper's four-hop inference was one static frame. It is now four frames, one hop
  each.
- Drill phase 2 put the digit pad *above* the prompt that described it, and the prompt said
  "choose it below" while pointing up. Prompt now precedes the pad, and the confirmation is
  folded into the new question ("✓ That is the pattern. Now: which digit goes in r2c3?")
  so success is read before the next demand rather than after it.

**The elimination zone was never drawn.** "Cells seeing both ends" is the payoff of every
chain technique, and no lesson ever showed it — while the skyscraper's own "what goes
wrong" card named forgetting it as the classic error. There is now a frame that shades
peers(A) ∩ peers(B) before any elimination is named.

**The search procedure existed only as a hint.** Both reviewers independently called the
drill's single-digit filter the best teaching object on the site — and one admitted they
could not have found an X-Wing unaided from the walkthrough, but solved the drill because
hint 1's filter reproduced the search condition by accident. The filter is now a permanent
control under every practice grid, and hints accumulate rather than replace (hint 2 used to
discard hint 1's filter, leaving you worse off for asking for help).

**Claims that were simply false.** The AIC page rendered an XY-Chain as
`(7)r3c9 - (7)r8c9 - (1)r8c6 - …` — not one strong link — directly beneath its own rule
that chains must alternate and start and end on `=`. My link model collapsed bi-value
chains to cell-to-cell weak links; the real nodes are digits *within* cells. Fixed, and
remote pairs with it. The page also claimed "nine ways" while listing five and omitting
X-Wing. And the strong-links explorer reported 10 links while drawing 7, because it counted
a pair once per house that witnessed it.

### Part K — Teaching the search, not just the pattern

The first attempt at this was a wall of prose with a bar chart — an essay about scanning,
on a site whose thesis is that essays are the wrong medium. Rewritten as a **scanning
trainer**: a live position, a strip of the nine digits each labelled with how many are
already placed, and a prompt asking which you would scan first.

Pick one and the site performs the cross-hatch in front of you: every row and column
already holding that digit is struck through in red, whatever survives in each box tints
faintly, and a box down to a single surviving cell gets a hard green ring. Then it tells
you whether that was a good choice, and keeps a running tally:

> 9 digits scanned, 5 paid off. Digits that paid averaged **3.8** already placed; the
> empty-handed ones averaged **2.5**.

That line is the point. The frequency heuristic is not asserted at the reader — it falls
out of their own scanning, computed from the digits they actually chose. The prose that
remains is only what the widget cannot demonstrate: why boxes run out of room first, the
band signal, and the rescan guarantee.

Every reviewer landed on the same gap from a different angle: the lessons teach you to
recognise a pattern once it is pointed at, never how to go looking for one. Lessons now
carry an optional `hunt` field, rendered as a "How to hunt these" card between the
walkthrough and the rule.

The first one, on hidden singles, is the only content on the site that is not a
repackaging of standard technique. Measured over 1,421 hidden singles in the shipped
puzzle bank:

- **Scan the digit that is about half placed.** Digits sitting at 3-5 copies account for
  two thirds of all hidden singles. The folk advice — start with the digit you have placed
  most — is backwards at the top end: a digit with eight placed has one cell left in the
  entire grid, so there is at most one thing to find. 7-8 placed yields 11.6% combined.
- **Boxes before lines.** 56% show up in a box, and 10% are box-only.
- Cross-hatch a band of three boxes rather than one box at a time; after a placement,
  re-check only that digit in the three houses it touched.

Getting that number right took three attempts. The first two measurements reported a
row/column split of 24.5% vs 36%, which cannot be real — rows and columns are symmetric
under transposition. Transposing every puzzle and re-measuring showed the skew stayed put,
proving it was an artifact of the measurement rather than a property of sudoku: findings
that survived a pass were being counted again on the next one. Counting each placement
exactly once, and applying every finding before rescanning, gave row 51% / col 48% —
symmetric, and therefore trustworthy.

The heuristic does appear online, in two forms. [Sudoku Bliss](https://sudokubliss.com/guides/sudoku-scanning)
gives the common, and wrong, version: "starting with numbers that already appear many
times in the puzzle, since they have fewer placement options."
[TrySolitaire](https://trysolitaire.com/sudoku-tips-tricks) gives the sharp one: "focus on
numbers that already appear 4-5 times in the grid" — which matches the measurement.

### Part L — Auditing for described-but-not-shown procedures

Grepping the lesson prose for procedural verbs (*scan, sweep, take one, union, compare,
keep going, paint*) finds the places where a search is written out as instructions rather
than run. Three cases stood out, and they are three different failure modes:

1. **Stated and then contradicted by the illustration.** Simple colouring said "color a
   cell, color its strong-link partner the opposite, and keep going" — an algorithm — and
   then showed the finished network. The reader is told to iterate and shown a result.
2. **Absent entirely.** X-Wing never said how to look. The walkthrough hands you the digit
   in step 1 and the rows in step 2. A blind reviewer confirmed the consequence: they could
   not find one unaided afterwards.
3. **Stated compactly and left there.** Naked triples: "take the cells with 2 or 3
   candidates and union their sets."

Built for 1 and 2:

**Fish scanner** (`huntWidget: 'fish'`). Each digit is labelled with how many lines have
exactly two homes left for it — that count *is* the first move of the search. Pick a
viable digit and every two-home line is listed with its column pair; pick two and it
compares them and says why they do or do not form a fish. Switching to a column-first scan
is one button, which makes the row/column symmetry concrete rather than a remark.

**Paint trainer** (`huntWidget: 'paint'`). Click a cell to start; the network it belongs to
is isolated and everything else fades. Each further click on a linked cell reports the
forcing: "r5c1 is strong-linked to r3c1, so it must take the opposite colour." When the
network is complete it finds its own payoff — the trap, the wrap, or an honest "this one
pays nothing".

Building the paint trainer exposed a real modelling error: strong links form several
disconnected networks, and the first version lit all of them, so cells unreachable from
your start stayed highlighted and rejected every click. Colouring is per-network, and the
widget now says so out loud.

Still described rather than shown, in rough order of value: naked/hidden subsets (union the
candidate sets; the digit-position table for hidden ones), pointing and claiming (pick a
box and digit, see whether the spots align), the wings (click a pivot, see its bi-value
peers), and unique rectangles (find the two-box rectangles).

### Part M — Right answer, wrong question

A learner picked two cells holding the same two candidates — a textbook naked pair — and
was told "None of those cells are part of a pattern here." They had done exactly what the
prompt asked. The cells were the last two empty ones in their row, so the pair eliminates
nothing, and detectors deliberately ignore findings with no eliminations.

Counting the drill grid makes the scale of it clear: **nine** structurally genuine naked
pairs that remove nothing, against **two** that do. The single most likely first answer was
correct-as-stated and rejected with a false statement.

Two fixes:

1. **The prompt now states the whole requirement** — "two cells in one house with the same
   two candidates *— one that still clears something*". The pattern was never the whole
   condition; only half of it was written down.
2. **Inert patterns are recognised and taught rather than denied.** `inertPattern()` spots
   a structurally valid naked or hidden subset that removes nothing and says so:

   > That *is* a genuine naked pair — r2c5, r2c9 on 3 and 9 in row 2. But they are the only
   > empty cells left in that house, so there is nothing for it to remove. A pattern that
   > eliminates nothing is not a move. Find one with work left to do.

   It is reported as a near-miss, not an error, and the lesson's own "what goes wrong" card
   already made this exact point — "spotting the pattern and forgetting to do the
   eliminations" — so the drill was contradicting its own lesson.

This is the same failure as the singles drill and the "squeezed into its last home"
wording: the checker's condition and the stated condition drifted apart, and only a real
learner walking into the gap surfaced it.

### Part N — A completeness bug, found by measuring

Asked for heuristics to find hidden pairs, the natural first claim is that a hidden pair in
a house with *k* empties **is** a naked (k&minus;2) among the other cells — so the naked
reading is usually easier. Measuring how often that shortcut applies produced an impossible
number: hidden pairs turning up in houses with 4 empty cells, at positions where naked
pairs were supposedly exhausted. In a 4-empty house those are the same event, so one of
them should always have fired first.

Inspecting a case showed the cause:

    r1c1 {1,2}      <- a plain naked pair
    r2c1 {1,2}      <- detector reported none in this column
    r7c1 {2,3,8}    <- "hidden pair" on 3,8
    r8c1 {1,2,3,8}

`nakedSubsets` filtered the house's empty cells down to those with at most `size`
candidates, and *then* applied the "nothing left to eliminate from" guard to that filtered
list. A house with four empties of which exactly two were bi-value was skipped outright.

Consequences: **40% of the hidden pairs the solver reported were naked subsets it could not
see** (94 down to 56 at stuck positions once fixed), and lesson positions violated the
site's own rule that a position must be stuck at everything simpler — some lessons taught a
harder technique with an easier one sitting in the same house.

The fix only adds findings: 41,564 naked-subset eliminations re-checked against ground
truth, none wrong. It shifted every `solveWith` fixpoint, so the bank was regenerated; the
bank-integrity check caught the drift the moment the detector changed.

**This is precisely the gap named in the earlier self-review.** Every test asserted findings
were *true*; none asserted they were *all found*. A missed finding is silent — nothing
fails, the learner is just shown a harder technique than necessary. `tools/test.js` now
brute-forces the naked-subset definition straight from the rules at every sampled position
and demands the detector agree.

### Part O — Widgets for the search, not the pattern

Four "how to hunt" widgets now exist, each running a search rather than describing one:

| lesson | widget | what you do |
|---|---|---|
| Hidden singles | scan trainer | pick a digit, watch it cross-hatch, see whether it paid |
| X-Wing | fish scanner | pick a digit by two-home count, compare two lines |
| Simple colouring | paint trainer | paint the network yourself, one forced step at a time |
| Hidden pairs | digit-position table | one house as digits &times; cells; a pair is two identical rows |

The table is the most direct answer to "why are hidden subsets hard?" — the evidence is
spread across a house instead of sitting in one cell, so it collects it into one place. A
digit with one dot is a hidden single; two digits with dots in the same two cells are a
hidden pair, visible as two matching rows rather than something held in the head. It is
also exactly what Snyder notation approximates on the grid itself.

### Not built

Jellyfish and naked quads are detected and will appear in the playground's hints, but have
no dedicated lesson (they are rarely worth hunting by hand). Grouped AICs, ALS techniques
and forcing nets are surveyed on the frontier page rather than taught — implementing
detectors for them is the obvious next increment, and the finding/script architecture
would take them without change.
