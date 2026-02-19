# Contributing to VoltLog

Thank you for your interest in contributing! We use strict controls to ensure code quality and easier releases.

## Workflow

1.  **Fork & Clone**: Fork the repo and clone it locally.
2.  **Branch**: Create a feature branch (`git checkout -b feature/my-feature`).
3.  **Commit**: We use **Conventional Commits**.
    - Format: `type(scope): description`
    - Example: `feat(core): add new transport`
    - Example: `fix(middleware): resolve null pointer in ip middleware`
    - Your commit will be rejected if it doesn't follow this format!
4.  **Changeset**: If your change affects the release (new feature, bug fix), you **MUST** create a changeset.
    - Run: `bun run changeset`
    - Select the type of change (patch/minor/major).
    - Write a summary.
5.  **Push & PR**: Push your branch and open a Pull Request.

> **Note**: This project uses **Bun**. Please do not commit `package-lock.json` or `yarn.lock`. Use `bun install` to update dependencies.

## Release Process (Maintainers)

1.  Run `npm run version` to bump versions based on changesets.
2.  Push changes (this updates `CHANGELOG.md`).
3.  Run `bun run release` to publish to npm.
