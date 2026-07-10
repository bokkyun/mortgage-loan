/**
 * 서류 추출(localStorage) → 계산기 입력 자동 채움
 * paperwork/paperwork.mjs 와 동일 키 사용
 */
(function (global) {
  const STORAGE_KEY = "mortgage-loan-paperwork-summary";

  function formatMoneyWon(value) {
    const digits = String(value ?? "").replace(/[^\d]/g, "");
    if (!digits) return "";
    return Number(digits).toLocaleString("ko-KR");
  }

  /** 원 → 만원 (DSR) */
  function wonToManFormatted(won) {
    const man = Math.round(Number(won) / 10000);
    if (!Number.isFinite(man) || man <= 0) return "";
    return man.toLocaleString("ko-KR");
  }

  function loadSummary() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      return s && s.status === "success" ? s : null;
    } catch {
      return null;
    }
  }

  function isFromPaperwork() {
    return new URLSearchParams(global.location.search).get("from") === "paperwork";
  }

  function hasSpouse(summary) {
    const members = summary.familyMembers;
    if (!Array.isArray(members)) return false;
    return members.some((m) => {
      const r = String(m.relation || "").trim();
      return /배우자|配偶|사별|남편|아내/.test(r);
    });
  }

  /** 추출 소득 중 계산기에 넣을 대표 연소득(원) */
  function pickPrimaryIncome(summary) {
    const candidates = [
      summary.withholdingFinalIncome,
      summary.withholdingTypeAFinalIncome,
      summary.incomeCertificateAmount,
    ].filter((v) => typeof v === "number" && v > 0);
    if (!candidates.length) return null;
    return Math.max(...candidates);
  }

  function detectedHas(summary, keywords) {
    const docs = summary.detectedDocuments || [];
    return docs.some((d) => {
      const t = String(d.documentType || "");
      return keywords.some((k) => t.includes(k));
    });
  }

  function fieldEmpty(el) {
    if (!el) return true;
    if (el.type === "checkbox") return !el.checked;
    return !String(el.value || "").replace(/,/g, "").trim();
  }

  function setMoneyIfEmpty(el, wonValue) {
    if (!el || wonValue == null || wonValue <= 0) return false;
    if (!fieldEmpty(el)) return false;
    el.value = formatMoneyWon(wonValue);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }

  function setManIfEmpty(el, wonValue) {
    if (!el || wonValue == null || wonValue <= 0) return false;
    if (!fieldEmpty(el)) return false;
    const formatted = wonToManFormatted(wonValue);
    if (!formatted) return false;
    el.value = formatted;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }

  function setCheckboxIfUnchecked(el, checked) {
    if (!el || !checked || el.checked) return false;
    el.checked = true;
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function syncDidimdolRateTabs(incomeWon) {
    const formatted = formatMoneyWon(incomeWon);
    ["did-income", "nb-income", "fh-income"].forEach((id) => {
      const el = document.getElementById(id);
      if (el && fieldEmpty(el)) el.value = formatted;
    });
  }

  function mapYearIncomeFields(summary, incomeWon, applied) {
    const year = String(summary.withholdingTaxYear || "").trim();
    if (year === "2024" && setMoneyIfEmpty(document.getElementById("self-a-2024"), incomeWon)) {
      applied.push("본인 2024년 근로소득");
    }
    if (year === "2023" && setMoneyIfEmpty(document.getElementById("self-a-2023"), incomeWon)) {
      applied.push("본인 2023년 근로소득");
    }
  }

  function applyBeotimmok() {
    const summary = loadSummary();
    if (!summary) return { applied: [] };
    const applied = [];
    const income = pickPrimaryIncome(summary);

    if (income) {
      if (setMoneyIfEmpty(document.getElementById("bt-income"), income)) {
        applied.push("부부합산 연소득");
      }
      mapYearIncomeFields(summary, income, applied);

      if (detectedHas(summary, ["원천징수", "근로소득"])) {
        const radio = document.querySelector('input[name="emp-self"][value="A"]');
        if (radio && fieldEmpty(document.getElementById("self-a-2024")) && fieldEmpty(document.getElementById("self-a-2023"))) {
          radio.checked = true;
          radio.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
      if (detectedHas(summary, ["갑종"])) {
        if (setMoneyIfEmpty(document.getElementById("self-b-sum"), summary.withholdingTypeAFinalIncome || income)) {
          applied.push("신규입사 수령 소득 합계(참고)");
        }
      }
    }

    const spouseCb = document.getElementById("has-spouse");
    if (hasSpouse(summary) && setCheckboxIfUnchecked(spouseCb, true)) {
      applied.push("배우자 있음");
      document.getElementById("spouse-wrap")?.classList.remove("hidden");
    }

    const credit = summary.loans?.creditLoanAmount;
    if (typeof credit === "number" && credit > 0) {
      if (setCheckboxIfUnchecked(document.getElementById("bt-credit-loan"), true)) {
        applied.push("기존 신용대출 있음(금리 가산 참고)");
      }
    }

    return { applied };
  }

  function applyDidimdol() {
    const summary = loadSummary();
    if (!summary) return { applied: [] };
    const applied = [];
    const income = pickPrimaryIncome(summary);

    if (income) {
      syncDidimdolRateTabs(income);
      if (setMoneyIfEmpty(document.getElementById("did-income"), income)) {
        applied.push("부부합산 연소득(일반 디딤돌)");
      } else if (
        ["did-income", "nb-income", "fh-income"].some((id) => {
          const el = document.getElementById(id);
          return el && String(el.value || "").replace(/,/g, "").trim();
        })
      ) {
        applied.push("금리 탭 소득란");
      }
      mapYearIncomeFields(summary, income, applied);
    }

    const spouseCb = document.getElementById("has-spouse");
    if (hasSpouse(summary) && setCheckboxIfUnchecked(spouseCb, true)) {
      applied.push("배우자 있음");
      document.getElementById("spouse-wrap")?.classList.remove("hidden");
    }

    return { applied };
  }

  function applyDsr() {
    const summary = loadSummary();
    if (!summary) return { applied: [] };
    const applied = [];
    const income = pickPrimaryIncome(summary);

    if (income && setManIfEmpty(document.getElementById("income"), income)) {
      applied.push("연간 소득(만원)");
    }

    const credit = summary.loans?.creditLoanAmount;
    if (typeof credit === "number" && credit > 0) {
      const list = document.getElementById("credit_list");
      const firstMoney = list?.querySelector(".input-money");
      if (firstMoney && setManIfEmpty(firstMoney, credit)) {
        applied.push("기존 신용대출 잔액(만원)");
      }
    }

    const collateral = summary.loans?.collateralLoanAmount;
    if (typeof collateral === "number" && collateral > 0) {
      const list = document.getElementById("nh_list");
      const firstMoney = list?.querySelector(".js-oth-amt, .input-money");
      if (firstMoney && setManIfEmpty(firstMoney, collateral)) {
        applied.push("담보대출 잔액(만원, 비주택담보 참고)");
      }
    }

    return { applied };
  }

  function showBanner(calculatorLabel, applied) {
    if (!applied.length) return;

    const host =
      document.querySelector("main") ||
      document.querySelector("header")?.nextElementSibling ||
      document.body;
    if (!host || document.getElementById("paperwork-prefill-banner")) return;

    const box = document.createElement("div");
    box.id = "paperwork-prefill-banner";
    box.className = "paperwork-prefill-banner";
    box.setAttribute("role", "status");
    box.innerHTML = `
      <div class="paperwork-prefill-banner__inner">
        <strong>서류 추출 데이터를 ${calculatorLabel}에 반영했습니다.</strong>
        <p>채운 항목: ${applied.join(", ")}. 빈 칸만 자동 입력했으니 값을 확인한 뒤 계산해 주세요.</p>
        <p class="paperwork-prefill-banner__note">전세보증금·신규 대출금액·금리 등은 서류에서 추출되지 않아 직접 입력이 필요합니다.</p>
        <button type="button" class="paperwork-prefill-banner__close">닫기</button>
      </div>`;

    box.querySelector(".paperwork-prefill-banner__close")?.addEventListener("click", () => box.remove());
    host.insertBefore(box, host.firstChild);
  }

  const APPLYERS = {
    beotimmok: { fn: applyBeotimmok, label: "버팀목 계산기" },
    didimdol: { fn: applyDidimdol, label: "디딤돌 계산기" },
    dsr: { fn: applyDsr, label: "DSR 계산기" },
  };

  function initFor(key) {
    if (!isFromPaperwork()) return;
    const cfg = APPLYERS[key];
    if (!cfg || !loadSummary()) return;
    const { applied } = cfg.fn();
    showBanner(cfg.label, applied);
  }

  global.PaperworkPrefill = {
    STORAGE_KEY,
    loadSummary,
    isFromPaperwork,
    initFor,
    applyBeotimmok,
    applyDidimdol,
    applyDsr,
  };
})(window);
