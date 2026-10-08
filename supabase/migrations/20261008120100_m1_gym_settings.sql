-- ============================================================================
-- M1 · Gym settings (Slice 1: accent_color, otp_reauth_days, quiet_from,
-- quiet_to, quiet_enforced, logo_path, member_id_prefix, counter)
--
-- WRITTEN BLIND — see docs/admin/BLIND_ASSUMPTIONS.md. Assumed pre-existing:
--   public.gyms (id uuid pk) with at least: name, created_at
--   public.profiles (id uuid pk, gym_id uuid, is_super_admin boolean)
--
-- Design note (recorded in docs/admin/DECISIONS.md): settings are written
-- through an RPC rather than a new RLS policy, because adding a permissive
-- UPDATE policy to an existing table can only widen access. The RPC checks
-- has_permission('gym.settings.manage') and validates every field it accepts.
--
-- Rerunnable: ADD COLUMN IF NOT EXISTS, DROP CONSTRAINT IF EXISTS, CREATE OR
-- REPLACE FUNCTION.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------------

alter table public.gyms
  add column if not exists accent_color text not null default '#0F766E';
alter table public.gyms
  add column if not exists otp_reauth_days integer not null default 30;
alter table public.gyms
  add column if not exists quiet_from time not null default '21:00';
alter table public.gyms
  add column if not exists quiet_to time not null default '08:00';
alter table public.gyms
  add column if not exists quiet_enforced boolean not null default true;
alter table public.gyms
  add column if not exists logo_path text;
alter table public.gyms
  add column if not exists member_id_prefix text not null default 'M';
alter table public.gyms
  add column if not exists member_code_counter bigint not null default 0;
alter table public.gyms
  add column if not exists currency text not null default 'PKR';
alter table public.gyms
  add column if not exists timezone text not null default 'Asia/Karachi';
alter table public.gyms
  add column if not exists phone_country_code text not null default '+92';

-- ---------------------------------------------------------------------------
-- 2. Constraints
--
-- NOT VALID so a gym with existing odd data cannot break `supabase db reset`;
-- new and updated rows are still checked. Validate later, after a data pass:
--   alter table public.gyms validate constraint gyms_accent_color_hex;
-- (tracked as TODO-M1-SETTINGS-VALIDATE)
-- ---------------------------------------------------------------------------

do $do$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'gyms_accent_color_hex' and conrelid = 'public.gyms'::regclass
  ) then
    alter table public.gyms
      add constraint gyms_accent_color_hex
      check (accent_color ~ '^#[0-9A-Fa-f]{6}$') not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'gyms_otp_reauth_days_non_negative' and conrelid = 'public.gyms'::regclass
  ) then
    alter table public.gyms
      add constraint gyms_otp_reauth_days_non_negative
      check (otp_reauth_days >= 0 and otp_reauth_days <= 3650) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'gyms_member_id_prefix_shape' and conrelid = 'public.gyms'::regclass
  ) then
    alter table public.gyms
      add constraint gyms_member_id_prefix_shape
      check (member_id_prefix ~ '^[A-Z0-9]{1,6}$') not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'gyms_member_code_counter_non_negative' and conrelid = 'public.gyms'::regclass
  ) then
    alter table public.gyms
      add constraint gyms_member_code_counter_non_negative
      check (member_code_counter >= 0) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'gyms_currency_shape' and conrelid = 'public.gyms'::regclass
  ) then
    alter table public.gyms
      add constraint gyms_currency_shape
      check (currency ~ '^[A-Z]{3}$') not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'gyms_phone_country_code_shape' and conrelid = 'public.gyms'::regclass
  ) then
    alter table public.gyms
      add constraint gyms_phone_country_code_shape
      check (phone_country_code ~ '^\+[0-9]{1,4}$') not valid;
  end if;
end;
$do$;

create index if not exists gyms_member_id_prefix_idx on public.gyms (member_id_prefix);

-- ---------------------------------------------------------------------------
-- 3. Read helper for the shell
-- ---------------------------------------------------------------------------

-- One row for the caller's gym, so the console does not need to know how gyms
-- is shaped elsewhere.
create or replace function public.gym_settings()
returns table (
  gym_id uuid,
  name text,
  accent_color text,
  logo_path text,
  currency text,
  timezone text,
  phone_country_code text,
  member_id_prefix text,
  otp_reauth_days integer,
  quiet_from time,
  quiet_to time,
  quiet_enforced boolean
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select g.id, g.name, g.accent_color, g.logo_path, g.currency, g.timezone,
         g.phone_country_code, g.member_id_prefix, g.otp_reauth_days,
         g.quiet_from, g.quiet_to, g.quiet_enforced
  from public.gyms g
  where g.id = public.current_gym_id();
$$;

revoke execute on function public.gym_settings() from public;
grant execute on function public.gym_settings() to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Write path
-- ---------------------------------------------------------------------------

create or replace function public.update_gym_settings(
  p_accent_color text default null,
  p_otp_reauth_days integer default null,
  p_quiet_from time default null,
  p_quiet_to time default null,
  p_quiet_enforced boolean default null,
  p_logo_path text default null,
  p_member_id_prefix text default null,
  p_currency text default null,
  p_timezone text default null,
  p_phone_country_code text default null
)
returns public.gyms
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_gym_id uuid := public.current_gym_id();
  v_row public.gyms;
begin
  if v_gym_id is null then
    raise exception 'update_gym_settings: no gym for the current user'
      using errcode = '42501';
  end if;

  if not public.has_permission('gym.settings.manage') then
    raise exception 'update_gym_settings: missing permission gym.settings.manage'
      using errcode = '42501';
  end if;

  if p_accent_color is not null and p_accent_color !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'update_gym_settings: accent_color must be #RRGGBB'
      using errcode = '22023';
  end if;

  if p_member_id_prefix is not null and p_member_id_prefix !~ '^[A-Z0-9]{1,6}$' then
    raise exception 'update_gym_settings: member_id_prefix must be 1-6 characters A-Z or 0-9'
      using errcode = '22023';
  end if;

  if p_otp_reauth_days is not null and (p_otp_reauth_days < 0 or p_otp_reauth_days > 3650) then
    raise exception 'update_gym_settings: otp_reauth_days must be between 0 and 3650'
      using errcode = '22023';
  end if;

  if p_currency is not null and p_currency !~ '^[A-Z]{3}$' then
    raise exception 'update_gym_settings: currency must be a 3-letter ISO code'
      using errcode = '22023';
  end if;

  if p_phone_country_code is not null and p_phone_country_code !~ '^\+[0-9]{1,4}$' then
    raise exception 'update_gym_settings: phone_country_code must look like +92'
      using errcode = '22023';
  end if;

  if p_timezone is not null and not exists (
    select 1 from pg_timezone_names where name = p_timezone
  ) then
    raise exception 'update_gym_settings: unknown timezone %', p_timezone
      using errcode = '22023';
  end if;

  update public.gyms g
     set accent_color      = coalesce(p_accent_color, g.accent_color),
         otp_reauth_days   = coalesce(p_otp_reauth_days, g.otp_reauth_days),
         quiet_from        = coalesce(p_quiet_from, g.quiet_from),
         quiet_to          = coalesce(p_quiet_to, g.quiet_to),
         quiet_enforced    = coalesce(p_quiet_enforced, g.quiet_enforced),
         logo_path         = coalesce(p_logo_path, g.logo_path),
         member_id_prefix  = coalesce(p_member_id_prefix, g.member_id_prefix),
         currency          = coalesce(p_currency, g.currency),
         timezone          = coalesce(p_timezone, g.timezone),
         phone_country_code = coalesce(p_phone_country_code, g.phone_country_code)
   where g.id = v_gym_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke execute on function public.update_gym_settings(
  text, integer, time, time, boolean, text, text, text, text, text
) from public;
grant execute on function public.update_gym_settings(
  text, integer, time, time, boolean, text, text, text, text, text
) to authenticated;

commit;
