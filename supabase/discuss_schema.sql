-- Mortgage Loan Lab — 은행상품 토론방 (Supabase SQL Editor에서 1회 실행)
-- 테이블: discuss_threads, discuss_replies

create extension if not exists "pgcrypto";

create table if not exists public.discuss_threads (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('irp', 'deposit', 'card', 'pay', 'telecom')),
  title text not null,
  body text not null,
  author_nickname text,
  author_secret uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.discuss_replies (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.discuss_threads (id) on delete cascade,
  body text not null,
  author_nickname text,
  author_secret uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_discuss_replies_thread on public.discuss_replies (thread_id);
create index if not exists idx_discuss_threads_created on public.discuss_threads (created_at desc);
create index if not exists idx_discuss_threads_category on public.discuss_threads (category);

alter table public.discuss_threads enable row level security;
alter table public.discuss_replies enable row level security;

create policy "discuss_threads_select" on public.discuss_threads for select using (true);
create policy "discuss_threads_insert" on public.discuss_threads for insert with check (true);

create policy "discuss_replies_select" on public.discuss_replies for select using (true);
create policy "discuss_replies_insert" on public.discuss_replies for insert with check (true);

create or replace function public.discuss_delete_thread(p_thread_id uuid, p_secret uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.discuss_threads
  where id = p_thread_id and author_secret = p_secret;
  return found;
end;
$$;

create or replace function public.discuss_delete_reply(p_reply_id uuid, p_secret uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.discuss_replies
  where id = p_reply_id and author_secret = p_secret;
  return found;
end;
$$;

grant execute on function public.discuss_delete_thread(uuid, uuid) to anon, authenticated, service_role;
grant execute on function public.discuss_delete_reply(uuid, uuid) to anon, authenticated, service_role;
