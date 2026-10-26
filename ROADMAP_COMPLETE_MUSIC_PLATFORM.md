# Stem Lab — Complete Music Platform Development Plan

**Working branch:** `feat/stem-lab-studio-remix-workspace`  
**Product direction:** Complete Music Platform  
**Primary audiences:** creators and learners  
**Approach:** extend the existing React + Tailwind/shadcn UI and FastAPI/Spleeter/Librosa backend in small, testable increments. Preserve all current workflows while adding the studio experience.

## Product outcome

Turn the current stem extraction and music-analysis workflow into a cohesive workspace where a user can process a track, inspect its musical structure, mix stems, practice a passage, and export useful outputs without leaving the project.

## Guardrails

- Preserve file upload and YouTube URL input, 2/4/5-stem selection, Spleeter processing, chord/key/melody analysis, WebSocket job progress, individual WAV downloads, ZIP export, and PDF reports.
- Keep audio processing on the backend. Do not move Spleeter or Librosa work into the browser.
- Keep the current API/job flow compatible; add versioned or optional fields rather than silently changing existing response shapes.
- Treat extracted files and user project metadata separately. Do not make ephemeral Cloud Run local disk the only durable store for saved projects.
- Deliver a usable vertical slice before adding advanced editing or generative features. No AI-generated instruments in this phase.
- Never claim production readiness until automated tests and a real deployment smoke test pass.

## Phase 0 — Baseline and reliability (first)

**Goal:** establish a known-good baseline before building on top of it.

1. Map current frontend routes/components, FastAPI endpoints, job state, WebSocket messages, temporary-file lifecycle, and export paths.
2. Add/confirm automated checks: frontend production build, Python import/startup check, API health test, and tests for supported stem modes and invalid inputs.
3. Exercise upload and YouTube URL paths, 2/4/5-stem processing, chord/key analysis, job progress/failure, individual stem downloads, ZIP, and PDF.
4. Harden failure paths: useful user-facing errors, job cancellation where safe, temporary-file cleanup, upload limits, timeouts, and duplicate-job protection.
5. Document Cloud Run CPU/memory/timeouts/concurrency and verify storage/retention assumptions. Keep deployment configuration aligned with actual Spleeter resource needs.

**Acceptance criteria**
- Existing flows have a repeatable smoke-test checklist.
- Failures return actionable messages and do not leave unbounded temporary files.
- A clean frontend build and backend test run pass; deployment is smoke-tested before calling the phase complete.

## Phase 1 — Shared Studio playback and mixer (core product slice)

**Goal:** make the existing separated stems feel like one synchronized multitrack session.

1. Add a Studio view to the existing results flow; keep current download/report actions visible.
2. Build a shared transport: play/pause, seek, current time/duration, loop selection, and playback speed where supported.
3. Load all returned stem WAVs against one shared timeline. Prevent independent drift by driving playback from a single transport clock.
4. Add per-stem mute, solo, volume, and pan controls. Start with browser Web Audio API gain/pan nodes; avoid server-side re-rendering for live controls.
5. Add lightweight waveform/track-lane visualization and clear loading/error states for missing stem assets.
6. Add mix presets such as vocals focus, instrumental, rhythm focus, and study mode. Presets change UI mix state only and remain reversible.
7. Keep the existing 2/4/5 stem modes adaptive: render only tracks returned by the job; never assume piano exists.

**Acceptance criteria**
- Every available stem starts, seeks, loops, and stops in sync.
- Mute/solo/volume/pan are keyboard accessible and update playback immediately.
- Missing or failed stem audio does not break the whole result page.
- Existing individual download, ZIP, and PDF actions remain available.

## Phase 2 — Learning workspace

**Goal:** connect musical analysis to listening and practice.

1. Reuse existing chord/key/melody analysis outputs; normalize them into timestamped UI models without changing the extraction algorithm unnecessarily.
2. Synchronize the chord timeline and piano/keyboard view with the shared transport.
3. Let users click a chord or timeline position to seek playback; support a selectable loop range for repeated practice.
4. Add a learning mix preset that can lower or mute selected stems while the learner listens for a part.
5. Display confidence/unknown states when analysis is uncertain. Do not present estimated chords or melody as guaranteed transcription.
6. If adding transpose controls, clearly distinguish a visual chord-label transpose from actual pitch-shifted audio; do not imply audio has changed unless it has.

**Acceptance criteria**
- Chord focus follows playback time and clicking a chord seeks to its timestamp.
- Learners can loop a passage and isolate available stems.
- Existing key/chord/melody outputs remain accessible and uncertainty is communicated.

## Phase 3 — Basic remix and export

**Goal:** let creators create useful alternate versions from the separated audio.

1. Add non-destructive arrangement state: track gain/pan/mute, clip start/end, and arrangement order. Keep source stems untouched.
2. Add simple clip trim, move, duplicate, and arrangement operations only after synchronized playback is stable.
3. Start with deterministic effects and controls (gain and optional basic EQ/reverb/delay) with conservative defaults and bypass controls.
4. Export a mix to WAV in the browser where feasible, with explicit duration/sample-rate limits; otherwise add a backend render endpoint using the existing audio tooling.
5. Keep stem ZIP and individual WAV exports unchanged. Make export progress, errors, and size/time limits explicit.
6. Add a remix summary showing which tracks, ranges, and settings are included in the export.

**Acceptance criteria**
- A user can make a simple alternate mix without modifying original stem files.
- Exported audio reflects the chosen arrangement and mix settings.
- Export errors are recoverable, and original stem downloads continue to work.

## Phase 4 — Projects and persistence

**Goal:** allow users to return to work without repeating expensive separation.

1. Define a project manifest containing source metadata, processing options, analysis results, stem asset references, mix/arrangement state, and schema version.
2. Separate project metadata from binary audio storage. Use durable object storage for production assets and a database for project/job metadata when configured; use local storage only for development.
3. Add save/restore of mix and arrangement state before introducing accounts or collaboration.
4. Define retention, deletion, maximum upload size/duration, storage quotas, and cleanup jobs.
5. Add clear project states: uploading, processing, ready, failed, expired, and deleted. Make retry behavior explicit.
6. Keep persistence optional/configurable until a durable store is configured; do not imply projects survive ephemeral runtime restarts otherwise.

**Acceptance criteria**
- A saved project restores its tracks, analysis, and mix state without rerunning separation.
- Asset ownership, expiration, deletion, and failure behavior are documented and tested.
- Project schema is versioned for future migrations.

## Phase 5 — Production hardening and release

1. Add unit and integration tests for API validation, job lifecycle, WebSocket disconnect/reconnect, storage errors, exports, and project restoration.
2. Add frontend tests for transport synchronization, mixer state, chord seeking, empty/error states, and keyboard access.
3. Add structured logs and job identifiers; never log source media or secrets. Add basic metrics for queue wait, processing duration, failures, and export duration.
4. Validate CORS, upload limits, content types, YouTube URL handling, dependency pinning, and secrets/configuration management.
5. Run a clean Docker build and deployment smoke test using small known test audio; test a representative longer file separately.
6. Add user-facing troubleshooting and a release checklist. Roll out behind a feature flag or staged UI entry point if regression risk is high.

**Acceptance criteria**
- CI checks pass, critical user journeys are covered, and a deployed smoke test is recorded.
- Logs identify failing jobs without exposing user content.
- Rollback path and storage cleanup behavior are documented.

## Suggested delivery sequence

| Order | Deliverable | Priority |
|---|---|---|
| 1 | Baseline checks and reliability fixes | P0 |
| 2 | Synchronized Studio transport + per-stem mixer | P0 |
| 3 | Chord-following playback and practice loops | P1 |
| 4 | Non-destructive remix state and first WAV mix export | P1 |
| 5 | Durable project save/restore | P1 |
| 6 | Production monitoring, security checks, release validation | P0 before public launch |

## Keep out of the first release

- AI-generated instruments or full generative remixing.
- Real-time collaborative editing.
- Social feeds, public sharing, and complex account tiers.
- Advanced multitrack automation or plugin hosting.

These are attractive later extensions, but they add scope before the core studio, exports, persistence, and reliability are proven.

## First implementation ticket

**Build the synchronized Studio transport and mixer as a vertical slice.** Begin by tracing the existing result payload and stem download URLs, then implement a transport that can play all available stems in sync, mute/solo each stem, adjust gain/pan, and preserve all current result actions. Add tests around synchronization/state and verify the frontend production build before proceeding to chord-linked practice.
