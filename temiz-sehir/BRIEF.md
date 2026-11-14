# "Temiz Şehir" (working title) — prototype brief

Owner: Eymen (Sancar Games, a tiny indie studio; shipped "Yıkım Ustası", about to ship "Sayı Yolu"). This is an EXPERIMENT to see whether his new game idea is fun and technically feasible on a phone. The manager (a Claude session acting as COO) runs a team of specialist agents; you are one of them. Do your part to professional standard, stay inside your scope, respect the contracts, and be honest about what you verified.

## The idea, in the owner's words (translated)
"A 3D game, first person. The currently very popular logic: you start tiny and keep upgrading your tools until you automate, and things that looked impossible at the start get done. My dream: a huge city where the ground is completely covered in trash — completely, no gaps. At first you pick trash up by hand and sell it at a shop; with the money you buy a broom, then you upgrade, then a robot vacuum, then a vacuum vehicle, and so on, tier by tier. I want it to be long-lasting. Landscape orientation. Not really a revenue game: it should spread our name; rewarded ads for money/boosts, and mostly promos of our other games. Optimisation is the big worry: the whole city is trash."

## What this prototype must prove (one vertical slice, 10–20 minutes of play)
1. THE LOOK: standing in a street where trash covers everything to the horizon, on an iPhone, at a smooth frame rate.
2. THE LOOP: pick up by hand (slow, a few items) → carry a limited load → sell at a shop → buy the broom (sweeps a strip, much faster) → bigger bag → first robot vacuum that cleans on its own while you work → a small ride-on vacuum cart (first vehicle) → the first district visibly goes from buried to clean, with a district-clean percentage and a satisfying "district cleaned" moment. Each tier must make the previous one feel slow, and automation must make the "impossible" amount start to melt.
3. THE FEEL: cleaning is satisfying moment to moment (trash reacts, sound, numbers, the clean ground revealed stays clean and you can see your trail from afar).
Not in scope: more than one district, story, real ads/IAP (a mock "watch ad → 2x for 2 min" button is enough), accounts, localisation beyond Turkish UI strings kept in one table (English second), polish of menus.

## Platform and tech (decided by the manager)
- Web tech, to be shown as a claude.ai web artifact and later wrappable with Capacitor: plain ES modules, **Three.js** loaded from `https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js` (global `THREE`; this exact version is known to be on cdnjs; no other libraries, no bundler, no npm at runtime). No external assets: everything procedural (geometry, textures drawn on canvas, sounds synthesised with Web Audio). Must run offline after load.
- Target: iPhone 12 and newer in LANDSCAPE, 60 fps goal, never below 30; DPR capped (render scale adaptive). It must also remain usable in PORTRAIT (the artifact preview may not rotate): same game, HUD re-flows, wider vertical FOV; do not block portrait with a "rotate your phone" screen.
- Touch controls: left thumb virtual stick to move, drag on the right half to look, context action button(s); also keyboard+mouse (WASD, pointer drag to look) for desktop testing. One-handed-friendly where possible. Safe areas respected.
- Save in localStorage key `temizsehir.v1` (versioned, tolerant of missing fields).
- Files live in /home/user/eymensancar/temiz-sehir/ : `www/index.html` (shell), `www/js/*.js` (ES modules, one owner each), `docs/` (design docs), `test/` (Playwright scripts). Final delivery also includes a single-file build `www/tek.html` produced by a small build script (inlines the modules) for the artifact.

## Working rules
- Work only in /home/user/eymensancar/temiz-sehir/ and only in the files assigned to you. Do not touch other folders of the repo, no git commands (the manager commits), no publishing.
- Playwright is pre-installed (`require('playwright')`, `chromium.launch()`; do NOT install it). Headless Chromium has WebGL via SwiftShader (software): fine for correctness and for counting draw calls/triangles, NOT for real fps; reason about performance with budgets (draw calls, triangles, texture memory, per-frame JS ms measured with performance.now()) and say clearly that real-device fps is unverified.
- Write down decisions and open questions in your doc; keep reports short and factual; separate "verified" from "assumed".
- Language: docs in English are fine; all player-facing text in Turkish (strings table), no emoji in UI text.
