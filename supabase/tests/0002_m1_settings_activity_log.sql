-- ============================================================================
-- pgTAP · M1 gym settings + base activity log
--
-- Fixtures come from supabase/seed.sql. Runs in one transaction that is rolled
-- back, so the demo data is untouched:
--   supabase db reset && supabase test db
--
-- WRITTEN BLIND — see docs/admin/BLIND_ASSUMPTIONS.md.
-- ============================================================================

begin;

select plan(24);

-- ---------------------------------------------------------------------------
-- Settings columns (Slice 1 list)
-- ---------------------------------------------------------------------------

select has_column('public', 'gyms', 'accent_color', 'gyms.accent_color exists');
select has_column('public', 'gyms', 'otp_reauth_days', 'gyms.otp_reauth_days exists');
select has_column('public', 'gyms', 'quiet_from', 'gyms.quiet_from exists');
select has_column('public', 'gyms', 'quiet_to', 'gyms.quiet_to exists');
select has_column('public', 'gyms', 'quiet_enforced', 'gyms.quiet_enforced exists');
select has_column('public', 'gyms', 'logo_path', 'gyms.logo_path exists');
select has_column('public', 'gyms', 'member_id_prefix', 'gyms.member_id_prefix exists');
select has_column('public', 'gyms', 'member_code_counter', 'gyms.member_code_counter exists');

select is(
  (select member_id_prefix from public.gyms where id = '11111111-1111-1111-1111-111111111111'),
  'FH',
  'the seeded gym keeps its FH prefix'
);
select is(
  (select member_code_counter >= 12 from public.gyms where id = '11111111-1111-1111-1111-111111111111'),
  true,
  'the member code counter reflects the seeded members'
);

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

select ok(
  not has_function_privilege(
    'anon',
    'public.update_gym_settings(text,integer,time,time,boolean,text,text,text,text,text)',
    'EXECUTE'
  ),
  'anon cannot change gym settings'
);
select ok(
  has_function_privilege('authenticated', 'public.gym_settings()', 'EXECUTE'),
  'authenticated can read gym settings'
);

-- ---------------------------------------------------------------------------
-- Permission checks on the write path
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111102","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$ select public.update_gym_settings(p_accent_color => '#112233') $$,
  '42501',
  null,
  'a Receptionist cannot change gym settings'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111101","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$ select public.update_gym_settings(p_accent_color => '#112233') $$,
  'an Admin can change gym settings'
);

reset role;

select is(
  (select accent_color from public.gyms where id = '11111111-1111-1111-1111-111111111111'),
  '#112233',
  'the new accent colour is persisted'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111101","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$ select public.update_gym_settings(p_accent_color => 'red') $$,
  '22023',
  null,
  'an invalid colour is rejected'
);

reset role;

-- ---------------------------------------------------------------------------
-- Activity log (D6)
-- ---------------------------------------------------------------------------

select has_table('public', 'activity_log', 'activity_log exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.activity_log'::regclass),
  'activity_log has RLS enabled'
);
select ok(
  exists (select 1 from pg_trigger where tgname = 'activity_log_members'),
  'member changes are audited'
);

update public.members
   set status = 'active'
 where gym_id = '11111111-1111-1111-1111-111111111111'
   and member_code = 'FH-0006';

select ok(
  (select count(*) from public.activity_log
   where entity_table = 'members'
     and gym_id = '11111111-1111-1111-1111-111111111111') >= 1,
  'a member update wrote an audit row'
);

select is(
  public.activity_log_safe_jsonb(
    '{"name":"Ayesha","national_id_encrypted":"abc","api_key":"sk_live_x","password_hash":"z"}'::jsonb
  ),
  '{"name":"Ayesha"}'::jsonb,
  'secrets and national ids are stripped from audit diffs'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111101","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$ insert into public.activity_log (gym_id, module, event)
     values ('11111111-1111-1111-1111-111111111111', 'Members', 'created') $$,
  '42501',
  null,
  'clients cannot insert audit rows'
);
select throws_ok(
  $$ update public.activity_log set description = 'tampered' $$,
  '42501',
  null,
  'clients cannot edit audit rows'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111102","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (select count(*)::integer from public.activity_log),
  0,
  'activity rows are invisible without the activity.view permission'
);

reset role;

select * from finish();

rollback;
