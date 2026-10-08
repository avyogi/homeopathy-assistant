-- Add selectable clinical tags produced by AI analysis
alter table public.consultations
  add column if not exists tags text[] not null default '{}';
