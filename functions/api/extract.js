const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "qwen/qwen3-vl-235b-a22b-instruct";
const VISION_MODEL_FALLBACK = [
  "qwen/qwen3-vl-235b-a22b-instruct",
  "qwen/qwen3-vl-32b-instruct",
];
const MODEL_PRICING = {
  "qwen/qwen3-vl-235b-a22b-instruct": { input: 0.2 / 1_000_000, output: 0.88 / 1_000_000 },
  "qwen/qwen3-vl-32b-instruct": { input: 0.104 / 1_000_000, output: 0.45 / 1_000_000 },
};
const DEFAULT_PRICING = { input: 0.3 / 1_000_000, output: 1.0 / 1_000_000 };
const MAX_OUTPUT_TOKENS = 2000;
const KRW_PER_USD = 1400;
const MAX_JOB_KRW_DEFAULT = 70;
const MAX_CHUNKS_PER_JOB = 4;
const ESTIMATED_COMPLETION_TOKENS = 1200;
const ESTIMATED_PROMPT_BASE = 2500;
const ESTIMATED_TOKENS_PER_IMAGE = 1400;
const DEFAULT_SITE_URL = "https://mortgage-loan.uk";
const MAX_FILES_PER_REQUEST = 8;

const BATCH_EXTRACTION_PROMPT = `당신은 한국 공식 서류를 분석하는 전문가입니다.
첨부된 여러 서류(재직증명서, 사업자등록증, 근로소득원천징수영수증, 갑종근로소득원천징수영수증, 소득금액증명원, 주민등록등본, 신용정보조회표, 청약저축납입증명서 등)를 모두 읽고, 아래 항목만 추출하여 하나의 JSON으로 통합해주세요.

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
- incomes: 객체
  - self: 본인 소득
    - withholdingFinalIncome, withholdingTaxYear (근로소득원천징수영수증)
    - withholdingTypeAFinalIncome, withholdingTypeATaxYear (갑종근로소득원천징수영수증)
    - incomeCertificateAmount, incomeCertificateYear (소득금액증명원)
  - spouse: 배우자 소득 (동일 필드, 배우자 서류가 없으면 모두 null)
- combinedIncome: 부부합산 연소득 (본인·배우자 각각의 최신 인정 연소득을 합산, 한 명만 있으면 그 값)

### 청약저축 정보 (청약저축납입증명서에서)
- housingSubscriptionPaymentCount: 납입 횟수/회차 합계 (숫자, 예: 120)
- housingSubscriptionProductType: 저축 종류 (청약저축, 청약종합저축, 청약부금, 청년우대형청약종합저축 등)

### 대출 정보 (신용정보조회표에서)
- loans: 대출 정보 객체
  - creditLoanAmount: 신용대출 잔액 합계 (숫자)
  - collateralLoanAmount: 담보대출 잔액 합계 (숫자)
  - totalLoanAmount: 총 대출잔액 (숫자)
  - loanDetails: 대출 상세 내역 문자열 배열 (예: "국민은행 신용대출 15,000,000원")

### 참고 정보
- detectedDocuments: 인식된 서류 목록 배열
  - fileName: 파일명 (첨부된 이미지에 표시된 파일명 참고)
  - documentType: 서류 종류 (재직증명서, 사업자등록증, 근로소득원천징수영수증, 갑종근로소득원천징수영수증, 소득금액증명원, 주민등록등본, 신용정보조회표, 청약저축납입증명서, 기타)

## 규칙
1. 반드시 JSON 형식으로만 응답하세요.
2. 해당 서류가 첨부되지 않았거나 값을 찾을 수 없으면 null을 사용하세요.
3. 금액은 숫자만 (쉼표, 원 제외). 예: 45000000
4. 주민등록번호는 문서에 표기된 그대로 추출하세요.
5. 여러 서류에 같은 정보가 있으면 가장 공식적인 서류(등본, 증명원)를 우선하세요.
6. familyMembers는 주민등록등본의 세대원 전체를 포함하세요.
7. 본인·배우자 원천징수영수증이 모두 있으면 incomes.self와 incomes.spouse에 각각 넣고 combinedIncome에 합산하세요.
8. 소득 서류 성명이 등본 관계 '본인'과 일치하면 self, '배우자'·'남편'·'아내'와 일치하면 spouse에 넣으세요.

## 응답 형식 (JSON만)
{
  "name": null,
  "residentId": null,
  "familyMembers": null,
  "incomes": {
    "self": {
      "withholdingFinalIncome": null,
      "withholdingTaxYear": null,
      "withholdingTypeAFinalIncome": null,
      "withholdingTypeATaxYear": null,
      "incomeCertificateAmount": null,
      "incomeCertificateYear": null
    },
    "spouse": {
      "withholdingFinalIncome": null,
      "withholdingTaxYear": null,
      "withholdingTypeAFinalIncome": null,
      "withholdingTypeATaxYear": null,
      "incomeCertificateAmount": null,
      "incomeCertificateYear": null
    }
  },
  "combinedIncome": null,
  "housingSubscriptionPaymentCount": null,
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

const INCOME_PERSON_KEYS = [
  "withholdingFinalIncome",
  "withholdingTaxYear",
  "withholdingTypeAFinalIncome",
  "withholdingTypeATaxYear",
  "incomeCertificateAmount",
  "incomeCertificateYear",
];

function emptyPersonIncome() {
  return {
    withholdingFinalIncome: null,
    withholdingTaxYear: null,
    withholdingTypeAFinalIncome: null,
    withholdingTypeATaxYear: null,
    incomeCertificateAmount: null,
    incomeCertificateYear: null,
  };
}

function pickRecognizedIncome(person) {
  if (!person) return null;
  const candidates = [
    person.withholdingFinalIncome,
    person.withholdingTypeAFinalIncome,
    person.incomeCertificateAmount,
  ].filter((v) => typeof v === "number" && v > 0);
  if (!candidates.length) return null;
  return Math.max(...candidates);
}

function mergePersonIncome(base, incoming, legacy = null) {
  const out = { ...emptyPersonIncome(), ...(base || {}) };
  const sources = [incoming, legacy].filter(Boolean);
  for (const source of sources) {
    for (const key of INCOME_PERSON_KEYS) {
      if (source[key] != null && (out[key] == null || out[key] === "")) {
        out[key] = source[key];
      }
    }
  }
  return out;
}

function normalizeExtraction(raw) {
  const legacySelf = {
    withholdingFinalIncome: raw.withholdingFinalIncome,
    withholdingTaxYear: raw.withholdingTaxYear,
    withholdingTypeAFinalIncome: raw.withholdingTypeAFinalIncome,
    withholdingTypeATaxYear: raw.withholdingTypeATaxYear,
    incomeCertificateAmount: raw.incomeCertificateAmount,
    incomeCertificateYear: raw.incomeCertificateYear,
  };
  const self = mergePersonIncome(raw.incomes?.self, null, legacySelf);
  const spouse = mergePersonIncome(raw.incomes?.spouse, null, null);
  const selfIncome = pickRecognizedIncome(self);
  const spouseIncome = pickRecognizedIncome(spouse);
  let combinedIncome = typeof raw.combinedIncome === "number" && raw.combinedIncome > 0 ? raw.combinedIncome : null;
  if (!combinedIncome) {
    if (selfIncome && spouseIncome) combinedIncome = selfIncome + spouseIncome;
    else combinedIncome = selfIncome || spouseIncome || null;
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
    incomeCertificateAmount: self.incomeCertificateAmount ?? null,
    incomeCertificateYear: self.incomeCertificateYear ?? null,
    housingSubscriptionPaymentCount: raw.housingSubscriptionPaymentCount ?? null,
    housingSubscriptionProductType: raw.housingSubscriptionProductType ?? null,
    loans: raw.loans ?? null,
    detectedDocuments: raw.detectedDocuments ?? [],
  };
}

function resolveVisionModels(envModel) {
  const env = String(envModel || "").trim();
  const candidates = [env, DEFAULT_MODEL, ...VISION_MODEL_FALLBACK].filter(Boolean);
  const seen = new Set();
  const models = [];
  for (const model of candidates) {
    if (/^openai\//i.test(model)) continue;
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
  return false;
}

async function requestVisionExtraction({ apiKey, siteUrl, model, prompt, imageContents }) {
  return fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": siteUrl,
      "X-Title": "Mortgage Loan Lab",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: prompt }, ...imageContents],
        },
      ],
      max_tokens: MAX_OUTPUT_TOKENS,
      temperature: 0.1,
      provider: {
        allow_fallbacks: false,
        max_price: { prompt: 0.5, completion: 3, image: 0.02 },
      },
    }),
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
        detail: "low",
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
    const data = normalizeExtraction(raw);
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
