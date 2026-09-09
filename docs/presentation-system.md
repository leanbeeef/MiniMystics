# Presentation system

Mini Mystics still uses Next.js App Router, React `GameProvider`, the existing combat engine, and the existing Pixi particle layer. Presentation does not calculate damage, roll a second die, change card definitions, or write animation state to a save. The only engine additions are actor/target IDs and move index on existing action log events, so duplicate names can be animated correctly.

## Animation architecture

- `lib/animations/config.ts`: shared Minimal, Standard and Cinematic presets, accessibility overrides, particle budgets, and separate transition delays.
- `lib/animations/battle-events.ts`: compares committed battle snapshots and new log events to produce presentation actions. Power deltas, newly applied effects, recovery changes, failures, advantage and defeat become structured feedback.
- `lib/animations/attack-animations.ts`: reusable GSAP movement/projectile/impact timeline. Cancelling or leaving the battle reverts the timeline and removes transient elements.
- `components/battle/battle-animation-controller.tsx`: runs presentation after a committed action. A display snapshot holds the old bars until impact, while authoritative state and cloud sync already contain the outcome. Motion animates selection, bars, text and announcements. Specials show the 3D die spin, allow the die to settle, and hold the final number and success/failure result for a full second before impact. This reading pause is independent of animation mode and battle speed. The die reads the committed roll event (including self-targeted and opponent Specials); it never rerolls. Reduced Motion shows the settled result without spinning.
- `components/vfx/vfx-manager.tsx`: extends the existing Pixi system, including Order colors, settings-driven timing/counts and a simultaneous-effect cap. It queries targets inside the content scope rather than the empty canvas host. Pixi/WebGL is optional; DOM feedback remains available if initialization fails. Minimal, particles Off and Reduced Motion avoid loading a particle canvas.

Typical Basic/Special/Apex durations are 240/360/380 ms in Minimal, 520/850/1100 ms in Standard, and 700/1300/2400 ms in Cinematic. The animation controller only holds local UI choices while presenting; it never holds the game save or synchronization. Battle Speed changes the gap between automated transitions (80/220/650 ms), not those durations. Auto Advance off exposes Continue at introduction and before the AI action, without choosing player actions.

To add an attack visual, extend the shared timeline or add a preset in `lib/vfx/presets.ts`, then choose it in the controller. Take the canonical accent from `ORDER_COLORS`. Keep transforms and opacity scoped to this battle; never animate all pages with GSAP's global timeline.

To add a Special visual, extend the feedback classification in `battle-events.ts` and its preset mapping in the controller. Classify existing effect grammar (`statModifier`, healing, untouchable, recovery, debuffs) instead of branching on card IDs. Failed activations receive failure feedback only. New mechanics need their own rule work; a visual category must not imply an effect that the engine did not apply. Untouchable has a barrier label, not an invented shield amount. No new critical-hit system exists. The catalog currently has no Apex entries; that presentation tier is ready for future definitions and is tested with a synthetic battle fixture.

Handlers in this repository are **passive only**. Their existing ability names and beneficiaries remain visible, with a distinct passive-card fade when the turn changes. There are no active Handler rolls, named Handler action buttons, or manual End Turn in the current engine. Confirm End Turn is explicitly disabled with an explanation, rather than pretending to work. Adding active Handler actions is outside this presentation change.

Defeated Mystics retain the original disabled battlefield slot and fade to the existing defeated appearance; their authoritative `defeated` flag remains immediate. No slot is removed from the engine roster. Order Synergy displays every bonus already present on the team; it does not recount Handlers or calculate new bonuses. Damage Details uses `previewDamage` and existing read-only values, with the limitations of one-use defenses stated in the UI.

## Settings

`lib/settings.ts` owns versioned defaults, validation, serialization and migration fallback. `SettingsProvider` is mounted once inside `GameProvider` in the root layout. Use `useSettings()` to read preferences/config or `update(group, key, value)` to change them. Storage is the localStorage key `mini-mystics.settings`, version 1. Preferences are device-wide, independent of authentication and the game-state database. `/settings` is available while signed out. Changes save automatically, synchronize between tabs, and apply immediately. Unavailable storage keeps the current session functional and reports that saving failed.

The initial server/client render uses the same defaults to avoid hydration mismatch. After mounting, device defaults and saved values load; controls remain disabled until ready. Future settings schemas should migrate by version in `readSettings`. Unknown keys/enum values are ignored, volume ranges clamped, malformed/future saves fall back safely. Reset asks for confirmation and restores device defaults, without altering game progress.

Reduced Motion follows `prefers-reduced-motion` until explicitly changed. The persisted `motionExplicit` flag distinguishes a user choice from an inherited default. Reset removes that override. Reduced Motion forces Minimal timings, removes translation/projectiles/ambient particles, disables shake and flashes, and replaces the pack flip with a fade. Changing it during a cinematic cancels that presentation and shows the committed outcome. Screen Shake and Disable Flash Effects independently gate their respective effects. Existing CSS effects also consume preference overrides. Colorblind modes change UI feedback and patterned status indicators, never artwork or canonical Order art.

## Audio

`lib/audio/manager.ts` is the single HTMLAudioElement owner. It provides music/SFX playback, looping, volume controls, mute/unmute, pause/resume and teardown. Effective gain is master × category gain; quieter UI effects receive an additional gain reduction. It unlocks following pointer/keyboard interaction, catches autoplay failures, retries after another interaction, throttles click/hover sounds and caps concurrent voices. Major effects preempt lower-priority voices. Menu/battle changes crossfade over 400 ms. Results stop battle music and begin their stinger after the battle presentation completes. Hidden tabs pause music. The existing `mini-mystics:audio` hooks are mapped centrally by `AudioBridge`.

`lib/audio/registry.ts` contains all paths and hook names. The repository currently ships **no audio assets**, so `AVAILABLE_AUDIO` is empty and the game is silent. Missing slots cause no requests, 404 spam or rejected playback promises. To add music or SFX:

1. Obtain appropriately licensed audio.
2. Put music in `public/audio/music/` and SFX in `public/audio/sfx/`.
3. Use the exact kebab-case filenames in `MUSIC`/`SFX` (MP3 by default).
4. Add each actual registry path to `AVAILABLE_AUDIO`, for example `new Set([MUSIC.menu, SFX["attack-hit"]])`.
5. For a new sound, extend `SFX_NAMES` and, if driven by an existing hook, `AUDIO_HOOKS`. Call `audioManager.playSFX(name)` rather than constructing another player.

Music slots: `menu-theme.mp3`, `battle-theme-01.mp3`, `victory.mp3`, `defeat.mp3`. Additional battle tracks can be added to `MUSIC`; no random-track behavior is currently required. SFX slots include every UI, attack, status, Handler, defeat and rarity event listed in the registry, including `alpha-reveal.mp3` and `apex-reveal.mp3`. Handler active-action slots are reserved for future engine support. A configured file that fails to load is suppressed for the rest of that session. No synthetic binary or commercial song is bundled.

## Verification

- `npm test`: settings persistence/validation, preset/accessibility overrides, audio gating/volumes/priorities/failures, presentation adaptation and the existing combat/pack suites.
- `npx tsc --noEmit --incremental false`: application and test type checks.
- `npm run test:presentation`: isolated headless Chrome checks for settings refresh/reset, browser motion overrides, immediate committed battle damage, impact/defeat feedback, manual continuation, Special failure, pack reveal and landscape layout. Requires installed Chrome (or change Playwright's channel). Uses port 3100, `.next-presentation`, a test-only public auth configuration and intercepted API requests; no real account or remote game state is modified. Screenshots go to ignored `test-results/`.

Listen to the final mix on desktop/mobile after supplying real files; silent placeholder slots and mocked audio tests cannot verify artistic quality, licensing or loudness. No deployment is performed by these commands.

Library references: [Motion transitions](https://motion.dev/docs/react-transitions), [GSAP timelines](https://gsap.com/docs/v3/GSAP/Timeline/), [Playwright browser configuration](https://playwright.dev/docs/test-use-options).
