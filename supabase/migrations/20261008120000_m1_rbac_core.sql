-- ============================================================================
-- M1 · RBAC core (spec B10, D1, D3, E11)
--
-- WRITTEN BLIND: the real repository was not attached to this environment.
-- Every existing object referenced here is an assumption; the full list with
-- risk levels is in docs/admin/BLIND_ASSUMPTIONS.md. Assumed pre-existing:
--   public.gyms      (id uuid pk)
--   public.profiles  (id uuid pk, gym_id uuid, role text)
--   public.staff_roles (id, gym_id, profile_id, role text)
-- If a name differs, the fix is localised and listed in that file.
--
-- Rerunnable: every object is created with IF NOT EXISTS or DROP ... IF EXISTS.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- Pre-flight: fail fast, with a readable message, when an assumed object is
-- missing or named differently. Without this the migration fails somewhere
-- deep in a policy expression, which is much harder to act on.
-- ---------------------------------------------------------------------------

do $do$
  declare
    v_found text;
  begin
    if to_regclass('public.gyms') is null then
      raise exception 'M1 RBAC: public.gyms not found — see docs/admin/BLIND_ASSUMPTIONS.md (A1)'
        using errcode = '42P01';
    end if;
    if to_regclass('public.profiles') is null then
      raise exception 'M1 RBAC: public.profiles not found — see docs/admin/BLIND_ASSUMPTIONS.md (A2)'
        using errcode = '42P01';
    end if;
    if to_regclass('public.staff_roles') is null then
      raise exception 'M1 RBAC: public.staff_roles not found — see docs/admin/BLIND_ASSUMPTIONS.md (A5)'
        using errcode = '42P01';
    end if;

    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'gyms' and column_name = 'id'
    ) then
      select string_agg(column_name, ', ' order by column_name) into v_found
      from information_schema.columns
      where table_schema = 'public' and table_name = 'gyms';
      raise exception 'M1 RBAC: public.gyms has no id column. Columns found: %. See BLIND_ASSUMPTIONS.md A1.', v_found
        using errcode = '42703';
    end if;

    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles' and column_name = 'gym_id'
    ) then
      select string_agg(column_name, ', ' order by column_name) into v_found
      from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles';
      raise exception 'M1 RBAC: public.profiles has no gym_id column. Columns found: %. See BLIND_ASSUMPTIONS.md A2.', v_found
        using errcode = '42703';
    end if;

    -- A4: the highest-risk assumption in this slice. Four references depend on it.
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'staff_roles' and column_name = 'profile_id'
    ) then
      select string_agg(column_name, ', ' order by column_name) into v_found
      from information_schema.columns
      where table_schema = 'public' and table_name = 'staff_roles';
      raise exception
        'M1 RBAC: public.staff_roles has no profile_id column (found: %). Update the four references in has_permission/staff_roles_select_self/admin_role_permissions_select_self/the backfill, then re-apply. See BLIND_ASSUMPTIONS.md A4.',
        v_found
        using errcode = '42703';
    end if;

    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'staff_roles' and column_name = 'gym_id'
    ) then
      raise exception 'M1 RBAC: public.staff_roles has no gym_id column — see BLIND_ASSUMPTIONS.md A5'
        using errcode = '42703';
    end if;
  end;
$do$;

-- ---------------------------------------------------------------------------
-- 0. Helpers
-- ---------------------------------------------------------------------------

-- Assumed absent or identical. CREATE OR REPLACE keeps this safe either way.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- The caller's gym. SECURITY DEFINER so it can read profiles without tripping
-- profiles' own RLS (avoids policy recursion).
create or replace function public.current_gym_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.gym_id from public.profiles p where p.id = auth.uid();
$$;

revoke execute on function public.current_gym_id() from public;
grant execute on function public.current_gym_id() to authenticated;

-- Super Admin bypass lives outside per-gym RBAC (B10). Assumed absent.
alter table public.profiles
  add column if not exists is_super_admin boolean not null default false;

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

create table if not exists public.admin_roles (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  key text not null,
  name text not null,
  description text,
  -- Base category keeps the legacy staff_roles.role text meaningful so the
  -- existing RLS policies that read `role` keep working (B10).
  base_category text not null
    check (base_category in ('owner', 'manager', 'front_desk', 'trainer', 'scanner')),
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (gym_id, key)
);

create index if not exists admin_roles_gym_updated_idx
  on public.admin_roles (gym_id, updated_at desc);
create index if not exists admin_roles_gym_category_idx
  on public.admin_roles (gym_id, base_category);

create table if not exists public.admin_role_permissions (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  role_id uuid not null references public.admin_roles(id) on delete cascade,
  permission_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (role_id, permission_key)
);

create index if not exists admin_role_permissions_gym_role_idx
  on public.admin_role_permissions (gym_id, role_id);
create index if not exists admin_role_permissions_gym_updated_idx
  on public.admin_role_permissions (gym_id, updated_at desc);

-- One role assignment per staff member (B10).
alter table public.staff_roles
  add column if not exists admin_role_id uuid
    references public.admin_roles(id) on delete restrict;
alter table public.staff_roles add column if not exists revoked_at timestamptz;
alter table public.staff_roles add column if not exists deleted_at timestamptz;
alter table public.staff_roles add column if not exists updated_at timestamptz;
alter table public.staff_roles add column if not exists created_at timestamptz;

create index if not exists staff_roles_gym_profile_idx
  on public.staff_roles (gym_id, profile_id);
create index if not exists staff_roles_admin_role_idx
  on public.staff_roles (admin_role_id);

-- ---------------------------------------------------------------------------
-- 2. Permission matrix (E11 defaults)
-- ---------------------------------------------------------------------------

-- Internal helper: the permission keys a system role starts with. Kept as data
-- in one function so the Roles & Permissions UI (Slice 4) has a single
-- template source ("copy from template").
create or replace function public.role_permission_keys(p_role_key text)
returns text[]
language sql
immutable
as $$
  select case p_role_key
    when 'admin' then array[
      'members.view','members.create','members.edit','members.delete','members.record',
      'attendance.view','attendance.record','attendance.manage',
      'fees.view','fees.create','fees.edit','fees.delete','fees.record',
      'expenses.view','expenses.create','expenses.edit','expenses.delete',
      'sales.view','sales.create','sales.edit','sales.delete',
      'withdrawals.view','withdrawals.create','withdrawals.edit','withdrawals.delete',
      'packages.view','packages.create','packages.edit','packages.delete',
      'addons.view','addons.create','addons.edit','addons.delete',
      'staff.view','staff.create','staff.edit','staff.delete','staff.manage',
      'trainers.view','trainers.create','trainers.edit','trainers.delete','trainers.manage',
      'roles.view','roles.manage',
      'notifications.view','notifications.manage',
      'activity.view','reports.view',
      'gym.settings.view','gym.settings.manage',
      'subscription.view','subscription.manage',
      'profile.self'
    ]
    -- Manager: no package, role or gym-settings edits (E11).
    when 'manager' then array[
      'members.view','members.create','members.edit','members.record',
      'attendance.view','attendance.record','attendance.manage',
      'fees.view','fees.create','fees.edit','fees.record',
      'expenses.view','expenses.create','expenses.edit',
      'sales.view','sales.create','sales.edit',
      'withdrawals.view','withdrawals.create',
      'addons.view',
      'staff.view','staff.create',
      'trainers.view','trainers.create','trainers.edit','trainers.manage',
      'notifications.view','notifications.manage',
      'activity.view','reports.view','gym.settings.view',
      'subscription.view','profile.self'
    ]
    -- Receptionist: members, attendance, fees, own profile (E11).
    when 'receptionist' then array[
      'members.view','members.create','members.edit','members.record',
      'attendance.view','attendance.record',
      'fees.view','fees.create','fees.record',
      'profile.self'
    ]
    -- Trainer: members, attendance, fees, own profile (E11).
    when 'trainer' then array[
      'members.view','members.edit',
      'attendance.view','attendance.record',
      'fees.view',
      'profile.self'
    ]
    -- Scanner: check-in only (B10).
    when 'scanner' then array[
      'members.view','attendance.view','attendance.record','profile.self'
    ]
    else array[]::text[]
  end;
$$;

revoke execute on function public.role_permission_keys(text) from public;

-- Seeds (or resets) the five system roles for one gym. Safe to re-run.
create or replace function public.admin_roles_seed_for_gym(p_gym_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role record;
  v_role_id uuid;
begin
  if p_gym_id is null then
    raise exception 'admin_roles_seed_for_gym: gym id is required'
      using errcode = '22004';
  end if;

  for v_role in
    select * from (values
      ('admin',        'Admin',        'Full control of the gym, including roles and settings.', 'owner'),
      ('manager',      'Manager',      'Runs day-to-day operations without package, role or gym settings edits.', 'manager'),
      ('receptionist', 'Receptionist', 'Front desk: members, attendance and fee collection.', 'front_desk'),
      ('trainer',      'Trainer',      'Coaching view: members, attendance, fees and own profile.', 'trainer'),
      ('scanner',      'Scanner',      'Check-in desk only.', 'scanner')
    ) as t(key, name, description, base_category)
  loop
    insert into public.admin_roles (gym_id, key, name, description, base_category, is_system)
    values (p_gym_id, v_role.key, v_role.name, v_role.description, v_role.base_category, true)
    on conflict (gym_id, key) do update
      set name = excluded.name,
          description = excluded.description,
          base_category = excluded.base_category,
          updated_at = now()
    returning id into v_role_id;

    insert into public.admin_role_permissions (gym_id, role_id, permission_key)
    select p_gym_id, v_role_id, permission_key
    from unnest(public.role_permission_keys(v_role.key)) as permission_key
    on conflict (role_id, permission_key) do nothing;
  end loop;
end;
$$;

revoke execute on function public.admin_roles_seed_for_gym(uuid) from public;

-- ---------------------------------------------------------------------------
-- 3. Triggers
-- ---------------------------------------------------------------------------

-- gym_id is never taken on trust: it must match the caller's gym (D1).
create or replace function public.set_gym_id_from_caller()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_gym_id uuid := public.current_gym_id();
begin
  if v_gym_id is null then
    -- Service role, migrations and seeds have no JWT; they must supply it.
    if new.gym_id is null then
      raise exception '%.gym_id is required when there is no caller gym', tg_table_name
        using errcode = '23502';
    end if;
    return new;
  end if;

  if new.gym_id is null then
    new.gym_id := v_gym_id;
    return new;
  end if;

  if new.gym_id <> v_gym_id then
    raise exception '%.gym_id (%) does not match the caller''s gym (%)',
      tg_table_name, new.gym_id, v_gym_id
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_gym_id_immutable()
returns trigger
language plpgsql
as $$
begin
  if new.gym_id is distinct from old.gym_id then
    raise exception '%.gym_id is immutable', tg_table_name using errcode = '42501';
  end if;
  return new;
end;
$$;

-- New gyms get their system roles immediately.
create or replace function public.gyms_after_insert_seed_admin_roles()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.admin_roles_seed_for_gym(new.id);
  return new;
end;
$$;

drop trigger if exists gyms_seed_admin_roles on public.gyms;
create trigger gyms_seed_admin_roles
  after insert on public.gyms
  for each row execute function public.gyms_after_insert_seed_admin_roles();

-- staff_roles.role stays derived from the assigned role's base category, so
-- existing policies that read the text column keep working (B10).
create or replace function public.staff_roles_sync_role_text()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_category text;
begin
  if new.admin_role_id is not null then
    select base_category into v_category
    from public.admin_roles
    where id = new.admin_role_id;

    if v_category is not null then
      new.role := v_category;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists staff_roles_sync_role_text on public.staff_roles;
create trigger staff_roles_sync_role_text
  before insert or update of admin_role_id on public.staff_roles
  for each row execute function public.staff_roles_sync_role_text();

do $do$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'staff_roles_set_gym_id'
  ) then
    create trigger staff_roles_set_gym_id
      before insert on public.staff_roles
      for each row execute function public.set_gym_id_from_caller();
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'staff_roles_gym_id_immutable'
  ) then
    create trigger staff_roles_gym_id_immutable
      before update on public.staff_roles
      for each row execute function public.enforce_gym_id_immutable();
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'staff_roles_set_updated_at'
  ) then
    create trigger staff_roles_set_updated_at
      before update on public.staff_roles
      for each row execute function public.set_updated_at();
  end if;
end;
$do$;

drop trigger if exists admin_roles_set_gym_id on public.admin_roles;
create trigger admin_roles_set_gym_id
  before insert on public.admin_roles
  for each row execute function public.set_gym_id_from_caller();

drop trigger if exists admin_roles_gym_id_immutable on public.admin_roles;
create trigger admin_roles_gym_id_immutable
  before update on public.admin_roles
  for each row execute function public.enforce_gym_id_immutable();

drop trigger if exists admin_roles_set_updated_at on public.admin_roles;
create trigger admin_roles_set_updated_at
  before update on public.admin_roles
  for each row execute function public.set_updated_at();

drop trigger if exists admin_role_permissions_set_gym_id on public.admin_role_permissions;
create trigger admin_role_permissions_set_gym_id
  before insert on public.admin_role_permissions
  for each row execute function public.set_gym_id_from_caller();

drop trigger if exists admin_role_permissions_gym_id_immutable on public.admin_role_permissions;
create trigger admin_role_permissions_gym_id_immutable
  before update on public.admin_role_permissions
  for each row execute function public.enforce_gym_id_immutable();

drop trigger if exists admin_role_permissions_set_updated_at on public.admin_role_permissions;
create trigger admin_role_permissions_set_updated_at
  before update on public.admin_role_permissions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Backfill existing gyms and staff
-- ---------------------------------------------------------------------------

do $do$
declare
  v_gym uuid;
begin
  for v_gym in select id from public.gyms loop
    perform public.admin_roles_seed_for_gym(v_gym);
  end loop;
end;
$do$;

-- Map the legacy text roles onto the seeded system roles. Unknown values are
-- deliberately left unlinked: an unmapped staff member gets no console
-- permissions until an Admin assigns a role (fail closed, never escalate).
do $do$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'staff_roles'
      and column_name = 'role'
  ) then
    update public.staff_roles sr
       set admin_role_id = ar.id,
           updated_at = now()
      from public.admin_roles ar
     where sr.admin_role_id is null
       and ar.gym_id = sr.gym_id
       and ar.key = case lower(coalesce(sr.role, ''))
                      when 'owner' then 'admin'
                      when 'admin' then 'admin'
                      when 'manager' then 'manager'
                      when 'front_desk' then 'receptionist'
                      when 'receptionist' then 'receptionist'
                      when 'trainer' then 'trainer'
                      when 'scanner' then 'scanner'
                      else null
                    end;
  end if;
end;
$do$;

-- ---------------------------------------------------------------------------
-- 5. has_permission — evaluated in the DATABASE, at write time (B10)
-- ---------------------------------------------------------------------------

create or replace function public.has_permission(p_permission_key text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    case
      when auth.uid() is null then false
      else
        coalesce(
          (select p.is_super_admin from public.profiles p where p.id = auth.uid()),
          false
        )
        or exists (
          select 1
          from public.staff_roles sr
          join public.admin_roles ar on ar.id = sr.admin_role_id
          join public.admin_role_permissions arp
            on arp.role_id = ar.id
           and arp.permission_key = p_permission_key
          where sr.profile_id = auth.uid()          -- ASSUMPTION: staff_roles.profile_id
            and sr.gym_id = public.current_gym_id()
            and sr.revoked_at is null
            and sr.deleted_at is null
            and ar.deleted_at is null
        )
    end;
$$;

revoke execute on function public.has_permission(text) from public;
grant execute on function public.has_permission(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. RLS
-- ---------------------------------------------------------------------------

alter table public.admin_roles enable row level security;
alter table public.admin_role_permissions enable row level security;

drop policy if exists admin_roles_select on public.admin_roles;
create policy admin_roles_select on public.admin_roles
  for select to authenticated
  using (gym_id = public.current_gym_id() and public.has_permission('roles.view'));

drop policy if exists admin_roles_insert on public.admin_roles;
create policy admin_roles_insert on public.admin_roles
  for insert to authenticated
  with check (
    gym_id = public.current_gym_id()
    and public.has_permission('roles.manage')
    and is_system = false
  );

drop policy if exists admin_roles_update on public.admin_roles;
create policy admin_roles_update on public.admin_roles
  for update to authenticated
  using (
    gym_id = public.current_gym_id()
    and public.has_permission('roles.manage')
    and is_system = false
  )
  with check (gym_id = public.current_gym_id() and is_system = false);

drop policy if exists admin_roles_delete on public.admin_roles;
create policy admin_roles_delete on public.admin_roles
  for delete to authenticated
  using (
    gym_id = public.current_gym_id()
    and public.has_permission('roles.manage')
    and is_system = false
  );

drop policy if exists admin_role_permissions_select on public.admin_role_permissions;
create policy admin_role_permissions_select on public.admin_role_permissions
  for select to authenticated
  using (gym_id = public.current_gym_id() and public.has_permission('roles.view'));

drop policy if exists admin_role_permissions_insert on public.admin_role_permissions;
create policy admin_role_permissions_insert on public.admin_role_permissions
  for insert to authenticated
  with check (gym_id = public.current_gym_id() and public.has_permission('roles.manage'));

drop policy if exists admin_role_permissions_update on public.admin_role_permissions;
create policy admin_role_permissions_update on public.admin_role_permissions
  for update to authenticated
  using (gym_id = public.current_gym_id() and public.has_permission('roles.manage'))
  with check (gym_id = public.current_gym_id());

drop policy if exists admin_role_permissions_delete on public.admin_role_permissions;
create policy admin_role_permissions_delete on public.admin_role_permissions
  for delete to authenticated
  using (gym_id = public.current_gym_id() and public.has_permission('roles.manage'));

-- Self-read: a staff member can always see their own assignment, so the shell
-- can say what role it is showing without roles.view.
drop policy if exists staff_roles_select_self on public.staff_roles;
create policy staff_roles_select_self on public.staff_roles
  for select to authenticated
  using (profile_id = auth.uid());

-- The shell needs its own permission keys to build route guards. Reading the
-- permissions of the role you already hold is not a privilege escalation.
drop policy if exists admin_role_permissions_select_self on public.admin_role_permissions;
create policy admin_role_permissions_select_self on public.admin_role_permissions
  for select to authenticated
  using (
    role_id in (
      select sr.admin_role_id
      from public.staff_roles sr
      where sr.profile_id = auth.uid()
        and sr.revoked_at is null
        and sr.deleted_at is null
    )
  );

-- staff_roles writes stay with the staff module (Slice 4); the client cannot
-- mint permissions for itself.
revoke insert, update, delete on public.staff_roles from anon, authenticated;

commit;
