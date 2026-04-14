# Racing Game Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the existing calculator with a mobile-first top-down racing game and deploy it on GitHub Pages.

**Architecture:** Keep the app as a static site with a single canvas-based game scene and HTML overlays for UI. Extract race rules and geometry helpers into a testable ES module, then let the browser entrypoint handle rendering, input, animation, and persistence.

**Tech Stack:** HTML, CSS, vanilla JavaScript ES modules, Node built-in test runner, GitHub Pages

---

### Task 1: Add the test harness and the first failing race-rule tests

**Files:**
- Create: `package.json`
- Create: `tests/game-core.test.js`
- Create: `game-core.js`

**Step 1: Write the failing test**

Add tests for:
- gate crossing detection from movement segments
- rejecting out-of-order checkpoint progress
- completing a lap only after every checkpoint is visited in order
- detecting when a point is outside track bounds

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL because `game-core.js` exports and logic do not exist yet

**Step 3: Write minimal implementation**

Implement only the geometry and lap-state helpers required to satisfy the tests.

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add package.json tests/game-core.test.js game-core.js
git commit -m "test: add race core coverage"
```

### Task 2: Replace the calculator markup with the racing game shell

**Files:**
- Modify: `index.html`
- Modify: `styles.css`

**Step 1: Write the failing test**

Add or extend a test that asserts required DOM-facing labels and configuration constants exist in the entrypoint contract, such as HUD labels and lap count defaults.

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL because the contract is not exposed yet

**Step 3: Write minimal implementation**

Replace the calculator layout with:
- title overlay
- HUD
- canvas stage
- result overlay

Style the page in a clean sports direction with responsive mobile-first spacing.

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add index.html styles.css tests/game-core.test.js
git commit -m "feat: add racing game shell"
```

### Task 3: Build the runtime game loop and player handling

**Files:**
- Modify: `script.js`
- Modify: `game-core.js`
- Modify: `tests/game-core.test.js`

**Step 1: Write the failing test**

Add tests for:
- steering input normalization
- lap timer formatting helpers
- AI progress ordering helper

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL because helper behavior is missing

**Step 3: Write minimal implementation**

Implement:
- canvas bootstrap and resize handling
- pointer-based steering with keyboard fallback
- player physics, off-track slowdown, and wall recovery
- AI rival updates using the racing line and offset targets
- HUD and result updates

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add script.js game-core.js tests/game-core.test.js
git commit -m "feat: implement racing gameplay"
```

### Task 4: Verify locally and prepare the Pages deploy

**Files:**
- Modify: `README.md`

**Step 1: Write the failing test**

Document verification commands and expected behavior before claiming completion.

**Step 2: Run verification**

Run:
- `npm test`
- `python3 -m http.server 4173`
- open the page in a browser and verify touch/drag steering, keyboard fallback, AI rivals, lap timing, result screen, and best-lap persistence

**Step 3: Write minimal implementation**

Update `README.md` with local run instructions and the expected GitHub Pages URL.

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add README.md
git commit -m "docs: add racing game usage notes"
```
