# Contributing to Cufflinks

The authoritative contributor guide lives in [CLAUDE.md](../CLAUDE.md). That document covers:

- Architecture overview and tech stack
- Full monorepo structure
- How to add a new music source (step-by-step)
- Style guide (TSDoc, naming conventions, TypeScript rules)
- Git branch naming and commit message conventions
- PR process and CI requirements

## Quick Links

- [Adding a new music source](../CLAUDE.md#adding-a-new-music-source)
- [Theme development](theme-authoring.md)
- [Source-specific docs](sources/)

## PR Checklist

- [ ] `pnpm lint` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes
- [ ] New source: `docs/sources/<service>.md` added
- [ ] New source: platform limitations table in CLAUDE.md updated
- [ ] New source: Roadmap section in CLAUDE.md updated
