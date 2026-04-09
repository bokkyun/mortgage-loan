/**
 * 보금자리론(디딤돌) 업무처리기준에 준하는 소득 산출 로직 (참고용 추정)
 * 실제 심사는 금융기관·HUG 기준에 따릅니다.
 */

const MS_PER_DAY = 86400000;

function parseDate(str) {
  if (!str) return null;
  const d = new Date(str + "T12:00:00");
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(start, end) {
  if (!start || !end) return 0;
  return Math.max(0, Math.round((end - start) / MS_PER_DAY));
}

/** 전년도(older) 대비 변동률 */
function variationRate(older, newer) {
  const base = Math.abs(older) < 1 ? 1 : older;
  return (Math.abs(newer - older) / base) * 100;
}

/**
 * A. 일반 재직자 — 2023·2024 소득, 변동 20% 기준
 */
function calcGeneral(inc2023, inc2024, hasProofStable) {
  const v = variationRate(inc2023, inc2024);
  let income;
  let detail;
  if (hasProofStable) {
    income = inc2024;
    detail = "상시소득 입증 시 최근년도(2024년) 소득 적용";
  } else if (v <= 20) {
    income = inc2024;
    detail = `전년 대비 변동률 ${v.toFixed(1)}% (20% 이하) → 2024년 소득 적용`;
  } else {
    income = (inc2023 + inc2024) / 2;
    detail = `전년 대비 변동률 ${v.toFixed(1)}% (20% 초과) → 2023·2024년 평균 소득 적용`;
  }
  return { income, variationPct: v, reason: detail };
}

/**
 * B. 신규 입사 — 월환산: 수령 합계 ÷ 수령 개월 수 × 12
 */
function calcNewHire2025(employmentStart, totalReceived, months) {
  const start = parseDate(employmentStart);
  if (!start) return { error: "재직 시작일을 입력해 주세요." };

  const yearStart2025 = new Date(2025, 0, 1, 12, 0, 0);
  if (start < yearStart2025) {
    return { error: "신규입사(연환산) 유형은 재직 시작일이 2025-01-01 이후여야 합니다." };
  }

  const m = Number(months);
  if (!Number.isFinite(m) || m < 1) {
    return { error: "수령 개월 수를 1 이상으로 입력해 주세요." };
  }
  if (totalReceived <= 0) {
    return { error: "수령 소득 합계를 입력해 주세요." };
  }

  const annualized = (totalReceived / m) * 12;
  const income = annualized;
  const reason = `월환산: 수령 ${fmtNum(totalReceived)}원 ÷ ${m}개월 × 12개월`;

  return { income, annualizedRaw: annualized, months: m, reason };
}

/**
 * C. 휴직자
 * incOlder: 휴직 연도 기준 (휴직연도-2) 과세(근로)소득
 * incNewer: (휴직연도-1) 과세(근로)소득
 */
function calcOnLeave(employmentStart, leaveStart, incOlder, incNewer, hasProofStable) {
  const start = employmentStart ? parseDate(employmentStart) : null;
  const leave = parseDate(leaveStart);
  if (employmentStart && !start) return { error: "재직 시작일을 입력해 주세요." };
  if (!leave) return { error: "휴직 시작일을 입력해 주세요." };
  if (start && start > leave) return { error: "재직 시작일은 휴직 시작일보다 빠르거나 같아야 합니다." };

  const leaveYear = leave.getFullYear();
  const yNew = leaveYear - 1;
  const yOld = leaveYear - 2;

  const v = variationRate(incOlder, incNewer);
  let income;
  let detail;
  if (hasProofStable) {
    income = incNewer;
    detail = `휴직 직전 ${yOld}·${yNew}년 중 상시소득 입증 시 ${yNew}년 소득 적용`;
  } else if (v <= 20) {
    income = incNewer;
    detail = `휴직 직전 ${yOld}·${yNew}년, 변동률 ${v.toFixed(1)}% (20% 이하) → ${yNew}년 소득 적용`;
  } else {
    income = (incOlder + incNewer) / 2;
    detail = `휴직 직전 ${yOld}·${yNew}년, 변동률 ${v.toFixed(1)}% (20% 초과) → 2개년 평균 적용`;
  }

  return { income, variationPct: v, leaveYear, years: { yOld, yNew }, reason: detail };
}

/**
 * D. 복직자
 * leaveY2, leaveY1: 휴직 직전 2개년 (휴직일 기준 연도-2, 연도-1 소득) — 3개월 미만 시 사용
 */
function calcReturned(
  leaveStart,
  returnStart,
  leaveY2,
  leaveY1,
  incomeMode,
  incPrevYearCompare,
  incReturnOrPeriod,
  periodEnd,
  incomeMonthsPartial,
  hasProofStable
) {
  const leave = parseDate(leaveStart);
  const ret = parseDate(returnStart);
  const end = parseDate(periodEnd) || new Date();

  if (!leave || !ret) {
    return { error: "휴직일·복직일을 모두 입력해 주세요." };
  }
  if (ret <= leave) {
    return { error: "복직일은 휴직일 이후여야 합니다." };
  }

  const monthsAfterReturn = (end - ret) / (MS_PER_DAY * 30);

  if (monthsAfterReturn < 3) {
    const c = calcOnLeave(null, leaveStart, leaveY2, leaveY1, hasProofStable);
    if (c.error) return c;
    return {
      ...c,
      reason: `복직 후 3개월 미만 → 휴직자 기준 적용. ${c.reason}`,
      mode: "as_leave",
    };
  }

  if (incomeMode === "annual") {
    const v = variationRate(incPrevYearCompare, incReturnOrPeriod);
    let income;
    let detail;
    if (hasProofStable) {
      income = incReturnOrPeriod;
      detail = "상시소득 입증 시 복직 후 최근년도 소득 적용";
    } else if (v <= 20) {
      income = incReturnOrPeriod;
      detail = `복직 후 최근년도와 전년 비교 변동률 ${v.toFixed(1)}% (20% 이하) → 최근년도 소득`;
    } else {
      income = (incPrevYearCompare + incReturnOrPeriod) / 2;
      detail = `변동률 ${v.toFixed(1)}% (20% 초과) → 전년·최근년도 평균`;
    }
    return { income, variationPct: v, reason: detail, mode: "returned_full_year" };
  }

  const mo = Number(incomeMonthsPartial);
  if (!Number.isFinite(mo) || mo < 1) {
    return { error: "복직 후 수령 개월 수를 1 이상으로 입력해 주세요." };
  }
  if (incReturnOrPeriod <= 0) {
    return { error: "복직 후 수령 소득 합계를 입력해 주세요." };
  }

  const annualized = (incReturnOrPeriod / mo) * 12;
  let income;
  let detail;
  if (hasProofStable) {
    income = annualized;
    detail = `복직 후 월환산: 수령 ${fmtNum(incReturnOrPeriod)}원 ÷ ${mo}개월 × 12개월`;
  } else {
    income = annualized * 0.9;
    detail = `복직 후 월환산 후 10% 차감: 수령 ${fmtNum(incReturnOrPeriod)}원 ÷ ${mo}개월 × 12개월`;
  }

  return {
    income,
    annualizedRaw: annualized,
    months: mo,
    variationPct: null,
    reason: detail,
    mode: "returned_partial",
  };
}

function fmtNum(n) {
  if (n == null || Number.isNaN(n)) return "-";
  return Math.round(n).toLocaleString("ko-KR");
}
