# Agent Command Hub — GitHub Copilot Instructions

Follow [AGENTS.md](../AGENTS.md) as the primary repository policy. Work in small, reviewable pull requests; never push to `main`, merge a pull request, add secrets, or enable external deployments. This is an Arabic RTL Expo/React Native app with Express, tRPC, and Drizzle. Preserve server-only handling for LLMs and secrets, protect all user-owned data with `protectedProcedure` and `ownerId`, and keep chat, agents, Git, Docker, and publishing behind the documented governance gates.

Run `pnpm test && pnpm check && pnpm lint && pnpm build` before proposing completion. If changing the Drizzle schema, generate and review a non-destructive migration. Prefer accessible mobile layouts, current theme tokens, and deterministic tests. State clearly in every pull request: scope, data/security impact, commands run, and any action still requiring the owner.
