/**
 * 문의 폼: Web3Forms로 운영자 이메일에 전달 (Reply-To = 이용자 이메일)
 * https://web3forms.com — 대시보드에서 수신 메일·도메인(mortgage-loan.uk) 허용 목록 설정
 *
 * 키가 비어 있으면 제출 시 OS 기본 메일 앱(mailto:)으로 대체합니다.
 */
const WEB3FORMS_ACCESS_KEY = "";

(function () {
  const FORM_ID = "site-contact-form";
  const STATUS_ID = "contact-form-status";

  function showStatus(el, type, message) {
    if (!el) return;
    el.hidden = false;
    el.textContent = message;
    el.dataset.state = type;
    el.style.marginTop = "0.75rem";
    el.style.padding = "0.65rem 0.85rem";
    el.style.borderRadius = "8px";
    el.style.fontSize = "0.9rem";
    if (type === "error") {
      el.style.background = "#ffebee";
      el.style.border = "1px solid #ffcdd2";
      el.style.color = "#b71c1c";
    } else if (type === "success") {
      el.style.background = "#e8f5e9";
      el.style.border = "1px solid #a5d6a7";
      el.style.color = "#1b5e20";
    } else {
      el.style.background = "var(--surface2)";
      el.style.border = "1px solid var(--border)";
      el.style.color = "var(--text)";
    }
  }

  function buildMailto(form) {
    const fd = new FormData(form);
    const name = (fd.get("name") || "").toString().trim();
    const email = (fd.get("email") || "").toString().trim();
    const category = (fd.get("category") || "").toString().trim();
    const pageUrl = (fd.get("page_url") || "").toString().trim();
    const message = (fd.get("message") || "").toString().trim();

    const subject = `[Mortgage Lab 문의] ${category || "일반"}`;
    const body = [
      name ? `이름/닉네임: ${name}` : null,
      email ? `회신 받을 이메일: ${email}` : null,
      pageUrl ? `관련 페이지 URL: ${pageUrl}` : null,
      "",
      "— 문의 내용 —",
      message || "(내용 없음)",
    ]
      .filter(Boolean)
      .join("\n");

    return `mailto:mortgageloanlab@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById(FORM_ID);
    const statusEl = document.getElementById(STATUS_ID);
    if (!form) return;

    const hint = document.getElementById("contact-form-mode-hint");
    if (hint) {
      hint.textContent = WEB3FORMS_ACCESS_KEY
        ? "제출 내용은 암호화된 연결로 전송되어 운영자 메일함으로 도착합니다. 회신은 아래에 적어 주신 이메일로 드립니다."
        : "Web3Forms access_key가 아직 설정되지 않았습니다. 제출 시 기본 메일 앱이 열리며, 메일을 보내셔야 접수가 완료됩니다. (운영자: js/contact-form.js 상단에 키를 입력하세요.)";
    }

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      const fd = new FormData(form);
      const email = (fd.get("email") || "").toString().trim();
      const message = (fd.get("message") || "").toString().trim();

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showStatus(statusEl, "error", "유효한 이메일 주소를 입력해 주세요. 회신을 드리기 위해 필요합니다.");
        return;
      }
      if (!message.trim()) {
        showStatus(statusEl, "error", "문의 내용을 입력해 주세요.");
        return;
      }

      if (!WEB3FORMS_ACCESS_KEY) {
        window.location.href = buildMailto(form);
        return;
      }

      const submitBtn = form.querySelector('button[type="submit"]');
      const prevText = submitBtn ? submitBtn.textContent : "";
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "전송 중…";
      }
      showStatus(statusEl, "info", "전송 중입니다. 잠시만 기다려 주세요.");

      fd.append("access_key", WEB3FORMS_ACCESS_KEY);
      fd.append("subject", `[Mortgage Lab] ${(fd.get("category") || "문의").toString()}`);
      fd.append("from_name", (fd.get("name") || "방문자").toString() || "방문자");

      try {
        const res = await fetch("https://api.web3forms.com/submit", {
          method: "POST",
          body: fd,
        });
        const data = await res.json().catch(function () {
          return {};
        });
        if (data.success) {
          showStatus(
            statusEl,
            "success",
            "접수되었습니다. 평일 기준 1~3영업일 안에 회신 드리겠습니다. 메일함 스팸함도 확인해 주세요."
          );
          form.reset();
        } else {
          showStatus(
            statusEl,
            "error",
            (data.message && String(data.message)) || "전송에 실패했습니다. 잠시 후 다시 시도하거나 이메일로 직접 보내 주세요."
          );
        }
      } catch (err) {
        showStatus(statusEl, "error", "네트워크 오류로 전송하지 못했습니다. 메일 앱으로 보내시겠습니까?");
        if (confirm("메일 앱으로 문의 내용을 열까요?")) {
          window.location.href = buildMailto(form);
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = prevText;
        }
      }
    });
  });
})();
