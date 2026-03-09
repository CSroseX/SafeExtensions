# SafeExtensions
[![JavaScript ES2021](https://img.shields.io/badge/JavaScript-ES2021-F7DF1E.svg?logo=javascript&logoColor=000)](https://developer.mozilla.org/docs/Web/JavaScript)
[![Chrome Extension MV3](https://img.shields.io/badge/Chrome%20Extension-MV3-4285F4.svg?logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Privacy Local Only](https://img.shields.io/badge/Privacy-Local%20Only-0F766E.svg)](docs/PRIVACY_POLICY.md)
[![Security Risk Scanner](https://img.shields.io/badge/Security-Risk%20Scanner-111827.svg)](docs/RISK_ANALYZER_DOCUMENTATION.md)
[![IndexedDB Storage](https://img.shields.io/badge/IndexedDB-Storage-4B5563.svg)](https://developer.mozilla.org/docs/Web/API/IndexedDB_API)
[![HTML/CSS](https://img.shields.io/badge/HTML-CSS-E34F26.svg?logo=html5&logoColor=white)](https://developer.mozilla.org/docs/Web/HTML)


SafeExtensions scans installed Chrome extensions locally to surface privacy risks. All analysis stays on-device with transparent, deterministic logic.

## Quick Start
1. Load unpacked: open chrome://extensions, enable Developer mode, choose this folder.
2. Click the toolbar icon to run a scan and view scores.
3. Disable or uninstall risky extensions directly from the popup.

## Feature Overview
| Feature | Description | Status |
| --- | --- | --- |
| Local scanning | Analyzes installed extensions without sending data out | ✅ |
| Risk scoring | 0-10 score with severity badges | ✅ |
| Permission and host review | Flags dangerous permissions and broad host access | ✅ |
| Tracker checks | Detects known tracker domains | ✅ |
| Actions | Disable or uninstall from the popup | ✅ |
| CSV export | Download scan summaries | ✅ |
| IndexedDB storage | Persists scan results locally | ✅ |
| Onboarding tour | Guided first-run walkthrough in popup | ✅ |
| Safety disclaimer | Built-in disclaimer modal for risk interpretation | ✅ |

## Manifest Permissions
- `management`: read installed extension metadata for local analysis
- `storage`: save scan results and onboarding state locally

## Future Work
- More fingerprinting and network heuristics
- Automated tests for risk rules and UI
- Store listing assets and release automation
- Optional TypeScript and linting/formatting configs

## What makes SafeExtensions safer than others?
- No telemetry: nothing is tracked or sent anywhere
- No remote calls: works fully offline
- 100% local analysis & storage: all data stays on your device

## Contributing
Want to contribute? see [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for guidelines focused on privacy-first, readable, auditable changes.

---
This project is licensed under the Mozilla Public License 2.0 (MPL-2.0). See [LICENSE](LICENSE).

Support: Open an issue at https://github.com/CSroseX/SafeExtensions/issues
