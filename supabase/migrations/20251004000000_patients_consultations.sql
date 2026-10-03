-- Homeopathy Assistant schema
-- Run in Supabase SQL Editor or via supabase db push

create extension if not exists "pgcrypto";

-- Patients belong to a doctor (auth user)
create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references auth.users (id) on delete cascade,
  full_name text not null,
  contact_phone text,
  age integer,
  gender text check (gender in ('male', 'female', 'other', 'unspecified')),
  constitutional_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists patients_doctor_id_idx on public.patients (doctor_id);
create index if not exists patients_full_name_idx on public.patients (doctor_id, full_name);

-- Consultations for a patient
create table if not exists public.consultations (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  symptoms text[] not null default '{}',
  doctor_notes text,
  remedy_analysis text,
  prescribed_remedies jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists consultations_patient_id_idx on public.consultations (patient_id);

-- Keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists patients_set_updated_at on public.patients;
create trigger patients_set_updated_at
  before update on public.patients
  for each row execute function public.set_updated_at();

drop trigger if exists consultations_set_updated_at on public.consultations;
create trigger consultations_set_updated_at
  before update on public.consultations
  for each row execute function public.set_updated_at();

-- Row Level Security
alter table public.patients enable row level security;
alter table public.consultations enable row level security;

-- Patients: doctor owns their rows
drop policy if exists "patients_select_own" on public.patients;
create policy "patients_select_own"
  on public.patients for select
  using (auth.uid() = doctor_id);

drop policy if exists "patients_insert_own" on public.patients;
create policy "patients_insert_own"
  on public.patients for insert
  with check (auth.uid() = doctor_id);

drop policy if exists "patients_update_own" on public.patients;
create policy "patients_update_own"
  on public.patients for update
  using (auth.uid() = doctor_id)
  with check (auth.uid() = doctor_id);

drop policy if exists "patients_delete_own" on public.patients;
create policy "patients_delete_own"
  on public.patients for delete
  using (auth.uid() = doctor_id);

-- Consultations: access only through patients owned by the doctor
drop policy if exists "consultations_select_own" on public.consultations;
create policy "consultations_select_own"
  on public.consultations for select
  using (
    exists (
      select 1 from public.patients p
      where p.id = consultations.patient_id
        and p.doctor_id = auth.uid()
    )
  );

drop policy if exists "consultations_insert_own" on public.consultations;
create policy "consultations_insert_own"
  on public.consultations for insert
  with check (
    exists (
      select 1 from public.patients p
      where p.id = consultations.patient_id
        and p.doctor_id = auth.uid()
    )
  );

drop policy if exists "consultations_update_own" on public.consultations;
create policy "consultations_update_own"
  on public.consultations for update
  using (
    exists (
      select 1 from public.patients p
      where p.id = consultations.patient_id
        and p.doctor_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.patients p
      where p.id = consultations.patient_id
        and p.doctor_id = auth.uid()
    )
  );

drop policy if exists "consultations_delete_own" on public.consultations;
create policy "consultations_delete_own"
  on public.consultations for delete
  using (
    exists (
      select 1 from public.patients p
      where p.id = consultations.patient_id
        and p.doctor_id = auth.uid()
    )
  );
