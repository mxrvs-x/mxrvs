create table public.daily_macro_logs (
  user_id uuid not null references auth.users (id) on delete cascade,
  log_date date not null,
  calories numeric(12, 2) not null check (calories between 0 and 9999999999.99),
  protein_g numeric(12, 2) not null check (protein_g between 0 and 9999999999.99),
  carbs_g numeric(12, 2) not null check (carbs_g between 0 and 9999999999.99),
  fat_g numeric(12, 2) not null check (fat_g between 0 and 9999999999.99),
  primary key (user_id, log_date)
);

alter table public.daily_macro_logs enable row level security;

revoke all on public.daily_macro_logs from public, anon, authenticated;
grant select, insert, update on public.daily_macro_logs to authenticated;

create policy "Users can read their daily macro logs"
  on public.daily_macro_logs for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their daily macro logs"
  on public.daily_macro_logs for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their daily macro logs"
  on public.daily_macro_logs for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
