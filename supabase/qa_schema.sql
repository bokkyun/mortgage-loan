-- Mortgage Loan Lab — Q&A 게시판 (Supabase SQL Editor에서 한 번 실행)
-- 테이블명: qa_questions, qa_answers

create extension if not exists "pgcrypto";

create table if not exists public.qa_questions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  author_nickname text,
  created_at timestamptz not null default now()
);

create table if not exists public.qa_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.qa_questions (id) on delete cascade,
  body text not null,
  author_nickname text,
  created_at timestamptz not null default now()
);

create index if not exists idx_qa_answers_question on public.qa_answers (question_id);
create index if not exists idx_qa_questions_created on public.qa_questions (created_at desc);

alter table public.qa_questions enable row level security;
alter table public.qa_answers enable row level security;

-- 개발·내부용: 익명 읽기·쓰기 허용 (스팸 방지·수정·삭제는 정책을 강화하세요)
create policy "qa_questions_select" on public.qa_questions for select using (true);
create policy "qa_questions_insert" on public.qa_questions for insert with check (true);

create policy "qa_answers_select" on public.qa_answers for select using (true);
create policy "qa_answers_insert" on public.qa_answers for insert with check (true);
