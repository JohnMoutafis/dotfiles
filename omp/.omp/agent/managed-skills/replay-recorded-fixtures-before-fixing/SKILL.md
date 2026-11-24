---
name: replay-recorded-fixtures-before-fixing
description: "When fixing a derived-data defect in this repo, measure the blast radius against every recorded carrier fixture before choosing the rule, and prefer the recorded end-to-end fixtures over hand-built event lists as smoke evidence."
---

# Replay recorded fixtures before changing a derivation

Trigger: a defect report names one bad output from a derivation (legs, path,
ETA, normalization). Before writing the fix, establish what the change does
to every other recorded payload.

## 1. Find the recordings

`app/cli/track/<carrier>/<BOL>_<CID>.json` holds full `to_tracking_response()`
envelopes: `dcsa.response`, `legs.response`, `eta`, `path`, `origin`,
`destination`. They are gitignored (`app/cli/track/.gitignore` = `*`) and are
local captures, not test fixtures — read them, never commit over them.

`tests/fixtures/**` holds the committed fixtures, including per-carrier raw
HTML/JSON and `tests/fixtures/dcsa/*_legs.json` regression references.

## 2. Re-derive the affected subsystem from each recording

Adaptors already exist and are the right tool:
- `dcsa_events_to_tracking_events` in `tests/core/tracking/test_legs.py`
  converts a recorded `dcsa.response` back into internal `TrackingEvent`s.
- For end-to-end, `tests/core/tracking/test_evergreen_integration.py`
  exposes `_install_stubs` + `carrier_dispatch(...).track_container(...)`,
  which replays real scraped HTML through scrape -> normalize -> engine.

Then diff before/after leg counts per fixture. A rule that changes exactly the
reported fixture and nothing else is the signal the root cause was found.

## 3. Beware fixture-derived false positives

Two recorded shapes look like self-legs but are NOT the bug:
- `zim/bkp_*`: `GRPIR -> GRPIR` with *different* timestamps (ACT 08-24 -> EST
  08-31) — a real stay with a planned vessel departure.
- `msc/027PI0019400_*`: legs whose origin and destination locodes are both
  `null` — location names differ, so boundaries are real.

Only a leg whose origin and destination are the *same observation* is degenerate.

## 4. End-to-end smoke

`Container.to_tracking_response()` does NOT compute the path. `calculate_path()`
and `calculate_eta(session)` are separate steps called by the CLI, the API
endpoint, and `ActiveShipmentTrackingService`. A test asserting on
`response["path"]` must call `await container.calculate_path()` first.

Anything with vessel legs calls AIS (`postgrest_get` via
`app.core.tracking.path.postgrest_get`) and will hit the network unless patched
with `AsyncMock(return_value=[])`. Keep that patch in scope around the whole
flow, including `calculate_eta` — patch context managers that close before
`calculate_eta` will make a live call and raise a 500.
