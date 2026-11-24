# Helping with Uganda Weather

Thank you for helping.

## How to work on a change

1. Make a new branch from `dev` with a clear name, such as `feat/hybrid-advisor` or `fix/forecast-cache`.
2. Write simple TypeScript and React code that is easy to read.
3. Add tests for new code, and a test that repeats any bug you fix.
4. Try to break your change before you share it. Send odd input, change IDs in the address, go offline, and try a very small screen.
5. Update `README.md`, `CHANGELOG.md`, or `openapi.yaml` if what the app does or what the API returns has changed.
6. Open a pull request into `dev`. Changes then move from `dev` to `staging`, and from `staging` to `main`.

## Commit messages

Write one short, clear sentence that says what changed and why.

## Before you open a pull request

- [ ] `pnpm lint` passes with no warnings
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes
- [ ] `pnpm build` passes
- [ ] `pnpm guards` passes
- [ ] Any API change is also written in `openapi.yaml`
- [ ] No passwords, keys, or personal folder paths are in the change

## Questions

Open an issue or a discussion on this repository.
