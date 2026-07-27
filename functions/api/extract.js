import { LOAN_REGULATIONS_EXTRACTION_CONTEXT } from "./loan-regulations-context.js";
import { normalizeExtractionData } from "../../js/extraction-normalize.js";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
/** OCR·문서 인식 무료 모델 (OpenRouter :free). 1순위: Nemotron OCR 특화 */
const DEFAULT_MODEL = "nvidia/nemotron-nano-12b-v2-vl:free";
const VISION_MODEL_FALLBACK = [
  "nvidia/nemotron-nano-12b-v2-vl:free",
  "qwen/qwen3-vl-8b-instruct:free",
  "google/gemma-3-27b-it:free",
];
const FREE_MODEL_PRICING = { input: 0, output: 0 };
const MODEL_PRICING = {
  "nvidia/nemotron-nano-12b-v2-vl:free": FREE_MODEL_PRICING,
  "qwen/qwen3-vl-8b-instruct:free": FREE_MODEL_PRICING,
  "google/gemma-3-27b-it:free": FREE_MODEL_PRICING,
};
const DEFAULT_PRICING = FREE_MODEL_PRICING;
const MAX_OUTPUT_TOKENS = 2000;
const KRW_PER_USD = 1400;
const MAX_JOB_KRW_DEFAULT = 70;
const MAX_CHUNKS_PER_JOB = 4;
const ESTIMATED_COMPLETION_TOKENS = 1200;
const ESTIMATED_PROMPT_BASE = 4500;
const ESTIMATED_TOKENS_PER_IMAGE = 1400;
const DEFAULT_SITE_URL = "https://mortgage-loan.uk";
const MAX_FILES_PER_REQUEST = 8;

const BATCH_EXTRACTION_PROMPT = `당신은 한국 공식 서류를 분석하는 전문가입니다.
첨부된 여러 서류(재직증명서, 사업자등록증, 근로소득원천징수영수증, 갑종근로소득원천징수영수증, 소득금액증명원, 주민등록등본, 신용정보조회표, 청약저축납입증명서, 주택청약(종합)저축 거래 확인서 등)를 모두 읽고, 아래 항목만 추출하여 하나의 JSON으로 통합해주세요.

## 추출 항목

### 기본 정보 (서류 어디서든 확인)
- name: 신청인/본인 이름
- residentId: 주민등록번호

### 가족 정보 (주민등록등본에서)
- familyMembers: 세대 구성원 배열
  - name: 성명
  - residentId: 주민등록번호
  - relation: 세대주와의 관계 (본인, 배우자, 자녀, 부, 모 등)

### 소득 정보 (본인·배우자 각각 구분)
주민등록등본 세대원 이름·관계와 소득 서류의 성명(수급자)을 대조해 본인(self)과 배우자(spouse)를 구분하세요.
각 사람마다 아래 필드를 채우세요.
- incomes: 객체
  - self / spouse 각각:
    - incomeType: 근로소득|사업소득|연금소득|기타소득|null
    - employmentStatus: 1년이상재직|1년미만재직|휴직|복직|사업영위|퇴직|null
    - employmentStartDate: YYYY-MM-DD (재직증명서·건강보험자격득실 등)
    - monthsWorked: 재직·수령 개월 수 (1년 미만·연환산 시)
    - withholdingFinalIncome, withholdingTaxYear (근로소득원천징수 — 비과세 제외 총급여/근로소득)
    - withholdingTypeAFinalIncome, withholdingTypeATaxYear (갑종근로소득원천징수)
    - incomeCertificateGrossPay: 소득금액증명원 **「지급받은 총액」** (참고용, 인정소득에 사용 금지)
    - incomeCertificateAmount, incomeCertificateYear: 소득금액증명원 **「소득금액」** 칸 + 귀속연도
    - incomeYear2023, incomeYear2024: 원천징수·급여 등에서 확인되는 연도별 근로/사업 소득
    - receivedIncomeTotal: 부분연도 수령 소득 합계(연환산 전)
    - recognizedAnnualIncome: 업무처리기준 적용 후 인정 연소득 추정(숫자)
    - incomeCalculationNote: 적용한 규칙 한 줄(예: "2024년 소득, 변동률 15%")
    - hasStableIncomeProof: 상시소득 입증 가능 여부(true/false/null)
- combinedIncome: 부부합산 인정 연소득(각 recognizedAnnualIncome 합, 없으면 최신 소득 합산)

### 청약저축 정보 (청약저축납입증명서 · 주택청약(종합)저축 거래 확인서 등)
- housingSubscriptionPaymentCount: **필수** — 납입/인정 회차 (정수). 아래 중 해당 값:
  - 「금리우대 인정회차」(디딤돌 금리우대용 **거래 확인서**) ← 이 서류가 있으면 반드시 추출
  - 「납입회차」·「납입 횟수」(청약저축납입증명서)
- housingSubscriptionInterestDiscountRounds: 거래 확인서 **금리우대 인정회차**와 동일 숫자 (있으면 housingSubscriptionPaymentCount에도 복사)
- housingSubscriptionProductType: 저축 종류 (청약저축, 청약종합저축, 주택청약종합저축, 청약부금 등)

### 대출 정보 (신용정보조회표에서)
- loans: 대출 정보 객체
  - creditLoanAmount: 신용대출 잔액 합계 (숫자)
  - collateralLoanAmount: 담보대출 잔액 합계 (숫자)
  - totalLoanAmount: 총 대출잔액 (숫자)
  - loanDetails: 대출 상세 내역 문자열 배열 (예: "국민은행 신용대출 15,000,000원")

### 참고 정보
- detectedDocuments: 인식된 서류 목록 배열
  - fileName: 파일명 (첨부된 이미지에 표시된 파일명 참고)
  - documentType: 서류 종류 (재직증명서, 사업자등록증, 근로소득원천징수영수증, 갑종근로소득원천징수영수증, 소득금액증명원, 주민등록등본, 신용정보조회표, 청약저축납입증명서, 주택청약종합저축거래확인서, 기타)

## 규칙
1. 반드시 JSON 형식으로만 응답하세요.
2. 해당 서류가 첨부되지 않았거나 값을 찾을 수 없으면 null을 사용하세요.
3. 금액은 숫자만 (쉼표, 원 제외). 예: 45000000
4. 주민등록번호는 문서에 표기된 그대로 추출하세요.
5. 여러 서류에 같은 정보가 있으면 가장 공식적인 서류(등본, 증명원)를 우선하세요.
6. familyMembers는 주민등록등본의 세대원 전체를 포함하세요.
7. 본인·배우자 원천징수영수증이 모두 있으면 incomes.self와 incomes.spouse에 각각 넣고 combinedIncome에 합산하세요.
8. 소득 서류 성명이 등본 관계 '본인'과 일치하면 self, '배우자'·'남편'·'아내'와 일치하면 spouse에 넣으세요.
9. 근로소득 원천징수는 세액이 아닌 총급여·근로소득이며 비과세 소득은 제외하세요.
10. **소득금액증명원(중요)**:
    - incomeCertificateGrossPay = 「지급받은 총액」 (예: 74890667)
    - incomeCertificateAmount = 「소득금액」 칸만 (예: 61396134) — **인정소득은 반드시 이 값**
    - incomeCertificateYear = 귀속연도 (예: 2025)
    - recognizedAnnualIncome = incomeCertificateAmount 와 동일하게 기재 (지급받은 총액 사용 금지)
11. 소득금액증명이 있으면 withholdingFinalIncome·combinedIncome에 지급받은 총액을 넣지 마세요.
12. 1년 미만 재직이면 monthsWorked와 receivedIncomeTotal을 추출하고 recognizedAnnualIncome에 (합계÷개월)×12을 적용하세요.
13. **주택청약(종합)저축 거래 확인서**가 있으면 표에서 **금리우대 인정회차** 숫자(예: 61)를 housingSubscriptionPaymentCount와 housingSubscriptionInterestDiscountRounds 모두에 넣으세요.

## 추출 예시 (참고)
소득금액증명 + 거래 확인서가 함께 있을 때:
- incomes.self.incomeCertificateGrossPay: 74890667
- incomes.self.incomeCertificateAmount: 61396134
- incomes.self.recognizedAnnualIncome: 61396134
- housingSubscriptionPaymentCount: 61
- housingSubscriptionInterestDiscountRounds: 61

## 응답 형식 (JSON만)
{
  "name": null,
  "residentId": null,
  "familyMembers": null,
  "incomes": {
    "self": {
      "incomeType": null,
      "employmentStatus": null,
      "employmentStartDate": null,
      "monthsWorked": null,
      "withholdingFinalIncome": null,
      "withholdingTaxYear": null,
      "withholdingTypeAFinalIncome": null,
      "withholdingTypeATaxYear": null,
      "incomeCertificateGrossPay": null,
      "incomeCertificateAmount": null,
      "incomeCertificateYear": null,
      "incomeYear2023": null,
      "incomeYear2024": null,
      "receivedIncomeTotal": null,
      "recognizedAnnualIncome": null,
      "incomeCalculationNote": null,
      "hasStableIncomeProof": null
    },
    "spouse": {
      "incomeType": null,
      "employmentStatus": null,
      "employmentStartDate": null,
      "monthsWorked": null,
      "withholdingFinalIncome": null,
      "withholdingTaxYear": null,
      "withholdingTypeAFinalIncome": null,
      "withholdingTypeATaxYear": null,
      "incomeCertificateGrossPay": null,
      "incomeCertificateAmount": null,
      "incomeCertificateYear": null,
      "incomeYear2023": null,
      "incomeYear2024": null,
      "receivedIncomeTotal": null,
      "recognizedAnnualIncome": null,
      "incomeCalculationNote": null,
      "hasStableIncomeProof": null
    }
  },
  "combinedIncome": null,
  "housingSubscriptionPaymentCount": null,
  "housingSubscriptionInterestDiscountRounds": null,
  "housingSubscriptionProductType": null,
  "loans": null,
  "detectedDocuments": []
}`;

function buildBatchPrompt(files) {
  const fileList = files
    .map((f, i) => {
      const page = f.pageNumber ? ` (페이지 ${f.pageNumber})` : "";
      return `${i + 1}. ${f.fileName}${page}`;
    })
    .join("\n");

  return `${BATCH_EXTRACTION_PROMPT}

${LOAN_REGULATIONS_EXTRACTION_CONTEXT}

## 첨부된 파일 목록
${fileList}

위 파일들을 모두 분석하여 통합 JSON을 반환하세요.`;
}

function parseExtractionResult(raw) {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("AI 응답에서 JSON을 찾을 수 없습니다.");
  }
  return JSON.parse(jsonMatch[0]);
}

function isFreeModel(model) {
  return /:free$/i.test(String(model || "")) || String(model || "") === "openrouter/free";
}

function getProviderOptions(model) {
  if (isFreeModel(model)) {
    return {
      allow_fallbacks: false,
      max_price: { prompt: 0, completion: 0, image: 0 },
    };
  }
  return {
    allow_fallbacks: false,
    max_price: { prompt: 0.5, completion: 3, image: 0.02 },
  };
}

function resolveVisionModels(envModel) {
  const env = String(envModel || "").trim();
  const candidates = [env, DEFAULT_MODEL, ...VISION_MODEL_FALLBACK].filter(Boolean);
  const seen = new Set();
  const models = [];
  for (const model of candidates) {
    if (/^openai\//i.test(model)) continue;
    if (!isFreeModel(model)) continue;
    if (seen.has(model)) continue;
    seen.add(model);
    models.push(model);
  }
  return models.length ? models : [DEFAULT_MODEL];
}

function getMaxJobKrw(env) {
  const configured = Number(env?.EXTRACT_MAX_JOB_KRW);
  return Number.isFinite(configured) && configured > 0 ? configured : MAX_JOB_KRW_DEFAULT;
}

function getMaxJobUsd(env) {
  return getMaxJobKrw(env) / KRW_PER_USD;
}

function getChunkBudgetUsd(spentUsdSoFar, chunkIndex, totalChunks, env) {
  const maxJobUsd = getMaxJobUsd(env);
  const remaining = Math.max(0, maxJobUsd - Math.max(0, spentUsdSoFar));
  const chunksLeft = Math.max(1, (totalChunks || 1) - chunkIndex);
  return remaining / chunksLeft;
}

function getModelPricing(model) {
  return MODEL_PRICING[model] || DEFAULT_PRICING;
}

function estimateRequestCostUsd(model, prompt, imageCount) {
  const pricing = getModelPricing(model);
  const promptTokens = ESTIMATED_PROMPT_BASE + Math.ceil(prompt.length / 2);
  const inputTokens = promptTokens + imageCount * ESTIMATED_TOKENS_PER_IMAGE;
  return inputTokens * pricing.input + ESTIMATED_COMPLETION_TOKENS * pricing.output;
}

function actualCostUsd(model, usage) {
  if (isFreeModel(model)) return 0;
  if (!usage) return 0;
  const pricing = getModelPricing(model);
  const prompt = Number(usage.prompt_tokens) || 0;
  const completion = Number(usage.completion_tokens) || 0;
  return prompt * pricing.input + completion * pricing.output;
}

function formatKrwFromUsd(usd) {
  return Math.round(usd * KRW_PER_USD);
}

function isRetryableModelError(status, errText) {
  if (status === 403 && /not available in your region/i.test(errText)) return true;
  if (status === 404 && /no endpoints found/i.test(errText)) return true;
  if (status === 429) return true;
  if (status === 402) return true;
  if (/response_format|json_object|structured output/i.test(errText)) return true;
  return false;
}

async function requestVisionExtraction({ apiKey, siteUrl, model, prompt, imageContents }) {
  const body = {
    model,
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: prompt }, ...imageContents],
      },
    ],
    max_tokens: MAX_OUTPUT_TOKENS,
    temperature: 0.1,
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
      "X-Title": "Mortgage Loan Lab",
    },
    body: JSON.stringify(body),
  });
}

function formatOpenRouterError(status, errText) {
  try {
    const parsed = JSON.parse(errText);
    const message = parsed?.error?.message || parsed?.message;
    if (message?.includes("not available in your region")) {
      return `사용 가능한 AI 모델을 찾지 못했습니다. 잠시 후 다시 시도해 주세요. (${message})`;
    }
    if (message) return `AI 분석 요청 실패 (${status}): ${message}`;
  } catch {
    /* fall through */
  }
  const detail = errText ? errText.slice(0, 200) : "";
  return `AI 분석 요청 실패 (${status})${detail ? `: ${detail}` : ""}`;
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
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

    const siteUrl = context.env.OPENROUTER_SITE_URL || DEFAULT_SITE_URL;
    const visionModels = resolveVisionModels(context.env.OPENROUTER_MODEL);

    let body;
    try {
      body = await context.request.json();
    } catch {
      return jsonResponse(
        {
          success: false,
          error:
            "요청 데이터를 읽을 수 없습니다. 파일 용량이 너무 크거나 형식이 잘못되었습니다.",
        },
        400
      );
    }

    const files = body?.files;
    const chunkIndex = Number(body?.chunkIndex) || 0;
    const totalChunks = Math.max(1, Number(body?.totalChunks) || 1);
    const spentUsdSoFar = Math.max(0, Number(body?.spentUsdSoFar) || 0);
    const maxJobKrw = getMaxJobKrw(context.env);
    const maxJobUsd = maxJobKrw / KRW_PER_USD;

    if (!Array.isArray(files) || files.length === 0) {
      return jsonResponse({ success: false, error: "업로드된 파일이 없습니다." }, 400);
    }

    if (chunkIndex >= MAX_CHUNKS_PER_JOB || totalChunks > MAX_CHUNKS_PER_JOB) {
      return jsonResponse(
        {
          success: false,
          error: `한 번의 분석은 최대 ${MAX_CHUNKS_PER_JOB}회 API 호출(약 15페이지)까지 가능합니다.`,
        },
        400
      );
    }

    if (spentUsdSoFar >= maxJobUsd) {
      return jsonResponse(
        {
          success: false,
          error: `이번 분석 비용 한도(${maxJobKrw}원)에 도달했습니다. 페이지 수를 줄이거나 잠시 후 다시 시도해 주세요.`,
        },
        429
      );
    }

    const chunkBudgetUsd = getChunkBudgetUsd(spentUsdSoFar, chunkIndex, totalChunks, context.env);

    if (files.length > MAX_FILES_PER_REQUEST) {
      return jsonResponse(
        {
          success: false,
          error: `한 번에 ${MAX_FILES_PER_REQUEST}페이지까지 분석할 수 있습니다.`,
        },
        400
      );
    }

    const prompt = buildBatchPrompt(files);
    const imageContents = files.map((file) => ({
      type: "image_url",
      image_url: {
        url: `data:${file.mimeType};base64,${file.fileBase64}`,
        detail: "auto",
      },
    }));

    let aiRes = null;
    let aiText = "";
    let lastRetryableError = "";
    let usedModel = visionModels[0];

    for (const model of visionModels) {
      const estimatedCost = estimateRequestCostUsd(model, prompt, imageContents.length);
      if (spentUsdSoFar + estimatedCost > maxJobUsd + 1e-9) {
        return jsonResponse(
          {
            success: false,
            error: `예상 비용이 분석 한도(${maxJobKrw}원)를 초과합니다. 업로드 페이지 수를 줄여 주세요.`,
          },
          429
        );
      }
      if (estimatedCost > chunkBudgetUsd + 1e-9) {
        return jsonResponse(
          {
            success: false,
            error: `이번 배치 예상 비용이 한도를 초과합니다. 파일·페이지 수를 줄여 주세요. (배치 ${chunkIndex + 1}/${totalChunks})`,
          },
          429
        );
      }

      usedModel = model;
      aiRes = await requestVisionExtraction({
        apiKey,
        siteUrl,
        model,
        prompt,
        imageContents,
      });
      aiText = await aiRes.text();

      if (aiRes.ok) break;

      console.error("OpenRouter API error:", aiRes.status, model, aiText);
      if (isRetryableModelError(aiRes.status, aiText)) {
        lastRetryableError = aiText;
        continue;
      }

      return jsonResponse(
        { success: false, error: formatOpenRouterError(aiRes.status, aiText) },
        500
      );
    }

    if (!aiRes?.ok) {
      return jsonResponse(
        {
          success: false,
          error: lastRetryableError
            ? formatOpenRouterError(aiRes.status, lastRetryableError)
            : "AI 분석 요청에 실패했습니다.",
        },
        500
      );
    }

    if (!aiText.trim()) {
      return jsonResponse({ success: false, error: "AI 응답이 비어있습니다." }, 500);
    }

    let aiJson;
    try {
      aiJson = JSON.parse(aiText);
    } catch {
      return jsonResponse({ success: false, error: "AI 응답 형식이 올바르지 않습니다." }, 500);
    }
    const content = aiJson.choices?.[0]?.message?.content;
    if (!content) {
      return jsonResponse({ success: false, error: "AI 응답이 비어있습니다." }, 500);
    }

    const raw = parseExtractionResult(content);
    const data = normalizeExtractionData(raw);
    const costUsd = actualCostUsd(usedModel, aiJson.usage);
    const spentUsd = spentUsdSoFar + costUsd;

    return jsonResponse({
      success: true,
      data,
      usage: {
        model: usedModel,
        promptTokens: aiJson.usage?.prompt_tokens ?? null,
        completionTokens: aiJson.usage?.completion_tokens ?? null,
        costUsd,
        costKrw: formatKrwFromUsd(costUsd),
        spentUsd,
        spentKrw: formatKrwFromUsd(spentUsd),
        budgetKrw: maxJobKrw,
      },
    });
  } catch (error) {
    console.error("Extraction error:", error);
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return jsonResponse({ success: false, error: message }, 500);
  }
}
