-- Run this once in the Supabase SQL Editor for the WoW Gear Optimizer.
-- The service-role key must only be configured as a server-side Vercel environment variable.
create table if not exists public.wow_items (
  id bigint primary key,
  record jsonb not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists wow_items_expires_at_idx on public.wow_items (expires_at);

alter table public.wow_items enable row level security;

-- Do not add anon/authenticated policies. Access is server-side only through the
-- Supabase service-role key; never expose that key to browser code.
