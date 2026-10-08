# Running Slice 1

Slice 1 adds the database layer only (migrations, pgTAP, seed). The `/admin`
frontend scaffold is not part of this slice — see the slice report and ADR-010.

## What exists

```
supabase/migrations/20261008120000_m1_rbac_core.sql          RBAC tables, matrix, has_permission
supabase/migrations/20261008120100_m1_gym_settings.sql       gym settings columns + settings RPC
supabase/migrations/20261008120200_m1_activity_log.sql       activity_log + audit trigger
supabase/tests/0001_rbac_core.sql                            28 pgTAP assertions
supabase/tests/0002_m1_settings_activity_log.sql             24 pgTAP assertions
supabase/seed.sql                                            demo gym FH, 2 staff, 12 members, packages, check-ins
docs/admin/BLIND_ASSUMPTIONS.md                              every assumption, with fix points
docs/admin/DECISIONS.md                                      ADR-001 … ADR-010
```

## Commands (run in the real repository, from its root)

Nothing in this slice has been applied or tested yet: **Docker and the Supabase
CLI are not available in the environment where it was written.**

```bash
# 1. Local stack
supabase start

# 2. Apply the whole chain from scratch, then the seed
supabase db reset

# 3. pgTAP (48 assertions across two files)
supabase test db

# 4. If the repo has a migration at or after 20261008120000, rename ours first:
ls supabase/migrations | sort | tail -5
```

If `supabase db reset` fails on an object name, the failure points at a row in
`docs/admin/BLIND_ASSUMPTIONS.md` — each row names the file and the section to
change.

## Smoke-test checklist

- [ ] `supabase db reset` completes without errors.
- [ ] `supabase test db` reports 28 + 24 passing assertions, 0 failures.
- [ ] `select count(*) from public.admin_roles where gym_id = '<gym>'` returns 5.
- [ ] `select public.has_permission('roles.manage')` — as the seeded Admin,
      returns `true`; as the seeded Receptionist, returns `false`.
- [ ] Sign in locally as `admin@flexhouse.test` / `password123` (dev only): the
      profile exists and `staff_roles` links it to the Admin role.
- [ ] Sign in as `desk@flexhouse.test` / `password123`: only the Receptionist
      permission keys are visible via `admin_role_permissions_select_self`.
- [ ] Update a member's status: a row appears in `public.activity_log` with
      `module = 'Members'` and a `diff` that contains no secret-like keys.
- [ ] `select public.update_gym_settings(p_accent_color => '#22D3EE')` as the
      Admin succeeds; as the Receptionist it raises `42501`.
- [ ] `update public.gyms set accent_color = 'red'` via the RPC raises `22023`.

## Not runnable here (and why)

| Step | Status | Command for you |
|---|---|---|
| `supabase start` / `db reset` / `test db` | NOT RUN — no Docker, no Supabase CLI | `supabase start && supabase db reset && supabase test db` |
| `npm ci`, `npm run typecheck`, `npm run lint` | NOT RUN — `/admin` does not exist in this slice; this workspace is bun-based | after the scaffold lands |
| `npm test` (Vitest) | NOT RUN — Vitest is not installed and no admin app exists | after the scaffold lands |
| `npx playwright test` | NOT RUN — Playwright and browsers are not installed | after the scaffold lands |
| `npm run build` (bundle budget) | NOT RUN — no admin app to build | after the scaffold lands |
| Mobile regression | NOT RUN — no mobile app in this workspace | run the app's own suite in the real repo |
