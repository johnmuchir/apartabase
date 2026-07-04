-- Drop the NOT NULL constraint on monthly_rent in units table to allow creating vacant units
alter table public.units alter column monthly_rent drop not null;
alter table public.units alter column monthly_rent set default 0;
