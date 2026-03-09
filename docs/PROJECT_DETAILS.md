# SafeExtensions - Complete Project Documentation

## Project Overview
- **Name:** SafeExtensions
- **Version:** 1.1.0
- **Type:** Chrome Extension Manifest V3
- **Purpose:** Local privacy risk scanner for installed Chrome extensions with comprehensive risk detection, scoring, and management capabilities
- **Goal:** Scan installed Chrome extensions locally and surface robust, hard-to-bypass privacy risks with clear explanations and controls
- **Architecture:** Event-driven architecture with background service worker, popup UI, IndexedDB persistence, and modular component system
- **Minimum Chrome Version:** 114
- **Core Focus:** Multi-layered privacy detection using permission analysis, dangerous permission combinations, host permission breadth analysis, known tracker detection, Content Security Policy analysis, update URL validation, and temporal age analysis
- **Privacy Philosophy:** 100% local operation with zero data collection or external transmission
- **License:** Mozilla Public License 2.0 (MPL-2.0)
- **Author:** SafeExtensions Maintainers
- **Repository:** https://github.com/CSroseX/SafeExtensions.git
- **Development Status:** Production-ready version 1.1.0 with full feature implementation

**Manifest Configuration**
- **Manifest Version:** 3
- **Permissions Required:**
	- **management:** Access Chrome extension management API to enumerate, enable, disable, and uninstall extensions; retrieve extension metadata including permissions, host permissions, icons, version, install type
	- **storage:** Access Chrome local storage API for onboarding tour completion state tracking
- **Background Service Worker:** Runs persistently via background/service-worker.js as ES6 module to handle rescan requests, extension state change events, and initial installation scan
- **Action Popup:** Default popup at popup/popup.html with 400x700px dimensions; extension toolbar icon with 16x16, 48x48, 128x128 variants
- **Icons:** Three sizes provided at assets/icons/ directory (icon-16.png, icon-48.png, icon-128.png) for different display contexts in Chrome UI
- **Content Security Policy:** Compliant with MV3 restrictions; no inline scripts; no eval; all JavaScript loaded from extension package; custom CSS replaces Tailwind CDN for CSP compliance

**Development Dependencies and Configuration**
- **DevDependencies:** ESLint ^8.57.0 for code quality and consistency
- **ESLint Configuration:**
	- **Environment:** Browser, ES2021, webextensions, Node.js
	- **Extends:** eslint:recommended ruleset
	- **Parser Options:** ECMAScript latest version with ES6 module sourceType
	- **Rules:** 
		- no-unused-vars: warn level with argsIgnorePattern for underscore-prefixed params
		- no-console: off (allows console logs for debugging)
		- semi: error with always enforcement for semicolons
		- quotes: error with single quote preference and avoidEscape option
	- **Ignore Patterns:** node_modules/, dist/, *.min.js
- **NPM Scripts:**
	- lint: Run ESLint across all files
	- lint:fix: Run ESLint with auto-fix
	- test: Execute tests via tests/run-tests.js
	- validate: Validate JSON files via tests/validate-json.js

**Key Components**
- **Background Service Worker:** background/service-worker.js
	- **ES6 Module:** Loaded as type module for modern JavaScript syntax and import/export capabilities
	- **Installation Handler:** chrome.runtime.onInstalled listener triggers immediate initial scan on extension first install or update
	- **Message Routing:** chrome.runtime.onMessage listener receives rescan requests from popup; returns async response with scan result summary including total, active, disabled counts, and deleted count
	- **Rescan Coordination:** Delegates to scanExtensions function; sends success/error response back to popup with result metadata
	- **Extension State Change Monitoring:** Four chrome.management event listeners for onEnabled, onDisabled, onInstalled, onUninstalled
	- **Debounced State Change Handler:** 500ms debounce timeout prevents rapid double rescans; triggers full rescan and broadcasts extension-state-changed message to popup for UI refresh
	- **State Update Function:** updateExtensionState updates enabled field in IndexedDB when extensions are toggled without full rescan
	- **Event Broadcasting:** Sends extension-state-changed action to popup via chrome.runtime.sendMessage to trigger UI refresh without user interaction
	- **Logging:** Comprehensive console logs with emoji prefixes for install, rescan requests, state changes, errors for debugging and monitoring

- **Scanner Module:** background/scanner.js
	- **Main Export:** scanExtensions async function returns promise resolving to scan summary with total, active, disabled, deleted counts
	- **Extension Discovery:** chrome.management.getAll callback retrieves all installed extensions including enabled and disabled
	- **Type Filtering:** Filters results to type equals extension, excludes themes, apps, other extension types
	- **Count Calculation:** Computes enabledCount and disabledCount from filtered extension list for dashboard statistics
	- **Database Cleanup:** Loads stored scans via getAllScans; creates set of current extension IDs; identifies orphaned scans for uninstalled extensions; deletes via deleteScan in parallel batch
	- **Temporal Metadata Extraction:** Extracts installTime from extension object; handles both number timestamps and Date objects; converts to milliseconds; calculates daysSinceInstall by comparing to current timestamp; generates ISO string installDate for display
	- **Risk Analysis Integration:** Calls analyzeRisk for each extension passing full extension object plus temporal metadata and manifest data
	- **Scan Data Construction:** Builds comprehensive scan object with extensionId, name, version, enabled boolean, permissions array, hostPermissions array, installType, installDate ISO string, daysSinceInstall number, score from analysis, grade from analysis, risks array from analysis, scannedAt timestamp
	- **Critical Enabled Field:** Explicitly sets enabled field from extension.enabled to ensure boolean value in database for accurate Active/Disabled filtering
	- **Batch Save:** Parallel saves via Promise.all for all scans to minimize IndexedDB transaction overhead
	- **Verification Logging:** Post-save verification reads all scans and logs enabled states to confirm database integrity
	- **Error Handling:** Try-catch wrapper with detailed error logging; rejects promise with error object for caller handling

- **Risk Analyzer Module:** background/risk-analyzer.js
	- **Base Scoring System:** Starts from BASE_SCORE of 10 points; applies deductions based on detected risks; clamps final score to minimum 0
	- **Grade Mapping Function:** gradeFromScore converts numeric score to letter grade - A+ for 9 or above, A for 7-8, B for 5-6, C for 3-4, F for below 3
	- **Main Export:** analyzeRisk async function accepts extension object with permissions, hostPermissions, daysSinceInstall, manifest; returns object with score number, grade string, risks array
	- **Dangerous Permissions Detection:**
		- Source list: DANGEROUS_PERMISSIONS array from constants.js contains webRequest, webRequestBlocking, tabs, history, all_urls
		- Penalty: Minus 2 points per dangerous permission
		- Risk entry: Creates high severity risk with title Sensitive permission followed by permission name
	- **Permission Combinations Analysis:**
		- Function: analyzePermissionCombos checks for 6 dangerous permission pairs
		- Normalization: Adds webRequest to permission set if webRequestBlocking present to prevent evasion by using alternate permission name
		- Combo 1: cookies plus webRequest, minus 3 points, critical severity, session hijacking risk with description about reading cookies and modifying network requests
		- Combo 2: tabs plus history, minus 2 points, high severity, complete browsing activity tracking
		- Combo 3: clipboardRead plus storage, minus 2 points, high severity, clipboard data exfiltration for passwords and credit cards
		- Combo 4: proxy plus webRequest, minus 3 points, critical severity, complete traffic redirection and monitoring control
		- Combo 5: debugger plus tabs, minus 4 points, critical severity, developer-level webpage modification and code injection into banking sites
		- Combo 6: desktopCapture plus storage, minus 3 points, critical severity, screen recording with password capture
	- **Host Permissions Analysis:**
		- Function: analyzeHostPermissions processes hostPermissions array
		- Universal Access Detection: Checks for all_urls, star colon slash slash star slash star slash star, http colon slash slash star slash star slash star, https colon slash slash star slash star slash star patterns
		- Universal Access Penalty: Minus 3 points, critical severity, risk title Access to ALL websites, description warns can read and modify every webpage including banking sites
		- Sensitive Domains List: Hardcoded array with accounts.google.com, login.microsoftonline.com, facebook.com, twitter.com, instagram.com, linkedin.com, github.com, paypal.com, stripe.com
		- Sensitive Domain Check: Pattern matching against sensitive domains list using includes check
		- Sensitive Domain Penalty: Minus 2 points, high severity, Access to sensitive login sites risk
		- Excessive Breadth: Counts hostPermissions array length; if greater than 10, minus 1 point, medium severity, Requests access to N websites risk indicating possible data harvesting
	- **Tracker Domain Detection:**
		- Function: analyzeTrackerContacts async function loads tracker database and checks host permissions
		- Tracker Database: Calls loadTrackerDB which fetches data/tracker-domains.json with 20 known tracker domains including doubleclick.net, google-analytics.com, facebook.com/tr, scorecardresearch.com
		- Domain Normalization: Strips leading star colon slash slash, trailing slash star, and star dot patterns from host permission patterns
		- Matching Logic: isTrackerDomain performs bidirectional includes check between normalized domain and tracker database entries
		- Penalty Calculation: Minus 2 points per matched tracker domain; creates single critical severity risk titled Contacts N known tracker with description listing all matched tracker domains
	- **Content Security Policy Analysis:**
		- Function: analyzeCSP extracts CSP from manifest supporting both MV2 string format and MV3 object format with extension_pages or sandbox keys
		- Unsafe Inline Detection: Lowercased CSP string check for unsafe-inline substring; minus 2 points, high severity, Unsafe Content Security Policy unsafe-inline risk warning about XSS attacks and arbitrary code execution
		- Unsafe Eval Detection: Lowercased CSP string check for unsafe-eval substring; minus 2 points, high severity, Unsafe Content Security Policy unsafe-eval risk warning about dynamic code evaluation
		- Permissive Script Sources: Regex match for script-src directive; checks for wildcard star, http colon slash slash star, https colon slash slash star patterns; minus 1 point, medium severity, Permissive script sources in CSP risk about loading scripts from any domain
		- External Script Loading: Regex check for script-src with http or https URLs excluding localhost; minus 1 point, medium severity, Loads scripts from external domains risk about supply-chain attacks
	- **Update URL Analysis:**
		- Function: analyzeUpdateURL extracts update_url from manifest or updateUrl/update_url from extension object
		- Skip Condition: Returns unchanged score if no update URL present indicating Chrome Web Store auto-update
		- Official Store Check: Lowercased URL contains check for clients2.google.com, clients2.googleusercontent.com, update.googleapis.com patterns
		- Non-Official Source Penalty: Minus 2 points, high severity, Updates from non-official source risk with truncated URL display limited to 60 characters
		- HTTP Update Detection: Starts with http colon slash slash check; minus 3 points, critical severity, Insecure update mechanism HTTP risk warning about man-in-the-middle malware injection
		- Suspicious Domain Detection: List includes temp-mail, file-sharing, free-host, pastebin, githubusercontent.com/raw patterns; minus 1 point, medium severity, Updates from suspicious hosting risk about temporary or unconventional hosting
	- **Temporal Age Analysis:**
		- Function: analyzeAge checks daysSinceInstall value
		- New Extension Threshold: Less than 7 days since install
		- New Extension Penalty: Minus 1 point, medium severity, Recently installed risk with description showing exact day count and warning to monitor closely
	- **Risk Object Structure:** Each risk contains severity string (critical, high, medium, low), title string for display, description string with detailed explanation, type string for categorization (permission_combo, host_permission, tracker, csp, update, temporal)

- **Data Files and Libraries:**
	- **Tracker Database:** libs/tracker-db.js
		- Module exports: loadTrackerDB async function and isTrackerDomain boolean function
		- Database Loading: Fetches data/tracker-domains.json via chrome.runtime.getURL; parses JSON; extracts domains array
		- Caching: Stores loaded domains in module-level trackerDomains array; returns early if already loaded to avoid redundant fetches
		- Error Handling: Try-catch wrapper logs warning and continues with empty array if load fails
		- Domain Matching: Bidirectional includes check between input domain and tracker list entries for fuzzy matching
	- **Tracker Domains Data:** data/tracker-domains.json
		- Format: JSON object with version 1.0, lastUpdate 2025-01-26, domains array with 20 entries
		- Domains: doubleclick.net, googleadservices.com, google-analytics.com, facebook.com/tr, scorecardresearch.com, quantserve.com, adnxs.com, adsrvr.org, criteo.com, outbrain.com, taboola.com, omniture.com, moatads.com, 2mdn.net, adform.net, advertising.com, chartbeat.com, hotjar.com, mouseflow.com, crazyegg.com
	- **Storage Module:** libs/storage.js
		- Database Name: privacy_guardian_db
		- Object Store Name: scans with keyPath extensionId
		- Database Version: 1
		- IndexedDB Initialization: openDB function creates connection with onupgradeneeded handler to create object store if missing
		- saveScan Function: Async function accepts scan object; opens database; creates readwrite transaction; uses store.put for insert or update; resolves on transaction complete
		- getAllScans Function: Async function opens database; creates readonly transaction; calls store.getAll; returns array of all scan records or empty array
		- deleteScan Function: Async function accepts extensionId; opens database; creates readwrite transaction; calls store.delete; logs success message; resolves on transaction complete
		- clearScans Function: Async function clears entire object store via store.clear for complete database reset
		- Promise Wrappers: All functions return promises wrapping IndexedDB request callbacks for async/await syntax compatibility
	- **Constants Module:** background/constants.js
		- BASE_SCORE: Exported constant set to 10 representing starting score before deductions
		- DANGEROUS_PERMISSIONS: Exported array with 5 entries - webRequest, webRequestBlocking, tabs, history, all_urls representing permissions that trigger automatic high severity risks
	- **Utils Module:** libs/utils.js
		- clamp Function: Exported utility accepts value, min, max; returns Math.min of Math.max value and min, and max for boundary enforcement
		- gradeFromScore Function: Exported function converts numeric score to string grade - Safe for 8 or above, Medium for 5-7, High Risk for below 5 (note: differs from risk-analyzer.js grading scale)
	- **Chrome API Module:** libs/chrome-api.js
		- getInstalledExtensions Function: Exported promise wrapper around chrome.management.getAll; returns array of extension objects or empty array

**Popup Component Modules**
- **Extension Card Component:** popup/components/extension-card.js
	- **Main Export:** getExtensionCard function accepts extension object and returns populated DOM element
	- **Card Structure:** Flex layout with icon, name, version, privacy score badge, risk preview, and action buttons
	- **Grade Calculation:** getGrade function maps scores to A+/A/B/C/F letter grades (≥9: A+, ≥7: A, ≥5: B, ≥3: C, <3: F)
	- **Risk Level Mapping:** getRiskLevel function categorizes scores as safe/medium/high/critical for color coding
	- **Icon Loading:** loadExtensionIcon async function retrieves largest available icon via chrome.management.get; 48x48px size; fallback to gradient background if unavailable
	- **Risk Icons:** Severity-based emoji icons (🚨 critical, ⚠️ high, ⚡ medium, ℹ️ low)
	- **Broad Access Badge:** Yellow pill shown when hasBroadHostAccess detects universal host patterns
	- **Risk Preview:** Shows top 2 risks with titles and severity icons; "+N more risks" counter for additional risks
	- **Action Integration:** Renders View Details button and action buttons from action-buttons component

- **Action Buttons Component:** popup/components/action-buttons.js
	- **Main Export:** renderActionButtons function accepts extensionId and isEnabled boolean; returns HTML string
	- **Toggle Switch:** Chrome-style toggle with 44x24px dimensions and 300ms transition animation
		- HTML Structure: Hidden checkbox input with id="toggle-{extensionId}" and visual label overlay
		- CSS Classes: toggle-switch-container, toggle-switch-input, toggle-switch-label
		- Checked State: Reflects isEnabled === true for bidirectional enable/disable
		- Event Handling: Change event listener in popup.js calls enableExtension or disableExtension
	- **Uninstall Button:** Red button with "Uninstall" text and uninstall-btn class
	- **Layout:** Flex gap-2 arrangement with toggle switch and uninstall button

- **Privacy Score Component:** popup/components/privacy-score.js
	- **Main Export:** renderPrivacyScore function accepts score, grade, and riskLevel; returns HTML string
	- **Score Badge:** Colored badge displaying X/10 score with dynamic CSS class based on riskLevel
	- **Grade Display:** Letter grade shown below badge in smaller text
	- **Color Coding:** CSS classes critical/high/medium/safe determine badge background color
	- **Risk Patterns Data:** data/risk-patterns.json
		- Format: JSON object with suspiciousUrls, suspiciousKeywords, and dangerousPermissions arrays
		- Status: Empty placeholder for future pattern-based risk detection rules
	- **Safe Developers Data:** data/safe-developers.json
		- Format: JSON object with trustedDevelopers and verifiedPublishers arrays
		- Status: Empty placeholder for future developer reputation whitelist system

- **Popup User Interface:** popup/popup.html, popup/popup.js, popup/popup.css
	- **Initial Rescan:** On open, sends `rescan` to background and then loads stored scans.
	- **Filter & Sort:** Dropdowns for filter (All, Active, Disabled) and sort (Risky/Medium/Safe). Defaults to Active + Risky-first.
	- **Cards:** [popup/components/extension-card.js](popup/components/extension-card.js) renders name, version, score, top risks, badges (e.g., "Broad access").
	- **Actions:** [popup/components/action-buttons.js](popup/components/action-buttons.js) shows Chrome-style toggle switches (44x24px, 300ms animation) and Uninstall button.
	- **Modal:** Shows score summary, version, permissions, host permissions (with `<all_urls>` warning), detected risks with descriptions, and a Chrome Web Store link.
	- **Export:** CSV export of scan summaries with name, version, score, grade, risk count, and top 3 risk titles.
	- **Scrolling UX:** Header and stats collapse with a sticky filter bar when the list scrolls; hysteresis prevents jitter.
	- **Onboarding Tour:** First-time user interactive tutorial with 4 steps; uses chrome.storage.local for completion tracking; features backdrop overlay, cutout highlighting, and navigation controls (Previous/Next/Skip).

**Risk Detection Details**
- **Sensitive Permissions**
	- **Rule:** If `permission ∈ DANGEROUS_PERMISSIONS` then `score -= 2` and record a high-severity risk.
	- **Examples:** `webRequest`, `webRequestBlocking`, `tabs`, `history`, `<all_urls>`.
- **Dangerous Combinations**
	- **Examples:**
		- **cookies + webRequest:** `-3`, critical—session hijacking potential.
		- **proxy + webRequest:** `-3`, critical—traffic redirection/monitoring.
		- **debugger + tabs:** `-4`, critical—developer-level webpage modification.
		- **tabs + history:** `-2`, high—complete browsing activity tracking.
		- **clipboardRead + storage:** `-2`, high—clipboard data exfiltration.
		- **desktopCapture + storage:** `-3`, critical—screen recording risk.
	- **Normalization:** `webRequestBlocking` treated as `webRequest` inside combos.
- **Host Permission Analysis**
	- **Universal Access:** `<all_urls>`, `*://*/*`, `http://*/*`, `https://*/*` → `-3`, critical.
	- **Sensitive Domains:** Access patterns including major login/payment/social domains → `-2`, high.
	- **Excessive Breadth:** >10 host patterns → `-1`, medium.
- **Tracker Domain Detection**
	- **Source:** [data/tracker-domains.json](data/tracker-domains.json); loaded and cached by [libs/tracker-db.js](libs/tracker-db.js).
	- **Exact/Fuzzy Match:** Normalizes pattern domains, checks inclusion both ways.
	- **Penalty:** `-2` per tracker domain; aggregates into a critical “Contacts N known tracker(s)” risk with a domain list.
- **Temporal (Age) Analysis**
	- **Days Since Install:** Computed in scanner from `ext.installTime`.
	- **Penalty:** `< 7 days` → `-1`, medium and “Recently installed” risk.
- **Score & Grade**
	- **Base:** 10 points; deductions as rules apply; min-clamped to 0.
	- **Grade Mapping:** `A+ (≥9)`, `A (≥7)`, `B (≥5)`, `C (≥3)`, `F (<3)`.

**Onboarding Tour System**
- **Purpose:** Interactive first-run tutorial to guide new users through SafeExtensions features and UI
- **Storage Key:** tourCompleted stored in chrome.storage.local for persistent completion tracking
- **Tour Steps:** 4-step guided walkthrough
	- **Step 1:** Scan button - "Click Scan to analyze your installed extensions for privacy risks."
	- **Step 2:** Stats bar - "The dashboard summarizes total, safe, and risky extensions at a glance."
	- **Step 3:** Filter bar - "Use filters and sorting to focus on active, disabled, or high-access extensions."
	- **Step 4:** Disclaimer - "Please note: we do not encourage deleting extensions. Our goal is to make you aware of permissions. For more info, please use the About link."
- **UI Components:**
	- **Tour Overlay:** Semi-transparent backdrop (#tour-overlay) covering entire popup
	- **Tour Backdrop:** Dark translucent background (tour-backdrop)
	- **Tour Cutout:** Highlighted area (tour-cutout) with transparent region to spotlight current step element
	- **Tour Popover:** Floating message box (tour-popover) with step text and navigation buttons
- **Navigation Controls:**
	- **Previous Button:** Navigate to previous step; disabled on first step
	- **Next Button:** Advance to next step; changes to "Finish" on last step
	- **Skip Button:** Dismiss tour early and mark as completed
- **Initialization Logic:**
	- Function: initializeOnboardingTour async function called on DOMContentLoaded
	- Check: Reads tourCompleted from chrome.storage.local
	- Auto-start: Launches tour if not previously completed
	- Dev Reset: Hidden "Reset tour (dev)" button available with ?dev=1 query param for testing
- **State Management:**
	- tourState object tracks active boolean and current index number
	- tourHighlightEl stores reference to currently highlighted element
	- tourHighlightPrev stores previous highlight for cleanup
	- tourHighlightContainer and tourHighlightContainerPrev for container management
	- tourCutout reference to cutout overlay element
- **Completion:**
	- Finish action: Saves tourCompleted=true to chrome.storage.local
	- UI cleanup: Removes all tour overlays and resets state
	- Persistence: Tour won't auto-start on subsequent popup opens
- **Developer Mode:** URL param ?dev=1 shows reset button to clear tourCompleted key for testing

**UI Behavior**
- **Popup Open**
	- **Rescan Triggered:** Requests fresh background scan; then loads results from storage.
	- **Default View:** Filter = Active; Sort = Risky-first; shows aligned counts for All/Active/Disabled.
	- **Stats:** Displays totals, safe, and risky counts; clicking Risky stat scrolls to first risky card with 6-second glow animation.
	- **Risky Scroll Function:** scrollToFirstRisky finds first extension with score < 7; adds glow-highlight class; uses scrollIntoView with smooth behavior and center alignment; removes glow after 6 seconds (3 animation cycles).
	- **Onboarding:** Checks tourCompleted status; launches interactive tour for first-time users.
- **Cards**
	- **Extension Icon:** 48x48px icon loaded asynchronously via chrome.management.get; fallback gradient background if icon unavailable.
	- **Privacy Score:** Badge colored by risk level (critical/high/medium/safe) displaying X/10 score and letter grade.
	- **Risks Preview:** Top 2 risk titles with severity icons (🚨 critical, ⚠️ high, ⚡ medium, ℹ️ low); "+N more risks" indicator when applicable.
	- **Actions:** View Details button; Chrome-style toggle switch for enable/disable (44x24px with 300ms smooth transition); Uninstall button.
	- **Badge:** Yellow "Broad access" pill when host permissions include `<all_urls>`, `*://*/*`, `http://*/*`, or `https://*/*` patterns.
	- **Glow Effect:** Risky cards can be highlighted with glow-highlight class when scrolled to via Risky stat click.
- **Details Modal**
	- **Sections:** Privacy Score, Version, Permissions, Host Permissions (with `<all_urls>` explanation), Risks (with severity icon, title, description), Store Page link.
	- **Disclaimer:** “Store data is informational only.”
- **Scrolling UX**
	- **Behavior:** Header and stats collapse/fade on list scroll; sticky filter bar gains shadow; hysteresis avoids rapid snapping.
	- **Implementation:** attachScrollBehavior function with requestAnimationFrame optimization and scroll ticking flag
	- **Collapse Threshold:** Header and stats begin collapsing at 60px scroll position (HIDE_THRESHOLD)
	- **Expand Threshold:** Sections restore at 20px scroll position (SHOW_THRESHOLD) for tight hysteresis
	- **Cooldown:** 100ms state change cooldown (STATE_COOLDOWN_MS) prevents jitter during rapid scrolling
	- **CSS Classes:** .collapsed class on header-bar and stats-bar; .stuck class on filter-bar
	- **Visual Effects:** Max-height transitions for smooth collapse; filter bar gains shadow when stuck to top
	- **Initialization Guard:** scrollInitialized flag prevents duplicate event listener attachment
- **Export**
	- **Trigger:** "Export Privacy Report" button in footer with download icon
	- **Function:** exportReport async function in popup.js
	- **Data Source:** All scans from IndexedDB via getAllScans
	- **CSV Generation:** generateCSV function builds comma-separated values
	- **Headers:** Extension Name, Version, Privacy Score, Grade, Risk Count, Top Risks
	- **Row Format:** Quoted extension name, version number, numeric score, letter grade, risk count, quoted semicolon-separated top 3 risk titles
	- **Filename:** safeextensions-report-YYYY-MM-DD.csv with ISO date stamp
	- **Download:** Creates Blob with text/csv MIME type; uses URL.createObjectURL and temporary anchor element for browser download; URL revoked after download
	- **Empty State:** Shows info toast "No extensions to export" if no scan data available
	- **Success Feedback:** Green success toast "✅ Report exported" on completion

**Data & Storage**
- **IndexedDB Schema:**
	- **Store:** `privacy_guardian_db.scans` keyed by `extensionId`.
	- **Fields:** `extensionId`, `name`, `version`, `enabled`, `permissions`, `hostPermissions`, `installType`, `installDate`, `daysSinceInstall`, `score`, `grade`, `risks`, `scannedAt`.
	- **Operations:** Save, read all, delete by id, clear all.

**Message Flow**
- **Popup → Background:** `rescan` to trigger fresh analysis.
- **Background → Popup:** `extension-state-changed` when system-level changes detected (enable/disable/uninstall).

**Robustness & Anti-Evasion**
- **Normalization:** Treats `webRequestBlocking` as `webRequest` in combo checks.
- **Multiple Signals:** Combines permissions, combos, host breadth, trackers, and age to reduce single-vector evasion.
- **UI Safety:** Disabled tab omits Disable button; consistent rendering even with legacy records missing `enabled`.
- **Hysteresis:** Scroll collapse uses thresholds to avoid jitter.

**Limitations**
- **MV3 Constraints:** Network inspection is configuration-limited; deep payload analysis requires `declarativeNetRequest` rules or content-side instrumentation.
- **Heuristic Nature:** Some signals are heuristic; false positives/negatives are possible (balanced to prioritize privacy).
- **Store Data:** No scraping; a store link is provided for user verification; reputation not scored from store ratings.

**Security & Privacy**
- **Local-Only:** Analysis runs locally; no data exfiltration by this tool.
- **Data Handling:** Minimal storage of scan metadata; no browsing history or page content is persisted by the extension.
- **User Controls:** Disable/Uninstall actions surfaced prominently.

**Testing & Verification**
- **Manual Tests:** [tests/manual-test-plan.md](tests/manual-test-plan.md)
	- **Scenarios:** Safe vs risky extensions, host wildcard checks, tracker domain matches, age-based penalties.
- **Sample Extensions:** [tests/test-extensions/](tests/test-extensions) with `risky-extension` and `safe-extension` manifests.
- **Console Logs:** Background and popup emit detailed logs for scan lifecycle and verification.

**UI Feedback Systems**
- **Toast Notifications:**
	- **Element:** #toast div with toast CSS class; positioned fixed at bottom-center
	- **Function:** showToast(message, variant) displays temporary notification
	- **Variants:** success (green), error (red), info (blue) with corresponding CSS classes
	- **Animation:** Slides up with .show class; auto-dismisses after timeout
	- **Timeout Management:** toastTimeout variable stores setTimeout ID; clears previous timeout on new toast
	- **Examples:** "✅ Extension disabled successfully", "❌ Failed to disable: {error}", "ℹ️ No risky extensions found"

- **Loading State:**
	- **Element:** #loading div positioned inside extensions-list container
	- **Layout:** Flex column centered with spinning loader icon and status text
	- **Icon:** Dual-layer animation with rotating border-t-blue-500 ring and centered shield icon
	- **Text:** "Scanning extensions..." title and "Analyzing permissions and risks" subtitle
	- **Function:** showLoading(show) toggles .hidden class; manages minimum display duration
	- **Minimum Duration:** MIN_LOADING_MS = 1000ms prevents flash on fast scans
	- **Timeout Management:** loadingHideTimeout ensures smooth loading experience
	- **Integration:** Shown during initial popup open, manual scans, and state changes

- **Empty State:**
	- **Element:** #empty-state div with centered layout and icon
	- **Display:** Shown when no extensions installed (filtered results length = 0)
	- **Icon:** Cube icon in slate-400 color within circular background
	- **Message:** "No extensions installed" title and "Install extensions from Chrome Web Store" subtitle
	- **Toggle:** Hidden by default; display: flex when applicable

**Recent Enhancements**
- **Icons:** Updated manifest to include 16/48/128 icons for proper rendering; increased extension card icons to 48x48px and header logo to 40x40px.
- **Permission Combos:** Added advanced detection for 6 dangerous permission combinations with critical/high severity ratings.
- **Host Permissions:** Broad access and sensitive domains analysis added to scoring with universal access detection.
- **Tracker Detection:** Integrated domain-based tracker contacts with penalties using 20-domain tracker database.
- **Temporal Analysis:** New-install caution signal for extensions installed less than 7 days ago.
- **CSP Analysis:** Detects 4 types of unsafe Content Security Policies (unsafe-inline, unsafe-eval, permissive script sources, external script loading).
- **Update URL Analysis:** Flags non-official update sources, insecure HTTP updates, and suspicious hosting domains.
- **UI Filters:** Simplified from 5 filters to 3 (All, Active, Disabled) for cleaner UX.
- **Toggle Switches:** Replaced Disable button with Chrome-style toggle switches (44x24px, 300ms animation); bidirectional enable/disable with auto-rescan.
- **Store Link:** Added Chrome Web Store page link in modal using slug-based URL generation; footer disclaimer about store data.
- **Scrolling UX:** Smooth collapsible header/stats with max-height transitions, sticky filter bar with shadow, and hysteresis (60px/20px thresholds, 100ms cooldown).
- **Loading State:** Moved inline to extensions list area to prevent Scan button clipping; minimum 1-second display duration.
- **Animations:** Added 500ms bounce animation for extensions list expansion; 400ms smooth collapse for sections; 6-second glow highlight for risky card scroll.
- **Onboarding Tour:** Implemented 4-step interactive first-run tutorial with backdrop overlay, element highlighting, and persistent completion tracking.
- **CSV Export:** Full-featured report export with formatted headers, quoted fields, ISO date filenames, and success/error feedback.

**Roadmap**
- **Fingerprinting Monitors:** Instrument APIs (canvas, audio, WebRTC, sensors) to flag aggressive fingerprinting.
- **Network Heuristics:** Add `declarativeNetRequest` rules or passive indicators for exfil patterns (beacon/WebSocket payloads, unusual headers).
- **Content Script Scanners:** Detect common obfuscation/fingerprinting libraries and dynamic injection patterns.
- **CSP/Audit Hooks:** Identify CSP overrides and worker/persistence risks.
- **UI Explanations:** Add remediation tips and guided actions per risk.

**Usage**
- **Open Popup:** Triggers rescan and presents Active extensions by default; launches onboarding tour for first-time users.
- **Onboarding Tour:** Follow 4-step interactive tutorial on first run; navigate with Previous/Next/Skip buttons; completion persists in chrome.storage.local.
- **Filter/Sort:** Adjust to view All, Active, or Disabled extensions; sort by Risky/Medium/Safe; helper text shows current filter.
- **Stats Dashboard:** View total, safe, and risky counts; click Risky stat to scroll to first risky extension with glow animation.
- **Toggle Extensions:** Use Chrome-style toggle switches (44x24px) to enable or disable extensions; automatically rescans and updates UI; 300ms smooth animation.
- **Details Modal:** Click "View Details →" button; review privacy score, version, Chrome Web Store link, permissions list, host permissions with <all_urls> warning, and detected risks with severity icons and descriptions.
- **Uninstall:** Click red Uninstall button; Chrome shows confirmation dialog; successful uninstall triggers auto-rescan and UI refresh.
- **Export CSV:** Click "Export Privacy Report" button in footer; downloads safeextensions-report-YYYY-MM-DD.csv with name, version, score, grade, risk count, and top 3 risks.
- **Scrolling:** Header and stats collapse smoothly when scrolling extension list; filter bar becomes sticky with shadow; scroll back up to restore full header.
- **Developer Mode:** Add ?dev=1 to URL to show tour reset button for testing onboarding flow.

