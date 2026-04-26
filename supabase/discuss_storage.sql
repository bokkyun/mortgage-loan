-- 토론방 이미지 업로드용 Storage (Supabase SQL Editor에서 1회 실행)
-- 실패 시: 대시보드 → Storage → New bucket → 이름 discuss-media, Public bucket 체크 후
-- 아래 policy만 실행해 보세요.

insert into storage.buckets (id, name, public)
values ('discuss-media', 'discuss-media', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "discuss_media_select" on storage.objects;
drop policy if exists "discuss_media_insert" on storage.objects;

create policy "discuss_media_select"
on storage.objects for select
using (bucket_id = 'discuss-media');

create policy "discuss_media_insert"
on storage.objects for insert
with check (bucket_id = 'discuss-media');
