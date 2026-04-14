# Racing Game Design

## Goal

Replace the current calculator page with a mobile-first top-down arcade racing game that runs as a static GitHub Pages site.

## Approved Direction

- Track style: top-down arcade
- Game mode: lap time attack
- Input: mobile swipe/drag steering first, desktop keyboard as backup
- Visual tone: clean sports
- Scope: one track with AI rival cars
- Deployment target: GitHub Pages via the `Helloworld` repository

## Architecture

The game will be a single-page static site built with plain HTML, CSS, and JavaScript. Rendering uses one canvas for the track, cars, and effects, while HTML overlays handle the title screen, HUD, and result panel.

Core gameplay logic is split into a reusable module so the race rules can be tested with Node's built-in test runner. Browser code handles rendering, animation timing, pointer input, resizing, and local persistence.

## Gameplay

- The player drives a single car around one circuit for a three-lap session.
- The car auto-accelerates and the player steers by dragging or swiping left and right.
- AI rivals follow the racing line with mild variation and visible but readable behavior.
- The primary result is best lap time; the race summary also shows total time and finishing order.
- Best lap is persisted with `localStorage`.

## Race Rules

- Lap completion requires sequential checkpoint progress.
- Crossing the finish line early does not count unless every checkpoint has been visited in order.
- Leaving the track applies grip loss and speed penalties.
- Car-to-car contact causes mild separation and a short speed loss instead of hard failure.

## UI

- Start overlay: game title, input hint, start action
- HUD: current lap, best lap, current lap timer, speed
- Result overlay: best lap, total time, restart action

The look stays bright and sporty with a pale track surface, strong boundary colors, sharp typography, and restrained motion.

## Verification

- Sequential checkpoint and lap completion logic covered by automated tests
- Track membership and gate crossing logic covered by automated tests
- Manual browser verification for touch steering, keyboard fallback, AI movement, and local best-lap persistence

## Deployment

The site remains static so GitHub Pages can serve the repository root directly. After implementation and verification, the work will be committed, merged into `main`, pushed, and the final Pages URL will be checked.
