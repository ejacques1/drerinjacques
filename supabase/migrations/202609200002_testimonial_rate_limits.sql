-- Limit public testimonial submissions without storing raw IP addresses.

create table if not exists public.testimonial_rate_limits (
  key_hash text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 1
);

alter table public.testimonial_rate_limits enable row level security;

create or replace function public.check_testimonial_rate_limit(
  p_key_hash text,
  p_limit integer default 5,
  p_window interval default interval '1 hour'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed boolean;
begin
  insert into public.testimonial_rate_limits (key_hash, window_started_at, request_count)
  values (p_key_hash, now(), 1)
  on conflict (key_hash) do update
  set
    window_started_at = case
      when testimonial_rate_limits.window_started_at < now() - p_window then now()
      else testimonial_rate_limits.window_started_at
    end,
    request_count = case
      when testimonial_rate_limits.window_started_at < now() - p_window then 1
      else testimonial_rate_limits.request_count + 1
    end
  returning request_count <= p_limit into allowed;

  return allowed;
end;
$$;

revoke all on function public.check_testimonial_rate_limit(text, integer, interval) from public;
grant execute on function public.check_testimonial_rate_limit(text, integer, interval) to service_role;
