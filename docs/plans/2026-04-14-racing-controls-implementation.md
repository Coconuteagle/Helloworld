# Racing Controls Upgrade Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add configurable tracks, laps, AI count, pause/settings menus, and steering-wheel touch controls to the racing game.

**Architecture:** Extend the current static game by moving track and session configuration into data-driven helpers in `game-core.js`, then rebuild the browser runtime around a persistent settings state and a new virtual-controller layer. Keep all gameplay in the existing canvas entrypoint while using HTML overlays for race setup and pause/apply flows.

**Tech Stack:** HTML, CSS, vanilla JavaScript ES modules, Node built-in test runner, GitHub Pages

---

### Task 1: Add failing tests for settings and track presets

**Files:**
- Modify: `tests/game-core.test.js`
- Modify: `game-core.js`

**Step 1: Write the failing test**

Add tests for:
- creating five track presets by key
- variable lap-count state initialization
- steering wheel angle normalization
- boost meter recharge clamping

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL because new helpers and preset data do not exist yet

**Step 3: Write minimal implementation**

Implement only the data helpers and pure functions needed by the tests in `game-core.js`.

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add game-core.js tests/game-core.test.js
git commit -m "test: cover racing settings helpers"
```

### Task 2: Replace the start/result shell with configurable race menus

**Files:**
- Modify: `index.html`
- Modify: `styles.css`

**Step 1: Write the failing test**

Add a test or contract assertion for the default settings object exported by the runtime module.

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL because the runtime settings contract is not exposed yet

**Step 3: Write minimal implementation**

Update the markup and styles to include:
- start hub with track/lap/AI controls
- pause button and pause overlay
- boost meter display
- wheel and action-button control surfaces

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add index.html styles.css
git commit -m "feat: add race setup and pause menus"
```

### Task 3: Implement settings-driven track/runtime state

**Files:**
- Modify: `script.js`
- Modify: `game-core.js`
- Modify: `tests/game-core.test.js`

**Step 1: Write the failing test**

Add tests for:
- applying session settings to lap state and rival generation
- track-key best-lap storage key generation
- steering wheel angle to steer-value conversion

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL because the runtime helpers are missing

**Step 3: Write minimal implementation**

Implement:
- shared settings state
- five track presets and track rebuild logic
- dynamic rival count and lap count handling
- per-track best-lap persistence
- pause/apply/restart flow

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add script.js game-core.js tests/game-core.test.js
git commit -m "feat: wire configurable race sessions"
```

### Task 4: Replace swipe controls with wheel and action buttons

**Files:**
- Modify: `script.js`
- Modify: `styles.css`
- Modify: `tests/game-core.test.js`

**Step 1: Write the failing test**

Add tests for:
- wheel angle clamping and reset behavior
- brake/boost/drift control state transitions
- boost meter spend and recharge boundaries

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL because the new control helpers do not exist yet

**Step 3: Write minimal implementation**

Implement:
- wheel pointer interaction and normalized steering output
- brake button stability behavior
- boost consumption/recharge meter
- drift mode physics changes
- keyboard fallback mappings

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add script.js styles.css tests/game-core.test.js
git commit -m "feat: add wheel and action controls"
```

### Task 5: Verify locally and update docs

**Files:**
- Modify: `README.md`

**Step 1: Write the failing test**

Document the new control and settings expectations before claiming completion.

**Step 2: Run verification**

Run:
- `npm test`
- `node --check script.js`
- serve locally and verify each track, pause/apply flow, and touch control layout in a browser

**Step 3: Write minimal implementation**

Update `README.md` with the new controls, settings, and track list.

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add README.md
git commit -m "docs: update racing controls guide"
```
