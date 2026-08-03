# Contributing

Thanks for looking at CINE DB. This is primarily a personal/portfolio project, but issues and PRs are welcome.

## Getting set up

Follow the README's [Quick Start](README.md#quick-start) — prerequisites, install steps, and `npm run dev` to run the full stack locally. [Environment Variables](README.md#environment-variables) and [Docker Setup](README.md#docker-setup) cover the rest.

## Before opening a PR

- Run the relevant test suite(s) for what you touched — see [`## Testing`](README.md#testing) for exact commands (Jest, Django pytest, Playwright TS, pytest-playwright).
- `npx tsc --noEmit` for any frontend change.
- `ruff check backend/` for any backend change.
- Keep changes scoped — this repo favors small, reviewable diffs over large multi-concern PRs.

## Commit style

This repo bumps `package.json`'s version and adds a `CHANGELOG.md` entry per notable change, with commit messages following `git log`'s existing pattern:

```
Bump to X.Y.Z: <one-line summary of the why>
```

for version-bump commits, or a plain imperative summary (`Fix flaky "..." in ...`) for smaller fixes that don't warrant a version bump. Not a hard rule for external contributors — just what to expect when reading history, and what a PR title should roughly resemble.

## Code conventions

See [`CLAUDE.md`](CLAUDE.md) — it documents the non-obvious conventions (shared components/hooks to reuse, patterns that look like bugs but aren't, things that have bitten this project before). Worth a skim before touching a section you haven't worked in yet.
