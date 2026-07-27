(function () {
  const $ = (id) => document.getElementById(id);
  let lastLoanParams = null;

  function todayStr() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function num(el) {
    if (!el) return 0;
    const raw = String(el.value || "").replace(/,/g, "").trim();
    const v = parseFloat(raw);
    return Number.isFinite(v) ? v : 0;
  }

  function formatMoneyValue(value) {
    const digits = String(value || "").replace(/[^\d]/g, "");
    if (!digits) return "";
    return Number(digits).toLocaleString("ko-KR");
  }

  const SALARY_CALC_GROUPS = [
    { openId: "self-b-calc-open", sumId: "self-b-sum", monthsId: "self-b-months", previewId: "self-b-annual-preview" },
    { openId: "sp-b-calc-open", sumId: "sp-b-sum", monthsId: "sp-b-months", previewId: "sp-b-annual-preview" },
    { openId: "self-d-calc-open", sumId: "self-d-p-sum", monthsId: "self-d-p-months", previewId: "self-d-annual-preview" },
    { openId: "sp-d-calc-open", sumId: "sp-d-p-sum", monthsId: "sp-d-p-months", previewId: "sp-d-annual-preview" },
  ];

  function updateAnnualPreviewLine(sumId, monthsId, previewId) {
    const s = num($(sumId));
    const moRaw = $(monthsId)?.value;
    const m = moRaw != null && moRaw !== "" ? parseInt(String(moRaw).replace(/\D/g, ""), 10) : NaN;
    const out = $(previewId);
    if (!out) return;
    if (!s || s <= 0 || !Number.isFinite(m) || m < 1) {
      out.textContent = "";
      return;
    }
    const annual = (s / m) * 12;
    out.textContent = `연환산 연소득: ${fmtNum(annual)}원`;
  }

  function wireAnnualPreviews() {
    SALARY_CALC_GROUPS.forEach((g) => {
      const upd = () => updateAnnualPreviewLine(g.sumId, g.monthsId, g.previewId);
      $(g.sumId)?.addEventListener("input", upd);
      $(g.monthsId)?.addEventListener("input", upd);
    });
  }

  function wireSalaryCalcModal() {
    const overlay = $("salary-calc-overlay");
    const inp = $("salary-calc-input");
    const totalEl = $("salary-calc-total");
    if (!overlay || !inp || !totalEl) return;

    let activeSumId = null;
    let activePreview = null;
    let running = 0;

    function renderRunning() {
      totalEl.textContent = Math.round(running).toLocaleString("ko-KR");
    }

    function openModal(cfg) {
      activeSumId = cfg.sumId;
      activePreview = cfg;
      running = Math.round(num($(cfg.sumId)));
      inp.value = "";
      renderRunning();
      overlay.classList.remove("hidden");
      setTimeout(() => inp.focus(), 10);
    }

    function closeModal() {
      overlay.classList.add("hidden");
      activeSumId = null;
      activePreview = null;
    }

    function addInputToRunning() {
      const v = num(inp);
      if (v > 0) {
        running += v;
        inp.value = "";
        renderRunning();
      }
    }

    function commitAndClose() {
      const v = num(inp);
      if (v > 0) running += v;
      inp.value = "";
      if (!activeSumId) {
        closeModal();
        return;
      }
      const sumEl = $(activeSumId);
      if (sumEl) sumEl.value = formatMoneyValue(String(Math.round(running)));
      if (activePreview) {
        updateAnnualPreviewLine(activePreview.sumId, activePreview.monthsId, activePreview.previewId);
      }
      closeModal();
    }

    SALARY_CALC_GROUPS.forEach((g) => {
      $(g.openId)?.addEventListener("click", () => openModal(g));
    });

    $("salary-calc-add")?.addEventListener("click", () => {
      addInputToRunning();
      inp.focus();
    });

    $("salary-calc-done")?.addEventListener("click", () => commitAndClose());

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !overlay.classList.contains("hidden")) {
        e.preventDefault();
        closeModal();
      }
    });
  }

  function wireMoneyInputs() {
    const moneyIds = [
      "self-a-2023",
      "self-a-2024",
      "self-b-sum",
      "salary-calc-input",
      "self-c-old",
      "self-c-new",
      "self-d-y2",
      "self-d-y1",
      "self-d-p-sum",
      "did-income",
      "fh-income",
      "sp-a-2023",
      "sp-a-2024",
      "sp-b-sum",
      "sp-c-old",
      "sp-c-new",
      "sp-d-y2",
      "sp-d-y1",
      "sp-d-p-sum",
      "loan-amt",
      "nb-income",
    ];

    moneyIds.forEach((id) => {
      const el = $(id);
      if (!el) return;
      el.type = "text";
      el.inputMode = "numeric";
      el.addEventListener("input", () => {
        const formatted = formatMoneyValue(el.value);
        el.value = formatted;
      });
      if (el.value) el.value = formatMoneyValue(el.value);
    });
  }

  function bindEmpType(radioName, prefix) {
    const nodes = document.querySelectorAll(`input[name="${radioName}"]`);
    nodes.forEach((r) => {
      r.addEventListener("change", () => updatePanels(prefix, r.value));
    });
  }

  function updatePanels(prefix, type) {
    const ids = ["A", "B", "C", "D"];
    ids.forEach((t) => {
      const el = $(`panel-${prefix}-${t}`);
      if (el) el.classList.toggle("hidden", t !== type);
    });
  }

  function updateLeaveLabels(leaveInputId, lblOldId, lblNewId, hintId) {
    const leaveEl = $(leaveInputId);
    if (!leaveEl || !leaveEl.value) return;
    const d = parseDate(leaveEl.value);
    if (!d) return;
    const ly = d.getFullYear();
    const yOld = ly - 2;
    const yNew = ly - 1;
    const lo = $(lblOldId);
    const ln = $(lblNewId);
    if (lo) lo.textContent = `전전연도 소득 (${yOld}년, 원)`;
    if (ln) ln.textContent = `전연도 소득 (${yNew}년, 원)`;
    const h = $(hintId);
    if (h) {
      h.textContent = `휴직이 ${ly}년에 시작되므로, 직전 2개년은 ${yOld}년·${yNew}년 근로(과세)소득을 입력하세요.`;
    }
  }

  function updateLeaveLabelsD(leaveInputId, lblY2, lblY1) {
    const leaveEl = $(leaveInputId);
    if (!leaveEl || !leaveEl.value) return;
    const d = parseDate(leaveEl.value);
    if (!d) return;
    const ly = d.getFullYear();
    const yOld = ly - 2;
    const yNew = ly - 1;
    const a = $(lblY2);
    const b = $(lblY1);
    if (a) a.textContent = `전전연도 소득 (${yOld}년, 원)`;
    if (b) b.textContent = `전연도 소득 (${yNew}년, 원)`;
  }

  function calcPerson(prefix) {
    const type = document.querySelector(`input[name="emp-${prefix}"]:checked`)?.value || "A";
    const hasProof = true;

    if (type === "A") {
      const start = prefix === "self" ? "self-a-start" : "sp-a-start";
      const startDate = parseDate($(start)?.value);
      if (!startDate) return { error: "재직 시작일을 입력해 주세요." };
      if (startDate > new Date()) return { error: "재직 시작일은 오늘 이후일 수 없습니다." };
      const i23 = num($(prefix === "self" ? "self-a-2023" : "sp-a-2023"));
      const i24 = num($(prefix === "self" ? "self-a-2024" : "sp-a-2024"));
      if (i23 <= 0 && i24 <= 0) return { error: "소득을 입력해 주세요." };
      return calcGeneral(i23, i24, hasProof);
    }

    if (type === "B") {
      const start = prefix === "self" ? "self-b-start" : "sp-b-start";
      const sum = prefix === "self" ? "self-b-sum" : "sp-b-sum";
      const months = prefix === "self" ? "self-b-months" : "sp-b-months";
      return calcNewHire2025($(start)?.value, num($(sum)), num($(months)));
    }

    if (type === "C") {
      const start = prefix === "self" ? "self-c-start" : "sp-c-start";
      const leave = prefix === "self" ? "self-c-leave" : "sp-c-leave";
      const old = prefix === "self" ? "self-c-old" : "sp-c-old";
      const neu = prefix === "self" ? "self-c-new" : "sp-c-new";
      return calcOnLeave($(start)?.value, $(leave)?.value, num($(old)), num($(neu)), hasProof);
    }

    if (type === "D") {
      const empStartId = prefix === "self" ? "self-d-start" : "sp-d-start";
      const leave = prefix === "self" ? "self-d-leave" : "sp-d-leave";
      const ret = prefix === "self" ? "self-d-return" : "sp-d-return";
      const end = prefix === "self" ? "self-d-end" : "sp-d-end";
      const y2 = num(prefix === "self" ? $("self-d-y2") : $("sp-d-y2"));
      const y1 = num(prefix === "self" ? $("self-d-y1") : $("sp-d-y1"));
      const endVal = $(end)?.value || todayStr();

      const empStartVal = $(empStartId)?.value;
      const empDate = empStartVal ? parseDate(empStartVal) : null;
      const leaveDate = $(leave)?.value ? parseDate($(leave).value) : null;
      if (!empDate) return { error: "재직 시작일을 입력해 주세요." };
      if (!leaveDate) return { error: "휴직 시작일을 입력해 주세요." };
      if (empDate > leaveDate) return { error: "재직 시작일은 휴직 시작일보다 빠르거나 같아야 합니다." };

      const psum = num(prefix === "self" ? $("self-d-p-sum") : $("sp-d-p-sum"));
      const pm = num(prefix === "self" ? $("self-d-p-months") : $("sp-d-p-months"));
      return calcReturned($(leave)?.value, $(ret)?.value, y2, y1, "partial", 0, psum, endVal, pm, hasProof);
    }

    return { error: "유형을 선택해 주세요." };
  }

  function monthlyPMT(principal, annualRatePct, years) {
    if (principal <= 0 || years <= 0) return 0;
    const r = annualRatePct / 100 / 12;
    const n = years * 12;
    if (r === 0) return principal / n;
    return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  }

  function syncHouseholdIncomeToRateTabs(incomeTotal) {
    const formatted = formatMoneyValue(String(Math.round(incomeTotal)));
    ["did-income", "nb-income", "fh-income"].forEach((id) => {
      const el = $(id);
      if (el) el.value = formatted;
    });
  }

  function getActiveRateKind() {
    if (!$("rate-tab-didimdol")?.classList.contains("hidden")) return "did";
    if (!$("rate-tab-newborn")?.classList.contains("hidden")) return "nb";
    return "fh";
  }

  function getIncomeFromActiveRateTab() {
    const k = getActiveRateKind();
    if (k === "did") return num($("did-income"));
    if (k === "nb") return num($("nb-income"));
    return num($("fh-income"));
  }

  /**
   * 3번 탭 연소득이 있으면 우선(수기·1·2 연동 반영값 모두 포함).
   * 없으면 1·2번 산출. 신생아 탭만 소득 0도 허용(금리는 표 상한 참고).
   */
  function resolveAnnualIncomeForCalc() {
    const tabInc = getIncomeFromActiveRateTab();
    if (tabInc > 0) {
      return { total: tabInc, source: "tab" };
    }

    const resSelf = calcPerson("self");
    if (!resSelf.error) {
      let incomeSpouse = 0;
      if ($("has-spouse")?.checked) {
        const resSpouse = calcPerson("spouse");
        if (resSpouse.error) return { error: "배우자: " + resSpouse.error };
        incomeSpouse = resSpouse.income;
      }
      return {
        total: resSelf.income + incomeSpouse,
        source: "steps12",
        resSelf,
        resSpouse,
        incomeSpouse,
      };
    }

    if (getActiveRateKind() === "nb") {
      return { total: 0, source: "nb-no-income" };
    }

    return {
      error: "1·2번에서 소득을 산출하거나, 3번 탭에 부부합산 연소득을 입력해 주세요.",
    };
  }

  function syncFinalRateToLoanRate(finalRatePct) {
    const el = $("loan-rate");
    if (!el || !Number.isFinite(finalRatePct)) return;
    el.value = String(Number(finalRatePct.toFixed(4)));
  }

  function getDidimdolBaseRate(income, termYears) {
    const rows = [
      { max: 20000000, rates: { 10: 2.85, 15: 2.95, 20: 3.05, 30: 3.1 } },
      { max: 40000000, rates: { 10: 3.2, 15: 3.3, 20: 3.4, 30: 3.45 } },
      { max: 70000000, rates: { 10: 3.55, 15: 3.65, 20: 3.75, 30: 3.8 } },
      { max: 85000000, rates: { 10: 3.9, 15: 4.0, 20: 4.1, 30: 4.15 } },
    ];
    const top = rows[rows.length - 1].rates[termYears];
    const row = rows.find((r) => income <= r.max);
    return row ? row.rates[termYears] : top;
  }

  function getFirstHomeBaseRate(income, termYears) {
    const rows = [
      { max: 20000000, rates: { 10: 2.55, 15: 2.65, 20: 2.75, 30: 2.8 } },
      { max: 40000000, rates: { 10: 2.9, 15: 3.0, 20: 3.1, 30: 3.15 } },
      { max: 70000000, rates: { 10: 3.25, 15: 3.35, 20: 3.45, 30: 3.5 } },
      { max: 85000000, rates: { 10: 3.6, 15: 3.7, 20: 3.8, 30: 3.85 } },
    ];
    const top = rows[rows.length - 1].rates[termYears];
    const row = rows.find((r) => income <= r.max);
    return row ? row.rates[termYears] : top;
  }

  function calcDidimdolLikeRate(opts) {
    let base = getDidimdolBaseRate(opts.income, opts.term);

    base += opts.rateTypeAdd || 0;
    if (opts.localHome) base -= 0.2;

    let discountRaw = 0;
    discountRaw += opts.specialBaseDiscount || 0;
    discountRaw += opts.childDiscount || 0;
    discountRaw += opts.savingsDiscount || 0;
    (opts.checkboxDiscounts || []).forEach((v) => {
      discountRaw += v;
    });

    const cap = opts.hasChild ? 0.7 : 0.5;
    const applied = Math.min(discountRaw, cap);
    const finalRate = Math.max(1.5, base - applied);
    return { base, discountRaw, applied, finalRate, cap };
  }

  function getNewbornSpecialBaseRate(income, termYears) {
    const brackets = [
      { max: 20000000, rates: { 10: 1.8, 15: 1.9, 20: 2.0, 30: 2.05 } },
      { max: 40000000, rates: { 10: 2.15, 15: 2.25, 20: 2.35, 30: 2.4 } },
      { max: 60000000, rates: { 10: 2.4, 15: 2.5, 20: 2.6, 30: 2.65 } },
      { max: 85000000, rates: { 10: 2.65, 15: 2.75, 20: 2.85, 30: 2.9 } },
      { max: 100000000, rates: { 10: 2.9, 15: 3.0, 20: 3.1, 30: 3.2 } },
      { max: 130000000, rates: { 10: 3.2, 15: 3.3, 20: 3.4, 30: 3.5 } },
      { max: 150000000, rates: { 10: 3.5, 15: 3.6, 20: 3.7, 30: 3.8 } },
      { max: 170000000, rates: { 10: 3.85, 15: 3.95, 20: 4.05, 30: 4.15 } },
      { max: 200000000, rates: { 10: 4.2, 15: 4.3, 20: 4.4, 30: 4.5 } },
    ];
    const top = brackets[brackets.length - 1].rates[termYears];
    if (!Number.isFinite(income) || income <= 0) return top;
    const row = brackets.find((b) => income <= b.max);
    return row ? row.rates[termYears] : top;
  }

  function getNewbornPostBaseRate(income, termYears, specialBase) {
    // 사진 기준: <=8.5천은 특례금리에 0.75 가산.
    // 그 외 구간은 화면 내 각주 기준의 참고 규칙으로 계산.
    const eff = !Number.isFinite(income) || income <= 0 ? 200000000 : income;
    if (eff <= 85000000) return specialBase + 0.75;
    if (eff <= 130000000) return Math.max(3.45, specialBase + 0.2);
    return specialBase + 0.2;
  }

  function runNewbornCalc() {
    const income = num($("nb-income"));
    const term = parseInt($("nb-term")?.value || "30", 10);
    const local = $("nb-local-home")?.checked;

    let specialBase = getNewbornSpecialBaseRate(income, term);
    if (local) specialBase -= 0.2;

    let discountRaw = 0;
    discountRaw += parseFloat($("nb-savings")?.value || "0") || 0;
    discountRaw += parseFloat($("nb-child-newborn")?.value || "0") || 0;
    discountRaw += parseFloat($("nb-child-minor")?.value || "0") || 0;
    if ($("nb-electronic")?.checked) discountRaw += 0.1;
    if ($("nb-early40")?.checked) discountRaw += 0.2;
    if ($("nb-local-unsold")?.checked) discountRaw += 0.2;

    const discountCap = 0.5;
    const discountApplied = Math.min(discountRaw, discountCap);
    const specialFloor = 1.2;
    let specialFinal = specialBase - discountApplied;
    if (specialFinal < specialFloor) specialFinal = specialFloor;

    let postBase = getNewbornPostBaseRate(income, term, specialBase);
    if (local) postBase -= 0.2;
    let postFinal = postBase - discountApplied;
    if (postFinal < specialFloor) postFinal = specialFloor;

    $("nb-base-special").textContent = `${specialBase.toFixed(2)}%`;
    $("nb-discount-applied").textContent = `-${discountApplied.toFixed(2)}%p (원우대 ${discountRaw.toFixed(2)}%p)`;
    $("nb-final-special").textContent = `${specialFinal.toFixed(2)}%`;
    let incomeNote = "";
    if (!Number.isFinite(income) || income <= 0) {
      incomeNote = "소득 미입력 시 표 최고 구간(2억 초과 구간) 금리로 참고 계산했습니다. ";
    } else if (income > 200000000) {
      incomeNote = `입력 소득 ${fmtNum(income)}원은 표 상한(2억)을 넘어 최고 구간 금리를 적용한 참고 계산입니다. `;
    } else {
      incomeNote = `소득 ${fmtNum(income)}원 기준. `;
    }
    $("nb-reason").textContent =
      `${incomeNote}만기 ${term}년, 신생아 특례금리 기준으로 참고 산출합니다. 우대는 최대 0.5%p, 최저금리 1.2%로 제한했습니다.`;

    $("nb-results").classList.remove("hidden");
    $("nb-results").scrollIntoView({ behavior: "smooth", block: "start" });
    syncFinalRateToLoanRate(specialFinal);
  }

  function runFirstHomeCalc() {
    const income = num($("fh-income"));
    const term = parseInt($("fh-term")?.value || "30", 10);
    if (income <= 0) {
      alert("생애최초·신혼가구 탭: 부부합산 연소득을 입력해 주세요.");
      return;
    }

    const childDiscount = parseFloat($("fh-child-tier")?.value || "0") || 0;
    let base = getFirstHomeBaseRate(income, term);
    if ($("fh-local-home")?.checked) base -= 0.2;

    let discountRaw = 0;
    discountRaw += childDiscount;
    discountRaw += parseFloat($("fh-subsidy")?.value || "0") || 0;
    discountRaw += $("fh-electronic")?.checked ? 0.1 : 0;
    discountRaw += $("fh-under30")?.checked ? 0.1 : 0;
    discountRaw += $("fh-prepay40")?.checked ? 0.2 : 0;
    discountRaw += $("fh-local-unsold")?.checked ? 0.2 : 0;

    const cap = childDiscount > 0 ? 0.7 : 0.5;
    const applied = Math.min(discountRaw, cap);
    const finalRate = Math.max(1.2, base - applied);

    $("fh-base").textContent = `${base.toFixed(2)}%`;
    $("fh-discount").textContent = `-${applied.toFixed(2)}%p (원우대 ${discountRaw.toFixed(2)}%p)`;
    $("fh-final").textContent = `${finalRate.toFixed(2)}%`;
    $("fh-reason").textContent =
      `생애최초·신혼부부 전용 금리표 기준. 우대 상한 ${cap.toFixed(1)}%p, 최종금리 하한 1.2%를 적용했습니다.`;
    $("fh-results").classList.remove("hidden");
    $("fh-results").scrollIntoView({ behavior: "smooth", block: "start" });
    syncFinalRateToLoanRate(finalRate);
  }

  function runIncomeCalc() {
    const resSelf = calcPerson("self");
    if (resSelf.error) { alert(resSelf.error); return; }

    let incomeSpouse = 0;
    if ($("has-spouse")?.checked) {
      const resSpouse = calcPerson("spouse");
      if (resSpouse.error) { alert("배우자: " + resSpouse.error); return; }
      incomeSpouse = resSpouse.income;
    }

    const incomeTotal = resSelf.income + incomeSpouse;
    syncHouseholdIncomeToRateTabs(incomeTotal);
    alert(`부부합산 연소득 ${fmtNum(incomeTotal)}원이 3번 탭에 반영됐습니다.`);
  }

  // —— 예상 필요서류 ——
  function didIncomeDocForType(type) {
    if (type === "A")
      return "근로소득원천징수영수증 <span class=\"muted\">(전년도 + 전전년도 각 1부)</span> — 4대보험 근로자";
    if (type === "B")
      return "갑종근로소득원천징수영수증 <span class=\"muted\">(입사일 ~ 현재, 2개년에 걸친 경우 각 연도분)</span> — 전년도 또는 금년 입사자";
    if (type === "C")
      return "근로소득원천징수영수증 <span class=\"muted\">(휴직 직전 2개년 · 각 연도분)</span> — 휴직자";
    if (type === "D")
      return "근로소득원천징수영수증 <span class=\"muted\">(휴직 직전 2개년)</span> + 복직 후 갑종근로소득원천징수영수증 — 복직자";
    return "근로소득원천징수영수증 <span class=\"muted\">(전년도 + 전전년도 각 1부)</span>";
  }

  function buildDidCommonDocs(selfType, spouseType, hasSpouse) {
    const list = [];
    list.push("부동산 매매계약서 <span class=\"muted\">(필요시 부동산등기사항증명서 등 소유권 확인 서류)</span>");
    list.push("주민등록등본 <span class=\"muted\">(최근 1개월 이내)</span>");
    list.push("주민등록초본 <span class=\"muted\">(주소변동내역 포함 · 최근 1개월 이내)</span>");
    list.push("가족관계증명서");

    const incomeDocs = [];
    incomeDocs.push(`본인: ${didIncomeDocForType(selfType)}`);
    if (hasSpouse) incomeDocs.push(`배우자: ${didIncomeDocForType(spouseType)}`);
    incomeDocs.push(
      "<span class=\"muted\">사업자인 경우 소득금액증명원 (전년도 + 전전년도 각 1부, 7월 이전에는 전전년도·전전전년도 제출)</span>"
    );
    list.push(
      "소득확인서류 <span class=\"muted\">(최근 2개년치)</span>" +
        "<ul class=\"doc-sublist\">" +
        incomeDocs.map((d) => `<li>${d}</li>`).join("") +
        "</ul>"
    );

    list.push("재직증명서 <span class=\"muted\">(사업자의 경우 사업자등록증)</span>");
    list.push("4대보험 가입확인서 <span class=\"muted\">(정부24에서 발급)</span>");
    list.push("건강보험자격득실확인서");
    list.push("건강보험납부내역서 <span class=\"muted\">(최근 6개월)</span>");
    list.push("전입세대열람원 <span class=\"muted\">(담보 주택의 전입 세대 확인 용도 · 주민센터 발급)</span>");
    list.push(
      "인감증명서 · 인감도장 <span class=\"muted\">(등기·근저당 설정 용도)</span> — <strong>전자등기 진행 시 불필요</strong>"
    );
    return list;
  }

  function renderDidDocs(opts) {
    const wrap = $("did-docs-results");
    if (!wrap) return;
    const {
      tab,
      hasSpouse,
      selectedPrefs = [],
      extras = [],
      extraTitle = "상품별 추가 서류",
      summaryLabel,
    } = opts;

    const selfType = document.querySelector('input[name="emp-self"]:checked')?.value || "A";
    const spouseType = document.querySelector('input[name="emp-spouse"]:checked')?.value || "A";

    const summaryParts = [];
    if (summaryLabel) summaryParts.push(summaryLabel);
    if (hasSpouse) summaryParts.push("부부합산");
    const summaryEl = $("did-docs-summary");
    if (summaryEl) {
      summaryEl.textContent = `${summaryParts.join(" · ")} 기준으로 필요한 서류를 정리했습니다.`;
    }

    const commonUl = $("did-docs-common");
    if (commonUl) {
      commonUl.innerHTML = buildDidCommonDocs(selfType, spouseType, hasSpouse)
        .map((d) => `<li>${d}</li>`)
        .join("");
    }

    const extraWrap = $("did-docs-extra-wrap");
    const extraTitleEl = $("did-docs-extra-title");
    const extraUl = $("did-docs-extra");
    if (extras.length > 0) {
      extraWrap?.classList.remove("hidden");
      if (extraTitleEl) extraTitleEl.textContent = extraTitle;
      if (extraUl) extraUl.innerHTML = extras.map((d) => `<li>${d}</li>`).join("");
    } else {
      extraWrap?.classList.add("hidden");
      if (extraUl) extraUl.innerHTML = "";
    }

    const prefWrap = $("did-docs-pref-wrap");
    const prefUl = $("did-docs-pref");
    if (selectedPrefs.length > 0) {
      prefWrap?.classList.remove("hidden");
      if (prefUl) prefUl.innerHTML = selectedPrefs.map((d) => `<li>${d}</li>`).join("");
    } else {
      prefWrap?.classList.add("hidden");
      if (prefUl) prefUl.innerHTML = "";
    }

    wrap.classList.remove("hidden");
  }

  function renderDidDocsForActiveTab() {
    const hasSpouse = !!$("has-spouse")?.checked;
    const didVisible = !$("rate-tab-didimdol")?.classList.contains("hidden");
    const nbVisible = !$("rate-tab-newborn")?.classList.contains("hidden");

    if (didVisible) {
      const prefs = [];
      const extras = [];
      let extraTitle = "상품별 추가 서류";

      if ($("did-single-parent")?.checked) prefs.push("한부모가족 증명서");
      if ($("did-special")?.checked) {
        prefs.push(
          "장애인증명서 / 다문화·신혼가구 확인서류(혼인관계증명서 등) / 생애최초 확인 서류 <span class=\"muted\">(해당 자격 증빙 1종)</span>"
        );
        if (!extras.includes("혼인관계증명서")) {
          extras.push("혼인관계증명서 <span class=\"muted\">(신혼가구·다문화 해당 시)</span>");
          extraTitle = "자격 해당 시 추가 서류";
        }
      }
      const childTier = parseFloat($("did-child-tier")?.value || "0") || 0;
      if (childTier > 0) {
        const label =
          childTier === 0.7 ? "다자녀(3자녀 이상)" : childTier === 0.5 ? "2자녀" : "1자녀";
        prefs.push(
          `자녀수 확인 — 가족관계증명서 <span class=\"muted\">(공통 기본서류에 포함, ${label} 우대)</span>`
        );
        prefs.push("자녀 기본증명서");
      }
      renderDidDocs({
        tab: "did",
        hasSpouse,
        selectedPrefs: prefs,
        extras,
        extraTitle,
        summaryLabel: "일반 디딤돌",
      });
    } else if (nbVisible) {
      const prefs = [];
      const extras = [
        "혼인관계증명서 <span class=\"muted\">(부부합산·가족관계 확인)</span>",
        "자녀 기본증명서 <span class=\"muted\">(신생아·미성년 자녀 전원)</span>",
        "출생증명서 <span class=\"muted\">(출산 병원에서 발급 · 신생아 해당)</span>",
      ];
      const nbNew = parseFloat($("nb-child-newborn")?.value || "0") || 0;
      const nbMinor = parseFloat($("nb-child-minor")?.value || "0") || 0;
      if (nbNew > 0 || nbMinor > 0) {
        const parts = [];
        if (nbNew > 0) {
          const n = nbNew === 0.6 ? 4 : nbNew === 0.4 ? 3 : 2;
          parts.push(`신생아 ${n}자녀`);
        }
        if (nbMinor > 0) {
          const n = nbMinor === 0.3 ? 3 : nbMinor === 0.2 ? 2 : 1;
          parts.push(`미성년 ${n}자녀`);
        }
        prefs.push(
          `자녀수 증빙 추가 확인 <span class=\"muted\">(${parts.join(" · ")} 우대 신청 시)</span>`
        );
      }
      renderDidDocs({
        tab: "nb",
        hasSpouse,
        selectedPrefs: prefs,
        extras,
        extraTitle: "신생아특례 디딤돌 추가 서류",
        summaryLabel: "신생아 디딤돌",
      });
    } else {
      const prefs = [];
      const extras = ["혼인관계증명서"];
      const fhChild = parseFloat($("fh-child-tier")?.value || "0") || 0;
      if (fhChild > 0) {
        const label = fhChild === 0.7 ? "다자녀(3자녀 이상)" : fhChild === 0.5 ? "2자녀" : "1자녀";
        prefs.push(
          `자녀수 확인 — 가족관계증명서 <span class=\"muted\">(공통 기본서류에 포함, ${label} 우대)</span>`
        );
        prefs.push("자녀 기본증명서");
      }
      renderDidDocs({
        tab: "fh",
        hasSpouse,
        selectedPrefs: prefs,
        extras,
        extraTitle: "생애최초·신혼가구 추가 서류",
        summaryLabel: "생애최초·신혼가구 디딤돌",
      });
    }
  }

  function runRateCalc() {
    const didVisible = !$("rate-tab-didimdol")?.classList.contains("hidden");
    const nbVisible  = !$("rate-tab-newborn")?.classList.contains("hidden");

    if (didVisible) {
      const income = num($("did-income"));
      const term   = parseInt($("did-term")?.value || "30", 10);
      if (income <= 0) { alert("부부합산 연소득을 입력해 주세요."); return; }
      const childDiscount = parseFloat($("did-child-tier")?.value || "0") || 0;
      const result = calcDidimdolLikeRate({
        income,
        term,
        rateTypeAdd: 0,
        localHome: $("did-local-home")?.checked,
        specialBaseDiscount: 0,
        childDiscount,
        savingsDiscount: parseFloat($("subsidy")?.value || "0") || 0,
        hasChild: childDiscount > 0,
        checkboxDiscounts: Array.from(document.querySelectorAll("#rate-tab-didimdol input[type=checkbox][data-rate]"))
          .filter((c) => c.checked)
          .map((c) => parseFloat(c.getAttribute("data-rate") || "0")),
      });
      if (result.error) { alert("디딤돌 금리: " + result.error); return; }
      $("did-base").textContent = `${result.base.toFixed(2)}%`;
      $("did-discount-out").textContent = `-${result.applied.toFixed(2)}%p (원우대 ${result.discountRaw.toFixed(2)}%p)`;
      $("did-final").textContent = `${result.finalRate.toFixed(2)}%`;
      $("did-reason").textContent = `소득 ${fmtNum(income)}원, 만기 ${term}년 기준. 우대 상한 ${result.cap.toFixed(1)}%p, 최저금리 1.5% 적용.`;
      $("did-results")?.classList.remove("hidden");
      $("did-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
      syncFinalRateToLoanRate(result.finalRate);
      renderDidDocsForActiveTab();
    } else if (nbVisible) {
      runNewbornCalc();
      if (!$("nb-results")?.classList.contains("hidden")) renderDidDocsForActiveTab();
    } else {
      runFirstHomeCalc();
      if (!$("fh-results")?.classList.contains("hidden")) renderDidDocsForActiveTab();
    }
  }

  function runCalc() {
    const resolved = resolveAnnualIncomeForCalc();
    if (resolved.error) {
      alert(resolved.error);
      return;
    }

    const incomeTotal = resolved.total;

    if (resolved.source === "steps12") {
      syncHouseholdIncomeToRateTabs(incomeTotal);
      $("out-self").textContent = `${fmtNum(resolved.resSelf.income)}원`;
      $("out-spouse").textContent = $("has-spouse")?.checked ? `${fmtNum(resolved.incomeSpouse)}원` : "(미합산)";
      $("out-sum").textContent = `${fmtNum(incomeTotal)}원`;
      $("out-reason-self").textContent = "본인: " + resolved.resSelf.reason;
      const rsp = $("out-reason-spouse");
      if (resolved.resSpouse && $("has-spouse")?.checked) {
        rsp.classList.remove("hidden");
        rsp.textContent = "배우자: " + resolved.resSpouse.reason;
      } else {
        rsp.classList.add("hidden");
      }
    } else if (resolved.source === "tab") {
      $("out-self").textContent = "(3번 탭 입력)";
      $("out-spouse").textContent = "(참고)";
      $("out-sum").textContent = `${fmtNum(incomeTotal)}원`;
      $("out-reason-self").textContent = "1·2번 산출 없이 3번 탭에 입력한 부부합산 연소득을 사용했습니다.";
      $("out-reason-spouse").classList.add("hidden");
    } else {
      $("out-self").textContent = "—";
      $("out-spouse").textContent = "—";
      $("out-sum").textContent = "미입력";
      $("out-reason-self").textContent =
        "신생아 탭에서 소득 미입력 시 표 최고 구간 금리로 계산합니다. DTI·합산 소득은 3번 또는 1·2번 입력이 필요합니다.";
      $("out-reason-spouse").classList.add("hidden");
    }

    const didVisible = !$("rate-tab-didimdol")?.classList.contains("hidden");
    const nbVisible = !$("rate-tab-newborn")?.classList.contains("hidden");
    let finalRate = 0;

    if (didVisible) {
      const didIncome = num($("did-income"));
      const didTerm = parseInt($("did-term")?.value || "30", 10);
      const childDiscount = parseFloat($("did-child-tier")?.value || "0") || 0;
      const result = calcDidimdolLikeRate({
        income: didIncome,
        term: didTerm,
        rateTypeAdd: 0,
        localHome: $("did-local-home")?.checked,
        specialBaseDiscount: 0,
        childDiscount,
        savingsDiscount: parseFloat($("subsidy")?.value || "0") || 0,
        hasChild: childDiscount > 0,
        checkboxDiscounts: Array.from(document.querySelectorAll("#rate-tab-didimdol input[type=checkbox][data-rate]"))
          .filter((c) => c.checked)
          .map((c) => parseFloat(c.getAttribute("data-rate") || "0")),
      });
      if (result.error) {
        alert("디딤돌 금리: " + result.error);
        return;
      }
      finalRate = result.finalRate;
      $("out-discount").textContent = `−${result.applied.toFixed(2)}%p (원우대 ${result.discountRaw.toFixed(2)}%p)`;
      $("out-final-rate").textContent = `${finalRate.toFixed(2)}% (디딤돌 기준, 기본 ${result.base.toFixed(2)}%)`;
    } else if (nbVisible) {
      const income = num($("nb-income"));
      const term = parseInt($("nb-term")?.value || "30", 10);
      const local = $("nb-local-home")?.checked;
      let specialBase = getNewbornSpecialBaseRate(income, term);
      if (local) specialBase -= 0.2;
      let discountRaw = 0;
      discountRaw += parseFloat($("nb-savings")?.value || "0") || 0;
      discountRaw += parseFloat($("nb-child-newborn")?.value || "0") || 0;
      discountRaw += parseFloat($("nb-child-minor")?.value || "0") || 0;
      if ($("nb-electronic")?.checked) discountRaw += 0.1;
      if ($("nb-early40")?.checked) discountRaw += 0.2;
      if ($("nb-local-unsold")?.checked) discountRaw += 0.2;
      const discountApplied = Math.min(discountRaw, 0.5);
      finalRate = Math.max(1.2, specialBase - discountApplied);
      $("out-discount").textContent = `−${discountApplied.toFixed(2)}%p (원우대 ${discountRaw.toFixed(2)}%p)`;
      $("out-final-rate").textContent = `${finalRate.toFixed(2)}% (신생아 특례 기준, 기본 ${specialBase.toFixed(2)}%)`;
    } else {
      const income = num($("fh-income"));
      const term = parseInt($("fh-term")?.value || "30", 10);
      if (income <= 0) {
        alert("생애최초·신혼가구 탭: 부부합산 연소득을 입력해 주세요.");
        return;
      }
      const childDiscount = parseFloat($("fh-child-tier")?.value || "0") || 0;
      let base = getFirstHomeBaseRate(income, term);
      if ($("fh-local-home")?.checked) base -= 0.2;
      let discountRaw = 0;
      discountRaw += childDiscount;
      discountRaw += parseFloat($("fh-subsidy")?.value || "0") || 0;
      discountRaw += $("fh-electronic")?.checked ? 0.1 : 0;
      discountRaw += $("fh-under30")?.checked ? 0.1 : 0;
      discountRaw += $("fh-prepay40")?.checked ? 0.2 : 0;
      discountRaw += $("fh-local-unsold")?.checked ? 0.2 : 0;
      const cap = childDiscount > 0 ? 0.7 : 0.5;
      const applied = Math.min(discountRaw, cap);
      finalRate = Math.max(1.2, base - applied);
      $("out-discount").textContent = `−${applied.toFixed(2)}%p (원우대 ${discountRaw.toFixed(2)}%p)`;
      $("out-final-rate").textContent = `${finalRate.toFixed(2)}% (생애최초·신혼 기준, 기본 ${base.toFixed(2)}%)`;
    }

    const loanAmt = num($("loan-amt"));
    const loanYears = num($("loan-years")) || 30;
    const loanRateInput = num($("loan-rate"));
    const loanRateForCalc = loanRateInput > 0 ? loanRateInput : finalRate;
    const graceMonths = Math.max(0, parseInt($("grace-months")?.value || "0", 10) || 0);
    const totalMonths = loanYears * 12;
    const repayMonths = Math.max(1, totalMonths - graceMonths);
    const pmt = monthlyPMT(loanAmt, loanRateForCalc, repayMonths / 12);
    const piM = pmt * 12;

    const dtiCapPct = 60;

    const judge = $("out-dti-judge");
    if (incomeTotal > 0) {
      const dti = (piM / incomeTotal) * 100;
      $("out-dti").textContent = `${dti.toFixed(2)}%`;
      const ok = dti <= dtiCapPct;
      judge.textContent = ok ? "기준 이내" : "기준 초과";
      judge.className = ok ? "pill-ok" : "pill-bad";
    } else {
      $("out-dti").textContent = "—";
      judge.textContent = "DTI는 연소득이 필요합니다 (3번 또는 1·2번).";
      judge.className = "";
    }

    $("out-pmt").textContent = loanAmt > 0
      ? `${fmtNum(pmt)}원/월 (원리금균등·적용 금리 ${loanRateForCalc.toFixed(2)}%${graceMonths > 0 ? `·거치 ${graceMonths}개월` : ""})`
      : "(대출원금 미입력)";

    $("results").classList.remove("hidden");
    $("results").scrollIntoView({ behavior: "smooth", block: "start" });

    lastLoanParams = loanAmt > 0
      ? { principal: loanAmt, annualRate: loanRateForCalc, totalMonths, graceMonths }
      : null;
    if (lastLoanParams) {
      $("schedule-section")?.classList.remove("hidden");
    } else {
      $("schedule-section")?.classList.add("hidden");
      $("schedule-wrap").innerHTML = "";
    }
  }

  function initDefaults() {
    const t = todayStr();
    if ($("self-d-end")) $("self-d-end").value = t;
    if ($("sp-d-end")) $("sp-d-end").value = t;
  }

  $("has-spouse")?.addEventListener("change", () => {
    $("spouse-wrap").classList.toggle("hidden", !$("has-spouse").checked);
  });

  $("self-c-leave")?.addEventListener("change", () =>
    updateLeaveLabels("self-c-leave", "self-c-lbl-old", "self-c-lbl-new", "self-c-hint")
  );
  $("sp-c-leave")?.addEventListener("change", () =>
    updateLeaveLabels("sp-c-leave", "sp-c-lbl-old", "sp-c-lbl-new", null)
  );
  $("self-d-leave")?.addEventListener("change", () => updateLeaveLabelsD("self-d-leave", "self-d-lbl-y2", "self-d-lbl-y1"));
  $("sp-d-leave")?.addEventListener("change", () => updateLeaveLabelsD("sp-d-leave", "sp-d-lbl-y2", "sp-d-lbl-y1"));

  bindEmpType("emp-self", "self");
  bindEmpType("emp-spouse", "spouse");

  $("rate-tab-btn-didimdol")?.addEventListener("click", () => {
    $("rate-tab-btn-didimdol").classList.add("active");
    $("rate-tab-btn-newborn").classList.remove("active");
    $("rate-tab-btn-firsthome").classList.remove("active");
    $("rate-tab-didimdol").classList.remove("hidden");
    $("rate-tab-newborn").classList.add("hidden");
    $("rate-tab-firsthome").classList.add("hidden");
    $("did-docs-results")?.classList.add("hidden");
  });
  $("rate-tab-btn-newborn")?.addEventListener("click", () => {
    $("rate-tab-btn-newborn").classList.add("active");
    $("rate-tab-btn-didimdol").classList.remove("active");
    $("rate-tab-btn-firsthome").classList.remove("active");
    $("rate-tab-newborn").classList.remove("hidden");
    $("rate-tab-didimdol").classList.add("hidden");
    $("rate-tab-firsthome").classList.add("hidden");
    $("did-docs-results")?.classList.add("hidden");
  });
  $("rate-tab-btn-firsthome")?.addEventListener("click", () => {
    $("rate-tab-btn-firsthome").classList.add("active");
    $("rate-tab-btn-didimdol").classList.remove("active");
    $("rate-tab-btn-newborn").classList.remove("active");
    $("rate-tab-firsthome").classList.remove("hidden");
    $("rate-tab-didimdol").classList.add("hidden");
    $("rate-tab-newborn").classList.add("hidden");
    $("did-docs-results")?.classList.add("hidden");
  });

  // 상담 체크리스트 → 디딤돌 하위 탭 (?tab=newborn|firsthome|didimdol)
  const rateTabParam = new URLSearchParams(location.search).get("tab");
  if (rateTabParam === "newborn") $("rate-tab-btn-newborn")?.click();
  else if (rateTabParam === "firsthome") $("rate-tab-btn-firsthome")?.click();
  else if (rateTabParam === "didimdol" || rateTabParam === "general") {
    $("rate-tab-btn-didimdol")?.click();
  }

  function genScheduleEqualInstallment(principal, annualRatePct, totalMonths, graceMonths) {
    const r = annualRatePct / 100 / 12;
    const repayMonths = totalMonths - graceMonths;
    const pmt = repayMonths > 0
      ? r > 0
        ? (principal * r * Math.pow(1 + r, repayMonths)) / (Math.pow(1 + r, repayMonths) - 1)
        : principal / repayMonths
      : 0;
    const rows = [];
    let balance = principal;
    for (let i = 1; i <= totalMonths; i++) {
      const interest = balance * r;
      let principalPaid, payment;
      if (i <= graceMonths) {
        principalPaid = 0;
        payment = interest;
      } else {
        principalPaid = Math.max(0, pmt - interest);
        payment = pmt;
      }
      balance = Math.max(0, balance - principalPaid);
      rows.push({ month: i, principal: principalPaid, interest, payment, balance });
    }
    return rows;
  }

  function genScheduleEqualPrincipal(principal, annualRatePct, totalMonths, graceMonths) {
    const r = annualRatePct / 100 / 12;
    const repayMonths = totalMonths - graceMonths;
    const monthlyPrincipal = repayMonths > 0 ? principal / repayMonths : 0;
    const rows = [];
    let balance = principal;
    for (let i = 1; i <= totalMonths; i++) {
      const interest = balance * r;
      let principalPaid, payment;
      if (i <= graceMonths) {
        principalPaid = 0;
        payment = interest;
      } else {
        principalPaid = Math.min(monthlyPrincipal, balance);
        payment = principalPaid + interest;
      }
      balance = Math.max(0, balance - principalPaid);
      rows.push({ month: i, principal: principalPaid, interest, payment, balance });
    }
    return rows;
  }

  function genScheduleGraduated(principal, annualRatePct, totalMonths, graceMonths, annualIncreasePct) {
    const r = annualRatePct / 100 / 12;
    const g = annualIncreasePct / 100;
    const repayMonths = totalMonths - graceMonths;
    if (repayMonths <= 0) return genScheduleEqualInstallment(principal, annualRatePct, totalMonths, graceMonths);

    function trialBalance(p0) {
      let bal = principal;
      for (let i = 1; i <= totalMonths; i++) {
        if (i > graceMonths) {
          const interest = bal * r;
          const yr = Math.floor((i - graceMonths - 1) / 12);
          const payment = p0 * Math.pow(1 + g, yr);
          bal -= Math.max(0, payment - interest);
        }
        if (bal < 0) return bal;
      }
      return bal;
    }

    const eiPmt = r > 0
      ? (principal * r * Math.pow(1 + r, repayMonths)) / (Math.pow(1 + r, repayMonths) - 1)
      : principal / repayMonths;
    let lo = 0, hi = eiPmt * 2;
    while (trialBalance(hi) > 0 && hi < principal) hi *= 2;
    for (let iter = 0; iter < 80; iter++) {
      const mid = (lo + hi) / 2;
      if (trialBalance(mid) > 0) lo = mid; else hi = mid;
    }
    const p0 = (lo + hi) / 2;

    const rows = [];
    let balance = principal;
    for (let i = 1; i <= totalMonths; i++) {
      const interest = balance * r;
      let principalPaid, payment;
      if (i <= graceMonths) {
        principalPaid = 0;
        payment = interest;
      } else {
        const yr = Math.floor((i - graceMonths - 1) / 12);
        payment = p0 * Math.pow(1 + g, yr);
        principalPaid = Math.min(balance, Math.max(0, payment - interest));
        if (balance <= principalPaid) payment = principalPaid + interest;
      }
      balance = Math.max(0, balance - principalPaid);
      rows.push({ month: i, principal: principalPaid, interest, payment, balance });
    }
    return rows;
  }

  function renderScheduleTable(rows, graceMonths) {
    let html = '<div class="schedule-wrap"><table class="schedule-table">';
    html += '<thead><tr><th>회차</th><th>납입원금</th><th>이자</th><th>월납입금</th><th>잔여원금</th></tr></thead><tbody>';
    for (const row of rows) {
      const cls = [];
      if (row.month <= graceMonths) cls.push("grace-row");
      if (row.month % 12 === 0) cls.push("year-end");
      html += `<tr${cls.length ? ` class="${cls.join(" ")}"` : ""}>`;
      html += `<td>${row.month}</td>`;
      html += `<td>${fmtNum(Math.round(row.principal))}</td>`;
      html += `<td>${fmtNum(Math.round(row.interest))}</td>`;
      html += `<td>${fmtNum(Math.round(row.payment))}</td>`;
      html += `<td>${fmtNum(Math.round(row.balance))}</td>`;
      html += "</tr>";
    }
    html += "</tbody></table></div>";
    return html;
  }

  function runSchedule(type) {
    if (!lastLoanParams) return;
    const { principal, annualRate, totalMonths, graceMonths } = lastLoanParams;
    let rows;
    if (type === "ep") {
      rows = genScheduleEqualPrincipal(principal, annualRate, totalMonths, graceMonths);
    } else if (type === "ei") {
      rows = genScheduleEqualInstallment(principal, annualRate, totalMonths, graceMonths);
    } else {
      const g = parseFloat($("graduated-rate")?.value || "2") || 2;
      rows = genScheduleGraduated(principal, annualRate, totalMonths, graceMonths, g);
    }
    ["ep", "ei", "gp"].forEach((t) => $(`sched-btn-${t}`)?.classList.toggle("active", t === type));
    $("graduated-opts")?.classList.toggle("hidden", type !== "gp");
    const wrap = $("schedule-wrap");
    if (wrap) wrap.innerHTML = renderScheduleTable(rows, graceMonths);
    $("schedule-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  $("btn-rate-calc")?.addEventListener("click", runRateCalc);
  $("btn-income-calc")?.addEventListener("click", runIncomeCalc);
  $("btn-calc")?.addEventListener("click", runCalc);
  $("sched-btn-ep")?.addEventListener("click", () => runSchedule("ep"));
  $("sched-btn-ei")?.addEventListener("click", () => runSchedule("ei"));
  $("sched-btn-gp")?.addEventListener("click", () => runSchedule("gp"));
  initDefaults();
  wireMoneyInputs();
  wireSalaryCalcModal();
  wireAnnualPreviews();
  updatePanels("self", document.querySelector('input[name="emp-self"]:checked')?.value || "A");
  updatePanels("spouse", document.querySelector('input[name="emp-spouse"]:checked')?.value || "A");
  window.PaperworkPrefill?.initFor("didimdol");
})();
