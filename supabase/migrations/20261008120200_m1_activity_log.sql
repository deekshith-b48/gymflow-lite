-- ============================================================================
-- M1 · Base activity log (spec D6)
--
-- Written by triggers, never by clients. Redacts secrets and national IDs.
-- Records changes that arrive through sync_push for free, because the trigger
-- sits on the table rather than on any one code path.
--
-- WRITTEN BLIND — see docs/admin/BLIND_ASSUMPTIONS.md. The trigger is attached
-- only to tables that exist at apply time (to_regclass guard), so a missing or
-- renamed table cannot break the migration chain.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------

create table if not exists public.activity_log (
  id bigserial primary key,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  module text not null,
  event text not null,
  actor_id uuid,
  actor_label text,
  entity_table text,
  entity_id text,
  description text,
  diff jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_log_gym_created_idx
  on public.activity_log (gym_id, created_at desc);
create index if not exists activity_log_gym_module_created_idx
  on public.activity_log (gym_id, module, created_at desc);
create index if not exists activity_log_gym_actor_created_idx
  on public.activity_log (gym_id, actor_id, created_at desc);
create index if not exists activity_log_entity_idx
  on public.activity_log (entity_table, entity_id);

-- ---------------------------------------------------------------------------
-- 2. Redaction
-- ---------------------------------------------------------------------------

-- Column names that must never reach the log. Anything matching these
-- patterns is dropped from the stored diff (D6: never log secrets, tokens or
-- national IDs).
create or replace function public.activity_log_safe_jsonb(p_row jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(
    jsonb_object_agg(key, value),
    '{}'::jsonb
  )
  from jsonb_each(p_row)
  where key !~* '(password|secret|token|api[_-]?key|private|national[_-]?id|nin|cnic|encrypted|credential|signature|service[_-]?role)';
$$;

revoke execute on function public.activity_log_safe_jsonb(jsonb) from public;

-- Human module names for the Activity Log filters (Slice 5).
create or replace function public.activity_log_module(p_table text)
returns text
language sql
immutable
as $$
  select case p_table
    when 'members' then 'Members'
    when 'staff_roles' then 'Users & Staff'
    when 'gyms' then 'Settings'
    when 'profiles' then 'Settings'
    when 'plans' then 'Packages & Add-ons'
    when 'admin_roles' then 'Roles & Permissions'
    when 'admin_role_permissions' then 'Roles & Permissions'
    when 'fee_records' then 'Fees'
    when 'checkins' then 'Attendance'
    else initcap(replace(p_table, '_', ' '))
  end;
$$;

revoke execute on function public.activity_log_module(text) from public;

-- ---------------------------------------------------------------------------
-- 3. Audit trigger
-- ---------------------------------------------------------------------------

create or replace function public.activity_log_track()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_claims jsonb;
  v_new jsonb;
  v_old jsonb;
  v_diff jsonb;
  v_gym_id uuid;
  v_entity_id text;
  v_actor_id uuid;
  v_actor_label text;
  v_event text;
begin
  v_claims := coalesce(
    nullif(current_setting('request.jwt.claims', true), ''),
    '{}'
  )::jsonb;
  v_actor_id := nullif(v_claims ->> 'sub', '')::uuid;
  v_actor_label := coalesce(
    nullif(v_claims ->> 'email', ''),
    v_actor_id::text,
    'system'
  );

  if tg_op = 'INSERT' then
    v_new := public.activity_log_safe_jsonb(to_jsonb(new));
    v_diff := v_new;
    v_event := 'created';
  elsif tg_op = 'UPDATE' then
    v_new := public.activity_log_safe_jsonb(to_jsonb(new));
    v_old := public.activity_log_safe_jsonb(to_jsonb(old));
    select coalesce(
             jsonb_object_agg(
               changed.key,
               jsonb_build_object('from', v_old -> changed.key, 'to', changed.value)
             ),
             '{}'::jsonb
           )
      into v_diff
      from jsonb_each(v_new) as changed(key, value)
     where v_old -> changed.key is distinct from changed.value;

    -- Touch-only updates are not activity.
    if v_diff = '{}'::jsonb then
      return new;
    end if;
    v_event := 'updated';
  else
    v_old := public.activity_log_safe_jsonb(to_jsonb(old));
    v_diff := v_old;
    v_event := 'deleted';
  end if;

  -- Attribute to the row's own gym where it has one; otherwise the caller's.
  if v_new ? 'gym_id' then
    v_gym_id := nullif(v_new ->> 'gym_id', '')::uuid;
  end if;
  if v_gym_id is null and v_old ? 'gym_id' then
    v_gym_id := nullif(v_old ->> 'gym_id', '')::uuid;
  end if;
  if v_gym_id is null then
    v_gym_id := public.current_gym_id();
  end if;

  -- Nothing sensible to attach it to (for example a migration run).
  if v_gym_id is null then
    return coalesce(new, old);
  end if;

  v_entity_id := coalesce(v_new ->> 'id', v_old ->> 'id');

  insert into public.activity_log (
    gym_id, module, event, actor_id, actor_label,
    entity_table, entity_id, description, diff
  )
  values (
    v_gym_id,
    public.activity_log_module(tg_table_name),
    v_event,
    v_actor_id,
    v_actor_label,
    tg_table_name,
    v_entity_id,
    initcap(replace(tg_table_name, '_', ' ')) || ' ' || v_event,
    v_diff
  );

  return coalesce(new, old);
end;
$$;

revoke execute on function public.activity_log_track() from public;

-- Attach to the tables that exist. Deliberately conservative: tables whose
-- names are assumed are skipped silently rather than breaking the chain.
do $do$
declare
  v_table text;
  v_tables text[] := array[
    'members',
    'staff_roles',
    'plans',
    'gyms',
    'profiles',
    'admin_roles',
    'admin_role_permissions'
  ];
begin
  foreach v_table in array v_tables loop
    if to_regclass(format('public.%I', v_table)) is not null then
      if not exists (
        select 1 from pg_trigger
        where tgname = format('activity_log_%s', v_table)
      ) then
        execute format(
          'create trigger %I after insert or update or delete on public.%I
             for each row execute function public.activity_log_track()',
          format('activity_log_%s', v_table),
          v_table
        );
      end if;
    end if;
  end loop;
end;
$do$;

-- ---------------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------------

alter table public.activity_log enable row level security;

drop policy if exists activity_log_select on public.activity_log;
create policy activity_log_select on public.activity_log
  for select to authenticated
  using (
    gym_id = public.current_gym_id()
    and public.has_permission('activity.view')
  );

-- Explicit denials, so the intent is readable in the policies themselves and
-- not only in the grants below. Rows are written by SECURITY DEFINER triggers.
drop policy if exists activity_log_no_client_insert on public.activity_log;
create policy activity_log_no_client_insert on public.activity_log
  for insert to authenticated with check (false);

drop policy if exists activity_log_no_client_update on public.activity_log;
create policy activity_log_no_client_update on public.activity_log
  for update to authenticated using (false);

drop policy if exists activity_log_no_client_delete on public.activity_log;
create policy activity_log_no_client_delete on public.activity_log
  for delete to authenticated using (false);

revoke insert, update, delete on public.activity_log from anon, authenticated;
revoke all on sequence public.activity_log_id_seq from anon, authenticated;

commit;
