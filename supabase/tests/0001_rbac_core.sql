-- ============================================================================
-- pgTAP · M1 RBAC core
--
-- Fixtures come from supabase/seed.sql (see the fixture contract at the top of
-- that file). Everything here runs inside one transaction that is rolled back,
-- so the demo data is left untouched:
--   supabase db reset && supabase test db
--
-- WRITTEN BLIND — ids for the staff profiles and the gym are assumptions
-- shared with seed.sql; see docs/admin/BLIND_ASSUMPTIONS.md.
-- ============================================================================

begin;

select plan(28);

-- ---------------------------------------------------------------------------
-- Structure
-- ---------------------------------------------------------------------------

select has_table('public', 'admin_roles', 'admin_roles exists');
select has_table('public', 'admin_role_permissions', 'admin_role_permissions exists');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.admin_roles'::regclass),
  'admin_roles has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.admin_role_permissions'::regclass),
  'admin_role_permissions has RLS enabled'
);

select ok(
  (select count(distinct cmd) from pg_policies
   where schemaname = 'public' and tablename = 'admin_roles'
     and cmd in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')) = 4,
  'admin_roles has a policy for every command'
);
select ok(
  (select count(distinct cmd) from pg_policies
   where schemaname = 'public' and tablename = 'admin_role_permissions'
     and cmd in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')) = 4,
  'admin_role_permissions has a policy for every command'
);

select ok(
  exists (select 1 from pg_trigger where tgname = 'admin_roles_set_gym_id'),
  'admin_roles takes gym_id from the caller'
);
select ok(
  exists (select 1 from pg_trigger where tgname = 'admin_roles_gym_id_immutable'),
  'admin_roles gym_id is immutable'
);

-- ---------------------------------------------------------------------------
-- Function grants (D3)
-- ---------------------------------------------------------------------------

select ok(
  not has_function_privilege('anon', 'public.has_permission(text)', 'EXECUTE'),
  'anon cannot call has_permission'
);
select ok(
  has_function_privilege('authenticated', 'public.has_permission(text)', 'EXECUTE'),
  'authenticated can call has_permission'
);
select ok(
  not has_function_privilege('authenticated', 'public.admin_roles_seed_for_gym(uuid)', 'EXECUTE'),
  'clients cannot re-seed system roles'
);
select ok(
  not has_function_privilege('anon', 'public.current_gym_id()', 'EXECUTE'),
  'anon cannot resolve a gym'
);

-- ---------------------------------------------------------------------------
-- System roles and the E11 matrix (postgres context)
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer from public.admin_roles
   where gym_id = '11111111-1111-1111-1111-111111111111'),
  5,
  'five system roles seeded for FlexHouse'
);

select ok(
  not exists (
    select 1 from public.admin_roles ar
    where ar.gym_id = '11111111-1111-1111-1111-111111111111'
      and not exists (
        select 1 from public.admin_role_permissions p where p.role_id = ar.id
      )
  ),
  'every seeded role has at least one permission'
);

select ok(
  public.role_permission_keys('admin') @> array['roles.manage', 'packages.create', 'gym.settings.manage', 'fees.delete'],
  'Admin holds the administrative keys'
);
select ok(
  not (public.role_permission_keys('manager') && array['roles.manage', 'packages.edit', 'gym.settings.manage']),
  'Manager has no package, role or gym-settings edits'
);
select ok(
  public.role_permission_keys('receptionist') @> array['members.view', 'attendance.record', 'fees.record', 'profile.self'],
  'Receptionist holds the front-desk keys'
);
select ok(
  not (public.role_permission_keys('scanner') @> array['fees.view']),
  'Scanner cannot see fees'
);

select is(
  (select role from public.staff_roles where id = '11111111-1111-1111-1111-111111111202'),
  'front_desk',
  'staff_roles.role is derived from the assigned role'
);

-- A second gym, so cross-gym denial has something to deny.
insert into public.gyms (id, name)
values ('22222222-2222-2222-2222-222222222222', 'Other Gym');

-- ---------------------------------------------------------------------------
-- Impersonation: the Admin
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111101","role":"authenticated"}',
  true
);
set local role authenticated;

select ok(public.has_permission('roles.manage'), 'Admin can manage roles');
select ok(public.has_permission('gym.settings.manage'), 'Admin can manage gym settings');

select is(
  (select count(*)::integer from public.admin_roles
   where gym_id = '22222222-2222-2222-2222-222222222222'),
  0,
  'the other gym''s roles are invisible across tenants'
);

select throws_ok(
  $$ insert into public.admin_roles (gym_id, key, name, base_category)
     values ('22222222-2222-2222-2222-222222222222', 'custom', 'Custom', 'manager') $$,
  '42501',
  null,
  'a forged gym_id is rejected'
);

select lives_ok(
  $$ insert into public.admin_roles (key, name, base_category)
     values ('custom', 'Custom Role', 'manager') $$,
  'an Admin can create a custom role in their own gym'
);

reset role;

-- ---------------------------------------------------------------------------
-- Impersonation: the Receptionist
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111102","role":"authenticated"}',
  true
);
set local role authenticated;

select ok(public.has_permission('members.view'), 'Receptionist can view members');
select ok(not public.has_permission('roles.manage'), 'Receptionist cannot manage roles');
select ok(not public.has_permission('gym.settings.manage'), 'Receptionist cannot change gym settings');

reset role;

-- Revoking the assignment removes access immediately (B10).
update public.staff_roles
   set revoked_at = now()
 where id = '11111111-1111-1111-1111-111111111202';

select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111102","role":"authenticated"}',
  true
);
set local role authenticated;

select ok(not public.has_permission('members.view'), 'a revoked staff member loses console access');

reset role;

select * from finish();

rollback;
