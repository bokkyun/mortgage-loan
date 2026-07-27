/** 서류 추출 결과 정규화 — extract API · paperwork 클라이언트 공통 */

export const INCOME_PERSON_KEYS = [
  "incomeType",
  "employmentStatus",
  "employmentStartDate",
  "leaveStartDate",
  "leaveEndDate",
  "monthsWorked",
  "withholdingFinalIncome",
  "withholdingTaxYear",
  "withholdingTypeAFinalIncome",
  "withholdingTypeATaxYear",
  "incomeCertificateGrossPay",
  "incomeCertificateAmount",
  "incomeCertificateYear",
  "incomeYear2023",
  "incomeYear2024",
  "incomeYear2025",
  "receivedIncomeTotal",
  "recognizedAnnualIncome",
  "incomeCalculationNote",
  "hasStableIncomeProof",
];

export function emptyPersonIncome() {
  return {
    incomeType: null,
    employmentStatus: null,
    employmentStartDate: null,
    leaveStartDate: null,
    leaveEndDate: null,
    monthsWorked: null,
    withholdingFinalIncome: null,
    withholdingTaxYear: null,
    withholdingTypeAFinalIncome: null,
    withholdingTypeATaxYear: null,
    incomeCertificateGrossPay: null,
    incomeCertificateAmount: null,
    incomeCertificateYear: null,
    incomeYear2023: null,
    incomeYear2024: null,
    incomeYear2025: null,
    receivedIncomeTotal: null,
    recognizedAnnualIncome: null,
    incomeCalculationNote: null,
    hasStableIncomeProof: null,
  };
}

function asPositiveNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** 소득금액증명: 지급받은 총액·소득금액 분리·보정 */
export function fixPersonIncomeCertificate(person) {
  if (!person) return person;
  let gross = asPositiveNumber(person.incomeCertificateGrossPay);
  let amount = asPositiveNumber(person.incomeCertificateAmount);

  if (gross && amount) {
    if (amount > gross) {
      const tmp = amount;
      amount = gross;
      gross = tmp;
    }
    person.incomeCertificateGrossPay = gross;
    person.incomeCertificateAmount = amount;
  } else if (gross && !amount) {
    person.incomeCertificateAmount = null;
    person.incomeCertificateGrossPay = gross;
  }

  amount = asPositiveNumber(person.incomeCertificateAmount);
  const recognized = asPositiveNumber(person.recognizedAnnualIncome);

  if (amount) {
    if (!recognized || recognized > amount * 1.03) {
      person.recognizedAnnualIncome = amount;
      if (!person.incomeCalculationNote) {
        person.incomeCalculationNote = "소득금액증명 소득금액 기준";
      }
    }
  }

  return person;
}

export function pickRecognizedIncome(person) {
  if (!person) return null;
  const fixed = fixPersonIncomeCertificate({ ...person });
  const cert = asPositiveNumber(fixed.incomeCertificateAmount);
  const recognized = asPositiveNumber(fixed.recognizedAnnualIncome);

  if (cert) {
    if (recognized && recognized <= cert * 1.03) return recognized;
    return cert;
  }
  if (recognized) return recognized;

  const priority = [
    fixed.withholdingFinalIncome,
    fixed.withholdingTypeAFinalIncome,
    fixed.incomeYear2025,
    fixed.incomeYear2024,
    fixed.incomeYear2023,
  ];
  for (const v of priority) {
    const n = asPositiveNumber(v);
    if (n) return n;
  }
  return null;
}

export function mergePersonIncome(base, incoming, legacy = null) {
  const out = { ...emptyPersonIncome(), ...(base || {}) };
  for (const source of [incoming, legacy].filter(Boolean)) {
    for (const key of INCOME_PERSON_KEYS) {
      if (source[key] == null || source[key] === "") continue;

      if (out[key] == null || out[key] === "") {
        out[key] = source[key];
        continue;
      }

      if (key === "incomeCertificateAmount" && typeof source[key] === "number" && typeof out[key] === "number") {
        out[key] = Math.min(out[key], source[key]);
        continue;
      }
      if (key === "incomeCertificateGrossPay" && typeof source[key] === "number" && typeof out[key] === "number") {
        out[key] = Math.max(out[key], source[key]);
        continue;
      }
      if (
        key === "recognizedAnnualIncome" &&
        typeof source[key] === "number" &&
        typeof out[key] === "number" &&
        asPositiveNumber(out.incomeCertificateAmount)
      ) {
        out[key] = Math.min(out[key], source[key]);
        continue;
      }
      if (
        ["withholdingFinalIncome", "receivedIncomeTotal"].includes(key) &&
        typeof source[key] === "number" &&
        source[key] > out[key]
      ) {
        out[key] = source[key];
      }
    }
  }
  return fixPersonIncomeCertificate(out);
}

const SUBSCRIPTION_COUNT_KEYS = [
  "housingSubscriptionPaymentCount",
  "housingSubscriptionInterestDiscountRounds",
  "housingSubscriptionRecognizedRounds",
  "housingSubscriptionDiscountRounds",
  "subscriptionPaymentCount",
];

export function pickHousingSubscriptionCount(raw) {
  if (!raw || typeof raw !== "object") return null;

  const nested = raw.housingSubscription;
  const candidates = [
    ...SUBSCRIPTION_COUNT_KEYS.map((k) => raw[k]),
    nested?.paymentCount,
    nested?.interestDiscountRounds,
    nested?.recognizedRounds,
  ];

  let best = null;
  for (const c of candidates) {
    const n = asPositiveNumber(c);
    if (n && (!best || n > best)) best = n;
  }
  return best;
}

export function normalizeExtractionData(raw) {
  const legacySelf = {
    withholdingFinalIncome: raw.withholdingFinalIncome,
    withholdingTaxYear: raw.withholdingTaxYear,
    withholdingTypeAFinalIncome: raw.withholdingTypeAFinalIncome,
    withholdingTypeATaxYear: raw.withholdingTypeATaxYear,
    incomeCertificateGrossPay: raw.incomeCertificateGrossPay,
    incomeCertificateAmount: raw.incomeCertificateAmount,
    incomeCertificateYear: raw.incomeCertificateYear,
  };

  const self = mergePersonIncome(raw.incomes?.self, null, legacySelf);
  const spouse = mergePersonIncome(raw.incomes?.spouse, null, null);
  const selfIncome = pickRecognizedIncome(self);
  const spouseIncome = pickRecognizedIncome(spouse);

  let combinedIncome = null;
  if (selfIncome && spouseIncome) combinedIncome = selfIncome + spouseIncome;
  else combinedIncome = selfIncome || spouseIncome || null;

  if (!combinedIncome) {
    const rawCombined = asPositiveNumber(raw.combinedIncome);
    if (rawCombined) combinedIncome = rawCombined;
  } else {
    const rawCombined = asPositiveNumber(raw.combinedIncome);
    if (rawCombined && rawCombined > combinedIncome * 1.03) {
      combinedIncome = selfIncome && spouseIncome ? selfIncome + spouseIncome : selfIncome || spouseIncome;
    }
  }

  return {
    name: raw.name ?? null,
    residentId: raw.residentId ?? null,
    familyMembers: raw.familyMembers ?? null,
    incomes: { self, spouse },
    combinedIncome,
    withholdingFinalIncome: self.withholdingFinalIncome ?? null,
    withholdingTaxYear: self.withholdingTaxYear ?? null,
    withholdingTypeAFinalIncome: self.withholdingTypeAFinalIncome ?? null,
    withholdingTypeATaxYear: self.withholdingTypeATaxYear ?? null,
    incomeCertificateGrossPay: self.incomeCertificateGrossPay ?? null,
    incomeCertificateAmount: self.incomeCertificateAmount ?? null,
    incomeCertificateYear: self.incomeCertificateYear ?? null,
    housingSubscriptionPaymentCount: pickHousingSubscriptionCount(raw),
    housingSubscriptionProductType:
      raw.housingSubscriptionProductType ?? raw.housingSubscription?.productType ?? null,
    loans: raw.loans ?? null,
    detectedDocuments: raw.detectedDocuments ?? [],
  };
}
