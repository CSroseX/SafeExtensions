# SafeExtensions
<img src="https://img.shields.io/badge/JavaScript-ES2021-F7DF1E?logo=javascript&logoColor=000&style=for-the-badge"/> <img src="https://img.shields.io/badge/Chrome%20Extension-MV3-4285F4?logo=googlechrome&logoColor=white&style=for-the-badge"/> <img src="https://img.shields.io/badge/Privacy-Local%20Only-0F766E?logo=torbrowser&logoColor=white&style=for-the-badge"/> <img src="https://img.shields.io/badge/Security-Risk%20Scanner-111827?logo=shield&logoColor=white&style=for-the-badge"/> <img src="https://img.shields.io/badge/IndexedDB-Storage-4B5563?style=for-the-badge"/> <img src="https://img.shields.io/badge/HTML-CSS-E34F26?logo=html5&logoColor=white&style=for-the-badge"/> <img src="https://img.shields.io/badge/Notifications-Enabled-2563EB?style=for-the-badge"/>

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

## Future Work
- More fingerprinting and network heuristics
- Automated tests for risk rules and UI
- Store listing assets and release automation
- Optional TypeScript and linting/formatting configs

## Privacy
- No telemetry: nothing is tracked or sent anywhere
- No remote calls: works fully offline
- 100% local analysis & storage: all data stays on your device

## Contributing
See docs/CONTRIBUTING.md for guidelines focused on privacy-first, readable, auditable changes.

---
This project is licensed under the Mozilla Public License 2.0 (MPL-2.0). See [LICENSE](LICENSE).

Contributing: see [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md).

Contact: chitransh.saxena.contact@gmail.com
