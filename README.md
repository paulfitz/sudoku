# Advanced Sudoku — shown rather than described

An interactive site for teaching advanced sudoku technique: X-Wings, fish, chains,
coloring, wings and uniqueness patterns. Built around the observation that these
techniques are about *relationships between distant cells* and about *counterfactuals*,
which are the two things prose is worst at.

**Live at <https://paulfitz.github.io/sudoku/>** — or open `site/index.html` straight from
disk. No server, no dependencies, no build required to run it; the build step only
regenerates puzzle content.

Published by pushing the `site/` subtree to the `gh-pages` branch, which is what GitHub
Pages serves:

```bash
npm run deploy      # git subtree push --prefix site origin gh-pages
```

## What's here

```
plans/sudoku-teaching-site.md   design doc: the technique landscape, how sudoku is
                                presented online, and the pedagogical commitments
site/                           the site — plain HTML/CSS/JS, opens from file://
tools/                          build + test (Node, no dependencies)
```

## How it works

The unusual part is that **no lesson content is hand-authored against a grid**. A full
solver with 25 technique detectors lives in `site/js/techniques.js`; every detector
returns the same structured "finding":

```js
{ technique, digits, cells, houses, links, eliminations, extra }
```

That single structure drives the walkthrough narration, the drill's answer checking, and
the playground's hint button. So a lesson cannot claim something the solver did not
actually find, and the drill accepts any valid instance — including ones the author never
saw.

Puzzle content is generated, not curated. `tools/generate.js` creates random puzzles,
solves each to every *stuck* position (one where nothing simpler applies — otherwise the
learner rightly asks "why not just fill that obvious cell?"), and records positions where
each technique fires. Every proposed elimination is checked against the puzzle's true
solution before it is allowed into the bank.

Entries are stored as `{puzzle, prep}` and the site replays `solveWith(prep)` to rebuild
the position, so content can never drift out of sync with the solver.

## Build and test

```bash
npm run build        # regenerate site/js/puzzles.js (~4000 puzzles searched, a few minutes)
npm test             # solver fuzz test + browser interaction test
npm run serve        # optional local server, if you prefer http:// to file://
```

`tools/test.js` fuzzes every detector against ground truth: it generates puzzles, walks
each to every stuck position, runs all 25 detectors and asserts that no finding ever
removes a candidate the true solution needs. A failure there means a learner would be
taught a false deduction, so it gates the build. The last full run checked 7,608 findings
across 370 positions with no disagreements.

`tools/drive.js` is a small Chrome DevTools Protocol driver (no dependencies — Node's
built-in `fetch` and `WebSocket`). `tools/smoke.js` uses it to step through every frame of
every walkthrough, exercise the what-if engine, answer a drill end to end, and fail on any
console error. It is broad but it has inside knowledge: it asks the app for the correct
answer and then enters it.

`tests/naive-user.spec.js` (Playwright) exists because that is not enough. Those specs are
**forbidden from touching `window.Sudoku`, `window.Drills` or any other internal**. They
read the screen — visible text, ARIA roles, which pencil marks are actually rendered —
decide what a person would do, do it, and assert on what a person would then see. They run
against both a desktop and a phone viewport.

That distinction is not academic. The smoke suite was fully green while the naked-singles
drill rejected the only possible digit, because a test handed the right answer cannot
notice that a required step was invisible. The naive-user spec fails on that bug; it was
written by replaying a real report, and confirmed to fail before the fix and pass after.

## The teaching design, briefly

Set out in full in `plans/sudoku-teaching-site.md`. The commitments that shaped the code:

- **Show the counterfactual, don't describe it.** Click any pencil mark to assert it and
  watch the forced consequences ripple until the grid settles or a cell is left with
  nothing. Only forced moves are used, so every frame is something the learner could have
  derived.
- **Concrete instance before abstract rule.** Lessons open on a live position; the rule is
  stated afterwards as a summary of something already seen.
- **Aggressive noise reduction.** Single-digit techniques hide the other eight digits
  entirely; everything outside the pattern is dimmed.
- **One visual language.** Amber is always "the pattern", red-struck is always "this dies",
  solid lines are always strong links and dashed always weak — in every lesson.
- **Strong links taught as an object**, on their own page, before any pattern that uses
  one. A dozen named techniques then collapse into one idea, which the AIC page makes
  explicit.
- **Recall, not recognition.** Every lesson ends with a fresh grid you must solve yourself,
  plus a mixed drill where you have to *choose* the technique — drawn only from lessons
  you have finished, so you are never quizzed on something you have not met.
- **Getting stuck has to teach.** Hints escalate, and **Show me** runs the full stepped
  walkthrough on the drill's own grid rather than just handing over the answer.
- **Digit-first input.** Pick a digit, then tap cells. It matches how solvers think, and it
  means a pencil mark is never the tap target — 42px buttons instead of 12px marks, which
  is what makes the site usable on a phone at all.

## Accessibility

The board is a real `role="grid"` with labeled cells, a roving tabindex, arrow-key
navigation, and digit keys that act on the focused cell — so the drills, and the what-if
engine, work without a mouse. Narration and feedback are live regions. Nothing is encoded
by color alone: the two sides of a case split differ by solid vs dashed ring as well as
hue, and strong/weak links by solid vs dashed line. `tools/smoke.js` asserts all of it.

Not yet done: testing with an actual screen reader, and measuring contrast ratios.

## No front page

There isn't one. `#/` resumes at the first lesson you haven't finished, and the sidebar
already lists everything — a landing page whose job was a Start button and a duplicate
index is just a wall between the reader and a grid that moves.

The early pages carry a quiet "Know this already? Skip to ..." link instead of asking
anyone to classify themselves against a standard they can't see before they've seen the
material.
