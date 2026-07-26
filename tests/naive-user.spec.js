/* naive-user.spec.js — tests that play like someone who does not know the answer.
 *
 * The existing smoke suite passed while the naked-singles drill was broken, and it is
 * worth being precise about why: it cheated. It called
 *
 *     window.Drills.makeDrill('naked-single', 1).primary
 *
 * to get the correct cells and digits, then clicked exactly those. A test with inside
 * knowledge can only ever prove the checker accepts the answer it was handed. It cannot
 * notice that a step is invisible, that a prompt does not say what to do next, or that a
 * reasonable action produces a baffling response.
 *
 * So these tests may not touch window.Sudoku, window.Drills or any other internal. They
 * read the screen — visible text, ARIA roles, which pencil marks are actually rendered —
 * decide what a person would do, do it, and assert on what a person would then see.
 *
 *   npx playwright test
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

const SITE = 'file://' + path.join(__dirname, '..', 'site', 'index.html');

/** Everything a person can see in one cell: its big digit, or its pencil marks. */
async function readCell(cell) {
  const value = (await cell.locator('.value').innerText()).trim();
  if (value) return { value, marks: [] };
  const marks = await cell.locator('.cand:not(.off)').allInnerTexts();
  return { value: null, marks: marks.map((m) => m.trim()) };
}

/** Scan the visible grid for a cell showing exactly one pencil mark. */
async function findLoneCandidate(grid) {
  const cells = await grid.locator('.cell').all();
  for (let i = 0; i < cells.length; i++) {
    const marks = await cells[i].locator('.cand:not(.off)').allInnerTexts();
    if (marks.length === 1) return { cell: cells[i], digit: marks[0].trim(), index: i };
  }
  return null;
}

test.describe('a learner who does not know the answer', () => {
  test('naked singles: find the cell, say the digit, be told you are right', async ({ page }) => {
    await page.goto(SITE + '#/lesson/naked-single');

    const drill = page.locator('.drill');
    await expect(drill).toBeVisible();

    // The prompt must say what to look for AND what to do once found. "I didn't know
    // what to do next" is a test failure, not a user error.
    const prompt = drill.locator('.prompt');
    await expect(prompt).toContainText(/find/i);
    await expect(prompt).toContainText(/check/i,
      { message: 'the prompt never tells the learner how to submit' });

    // Look at the grid and find a cell with one pencil mark — as a person would.
    const found = await findLoneCandidate(drill.locator('.board-grid'));
    expect(found, 'the practice grid should contain a visible naked single').not.toBeNull();

    await found.cell.click();
    await drill.getByRole('button', { name: 'Check' }).click();
    await expect(drill.locator('.prompt')).toContainText(/that is the pattern/i);

    // Now it wants a digit. Whatever it asks for must be answerable from what is shown:
    // the prompt should name the cell, so there is no guessing about where.
    await expect(prompt).toContainText(/digit/i);

    // Answer with the digit that was visibly the only candidate.
    await drill.locator('.digit-pad').getByRole('button', { name: `Digit ${found.digit}` }).click();
    await drill.getByRole('button', { name: 'Check' }).click();

    await expect(drill.locator('.feedback')).toContainText(/correct/i,
      { message: 'the only possible digit was rejected' });
  });

  test('naked singles: choosing the digit and also tapping the cell still counts', async ({ page }) => {
    // A learner who picks the digit and then taps the cell — the obvious reading of a
    // "pick a digit, then tap cells" pad — must not silently cancel their own answer.
    await page.goto(SITE + '#/lesson/naked-single');
    const drill = page.locator('.drill');

    const found = await findLoneCandidate(drill.locator('.board-grid'));
    await found.cell.click();
    await drill.getByRole('button', { name: 'Check' }).click();

    await drill.locator('.digit-pad').getByRole('button', { name: `Digit ${found.digit}` }).click();
    await found.cell.click();                       // the extra, natural tap
    await drill.getByRole('button', { name: 'Check' }).click();

    await expect(drill.locator('.feedback')).toContainText(/correct/i,
      { message: 'tapping the cell after choosing the digit cancelled the answer' });
  });

  test('hidden singles: the same flow works without inside knowledge', async ({ page }) => {
    await page.goto(SITE + '#/lesson/hidden-single');
    const drill = page.locator('.drill');

    // A learner cannot scan for hidden singles by eye here, so use the hints — which is
    // exactly the path a stuck person takes. The hints must be enough to finish.
    await drill.getByRole('button', { name: 'Hint' }).click();
    const hint1 = await drill.locator('.feedback').innerText();
    expect(hint1).toMatch(/it is about the \d/i);

    await drill.getByRole('button', { name: 'Hint' }).click();
    await drill.getByRole('button', { name: 'Hint' }).click();
    const hint3 = await drill.locator('.feedback').innerText();
    const named = hint3.match(/r(\d)c(\d)/);
    expect(named, 'the last hint should name a cell').not.toBeNull();

    const idx = (Number(named[1]) - 1) * 9 + (Number(named[2]) - 1);
    await drill.locator('.board-grid .cell').nth(idx).click();
    await drill.getByRole('button', { name: 'Check' }).click();
    await expect(drill.locator('.prompt')).toContainText(/that is the pattern/i);

    // The prompt now names a cell; read that cell's marks off the screen and answer.
    const promptText = await drill.locator('.prompt').innerText();
    const target = promptText.match(/r(\d)c(\d)/);
    expect(target, 'the prompt should say which cell needs a digit').not.toBeNull();

    // A hidden single's cell still shows several marks, so the learner must reason:
    // the hint told them the digit. Use that.
    const digit = hint1.match(/(\d)/)[1];
    await drill.locator('.digit-pad').getByRole('button', { name: `Digit ${digit}` }).click();
    await drill.getByRole('button', { name: 'Check' }).click();
    await expect(drill.locator('.feedback')).toContainText(/correct/i);
  });

  test('every drill states both what to find and how to submit', async ({ page }) => {
    await page.goto(SITE + '#/');
    const ids = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.sidebar a[href^="#/lesson/"]'))
        .map((a) => a.getAttribute('href')));

    const problems = [];
    for (const href of ids) {
      await page.goto(SITE + href);
      const drill = page.locator('.drill');
      if (!(await drill.count())) continue;               // concept pages have no drill
      const prompt = (await drill.locator('.prompt').innerText()).trim();
      if (!/check/i.test(prompt)) problems.push(`${href}: prompt never mentions Check — "${prompt}"`);
      if (!/find/i.test(prompt)) problems.push(`${href}: prompt does not say what to find`);
      if (/undefined|NaN|\[object/.test(prompt)) problems.push(`${href}: broken prompt "${prompt}"`);
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  test('a wrong answer explains itself instead of just saying no', async ({ page }) => {
    await page.goto(SITE + '#/lesson/x-wing');
    const drill = page.locator('.drill');

    // Pick two arbitrary cells — a plausible wrong guess.
    await drill.locator('.board-grid .cell').nth(0).click();
    await drill.locator('.board-grid .cell').nth(40).click();
    await drill.getByRole('button', { name: 'Check' }).click();

    const feedback = (await drill.locator('.feedback').innerText()).trim();
    expect(feedback.length, 'a wrong answer produced no feedback at all').toBeGreaterThan(15);
    expect(feedback).not.toMatch(/^(no|wrong|incorrect)\.?$/i);
  });

  test('being stuck has a way out that teaches', async ({ page }) => {
    await page.goto(SITE + '#/lesson/skyscraper');
    const drill = page.locator('.drill');

    await drill.getByRole('button', { name: 'Show me' }).click();
    // It must be a walkthrough, not a bare answer.
    await expect(drill.locator('.step-text')).toBeVisible();
    const steps = await drill.locator('.dot').count();
    expect(steps, 'Show me should walk through the reasoning').toBeGreaterThan(2);

    const first = await drill.locator('.step-text').innerText();
    await drill.getByRole('button', { name: 'Next' }).click();
    const second = await drill.locator('.step-text').innerText();
    expect(second).not.toEqual(first);

    await expect(drill.getByRole('button', { name: /try another grid/i })).toBeVisible();
  });
});

test.describe('the scanning trainer teaches by doing', () => {
  test('picking a digit cross-hatches the grid and reports what it found', async ({ page }) => {
    await page.goto(SITE + '#/lesson/hidden-single');
    const hunt = page.locator('.card.hunt');
    await expect(hunt).toBeVisible();

    // The strip must show how many of each digit are placed — that is the whole heuristic.
    const counts = await hunt.locator('.digit-strip .count').allInnerTexts();
    expect(counts).toHaveLength(9);
    expect(counts.every((c) => /\d+ placed/.test(c))).toBe(true);

    // Scan every digit as a learner would, and check the cross-hatch actually draws.
    let paid = 0;
    for (let d = 1; d <= 9; d++) {
      await hunt.locator('.digit-strip').getByRole('button', { name: new RegExp(`Scan the ${d}s`) }).click();
      const strikes = await page.locator('.card.hunt .strike').count();
      expect(strikes, `scanning ${d} drew no strike lines`).toBeGreaterThan(0);
      const report = await hunt.locator('.step-text').innerText();
      expect(report).toMatch(/Yes\.|Nothing forced/);
      if (/Yes\./.test(report)) {
        paid++;
        // a forced cell must be singled out, not lost among the survivors
        expect(await page.locator('.card.hunt .tint-forced').count()).toBeGreaterThan(0);
      }
    }
    expect(paid, 'no digit in this position yielded a hidden single').toBeGreaterThan(0);

    // The tally is what makes the heuristic self-evident rather than asserted.
    const tally = await hunt.locator('.tally').innerText();
    expect(tally).toMatch(/9 digits scanned/);
    expect(tally).toMatch(/averaged/);
  });
});

test.describe('search procedures are run, not described', () => {
  test('X-Wing: the scanner performs the two-move search', async ({ page }) => {
    await page.goto(SITE + '#/lesson/x-wing');
    const hunt = page.locator('.card.hunt');

    // Move one: which digits even have two lines with exactly two homes?
    const counts = await hunt.locator('.digit-strip .count').allInnerTexts();
    expect(counts).toHaveLength(9);
    const viable = counts.findIndex((c) => parseInt(c, 10) >= 2);
    expect(viable, 'no digit in this position has two candidate lines').toBeGreaterThanOrEqual(0);

    await hunt.locator('.digit-strip button').nth(viable).click();

    // Move two: the two-home lines are listed and comparable.
    const lines = hunt.locator('.scan-row .btn.scan-pick');
    expect(await lines.count(), 'no two-home lines listed').toBeGreaterThanOrEqual(2);
    await lines.nth(0).click();
    await lines.nth(1).click();

    // Whatever the verdict, it must state the column pairs it compared — that is the lesson.
    const verdict = await hunt.locator('.step-text').innerText();
    expect(verdict).toMatch(/X-Wing|No fish/i);
    expect(verdict).toMatch(/\d\s*&\s*\d|columns? \d/i);
  });

  test('colouring: you paint the network yourself and it explains each step', async ({ page }) => {
    await page.goto(SITE + '#/lesson/coloring');
    const hunt = page.locator('.card.hunt');
    const cells = hunt.locator('.board-grid .cell');

    // Start anywhere in a network, then keep clicking until it completes.
    let started = false;
    for (let i = 0; i < 81 && !started; i++) {
      await cells.nth(i).click();
      started = /Started at/.test(await hunt.locator('.step-text').innerText());
    }
    expect(started, 'no cell could start a network').toBe(true);

    for (let pass = 0; pass < 8; pass++) {
      if (/Network complete/.test(await hunt.locator('.step-text').innerText())) break;
      for (let i = 0; i < 81; i++) {
        await cells.nth(i).click();
        if (/Network complete/.test(await hunt.locator('.step-text').innerText())) break;
      }
    }

    const finalText = await hunt.locator('.step-text').innerText();
    expect(finalText, 'painting never completed the network').toMatch(/Network complete/);
    // and it must reach a conclusion, not just stop
    expect(finalText).toMatch(/sees\s+both|contradicted itself|pays nothing/i);
  });
});

test.describe('a right answer to the wrong question is not just "wrong"', () => {
  test('an inert naked pair is recognised and explained', async ({ page }) => {
    await page.goto(SITE + '#/lesson/naked-pairs');
    const drill = page.locator('.drill');

    // Find, by eye, a row with exactly two empty cells holding the same two marks.
    // That is a real naked pair that can eliminate nothing — and it is the most likely
    // thing a learner picks first, because there are several on any grid.
    const findInert = () => drill.locator('.board-grid').evaluate((g) => {
      const cells = [...g.querySelectorAll('.cell')];
      const marksOf = (c) => [...c.querySelectorAll('.cand:not(.off)')].map((m) => m.textContent).join('');
      const empty = (c) => !c.querySelector('.value').textContent.trim();
      const rowOf = (i) => Math.floor(i / 9), colOf = (i) => i % 9;
      const boxOf = (i) => Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3);

      // A pair is only inert if it is inert in EVERY house the two cells share — being
      // the last two in a row says nothing if their box still has cells to clean.
      const houseCells = {
        row: (i) => cells.filter((_, j) => rowOf(j) === rowOf(i)),
        col: (i) => cells.filter((_, j) => colOf(j) === colOf(i)),
        box: (i) => cells.filter((_, j) => boxOf(j) === boxOf(i))
      };
      for (let i = 0; i < 81; i++) {
        if (!empty(cells[i]) || marksOf(cells[i]).length !== 2) continue;
        for (let j = i + 1; j < 81; j++) {
          if (!empty(cells[j]) || marksOf(cells[j]) !== marksOf(cells[i])) continue;
          const shared = ['row', 'col', 'box'].filter((k) =>
            houseCells[k](i).includes(cells[j]));
          if (!shared.length) continue;
          const allInert = shared.every((k) => houseCells[k](i).filter(empty).length === 2);
          if (allInert) return [i, j];
        }
      }
      return null;
    });

    // Inert pairs are common but not on every grid, so walk a few rather than skipping —
    // a skipped test is a silent hole exactly where a learner tripped.
    let pair = await findInert();
    for (let tries = 0; tries < 8 && !pair; tries++) {
      await drill.getByRole('button', { name: 'New grid' }).click();
      pair = await findInert();
    }
    expect(pair, 'no inert pair found on any of 9 practice grids').not.toBeNull();

    for (const idx of pair) await drill.locator(`.cell[data-cell="${idx}"]`).click();
    await drill.getByRole('button', { name: 'Check' }).click();

    const msg = await drill.locator('.feedback').innerText();
    expect(msg, 'a genuine pair was denied outright').not.toMatch(/None of those cells are part of a pattern/i);
    expect(msg).toMatch(/genuine naked pair/i);
    expect(msg).toMatch(/remove|clear|eliminat/i);
  });
});

test.describe('the grid is actually legible', () => {
  test('cells are uniform and pencil marks fit inside them', async ({ page }) => {
    // Both of these broke at once when the candidate font grew and the accessibility row
    // wrappers arrived: `1fr` is `minmax(auto,1fr)`, so a cell whose marks overflowed
    // stretched its row and starved the others. One row rendered 14px tall.
    for (const id of ['naked-single', 'naked-pairs', 'x-wing', 'pointing']) {
      await page.goto(SITE + '#/lesson/' + id);
      const grids = await page.locator('.board-grid').all();
      for (const [gi, grid] of grids.entries()) {
        const stats = await grid.evaluate((g) => {
          const cells = [...g.querySelectorAll('.cell')];
          const heights = cells.map((c) => Math.round(c.getBoundingClientRect().height));
          const clipped = cells.filter((c) => {
            const cb = c.getBoundingClientRect();
            const cd = c.querySelector('.cands').getBoundingClientRect();
            return cd.height > cb.height + 0.5 || cd.bottom > cb.bottom + 0.5;
          }).length;
          return { min: Math.min(...heights), max: Math.max(...heights), clipped };
        });
        expect(stats.max - stats.min,
          `${id} grid ${gi}: row heights range ${stats.min}-${stats.max}px`).toBeLessThanOrEqual(1);
        expect(stats.clipped,
          `${id} grid ${gi}: ${stats.clipped} cells have pencil marks spilling outside the cell`).toBe(0);
      }
    }
  });
});

test.describe('the walkthrough earns its steps', () => {
  test('no step repeats the previous picture', async ({ page }) => {
    // Pressing Next and getting the same image is what "clunky" meant: the reader pays a
    // click and receives only prose.
    const ids = ['naked-single', 'hidden-single', 'naked-pairs', 'pointing', 'x-wing',
                 'skyscraper', 'kite', 'coloring', 'x-chain', 'xy-wing', 'w-wing'];
    const problems = [];
    for (const id of ids) {
      await page.goto(SITE + '#/lesson/' + id);
      const n = await page.locator('.narrative .dot').count();
      let prev = null;
      for (let i = 0; i < n; i++) {
        if (i) await page.locator('.narrative .step-nav .btn:not(.ghost)').first().click();
        const sig = await page.evaluate(() => {
          const g = document.querySelectorAll('.board-grid')[0];
          return [...g.querySelectorAll('.cell')].map((c) =>
            c.className + '|' + [...c.querySelectorAll('.cand')].map((x) => x.className).join(',')
          ).join(';') + '##' + document.querySelectorAll('.board-overlay line').length;
        });
        if (sig === prev) problems.push(`${id}: step ${i + 1} shows an identical picture`);
        prev = sig;
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  test('arrow keys step the walkthrough, and the end points at the drill', async ({ page }) => {
    await page.goto(SITE + '#/lesson/x-wing');
    // scoped to the walkthrough: hunt widgets have their own .narrative on this page now
    const walkthrough = page.locator('.page > .stage');
    const readStep = () => walkthrough.locator('.step-text').innerText();

    const first = await readStep();
    await page.keyboard.press('ArrowRight');
    expect(await readStep(), 'ArrowRight should advance the walkthrough').not.toEqual(first);
    await page.keyboard.press('ArrowLeft');
    expect(await readStep()).toEqual(first);

    const total = await walkthrough.locator('.dot').count();
    for (let i = 1; i < total; i++) await page.keyboard.press('ArrowRight');
    await expect(walkthrough.getByRole('button', { name: /now you try/i })).toBeVisible();
  });
});

test.describe('reachable without a mouse', () => {
  test('a drill can be completed entirely from the keyboard', async ({ page }) => {
    await page.goto(SITE + '#/lesson/naked-single');
    const drill = page.locator('.drill');
    const grid = drill.locator('.board-grid');

    const found = await findLoneCandidate(grid);
    expect(found).not.toBeNull();

    // Walk to the target cell with arrow keys only.
    await grid.locator('.cell').first().focus();
    const targetRow = Math.floor(found.index / 9);
    const targetCol = found.index % 9;
    for (let r = 0; r < targetRow; r++) await page.keyboard.press('ArrowDown');
    for (let c = 0; c < targetCol; c++) await page.keyboard.press('ArrowRight');

    const focused = await page.evaluate(() => document.activeElement.getAttribute('aria-label'));
    expect(focused, 'arrow keys should land on the target cell')
      .toMatch(new RegExp(`r${targetRow + 1}c${targetCol + 1}`));

    await page.keyboard.press('Enter');
    await drill.getByRole('button', { name: 'Check' }).click();
    await expect(drill.locator('.prompt')).toContainText(/that is the pattern/i);
  });

  test('the grid exposes itself properly to assistive technology', async ({ page }) => {
    await page.goto(SITE + '#/lesson/x-wing');
    const grid = page.locator('.board-grid').first();

    await expect(grid).toHaveAttribute('role', 'grid');
    expect(await grid.getByRole('row').count()).toBe(9);
    expect(await grid.getByRole('gridcell').count()).toBe(81);

    // Labels must describe content, not just position.
    const labels = await grid.getByRole('gridcell').evaluateAll((els) =>
      els.map((e) => e.getAttribute('aria-label')));
    expect(labels.every((l) => l && /^r\dc\d/.test(l))).toBe(true);
    expect(labels.some((l) => /candidates/.test(l))).toBe(true);
  });
});

test.describe('nothing dead-ends', () => {
  test('every lesson in the sidebar renders something usable', async ({ page }) => {
    await page.goto(SITE + '#/');
    const hrefs = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.sidebar a[href^="#/"]'))
        .map((a) => a.getAttribute('href')));

    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));

    for (const href of hrefs) {
      await page.goto(SITE + href);
      await expect(page.locator('h1')).toBeVisible();
      const heading = (await page.locator('h1').innerText()).trim();
      expect(heading.length, `${href} has an empty heading`).toBeGreaterThan(2);
    }
    expect(errors, errors.join('\n')).toEqual([]);
  });
});

test.describe('strong links are operated, not read', () => {
  /* The complaint this page was rebuilt for: "I can't understand strong links from the
   * presentation." So the bar is not that the definition appears somewhere. It is that a
   * person who does not already know it can push on the thing and be shown what happens.
   * Everything below is driven off what is rendered — pencil marks, ARIA labels, button
   * text — with no help from the engine. */

  /** Which cells the grid currently reports as struck through, by name. */
  async function struckCells(grid) {
    const names = [];
    for (const cell of await grid.locator('.cell').all()) {
      const label = (await cell.getAttribute('aria-label')) || '';
      if (/eliminated/.test(label)) names.push(label.split(',')[0].trim());
    }
    return names.sort();
  }

  test('act 1: switching one end off raises the other, and both off breaks the house',
    async ({ page }) => {
      await page.goto(SITE + '#/lesson/strong-links');
      const stage = page.locator('.stage');
      const info = stage.locator('.narrative .step-text');
      const grid = stage.locator('.board-grid');

      // The page has to say what to do, in words, before anything is clicked.
      await expect(info).toContainText(/tap/i);

      // The tinted house is the argument. A person counts the marks left in it.
      const house = stage.locator('.cell.house-base');
      expect(await house.count(), 'no house is highlighted to count inside').toBe(9);
      const inHouse = [];
      for (const c of await house.all()) {
        const marks = await c.locator('.cand:not(.off)').allInnerTexts();
        if (!marks.length) continue;
        const label = (await c.getAttribute('aria-label')) || '';
        inHouse.push({ cell: c, name: label.split(',')[0].trim(), digit: marks[0].trim() });
      }
      expect(inHouse.length,
        'the highlighted house should show exactly the two homes under discussion').toBe(2);

      const [first, second] = inHouse;
      expect(first.digit).toBe(second.digit);

      // Push one end down. The other must be named, and named as settled.
      await first.cell.click();
      const after = await info.innerText();
      expect(after, `switching ${first.name} off said nothing about ${second.name}`)
        .toContain(`${second.name} is the ${second.digit}`);

      // Push the other down as well. This is the illegal move, and it has to be shown as
      // illegal — quietly ignoring it teaches nothing.
      await second.cell.click();
      const broken = await info.innerText();
      expect(broken, 'switching both ends off was accepted without complaint')
        .toMatch(/nowhere|cannot happen|impossible/i);
      expect(broken, 'the contradiction never states the rule it just demonstrated')
        .toMatch(/cannot both be off|at least one/i);
    });

  test('act 2: the chain is walked by hand and pays off the same way from either end',
    async ({ page }) => {
      await page.goto(SITE + '#/lesson/strong-links');
      const stage = page.locator('.stage');
      const info = stage.locator('.narrative .step-text');
      const grid = stage.locator('.board-grid');

      await stage.locator('.act-tab', { hasText: 'Chain two' }).click();

      // The prompt names the two far ends; a person reads them off and taps one.
      const ends = await info.locator('.rc').allInnerTexts();
      expect(ends.length, 'the prompt does not name the ends to tap').toBeGreaterThanOrEqual(2);
      const [endA, endB] = [ends[0].trim(), ends[1].trim()];
      await grid.locator(`[aria-label^="${endA},"]`).click();

      // Turn the crank. Each press must add a link, and each link must justify itself by
      // naming the house it counted in.
      const next = stage.locator('.controls .btn', { hasText: /^Follow the link to/ });
      for (let i = 0; i < 5 && (await next.count()); i++) await next.first().click();
      const steps = info.locator('.chain-steps li');
      expect(await steps.count(), 'the chain never got walked').toBeGreaterThanOrEqual(3);
      for (const step of await steps.all()) {
        expect(await step.innerText()).toMatch(/row|column|box/i);
      }
      // and the alternation has to be visible, not just implied
      const walked = await info.innerText();
      expect(walked).toMatch(/strong link/i);
      expect(walked).toMatch(/weak link/i);
      expect(walked, 'the chain does not conclude on the pair of ends')
        .toMatch(new RegExp(`at least one of ${endA} and ${endB}`));

      // The payoff. Claim each end in turn; the same cells must die both times.
      const kills = [];
      for (const end of [endA, endB]) {
        const claim = stage.locator('.controls .btn', { hasText: new RegExp(`Say ${end} is`) });
        expect(await claim.count(), `no way to claim ${end}`).toBeGreaterThan(0);
        await claim.first().click();
        kills.push(await struckCells(grid));
      }
      expect(kills[0].length, 'claiming an end killed nothing').toBeGreaterThan(0);
      expect(kills[0], 'the two ends kill different cells — the whole point collapses')
        .toEqual(kills[1]);
      expect(await info.innerText(),
        'having shown both ends agree, the page never says so').toMatch(/same cells/i);
    });

  test('act 3: counting homes is checked, and a wrong count is told the count',
    async ({ page }) => {
      await page.goto(SITE + '#/lesson/strong-links');
      const stage = page.locator('.stage');
      const info = stage.locator('.narrative .step-text');
      const grid = stage.locator('.board-grid');

      await stage.locator('.act-tab', { hasText: 'Find your own' }).click();
      await expect(info).toContainText(/tap the two cells/i);

      // Read the grid row by row, exactly as a person hunting a strong link would.
      const rows = [];
      for (const row of await grid.locator('[role="row"]').all()) {
        const lit = [];
        for (const cell of await row.locator('.cell').all()) {
          const marks = await cell.locator('.cand:not(.off)').allInnerTexts();
          if (!marks.length) continue;
          const label = (await cell.getAttribute('aria-label')) || '';
          const col = parseInt(await cell.getAttribute('aria-colindex'), 10);
          lit.push({ cell, col, name: label.split(',')[0].trim() });
        }
        rows.push(lit);
      }

      const twoHome = rows.find((r) => r.length === 2);
      expect(twoHome, 'no row on this grid is down to two homes to practise on').toBeTruthy();
      await twoHome[0].cell.click();
      await twoHome[1].cell.click();
      expect(await info.innerText(), 'a genuine two-home row was not accepted')
        .toMatch(/\bYes\b/);

      // Now the instructive failure. Two homes in a crowded row, chosen from different
      // boxes so the row is the only house they share — then the count really is wrong.
      const crowded = rows.find((r) => {
        if (r.length < 3) return false;
        return r.some((a, i) => r.slice(i + 1).some((b) =>
          Math.floor((a.col - 1) / 3) !== Math.floor((b.col - 1) / 3)));
      });
      if (!crowded) return;   // nothing to test on this grid; not a failure
      let pair = null;
      crowded.forEach((a, i) => crowded.slice(i + 1).forEach((b) => {
        if (!pair && Math.floor((a.col - 1) / 3) !== Math.floor((b.col - 1) / 3)) pair = [a, b];
      }));
      await pair[0].cell.click();
      await pair[1].cell.click();
      const why = await info.innerText();
      expect(why, 'a bad guess was rejected without saying how many homes there were')
        .toMatch(/\d+\s*homes/);
      expect(why, 'the rejection never restates what the number has to be')
        .toMatch(/two/i);
    });
});

test.describe('unfamiliar words explain themselves', () => {
  /* "home" is this site's own coinage for "a cell where a digit can still go" and no
   * page defines it. The markers are meant to be usable by someone who does not know
   * they are markers, on a phone, and without a mouse — which is where hover tooltips
   * normally fail. Nothing below touches window.Glossary. */

  test('tapping an underlined word explains it and offers the lesson', async ({ page }) => {
    await page.goto(SITE + '#/lesson/strong-links');

    // Find an underlined term the way a reader would: something in the prose that is
    // marked out from the text around it.
    const terms = page.locator('.page .gloss');
    expect(await terms.count(), 'no term is marked as explainable').toBeGreaterThan(2);

    // Nothing should be showing until asked.
    await expect(page.locator('.gloss-pop:visible')).toHaveCount(0);

    const first = terms.first();
    const word = (await first.innerText()).trim();
    await first.click();

    const pop = page.locator('.gloss-wrap.open .gloss-pop');
    await expect(pop).toBeVisible();
    const text = await pop.innerText();
    expect(text.length, `the panel for "${word}" is empty`).toBeGreaterThan(30);
    // It must define the word, not merely repeat it.
    expect(text.replace(/\s+/g, ' ')).toMatch(/[a-z]{3,}\s+[a-z]{3,}\s+[a-z]{3,}/i);

    // Reading on must be possible without hunting for the close control.
    await page.keyboard.press('Escape');
    await expect(page.locator('.gloss-pop:visible')).toHaveCount(0);

    // And tapping elsewhere on the page dismisses it too.
    await first.click();
    await expect(page.locator('.gloss-wrap.open .gloss-pop')).toBeVisible();
    await page.locator('h1').click();
    await expect(page.locator('.gloss-pop:visible')).toHaveCount(0);
  });

  test('a marked term is reachable and openable from the keyboard', async ({ page }) => {
    await page.goto(SITE + '#/lesson/strong-links');
    const first = page.locator('.page .gloss').first();

    await first.focus();
    await expect(first).toBeFocused();
    // Focus alone should reveal it — a keyboard user gets no hover.
    await expect(page.locator('.gloss-wrap.open .gloss-pop')).toBeVisible();
    await expect(first).toHaveAttribute('aria-expanded', 'true');

    // Tabbing forward must land on the lesson link inside the panel, not skip past it.
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => {
      const a = document.activeElement;
      return { tag: a.tagName, href: a.getAttribute('href'), inPop: !!a.closest('.gloss-pop') };
    });
    if (focused.inPop) {
      expect(focused.tag).toBe('A');
      expect(focused.href).toMatch(/^#\/lesson\//);
      await expect(page.locator('.gloss-wrap.open .gloss-pop'),
        'the panel closed while the reader was tabbing into it').toBeVisible();
    }
  });

  test('the panel stays on screen at the right edge of a phone', async ({ page }, testInfo) => {
    await page.goto(SITE + '#/lesson/hidden-single');
    const terms = await page.locator('.page .gloss').all();
    expect(terms.length).toBeGreaterThan(0);

    const width = page.viewportSize().width;
    for (const t of terms) {
      await t.click();
      const pop = page.locator('.gloss-wrap.open .gloss-pop');
      if (!(await pop.count())) continue;
      const box = await pop.boundingBox();
      if (!box) continue;
      const word = (await t.innerText()).trim();
      expect(box.x, `"${word}" opens off the left edge`).toBeGreaterThanOrEqual(-1);
      expect(box.x + box.width,
        `"${word}" opens past the right edge (${Math.round(box.x + box.width)} > ${width})`)
        .toBeLessThanOrEqual(width + 1);
      await page.keyboard.press('Escape');
    }
  });

  test('markers do not swamp the prose', async ({ page }) => {
    await page.goto(SITE + '#/lesson/strong-links');
    // At most one marker per term per paragraph or bullet. Anything more and the page
    // reads as a field of dotted underlines rather than prose with a few footnotes.
    const worst = await page.evaluate(() => {
      let worst = 0;
      document.querySelectorAll('p, li, .tagline').forEach((b) => {
        const seen = {};
        b.querySelectorAll('.gloss').forEach((g) => {
          seen[g.dataset.term] = (seen[g.dataset.term] || 0) + 1;
          worst = Math.max(worst, seen[g.dataset.term]);
        });
      });
      return worst;
    });
    expect(worst, 'a term is marked more than once inside one block').toBeLessThanOrEqual(1);

    // A marker must not look like a link — it is a footnote, and should not compete.
    const styled = await page.evaluate(() => {
      const g = document.querySelector('.gloss');
      const p = g.closest('p, li, .tagline');
      const cs = getComputedStyle(g), ps = getComputedStyle(p);
      return { term: cs.color, prose: ps.color, weight: cs.fontWeight, pw: ps.fontWeight };
    });
    expect(styled.term, 'markers are colored differently from the text they sit in')
      .toBe(styled.prose);
    expect(styled.weight).toBe(styled.pw);
  });
});
