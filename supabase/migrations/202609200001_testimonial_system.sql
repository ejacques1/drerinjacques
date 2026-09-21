-- Testimonial system foundation
-- Apply this migration to the Supabase project after it is connected.

create extension if not exists pgcrypto;

do $$ begin
  create type public.testimonial_format as enum ('written', 'video', 'image');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.testimonial_status as enum ('pending', 'approved', 'hidden', 'archived');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.destination_type as enum ('homepage', 'testimonial_wall', 'training_page', 'sales_page');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.trainings (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.testimonials (
  id uuid primary key default gen_random_uuid(),
  format public.testimonial_format not null default 'written',
  status public.testimonial_status not null default 'pending',
  customer_name text not null,
  customer_email text not null,
  customer_role text,
  customer_company text,
  story text not null,
  recommendation text,
  rating smallint check (rating between 1 and 5),
  photo_path text,
  video_path text,
  transcript text,
  source text not null default 'website_form',
  source_reference text,
  language text not null default 'en',
  featured boolean not null default false,
  consent_granted boolean not null default false,
  consent_version text,
  consented_at timestamptz,
  submitted_at timestamptz not null default now(),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.testimonial_trainings (
  testimonial_id uuid not null references public.testimonials(id) on delete cascade,
  training_id uuid not null references public.trainings(id) on delete cascade,
  primary key (testimonial_id, training_id)
);

create table if not exists public.testimonial_destinations (
  id uuid primary key default gen_random_uuid(),
  testimonial_id uuid not null references public.testimonials(id) on delete cascade,
  destination public.destination_type not null,
  training_id uuid references public.trainings(id) on delete cascade,
  page_slug text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint training_destination_requires_training check (
    destination <> 'training_page' or training_id is not null
  ),
  constraint sales_destination_requires_slug check (
    destination <> 'sales_page' or page_slug is not null
  )
);

create unique index if not exists testimonial_destination_unique
  on public.testimonial_destinations (
    testimonial_id,
    destination,
    coalesce(training_id::text, ''),
    coalesce(page_slug, '')
  );

create index if not exists testimonials_status_submitted_idx
  on public.testimonials (status, submitted_at desc);

create index if not exists testimonial_destinations_lookup_idx
  on public.testimonial_destinations (destination, training_id, page_slug, sort_order);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trainings_set_updated_at on public.trainings;
create trigger trainings_set_updated_at
before update on public.trainings
for each row execute function public.set_updated_at();

drop trigger if exists testimonials_set_updated_at on public.testimonials;
create trigger testimonials_set_updated_at
before update on public.testimonials
for each row execute function public.set_updated_at();

alter table public.trainings enable row level security;
alter table public.testimonials enable row level security;
alter table public.testimonial_trainings enable row level security;
alter table public.testimonial_destinations enable row level security;

-- Training names and slugs are safe to expose for public page filters.
drop policy if exists "Public can read active trainings" on public.trainings;
create policy "Public can read active trainings"
on public.trainings for select
to anon, authenticated
using (active = true);

-- Public submissions go through a validated server endpoint using the service
-- role. Public displays also use a server endpoint that returns an explicit
-- safe field list. No browser can query contact or consent data directly.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('testimonial-photos', 'testimonial-photos', true, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('testimonial-videos', 'testimonial-videos', false, 524288000, array['video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do nothing;
