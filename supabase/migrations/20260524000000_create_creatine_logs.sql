create table if not exists public.creatine_logs (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  date date not null default current_date,
  logged_at timestamp with time zone not null default now(),
  grams numeric not null default 5,
  notes text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint creatine_logs_pkey primary key (id),
  constraint creatine_logs_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade,
  constraint creatine_logs_user_date_key unique (user_id, date),
  constraint creatine_logs_grams_check check (grams > 0 and grams <= 50)
);

create index if not exists creatine_logs_user_date_idx
  on public.creatine_logs (user_id, date desc, logged_at desc);

create index if not exists creatine_logs_user_logged_at_idx
  on public.creatine_logs (user_id, logged_at desc);

alter table public.creatine_logs enable row level security;

drop policy if exists "Users can read own creatine logs" on public.creatine_logs;
drop policy if exists "Users can insert own creatine logs" on public.creatine_logs;
drop policy if exists "Users can update own creatine logs" on public.creatine_logs;
drop policy if exists "Users can delete own creatine logs" on public.creatine_logs;

create policy "Users can read own creatine logs"
  on public.creatine_logs
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own creatine logs"
  on public.creatine_logs
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own creatine logs"
  on public.creatine_logs
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own creatine logs"
  on public.creatine_logs
  for delete
  using (auth.uid() = user_id);
