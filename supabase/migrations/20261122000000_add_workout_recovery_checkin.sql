alter table public.workouts
  add column if not exists recovery_energy integer null,
  add column if not exists recovery_sleep_quality integer null,
  add column if not exists recovery_soreness integer null,
  add column if not exists recovery_motivation integer null,
  add column if not exists recovery_stress integer null;

alter table public.workouts
  drop constraint if exists workouts_recovery_energy_check,
  add constraint workouts_recovery_energy_check
    check (recovery_energy is null or recovery_energy between 1 and 5),
  drop constraint if exists workouts_recovery_sleep_quality_check,
  add constraint workouts_recovery_sleep_quality_check
    check (
      recovery_sleep_quality is null or recovery_sleep_quality between 1 and 5
    ),
  drop constraint if exists workouts_recovery_soreness_check,
  add constraint workouts_recovery_soreness_check
    check (recovery_soreness is null or recovery_soreness between 1 and 5),
  drop constraint if exists workouts_recovery_motivation_check,
  add constraint workouts_recovery_motivation_check
    check (recovery_motivation is null or recovery_motivation between 1 and 5),
  drop constraint if exists workouts_recovery_stress_check,
  add constraint workouts_recovery_stress_check
    check (recovery_stress is null or recovery_stress between 1 and 5);
