# Changelog

## [1.1.0] - 2026-03-09
### Security (Critical Fixes)
- **Fixed DOM XSS vulnerability**: Replaced all `innerHTML` rendering with safe `createElement` + `textContent` APIs across popup components and modal
- **Removed production debug logging**: Eliminated all `console.log` and `console.debug` from runtime code paths
- **Added external link hardening**: Implemented `rel="noopener noreferrer"` on all `target="_blank"` links to prevent reverse-tabnabbing

### Fixed
- Fixed manifest icon dimension mismatch (regenerated 16x16, 48x48, 128x128 pixel-perfect assets)
- Removed unused high-privilege permissions: `alarms` and `notifications` from manifest
- Improved async error handling: Added `chrome.runtime.lastError` checks and user-facing error toasts
- Implemented IndexedDB quota recovery: Clear stale scans and retry on quota exceeded
- Removed dead code: Deleted unused `background/listeners.js` module

### Improved
- Consolidated grade mapping to single source of truth in `libs/utils.js` (letter grades: A+/A/B/C/F)
- Enhanced documentation accuracy: Updated README with manifest permissions, onboarding tour, and disclaimer modal features
- Removed personal email exposure from public-facing docs (README, Privacy Policy, Code of Conduct, issue templates)
- Updated PROJECT_DETAILS.md to reflect latest architecture and features

### Added
- Added `homepage_url` to manifest for Chrome Web Store metadata completeness
- Populated data files with starter datasets:
  - `risk-patterns.json`: Suspicious URLs, keywords, and dangerous permissions
  - `safe-developers.json`: Trusted developers and verified publishers (for future use)

### Documentation
- Updated README with complete feature list and manifest permissions disclosure
- Fixed branding inconsistency (SafeExtension → SafeExtensions)
- Aligned Privacy Policy with actual manifest permissions
- Created comprehensive version management release guide

---

## [1.0.0] - 2025-01-XX
### Added
- Initial release
- Extension scanning and risk analysis
- Privacy scoring (0-10 scale)
- One-click disable/uninstall
- Export reports (CSV)
- Automatic daily rescans

### Security
- 100% local processing
- Zero data collection
- Open-source code
