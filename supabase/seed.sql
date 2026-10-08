-- ============================================================================
-- GymNetic · local demo seed (Slice 1)
--
-- Runs only through `supabase db reset` on a local database. Never in
-- production: demos and tests read from here, production code does not.
--
-- WRITTEN BLIND — see docs/admin/BLIND_ASSUMPTIONS.md. To stay robust against
-- table shapes this environment could not read, every insert goes through
-- public.seed_insert(), which keeps only the columns that actually exist and
-- skips rows it cannot place. Fix points are listed in the assumptions file.
--
-- Fixture contract (tests depend on these exact ids/emails/prefixes):
--   gym     11111111-1111-1111-1111-111111111111  prefix FH, PKR, Asia/Karachi
--   admin   11111111-1111-1111-1111-111111111101  admin@flexhouse.test
--   desk    11111111-1111-1111-1111-111111111102  desk@flexhouse.test
--   both passwords: password123 (local only)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Insert helper (dropped at the end of this file)
-- ---------------------------------------------------------------------------

create or replace function public.seed_insert(
  p_table text,
  p_values jsonb,
  p_where jsonb default null
)
returns void
language plpgsql
as $seed$
declare
  v_cols text[] := '{}';
  v_vals text[] := '{}';
  v_key text;
  v_value jsonb;
  v_where text;
begin
  if to_regclass(format('public.%I', p_table)) is null then
    return;
  end if;

  for v_key, v_value in select * from jsonb_each(p_values) loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = p_table
        and column_name = v_key
    ) then
      v_cols := v_cols || v_key;
      v_vals := v_vals || case
        when v_value is null or v_value = 'null'::jsonb then 'null'
        else quote_literal(v_value #>> '{}')
      end;
    end if;
  end loop;

  if coalesce(array_length(v_cols, 1), 0) = 0 then
    raise notice 'seed_insert: no known columns for table %', p_table;
    return;
  end if;

  if p_where is not null then
    select string_agg(
             format('%I = %L', key, value #>> '{}'),
             ' and '
           )
      into v_where
      from jsonb_each(p_where);
  end if;

  execute format(
    'insert into public.%I (%s) select %s%s',
    p_table,
    (select string_agg(quote_ident(c), ', ') from unnest(v_cols) as c),
    (select string_agg(v, ', ') from unnest(v_vals) as v),
    case when v_where is null then '' else format(' where not exists (select 1 from public.%I where %s)', p_table, v_where) end
  );
end;
$seed$;

-- ---------------------------------------------------------------------------
-- 1. Gym
-- ---------------------------------------------------------------------------

select public.seed_insert('gyms', jsonb_build_object(
  'id', '11111111-1111-1111-1111-111111111111',
  'name', 'FlexHouse Fitness',
  'member_id_prefix', 'FH',
  'currency', 'PKR',
  'timezone', 'Asia/Karachi',
  'phone_country_code', '+92',
  'accent_color', '#0F766E',
  'otp_reauth_days', 30,
  'quiet_from', '21:00',
  'quiet_to', '08:00',
  'quiet_enforced', true
));

-- ---------------------------------------------------------------------------
-- 2. Auth users (local dev only — password123)
-- ---------------------------------------------------------------------------

do $seed$
declare
  v_person record;
  v_cols text[] := '{}';
  v_vals text[] := '{}';
  v_columns text[] := array[
    'instance_id', 'id', 'aud', 'role', 'email', 'encrypted_password',
    'email_confirmed_at', 'raw_app_meta_data', 'raw_user_meta_data',
    'created_at', 'updated_at', 'is_sso_user', 'is_anonymous'
  ];
  v_has_identity_provider_id boolean;
begin
  for v_person in
    select * from (values
      ('11111111-1111-1111-1111-111111111101'::uuid, 'admin@flexhouse.test'),
      ('11111111-1111-1111-1111-111111111102'::uuid, 'desk@flexhouse.test')
    ) as t(id, email)
  loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'auth' and table_name = 'users'
        and column_name = 'instance_id'
    ) then
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at
      )
      select
        '00000000-0000-0000-0000-000000000000',
        v_person.id,
        'authenticated',
        'authenticated',
        v_person.email,
        crypt('password123', gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('gym_id', '11111111-1111-1111-1111-111111111111'),
        now(),
        now()
      where not exists (select 1 from auth.users where id = v_person.id);
    end if;
  end loop;

  -- Email identities, so password sign-in works locally.
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'auth' and table_name = 'identities'
      and column_name = 'provider_id'
  ) into v_has_identity_provider_id;

  if to_regclass('auth.identities') is not null then
    for v_person in
      select * from (values
        ('11111111-1111-1111-1111-111111111101'::uuid, 'admin@flexhouse.test'),
        ('11111111-1111-1111-1111-111111111102'::uuid, 'desk@flexhouse.test')
      ) as t(id, email)
    loop
      if v_has_identity_provider_id then
        insert into auth.identities (
          provider_id, user_id, identity_data, provider,
          last_sign_in_at, created_at, updated_at
        )
        select
          v_person.email, v_person.id,
          jsonb_build_object('sub', v_person.id::text, 'email', v_person.email),
          'email', now(), now(), now()
        where not exists (
          select 1 from auth.identities
          where user_id = v_person.id and provider = 'email'
        );
      else
        insert into auth.identities (
          user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
        )
        select
          v_person.id,
          jsonb_build_object('sub', v_person.id::text, 'email', v_person.email),
          'email', now(), now(), now()
        where not exists (
          select 1 from auth.identities
          where user_id = v_person.id and provider = 'email'
        );
      end if;
    end loop;
  end if;
end;
$seed$;

-- ---------------------------------------------------------------------------
-- 3. Staff profiles and role assignments
-- ---------------------------------------------------------------------------

select public.seed_insert('profiles', jsonb_build_object(
  'id', '11111111-1111-1111-1111-111111111101',
  'gym_id', '11111111-1111-1111-1111-111111111111',
  'role', 'owner',
  'name', 'Ada Owner',
  'full_name', 'Ada Owner',
  'email', 'admin@flexhouse.test',
  'phone', '+923000000001',
  'is_super_admin', false
), jsonb_build_object('id', '11111111-1111-1111-1111-111111111101'));

select public.seed_insert('profiles', jsonb_build_object(
  'id', '11111111-1111-1111-1111-111111111102',
  'gym_id', '11111111-1111-1111-1111-111111111111',
  'role', 'front_desk',
  'name', 'Rana Reception',
  'full_name', 'Rana Reception',
  'email', 'desk@flexhouse.test',
  'phone', '+923000000002',
  'is_super_admin', false
), jsonb_build_object('id', '11111111-1111-1111-1111-111111111102'));

-- Staff rows, mapped onto the seeded system roles by the M1 migration's
-- backfill (owner -> Admin, front_desk -> Receptionist). Inserting the
-- staff_roles row is enough; the trigger derives the text role.
select public.seed_insert('staff_roles', jsonb_build_object(
  'id', '11111111-1111-1111-1111-111111111201',
  'gym_id', '11111111-1111-1111-1111-111111111111',
  'profile_id', '11111111-1111-1111-1111-111111111101',
  'role', 'owner',
  'admin_role_id', (
    select id from public.admin_roles
    where gym_id = '11111111-1111-1111-1111-111111111111' and key = 'admin'
  )
), jsonb_build_object('id', '11111111-1111-1111-1111-111111111201'));

select public.seed_insert('staff_roles', jsonb_build_object(
  'id', '11111111-1111-1111-1111-111111111202',
  'gym_id', '11111111-1111-1111-1111-111111111111',
  'profile_id', '11111111-1111-1111-1111-111111111102',
  'role', 'front_desk',
  'admin_role_id', (
    select id from public.admin_roles
    where gym_id = '11111111-1111-1111-1111-111111111111' and key = 'receptionist'
  )
), jsonb_build_object('id', '11111111-1111-1111-1111-111111111202'));

-- ---------------------------------------------------------------------------
-- 4. Packages
-- ---------------------------------------------------------------------------

do $seed$
declare
  v_plan record;
begin
  for v_plan in
    select * from (values
      ('Monthly',        450000::bigint, 1,  'Off-peak hours, all group classes'),
      ('Quarterly',     1200000::bigint, 3,  'Three months, one month free'),
      ('Half Yearly',   2100000::bigint, 6,  'Six months with a personal plan'),
      ('Annual',        3800000::bigint, 12, 'Best value, includes induction')
    ) as t(name, price_minor, duration_months, notes)
  loop
    select public.seed_insert('plans', jsonb_build_object(
      'gym_id', '11111111-1111-1111-1111-111111111111',
      'name', v_plan.name,
      'price_minor', v_plan.price_minor,
      'price', v_plan.price_minor,
      'duration_months', v_plan.duration_months,
      'duration_days', v_plan.duration_months * 30,
      'active', true,
      'is_active', true,
      'notes', v_plan.notes,
      'description', v_plan.notes
    ), jsonb_build_object(
      'gym_id', '11111111-1111-1111-1111-111111111111',
      'name', v_plan.name
    ));
  end loop;
end;
$seed$;

-- ---------------------------------------------------------------------------
-- 5. Twelve members
-- ---------------------------------------------------------------------------

do $seed$
declare
  v_person record;
  v_index integer := 0;
  v_today date := (now() at time zone 'Asia/Karachi')::date;
  v_status text;
begin
  for v_person in
    select * from (values
      ('Ayesha',  'Khan',      '+923001110001', 12),
      ('Bilal',   'Ahmed',     '+923001110002', 6),
      ('Sana',    'Iqbal',     '+923001110003', 3),
      ('Usman',   'Raza',      '+923001110004', 1),
      ('Hina',    'Malik',     '+923001110005', 9),
      ('Farhan',  'Siddiqui',  '+923001110006', 0),
      ('Zara',    'Sheikh',    '+923001110007', 15),
      ('Danish',  'Ali',       '+923001110008', 2),
      ('Mariam',  'Butt',      '+923001110009', 7),
      ('Talha',   'Javed',     '+923001110010', 4),
      ('Noor',    'Fatima',    '+923001110011', 11),
      ('Hamza',   'Tariq',     '+923001110012', 5)
    ) as t(first_name, last_name, phone, months_remaining, dummy)
  loop
    v_index := v_index + 1;
    v_status := case
      when v_index = 6 then 'frozen'
      when v_index = 11 then 'expired'
      else 'active'
    end;

    select public.seed_insert('members', jsonb_build_object(
      'gym_id', '11111111-1111-1111-1111-111111111111',
      'member_code', 'FH-' || lpad(v_index::text, 4, '0'),
      'first_name', v_person.first_name,
      'last_name', v_person.last_name,
      'name', v_person.first_name || ' ' || v_person.last_name,
      'full_name', v_person.first_name || ' ' || v_person.last_name,
      'phone', v_person.phone,
      'email', lower(v_person.first_name) || '.' || lower(v_person.last_name) || '@example.test',
      'status', v_status,
      'valid_until', (v_today + (v_person.months_remaining * 30))::text,
      'joined_at', (v_today - 90)::text,
      'created_at', (v_today - 90)::text
    ), jsonb_build_object(
      'gym_id', '11111111-1111-1111-1111-111111111111',
      'member_code', 'FH-' || lpad(v_index::text, 4, '0')
    ));
  end loop;

  -- The counter the member_code allocator (Slice 2, E5) will start from.
  update public.gyms
     set member_code_counter = greatest(member_code_counter, 12)
   where id = '11111111-1111-1111-1111-111111111111';
end;
$seed$;

-- ---------------------------------------------------------------------------
-- 6. A few check-ins
-- ---------------------------------------------------------------------------

do $seed$
declare
  v_index integer := 0;
  v_member uuid;
  v_today timestamptz := date_trunc('day', now() at time zone 'Asia/Karachi');
  v_hours integer[] := array[7, 9, 12, 18, 19, 20];
begin
  for v_member in
    select id from public.members
    where gym_id = '11111111-1111-1111-1111-111111111111'
    order by member_code
    limit 6
  loop
    select public.seed_insert('checkins', jsonb_build_object(
      'gym_id', '11111111-1111-1111-1111-111111111111',
      'member_id', v_member,
      'profile_id', '11111111-1111-1111-1111-111111111102',
      'staff_id', '11111111-1111-1111-1111-111111111102',
      'checked_in_at', (v_today + make_interval(hours => v_hours[v_index + 1]))::text,
      'created_at', (v_today + make_interval(hours => v_hours[v_index + 1]))::text,
      'method', 'manual',
      'source', 'console'
    ), jsonb_build_object(
      'gym_id', '11111111-1111-1111-1111-111111111111',
      'member_id', v_member,
      'checked_in_at', (v_today + make_interval(hours => v_hours[v_index + 1]))::text
    ));
    v_index := v_index + 1;
  end loop;
end;
$seed$;

-- ---------------------------------------------------------------------------
-- 7. Fees — deferred
--
-- TODO-S3-SEED-FEES: fee_records and fee_line_items are created by Slice 3.
-- This block becomes live the moment those tables exist, and is a no-op until
-- then, so the seed stays runnable in Slice 1.
-- ---------------------------------------------------------------------------

do $seed$
begin
  if to_regclass('public.fee_records') is not null then
    insert into public.fee_records (gym_id, member_id, fee_type, amount_minor, paid_minor, balance_minor, status, period_start, created_at)
    select
      '11111111-1111-1111-1111-111111111111',
      m.id,
      'membership',
      450000,
      case when m.member_code in ('FH-0001', 'FH-0004') then 450000 else 200000 end,
      case when m.member_code in ('FH-0001', 'FH-0004') then 0 else 250000 end,
      case when m.member_code in ('FH-0001', 'FH-0004') then 'paid' else 'partial' end,
      ((now() at time zone 'Asia/Karachi')::date - 15)::text,
      now()
    from public.members m
    where m.gym_id = '11111111-1111-1111-1111-111111111111'
      and m.member_code in ('FH-0001', 'FH-0002', 'FH-0004')
      and not exists (
        select 1 from public.fee_records f
        where f.gym_id = m.gym_id and f.member_id = m.id
      );
  else
    raise notice 'seed: fee_records does not exist yet (Slice 3) — skipping demo fees';
  end if;
end;
$seed$;

-- ---------------------------------------------------------------------------
-- 8. Clean up the seed helper
-- ---------------------------------------------------------------------------

drop function if exists public.seed_insert(text, jsonb, jsonb);
