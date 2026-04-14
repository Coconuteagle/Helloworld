# Racing Controls Upgrade Design

## Goal

Expand the current `Apex Sprint Lap` single-track prototype into a configurable arcade racer with multiple circuits, adjustable session settings, and virtual touch controls built around a steering wheel plus action buttons.

## Approved Direction

- Settings available before a race and from a pause menu
- Track presets: 5
- Session settings: AI count `0-7`, laps `1-10`
- Control scheme: left steering wheel, right brake/boost/drift buttons
- Right controls: all three buttons present
- Technical course should be visibly more twisty than the current layout

## Product Shape

The start overlay becomes a race hub. It introduces the game, shows the selected course, and exposes selectors for track, laps, and AI count. Starting a race locks those values for the current run.

During a race, the HUD gains a pause action. Pause opens a compact settings overlay that mirrors the same controls and uses `Apply & Restart` to rebuild the session safely.

## Tracks

Five named presets share the same renderer and physics but provide different centerline data, width, camera feel, and AI pace:

- Rookie Loop: forgiving starter layout
- Velocity Ring: fast, broad corners
- Grand Circuit: balanced default route
- Marathon Bend: longer lap with bigger rhythm changes
- Technical Maze: tighter and more winding route

Each track is defined by explicit point data rather than random generation so lap timing, AI behavior, and checkpoint ordering remain testable.

## Controls

Swipe steering is removed. A virtual wheel lives in the lower-left corner and reports a normalized steering value based on its rotation angle. Releasing the wheel recenters it.

The lower-right control stack provides:

- Brake: stronger deceleration and extra stability
- Boost: a short speed surge using a rechargeable meter
- Drift: reduced grip plus increased turning rate at speed

Keyboard fallback remains available for desktop use.

## Session Rules

- Track, lap count, and AI count come from the selected preset state
- Pause menu changes do not alter the current race instantly
- `Apply & Restart` rebuilds the race with the new settings
- Best lap is stored per track so the player can compare layouts fairly

## UI Direction

The visual language stays within the current clean-sport identity, but the overlays become more purposeful:

- Start hub with segmented selectors and richer course cards
- Pause panel that feels operational rather than modal-heavy
- HUD additions for course name, boost meter, and pause access
- Control surfaces that read clearly on touch screens without covering the race line too aggressively

## Verification

- Automated tests for track preset creation, lap-state initialization with variable lap counts, steering wheel normalization, and control-state handling
- Manual verification for wheel feel, action buttons, pause/apply flow, each track loading correctly, and AI count range behavior

## Deployment

The project remains a static HTML/CSS/JS site served from the repository root, so the existing GitHub Pages setup remains valid after the updated `main` branch is pushed.
