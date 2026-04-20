(function () {
  const $ = (id) => document.getElementById(id);

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

  // —— 급여 더하기 모달 (디딤돌 페이지와 동일 UX) ——
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
      "sp-a-2023",
      "sp-a-2024",
      "sp-b-sum",
      "sp-c-old",
      "sp-c-new",
      "sp-d-y2",
      "sp-d-y1",
      "sp-d-p-sum",
      "bt-income",
      "bt-deposit",
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

  // —— 재직 유형 패널 전환 ——
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

  // —— 본인/배우자 소득 산출 (income.js 함수 사용) ——
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

  function runIncomeCalc() {
    const resSelf = calcPerson("self");
    if (resSelf.error) { alert(resSelf.error); return; }

    let incomeSpouse = 0;
    let resSpouse = null;
    if ($("has-spouse")?.checked) {
      resSpouse = calcPerson("spouse");
      if (resSpouse.error) { alert("배우자: " + resSpouse.error); return; }
      incomeSpouse = resSpouse.income;
    }

    const incomeTotal = resSelf.income + incomeSpouse;

    const btInc = $("bt-income");
    if (btInc) btInc.value = formatMoneyValue(String(Math.round(incomeTotal)));

    $("out-self").textContent = `${fmtNum(resSelf.income)}원`;
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

    $("income-results").classList.remove("hidden");
    $("income-results").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // —— 버팀목 금리표 ——
  const INCOME_BREAKS = [20000000, 40000000, 60000000, 75000000];

  function incomeTier(income) {
    for (let i = 0; i < INCOME_BREAKS.length; i++) {
      if (income <= INCOME_BREAKS[i]) return i;
    }
    return INCOME_BREAKS.length;
  }

  const GENERAL_TABLE = [
    [2.5, 2.6, 2.7],
    [2.7, 2.8, 2.9],
    [3.0, 3.1, 3.2],
    [3.3, 3.4, 3.5],
  ];
  // 각 구간의 상한(원). 마지막은 Infinity
  const GENERAL_DEPOSITS = [
    { label: "5천만원 이하", max: 50000000 },
    { label: "1억원 이하", max: 100000000 },
    { label: "1억원 초과", max: Infinity },
  ];

  const NEWLYWED_TABLE = [
    [1.9, 2.0, 2.1, 2.2],
    [2.2, 2.3, 2.4, 2.5],
    [2.6, 2.7, 2.8, 2.9],
    [3.0, 3.1, 3.2, 3.3],
  ];
  const NEWLYWED_DEPOSITS = [
    { label: "5천만원 이하", max: 50000000 },
    { label: "1억원 이하", max: 100000000 },
    { label: "1.5억원 이하", max: 150000000 },
    { label: "1.5억원 초과", max: Infinity },
  ];

  const YOUTH_TABLE = [[2.2], [2.5], [2.9], [3.3]];
  // 청년 전용: 보증금 구간이 하나(3억원 이하) — 3억 초과 시 안내용 경고만 표시
  const YOUTH_DEPOSITS = [{ label: "3억원 이하(보증금 무관 동일 금리)", max: 300000000 }];

  const PRODUCTS = {
    general: {
      title: "일반 버팀목",
      deposits: GENERAL_DEPOSITS,
      table: GENERAL_TABLE,
      depositHint: "5천만 이하 / 1억 이하 / 1억 초과 3개 구간에서 보증금에 맞는 구간이 자동 선택됩니다.",
      maxSoftLimit: Infinity,
    },
    newlywed: {
      title: "신혼가구 버팀목",
      deposits: NEWLYWED_DEPOSITS,
      table: NEWLYWED_TABLE,
      depositHint: "5천만 / 1억 / 1.5억 / 1.5억 초과 4개 구간에서 자동 선택됩니다.",
      maxSoftLimit: Infinity,
    },
    youth: {
      title: "청년 전용 버팀목",
      deposits: YOUTH_DEPOSITS,
      table: YOUTH_TABLE,
      depositHint: "",
      maxSoftLimit: 300000000,
    },
  };

  function depositTierIndex(tab, deposit) {
    const deposits = PRODUCTS[tab].deposits;
    // 청년: 단일 구간 고정
    if (tab === "youth") return 0;
    for (let i = 0; i < deposits.length; i++) {
      if (deposit <= deposits[i].max) return i;
    }
    return deposits.length - 1;
  }

  function getActiveTab() {
    const btn = document.querySelector(".bt-tab-btn.active");
    return btn?.dataset?.tab || "general";
  }

  function applyTabUI(tab) {
    document.querySelectorAll(".bt-tab-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === tab);
    });

    const cfg = PRODUCTS[tab];
    $("bt-deposit-hint").textContent = cfg.depositHint;

    document.querySelectorAll("#bt-group1 .radio-pill").forEach((pill) => {
      const allow = pill.dataset.tab;
      if (!allow) {
        pill.classList.remove("hidden");
        return;
      }
      const tabs = allow.split(",").map((s) => s.trim());
      const visible = tabs.includes(tab);
      pill.classList.toggle("hidden", !visible);
      if (!visible) {
        const input = pill.querySelector("input[type=radio]");
        if (input && input.checked) {
          const def = document.querySelector('input[name="bt-g1"][value="0"]');
          if (def) def.checked = true;
        }
      }
    });

    document.querySelectorAll(".bt-youth-only").forEach((el) => {
      el.classList.toggle("hidden", tab !== "youth");
      if (tab !== "youth") {
        const c = el.querySelector('input[type="checkbox"]');
        if (c) c.checked = false;
      }
    });
  }

  function getCap(tab, g1Kind) {
    if (g1Kind === "basic") return 1.0;
    if (g1Kind === "child3") return 0.7;
    return 0.5;
  }

  // —— 예상 필요서류 렌더링 ——
  function incomeDocForType(type) {
    if (type === "A") {
      return "근로소득원천징수영수증 (전년도) — 4대보험 근로자";
    }
    if (type === "B") {
      return "갑종근로소득원천징수영수증 (입사일 ~ 현재) — 전년도 또는 금년 입사자";
    }
    if (type === "C") {
      return "근로소득원천징수영수증 (휴직 직전 2개년) — 휴직자";
    }
    if (type === "D") {
      return "근로소득원천징수영수증 (휴직 직전 2개년) + 복직 후 갑종근로소득원천징수영수증 — 복직자";
    }
    return "근로소득원천징수영수증 (전년도)";
  }

  function buildCommonDocs(selfType, spouseType, hasSpouse) {
    const list = [];
    list.push("확정일자부 전세계약서 <span class=\"muted\">(필요시 임대차계약 신고필증)</span>");
    list.push("주민등록등본 <span class=\"muted\">(최근 1개월 이내)</span>");
    list.push("가족관계증명서");

    const incomeDocs = [];
    incomeDocs.push(`본인: ${incomeDocForType(selfType)}`);
    if (hasSpouse) incomeDocs.push(`배우자: ${incomeDocForType(spouseType)}`);
    incomeDocs.push(
      "<span class=\"muted\">사업자인 경우 소득금액증명원 (전년도 기준, 7월 이전에는 전전년도 소득금액증명원 제출)</span>"
    );
    list.push(
      "소득확인서류" +
        "<ul class=\"doc-sublist\">" +
        incomeDocs.map((d) => `<li>${d}</li>`).join("") +
        "</ul>"
    );

    list.push("재직증명서 <span class=\"muted\">(사업자의 경우 사업자등록증)</span>");
    list.push("4대보험 가입확인서 <span class=\"muted\">(정부24에서 발급)</span>");
    list.push("건강보험자격득실확인서");
    list.push("건강보험납부내역서 <span class=\"muted\">(최근 6개월)</span>");
    return list;
  }

  function buildPreferentialDocs(g1Val, g1Kind) {
    const list = [];
    if (g1Kind === "basic") {
      list.push("수급자증명서 / 차상위계층확인서 / 한부모가족 증명서 <span class=\"muted\">(해당 자격 1종)</span>");
    }
    if (g1Kind === "child3") {
      list.push("자녀수 확인 — 가족관계증명서 <span class=\"muted\">(공통 기본서류에 포함)</span>");
    }
    if (!g1Kind && g1Val === 0.5) {
      list.push("자녀수 확인(2자녀) — 가족관계증명서 <span class=\"muted\">(공통 기본서류에 포함)</span>");
    }
    if (!g1Kind && g1Val === 0.3) {
      list.push("자녀수 확인(1자녀) — 가족관계증명서 <span class=\"muted\">(공통 기본서류에 포함)</span>");
    }
    if (!g1Kind && g1Val === 0.2) {
      list.push(
        "해당 자격 증빙 1종 — 장애인증명서 / 노인부양 관계 확인(주민등록등본) / 다문화가구 확인서류(혼인관계증명서 등) / 고령자 연령 확인(주민등록등본)"
      );
    }
    return list;
  }

  function renderDocs({ tab, selfType, spouseType, hasSpouse, g1Val, g1Kind, smbYouth }) {
    const wrap = $("bt-docs-results");
    if (!wrap) return;

    const summaryParts = [];
    if (tab === "general") summaryParts.push("일반 버팀목");
    if (tab === "newlywed") summaryParts.push("신혼가구 버팀목");
    if (tab === "youth") summaryParts.push("청년 전용 버팀목");
    if (tab === "youth" && smbYouth) summaryParts.push("중소기업 취업·창업 청년 우대");
    if (hasSpouse) summaryParts.push("부부합산");

    const summaryEl = $("bt-docs-summary");
    if (summaryEl) {
      summaryEl.textContent = `${summaryParts.join(" · ")} 기준으로 필요한 서류를 정리했습니다.`;
    }

    const commonUl = $("bt-docs-common");
    if (commonUl) {
      commonUl.innerHTML = buildCommonDocs(selfType, spouseType, hasSpouse)
        .map((d) => `<li>${d}</li>`)
        .join("");
    }

    const extraWrap = $("bt-docs-extra-wrap");
    const extraTitle = $("bt-docs-extra-title");
    const extraUl = $("bt-docs-extra");
    const extra = [];
    if (tab === "newlywed") {
      if (extraTitle) extraTitle.textContent = "신혼가구 추가 서류";
      extra.push("혼인관계증명서");
    }
    if (tab === "youth") {
      if (extraTitle) {
        extraTitle.textContent = smbYouth
          ? "중소기업 취업·창업 청년 추가 서류"
          : "중소기업 취업·창업 청년 우대 신청 시 추가 서류 (해당 시)";
      }
      extra.push("사업자등록증");
      extra.push("고용보험자격이력내역서 <span class=\"muted\">(근로자용)</span>");
      extra.push("주업종코드확인서");
      extra.push("병적증명서 <span class=\"muted\">(필요시)</span>");
    }
    if (extra.length > 0) {
      extraWrap?.classList.remove("hidden");
      if (extraUl) extraUl.innerHTML = extra.map((d) => `<li>${d}</li>`).join("");
    } else {
      extraWrap?.classList.add("hidden");
      if (extraUl) extraUl.innerHTML = "";
    }

    const prefWrap = $("bt-docs-pref-wrap");
    const prefUl = $("bt-docs-pref");
    const pref = buildPreferentialDocs(g1Val, g1Kind);
    if (pref.length > 0) {
      prefWrap?.classList.remove("hidden");
      if (prefUl) prefUl.innerHTML = pref.map((d) => `<li>${d}</li>`).join("");
    } else {
      prefWrap?.classList.add("hidden");
      if (prefUl) prefUl.innerHTML = "";
    }

    wrap.classList.remove("hidden");
  }

  function runCalc() {
    let income = num($("bt-income"));

    if (income <= 0) {
      const resSelf = calcPerson("self");
      if (!resSelf.error) {
        let sp = 0;
        if ($("has-spouse")?.checked) {
          const r = calcPerson("spouse");
          if (r.error) { alert("배우자: " + r.error); return; }
          sp = r.income;
        }
        income = resSelf.income + sp;
        const btInc = $("bt-income");
        if (btInc) btInc.value = formatMoneyValue(String(Math.round(income)));
      }
    }

    if (income <= 0) {
      alert("부부합산 연소득을 입력하거나, 1·2번에서 「소득 계산」을 먼저 실행해 주세요.");
      return;
    }

    const tab = getActiveTab();
    const cfg = PRODUCTS[tab];

    const tier = incomeTier(income);
    if (tier >= cfg.table.length) {
      alert(
        "부부합산 연소득이 7,500만원을 초과합니다. 버팀목 전세자금 대출 소득 요건 한도(7,500만원)를 초과하는 경우 일반 기준으로는 신청 대상이 아닙니다."
      );
      return;
    }

    const deposit = num($("bt-deposit"));
    if (deposit <= 0) {
      alert("전세보증금(원)을 입력해 주세요.");
      return;
    }
    if (cfg.maxSoftLimit !== Infinity && deposit > cfg.maxSoftLimit) {
      if (
        !confirm(
          `청년 전용 버팀목의 상품 한도(3억원)를 초과합니다. 참고용으로 계산을 진행할까요? (실제 신청은 상품 한도 초과 시 불가)`
        )
      ) {
        return;
      }
    }

    const depositIdx = depositTierIndex(tab, deposit);
    const depositLabel = cfg.deposits[depositIdx]?.label || "—";

    let base = cfg.table[tier][depositIdx];

    const isLocal = $("bt-local-home")?.checked;
    if (isLocal) base -= 0.2;

    const isCredit = $("bt-credit-loan")?.checked;
    const surcharge = isCredit ? 1.0 : 0;

    const g1El = document.querySelector('input[name="bt-g1"]:checked');
    const g1Val = parseFloat(g1El?.value || "0") || 0;
    const g1Kind = g1El?.dataset?.kind || "";

    let g2Raw = 0;
    document.querySelectorAll(".check-item input[type=checkbox][data-rate]").forEach((c) => {
      if (c.checked && !c.closest(".hidden")) {
        g2Raw += parseFloat(c.getAttribute("data-rate") || "0") || 0;
      }
    });

    const discountRaw = g1Val + g2Raw;
    const cap = getCap(tab, g1Kind);
    const applied = Math.min(discountRaw, cap);

    const beforeFloor = base + surcharge - applied;
    const FLOOR = 1.0;
    const finalRate = Math.max(FLOOR, beforeFloor);
    const floored = beforeFloor < FLOOR;

    $("bt-out-product").textContent = cfg.title;
    $("bt-out-income").textContent = `${fmtNum(income)}원`;
    $("bt-out-deposit-amount").textContent = `${fmtNum(deposit)}원`;
    $("bt-out-deposit").textContent = depositLabel;
    $("bt-out-base").textContent =
      `${base.toFixed(2)}%${isLocal ? " (지방 −0.2%p 적용)" : ""}`;
    $("bt-out-surcharge").textContent = isCredit ? "+1.00%p (전세자금 신용대출)" : "없음";
    $("bt-out-discount").textContent =
      `-${applied.toFixed(2)}%p (원우대 ${discountRaw.toFixed(2)}%p / 상한 ${cap.toFixed(1)}%p)`;
    $("bt-out-final").textContent = `${finalRate.toFixed(2)}%`;

    const reasons = [];
    reasons.push(`소득 ${fmtNum(income)}원 · ${cfg.title} · 임차보증금 구간: ${depositLabel} 기준.`);
    if (isLocal) reasons.push("지방 소재 주택으로 기본금리 −0.2%p 인하.");
    if (isCredit) reasons.push("전세자금 신용대출 가산 +1.00%p 반영.");
    if (discountRaw > cap) {
      reasons.push(`원우대 합계 ${discountRaw.toFixed(2)}%p가 상한 ${cap.toFixed(1)}%p를 초과하여 상한까지만 적용.`);
    } else if (applied > 0) {
      reasons.push(`1군·2군 우대 합계 ${applied.toFixed(2)}%p 적용(상한 ${cap.toFixed(1)}%p 이내).`);
    } else {
      reasons.push("선택된 금리우대 항목이 없습니다.");
    }
    if (floored) reasons.push("우대 적용 후 최종금리가 1.0% 미만이어서 1.0%로 하한 처리.");
    reasons.push("채권양도 협약기관 채권양도방식은 동일하게 적용되며, 노후고시원 이주 세대주 등 별도 고시금리는 반영하지 않았습니다.");

    $("bt-out-reason").textContent = reasons.join(" ");

    $("bt-results").classList.remove("hidden");

    const selfType = document.querySelector('input[name="emp-self"]:checked')?.value || "A";
    const spouseType = document.querySelector('input[name="emp-spouse"]:checked')?.value || "A";
    const hasSpouse = !!$("has-spouse")?.checked;
    const smbYouth = tab === "youth" && !!$("bt-smb-youth")?.checked;
    renderDocs({ tab, selfType, spouseType, hasSpouse, g1Val, g1Kind, smbYouth });

    $("bt-results").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // —— 이벤트 바인딩 ——
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

  document.querySelectorAll(".bt-tab-btn").forEach((b) => {
    b.addEventListener("click", () => applyTabUI(b.dataset.tab));
  });

  $("btn-income-calc")?.addEventListener("click", runIncomeCalc);
  $("bt-btn-calc")?.addEventListener("click", runCalc);

  initDefaults();
  wireMoneyInputs();
  wireSalaryCalcModal();
  wireAnnualPreviews();
  updatePanels("self", document.querySelector('input[name="emp-self"]:checked')?.value || "A");
  updatePanels("spouse", document.querySelector('input[name="emp-spouse"]:checked')?.value || "A");
  applyTabUI("general");
})();
