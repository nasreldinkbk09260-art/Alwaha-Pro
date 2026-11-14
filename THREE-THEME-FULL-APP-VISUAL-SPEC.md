# Alwaha-Pro — Full-App Theme Transformation Specification

Status: Approved product requirement for the existing 3.0.3 work branch.
Scope: User-facing presentation and interaction styling only. Preserve the product, identity, accounts, backend, data model, permissions, and business logic.

## Core requirement
Each theme must transform the entire user-facing application into a coherent, high-quality visual experience. A theme is not a wallpaper, decorative background, or superficial color swap. When selected, the user should feel they have entered a different, fully designed application while still using the same Alwaha-Pro product and data.

## Three approved themes
1. **Reference-inspired premium theme** — a complete visual language inspired by the supplied reference image: rich layered atmosphere, refined depth, carefully composed surfaces, typography, icons, transitions, and responsive layouts. Recreate the design language in real UI components; do not use the reference image as a static screen or as a substitute for functional components.
2. **Original premium creative theme** — a distinct visual direction designed independently, with its own complete palette, surfaces, navigation, component styling, motion, and interaction details. It must feel equally finished and premium, not a recolor of theme 1.
3. **Improved default theme** — preserve the familiar Alwaha-Pro identity and existing structure, but improve consistency, spacing, hierarchy, readability, responsive behavior, accessibility, and polish.

## Non-negotiable invariants
- Do not use photos, avatars, illustrations, or human characters as theme-defining decoration; avoid implying that the app is intended only for children or adults.
- Do not replace real screens with screenshots or static mockups.
- Preserve all existing user accounts, authentication, profiles, messages, posts, marketplace listings, media, notifications, calls, games, settings, local vault data, and Supabase schema/policies.
- Theme switching must not reset, migrate, overwrite, or delete user data. Only theme preference may be persisted.
- All three themes must support every existing section, modal, full-screen page, form, list, media player, call interface, game, notification, empty/loading/error state, and floating control.
- Theme changes must not alter feature permissions, business rules, API payloads, RLS, realtime subscriptions, or backend behavior.
- Preserve accessibility, reduced-motion preference, data-saver behavior, Android safe areas, offline asset availability, and responsive support for older and newer phones.
- Keep the theme engine centralized and token-driven; avoid scattered per-screen overrides and duplicated theme logic.

## Quality and acceptance criteria
- A complete component inventory is mapped to theme tokens and reviewed screen by screen.
- No section remains visually stranded in the old theme when another theme is active.
- No broken contrast, clipped controls, overflow, hidden actions, unreadable text, inconsistent icon sizing, or modal/background interaction leaks.
- Theme switching is atomic, guarded against rapid repeated taps, restores correctly after restart, and remains safe when storage is unavailable.
- All theme assets are local/optimized where practical and included in the offline build/cache.
- Test each theme on a small/older Android phone and a newer phone, including reduced-motion, data-saver, offline launch, and modal navigation.
- Run automated audits and syntax/build checks, then perform real-device visual and interaction acceptance before release. Static checks alone do not count as device acceptance.

## Implementation order
1. Finish the current button/feature-by-feature review without restarting the branch or creating another branch.
2. At the theme section, audit the existing three-theme selector, token system, theme backdrop, persistence, migration, cache, and every component that currently bypasses theme tokens.
3. Implement theme 1 end-to-end, then theme 2 end-to-end, then polish theme 3; validate the whole app under each before declaring the theme stage complete.
4. Keep all backend/data/account invariants unchanged and record test evidence and remaining device-only checks.

This specification supersedes any interpretation of the theme request as merely changing a background image or applying a few CSS colors.
