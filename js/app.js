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

  function wireMoneyInputs() {
    const moneyIds = [
      "self-a-2023",
      "self-a-2024",
      "self-b-sum",
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
      "other-amt",
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
      const end = prefix === "self" ? "self-b-end" : "sp-b-end";
      const sum = prefix === "self" ? "self-b-sum" : "sp-b-sum";
      const endVal = $(end)?.value || todayStr();
      return calcNewHire2025($(start)?.value, num($(sum)), endVal, true);
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
      return calcReturned($(leave)?.value, $(ret)?.value, y2, y1, "partial", 0, psum, endVal, hasProof);
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

  function getDidimdolBaseRate(income, termYears) {
    const rows = [
      { max: 20000000, rates: { 10: 2.85, 15: 2.95, 20: 3.05, 30: 3.1 } },
      { max: 40000000, rates: { 10: 3.2, 15: 3.3, 20: 3.4, 30: 3.45 } },
      { max: 70000000, rates: { 10: 3.55, 15: 3.65, 20: 3.75, 30: 3.8 } },
      { max: 85000000, rates: { 10: 3.9, 15: 4.0, 20: 4.1, 30: 4.15 } },
    ];
    const row = rows.find((r) => income <= r.max);
    return row ? row.rates[termYears] : null;
  }

  function getFirstHomeBaseRate(income, termYears) {
    const rows = [
      { max: 20000000, rates: { 10: 2.55, 15: 2.65, 20: 2.75, 30: 2.8 } },
      { max: 40000000, rates: { 10: 2.9, 15: 3.0, 20: 3.1, 30: 3.15 } },
      { max: 70000000, rates: { 10: 3.25, 15: 3.35, 20: 3.45, 30: 3.5 } },
      { max: 85000000, rates: { 10: 3.6, 15: 3.7, 20: 3.8, 30: 3.85 } },
    ];
    const row = rows.find((r) => income <= r.max);
    return row ? row.rates[termYears] : null;
  }

  function calcDidimdolLikeRate(opts) {
    let base = getDidimdolBaseRate(opts.income, opts.term);
    if (base == null) return { error: "소득 구간(8,500만원 이하) 및 대출기간을 확인해 주세요." };

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
    const row = brackets.find((b) => income <= b.max);
    return row ? row.rates[termYears] : null;
  }

  function getNewbornPostBaseRate(income, termYears, specialBase) {
    // 사진 기준: <=8.5천은 특례금리에 0.75 가산.
    // 그 외 구간은 화면 내 각주 기준의 참고 규칙으로 계산.
    if (income <= 85000000) return specialBase + 0.75;
    if (income <= 130000000) return Math.max(3.45, specialBase + 0.2);
    return specialBase + 0.2;
  }

  function runNewbornCalc() {
    const income = num($("nb-income"));
    const term = parseInt($("nb-term")?.value || "30", 10);
    const local = $("nb-local-home")?.checked;

    if (income <= 0) {
      alert("신생아 탭: 부부합산 연소득을 입력해 주세요.");
      return;
    }

    let specialBase = getNewbornSpecialBaseRate(income, term);
    if (specialBase == null) {
      alert("신생아 탭: 소득 구간이 표 범위를 벗어났습니다. (2억원 이하 기준)");
      return;
    }
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
    $("nb-base-post").textContent = `${postBase.toFixed(2)}%`;
    $("nb-final-post").textContent = `${postFinal.toFixed(2)}%`;
    $("nb-reason").textContent =
      `소득 ${fmtNum(income)}원, 만기 ${term}년 기준. 특례금리 우대는 최대 0.5%p까지만 적용했으며, 최저금리는 1.2%로 제한했습니다.`;

    $("nb-results").classList.remove("hidden");
    $("nb-results").scrollIntoView({ behavior: "smooth", block: "start" });
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
    if (base == null) {
      alert("생애최초·신혼가구 탭: 소득 구간(8,500만원 이하) 및 대출기간을 확인해 주세요.");
      return;
    }

    base += parseFloat($("fh-rate-type")?.value || "0") || 0;
    if ($("fh-local-home")?.checked) base -= 0.2;

    let discountRaw = 0;
    discountRaw += childDiscount;
    discountRaw += parseFloat($("fh-subsidy")?.value || "0") || 0;
    discountRaw += $("fh-electronic")?.checked ? 0.1 : 0;
    discountRaw += $("fh-newsale")?.checked ? 0.1 : 0;
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

  function runCalc() {
    const resSelf = calcPerson("self");
    if (resSelf.error) {
      alert(resSelf.error);
      return;
    }

    let incomeSpouse = 0;
    let resSpouse = null;
    if ($("has-spouse")?.checked) {
      resSpouse = calcPerson("spouse");
      if (resSpouse.error) {
        alert("배우자: " + resSpouse.error);
        return;
      }
      incomeSpouse = resSpouse.income;
    }

    const incomeSelf = resSelf.income;
    const incomeTotal = incomeSelf + incomeSpouse;
    syncHouseholdIncomeToRateTabs(incomeTotal);

    $("out-self").textContent = `${fmtNum(incomeSelf)}원`;
    $("out-spouse").textContent = $("has-spouse")?.checked ? `${fmtNum(incomeSpouse)}원` : "(미합산)";
    $("out-sum").textContent = `${fmtNum(incomeTotal)}원`;
    $("out-reason-self").textContent = "본인: " + resSelf.reason;
    const rsp = $("out-reason-spouse");
    if (resSpouse && $("has-spouse")?.checked) {
      rsp.classList.remove("hidden");
      rsp.textContent = "배우자: " + resSpouse.reason;
    } else {
      rsp.classList.add("hidden");
    }

    const didIncome = num($("did-income"));
    const didTerm = parseInt($("did-term")?.value || "30", 10);
    const childDiscount = parseFloat($("did-child-tier")?.value || "0") || 0;
    const result = calcDidimdolLikeRate({
      income: didIncome,
      term: didTerm,
      rateTypeAdd: parseFloat($("did-rate-type")?.value || "0") || 0,
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

    const finalRate = result.finalRate;
    $("out-discount").textContent = `−${result.applied.toFixed(2)}%p (원우대 ${result.discountRaw.toFixed(2)}%p)`;
    $("out-final-rate").textContent = `${finalRate.toFixed(2)}% (기본 ${result.base.toFixed(2)}%)`;

    const loanAmt = num($("loan-amt"));
    const loanYears = num($("loan-years")) || 30;
    const loanRateInput = num($("loan-rate"));
    const loanRateForCalc = loanRateInput > 0 ? loanRateInput : finalRate;
    const graceMonths = Math.max(0, parseInt($("grace-months")?.value || "0", 10) || 0);
    const totalMonths = loanYears * 12;
    const repayMonths = Math.max(1, totalMonths - graceMonths);
    const pmt = monthlyPMT(loanAmt, loanRateForCalc, repayMonths / 12);
    const piM = pmt * 12;

    const otherAmt = num($("other-amt"));
    const otherRate = num($("other-rate"));
    const intO = otherAmt * (otherRate / 100);
    const cap = parseFloat($("dti-cap")?.value || "60");

    const dti = incomeTotal > 0 ? ((piM + intO) / incomeTotal) * 100 : 0;

    $("out-dti").textContent = `${dti.toFixed(2)}%`;

    const judge = $("out-dti-judge");
    const ok = dti <= cap;
    judge.textContent = ok ? `기준 ${cap}% 이내` : `기준 ${cap}% 초과`;
    judge.className = ok ? "pill-ok" : "pill-bad";

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
    if ($("self-b-end")) $("self-b-end").value = t;
    if ($("self-d-end")) $("self-d-end").value = t;
    if ($("sp-b-end")) $("sp-b-end").value = t;
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
  });
  $("rate-tab-btn-newborn")?.addEventListener("click", () => {
    $("rate-tab-btn-newborn").classList.add("active");
    $("rate-tab-btn-didimdol").classList.remove("active");
    $("rate-tab-btn-firsthome").classList.remove("active");
    $("rate-tab-newborn").classList.remove("hidden");
    $("rate-tab-didimdol").classList.add("hidden");
    $("rate-tab-firsthome").classList.add("hidden");
  });
  $("rate-tab-btn-firsthome")?.addEventListener("click", () => {
    $("rate-tab-btn-firsthome").classList.add("active");
    $("rate-tab-btn-didimdol").classList.remove("active");
    $("rate-tab-btn-newborn").classList.remove("active");
    $("rate-tab-firsthome").classList.remove("hidden");
    $("rate-tab-didimdol").classList.add("hidden");
    $("rate-tab-newborn").classList.add("hidden");
  });

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

  $("btn-income-calc")?.addEventListener("click", runIncomeCalc);
  $("btn-calc")?.addEventListener("click", runCalc);
  $("sched-btn-ep")?.addEventListener("click", () => runSchedule("ep"));
  $("sched-btn-ei")?.addEventListener("click", () => runSchedule("ei"));
  $("sched-btn-gp")?.addEventListener("click", () => runSchedule("gp"));
  $("btn-nb-calc")?.addEventListener("click", runNewbornCalc);
  $("btn-fh-calc")?.addEventListener("click", runFirstHomeCalc);
  initDefaults();
  wireMoneyInputs();
  updatePanels("self", document.querySelector('input[name="emp-self"]:checked')?.value || "A");
  updatePanels("spouse", document.querySelector('input[name="emp-spouse"]:checked')?.value || "A");
})();
