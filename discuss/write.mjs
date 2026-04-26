import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { newAuthorSecret, setThreadDeleteSecret, DISCUSS_CATEGORY_SLUGS } from "../js/discuss-auth-storage.mjs";

var supabase = null;
var DISCUSS_MEDIA_BUCKET = "discuss-media";
var MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function el(id) {
  return document.getElementById(id);
}

function getConfig() {
  return (typeof window !== "undefined" && window.SUPABASE_QA) || {};
}

function getClient() {
  var config = getConfig();
  if (!config.url || !config.anonKey) return null;
  if (!supabase) supabase = createClient(config.url, config.anonKey);
  return supabase;
}

function hasClient() {
  var c = getConfig();
  return !!(c.url && c.anonKey);
}

function boot() {
  if (!hasClient() || !getClient()) {
    if (el("disc-write-unavailable-notice")) el("disc-write-unavailable-notice").hidden = false;
    if (el("disc-write-main")) el("disc-write-main").hidden = true;
    return;
  }
  if (el("disc-write-unavailable-notice")) el("disc-write-unavailable-notice").hidden = true;
  if (el("disc-write-main")) el("disc-write-main").hidden = false;
  var qf = el("disc-post-form");
  if (qf) qf.addEventListener("submit", onSubmitPost);
  var imgIn = el("disc-p-image");
  if (imgIn) imgIn.addEventListener("change", onPickImage);
}

function extFromMime(mime) {
  if (mime === "image/png") return "png";
  if (mime === "image/gif") return "gif";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

async function onPickImage(e) {
  var input = e.target;
  var file = input.files && input.files[0];
  if (!file) return;
  input.value = "";
  if (file.size > MAX_IMAGE_BYTES) {
    alert("이미지는 5MB 이하만 업로드할 수 있습니다.");
    return;
  }
  var c = getClient();
  if (!c) return;
  var hint = el("disc-p-image-hint");
  if (hint) {
    hint.hidden = false;
    hint.textContent = "업로드 중…";
  }
  var uid = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
  var ext = extFromMime(file.type || "");
  var path = "u/" + uid + "." + ext;
  var up = await c.storage.from(DISCUSS_MEDIA_BUCKET).upload(path, file, {
    contentType: file.type || "image/jpeg",
    upsert: false,
  });
  if (hint) {
    hint.hidden = true;
    hint.textContent = "";
  }
  if (up.error) {
    alert(
      "이미지 업로드에 실패했습니다. " +
        up.error.message +
        "\nSupabase Storage에 버킷 discuss-media와 업로드 정책이 있는지 확인하세요. (supabase/discuss_storage.sql)"
    );
    return;
  }
  var pub = c.storage.from(DISCUSS_MEDIA_BUCKET).getPublicUrl(path);
  var url = pub.data && pub.data.publicUrl;
  if (!url) {
    alert("공개 URL을 가져오지 못했습니다.");
    return;
  }
  var ta = el("disc-p-body");
  if (ta) {
    ta.value = (ta.value || "") + "\n\n![](" + url + ")\n\n";
    ta.focus();
  }
}

async function onSubmitPost(e) {
  e.preventDefault();
  var c = getClient();
  if (!c) return;
  var category = (el("disc-p-category") && el("disc-p-category").value) || "";
  var title = (el("disc-p-title") && el("disc-p-title").value) || "";
  var body = (el("disc-p-body") && el("disc-p-body").value) || "";
  var nick = (el("disc-p-nick") && el("disc-p-nick").value) || "";
  category = category.trim();
  title = title.trim();
  body = body.trim();
  if (DISCUSS_CATEGORY_SLUGS.indexOf(category) < 0) {
    alert("카테고리를 선택하세요.");
    return;
  }
  if (!title || !body) {
    alert("제목과 내용을 입력하세요.");
    return;
  }
  var authorSecret = newAuthorSecret();
  var btn = el("disc-p-submit");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "등록 중…";
  }
  var res = await c
    .from("discuss_threads")
    .insert([
      {
        category: category,
        title: title,
        body: body,
        author_nickname: nick || null,
        author_secret: authorSecret,
      },
    ])
    .select("id")
    .single();
  if (btn) {
    btn.disabled = false;
    btn.textContent = "글 등록";
  }
  if (res.error) {
    alert("등록에 실패했습니다: " + res.error.message);
    return;
  }
  setThreadDeleteSecret(res.data.id, authorSecret);
  window.location.href = "index.html?id=" + encodeURIComponent(res.data.id);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
