-- RAZA AI BUSINESS MANAGER: secure Meta/Facebook OAuth storage
-- Run this once in Supabase SQL Editor.
-- RLS is enabled with no client policies. Only the server-side service role can access these tables.

create table if not exists public.meta_oauth_states (
  state_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists meta_oauth_states_expires_at_idx
  on public.meta_oauth_states (expires_at);

create table if not exists public.meta_page_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  page_id text not null,
  page_name text not null,
  page_access_token text not null,
  granted_scopes text[] not null default '{}',
  connected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, page_id)
);

alter table public.meta_oauth_states enable row level security;
alter table public.meta_page_connections enable row level security;

-- No anon/authenticated policies are intentionally created.
-- The service-role key is used only by server-side API code and bypasses RLS.
