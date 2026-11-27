grant delete on public.daily_macro_logs to authenticated;

create policy "Users can delete their daily macro logs"
  on public.daily_macro_logs for delete to authenticated
  using ((select auth.uid()) = user_id);
