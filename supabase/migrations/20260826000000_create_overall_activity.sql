create table if not exists public.overall_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  activity_date date not null,
  steps integer not null default 0 check (steps >= 0),
  calories_burned numeric not null default 0 check (calories_burned >= 0),
  duration_seconds integer null check (duration_seconds is null or duration_seconds >= 0),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint overall_activity_user_date_key unique (user_id, activity_date)
);

create index if not exists overall_activity_user_date_idx
  on public.overall_activity (user_id, activity_date desc);

alter table public.overall_activity enable row level security;

drop policy if exists "Users can read own overall activity" on public.overall_activity;
drop policy if exists "Users can insert own overall activity" on public.overall_activity;
drop policy if exists "Users can update own overall activity" on public.overall_activity;
drop policy if exists "Users can delete own overall activity" on public.overall_activity;

create policy "Users can read own overall activity"
  on public.overall_activity for select
  using (auth.uid() = user_id);

create policy "Users can insert own overall activity"
  on public.overall_activity for insert
  with check (auth.uid() = user_id);

create policy "Users can update own overall activity"
  on public.overall_activity for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own overall activity"
  on public.overall_activity for delete
  using (auth.uid() = user_id);
