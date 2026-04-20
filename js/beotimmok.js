(function () {
  const $ = (id) => document.getElementById(id);

  function num(el) {
    if (!el) return 0;
    const raw = String(el.value || "").replace(/,/g, "").trim();
    const v = parseFloat(raw);
    return Number.isFinite(v) ? v : 0;
  }

  function fmt(n) {
    return Math.round(n).toLocaleString("ko-KR");
  }

  function formatMoney(value) {
    const digits = String(value || "").replace(/[^\d]/g, "");
    if (!digits) return "";
    return Number(digits).toLocaleString("ko-KR");
  }

  function wireMoneyInputs(ids) {
    ids.forEach((id) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener("input", () => {
        el.value = formatMoney(el.value);
      });
      if (el.value) el.value = formatMoney(el.value);
    });
  }

  /**
   * 기본금리 정의
   * - income: 부부합산 연소득(원)
   * - depositIdx: 임차보증금 구간 인덱스 (0부터)
   *
   * 소득 구간 경계(원): 2천만, 4천만, 6천만, 7.5천만
   */
  const INCOME_BREAKS = [20000000, 40000000, 60000000, 75000000];

  function incomeTier(income) {
    for (let i = 0; i < INCOME_BREAKS.length; i++) {
      if (income <= INCOME_BREAKS[i]) return i;
    }
    return INCOME_BREAKS.length; // 초과
  }

  // 일반 버팀목 (이미지 1 기준): 5천만 이하 / 1억 이하 / 1억 초과
  const GENERAL_TABLE = [
    // [deposit<=5천, deposit<=1억, deposit>1억]
    [2.5, 2.6, 2.7], // 2천만 이하
    [2.7, 2.8, 2.9], // 4천만 이하
    [3.0, 3.1, 3.2], // 6천만 이하
    [3.3, 3.4, 3.5], // 7.5천만 이하
  ];
  const GENERAL_DEPOSITS = [
    { label: "5천만원 이하", key: "5k" },
    { label: "1억원 이하", key: "1e" },
    { label: "1억원 초과", key: "1eo" },
  ];

  // 신혼가구 (이미지 4 기준, 541-0158, 2025.08.24): 5천만/1억/1.5억/1.5억 초과
  const NEWLYWED_TABLE = [
    [1.9, 2.0, 2.1, 2.2],
    [2.2, 2.3, 2.4, 2.5],
    [2.6, 2.7, 2.8, 2.9],
    [3.0, 3.1, 3.2, 3.3],
  ];
  const NEWLYWED_DEPOSITS = [
    { label: "5천만원 이하", key: "5k" },
    { label: "1억원 이하", key: "1e" },
    { label: "1.5억원 이하", key: "15e" },
    { label: "1.5억원 초과", key: "15eo" },
  ];

  // 청년 전용 (이미지 5 기준, 541-0158, 2025.03.24): 3억 이하 단일 구간
  // 소득 구간: 2천만 이하 2.2, 2천~4천 2.5, 4천~6천 2.9, 6천~7.5천 3.3
  const YOUTH_TABLE = [
    [2.2],
    [2.5],
    [2.9],
    [3.3],
  ];
  const YOUTH_DEPOSITS = [{ label: "3억원 이하", key: "3e" }];

  const PRODUCTS = {
    general: {
      title: "일반 버팀목",
      deposits: GENERAL_DEPOSITS,
      table: GENERAL_TABLE,
      depositHint: "일반 버팀목 최대 임차보증금 기준으로 구간을 선택하세요.",
    },
    newlywed: {
      title: "신혼가구 버팀목",
      deposits: NEWLYWED_DEPOSITS,
      table: NEWLYWED_TABLE,
      depositHint: "신혼가구 전용은 1.5억원 초과 구간까지 금리표가 정의되어 있습니다.",
    },
    youth: {
      title: "청년 전용 버팀목",
      deposits: YOUTH_DEPOSITS,
      table: YOUTH_TABLE,
      depositHint: "청년 전용 버팀목은 3억원 이하 단일 구간입니다.",
    },
  };

  function getActiveTab() {
    const btn = document.querySelector(".bt-tab-btn.active");
    return btn?.dataset?.tab || "general";
  }

  function applyTabUI(tab) {
    document.querySelectorAll(".bt-tab-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === tab);
    });

    const cfg = PRODUCTS[tab];
    const sel = $("bt-deposit-tier");
    sel.innerHTML = "";
    cfg.deposits.forEach((d, i) => {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = d.label;
      sel.appendChild(opt);
    });
    $("bt-deposit-hint").textContent = cfg.depositHint;

    // 1군 라디오: 신혼가구 탭에서는 기초생활·한부모·장애인·노인·다문화·고령자 항목 숨김
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

    // 2군: 청년 탭에서만 중소기업·청년가구 표시
    document.querySelectorAll(".bt-youth-only").forEach((el) => {
      el.classList.toggle("hidden", tab !== "youth");
      if (tab !== "youth") {
        const c = el.querySelector('input[type="checkbox"]');
        if (c) c.checked = false;
      }
    });
  }

  function updateIncomePreview() {
    const self = num($("bt-self-income"));
    const hasSp = $("bt-has-spouse")?.checked;
    const sp = hasSp ? num($("bt-spouse-income")) : 0;
    const total = self + sp;
    const out = $("bt-income-preview");
    if (!out) return;
    if (total <= 0) {
      out.textContent = "";
      return;
    }
    out.textContent = `부부합산 연소득: ${fmt(total)}원`;
  }

  function getCap(tab, g1Kind) {
    // 우대 상한
    // - 기초생활수급자·차상위·한부모(1군의 basic): 1.0%
    // - 다자녀가구(1군의 child3): 0.7%
    // - 그 외: 0.5%
    if (g1Kind === "basic") return 1.0;
    if (g1Kind === "child3") return 0.7;
    return 0.5;
  }

  function runCalc() {
    const selfInc = num($("bt-self-income"));
    const hasSp = $("bt-has-spouse")?.checked;
    const spInc = hasSp ? num($("bt-spouse-income")) : 0;
    const income = selfInc + spInc;

    if (income <= 0) {
      alert("본인(및 배우자) 연소득을 입력해 주세요.");
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

    const depositIdx = parseInt($("bt-deposit-tier")?.value || "0", 10) || 0;
    const depositLabel = cfg.deposits[depositIdx]?.label || "—";

    // 기본금리
    let base = cfg.table[tier][depositIdx];

    // 지방 소재 인하
    const isLocal = $("bt-local-home")?.checked;
    if (isLocal) base -= 0.2;

    // 신용대출 가산
    const isCredit = $("bt-credit-loan")?.checked;
    const surcharge = isCredit ? 1.0 : 0;

    // 그룹1 (중복불가, 택1)
    const g1El = document.querySelector('input[name="bt-g1"]:checked');
    const g1Val = parseFloat(g1El?.value || "0") || 0;
    const g1Kind = g1El?.dataset?.kind || "";

    // 그룹2 (중복 가능)
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
    $("bt-out-income").textContent = `${fmt(income)}원${hasSp ? " (본인+배우자 합산)" : ""}`;
    $("bt-out-deposit").textContent = depositLabel;
    $("bt-out-base").textContent =
      `${base.toFixed(2)}%${isLocal ? " (지방 −0.2%p 적용)" : ""}`;
    $("bt-out-surcharge").textContent = isCredit ? "+1.00%p (전세자금 신용대출)" : "없음";
    $("bt-out-discount").textContent =
      `-${applied.toFixed(2)}%p (원우대 ${discountRaw.toFixed(2)}%p / 상한 ${cap.toFixed(1)}%p)`;
    $("bt-out-final").textContent = `${finalRate.toFixed(2)}%`;

    const reasons = [];
    reasons.push(`소득 ${fmt(income)}원 · ${cfg.title} · 임차보증금 구간: ${depositLabel} 기준.`);
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
    $("bt-results").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // 이벤트 바인딩
  wireMoneyInputs(["bt-self-income", "bt-spouse-income"]);

  $("bt-has-spouse")?.addEventListener("change", () => {
    const w = $("bt-spouse-wrap");
    const on = $("bt-has-spouse").checked;
    w?.classList.toggle("hidden", !on);
    if (!on) {
      const sp = $("bt-spouse-income");
      if (sp) sp.value = "";
    }
    updateIncomePreview();
  });
  ["bt-self-income", "bt-spouse-income"].forEach((id) => {
    $(id)?.addEventListener("input", updateIncomePreview);
  });

  document.querySelectorAll(".bt-tab-btn").forEach((b) => {
    b.addEventListener("click", () => applyTabUI(b.dataset.tab));
  });

  $("bt-btn-calc")?.addEventListener("click", runCalc);

  // 초기화
  applyTabUI("general");
})();
