create table public.sleep_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  time_zone text not null,
  bedtime_at timestamptz,
  sleep_onset_at timestamptz,
  onset_approximate boolean not null default false,
  final_wake_at timestamptz,
  recorded_total_minutes integer check (recorded_total_minutes between 0 and 1440),
  awakening_tracking text not null check (awakening_tracking in ('complete', 'partial', 'unknown')),
  notes text,
  unique (user_id, log_date),
  check (final_wake_at > sleep_onset_at),
  check (bedtime_at <= sleep_onset_at),
  check (bedtime_at < final_wake_at),
  check (recorded_total_minutes is not null or (sleep_onset_at is not null and final_wake_at is not null))
);

create table public.sleep_awakenings (
  id uuid primary key default gen_random_uuid(),
  sleep_log_id uuid not null references public.sleep_logs(id) on delete cascade,
  position integer not null check (position >= 0),
  woke_at timestamptz,
  woke_approximate boolean not null default false,
  resumed_at timestamptz,
  resumed_approximate boolean not null default false,
  resume_type text not null check (resume_type in ('timed', 'immediate', 'unknown')),
  deduct_from_sleep boolean not null,
  unique (sleep_log_id, position),
  check ((resume_type = 'timed') = (resumed_at is not null)),
  check (resumed_at > woke_at),
  check (resume_type <> 'immediate' or not deduct_from_sleep)
);

create table public.sleep_naps (
  id uuid primary key default gen_random_uuid(),
  sleep_log_id uuid not null references public.sleep_logs(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  check (ended_at > started_at)
);

create index sleep_naps_log_idx on public.sleep_naps (sleep_log_id);

alter table public.sleep_logs enable row level security;
alter table public.sleep_awakenings enable row level security;
alter table public.sleep_naps enable row level security;

revoke all on public.sleep_logs, public.sleep_awakenings, public.sleep_naps from public, anon, authenticated;
grant select, delete on public.sleep_logs to authenticated;
grant select on public.sleep_awakenings, public.sleep_naps to authenticated;

create policy "Read own sleep logs" on public.sleep_logs for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Delete own sleep logs" on public.sleep_logs for delete to authenticated
  using ((select auth.uid()) = user_id);
create policy "Read own sleep awakenings" on public.sleep_awakenings for select to authenticated
  using (exists (select 1 from public.sleep_logs where id = sleep_log_id and user_id = (select auth.uid())));
create policy "Read own sleep naps" on public.sleep_naps for select to authenticated
  using (exists (select 1 from public.sleep_logs where id = sleep_log_id and user_id = (select auth.uid())));

-- Save the parent and replace its intervals in a single transaction.
-- Only this function can write them from an authenticated app session.
create function public.save_sleep_log(entry jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  log_id uuid := (entry->>'id')::uuid;
  saved_id uuid;
  day_key date := (entry->>'log_date')::date;
  zone_name text := entry->>'time_zone';
  bedtime timestamptz := (entry->>'bedtime_at')::timestamptz;
  onset timestamptz := (entry->>'sleep_onset_at')::timestamptz;
  wake timestamptz := (entry->>'final_wake_at')::timestamptz;
  approximate boolean := coalesce((entry->>'onset_approximate')::boolean, false);
  recorded integer := (entry->>'recorded_total_minutes')::integer;
  tracking text := entry->>'awakening_tracking';
  log_notes text := entry->>'notes';
begin
  if owner_id is null then
    raise exception 'Sign in to save a sleep log.' using errcode = '42501';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = zone_name) then
    raise exception 'Invalid sleep time zone.' using errcode = '22023';
  end if;

  if log_id is null then
    insert into public.sleep_logs (user_id, log_date, time_zone, bedtime_at, sleep_onset_at,
      onset_approximate, final_wake_at, recorded_total_minutes, awakening_tracking, notes)
    values (owner_id, day_key, zone_name, bedtime, onset, approximate, wake, recorded, tracking, log_notes)
    returning id into saved_id;
  else
    update public.sleep_logs
    set log_date = day_key, time_zone = zone_name, bedtime_at = bedtime, sleep_onset_at = onset,
      onset_approximate = approximate, final_wake_at = wake, recorded_total_minutes = recorded,
      awakening_tracking = tracking, notes = log_notes
    where id = log_id and user_id = owner_id
    returning id into saved_id;
    if saved_id is null then
      raise exception 'Sleep log not found.' using errcode = '42501';
    end if;
    delete from public.sleep_awakenings where sleep_log_id = saved_id;
    delete from public.sleep_naps where sleep_log_id = saved_id;
  end if;

  insert into public.sleep_awakenings (sleep_log_id, position, woke_at, woke_approximate,
    resumed_at, resumed_approximate, resume_type, deduct_from_sleep)
  select saved_id, a.position, a.woke_at, a.woke_approximate, a.resumed_at,
    a.resumed_approximate, a.resume_type, a.deduct_from_sleep
  from pg_catalog.jsonb_to_recordset(coalesce(entry->'sleep_awakenings', '[]'::jsonb)) as a(
    position integer, woke_at timestamptz, woke_approximate boolean, resumed_at timestamptz,
    resumed_approximate boolean, resume_type text, deduct_from_sleep boolean);

  insert into public.sleep_naps (sleep_log_id, started_at, ended_at)
  select saved_id, n.started_at, n.ended_at
  from pg_catalog.jsonb_to_recordset(coalesce(entry->'sleep_naps', '[]'::jsonb)) as n(
    started_at timestamptz, ended_at timestamptz);

  if exists (
    select 1 from public.sleep_awakenings a where a.sleep_log_id = saved_id and (
      a.woke_at < onset or a.woke_at >= wake or a.resumed_at <= onset or a.resumed_at >= wake
      or (recorded is null and a.deduct_from_sleep and (a.woke_at is null or a.resumed_at is null))
    )
  ) then
    raise exception 'Check the awakening times and provide a total when time awake is unknown.' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.sleep_awakenings a join public.sleep_awakenings b
      on a.sleep_log_id = b.sleep_log_id and a.position < b.position
    where a.sleep_log_id = saved_id and (
      (a.woke_at < b.resumed_at and b.woke_at < a.resumed_at)
      or (a.woke_at > b.woke_at and a.woke_at < b.resumed_at)
      or (b.woke_at > a.woke_at and b.woke_at < a.resumed_at)
    )
  ) or exists (
    select 1 from public.sleep_naps n where n.sleep_log_id = saved_id and (
      (n.started_at < wake and onset < n.ended_at)
      or exists (select 1 from public.sleep_naps other where other.sleep_log_id = saved_id
        and other.id <> n.id and n.started_at < other.ended_at and other.started_at < n.ended_at)
    )
  ) then
    raise exception 'Sleep intervals cannot overlap.' using errcode = '22023';
  end if;
  return saved_id;
end;
$$;

revoke all on function public.save_sleep_log(jsonb) from public, anon, authenticated;
grant execute on function public.save_sleep_log(jsonb) to authenticated;
