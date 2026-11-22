create table if not exists public.exercises (
  id uuid not null default gen_random_uuid(),
  user_id uuid null,
  name text not null,
  muscle_group text null,
  movement_type text null,
  is_compound boolean null default false,
  created_at timestamp with time zone null default now(),
  constraint exercises_pkey primary key (id),
  constraint exercises_user_id_fkey
    foreign key (user_id) references auth.users (id) on delete cascade
);

create table if not exists public.workouts (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  workout_date date not null default current_date,
  workout_type text null,
  notes text null,
  duration_minutes numeric null,
  created_at timestamp with time zone null default now(),
  constraint workouts_pkey primary key (id),
  constraint workouts_user_id_fkey
    foreign key (user_id) references auth.users (id) on delete cascade,
  constraint workouts_workout_type_check check (
    workout_type = any (
      array[
        'push'::text,
        'pull'::text,
        'legs'::text,
        'upper'::text,
        'lower'::text,
        'rest'::text
      ]
    )
  )
);

create table if not exists public.workout_sets (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  workout_id uuid not null,
  exercise_id uuid not null,
  set_number integer not null,
  reps integer null,
  weight_kg numeric null,
  rest_seconds integer null,
  created_at timestamp with time zone null default now(),
  constraint workout_sets_pkey primary key (id),
  constraint workout_sets_user_id_fkey
    foreign key (user_id) references auth.users (id) on delete cascade,
  constraint workout_sets_workout_id_fkey
    foreign key (workout_id) references public.workouts (id) on delete cascade,
  constraint workout_sets_exercise_id_fkey
    foreign key (exercise_id) references public.exercises (id) on delete restrict
);

create table if not exists public.cardio_sessions (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  session_date date not null default current_date,
  cardio_type text not null,
  distance_km numeric not null,
  duration_seconds integer not null,
  steps integer null,
  calories_burned numeric null,
  avg_heart_rate integer null,
  notes text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  route jsonb null,
  distance_from_start_km numeric null default 0,
  cardio_source text not null default 'outdoor'::text,
  is_mock boolean not null default false,
  constraint cardio_sessions_pkey primary key (id),
  constraint cardio_sessions_user_id_fkey
    foreign key (user_id) references auth.users (id) on delete cascade,
  constraint cardio_sessions_cardio_type_check check (
    cardio_type = any (array['walking'::text, 'running'::text])
  ),
  constraint cardio_sessions_cardio_source_check check (
    cardio_source = any (
      array['outdoor'::text, 'treadmill'::text, 'manual'::text]
    )
  )
);

create index if not exists cardio_sessions_user_date_idx
  on public.cardio_sessions (user_id, session_date desc);

create index if not exists cardio_sessions_user_type_idx
  on public.cardio_sessions (user_id, cardio_type);

alter table public.exercises enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_sets enable row level security;
alter table public.cardio_sessions enable row level security;

drop policy if exists "own exercises" on public.exercises;
create policy "own exercises"
  on public.exercises
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "own workouts" on public.workouts;
create policy "own workouts"
  on public.workouts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "own workout sets" on public.workout_sets;
create policy "own workout sets"
  on public.workout_sets
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "own cardio sessions" on public.cardio_sessions;
create policy "own cardio sessions"
  on public.cardio_sessions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
