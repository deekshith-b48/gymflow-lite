# Decisions — admin console

Format: ADR-lite. One entry per decision that a reader might otherwise
second-guess. Slice 1 entries below; later slices append.

---

## ADR-001 · Gym settings are written through an RPC, not a new RLS policy
**Slice 1 · `20261008120100_m1_gym_settings.sql`**

The obvious alternative was to add a permissive `UPDATE` policy to `gyms`
guarded by `has_permission('gym.settings.manage')`. Rejected: adding a policy to
an existing table whose current policies are unknown can only ever *widen*
access (policies are OR-ed). A `SECURITY DEFINER` RPC that checks the permission
and validates every field cannot widen anything, and it gives one place to
validate colours, prefixes, timezones and quiet hours.
**Consequence:** direct `UPDATE`s on `gyms` keep whatever behaviour the repo
already has; the console uses `update_gym_settings`.

## ADR-002 · Unknown legacy roles fail closed
**Slice 1 · RBAC migration backfill**

When mapping existing `staff_roles` rows onto the seeded system roles, an
unrecognised `role` value is left unlinked (`admin_role_id is null`) instead of
being given a default role. A staff member with no role has no console
permissions until an Admin assigns one. The alternative — defaulting to
Receptionist — would silently grant members/attendance/fees access to an
unknown legacy value.
**Consequence:** after the migration, run the mapper's report (Slice 4 UI) and
assign roles for any unlinked staff rows.

## ADR-003 · A forged `gym_id` is rejected, not silently overwritten
**Slice 1 · RBAC migration, `set_gym_id_from_caller()`**

The prompt (D1) says a client-supplied `gym_id` is "ignored". Implemented as:
`null` → filled from the caller's gym; **different value → `42501`**. Silently
overwriting hides a bug or an attack; rejecting it surfaces both, and it is what
the D9 denial test asserts. A service-role or migration caller (no `auth.uid()`)
must supply `gym_id` explicitly and is trusted with it.

## ADR-004 · `activity_log` denies client writes twice
**Slice 1 · `20261008120200_m1_activity_log.sql`**

`INSERT/UPDATE/DELETE` are revoked from `anon`/`authenticated` **and** explicit
`with check (false)` / `using (false)` policies exist. Belt and braces because
D1 requires policies for every command: a table with RLS enabled and no write
policy would technically satisfy "no writes", but the intent is invisible in the
schema. Rows are written by `SECURITY DEFINER` triggers, which bypass both.

## ADR-005 · Direct writes to `staff_roles` are revoked
**Slice 1 · RBAC migration**

`INSERT/UPDATE/DELETE` on `staff_roles` are revoked from `anon`/`authenticated`
so a staff member cannot mint permissions for themselves. Role administration
moves to a permission-checked RPC in Slice 4.
**Risk:** if the existing repo has a UI that writes to `staff_roles` directly,
it breaks until Slice 4. Rollback: `grant insert, update, delete on
public.staff_roles to authenticated;`.

## ADR-006 · New constraints are added `NOT VALID`
**Slice 1 · `20261008120100_m1_gym_settings.sql`**

A `CHECK` constraint on an existing table can fail the whole migration on
pre-existing data. Added `NOT VALID` so new and updated rows are checked while
`supabase db reset` cannot be blocked by legacy rows.
**Follow-up:** `TODO-M1-SETTINGS-VALIDATE` — validate the constraints after the
data pass (`alter table public.gyms validate constraint gyms_accent_color_hex;` …).

## ADR-007 · The audit actor comes from JWT claims, not a `profiles` join
**Slice 1 · activity log trigger**

Reading `profiles.name`/`profiles.email` would add two more blind assumptions
about columns. The trigger instead reads `request.jwt.claims` (`sub`, `email`)
and falls back to `'system'`. This also works for changes arriving through
`sync_push`, which carry no session of their own.
**Consequence:** the log shows the acting user's email, not their display name.
If the repo's profiles has a stable name column, join it in Slice 5's log view.

## ADR-008 · The seed's inserts adapt to the schema instead of assuming it
**Slice 1 · `supabase/seed.sql`**

Every seeded row goes through a `seed_insert(table, values, where)` helper that
keeps only the columns that exist and skips duplicate rows. The helper is
created at the top of the seed and dropped at the end, so it never exists in a
production schema. Reason: this is the file most likely to be edited by hand
after `db reset`, and adapting is cheaper than a failed reset.

## ADR-009 · Tests read seed fixtures and roll back
**Slice 1 · `supabase/tests/0001_*`, `0002_*`**

Each pgTAP file wraps its work in `begin; … rollback;` and impersonates staff by
setting `request.jwt.claims` and `set local role authenticated`. Fixtures come
from `seed.sql` (fixed UUIDs documented at the top of that file) rather than
being created inside the test, because creating a `profiles` row requires
knowing its full column set — an assumption worth holding in exactly one place.

## ADR-010 · Slice 1 ships the database layer only
**Slice 1 · scope**

The `/admin` scaffold (Vite app, tokens, AppShell, login, guards, primitives)
was **not** written. Reason: it cannot be installed or type-checked in this
environment (no Supabase CLI/Docker, and adding React 18 + TanStack Router/Query
+ Table + Vitest + Playwright to this workspace's existing Vite/Convex app would
change a running application for an unverifiable gain). Writing ~30 files of
unverifiable TSX would also violate the "no invented APIs" rule for library
details I cannot check against `node_modules`. The scaffold is planned with its
file list in the slice report; it needs either the real repo attached or an
explicit go-ahead to add those dependencies here.
