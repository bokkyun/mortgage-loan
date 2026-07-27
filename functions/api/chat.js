import { LOAN_REGULATIONS_CHAT_CONTEXT } from "./loan-regulations-context.js";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
/** 텍스트 대화용 무료 모델 (OpenRouter :free). VL 모델은 쓰지 않음 */
const DEFAULT_MODEL = "openrouter/free";
const TEXT_MODEL_FALLBACK = [
  "openrouter/free",
  "google/gemma-3-27b-it:free",
  "qwen/qwen3-4b:free",
  "meta-llama/llama-3.3-70b-instruct:free",
];
const MAX_OUTPUT_TOKENS = 1200;
const DEFAULT_SITE_URL = "https://mortgage-loan.uk";
const MAX_MESSAGES = 24;
const MAX_MESSAGE_CHARS = 4000;

const SLOT_KEYS = [
  "loanProduct",
  "didimdolVariant",
  "employmentStartDate",
  "leaveStartDate",
  "leaveEndDate",
  "incomeYear2022",
  "incomeYear2023",
  "incomeYear2024",
  "incomeYear2025",
  "incomeByYear",
  "housingSubscriptionPaymentCount",
  "employmentStatus",
  "hasStableIncomeProof",
  "receivedIncomeTotal",
  "monthsWorked",
  "loanAmount",
  "loanTermYears",
  "loanRatePct",
  "creditLoanAmount",
  "localHome",
  "hasChild",
  "singleParent",
  "specialHousehold",
  "electronicContract",
  "under30Loan",
  "prepay40",
  "localUnsold",
  "childTierDiscount",
  "newbornChildDiscount",
  "minorChildDiscount",
  "firsthomeKind",
  "housePrice",
  "leaseDeposit",
  "seniorLien",
  "seniorLeaseDeposit",
  "exclusiveArea",
  "housingType",
  "guaranteeAmount",
];

const SYSTEM_PROMPT = `당신은 한국 주택자금(디딤돌·버팀목·주담대) 상담 도우미입니다.
사용자와 대화하며 아래 항목을 수집하고, 규정·서류 연도 질문에 답합니다.

## 상품 선택 (먼저)
- loanProduct: didimdol|beotimmok|mortgage
  (디딤돌|버팀목|주택담보대출)
- didimdolVariant: general|newborn|firsthome
  (일반 디딤돌|신생아 디딤돌|생애최초·신혼) — loanProduct=didimdol일 때
- firsthomeKind: 생애최초|신혼|생애최초·신혼 — didimdolVariant=firsthome일 때
- newbornChildDiscount: 0|0.2|0.4|0.6 — 신생아 자녀수 우대(%p)
- minorChildDiscount: 0|0.1|0.2|0.3 — 신생아 외 미성년 자녀 우대
- **금리우대(일반 디딤돌, boolean 또는 childTierDiscount)**
  - localHome: 지방 소재 주택 (−0.2%p, 기본금리 인하)
  - singleParent: 한부모가구 (−0.5%p)
  - specialHousehold: 장애인·다문화·생애최초·신혼가구 (−0.2%p)
  - electronicContract: 전자계약 (−0.1%p)
  - under30Loan: 산정 대출금액 30% 이내 (−0.1%p)
  - prepay40: 1년 후 원금 40% 이상 중도상환 (−0.2%p)
  - localUnsold: 지방 준공후 미분양 (−0.2%p)
  - childTierDiscount: 0|0.3|0.5|0.7 (다자녀 1·2·3자녀 이상)
- 사용자가 「지방 주택」「한부모」「전자계약」「다자녀」 등을 말하면 위 슬롯을 true/값으로 채우세요.
- 사용자가 상품을 말하면 loanProduct·didimdolVariant를 설정하세요.

## 소득 서류 연도 규칙 (중요)
- **일반 재직(휴직 없음)**: 지금 접수 기준 **2024년·2025년** 소득 서류 2개년 필요.
- **휴직자**: 휴직 시작일이 속한 연도를 L이라 하면 **(L-2)년·(L-1)년** 소득 서류 필요.
  예) 휴직시작 2025-02-01 → 2023·2024년 / 휴직시작 2024-06-01 → 2022·2023년.
- **복직 후 3개월 미만**: 휴직자와 동일(휴직 직전 2개년).
- **복직 후 3개월 이상**: 복직 후 급여 연환산 + 필요 시 휴직 직전 2개년.
- 사용자가 서류 연도를 물으면 위 규칙으로 구체적으로 답하세요. intent=docs.

## 수집 슬롯
- employmentStartDate: 입사일 YYYY-MM-DD
- leaveStartDate: 휴직 시작일 YYYY-MM-DD (없으면 null)
- leaveEndDate: 휴직 종료일/복직일 YYYY-MM-DD (없으면 null)
- incomeYear2022~incomeYear2025: 해당 연도 소득(원). "4500만원"→45000000
- incomeByYear: { "2024": 42000000, "2025": 45000000 } 형태도 허용
- housingSubscriptionPaymentCount: 청약저축 납입/인정 회차 정수
- employmentStatus: 1년이상재직|1년미만재직|휴직|복직|null
- hasStableIncomeProof: true/false
- receivedIncomeTotal, monthsWorked: 신규입사 연환산용
- loanAmount: 희망/본건 대출금액(원), loanTermYears: 10|15|20|30
- loanRatePct: 본건대출 금리(%)
- creditLoanAmount: 기존 신용대출 잔액(원)
- localHome, hasChild: boolean
- housePrice, leaseDeposit, seniorLien, seniorLeaseDeposit: 반환보증용 금액(원)
- exclusiveArea: 전용면적(㎡), housingType: 아파트|오피스텔|단독주택|다세대주택|다가구주택|다중주택
- guaranteeAmount: 보증금액(원, 수수료용)

## 응답 형식 (반드시 JSON만)
{
  "reply": "사용자에게 보여줄 한국어 답변",
  "slots": { ...위에서 새로 파악한 값만, 모르면 생략 },
  "intent": "collect" | "qa" | "calculate" | "docs"
}

규칙:
1. JSON 외 텍스트 금지.
2. 이미 알려진 슬롯을 지우지 말고, 새로 확인된 값만 slots에 넣으세요.
3. 금액은 원 단위 숫자. 날짜는 YYYY-MM-DD.
4. 서류 연도·준비 서류 질문이면 intent=docs, 규정이면 qa, 계산이면 calculate, 그 외 collect.
5. 휴직 시작일이 있으면 필요 소득 연도(L-2, L-1)를 reply에 명시하세요.
6. 한 메시지에 여러 값이 오면 모두 추출하세요.
7. 필수 미입력 항목이 있으면 reply 끝에 짧게 안내하세요.

${LOAN_REGULATIONS_CHAT_CONTEXT}`;

function isFreeModel(model) {
  return /:free$/i.test(String(model || "")) || String(model || "") === "openrouter/free";
}

function getProviderOptions(model) {
  if (isFreeModel(model)) {
    return {
      allow_fallbacks: true,
      max_price: { prompt: 0, completion: 0, image: 0 },
    };
  }
  return {
    allow_fallbacks: false,
    max_price: { prompt: 0.5, completion: 3 },
  };
}

function resolveTextModels(envModel) {
  const env = String(envModel || "").trim();
  const candidates = [env, DEFAULT_MODEL, ...TEXT_MODEL_FALLBACK].filter(Boolean);
  const seen = new Set();
  const models = [];
  for (const model of candidates) {
    if (/^openai\//i.test(model)) continue;
    if (!isFreeModel(model)) continue;
    // 비전 전용 모델은 채팅에서 제외
    if (/vl|vision|nemotron-nano-12b-v2-vl/i.test(model)) continue;
    if (seen.has(model)) continue;
    seen.add(model);
    models.push(model);
  }
  return models.length ? models : [DEFAULT_MODEL];
}

function isRetryableModelError(status, errText) {
  if (status === 403 && /not available in your region/i.test(errText)) return true;
  if (status === 404 && /no endpoints found/i.test(errText)) return true;
  if (status === 429) return true;
  if (status === 402) return true;
  if (/response_format|json_object|structured output/i.test(errText)) return true;
  return false;
}

function formatOpenRouterError(status, errText) {
  try {
    const parsed = JSON.parse(errText);
    const message = parsed?.error?.message || parsed?.message;
    if (message?.includes("not available in your region")) {
      return `사용 가능한 AI 모델을 찾지 못했습니다. 잠시 후 다시 시도해 주세요. (${message})`;
    }
    if (message) return `AI 요청 실패 (${status}): ${message}`;
  } catch {
    /* fall through */
  }
  const detail = errText ? errText.slice(0, 200) : "";
  return `AI 요청 실패 (${status})${detail ? `: ${detail}` : ""}`;
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function sanitizeMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .slice(-MAX_MESSAGES)
    .map((m) => {
      const role = m?.role === "assistant" ? "assistant" : "user";
      const content = String(m?.content || "").slice(0, MAX_MESSAGE_CHARS);
      return { role, content };
    })
    .filter((m) => m.content.trim());
}

function sanitizeKnownSlots(slots) {
  if (!slots || typeof slots !== "object") return {};
  const out = {};
  for (const key of SLOT_KEYS) {
    if (slots[key] === undefined || slots[key] === null || slots[key] === "") continue;
    out[key] = slots[key];
  }
  return out;
}

function normalizeSlotValue(key, value) {
  if (value == null || value === "") return null;
  if (key === "incomeByYear" && typeof value === "object") {
    const map = {};
    for (const [yk, yv] of Object.entries(value)) {
      const y = Number(yk);
      const n = Number(String(yv).replace(/,/g, ""));
      if (Number.isFinite(y) && Number.isFinite(n) && n > 0) map[y] = n;
    }
    return Object.keys(map).length ? map : null;
  }
  if (["hasStableIncomeProof", "localHome", "hasChild", "singleParent", "specialHousehold", "electronicContract", "under30Loan", "prepay40", "localUnsold"].includes(key)) {
    if (typeof value === "boolean") return value;
    const s = String(value).toLowerCase();
    if (["true", "1", "yes", "y", "예", "있음", "해당", "적용"].includes(s)) return true;
    if (["false", "0", "no", "n", "아니오", "없음", "미해당", "해당없음"].includes(s)) return false;
    return null;
  }
  if (key === "loanProduct") {
    const s = String(value).trim();
    const map = {
      didimdol: "didimdol",
      디딤돌: "didimdol",
      beotimmok: "beotimmok",
      버팀목: "beotimmok",
      mortgage: "mortgage",
      주택담보대출: "mortgage",
      주담대: "mortgage",
      returnGuarantee: "didimdol",
      반환보증: "didimdol",
      반환보증보험: "didimdol",
      fee: "didimdol",
      수수료: "didimdol",
      보증료: "didimdol",
    };
    return map[s] || null;
  }
  if (key === "didimdolVariant") {
    const s = String(value).trim();
    const map = {
      general: "general",
      일반: "general",
      "일반 디딤돌": "general",
      newborn: "newborn",
      신생아: "newborn",
      "신생아 디딤돌": "newborn",
      firsthome: "firsthome",
      생애최초: "firsthome",
      신혼: "firsthome",
      "생애최초·신혼": "firsthome",
      "생애최초신혼": "firsthome",
    };
    return map[s] || null;
  }
  if (key === "firsthomeKind") {
    const s = String(value).trim();
    if (["생애최초", "신혼", "생애최초·신혼"].includes(s)) return s;
    if (/생애최초/.test(s) && /신혼/.test(s)) return "생애최초·신혼";
    if (/신혼/.test(s)) return "신혼";
    if (/생애최초/.test(s)) return "생애최초";
    return null;
  }
  if (["newbornChildDiscount", "minorChildDiscount", "childTierDiscount"].includes(key)) {
    const n = Number(String(value).replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  if (
    /^incomeYear\d{4}$/.test(key) ||
    [
      "housingSubscriptionPaymentCount",
      "receivedIncomeTotal",
      "monthsWorked",
      "loanAmount",
      "loanTermYears",
      "loanRatePct",
      "creditLoanAmount",
      "housePrice",
      "leaseDeposit",
      "seniorLien",
      "seniorLeaseDeposit",
      "exclusiveArea",
      "guaranteeAmount",
    ].includes(key)
  ) {
    const n = Number(String(value).replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  if (key === "housingType") {
    const s = String(value).trim();
    const allowed = ["아파트", "오피스텔", "단독주택", "다세대주택", "다가구주택", "다중주택"];
    return allowed.includes(s) ? s : s || null;
  }
  if (["employmentStartDate", "leaveStartDate", "leaveEndDate"].includes(key)) {
    const s = String(value).trim().replace(/\./g, "-").replace(/\//g, "-");
    const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (!m) return null;
    return `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
  }
  if (key === "employmentStatus") {
    const s = String(value);
    if (/복직/.test(s)) return "복직";
    if (/휴직/.test(s)) return "휴직";
    if (/1년\s*미만|신규/.test(s)) return "1년미만재직";
    if (/1년\s*이상|일반/.test(s)) return "1년이상재직";
    return null;
  }
  return value;
}

function cleanSlots(raw) {
  if (!raw || typeof raw !== "object") return {};
  const out = {};
  for (const key of SLOT_KEYS) {
    if (!(key in raw)) continue;
    const v = normalizeSlotValue(key, raw[key]);
    if (v !== null && v !== undefined && v !== "") out[key] = v;
  }
  // 모델이 incomeYear2024 등으로만 준 경우 incomeByYear에도 합침
  const byYear = { ...(out.incomeByYear || {}) };
  for (const [k, v] of Object.entries(out)) {
    const m = k.match(/^incomeYear(\d{4})$/);
    if (m && Number(v) > 0) byYear[Number(m[1])] = Number(v);
  }
  if (Object.keys(byYear).length) out.incomeByYear = byYear;
  return out;
}

function parseChatResult(raw) {
  const jsonMatch = String(raw || "").match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      reply: String(raw || "").trim() || "응답을 이해하지 못했습니다. 다시 말씀해 주세요.",
      slots: {},
      intent: "collect",
    };
  }
  const parsed = JSON.parse(jsonMatch[0]);
  return {
    reply: String(parsed.reply || "").trim() || "확인했습니다.",
    slots: cleanSlots(parsed.slots),
    intent: ["collect", "qa", "calculate", "docs"].includes(parsed.intent)
      ? parsed.intent
      : "collect",
  };
}

async function requestChat({ apiKey, siteUrl, model, messages }) {
  const body = {
    model,
    messages,
    max_tokens: MAX_OUTPUT_TOKENS,
    temperature: 0.2,
    provider: getProviderOptions(model),
  };
  if (!isFreeModel(model)) {
    body.response_format = { type: "json_object" };
  }

  return fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": siteUrl,
      "X-Title": "Mortgage Loan Lab Chat",
    },
    body: JSON.stringify(body),
  });
}

export async function onRequest(context) {
  if (context.request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }
  if (context.request.method !== "POST") {
    return jsonResponse({ success: false, error: "POST만 허용됩니다." }, 405);
  }
  return onRequestPost(context);
}

export async function onRequestPost(context) {
  try {
    const apiKey = context.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return jsonResponse(
        {
          success: false,
          error:
            "OPENROUTER_API_KEY가 설정되지 않았습니다. Cloudflare Pages 환경 변수를 확인해주세요.",
        },
        500
      );
    }

    let body;
    try {
      body = await context.request.json();
    } catch {
      return jsonResponse({ success: false, error: "잘못된 JSON 요청입니다." }, 400);
    }

    const history = sanitizeMessages(body.messages);
    if (!history.length) {
      return jsonResponse({ success: false, error: "messages가 비어 있습니다." }, 400);
    }

    const knownSlots = sanitizeKnownSlots(body.slots);
    const siteUrl = context.env.OPENROUTER_SITE_URL || DEFAULT_SITE_URL;
    const models = resolveTextModels(context.env.OPENROUTER_CHAT_MODEL || context.env.OPENROUTER_MODEL);

    const slotHint = Object.keys(knownSlots).length
      ? `\n\n## 현재까지 수집된 값\n${JSON.stringify(knownSlots, null, 2)}`
      : "\n\n## 현재까지 수집된 값\n(아직 없음)";

    const guideHint =
      body.documentGuide && typeof body.documentGuide === "object"
        ? `\n\n## 서버가 계산한 서류 안내(이 내용을 우선 반영해 답변)\n${JSON.stringify(
            {
              title: body.documentGuide.title,
              summary: body.documentGuide.summary,
              years: body.documentGuide.years,
              documents: body.documentGuide.documents,
              notes: body.documentGuide.notes,
              nextHint: body.documentGuide.nextHint,
            },
            null,
            2
          )}`
        : "";

    const messages = [
      { role: "system", content: SYSTEM_PROMPT + slotHint + guideHint },
      ...history,
    ];

    let lastError = null;
    for (const model of models) {
      let res;
      try {
        res = await requestChat({ apiKey, siteUrl, model, messages });
      } catch (err) {
        lastError = err instanceof Error ? err.message : "네트워크 오류";
        continue;
      }

      const errText = res.ok ? "" : await res.text();
      if (!res.ok) {
        lastError = formatOpenRouterError(res.status, errText);
        if (isRetryableModelError(res.status, errText)) continue;
        return jsonResponse({ success: false, error: lastError }, 502);
      }

      let data;
      try {
        data = await res.json();
      } catch {
        lastError = "AI 응답을 해석하지 못했습니다.";
        continue;
      }

      const content = data?.choices?.[0]?.message?.content;
      if (!content) {
        lastError = "AI 응답이 비어 있습니다.";
        continue;
      }

      let parsed;
      try {
        parsed = parseChatResult(content);
      } catch {
        parsed = {
          reply: String(content).trim(),
          slots: {},
          intent: "collect",
        };
      }

      return jsonResponse({
        success: true,
        reply: parsed.reply,
        slots: parsed.slots,
        intent: parsed.intent,
        usage: {
          model: data.model || model,
          tokens: data.usage || null,
        },
      });
    }

    return jsonResponse(
      { success: false, error: lastError || "사용 가능한 무료 AI 모델이 없습니다." },
      502
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "서버 오류";
    return jsonResponse({ success: false, error: message }, 500);
  }
}
