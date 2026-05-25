create index if not exists exercises_user_muscle_group_name_idx
on public.exercises (user_id, muscle_group, name);
