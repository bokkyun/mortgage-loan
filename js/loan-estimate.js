/**
 * 대화형 입력 → 인정소득·디딤돌 금리·DTI·DSR·서류안내 (클라이언트)
 * 실제 심사는 금융기관·HUG 기준을 따릅니다.
 */

/** 일반 재직자 기준 최근 2개년 (접수 시점: 2026년 → 2024·2025) */
export const DEFAULT_INCOME_YEARS = { older: 2024, newer: 2025 };

/** 상담 체크리스트 상단 상품 */
export const LOAN_PRODUCTS = [
  { id: "didimdol", label: "디딤돌", short: "디딤돌", calcHref: "../didimdol/?from=paperwork" },
  { id: "beotimmok", label: "버팀목", short: "버팀목", calcHref: "../beotimmok/?from=paperwork" },
  { id: "mortgage", label: "주택담보대출", short: "주담대", calcHref: "../dsr/?from=paperwork" },
  {
    id: "returnGuarantee",
    label: "반환보증보험",
    short: "반환보증",
    calcHref: "../return-guarantee/",
  },
  {
    id: "fee",
    label: "수수료",
    short: "수수료",
    calcHref: "../return-guarantee/",
  },
];

export function getLoanProduct(id) {
  return LOAN_PRODUCTS.find((p) => p.id === id) || LOAN_PRODUCTS[0];
}

function parseDate(str) {
  if (!str) return null;
  const s = String(str).trim().replace(/\./g, "-").replace(/\//g, "-");
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

function variationRate(older, newer) {
  const base = Math.abs(older) < 1 ? 1 : older;
  return (Math.abs(newer - older) / base) * 100;
}

function paymentCountToSubsidy(count) {
  const n = Number(count);
  if (!Number.isFinite(n) || n < 60) return { discount: 0, label: "우대 해당 없음 (60회차 미만)" };
  if (n >= 180) return { discount: 0.5, label: "15년 (180회차) −0.5%p" };
  if (n >= 120) return { discount: 0.4, label: "10년 (120회차) −0.4%p" };
  return { discount: 0.3, label: "5년 (60회차) −0.3%p" };
}

function asPositive(n) {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

/** legacy incomeYear2023/2024/2025 필드를 incomeByYear로 합침 */
export function normalizeIncomeByYear(slots) {
  const map = { ...(slots?.incomeByYear || {}) };
  for (const [k, v] of Object.entries(map)) {
    const y = Number(k);
    const amt = asPositive(v);
    if (Number.isFinite(y) && amt) map[y] = amt;
    else delete map[k];
  }
  const legacy = [
    ["incomeYear2023", 2023],
    ["incomeYear2024", 2024],
    ["incomeYear2025", 2025],
  ];
  for (const [key, year] of legacy) {
    const amt = asPositive(slots?.[key]);
    if (amt) map[year] = amt;
  }
  return map;
}

export function setIncomeYear(slots, year, amount) {
  const y = Number(year);
  const amt = asPositive(amount);
  if (!Number.isFinite(y) || !amt) return slots;
  const incomeByYear = { ...normalizeIncomeByYear(slots), [y]: amt };
  return {
    ...slots,
    incomeByYear,
    [`incomeYear${y}`]: amt,
  };
}

/**
 * 재직 유형·휴직일에 따라 필요한 소득 연도 쌍
 * 휴직/복직(휴직자 기준): 휴직연도-2, 휴직연도-1
 * 일반: 2024·2025
 */
export function requiredIncomeYears(slots) {
  const status = inferEmploymentStatus(slots);
  if (status === "휴직" || status === "복직") {
    const leave = parseDate(slots.leaveStartDate);
    if (leave) {
      const leaveYear = leave.getFullYear();
      return {
        older: leaveYear - 2,
        newer: leaveYear - 1,
        basis: "leave",
        leaveYear,
        status,
      };
    }
  }
  return {
    older: DEFAULT_INCOME_YEARS.older,
    newer: DEFAULT_INCOME_YEARS.newer,
    basis: "general",
    leaveYear: null,
    status: status || "1년이상재직",
  };
}

function monthsBetween(a, b) {
  if (!a || !b) return 0;
  return (b.getTime() - a.getTime()) / (86400000 * 30);
}

/**
 * 휴직기간·복직 여부에 따라 준비할 소득 서류 안내
 */
export function getIncomeDocumentGuide(slots = {}) {
  const status = inferEmploymentStatus(slots);
  const leave = parseDate(slots.leaveStartDate);
  const ret = parseDate(slots.leaveEndDate);
  const hire = parseDate(slots.employmentStartDate);
  const incomeMap = normalizeIncomeByYear(slots);
  const yearsInfo = requiredIncomeYears(slots);
  const { older, newer } = yearsInfo;

  const docsCommon = [
    "재직증명서(휴직·복직 기간 기재 권장)",
    "건강보험 자격득실 확인서",
  ];

  // ——— 휴직 중 ———
  if (status === "휴직" && leave) {
    const leaveYear = leave.getFullYear();
    const haveOlder = asPositive(incomeMap[older]);
    const haveNewer = asPositive(incomeMap[newer]);
    return {
      status: "휴직",
      title: "휴직자 — 준비할 소득 서류",
      years: [older, newer],
      yearLabels: [`${older}년(전전연도)`, `${newer}년(전연도)`],
      summary: `휴직 시작이 ${leaveYear}년이므로, 휴직 직전 2개년인 ${older}년·${newer}년 소득 서류가 필요합니다. (일반 접수용 2024·2025가 아닙니다.)`,
      documents: [
        `${older}년 원천징수영수증 또는 소득금액증명원`,
        `${newer}년 원천징수영수증 또는 소득금액증명원`,
        "휴직 확인이 가능한 재직증명서(휴직 시작일 기재)",
        ...docsCommon,
      ],
      notes: [
        `휴직일 기준 전전연도=${older}년, 전연도=${newer}년`,
        "변동률 20% 초과 시 2개년 평균, 20% 이하(또는 상시소득 입증) 시 전연도 소득 적용",
        "휴직 기간 중의 소득은 보통 인정소득에 쓰지 않습니다",
      ],
      filled: {
        [older]: !!haveOlder,
        [newer]: !!haveNewer,
      },
      nextHint:
        !haveOlder || !haveNewer
          ? `대화창에 「${older}년 ○○만원, ${newer}년 ○○만원」처럼 입력해 주세요.`
          : "필요 연도 소득이 입력되었습니다. 계산 결과를 확인해 주세요.",
    };
  }

  // ——— 복직 ———
  if (status === "복직" && leave && ret) {
    const leaveYear = leave.getFullYear();
    const monthsAfter = monthsBetween(ret, new Date());
    const asLeave = monthsAfter < 3;
    const haveOlder = asPositive(incomeMap[older]);
    const haveNewer = asPositive(incomeMap[newer]);

    if (asLeave) {
      return {
        status: "복직",
        title: "복직자(복직 후 3개월 미만) — 휴직자 기준 서류",
        years: [older, newer],
        yearLabels: [`${older}년`, `${newer}년`],
        summary: `복직 후 약 ${monthsAfter.toFixed(1)}개월로 3개월 미만입니다. 휴직자 기준을 적용하므로 휴직(${leaveYear}년) 직전 ${older}·${newer}년 소득 서류가 필요합니다.`,
        documents: [
          `${older}년 원천징수영수증 또는 소득금액증명원`,
          `${newer}년 원천징수영수증 또는 소득금액증명원`,
          "휴직·복직일이 적힌 재직증명서",
          ...docsCommon,
        ],
        notes: [
          "복직 후 3개월이 지나면 복직 후 급여 연환산(또는 최근 소득) 기준으로 바뀔 수 있습니다",
          `휴직 시작 ${slots.leaveStartDate} → 복직 ${slots.leaveEndDate}`,
        ],
        filled: { [older]: !!haveOlder, [newer]: !!haveNewer },
        nextHint:
          !haveOlder || !haveNewer
            ? `「${older}년·${newer}년」소득을 입력해 주세요.`
            : "휴직자 기준 소득 입력이 준비되었습니다.",
      };
    }

    return {
      status: "복직",
      title: "복직자(복직 후 3개월 이상) — 준비 서류",
      years: [older, newer],
      yearLabels: [`휴직 직전 ${older}년`, `휴직 직전 ${newer}년`],
      summary: `복직 후 3개월 이상입니다. 복직 후 급여(합계÷개월×12)가 기본이며, 복직 후 소득이 부족하면 휴직 직전 ${older}·${newer}년 서류를 씁니다.`,
      documents: [
        "복직 후 급여명세·갑종원천징수 등 (연환산용)",
        `${older}년·${newer}년 소득 서류(휴직 직전, 비교·보완용)`,
        "휴직·복직일이 적힌 재직증명서",
        ...docsCommon,
      ],
      notes: [
        "복직 후 1년 이하 소득만 있으면 연환산 후 10% 차감(상시소득 입증 시 예외)될 수 있습니다",
        `휴직 ${slots.leaveStartDate} ~ 복직 ${slots.leaveEndDate}`,
      ],
      filled: { [older]: !!haveOlder, [newer]: !!haveNewer },
      nextHint:
        "복직 후 수령 합계·개월 수, 또는 휴직 직전 2개년 소득을 입력해 주세요.",
    };
  }

  // ——— 신규 입사 ———
  if (status === "1년미만재직") {
    return {
      status: "1년미만재직",
      title: "1년 미만 재직 — 준비 서류",
      years: [],
      yearLabels: [],
      summary: "입사 후 1년 미만이면 2개년 서류 대신, 수령 소득 합계와 개월 수로 연환산합니다.",
      documents: [
        "재직증명서(입사일)",
        "갑종근로소득원천징수영수증 또는 급여명세(수령 기간)",
        ...docsCommon,
      ],
      notes: [
        "연환산 = (수령 합계 ÷ 개월 수) × 12",
        "상시소득 입증이 없으면 연환산 후 10% 차감될 수 있습니다",
        hire ? `입사일: ${slots.employmentStartDate}` : "입사일을 알려 주시면 더 정확히 안내합니다",
      ],
      filled: {},
      nextHint: "「수령 합계 ○○원, ○개월」처럼 입력해 주세요.",
    };
  }

  // ——— 일반 (휴직 없음) ———
  const yOld = DEFAULT_INCOME_YEARS.older;
  const yNew = DEFAULT_INCOME_YEARS.newer;
  const haveOld = asPositive(incomeMap[yOld]);
  const haveNew = asPositive(incomeMap[yNew]);

  // 휴직일만 있고 상태가 애매할 때
  if (leave && !status) {
    return getIncomeDocumentGuide({ ...slots, employmentStatus: "휴직" });
  }

  return {
    status: status || "1년이상재직",
    title: "일반 재직 — 준비할 소득 서류",
    years: [yOld, yNew],
    yearLabels: [`${yOld}년(전전연도)`, `${yNew}년(전연도)`],
    summary: `현재 접수 기준으로 ${yOld}년·${yNew}년 소득 서류 2개년이 필요합니다.`,
    documents: [
      `${yOld}년 원천징수영수증 또는 소득금액증명원`,
      `${yNew}년 원천징수영수증 또는 소득금액증명원`,
      ...docsCommon,
    ],
    notes: [
      "변동률 20% 이하 → 최근연도(2025) 적용 / 20% 초과 → 2개년 평균",
      "상시소득 입증(재직·건보 등) 시 최근연도 적용 가능",
      "휴직이 있으면 휴직 시작일을 알려 주세요. 필요 연도가 바뀝니다.",
    ],
    filled: { [yOld]: !!haveOld, [yNew]: !!haveNew },
    nextHint:
      !haveOld || !haveNew
        ? `대화창에 「${yOld}년 ○○만원, ${yNew}년 ○○만원」을 입력하거나, 휴직이면 휴직 시작일을 먼저 알려 주세요.`
        : "2024·2025년 소득이 입력되었습니다.",
  };
}

function inferEmploymentStatus(slots) {
  // 휴직일이 있으면 AI가 넣은 '1년이상재직' 등보다 휴직/복직을 우선
  if (slots.leaveStartDate && slots.leaveEndDate) return "복직";
  if (slots.leaveStartDate) return "휴직";
  if (slots.employmentStatus === "휴직" || slots.employmentStatus === "복직") {
    return slots.employmentStatus;
  }
  if (slots.employmentStatus === "1년미만재직" || slots.employmentStatus === "1년이상재직") {
    return slots.employmentStatus;
  }
  const start = parseDate(slots.employmentStartDate);
  if (start) {
    const yearStart = new Date(DEFAULT_INCOME_YEARS.newer, 0, 1, 12, 0, 0);
    if (start >= yearStart) return "1년미만재직";
  }
  const map = normalizeIncomeByYear(slots);
  if (Object.keys(map).length) return "1년이상재직";
  return null;
}

function calcRecognizedIncome(slots) {
  const status = inferEmploymentStatus(slots);
  const hasProof = !!slots.hasStableIncomeProof;
  const map = normalizeIncomeByYear(slots);
  const years = requiredIncomeYears(slots);
  const yOlder = asPositive(map[years.older]);
  const yNewer = asPositive(map[years.newer]);

  if (status === "휴직") {
    if (!slots.leaveStartDate || (!yOlder && !yNewer)) {
      return {
        error: `휴직 시작일과 휴직 직전 2개년(${years.older}·${years.newer}년) 소득이 필요합니다.`,
      };
    }
    const leaveYear = years.leaveYear;
    if (!yOlder || !yNewer) {
      const only = yOlder || yNewer;
      return {
        income: only,
        employmentStatus: status,
        reason: `휴직 직전 1개년 소득만 입력되어 ${only.toLocaleString("ko-KR")}원 적용`,
        years,
      };
    }
    const v = variationRate(yOlder, yNewer);
    let income;
    let reason;
    if (hasProof || v <= 20) {
      income = yNewer;
      reason = `휴직(${leaveYear}) 직전 ${years.older}·${years.newer}년, 변동률 ${v.toFixed(1)}% → ${years.newer}년 소득 적용`;
    } else {
      income = (yOlder + yNewer) / 2;
      reason = `휴직(${leaveYear}) 직전 ${years.older}·${years.newer}년, 변동률 ${v.toFixed(1)}% → 2개년 평균 적용`;
    }
    return { income, variationPct: v, employmentStatus: status, reason, years };
  }

  if (status === "복직") {
    if (!slots.leaveStartDate || !slots.leaveEndDate) {
      return { error: "휴직 시작일과 복직(휴직 종료)일이 필요합니다." };
    }
    const leave = parseDate(slots.leaveStartDate);
    const ret = parseDate(slots.leaveEndDate);
    if (!leave || !ret || ret <= leave) {
      return { error: "복직일은 휴직일 이후여야 합니다." };
    }
    const monthsAfter = monthsBetween(ret, new Date());
    if (monthsAfter < 3 || (!yOlder && !yNewer)) {
      const nested = calcRecognizedIncome({
        ...slots,
        employmentStatus: "휴직",
        leaveEndDate: null,
      });
      if (nested.error) return nested;
      return {
        ...nested,
        employmentStatus: status,
        reason: `복직 후 3개월 미만 또는 복직 후 소득 부족 → 휴직자 기준. ${nested.reason}`,
      };
    }
  }

  if (status === "1년미만재직") {
    const total = asPositive(slots.receivedIncomeTotal) || yNewer || 0;
    const months = Number(slots.monthsWorked) || 0;
    if (total > 0 && months >= 1) {
      const annualized = (total / months) * 12;
      const income = hasProof ? annualized : annualized * 0.9;
      return {
        income,
        employmentStatus: status,
        reason: hasProof
          ? `신규입사 연환산: ${Math.round(total).toLocaleString("ko-KR")}원 ÷ ${months}개월 × 12`
          : `신규입사 연환산 후 10% 차감: ${Math.round(total).toLocaleString("ko-KR")}원 ÷ ${months}개월 × 12`,
        years,
      };
    }
  }

  if (!yOlder && !yNewer) {
    return {
      error: `${years.older}·${years.newer}년 소득(또는 최근 연소득)을 입력해 주세요.`,
    };
  }
  if (!yOlder || !yNewer) {
    const only = yOlder || yNewer;
    const onlyYear = yOlder ? years.older : years.newer;
    return {
      income: only,
      employmentStatus: status || "1년이상재직",
      reason: `${onlyYear}년 소득만 입력되어 ${only.toLocaleString("ko-KR")}원 적용`,
      years,
    };
  }

  const v = variationRate(yOlder, yNewer);
  let income;
  let reason;
  if (hasProof || v <= 20) {
    income = yNewer;
    reason = `전년 대비 변동률 ${v.toFixed(1)}% (20% 이하) → ${years.newer}년 소득 적용`;
  } else {
    income = (yOlder + yNewer) / 2;
    reason = `전년 대비 변동률 ${v.toFixed(1)}% (20% 초과) → ${years.older}·${years.newer}년 평균 적용`;
  }
  return { income, variationPct: v, employmentStatus: status || "1년이상재직", reason, years };
}

function getDidimdolBaseRate(income, termYears) {
  const rows = [
    { max: 20000000, rates: { 10: 2.85, 15: 2.95, 20: 3.05, 30: 3.1 } },
    { max: 40000000, rates: { 10: 3.2, 15: 3.3, 20: 3.4, 30: 3.45 } },
    { max: 70000000, rates: { 10: 3.55, 15: 3.65, 20: 3.75, 30: 3.8 } },
    { max: 85000000, rates: { 10: 3.9, 15: 4.0, 20: 4.1, 30: 4.15 } },
  ];
  const term = [10, 15, 20, 30].includes(termYears) ? termYears : 30;
  const top = rows[rows.length - 1].rates[term];
  const row = rows.find((r) => income <= r.max);
  return row ? row.rates[term] : top;
}

function calcDidimdolRate(income, slots) {
  const term = Number(slots.loanTermYears) || 30;
  let base = getDidimdolBaseRate(income, term);
  if (slots.localHome) base -= 0.2;

  const subsidy = paymentCountToSubsidy(slots.housingSubscriptionPaymentCount);
  const discountRaw = subsidy.discount;
  const cap = slots.hasChild ? 0.7 : 0.5;
  const applied = Math.min(discountRaw, cap);
  const finalRate = Math.max(1.5, base - applied);
  return {
    base,
    term,
    savingsDiscount: subsidy.discount,
    savingsLabel: subsidy.label,
    discountApplied: applied,
    finalRate,
  };
}

function monthlyPayment(principal, annualRatePct, termYears) {
  const n = Math.max(1, Math.round(termYears * 12));
  const r = annualRatePct / 100 / 12;
  if (!(principal > 0)) return 0;
  if (r <= 0) return principal / n;
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

function calcDti(income, loanAmount, ratePct, termYears) {
  if (!(income > 0) || !(loanAmount > 0)) return null;
  const monthly = monthlyPayment(loanAmount, ratePct, termYears);
  return (monthly * 12 * 100) / income;
}

function calcDsr(income, opts) {
  if (!(income > 0)) return null;
  const mainAnnual =
    monthlyPayment(opts.loanAmount || 0, opts.ratePct || 0, opts.termYears || 30) * 12;
  const credit = Number(opts.creditLoanAmount) || 0;
  const creditAnnual = credit > 0 ? credit * ((opts.creditRatePct || 6) / 100) : 0;
  const total = mainAnnual + creditAnnual;
  return { dsr: (total * 100) / income, annualDebt: total, mainAnnual, creditAnnual };
}

export function emptySlots() {
  return {
    loanProduct: "didimdol",
    employmentStartDate: null,
    leaveStartDate: null,
    leaveEndDate: null,
    incomeByYear: {},
    incomeYear2024: null,
    incomeYear2025: null,
    housingSubscriptionPaymentCount: null,
    employmentStatus: null,
    hasStableIncomeProof: false,
    receivedIncomeTotal: null,
    monthsWorked: null,
    loanAmount: null,
    loanTermYears: 30,
    loanRatePct: null,
    creditLoanAmount: null,
    localHome: false,
    hasChild: false,
    // 반환보증·수수료
    housePrice: null,
    leaseDeposit: null,
    seniorLien: null,
    seniorLeaseDeposit: null,
    exclusiveArea: null,
    housingType: null,
    guaranteeAmount: null,
  };
}

export function mergeSlots(base, incoming) {
  const out = { ...emptySlots(), ...(base || {}) };
  out.incomeByYear = normalizeIncomeByYear(out);

  if (!incoming || typeof incoming !== "object") return out;

  for (const [k, v] of Object.entries(incoming)) {
    if (v === undefined) continue;
    if (v === null || v === "") {
      // 명시적 비우기 (휴직일 삭제·필드 클리어)
      if (k in out && k !== "loanProduct" && k !== "loanTermYears") out[k] = null;
      continue;
    }
    if (k === "incomeByYear" && typeof v === "object") {
      out.incomeByYear = { ...out.incomeByYear, ...normalizeIncomeByYear({ incomeByYear: v }) };
      continue;
    }
    const yearMatch = k.match(/^incomeYear(\d{4})$/);
    if (yearMatch) {
      const year = Number(yearMatch[1]);
      const amt = asPositive(v);
      if (amt) {
        out.incomeByYear[year] = amt;
        out[k] = amt;
      }
      continue;
    }
    if (k === "loanProduct") {
      const ok = LOAN_PRODUCTS.some((p) => p.id === v);
      if (ok) out.loanProduct = v;
      continue;
    }
    if (!(k in out) && k !== "employmentStatus") continue;
    out[k] = v;
  }

  // mirror defaults for UI
  if (out.incomeByYear[2024]) out.incomeYear2024 = out.incomeByYear[2024];
  if (out.incomeByYear[2025]) out.incomeYear2025 = out.incomeByYear[2025];
  return out;
}

function hasIncomeForYears(slots) {
  const years = requiredIncomeYears(slots);
  const map = normalizeIncomeByYear(slots);
  const status = inferEmploymentStatus(slots);
  if (status === "1년미만재직") {
    return asPositive(slots.receivedIncomeTotal) > 0 && Number(slots.monthsWorked) >= 1;
  }
  return asPositive(map[years.older]) > 0 || asPositive(map[years.newer]) > 0;
}

function incomeYearLabels(slots) {
  const years = requiredIncomeYears(slots);
  return {
    olderLabel: `${years.older}년 소득`,
    newerLabel: `${years.newer}년 소득`,
    olderKey: `incomeYear${years.older}`,
    newerKey: `incomeYear${years.newer}`,
    older: years.older,
    newer: years.newer,
  };
}

/**
 * 상품별 필수·선택 체크리스트 항목
 * @returns {{ key: string, label: string, required: boolean, filled: boolean, value: *, inputType: string, hint?: string, placeholder?: string }[]}
 */
export function getChecklistItems(slots = {}) {
  const s = { ...emptySlots(), ...slots };
  const product = s.loanProduct || "didimdol";
  const map = normalizeIncomeByYear(s);
  const years = incomeYearLabels(s);
  const status = inferEmploymentStatus(s);

  const moneyVal = (n) => (asPositive(n) > 0 ? asPositive(n) : null);
  const dateFilled = (d) => !!(d && parseDate(d));

  const commonIncome = () => {
    const items = [
      {
        key: "employmentStartDate",
        label: "입사일",
        required: true,
        filled: dateFilled(s.employmentStartDate),
        value: s.employmentStartDate || "",
        inputType: "date",
      },
      {
        key: "leaveStartDate",
        label: "휴직 시작일",
        required: status === "휴직" || status === "복직",
        filled: dateFilled(s.leaveStartDate),
        value: s.leaveStartDate || "",
        inputType: "date",
        hint: "없으면 비워 두세요",
      },
      {
        key: "leaveEndDate",
        label: "휴직 종료일(복직일)",
        required: status === "복직",
        filled: dateFilled(s.leaveEndDate),
        value: s.leaveEndDate || "",
        inputType: "date",
        hint: "복직 시에만 필요",
      },
      {
        key: years.olderKey,
        label: years.olderLabel,
        required: true,
        filled: asPositive(map[years.older]) > 0 || (status === "1년미만재직" && hasIncomeForYears(s)),
        value: moneyVal(map[years.older]) || "",
        inputType: "money",
        placeholder: "예: 42000000",
        year: years.older,
      },
      {
        key: years.newerKey,
        label: years.newerLabel,
        required: true,
        filled: asPositive(map[years.newer]) > 0 || (status === "1년미만재직" && hasIncomeForYears(s)),
        value: moneyVal(map[years.newer]) || "",
        inputType: "money",
        placeholder: "예: 45000000",
        year: years.newer,
      },
    ];
    if (status === "1년미만재직") {
      items.push(
        {
          key: "receivedIncomeTotal",
          label: "수령 소득 합계",
          required: true,
          filled: asPositive(s.receivedIncomeTotal) > 0,
          value: moneyVal(s.receivedIncomeTotal) || "",
          inputType: "money",
        },
        {
          key: "monthsWorked",
          label: "근무 개월 수",
          required: true,
          filled: Number(s.monthsWorked) >= 1,
          value: s.monthsWorked || "",
          inputType: "number",
        }
      );
    }
    return items;
  };

  if (product === "didimdol") {
    return [
      ...commonIncome(),
      {
        key: "housingSubscriptionPaymentCount",
        label: "청약저축 납입회차",
        required: true,
        filled: Number(s.housingSubscriptionPaymentCount) > 0,
        value: s.housingSubscriptionPaymentCount || "",
        inputType: "number",
        placeholder: "예: 72",
      },
      {
        key: "loanAmount",
        label: "희망 대출금액",
        required: false,
        filled: asPositive(s.loanAmount) > 0,
        value: moneyVal(s.loanAmount) || "",
        inputType: "money",
        hint: "DTI·DSR용 (선택)",
      },
      {
        key: "loanTermYears",
        label: "대출 기간(년)",
        required: false,
        filled: [10, 15, 20, 30].includes(Number(s.loanTermYears)),
        value: s.loanTermYears || 30,
        inputType: "select",
        options: [
          { value: 10, label: "10년" },
          { value: 15, label: "15년" },
          { value: 20, label: "20년" },
          { value: 30, label: "30년" },
        ],
      },
    ];
  }

  if (product === "beotimmok") {
    return [
      ...commonIncome(),
      {
        key: "housingSubscriptionPaymentCount",
        label: "청약저축 납입회차",
        required: false,
        filled: Number(s.housingSubscriptionPaymentCount) > 0,
        value: s.housingSubscriptionPaymentCount || "",
        inputType: "number",
        hint: "우대 확인용 (선택)",
      },
      {
        key: "leaseDeposit",
        label: "전세보증금",
        required: true,
        filled: asPositive(s.leaseDeposit) > 0,
        value: moneyVal(s.leaseDeposit) || "",
        inputType: "money",
        placeholder: "예: 200000000",
      },
      {
        key: "loanAmount",
        label: "희망 대출금액",
        required: true,
        filled: asPositive(s.loanAmount) > 0,
        value: moneyVal(s.loanAmount) || "",
        inputType: "money",
      },
      {
        key: "loanTermYears",
        label: "대출 기간(년)",
        required: false,
        filled: Number(s.loanTermYears) > 0,
        value: s.loanTermYears || 30,
        inputType: "number",
      },
    ];
  }

  if (product === "mortgage") {
    return [
      {
        key: "incomeCombined",
        label: "연소득(인정)",
        required: true,
        filled: hasIncomeForYears(s),
        value: (() => {
          const y = requiredIncomeYears(s);
          return moneyVal(map[y.newer]) || moneyVal(map[y.older]) || "";
        })(),
        inputType: "money",
        hint: `${years.newer}년 또는 ${years.older}년`,
        year: years.newer,
        mapsTo: years.newerKey,
      },
      {
        key: years.olderKey,
        label: years.olderLabel,
        required: false,
        filled: asPositive(map[years.older]) > 0,
        value: moneyVal(map[years.older]) || "",
        inputType: "money",
        year: years.older,
      },
      {
        key: years.newerKey,
        label: years.newerLabel,
        required: false,
        filled: asPositive(map[years.newer]) > 0,
        value: moneyVal(map[years.newer]) || "",
        inputType: "money",
        year: years.newer,
      },
      {
        key: "loanAmount",
        label: "본건대출 금액",
        required: true,
        filled: asPositive(s.loanAmount) > 0,
        value: moneyVal(s.loanAmount) || "",
        inputType: "money",
      },
      {
        key: "loanRatePct",
        label: "본건대출 금리(%)",
        required: true,
        filled: Number(s.loanRatePct) > 0,
        value: s.loanRatePct || "",
        inputType: "number",
        placeholder: "예: 3.5",
        step: "0.01",
      },
      {
        key: "loanTermYears",
        label: "대출 기간(년)",
        required: true,
        filled: Number(s.loanTermYears) > 0,
        value: s.loanTermYears || 30,
        inputType: "number",
      },
      {
        key: "creditLoanAmount",
        label: "기존 신용대출 잔액",
        required: false,
        filled: asPositive(s.creditLoanAmount) > 0,
        value: moneyVal(s.creditLoanAmount) || "",
        inputType: "money",
        hint: "없으면 비워 두세요",
      },
    ];
  }

  if (product === "returnGuarantee") {
    return [
      {
        key: "housePrice",
        label: "주택가격(A)",
        required: true,
        filled: asPositive(s.housePrice) > 0,
        value: moneyVal(s.housePrice) || "",
        inputType: "money",
      },
      {
        key: "leaseDeposit",
        label: "전세보증금(B)",
        required: true,
        filled: asPositive(s.leaseDeposit) > 0,
        value: moneyVal(s.leaseDeposit) || "",
        inputType: "money",
      },
      {
        key: "seniorLien",
        label: "선순위채권(C)",
        required: false,
        filled: s.seniorLien != null && s.seniorLien !== "",
        value: moneyVal(s.seniorLien) || (s.seniorLien === 0 ? 0 : ""),
        inputType: "money",
        hint: "없으면 0",
      },
      {
        key: "seniorLeaseDeposit",
        label: "선순위 임차보증금(D)",
        required: false,
        filled: s.seniorLeaseDeposit != null && s.seniorLeaseDeposit !== "",
        value: moneyVal(s.seniorLeaseDeposit) || (s.seniorLeaseDeposit === 0 ? 0 : ""),
        inputType: "money",
        hint: "없으면 0",
      },
      {
        key: "exclusiveArea",
        label: "전용면적(㎡)",
        required: true,
        filled: Number(s.exclusiveArea) > 0,
        value: s.exclusiveArea || "",
        inputType: "number",
        step: "0.01",
      },
      {
        key: "housingType",
        label: "주택 유형",
        required: true,
        filled: !!(s.housingType && String(s.housingType).trim()),
        value: s.housingType || "",
        inputType: "select",
        options: [
          { value: "", label: "선택" },
          { value: "아파트", label: "아파트" },
          { value: "오피스텔", label: "오피스텔" },
          { value: "단독주택", label: "단독주택" },
          { value: "다세대주택", label: "다세대주택" },
          { value: "다가구주택", label: "다가구주택" },
          { value: "다중주택", label: "다중주택" },
        ],
      },
    ];
  }

  // fee (보증료·수수료)
  return [
    {
      key: "housePrice",
      label: "주택가격(A)",
      required: true,
      filled: asPositive(s.housePrice) > 0,
      value: moneyVal(s.housePrice) || "",
      inputType: "money",
    },
    {
      key: "leaseDeposit",
      label: "전세보증금(B)",
      required: true,
      filled: asPositive(s.leaseDeposit) > 0,
      value: moneyVal(s.leaseDeposit) || "",
      inputType: "money",
    },
    {
      key: "seniorLien",
      label: "선순위채권(C)",
      required: false,
      filled: s.seniorLien != null && s.seniorLien !== "",
      value: moneyVal(s.seniorLien) || (s.seniorLien === 0 ? 0 : ""),
      inputType: "money",
      hint: "없으면 0",
    },
    {
      key: "guaranteeAmount",
      label: "보증금액",
      required: true,
      filled: asPositive(s.guaranteeAmount) > 0,
      value: moneyVal(s.guaranteeAmount) || "",
      inputType: "money",
      hint: "보통 전세보증금과 동일",
    },
    {
      key: "housingType",
      label: "주택 유형",
      required: true,
      filled: !!(s.housingType && String(s.housingType).trim()),
      value: s.housingType || "",
      inputType: "select",
      options: [
        { value: "", label: "선택" },
        { value: "아파트", label: "아파트" },
        { value: "오피스텔", label: "오피스텔" },
        { value: "단독주택", label: "단독주택" },
        { value: "다세대주택", label: "다세대주택" },
        { value: "다가구주택", label: "다가구주택" },
        { value: "다중주택", label: "다중주택" },
      ],
    },
  ];
}

export function listMissingRequired(slots) {
  return getChecklistItems(slots)
    .filter((item) => item.required && !item.filled)
    .map((item) => item.label);
}

export function checklistProgress(slots) {
  const items = getChecklistItems(slots).filter((i) => i.required);
  const filled = items.filter((i) => i.filled).length;
  return { filled, total: items.length, complete: items.length > 0 && filled === items.length };
}

export function slotsReadyForIncome(slots) {
  const map = normalizeIncomeByYear(slots);
  if (Object.values(map).some((v) => asPositive(v))) return true;
  if (asPositive(slots.receivedIncomeTotal) && Number(slots.monthsWorked) >= 1) return true;
  return false;
}

export function estimateFromSlots(slots) {
  const guide = getIncomeDocumentGuide(slots);
  const incomeResult = calcRecognizedIncome(slots);
  if (incomeResult.error) {
    return {
      ok: false,
      error: incomeResult.error,
      missing: listMissing(slots),
      guide,
    };
  }

  const income = Math.round(incomeResult.income);
  const rate = calcDidimdolRate(income, slots);
  const loanAmount = Number(slots.loanAmount) || 0;
  const term = rate.term;
  const dti = loanAmount > 0 ? calcDti(income, loanAmount, rate.finalRate, term) : null;
  const dsr =
    loanAmount > 0
      ? calcDsr(income, {
          loanAmount,
          ratePct: rate.finalRate,
          termYears: term,
          creditLoanAmount: slots.creditLoanAmount,
        })
      : null;

  return {
    ok: true,
    income,
    incomeReason: incomeResult.reason,
    employmentStatus: incomeResult.employmentStatus,
    variationPct: incomeResult.variationPct ?? null,
    years: incomeResult.years || requiredIncomeYears(slots),
    rate,
    dti,
    dsr,
    missing: listMissing(slots),
    guide,
  };
}

export function listMissing(slots) {
  const required = listMissingRequired(slots);
  // 하위 호환: 선택 항목 안내도 포함 (디딤돌·버팀목 공통)
  const product = slots?.loanProduct || "didimdol";
  const missing = [...required];
  if ((product === "didimdol" || product === "beotimmok") && !slots.loanAmount) {
    // 디딤돌만 선택으로 표시
    if (product === "didimdol" && !required.includes("희망 대출금액")) {
      missing.push("희망 대출금액(DTI·DSR용, 선택)");
    }
  }
  return missing;
}

export function slotsToSummary(slots, estimate) {
  const status = estimate?.employmentStatus || inferEmploymentStatus(slots);
  const income = estimate?.ok ? estimate.income : null;
  const map = normalizeIncomeByYear(slots);
  const years = estimate?.years || requiredIncomeYears(slots);

  const self = {
    incomeType: "근로소득",
    employmentStatus: status,
    employmentStartDate: slots.employmentStartDate || null,
    leaveStartDate: slots.leaveStartDate || null,
    leaveEndDate: slots.leaveEndDate || null,
    monthsWorked: slots.monthsWorked || null,
    incomeByYear: map,
    incomeYear2023: map[2023] || null,
    incomeYear2024: map[2024] || null,
    incomeYear2025: map[2025] || null,
    // 계산기 전전연도/전연도 칸용 (실제 연도와 무관하게 older/newer 금액)
    incomeYearOlder: map[years.older] || null,
    incomeYearNewer: map[years.newer] || null,
    incomeOlderYear: years.older,
    incomeNewerYear: years.newer,
    receivedIncomeTotal: slots.receivedIncomeTotal || null,
    recognizedAnnualIncome: income,
    incomeCalculationNote: estimate?.incomeReason || null,
    hasStableIncomeProof: !!slots.hasStableIncomeProof,
    withholdingFinalIncome: null,
    withholdingTaxYear: null,
    withholdingTypeAFinalIncome: null,
    withholdingTypeATaxYear: null,
    incomeCertificateGrossPay: null,
    incomeCertificateAmount: null,
    incomeCertificateYear: null,
  };

  return {
    status: "success",
    source: "chat",
    extractedAt: new Date().toISOString(),
    name: null,
    residentId: null,
    familyMembers: null,
    incomes: { self, spouse: null },
    combinedIncome: income,
    withholdingFinalIncome: null,
    incomeCertificateAmount: null,
    housingSubscriptionPaymentCount: slots.housingSubscriptionPaymentCount || null,
    housingSubscriptionProductType: null,
    loans: {
      creditLoanAmount: slots.creditLoanAmount || null,
      collateralLoanAmount: null,
      totalLoanAmount: slots.creditLoanAmount || null,
      loanDetails: [],
    },
    detectedDocuments: [],
    documentGuide: estimate?.guide || getIncomeDocumentGuide(slots),
    chatSlots: { ...slots, incomeByYear: map },
    estimate: estimate?.ok
      ? {
          income,
          incomeReason: estimate.incomeReason,
          finalRate: estimate.rate.finalRate,
          baseRate: estimate.rate.base,
          savingsLabel: estimate.rate.savingsLabel,
          dti: estimate.dti,
          dsr: estimate.dsr?.dsr ?? null,
          loanAmount: slots.loanAmount || null,
          loanTermYears: estimate.rate.term,
        }
      : null,
  };
}

export function formatDocumentGuideText(guide) {
  if (!guide) return "";
  const lines = [
    `[${guide.title}]`,
    guide.summary,
    "",
    "준비 서류:",
    ...guide.documents.map((d, i) => `${i + 1}. ${d}`),
  ];
  if (guide.notes?.length) {
    lines.push("", "참고:", ...guide.notes.map((n) => `· ${n}`));
  }
  if (guide.nextHint) lines.push("", guide.nextHint);
  return lines.join("\n");
}

export {
  inferEmploymentStatus,
  paymentCountToSubsidy,
  calcRecognizedIncome,
  getDidimdolBaseRate,
};
