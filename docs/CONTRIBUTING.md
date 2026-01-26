# Contributing to SafeExtensions

Thank you for your interest in contributing! This project is privacy-first and security-conscious. All analysis is 100% local—no telemetry, no tracking, no remote calls. Changes must keep the logic deterministic, auditable, and respectful of user privacy.

## Project Principles
- **Privacy-first design:** No data leaves the user’s device.
- **Transparency & auditability:** Code must be readable, reviewable, and traceable.
- **Deterministic logic:** Inputs produce predictable outputs; no hidden behaviors.
- **No obfuscation or minification:** Source must remain inspectable; build artifacts should not hide logic.
- **Why this matters:** Users trust us to protect privacy; clarity and determinism prevent regressions and misuse.

## Beginner-Friendly Guide
- New here? You’re welcome! Start with small issues: docs, tests, or UI polish.
- To get setup help, open a GitHub Discussion or issue with a clear question and steps you tried.
- If unsure, propose your plan in an issue before coding.

## Contribution Scope & Boundaries
**Welcome:**
- UI/UX improvements and polish
- Performance optimizations
- Reducing false positives
- Documentation improvements
- Tests (unit/integration/manual scripts)
- New risk heuristics (with strong justification and readability)

**Restrictions:**
- Large architectural changes: open an issue first and get approval.
- New permissions/APIs: require strong reasoning and prior approval.
- Changes to risk analyzer, scanner logic, or permissions handling: must explain rationale, data, and impact.
- No obfuscation/minification in PRs.
- No unexplained magic numbers—document intent.
- Prefer clear, commented logic over cleverness.

## Bug Fixes vs Features
- Bug fixes: Welcome; open an issue if impact or scope is non-trivial.
- Features: Open an issue for discussion and approval before starting.
- Both: Keep scope tight; one focused change per PR.

## Issues Guidelines
- Open an issue **before** PRs for any non-trivial change (especially security/privacy logic).
- A good issue includes: context, expected vs actual behavior, steps to reproduce, proposed approach, and potential risks.
- Security/privacy-impacting changes require prior discussion.

## Pull Request Guidelines
- One feature or fix per PR; no unrelated refactors.
- Explain **why** the change is needed, not just **what** changed.
- Commit messages: clear, descriptive (e.g., fix: handle missing host permissions).
- Keep heuristic changes readable and well-commented.
- No copied or proprietary code; cite sources for any referenced logic.
- Add tests or manual verification notes where applicable.
- Keep diffs minimal; avoid drive-by formatting changes.

## Security & Privacy Rules
- Any change affecting security or privacy logic must be discussed first via issue.
- Use responsible, professional tone for security topics.
- No public “pressure” disclosures in issues—coordinate respectfully.

## Testing & Quality Bar
- Run applicable tests (unit/integration/manual steps) and describe what you ran.
- Ensure deterministic behavior: avoid time, randomness, or environment-sensitive logic unless justified and documented.
- If adding heuristics, include comments describing intent and expected impact.

## License & Legal (MPL-2.0)
- By contributing, you agree your contributions are licensed under MPL-2.0.
- You must own the code you submit; do not include proprietary or license-incompatible code.
- Confirm third-party snippets are compatible and properly attributed.

## Community Conduct
- Be respectful; no harassment.
- Keep discussions constructive, especially around security/privacy.
- If a separate Code of Conduct exists, it applies here.

## Final Decision Authority
- Maintainers have final say on PR acceptance, architectural decisions, and security-sensitive changes.
- If maintainers request changes or a redesign of your approach, please adjust before re-submitting.

Thank you for helping keep SafeExtensions privacy-first, transparent, and trustworthy.
