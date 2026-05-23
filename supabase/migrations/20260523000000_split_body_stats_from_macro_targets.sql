create table if not exists public.body_stats (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  height_cm numeric null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint body_stats_pkey primary key (id),
  constraint body_stats_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade
);

create table if not exists public.body_weight_logs (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  date date not null default current_date,
  logged_at timestamp with time zone not null default now(),
  weight_kg numeric not null,
  body_fat_percent numeric null,
  created_at timestamp with time zone null default now(),
  constraint body_weight_logs_pkey primary key (id),
  constraint body_weight_logs_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade,
  constraint body_weight_logs_body_fat_percent_check check (
    body_fat_percent is null
    or (
      body_fat_percent >= 0
      and body_fat_percent <= 100
    )
  )
);

alter table public.body_stats
  add column if not exists height_cm numeric null,
  add column if not exists updated_at timestamp with time zone null default now();

alter table public.body_weight_logs
  add column if not exists logged_at timestamp with time zone not null default now();

create index if not exists body_stats_user_created_idx
  on public.body_stats (user_id, created_at desc);

create index if not exists body_weight_logs_user_date_idx
  on public.body_weight_logs (user_id, date desc, logged_at desc, created_at desc);

create index if not exists body_weight_logs_user_logged_at_idx
  on public.body_weight_logs (user_id, logged_at desc);

alter table public.body_stats enable row level security;
alter table public.body_weight_logs enable row level security;

drop policy if exists "Users can read own body stats" on public.body_stats;
drop policy if exists "Users can insert own body stats" on public.body_stats;
drop policy if exists "Users can update own body stats" on public.body_stats;
drop policy if exists "Users can delete own body stats" on public.body_stats;

create policy "Users can read own body stats"
  on public.body_stats
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own body stats"
  on public.body_stats
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own body stats"
  on public.body_stats
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own body stats"
  on public.body_stats
  for delete
  using (auth.uid() = user_id);

drop policy if exists "Users can read own body weight logs" on public.body_weight_logs;
drop policy if exists "Users can insert own body weight logs" on public.body_weight_logs;
drop policy if exists "Users can update own body weight logs" on public.body_weight_logs;
drop policy if exists "Users can delete own body weight logs" on public.body_weight_logs;

create policy "Users can read own body weight logs"
  on public.body_weight_logs
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own body weight logs"
  on public.body_weight_logs
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own body weight logs"
  on public.body_weight_logs
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own body weight logs"
  on public.body_weight_logs
  for delete
  using (auth.uid() = user_id);

do $$
declare
  has_date_column boolean;
  has_body_fat_column boolean;
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'macro_targets'
      and column_name = 'height_cm'
  ) then
    insert into public.body_stats (
      user_id,
      height_cm,
      created_at,
      updated_at
    )
    select distinct on (user_id)
      user_id,
      height_cm,
      created_at,
      created_at
    from public.macro_targets
    where height_cm is not null
    order by user_id, created_at desc;
  end if;
end $$;

do $$
declare
  has_date_column boolean;
  has_body_fat_column boolean;
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'macro_targets'
      and column_name = 'weight_kg'
  ) then
    insert into public.body_weight_logs (
      user_id,
      date,
      logged_at,
      weight_kg,
      created_at
    )
    select
      user_id,
      date,
      coalesce(created_at, now()),
      weight_kg,
      created_at
    from public.macro_targets
    where weight_kg is not null;
  end if;
end $$;

do $$
declare
  has_date_column boolean;
  has_body_fat_column boolean;
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'body_stats'
      and column_name = 'weight_kg'
  ) then
    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'body_stats'
        and column_name = 'date'
    ) into has_date_column;

    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'body_stats'
        and column_name = 'body_fat_percent'
    ) into has_body_fat_column;

    execute format(
      'insert into public.body_weight_logs (
        user_id,
        date,
        logged_at,
        weight_kg,
        body_fat_percent,
        created_at
      )
      select
        user_id,
        %s,
        coalesce(created_at, now()),
        weight_kg,
        %s,
        created_at
      from public.body_stats
      where weight_kg is not null',
      case when has_date_column then 'coalesce(date, current_date)' else 'current_date' end,
      case when has_body_fat_column then 'body_fat_percent' else 'null' end
    );
  end if;
end $$;

alter table public.body_stats
  drop column if exists weight_kg,
  drop column if exists body_fat_percent,
  drop column if exists date;

alter table public.macro_targets
  drop column if exists weight_kg,
  drop column if exists height_cm;
