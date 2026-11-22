alter table public.workouts
  drop constraint if exists workouts_workout_type_check;

alter table public.workouts
  add constraint workouts_workout_type_check check (
    workout_type = any (
      array[
        'push'::text,
        'pull'::text,
        'legs'::text,
        'upper'::text,
        'lower'::text,
        'arms'::text,
        'rest'::text
      ]
    )
  );
