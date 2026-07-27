/**
 * 대출 정보 상담(localStorage) → 계산기 입력 자동 채움
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
    if (getSpouseIncome(summary)) return true;
    const members = summary.familyMembers;
    if (!Array.isArray(members)) return false;
    return members.some((m) => {
      const r = String(m.relation || "").trim();
      return /배우자|配偶|사별|남편|아내/.test(r);
    });
  }

  function pickPersonIncome(person) {
    if (!person) return null;
    const cert =
      typeof person.incomeCertificateAmount === "number" && person.incomeCertificateAmount > 0
        ? person.incomeCertificateAmount
        : null;
    const recognized =
      typeof person.recognizedAnnualIncome === "number" && person.recognizedAnnualIncome > 0
        ? person.recognizedAnnualIncome
        : null;
    if (cert) {
      if (recognized && recognized <= cert * 1.03) return recognized;
      return cert;
    }
    if (recognized) return recognized;
    const priority = [
      person.withholdingFinalIncome,
      person.withholdingTypeAFinalIncome,
      person.incomeYear2025,
      person.incomeYear2024,
      person.incomeYear2023,
    ];
    for (const v of priority) {
      if (typeof v === "number" && v > 0) return v;
    }
    return null;
  }

  function getSelfIncome(summary) {
    const fromPerson = pickPersonIncome(summary.incomes?.self);
    if (fromPerson) return fromPerson;
    return pickPrimaryIncome(summary);
  }

  function getSpouseIncome(summary) {
    return pickPersonIncome(summary.incomes?.spouse);
  }

  function getCombinedIncome(summary) {
    if (typeof summary.combinedIncome === "number" && summary.combinedIncome > 0) {
      return summary.combinedIncome;
    }
    const self = getSelfIncome(summary);
    const spouse = getSpouseIncome(summary);
    if (self && spouse) return self + spouse;
    return self || spouse || null;
  }

  /** 추출 소득 중 계산기에 넣을 대표 연소득(원) — 하위 호환 */
  function pickPrimaryIncome(summary) {
    const priority = [
      summary.incomeCertificateAmount,
      summary.withholdingFinalIncome,
      summary.withholdingTypeAFinalIncome,
    ];
    for (const v of priority) {
      if (typeof v === "number" && v > 0) return v;
    }
    return null;
  }

  function detectedHas(summary, keywords) {
    const docs = summary.detectedDocuments || [];
    return docs.some((d) => {
      const t = String(d.documentType || "");
      return keywords.some((k) => t.includes(k));
    });
  }

  function paymentCountToSubsidyValue(count) {
    const n = Number(count);
    if (!Number.isFinite(n) || n < 60) return null;
    if (n >= 180) return "0.5";
    if (n >= 120) return "0.4";
    return "0.3";
  }

  function getHousingSubscriptionDiscountLabel(count) {
    const n = Number(count);
    if (!Number.isFinite(n) || n < 60) return null;
    if (n >= 180) return "15년 (180회차) −0.5%p";
    if (n >= 120) return "10년 (120회차) −0.4%p";
    return "5년 (60회차) −0.3%p";
  }

  function setSelectIfDefault(el, value) {
    if (!el || value == null) return false;
    if (el.value !== "0" && el.value !== "") return false;
    el.value = String(value);
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
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

  function mapYearIncomeFields(summary, applied) {
    const self = summary.incomes?.self;
    const spouse = summary.incomes?.spouse;

    const mapPersonYears = (person, prefix, label) => {
      if (!person) return;
      // 계산기 DOM: self-a-2023=전전연도(older), self-a-2024=전연도(newer)
      const idOlder = prefix === "self" ? "self-a-2023" : "sp-a-2023";
      const idNewer = prefix === "self" ? "self-a-2024" : "sp-a-2024";

      const olderAmt =
        person.incomeYearOlder ??
        person.incomeYear2024 ??
        person.incomeByYear?.[person.incomeOlderYear] ??
        person.incomeByYear?.[2024] ??
        (person.withholdingTaxYear === "2024" ? person.withholdingFinalIncome : null) ??
        person.incomeYear2023;
      const newerAmt =
        person.incomeYearNewer ??
        person.incomeYear2025 ??
        person.incomeByYear?.[person.incomeNewerYear] ??
        person.incomeByYear?.[2025] ??
        (person.withholdingTaxYear === "2025" ? person.withholdingFinalIncome : null) ??
        person.incomeYear2024;

      const olderYear = person.incomeOlderYear || 2024;
      const newerYear = person.incomeNewerYear || 2025;

      const certYear = Number(person.incomeCertificateYear);
      const certAmount = person.incomeCertificateAmount;
      if (Number.isFinite(certYear) && typeof certAmount === "number" && certAmount > 0) {
        const certTarget = certYear >= newerYear ? idNewer : idOlder;
        if (setMoneyIfEmpty(document.getElementById(certTarget), certAmount)) {
          applied.push(`${label} ${certYear}년 소득금액증명(소득금액)`);
        }
      }

      if (newerAmt && setMoneyIfEmpty(document.getElementById(idNewer), newerAmt)) {
        applied.push(`${label} ${newerYear}년 소득`);
      }
      if (olderAmt && setMoneyIfEmpty(document.getElementById(idOlder), olderAmt)) {
        applied.push(`${label} ${olderYear}년 소득`);
      }
    };

    mapPersonYears(self, "self", "본인");
    if (hasSpouse(summary)) mapPersonYears(spouse, "spouse", "배우자");

    const applyEmploymentType = (person, radioName, panelPrefix) => {
      if (!person?.employmentStatus) return;
      const map = {
        "1년이상재직": "A",
        "1년미만재직": "B",
        휴직: "C",
        복직: "D",
      };
      const value = map[person.employmentStatus];
      if (!value) return;
      const radio = document.querySelector(`input[name="${radioName}"][value="${value}"]`);
      if (radio) {
        radio.checked = true;
        radio.dispatchEvent(new Event("change", { bubbles: true }));
      }
      const label = panelPrefix === "self" ? "본인" : "배우자";
      if (person.employmentStartDate) {
        const startMap = {
          A: panelPrefix === "self" ? "self-a-start" : "sp-a-start",
          B: panelPrefix === "self" ? "self-b-start" : "sp-b-start",
          C: panelPrefix === "self" ? "self-c-start" : "sp-c-start",
          D: panelPrefix === "self" ? "self-d-start" : "sp-d-start",
        };
        const el = document.getElementById(startMap[value]);
        if (el && fieldEmpty(el)) {
          el.value = person.employmentStartDate;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          applied.push(`${label} 입사일`);
        }
      }
      if ((value === "C" || value === "D") && person.leaveStartDate) {
        const leaveId =
          panelPrefix === "self"
            ? value === "C"
              ? "self-c-leave"
              : "self-d-leave"
            : value === "C"
              ? "sp-c-leave"
              : "sp-d-leave";
        const el = document.getElementById(leaveId);
        if (el && fieldEmpty(el)) {
          el.value = person.leaveStartDate;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          applied.push(`${label} 휴직 시작일`);
        }
      }
      if (value === "D" && person.leaveEndDate) {
        const retId = panelPrefix === "self" ? "self-d-return" : "sp-d-return";
        const el = document.getElementById(retId);
        if (el && fieldEmpty(el)) {
          el.value = person.leaveEndDate;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          applied.push(`${label} 복직일`);
        }
      }
      if (value === "B" && person.receivedIncomeTotal) {
        const sumId = panelPrefix === "self" ? "self-b-sum" : "sp-b-sum";
        const monthsId = panelPrefix === "self" ? "self-b-months" : "sp-b-months";
        if (setMoneyIfEmpty(document.getElementById(sumId), person.receivedIncomeTotal)) {
          applied.push(`${label} 수령 소득 합계`);
        }
        if (person.monthsWorked && fieldEmpty(document.getElementById(monthsId))) {
          document.getElementById(monthsId).value = String(person.monthsWorked);
          applied.push(`${label} 수령 개월 수`);
        }
      }
    };

    applyEmploymentType(self, "emp-self", "self");
    if (hasSpouse(summary)) applyEmploymentType(spouse, "emp-spouse", "spouse");
  }

  function applySpouseIncomePanel(summary, applied) {
    const spouseCb = document.getElementById("has-spouse");
    if (!hasSpouse(summary)) return;

    if (setCheckboxIfUnchecked(spouseCb, true)) {
      applied.push("배우자 있음");
      document.getElementById("spouse-wrap")?.classList.remove("hidden");
    }

    const spouseIncome = getSpouseIncome(summary);
    if (!spouseIncome) return;

    const radio = document.querySelector('input[name="emp-spouse"][value="A"]');
    if (radio && fieldEmpty(document.getElementById("sp-a-2024")) && fieldEmpty(document.getElementById("sp-a-2023"))) {
      radio.checked = true;
      radio.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  function applyBeotimmok() {
    const summary = loadSummary();
    if (!summary) return { applied: [] };
    const applied = [];
    const combined = getCombinedIncome(summary);

    if (combined) {
      if (setMoneyIfEmpty(document.getElementById("bt-income"), combined)) {
        applied.push("부부합산 연소득");
      }
      mapYearIncomeFields(summary, applied);

      if (detectedHas(summary, ["원천징수", "근로소득", "소득금액증명"])) {
        const radio = document.querySelector('input[name="emp-self"][value="A"]');
        if (radio && fieldEmpty(document.getElementById("self-a-2024")) && fieldEmpty(document.getElementById("self-a-2023"))) {
          radio.checked = true;
          radio.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
      if (detectedHas(summary, ["갑종"])) {
        const selfTypeA = summary.incomes?.self?.withholdingTypeAFinalIncome;
        if (setMoneyIfEmpty(document.getElementById("self-b-sum"), selfTypeA || getSelfIncome(summary))) {
          applied.push("신규입사 수령 소득 합계(참고)");
        }
      }
    }

    applySpouseIncomePanel(summary, applied);

    const credit = summary.loans?.creditLoanAmount;
    if (typeof credit === "number" && credit > 0) {
      if (setCheckboxIfUnchecked(document.getElementById("bt-credit-loan"), true)) {
        applied.push("기존 신용대출 있음(금리 가산 참고)");
      }
    }

    return { applied };
  }

  function switchDidimdolRateTab(variant) {
    const map = {
      general: "rate-tab-btn-didimdol",
      didimdol: "rate-tab-btn-didimdol",
      newborn: "rate-tab-btn-newborn",
      firsthome: "rate-tab-btn-firsthome",
    };
    const btnId = map[variant] || map.general;
    document.getElementById(btnId)?.click();
  }

  function applyDidimdol() {
    const summary = loadSummary();
    if (!summary) return { applied: [] };
    const applied = [];
    const combined = getCombinedIncome(summary);

    const variant =
      summary.didimdolVariant ||
      summary.chatSlots?.didimdolVariant ||
      new URLSearchParams(global.location.search).get("tab") ||
      "general";
    const normalized =
      variant === "newborn" || variant === "firsthome" || variant === "didimdol"
        ? variant === "didimdol"
          ? "general"
          : variant
        : "general";
    switchDidimdolRateTab(normalized);
    if (normalized !== "general") {
      applied.push(
        normalized === "newborn" ? "신생아 디딤돌 탭" : "생애최초·신혼 탭"
      );
    }

    if (combined) {
      syncDidimdolRateTabs(combined);
      if (setMoneyIfEmpty(document.getElementById("did-income"), combined)) {
        applied.push("부부합산 연소득(일반 디딤돌)");
      } else if (
        ["did-income", "nb-income", "fh-income"].some((id) => {
          const el = document.getElementById(id);
          return el && String(el.value || "").replace(/,/g, "").trim();
        })
      ) {
        applied.push("금리 탭 소득란");
      }
      mapYearIncomeFields(summary, applied);
    }

    applySpouseIncomePanel(summary, applied);

    const subsidyValue = paymentCountToSubsidyValue(
      summary.housingSubscriptionPaymentCount ?? summary.housingSubscriptionInterestDiscountRounds
    );
    if (subsidyValue) {
      const subsidyIds = ["subsidy", "nb-savings", "fh-subsidy"];
      const filled = subsidyIds.filter((id) => setSelectIfDefault(document.getElementById(id), subsidyValue));
      if (filled.length) {
        const tier = getHousingSubscriptionDiscountLabel(summary.housingSubscriptionPaymentCount);
        applied.push(`청약저축 우대 ${tier}`);
      }
    }

    const nbDiscount =
      summary.newbornChildDiscount ?? summary.chatSlots?.newbornChildDiscount;
    if (nbDiscount != null && nbDiscount !== "") {
      if (setSelectIfDefault(document.getElementById("nb-child-newborn"), nbDiscount)) {
        applied.push("신생아 자녀수 우대");
      }
    }
    const minorDiscount =
      summary.minorChildDiscount ?? summary.chatSlots?.minorChildDiscount;
    if (minorDiscount != null && minorDiscount !== "") {
      if (setSelectIfDefault(document.getElementById("nb-child-minor"), minorDiscount)) {
        applied.push("미성년 자녀 우대");
      }
    }

    return { applied };
  }

  function applyDsr() {
    const summary = loadSummary();
    if (!summary) return { applied: [] };
    const applied = [];
    const combined = getCombinedIncome(summary);

    if (combined && setManIfEmpty(document.getElementById("income"), combined)) {
      applied.push("연간 소득(만원, 부부합산)");
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
        <strong>상담 입력 데이터를 ${calculatorLabel}에 반영했습니다.</strong>
        <p>채운 항목: ${applied.join(", ")}. 빈 칸만 자동 입력했으니 값을 확인한 뒤 계산해 주세요.</p>
        <p class="paperwork-prefill-banner__note">청약저축·소득·휴직일 등이 자동 입력됩니다. 전세보증금·신규 대출금액은 직접 입력이 필요할 수 있습니다.</p>
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
    getCombinedIncome,
    getSelfIncome,
    getSpouseIncome,
  };
})(window);
