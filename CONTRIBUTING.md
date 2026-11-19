# Contributing to Uganda Weather

Thank you for contributing.

## Development workflow

1. Branch from `dev` using a clear branch name such as `feat/hybrid-advisor` or `fix/forecast-cache`.
2. Write plain, well tested TypeScript and React code.
3. Add unit or component tests for new logic and regression tests for bug fixes.
4. Update `README.md`, `CHANGELOG.md`, or `openapi.yaml` if behaviour or API contracts change.
5. Open a pull request targeting `dev` (promotions flow `dev` -> `staging` -> `main`).

## Commit messages

Write short, clear prose sentences describing what changed and why.

## Pull request checklist

- [ ] `pnpm lint` passes with zero warnings
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes
- [ ] `pnpm build` passes
- [ ] `pnpm guards` passes
- [ ] API changes reflected in `openapi.yaml`
- [ ] No secrets, API keys, or local paths committed

## Questions

Open an issue or discussion on this repository.
