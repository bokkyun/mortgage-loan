const BATCH_EXTRACTION_PROMPT = `당신은 한국 공식 서류를 분석하는 전문가입니다.
첨부된 여러 서류(재직증명서, 사업자등록증, 근로소득원천징수영수증, 갑종근로소득원천징수영수증, 소득금액증명원, 주민등록등본, 신용정보조회표 등)를 모두 읽고, 아래 항목만 추출하여 하나의 JSON으로 통합해주세요.

## 추출 항목

### 기본 정보 (서류 어디서든 확인)
- name: 신청인/본인 이름
- residentId: 주민등록번호

### 가족 정보 (주민등록등본에서)
- familyMembers: 세대 구성원 배열
  - name: 성명
  - residentId: 주민등록번호
  - relation: 세대주와의 관계 (본인, 배우자, 자녀, 부, 모 등)

### 소득 정보 (각 서류에서 해당 항목만)
- withholdingFinalIncome: 근로소득원천징수영수증의 최종 근로소득/총급여 (숫자)
- withholdingTaxYear: 근로소득원천징수영수증 귀속연도
- withholdingTypeAFinalIncome: 갑종근로소득원천징수영수증의 최종 근로소득/총급여 (숫자)
- withholdingTypeATaxYear: 갑종근로소득원천징수영수증 귀속연도
- incomeCertificateAmount: 소득금액증명원의 소득금액/합계 소득금액 (숫자)
- incomeCertificateYear: 소득금액증명원 해당 연도

### 대출 정보 (신용정보조회표에서)
- loans: 대출 정보 객체
  - creditLoanAmount: 신용대출 잔액 합계 (숫자)
  - collateralLoanAmount: 담보대출 잔액 합계 (숫자)
  - totalLoanAmount: 총 대출잔액 (숫자)
  - loanDetails: 대출 상세 내역 문자열 배열 (예: "국민은행 신용대출 15,000,000원")

### 참고 정보
- detectedDocuments: 인식된 서류 목록 배열
  - fileName: 파일명 (첨부된 이미지에 표시된 파일명 참고)
  - documentType: 서류 종류 (재직증명서, 사업자등록증, 근로소득원천징수영수증, 갑종근로소득원천징수영수증, 소득금액증명원, 주민등록등본, 신용정보조회표, 기타)

## 규칙
1. 반드시 JSON 형식으로만 응답하세요.
2. 해당 서류가 첨부되지 않았거나 값을 찾을 수 없으면 null을 사용하세요.
3. 금액은 숫자만 (쉼표, 원 제외). 예: 45000000
4. 주민등록번호는 문서에 표기된 그대로 추출하세요.
5. 여러 서류에 같은 정보가 있으면 가장 공식적인 서류(등본, 증명원)를 우선하세요.
6. familyMembers는 주민등록등본의 세대원 전체를 포함하세요.

## 응답 형식 (JSON만)
{
  "name": null,
  "residentId": null,
  "familyMembers": null,
  "withholdingFinalIncome": null,
  "withholdingTaxYear": null,
  "withholdingTypeAFinalIncome": null,
  "withholdingTypeATaxYear": null,
  "incomeCertificateAmount": null,
  "incomeCertificateYear": null,
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

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export async function onRequestPost(context) {
  try {
    const apiKey = context.env.OPENAI_API_KEY;
    if (!apiKey) {
      return jsonResponse(
        {
          success: false,
          error:
            "OPENAI_API_KEY가 설정되지 않았습니다. Cloudflare Pages 환경 변수를 확인해주세요.",
        },
        500
      );
    }

    const body = await context.request.json();
    const files = body?.files;

    if (!Array.isArray(files) || files.length === 0) {
      return jsonResponse({ success: false, error: "업로드된 파일이 없습니다." }, 400);
    }

    const prompt = buildBatchPrompt(files);
    const imageContents = files.map((file) => ({
      type: "image_url",
      image_url: {
        url: `data:${file.mimeType};base64,${file.fileBase64}`,
        detail: "high",
      },
    }));

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: prompt }, ...imageContents],
          },
        ],
        max_tokens: 4000,
        temperature: 0.1,
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      console.error("OpenAI API error:", openaiRes.status, errText);
      return jsonResponse(
        { success: false, error: `AI 분석 요청 실패 (${openaiRes.status})` },
        500
      );
    }

    const openaiJson = await openaiRes.json();
    const content = openaiJson.choices?.[0]?.message?.content;
    if (!content) {
      return jsonResponse({ success: false, error: "AI 응답이 비어있습니다." }, 500);
    }

    const raw = parseExtractionResult(content);
    const data = {
      name: raw.name ?? null,
      residentId: raw.residentId ?? null,
      familyMembers: raw.familyMembers ?? null,
      withholdingFinalIncome: raw.withholdingFinalIncome ?? null,
      withholdingTaxYear: raw.withholdingTaxYear ?? null,
      withholdingTypeAFinalIncome: raw.withholdingTypeAFinalIncome ?? null,
      withholdingTypeATaxYear: raw.withholdingTypeATaxYear ?? null,
      incomeCertificateAmount: raw.incomeCertificateAmount ?? null,
      incomeCertificateYear: raw.incomeCertificateYear ?? null,
      loans: raw.loans ?? null,
      detectedDocuments: raw.detectedDocuments ?? [],
    };

    return jsonResponse({ success: true, data });
  } catch (error) {
    console.error("Extraction error:", error);
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return jsonResponse({ success: false, error: message }, 500);
  }
}
