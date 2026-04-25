-- 기존 Q&A DB에 ‘작성자 삭제’용 secret 컬럼 + RPC (Supabase SQL Editor에서 1회 실행)
alter table public.qa_questions add column if not exists author_secret uuid;
alter table public.qa_answers add column if not exists author_secret uuid;

create or replace function public.qa_delete_question(p_question_id uuid, p_secret uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.qa_questions
  where id = p_question_id and author_secret = p_secret;
  return found;
end;
$$;

create or replace function public.qa_delete_answer(p_answer_id uuid, p_secret uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.qa_answers
  where id = p_answer_id and author_secret = p_secret;
  return found;
end;
$$;

grant execute on function public.qa_delete_question(uuid, uuid) to anon, authenticated, service_role;
grant execute on function public.qa_delete_answer(uuid, uuid) to anon, authenticated, service_role;
