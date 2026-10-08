# Blind-write assumptions (Slice 1)

The Slice 1 database layer was written **without access to the real repository**:
this environment contained no `supabase/` directory, no migrations, no
`SYNC.md`, no mobile app and no spec document (see the pre-flight report in the
conversation). Everything below is an assumption that must be confirmed against
the real repo. Nothing in Slice 1 is verified: Docker and the Supabase CLI are
not available here, so no migration has been applied and no pgTAP test has run.

Rule applied throughout: when two readings were possible, the *safer* one was
implemented, and the row below says which file to change if the repo disagrees.

## 1. Assumed pre-existing tables and columns

| # | Assumption | Used by | Risk | If wrong, fix in |
|---|---|---|---|---|
| A1 | `public.gyms` exists with `id uuid pk` and `name` | all three migrations, seed | low | — |
| A2 | `public.profiles` exists with `id uuid pk` (= `auth.users.id`) and `gym_id uuid` | `current_gym_id()`, `has_permission()`, RBAC policies | medium | `20261008120000_m1_rbac_core.sql` (`current_gym_id`, `has_permission`) |
| A3 | `public.profiles.role` exists and holds `owner`/`manager`/`front_desk`/`scanner` (+ `trainer`) | role backfill, RLS that reads `role` | medium | role backfill `DO` block in the RBAC migration |
| A4 | **`public.staff_roles.profile_id`** is the column that links a staff row to a profile | `has_permission()`, `staff_roles_select_self`, `admin_role_permissions_select_self` | **high** | four places in `20261008120000_m1_rbac_core.sql` |
| A5 | `public.staff_roles` has `gym_id` and `role text` | RBAC migration, seed | medium | same file, trigger + backfill |
| A6 | `public.staff_roles` has no `revoked_at`/`deleted_at`/`updated_at` yet | added with `ADD COLUMN IF NOT EXISTS` | low | — |
| A7 | `public.members` exists with `member_code`, `status`, `valid_until` | seed (12 members) | medium | `supabase/seed.sql` section 5 |
| A8 | `public.members` has name/phone columns matching at least one of `first_name`, `last_name`, `name`, `full_name`, `phone` | seed | medium | `supabase/seed.sql` section 5 (`seed_insert` skips unknown columns, which would leave rows sparse) |
| A9 | `public.plans` has `name` plus one of `price_minor`/`price`, and one of `duration_months`/`duration_days` | seed (4 packages) | medium | `supabase/seed.sql` section 4 |
| A10 | `public.checkins` has `gym_id`, `member_id` and one of `checked_in_at`/`created_at` | seed (6 check-ins) | medium | `supabase/seed.sql` section 6 |
| A11 | `auth.users` / `auth.identities` accept the column sets used (GoTrue version dependent) | seed (login for the demo users) | medium | `supabase/seed.sql` section 2 |
| A12 | No table named `admin_roles`, `admin_role_permissions`, `activity_log` exists yet | migrations 1 and 3 | low | rename to the repo's convention if one exists |

Migration 1 now starts with a pre-flight block: if `public.gyms`, `public.profiles` or
`public.staff_roles` is missing, or if `gyms.id`, `profiles.gym_id`,
`staff_roles.profile_id` or `staff_roles.gym_id` is named differently, it stops
with that table's actual column list and a pointer to the assumption row above,
instead of failing inside a policy expression.

## 2. Assumptions about behaviour and naming that are mine, not the spec's

| # | Assumption | Why it exists | Risk |
|---|---|---|---|
| B1 | Permission keys (`members.view`, `fees.record`, `roles.manage`, …) are my naming. The prompt gives the RBAC *modules* (E11), not key strings. | nothing in the prompt fixes the key strings | **high** — reconcile with the spec doc's matrix before Slice 4 |
| B2 | `profile.self` is an invented key, used to express "own profile" for Receptionist and Trainer (E11). | E11 needs a key for it | medium |
| B3 | `otp_reauth_days = 0` is read as "never re-authenticate" (E9). | E9 says "or never" without saying how it is encoded | medium |
| B4 | `quiet_hours` are stored as two `time` columns in gym-local time, with `quiet_enforced` defaulting to true. | E10 mentions quiet hours without a schema | medium |
| B5 | `member_id_prefix` is 1–6 characters of `A-Z0-9`; the counter is a `bigint` on `gyms` guarded by the `member_code_counter >= 0` check. | E5 needs an atomic counter; Slice 1 only adds the column | medium |
| B6 | Super Admin is `profiles.is_super_admin boolean` (added by migration 1). | B10 says Super Admin lives outside per-gym RBAC but does not say how it is stored | medium — if the repo already has a flag or an `app_metadata` claim, drop the column and read that instead |
| B7 | `activity_log.diff` stores `{column: {from, to}}` for updates and the full safe row for inserts/deletes. | D6 requires a diff without specifying a shape | low |
| B8 | Module labels in `activity_log_module()` are my display names. | Activity Log filters (Slice 5) need them | low |
| B9 | Staff attendance (B9 "separate subject design you propose") is **not** in Slice 1 — `staff_id` and `device_id` on `checkins` belong to Slice 3. | Slice 1 scope is RBAC, settings, audit | low |

## 3. Migration timestamps

Chosen at `20261008120000`, `20261008120100`, `20261008120200` (14 digits, later
than today's date-based chain is assumed to be). If the repo already has a
migration at or after that timestamp, rename the three files and re-run — the
order inside the set must be preserved.

## 4. What could not be checked at all

- Whether `supabase db reset` applies the chain — **no Docker, no Supabase CLI**.
- Whether the pgTAP files pass — same reason.
- Whether the seed's assumptions about `auth.users` hold for the repo's GoTrue version.
- Whether an existing staff-management UI writes directly to `staff_roles`: migration 1
  revokes `INSERT/UPDATE/DELETE` on that table from `anon`/`authenticated`
  (see DECISIONS ADR-005). Rollback if it does: `grant insert, update, delete on
  public.staff_roles to authenticated;` and route those writes through an RPC.
