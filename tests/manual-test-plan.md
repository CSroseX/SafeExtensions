# Manual Test Plan — SafeExtensions

## Scope
- Validate scanning, scoring, and actions using the provided safe/risky test extensions.
- Verify UI stats, details view, and action buttons.
- Capture defects and follow-up items.

## Environments
- Browser: Chrome 114+ (required for `management` permission)
- Profile: fresh profile recommended; enable developer mode to load unpacked extensions.

## Test Artifacts
- Safe extension: tests/test-extensions/safe-extension/manifest.json
- Risky extension: tests/test-extensions/risky-extension/manifest.json

## Test Cases
| ID | Area | Steps | Expected | Status |
| --- | --- | --- | --- | --- |
| TC-01 | Install safe extension | Load unpacked safe extension | Installs without errors | Not run (Chrome not available here) |
| TC-02 | Install risky extension | Load unpacked risky extension | Installs; warns about broad permissions | Not run |
| TC-03 | Initial scan | Open popup → Scan | Both extensions appear with scores; risky < safe | Not run |
| TC-04 | Stats counters | Check totals/safe/risky | Totals match results (safe=1, risky=1) | Not run |
| TC-05 | Disable risky | Click Disable on risky | Extension disabled; status reflected on rescan | Not run |
| TC-06 | Uninstall risky | Click Uninstall on risky | Extension removed after Chrome confirmation | Not run |
| TC-07 | View details | Click View details on each | Details modal opens with permissions/risks | Not run (modal missing in HTML) |
| TC-08 | Export report | Click Export report | CSV download (feature missing) | Not run (not implemented) |

## Edge Cases
- Zero extensions installed: list shows friendly empty state.
- Permission denied/system extensions: shows user-friendly error.
- IndexedDB corruption: recovers by recreating DB.

## Known Bugs / Gaps (pre-test)
- listeners.js uses non-existent management events; rescan triggers may be unreliable.
- popup.js expects a details modal element that is not present in popup.html.
- Export report button not implemented (alerts only).
- Data files empty (tracker-domains.json, risk-patterns.json, safe-developers.json) → limited risk detection.
- Inline onclick handlers in cards (XSS risk if data not sanitized).

## Execution Notes
- Tests not executed in this environment (Chrome not available). Run manually in Chrome with developer mode enabled.
- After execution, update the Status column and log any new defects below.

## Defect Log
- TBD — populate after running tests in Chrome.
