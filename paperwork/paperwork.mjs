const STORAGE_KEY = "mortgage-loan-paperwork-summary";
const MAX_PAGES_PER_PDF = 5;
const MAX_TOTAL_PAGES = 15;
const API_CHUNK_SIZE = 4;
const PDF_RENDER_SCALE = 1.25;
const JPEG_QUALITY = 0.65;
const VALID_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

const FIELD_GROUPS = [
  {
    title: "기본 정보",
    icon: "👤",
    source: "전체 서류",
    fields: [
      { key: "name", label: "이름", type: "text" },
      { key: "residentId", label: "주민등록번호", type: "text" },
    ],
  },
  {
    title: "가족 정보",
    icon: "👨‍👩‍👧‍👦",
    source: "주민등록등본",
    fields: [{ key: "familyMembers", label: "세대 구성원", type: "family" }],
  },
  {
    title: "소득 정보",
    icon: "💰",
    source: "각 소득 서류",
    fields: [
      { key: "withholdingFinalIncome", label: "원천징수영수증 최종소득", type: "currency" },
      { key: "withholdingTypeAFinalIncome", label: "갑종근로소득원천징수영수증 최종소득", type: "currency" },
      { key: "incomeCertificateAmount", label: "소득금액증명원 소득금액", type: "currency" },
    ],
  },
  {
    title: "대출 정보",
    icon: "🏦",
    source: "신용정보조회표",
    fields: [
      { key: "loans.creditLoanAmount", label: "신용대출 금액", type: "currency" },
      { key: "loans.collateralLoanAmount", label: "담보대출 금액", type: "currency" },
      { key: "loans.totalLoanAmount", label: "총 대출잔액", type: "currency" },
    ],
  },
];

const state = {
  files: [],
  summary: null,
  busy: false,
  step: "",
  error: null,
};

const els = {
  dropzone: document.getElementById("pw-dropzone"),
  fileInput: document.getElementById("pw-file-input"),
  fileList: document.getElementById("pw-file-list"),
  submitBtn: document.getElementById("pw-submit"),
  uploadError: document.getElementById("pw-upload-error"),
  globalError: document.getElementById("pw-global-error"),
  dropContent: document.getElementById("pw-drop-content"),
  dropBusy: document.getElementById("pw-drop-busy"),
  dropStep: document.getElementById("pw-drop-step"),
  result: document.getElementById("pw-result"),
  clearBtn: document.getElementById("pw-clear"),
};

function formatCurrency(value) {
  if (value === null || value === undefined || value === "") return "-";
  const num = typeof value === "string" ? parseInt(String(value).replace(/,/g, ""), 10) : value;
  if (Number.isNaN(num)) return String(value);
  return new Intl.NumberFormat("ko-KR").format(num) + "원";
}

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function getYearLabel(summary, key) {
  if (key === "withholdingFinalIncome" && summary.withholdingTaxYear) {
    return `${summary.withholdingTaxYear}년`;
  }
  if (key === "withholdingTypeAFinalIncome" && summary.withholdingTypeATaxYear) {
    return `${summary.withholdingTypeATaxYear}년`;
  }
  if (key === "incomeCertificateAmount" && summary.incomeCertificateYear) {
    return `${summary.incomeCertificateYear}년`;
  }
  return null;
}

function getLoanValue(summary, key) {
  if (!summary.loans) return null;
  if (key === "loans.creditLoanAmount") return summary.loans.creditLoanAmount;
  if (key === "loans.collateralLoanAmount") return summary.loans.collateralLoanAmount;
  if (key === "loans.totalLoanAmount") return summary.loans.totalLoanAmount;
  return null;
}

function loadSummary() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSummary(summary) {
  try {
    if (summary) localStorage.setItem(STORAGE_KEY, JSON.stringify(summary));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore quota */
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function pdfToImages(file) {
  const pdfjs = await import(
    "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs"
  );
  pdfjs.GlobalWorkerOptions.workerSrc =
    "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const pageCount = Math.min(pdf.numPages, MAX_PAGES_PER_PDF);
  const pages = [];

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: PDF_RENDER_SCALE });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const context = canvas.getContext("2d");
    if (!context) continue;

    await page.render({ canvasContext: context, viewport }).promise;
    const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    pages.push({
      fileName: file.name,
      fileBase64: dataUrl.split(",")[1],
      mimeType: "image/jpeg",
      pageNumber: i,
    });
  }

  return pages;
}

async function processFilesForUpload(files) {
  const result = [];
  for (const file of files) {
    if (file.type === "application/pdf") {
      result.push(...(await pdfToImages(file)));
    } else {
      result.push({
        fileName: file.name,
        fileBase64: await fileToBase64(file),
        mimeType: file.type,
      });
    }
    if (result.length >= MAX_TOTAL_PAGES) break;
  }
  return result.slice(0, MAX_TOTAL_PAGES);
}

async function parseApiResponse(response) {
  const text = await response.text();
  if (!text.trim()) {
    if (response.status === 405) {
      throw new Error(
        "분석 API가 POST를 처리하지 못합니다. Cloudflare Pages Functions가 배포되지 않았을 수 있습니다. 잠시 후 다시 시도하거나 관리자에게 문의해 주세요."
      );
    }
    if (response.status === 404) {
      throw new Error(
        "분석 API(/api/extract)를 찾을 수 없습니다. Cloudflare Pages에 배포되어 있는지 확인해 주세요."
      );
    }
    if (response.status === 413) {
      throw new Error("요청 용량이 너무 큽니다. 파일 수를 줄이거나 다시 시도해 주세요.");
    }
    if (response.status >= 502) {
      throw new Error(
        `서버 오류 또는 시간 초과 (HTTP ${response.status}). 잠시 후 다시 시도해 주세요.`
      );
    }
    throw new Error(`서버 응답이 비었습니다 (HTTP ${response.status}).`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`서버 응답 형식 오류 (HTTP ${response.status}): ${text.slice(0, 300)}`);
  }
}

function mergeExtractionResults(target, source) {
  if (!source) return target;
  const out = target ? { ...target } : {};

  const scalarKeys = [
    "name",
    "residentId",
    "withholdingFinalIncome",
    "withholdingTaxYear",
    "withholdingTypeAFinalIncome",
    "withholdingTypeATaxYear",
    "incomeCertificateAmount",
    "incomeCertificateYear",
  ];

  for (const key of scalarKeys) {
    if ((out[key] === null || out[key] === undefined) && source[key] != null) {
      out[key] = source[key];
    }
  }

  if ((source.familyMembers?.length || 0) > (out.familyMembers?.length || 0)) {
    out.familyMembers = source.familyMembers;
  }

  if (source.loans) {
    out.loans = out.loans || {};
    for (const key of ["creditLoanAmount", "collateralLoanAmount", "totalLoanAmount"]) {
      const current = out.loans[key];
      const incoming = source.loans[key];
      if (incoming != null && (current == null || incoming > current)) {
        out.loans[key] = incoming;
      }
    }
    const details = [...(out.loans.loanDetails || []), ...(source.loans.loanDetails || [])];
    if (details.length) out.loans.loanDetails = [...new Set(details)];
  }

  out.detectedDocuments = [...(out.detectedDocuments || []), ...(source.detectedDocuments || [])];
  return out;
}

async function extractChunk(files, chunkIndex, totalChunks) {
  const response = await fetch("/api/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ files }),
  });
  const result = await parseApiResponse(response);
  if (!result.success || !result.data) {
    throw new Error(result.error || `분석 실패 (${chunkIndex + 1}/${totalChunks}배치)`);
  }
  return result.data;
}

function setBusy(busy, step = "") {
  state.busy = busy;
  state.step = step;
  els.dropzone.classList.toggle("is-busy", busy);
  els.dropContent.hidden = busy;
  els.dropBusy.hidden = !busy;
  els.dropStep.textContent = step || "AI가 서류를 분석하고 있습니다...";
  els.submitBtn.disabled = busy || state.files.length === 0;
}

function renderFileList() {
  if (state.files.length === 0) {
    els.fileList.hidden = true;
    els.submitBtn.hidden = true;
    return;
  }

  els.fileList.hidden = false;
  els.submitBtn.hidden = state.busy;
  els.submitBtn.textContent = `${state.files.length}개 서류 분석 시작`;

  els.fileList.innerHTML = `
    <div class="pw-file-list__head">선택된 파일 ${state.files.length}개</div>
    ${state.files
      .map(
        (file, i) => `
      <div class="pw-file-row">
        <span>${file.type === "application/pdf" ? "📄" : "🖼️"}</span>
        <span class="pw-file-row__name">${escapeHtml(file.name)}</span>
        <span class="pw-file-row__meta">${formatSize(file.size)}</span>
        ${
          state.busy
            ? ""
            : `<button type="button" data-remove="${i}" aria-label="제거">제거</button>`
        }
      </div>`
      )
      .join("")}
  `;

  els.fileList.querySelectorAll("[data-remove]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = Number(btn.getAttribute("data-remove"));
      state.files = state.files.filter((_, i) => i !== idx);
      state.error = null;
      renderFileList();
      renderUploadError();
    });
  });
}

function renderUploadError() {
  if (!state.error) {
    els.uploadError.hidden = true;
    els.uploadError.textContent = "";
    return;
  }
  els.uploadError.hidden = false;
  els.uploadError.textContent = state.error;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderFamilyTable(members) {
  return `
    <table class="pw-family-table">
      <thead>
        <tr><th>관계</th><th>성명</th><th>주민등록번호</th></tr>
      </thead>
      <tbody>
        ${members
          .map(
            (m) => `
          <tr>
            <td>${escapeHtml(m.relation || "-")}</td>
            <td>${escapeHtml(m.name || "-")}</td>
            <td>${escapeHtml(m.residentId || "-")}</td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>`;
}

function renderSummary() {
  const summary = state.summary;
  if (!summary) {
    els.result.innerHTML = `
      <div class="pw-empty">
        <div class="pw-empty__icon">📋</div>
        <p><strong>아직 분석된 결과가 없습니다</strong></p>
        <p>서류를 업로드하면 핵심 정보만 한눈에 정리해 드립니다.</p>
      </div>`;
    els.clearBtn.hidden = true;
    return;
  }

  els.clearBtn.hidden = false;

  if (summary.status === "error") {
    els.result.innerHTML = `
      <div class="pw-error">${escapeHtml(summary.errorMessage || "분석에 실패했습니다.")}</div>`;
    return;
  }

  const groupsHtml = FIELD_GROUPS.map((group) => {
    const fieldsHtml = group.fields
      .map((field) => {
        if (field.type === "family") {
          const members = summary.familyMembers;
          return `
            <div class="pw-field" style="display:block">
              <p class="pw-field__label">${escapeHtml(field.label)}</p>
              ${
                members && members.length
                  ? renderFamilyTable(members)
                  : '<p style="margin:0.35rem 0 0;color:var(--muted)">-</p>'
              }
            </div>`;
        }

        let value = null;
        if (field.key.startsWith("loans.")) {
          value = getLoanValue(summary, field.key);
        } else {
          value = summary[field.key];
        }
        const yearLabel = getYearLabel(summary, field.key);
        const display =
          field.type === "currency" ? formatCurrency(value) : value != null && value !== "" ? String(value) : "-";

        return `
          <div class="pw-field">
            <div>
              <p class="pw-field__label">${escapeHtml(field.label)}</p>
              ${yearLabel ? `<p class="pw-field__year">${escapeHtml(yearLabel)}</p>` : ""}
            </div>
            <p class="pw-field__value">${escapeHtml(display)}</p>
          </div>`;
      })
      .join("");

    return `
      <div class="pw-group">
        <div class="pw-group__head">
          <h3>${group.icon} ${escapeHtml(group.title)}</h3>
          <p>출처: ${escapeHtml(group.source)}</p>
        </div>
        ${fieldsHtml}
      </div>`;
  }).join("");

  const loanDetails =
    summary.loans?.loanDetails?.length > 0
      ? `
      <div class="pw-group">
        <div class="pw-group__head"><h3>대출 상세 내역</h3></div>
        <ul class="pw-loan-list">
          ${summary.loans.loanDetails.map((d) => `<li>${escapeHtml(d)}</li>`).join("")}
        </ul>
      </div>`
      : "";

  const detected =
    summary.detectedDocuments?.length > 0
      ? `
      <div class="pw-group">
        <div class="pw-group__head"><h3>인식된 서류</h3></div>
        <div class="pw-chips">
          ${summary.detectedDocuments
            .map((d) => `<span class="pw-chip">${escapeHtml(d.documentType || "기타")}</span>`)
            .join("")}
        </div>
      </div>`
      : "";

  els.result.innerHTML = `
    <div class="pw-result-head">
      <div>
        <h2>통합 추출 결과</h2>
        <p>${summary.uploadedFiles.length}개 파일 · ${new Date(summary.extractedAt).toLocaleString("ko-KR")}</p>
      </div>
    </div>
    <div class="pw-calc-links">
      <p class="pw-calc-links__title">계산기로 보내기 — 소득·대출 잔액 등을 자동 입력합니다</p>
      <div class="pw-calc-links__actions">
        <a class="hub-btn-primary" href="../beotimmok/?from=paperwork">버팀목 전세자금 금리</a>
        <a class="hub-btn-secondary" href="../didimdol/?from=paperwork">디딤돌 DTI·금리</a>
        <a class="hub-btn-secondary" href="../dsr/?from=paperwork">DSR 계산</a>
      </div>
      <p class="pw-calc-links__hint">전세보증금·신규 대출금액·금리는 직접 입력해 주세요.</p>
    </div>
    ${groupsHtml}
    ${loanDetails}
    ${detected}`;
}

function addFiles(fileList) {
  state.error = null;
  const incoming = Array.from(fileList);
  const invalid = incoming.filter((f) => !VALID_TYPES.has(f.type));
  if (invalid.length) {
    state.error = "JPG, PNG, WEBP, PDF 파일만 업로드 가능합니다.";
    renderUploadError();
    return;
  }
  const tooLarge = incoming.filter((f) => f.size > 20 * 1024 * 1024);
  if (tooLarge.length) {
    state.error = "파일 크기는 개당 20MB 이하여야 합니다.";
    renderUploadError();
    return;
  }

  const names = new Set(state.files.map((f) => f.name));
  for (const file of incoming) {
    if (!names.has(file.name)) {
      state.files.push(file);
      names.add(file.name);
    }
  }
  renderFileList();
  renderUploadError();
  els.submitBtn.disabled = state.busy || state.files.length === 0;
}

async function handleSubmit() {
  if (state.files.length === 0) {
    state.error = "최소 1개 이상의 파일을 선택해주세요.";
    renderUploadError();
    return;
  }

  const id = crypto.randomUUID();
  const fileNames = state.files.map((f) => f.name);
  els.globalError.hidden = true;
  setBusy(true, "PDF 변환 중...");

  try {
    const processed = await processFilesForUpload(state.files);
    if (processed.length === 0) {
      throw new Error("파일을 읽을 수 없습니다. PDF 또는 이미지 형식을 확인해 주세요.");
    }

    const chunks = [];
    for (let i = 0; i < processed.length; i += API_CHUNK_SIZE) {
      chunks.push(processed.slice(i, i + API_CHUNK_SIZE));
    }

    let merged = null;
    for (let i = 0; i < chunks.length; i++) {
      setBusy(
        true,
        chunks.length > 1
          ? `AI 분석 중... (${i + 1}/${chunks.length}배치 · ${processed.length}페이지)`
          : `${processed.length}페이지 AI 분석 중...`
      );
      merged = mergeExtractionResults(merged, await extractChunk(chunks[i], i, chunks.length));
    }

    state.summary = {
      id,
      extractedAt: new Date().toISOString(),
      uploadedFiles: fileNames,
      status: "success",
      ...merged,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "업로드 중 오류가 발생했습니다.";
    els.globalError.hidden = false;
    els.globalError.textContent = message;
    state.summary = {
      id,
      extractedAt: new Date().toISOString(),
      uploadedFiles: fileNames,
      status: "error",
      errorMessage: message,
    };
  } finally {
    setBusy(false);
    saveSummary(state.summary);
    renderSummary();
    renderFileList();
  }
}

function bindEvents() {
  els.dropzone.addEventListener("click", () => {
    if (!state.busy) els.fileInput.click();
  });

  els.fileInput.addEventListener("change", (e) => {
    if (e.target.files?.length) addFiles(e.target.files);
    e.target.value = "";
  });

  ["dragenter", "dragover"].forEach((type) => {
    els.dropzone.addEventListener(type, (e) => {
      e.preventDefault();
      els.dropzone.classList.add("is-dragover");
    });
  });

  ["dragleave", "drop"].forEach((type) => {
    els.dropzone.addEventListener(type, (e) => {
      e.preventDefault();
      els.dropzone.classList.remove("is-dragover");
      if (type === "drop" && e.dataTransfer?.files?.length) {
        addFiles(e.dataTransfer.files);
      }
    });
  });

  els.submitBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    handleSubmit();
  });

  els.clearBtn.addEventListener("click", () => {
    if (!confirm("분석 결과를 초기화하시겠습니까?")) return;
    state.summary = null;
    saveSummary(null);
    renderSummary();
  });
}

function init() {
  state.summary = loadSummary();
  bindEvents();
  renderFileList();
  renderSummary();
  els.globalError.hidden = true;
}

init();
