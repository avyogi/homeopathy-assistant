alter table public.patients
  add column if not exists status text not null default 'ACTIVE';

alter table public.patients
  drop constraint if exists patients_status_check;

alter table public.patients
  add constraint patients_status_check
  check (status in ('ACTIVE', 'ARCHIVED'));
