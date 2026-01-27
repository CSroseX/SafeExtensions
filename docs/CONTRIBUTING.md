# Contributing to SafeExtensions

Thanks for wanting to contribute! SafeExtensions is privacy-first and security-focused. Everything runs locally; there’s no telemetry, tracking, or remote calls. We keep changes clear, auditable, and privacy-preserving.

By participating, you agree to follow our [Code of Conduct](../CODE_OF_CONDUCT.md).

---

## Project Principles

SafeExtensions works the way it does for a reason:

- **Privacy-first:** No data leaves the user’s machine.  
- **Transparent and auditable:** Code should be easy to read and trace.  
- **Deterministic logic:** Inputs produce predictable outputs.  
- **Readable code only:** No obfuscation or minified code.

---

## Ways to Contribute

- Improve UI/UX and developer experience.  
- Optimize performance and reduce false positives.  
- Write docs or tests.  
- Propose new risk heuristics (explain intent and trade-offs).

Changes that affect security, privacy, permissions, or the core scanner require prior discussion in an issue.

---

## How to Propose a Change

1. **Open an issue** for any non-trivial change. Describe the problem, expected behavior, approach, and risks.  
2. **Fork** the repo and create a branch: `feature/short-desc`, `fix/short-desc`, `docs/short-desc`, `chore/...`, `refactor/...`, or `test/...`.  
3. **Make focused commits.** Prefer small, self-contained changes.  
4. **Run checks locally** (see below) and verify the manual steps.  
5. **Open a PR** referencing the issue. Explain what changed and why.

---

## Local Checks (quick)

- If you have Node installed, you can lint the extension:
	- `npm -g i web-ext` then `web-ext lint -s .`  
- Manually verify behavior using the [manual test plan](../tests/manual-test-plan.md) and test data in [tests/test-data.json](../tests/test-data.json).
- Keep logic deterministic; avoid time- and randomness-dependent behavior unless justified and documented.

Note: CI will validate JSON files and run optional Node lint/tests if a `package.json` is present.

---

## Pull Request Checklist

- [ ] Linked issue and clear problem statement
- [ ] Small, focused scope (one change per PR)
- [ ] Updated docs or comments where useful
- [ ] Manual verification notes (what you ran, what you observed)
- [ ] Screenshots for UI-facing changes
- [ ] No proprietary or copied code; references cited when relevant

---

## Commit and PR Titles

Use clear, descriptive commit messages. Conventional Commits are recommended (not required):

- `feat: add new heuristic for remote script detection`
- `fix: correct URL parsing in risk analyzer`
- `docs: clarify manual test plan`

PR titles should summarize the change and impact.

---

## Reviews and Merge

- CI must pass.  
- At least one maintainer review is required.  
- Maintainers may request revisions, squash commits, or edit titles for clarity.  
- Risky or security-sensitive changes may require additional review.

---

## Security & Privacy

Do not disclose vulnerabilities publicly. Use GitHub Security Advisories or contact the maintainers privately (see [CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md) for reporting guidance). Keep discussions professional.

---

## Licensing

By contributing, you agree your work is under [MPL-2.0](../LICENSE). You must own your code and avoid incompatible third-party code. Credit compatible snippets appropriately.

---

Thanks for helping make SafeExtensions clear, safe, and trustworthy!
