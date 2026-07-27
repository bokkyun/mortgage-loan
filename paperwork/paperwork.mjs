import {
  DEFAULT_INCOME_YEARS,
  LOAN_PRODUCTS,
  checklistProgress,
  emptySlots,
  estimateFromSlots,
  formatDocumentGuideText,
  getChecklistItems,
  getIncomeDocumentGuide,
  getLoanProduct,
  listMissingRequired,
  mergeSlots,
  requiredIncomeYears,
  slotsReadyForIncome,
  slotsToSummary,
} from "../js/loan-estimate.js";

const STORAGE_KEY = "mortgage-loan-paperwork-summary";
const CHAT_STORAGE_KEY = "mortgage-loan-paperwork-chat";

const Y_OLD = DEFAULT_INCOME_YEARS.older;
const Y_NEW = DEFAULT_INCOME_YEARS.newer;

const WELCOME = `안녕하세요. 대출 정보 상담입니다.

오른쪽 체크리스트 **상단에서 상품을 먼저 선택**해 주세요.
· 디딤돌 · 버팀목 · 주택담보대출 · 반환보증보험 · 수수료

선택하신 상품의 **필수 항목**이 빨간 글씨로 표시됩니다. 대화로 말씀하시거나 오른쪽에서 직접 입력하세요.

공통 예시:
입사일 2020-03-01, 휴직 없음, ${Y_OLD}년 소득 42000000원, ${Y_NEW}년 소득 45000000원, 청약저축 72회, 대출 2억원 30년

휴직이면 휴직 시작일을 알려 주시면 필요 서류 연도를 안내합니다.
규정 질문도 가능합니다. 예: 「청약 60회면 금리 우대가 얼마인가요?」`;

const FILL_SAMPLES = {
  bulk: `입사일 2020-03-01, 휴직 없음, ${Y_OLD}년 소득 42000000원, ${Y_NEW}년 소득 45000000원, 청약저축 72회, 대출 2억원 30년`,
  leave:
    "입사일 2018-05-10, 휴직시작 2025-02-01, 휴직 중, 2023년 3800만원, 2024년 4000만원, 청약 130회, 대출 1억8천 30년",
  docs: "휴직시작 2024-06-01인데 소득 서류 몇 년도 준비해야 하나요?",
  qa: "청약저축 납입 60회·120회·180회일 때 디딤돌 금리 우대는 각각 얼마인가요?",
  calc: "지금까지 입력한 값으로 인정소득·금리·DTI·DSR 계산해줘",
};

const state = {
  messages: [],
  slots: emptySlots(),
  estimate: null,
  busy: false,
};

const els = {
  log: document.getElementById("pw-chat-log"),
  form: document.getElementById("pw-chat-form"),
  input: document.getElementById("pw-chat-input"),
  send: document.getElementById("pw-send"),
  clear: document.getElementById("pw-clear"),
  result: document.getElementById("pw-result"),
  globalError: document.getElementById("pw-global-error"),
  chips: document.getElementById("pw-quick-chips"),
};

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatCurrency(value) {
  if (value == null || value === "" || !Number.isFinite(Number(value))) return "-";
  return new Intl.NumberFormat("ko-KR").format(Math.round(Number(value))) + "원";
}

function formatPct(value) {
  if (value == null || !Number.isFinite(Number(value))) return "-";
  return `${Number(value).toFixed(2)}%`;
}

function loadChatState() {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveChatState() {
  try {
    localStorage.setItem(
      CHAT_STORAGE_KEY,
      JSON.stringify({
        messages: state.messages.slice(-40),
        slots: state.slots,
      })
    );
  } catch {
    /* ignore */
  }
}

function saveSummary(summary) {
  try {
    if (summary) localStorage.setItem(STORAGE_KEY, JSON.stringify(summary));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function refreshEstimate() {
  const guide = getIncomeDocumentGuide(state.slots);
  const product = state.slots.loanProduct || "didimdol";
  const incomeProducts = ["didimdol", "beotimmok", "mortgage"];

  if (incomeProducts.includes(product) && !slotsReadyForIncome(state.slots)) {
    state.estimate = { ok: false, guide, missing: listMissingRequired(state.slots) };
    saveSummary(null);
    return;
  }

  if (product === "didimdol" || product === "beotimmok") {
    const estimate = estimateFromSlots(state.slots);
    state.estimate = estimate;
    if (estimate.ok) saveSummary(slotsToSummary(state.slots, estimate));
    else saveSummary(null);
    return;
  }

  if (product === "mortgage" && slotsReadyForIncome(state.slots)) {
    const estimate = estimateFromSlots(state.slots);
    state.estimate = estimate;
    if (estimate.ok) saveSummary(slotsToSummary(state.slots, estimate));
    else saveSummary(null);
    return;
  }

  state.estimate = { ok: false, guide, missing: listMissingRequired(state.slots) };
  saveSummary(null);
}

/** 클라이언트 휴리스틱 — AI 없이도 한 방 입력 파싱 */
function parseLocalSlots(text) {
  const t = String(text || "");
  const slots = {};

  if (/디딤돌/.test(t)) slots.loanProduct = "didimdol";
  else if (/버팀목/.test(t)) slots.loanProduct = "beotimmok";
  else if (/주택담보|주담대|DSR/i.test(t)) slots.loanProduct = "mortgage";
  else if (/반환보증|보증보험/.test(t)) slots.loanProduct = "returnGuarantee";
  else if (/수수료|보증료/.test(t) && !/반환보증/.test(t)) slots.loanProduct = "fee";

  const normalizeDate = (raw) => {
    const s = String(raw).trim();
    let m = s.replace(/[./]/g, "-").match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (!m) {
      m = s.match(/^(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일?$/);
    }
    if (!m) return null;
    return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  };

  const dateNear = (labelRe) => {
    const patterns = [
      new RegExp(
        labelRe.source + "[\\s:]*([0-9]{4}[./-][0-9]{1,2}[./-][0-9]{1,2})",
        "i"
      ),
      new RegExp(
        labelRe.source + "[\\s:]*([0-9]{4}\\s*년\\s*[0-9]{1,2}\\s*월\\s*[0-9]{1,2}\\s*일?)",
        "i"
      ),
    ];
    for (const re of patterns) {
      const m = t.match(re);
      if (m) {
        const d = normalizeDate(m[1]);
        if (d) return d;
      }
    }
    return null;
  };

  const emp = dateNear(/입사(?:일)?|재직\s*시작/);
  if (emp) slots.employmentStartDate = emp;

  const leaveStart = dateNear(/휴직\s*시작(?:일)?|휴직일/);
  if (leaveStart) slots.leaveStartDate = leaveStart;

  const leaveEnd = dateNear(/휴직\s*종료(?:일)?|복직(?:일)?/);
  if (leaveEnd) slots.leaveEndDate = leaveEnd;

  if (slots.leaveStartDate && slots.leaveEndDate) {
    slots.employmentStatus = "복직";
  } else if (slots.leaveStartDate) {
    slots.employmentStatus = "휴직";
  }

  if (/휴직\s*없|휴직\s*안\s*함|휴직\s*미해당/.test(t)) {
    slots.leaveStartDate = null;
    slots.leaveEndDate = null;
    slots.employmentStatus = "1년이상재직";
  }

  const moneyForYear = (year) => {
    const patterns = [
      new RegExp(`${year}\\s*년[^0-9]{0,12}([0-9][0-9,]{2,})\\s*원`),
      new RegExp(`${year}\\s*년[^0-9]{0,12}([0-9]+(?:\\.[0-9]+)?)\\s*만\\s*원`),
      new RegExp(`([0-9][0-9,]{2,})\\s*원[^0-9]{0,8}${year}`),
      new RegExp(`([0-9]+(?:\\.[0-9]+)?)\\s*만\\s*원[^0-9]{0,8}${year}`),
    ];
    for (const re of patterns) {
      const m = t.match(re);
      if (!m) continue;
      const raw = m[1].replace(/,/g, "");
      if (/만/.test(re.source) || /만\s*원/.test(m[0])) {
        return Math.round(parseFloat(raw) * 10000);
      }
      return Math.round(parseFloat(raw));
    }
    return null;
  };

  const incomeByYear = {};
  for (const year of [2022, 2023, 2024, 2025, 2026]) {
    const amt = moneyForYear(year);
    if (amt) {
      incomeByYear[year] = amt;
      slots[`incomeYear${year}`] = amt;
    }
  }
  if (Object.keys(incomeByYear).length) slots.incomeByYear = incomeByYear;

  const sub = t.match(
    /(?:청약|청약저축|납입(?:회차)?|인정회차)[^\d]{0,10}(\d{1,3})\s*회?/
  );
  if (sub) slots.housingSubscriptionPaymentCount = Number(sub[1]);

  const parseMoneyNear = (labelRe) => {
    const patterns = [
      new RegExp(labelRe.source + "[^0-9]{0,10}([0-9]+(?:\\.[0-9]+)?)\\s*억", "i"),
      new RegExp(labelRe.source + "[^0-9]{0,10}([0-9][0-9,]{2,})\\s*원", "i"),
      new RegExp(labelRe.source + "[^0-9]{0,10}([0-9]+(?:\\.[0-9]+)?)\\s*만\\s*원", "i"),
    ];
    for (const re of patterns) {
      const m = t.match(re);
      if (!m) continue;
      const raw = m[1].replace(/,/g, "");
      if (/억/.test(m[0])) return Math.round(parseFloat(raw) * 100000000);
      if (/만/.test(m[0])) return Math.round(parseFloat(raw) * 10000);
      return Math.round(parseFloat(raw));
    }
    return null;
  };

  const loanMan = t.match(/대출[^\d]{0,8}([0-9]+(?:\.[0-9]+)?)\s*억/);
  if (loanMan) {
    slots.loanAmount = Math.round(parseFloat(loanMan[1]) * 100000000);
  } else {
    const loanWon = t.match(/대출[^\d]{0,8}([0-9][0-9,]{4,})\s*원/);
    if (loanWon) slots.loanAmount = Number(loanWon[1].replace(/,/g, ""));
    else {
      const loanManwon = t.match(/대출[^\d]{0,8}([0-9]+)\s*만\s*원/);
      if (loanManwon) slots.loanAmount = Number(loanManwon[1]) * 10000;
    }
  }

  const housePrice = parseMoneyNear(/주택가격|주택가|시세|A값?/);
  if (housePrice) slots.housePrice = housePrice;
  const lease = parseMoneyNear(/전세보증금|보증금|B값?/);
  if (lease) slots.leaseDeposit = lease;
  const senior = parseMoneyNear(/선순위채권|선순위\s*저당|C값?/);
  if (senior) slots.seniorLien = senior;
  const area = t.match(/(?:전용면적|면적)[^\d]{0,8}([0-9]+(?:\.[0-9]+)?)\s*㎡?/);
  if (area) slots.exclusiveArea = Number(area[1]);
  const rate = t.match(/(?:금리|이율)[^\d]{0,8}([0-9]+(?:\.[0-9]+)?)\s*%?/);
  if (rate) slots.loanRatePct = Number(rate[1]);

  const term = t.match(/(\d{2})\s*년/);
  if (term && [10, 15, 20, 30].includes(Number(term[1]))) {
    slots.loanTermYears = Number(term[1]);
  }

  if (/복직/.test(t) && slots.leaveEndDate) slots.employmentStatus = "복직";
  else if (/휴직/.test(t) && slots.leaveStartDate && !slots.leaveEndDate) {
    slots.employmentStatus = "휴직";
  }

  return slots;
}

function appendMessage(role, content) {
  state.messages.push({ role, content });
  saveChatState();
  renderChat();
}

function renderChat() {
  els.log.innerHTML = state.messages
    .map((m) => {
      const cls = m.role === "user" ? "pw-msg pw-msg--user" : "pw-msg pw-msg--bot";
      return `<div class="${cls}"><div class="pw-msg__bubble">${escapeHtml(m.content).replace(
        /\n/g,
        "<br>"
      )}</div></div>`;
    })
    .join("");
  els.log.scrollTop = els.log.scrollHeight;
}

function renderDocGuide(guide) {
  if (!guide) return "";
  const years = guide.years || [];
  const yearChips = years
    .map((y, idx) => {
      const ok = guide.filled?.[y];
      const role = idx === 0 ? "전전년" : "전년";
      return `<span class="pw-year-chip ${ok ? "pw-year-chip--ok" : "pw-year-chip--need"}">${role} ${y}년 · ${
        ok ? "입력됨" : "필요"
      }</span>`;
    })
    .join("");

  const docs = (guide.documents || [])
    .map((d) => `<li>${escapeHtml(d)}</li>`)
    .join("");
  const notes = (guide.notes || [])
    .map((n) => `<li>${escapeHtml(n)}</li>`)
    .join("");

  return `
    <div class="pw-group pw-group--docs">
      <div class="pw-group__head">
        <h3>📋 ${escapeHtml(guide.title)}</h3>
        <p>${escapeHtml(guide.summary)}</p>
      </div>
      ${yearChips ? `<div class="pw-year-chips">${yearChips}</div>` : ""}
      <div class="pw-docs-body">
        <p class="pw-docs-label">준비 서류</p>
        <ul class="pw-docs-list">${docs}</ul>
        ${
          notes
            ? `<p class="pw-docs-label">참고</p><ul class="pw-docs-notes">${notes}</ul>`
            : ""
        }
        ${
          guide.nextHint
            ? `<p class="pw-docs-next">${escapeHtml(guide.nextHint)}</p>`
            : ""
        }
      </div>
    </div>`;
}

function formatInputDisplay(item) {
  if (item.value === "" || item.value == null) return "";
  if (item.inputType === "money") {
    const n = Number(item.value);
    return Number.isFinite(n) ? n.toLocaleString("ko-KR") : String(item.value);
  }
  return String(item.value);
}

function renderChecklistInput(item) {
  const missing = item.required && !item.filled;
  const val = formatInputDisplay(item);
  const reqMark = item.required
    ? `<span class="pw-req ${missing ? "pw-req--missing" : "pw-req--ok"}">${
        missing ? "필수·미입력" : "필수"
      }</span>`
    : `<span class="pw-req pw-req--opt">선택</span>`;

  let control = "";
  if (item.inputType === "select") {
    const opts = (item.options || [])
      .map(
        (o) =>
          `<option value="${escapeHtml(String(o.value))}" ${
            String(o.value) === String(item.value) ? "selected" : ""
          }>${escapeHtml(o.label)}</option>`
      )
      .join("");
    control = `<select class="pw-check-input" data-slot="${escapeHtml(item.key)}" data-type="select">${opts}</select>`;
  } else if (item.inputType === "date") {
    control = `<input class="pw-check-input" type="date" data-slot="${escapeHtml(
      item.key
    )}" data-type="date" value="${escapeHtml(String(item.value || ""))}" />`;
  } else if (item.inputType === "money") {
    control = `<input class="pw-check-input" type="text" inputmode="numeric" data-slot="${escapeHtml(
      item.key
    )}" data-type="money" data-year="${item.year || ""}" placeholder="${escapeHtml(
      item.placeholder || "금액(원)"
    )}" value="${escapeHtml(val)}" />`;
  } else {
    control = `<input class="pw-check-input" type="number" data-slot="${escapeHtml(
      item.key
    )}" data-type="number" step="${item.step || "1"}" placeholder="${escapeHtml(
      item.placeholder || ""
    )}" value="${escapeHtml(String(item.value ?? ""))}" />`;
  }

  return `
    <div class="pw-check-row ${missing ? "pw-check-row--missing" : item.filled ? "pw-check-row--ok" : ""}">
      <div class="pw-check-row__meta">
        <span class="pw-check-mark" aria-hidden="true">${item.filled ? "✓" : item.required ? "!" : "·"}</span>
        <div>
          <p class="pw-check-row__label ${missing ? "pw-check-row__label--missing" : ""}">${escapeHtml(
            item.label
          )}</p>
          ${item.hint ? `<p class="pw-check-row__hint">${escapeHtml(item.hint)}</p>` : ""}
          ${reqMark}
        </div>
      </div>
      <div class="pw-check-row__control">${control}</div>
    </div>`;
}

function renderProductSelector() {
  const current = state.slots.loanProduct || "didimdol";
  const buttons = LOAN_PRODUCTS.map(
    (p) =>
      `<button type="button" class="pw-product-btn ${
        p.id === current ? "pw-product-btn--active" : ""
      }" data-product="${p.id}">${escapeHtml(p.label)}</button>`
  ).join("");
  return `
    <div class="pw-group pw-group--product">
      <div class="pw-group__head">
        <h3>상담 상품</h3>
        <p>먼저 상품을 고르면 아래 필수 항목이 맞춰집니다</p>
      </div>
      <div class="pw-product-grid" role="group" aria-label="대출 상품 선택">${buttons}</div>
    </div>`;
}

function renderChecklist() {
  const items = getChecklistItems(state.slots);
  const progress = checklistProgress(state.slots);
  const missing = listMissingRequired(state.slots);
  const product = getLoanProduct(state.slots.loanProduct);

  const missingBanner = missing.length
    ? `<p class="pw-missing pw-missing--alert">필수 미입력: ${escapeHtml(missing.join(", "))}</p>`
    : `<p class="pw-missing pw-missing--ok">${escapeHtml(
        product.label
      )} 필수 항목이 모두 입력되었습니다.</p>`;

  const rows = items.map(renderChecklistInput).join("");

  return `
    <div class="pw-group pw-group--checklist">
      <div class="pw-group__head">
        <h3>필수 체크리스트</h3>
        <p>${escapeHtml(product.label)} · ${progress.filled}/${progress.total} 완료</p>
      </div>
      <div class="pw-checklist-progress" aria-hidden="true">
        <div class="pw-checklist-progress__bar" style="width:${
          progress.total ? Math.round((progress.filled / progress.total) * 100) : 0
        }%"></div>
      </div>
      ${missingBanner}
      <div class="pw-checklist-body">${rows}</div>
    </div>`;
}

function renderCalcLinks() {
  const product = getLoanProduct(state.slots.loanProduct);
  const primary = `<a class="hub-btn-primary" href="${product.calcHref}">${escapeHtml(
    product.label
  )} 계산기로</a>`;
  const extras = LOAN_PRODUCTS.filter((p) => p.id !== product.id)
    .slice(0, 3)
    .map((p) => `<a class="hub-btn-secondary" href="${p.calcHref}">${escapeHtml(p.short)}</a>`)
    .join("");
  return `
    <div class="pw-calc-links">
      <p class="pw-calc-links__title">상세 계산기로 보내기</p>
      <div class="pw-calc-links__actions">${primary}${extras}</div>
      <p class="pw-calc-links__hint">입력한 값이 가능한 범위에서 자동 반영됩니다.</p>
    </div>`;
}

function renderResult() {
  const guide = getIncomeDocumentGuide(state.slots);
  if (state.estimate) state.estimate.guide = guide;
  const product = state.slots.loanProduct || "didimdol";
  const estimate = state.estimate;
  const showIncomeGuide = ["didimdol", "beotimmok", "mortgage"].includes(product);

  let estimateHtml = "";
  if ((product === "didimdol" || product === "beotimmok" || product === "mortgage") && estimate?.ok) {
    const dtiJudge =
      estimate.dti == null
        ? ""
        : estimate.dti <= 60
          ? '<span class="pw-badge pw-badge--ok">DTI 60% 이내 (참고)</span>'
          : '<span class="pw-badge pw-badge--warn">DTI 60% 초과 (참고)</span>';
    estimateHtml = `
      <div class="pw-group pw-group--estimate">
        <div class="pw-group__head">
          <h3>참고 산출 결과</h3>
          <p>${escapeHtml(estimate.incomeReason || "")}</p>
        </div>
        <div class="pw-field">
          <p class="pw-field__label">인정 연소득</p>
          <p class="pw-field__value">${escapeHtml(formatCurrency(estimate.income))}</p>
        </div>
        <div class="pw-field">
          <p class="pw-field__label">디딤돌 기본금리</p>
          <p class="pw-field__value">${escapeHtml(formatPct(estimate.rate.base))} (${estimate.rate.term}년)</p>
        </div>
        <div class="pw-field">
          <p class="pw-field__label">청약 우대</p>
          <p class="pw-field__value">${escapeHtml(estimate.rate.savingsLabel)}</p>
        </div>
        <div class="pw-field">
          <p class="pw-field__label">예상 적용금리</p>
          <p class="pw-field__value">${escapeHtml(formatPct(estimate.rate.finalRate))}</p>
        </div>
        <div class="pw-field">
          <p class="pw-field__label">DTI</p>
          <p class="pw-field__value">${
            estimate.dti == null ? "대출금액 입력 시 산출" : escapeHtml(formatPct(estimate.dti))
          }</p>
        </div>
        <div class="pw-field">
          <p class="pw-field__label">DSR (참고)</p>
          <p class="pw-field__value">${
            estimate.dsr?.dsr == null
              ? "대출금액 입력 시 산출"
              : escapeHtml(formatPct(estimate.dsr.dsr))
          }</p>
        </div>
        ${dtiJudge ? `<div class="pw-estimate-judge">${dtiJudge}</div>` : ""}
      </div>`;
  } else if (estimate?.error && showIncomeGuide) {
    estimateHtml = `<div class="pw-error">${escapeHtml(estimate.error)}</div>`;
  }

  els.result.innerHTML = `
    <div class="pw-result-head">
      <div>
        <h2>수집·서류 안내</h2>
        <p>상품별 필수 항목을 확인하고 입력하세요</p>
      </div>
    </div>
    ${renderProductSelector()}
    ${renderChecklist()}
    ${showIncomeGuide ? renderDocGuide(guide) : ""}
    ${estimateHtml}
    ${renderCalcLinks()}`;
}

function parseFieldValue(type, raw) {
  if (raw == null || String(raw).trim() === "") return null;
  if (type === "money") {
    const n = Number(String(raw).replace(/,/g, "").replace(/\s/g, ""));
    return Number.isFinite(n) && n >= 0 ? n : null;
  }
  if (type === "number") {
    const n = Number(String(raw).replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  if (type === "date" || type === "select") {
    const s = String(raw).trim();
    return s || null;
  }
  return String(raw).trim() || null;
}

function applyChecklistField(el, { focusSlot = null } = {}) {
  const key = el.getAttribute("data-slot");
  const type = el.getAttribute("data-type") || "text";
  const year = el.getAttribute("data-year");
  const value = parseFieldValue(type, el.value);

  const patch = {};
  if (key === "incomeCombined" || (year && /^incomeYear\d{4}$/.test(key))) {
    const y = Number(year) || requiredIncomeYears(state.slots).newer;
    if (value != null) {
      patch[`incomeYear${y}`] = value;
      patch.incomeByYear = { [y]: value };
    } else {
      patch[`incomeYear${y}`] = null;
    }
  } else {
    patch[key] = value;
  }

  if (value == null && key) {
    if (key.startsWith("incomeYear") || key === "incomeCombined") {
      const y = Number(year) || Number(String(key).replace("incomeYear", "")) || requiredIncomeYears(state.slots).newer;
      if (Number.isFinite(y) && state.slots.incomeByYear) {
        delete state.slots.incomeByYear[y];
        state.slots[`incomeYear${y}`] = null;
      }
    } else if (key in state.slots) {
      state.slots[key] = null;
    }
  }

  state.slots = mergeSlots(state.slots, patch);
  if (key === "leaveStartDate" || key === "leaveEndDate") {
    if (state.slots.leaveStartDate && state.slots.leaveEndDate) {
      state.slots.employmentStatus = "복직";
    } else if (state.slots.leaveStartDate) {
      state.slots.employmentStatus = "휴직";
    } else if (
      state.slots.employmentStatus === "휴직" ||
      state.slots.employmentStatus === "복직"
    ) {
      state.slots.employmentStatus = "1년이상재직";
    }
  }
  refreshEstimate();
  saveChatState();
  renderResult();
  if (focusSlot) {
    const next = els.result.querySelector(`.pw-check-input[data-slot="${CSS.escape(focusSlot)}"]`);
    if (next) {
      next.focus();
      if (typeof next.select === "function" && next.type !== "date") {
        try {
          next.select();
        } catch {
          /* ignore */
        }
      }
    }
  }
}

function setBusy(busy) {
  state.busy = busy;
  els.send.disabled = busy;
  els.input.disabled = busy;
  els.send.textContent = busy ? "응답 중…" : "보내기";
}

async function callChatApi(userText) {
  const history = state.messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content }));

  if (!history.length || history[history.length - 1].content !== userText) {
    history.push({ role: "user", content: userText });
  }

  const guide = getIncomeDocumentGuide(state.slots);

  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: history,
      slots: state.slots,
      documentGuide: guide,
    }),
  });

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error("서버 응답을 해석하지 못했습니다.");
  }
  if (!res.ok || !data.success) {
    throw new Error(data.error || `요청 실패 (${res.status})`);
  }
  return data;
}

function applySlots(incoming) {
  const cleaned = { ...incoming };
  if ("leaveStartDate" in incoming && incoming.leaveStartDate == null) {
    state.slots.leaveStartDate = null;
  }
  if ("leaveEndDate" in incoming && incoming.leaveEndDate == null) {
    state.slots.leaveEndDate = null;
  }
  state.slots = mergeSlots(state.slots, cleaned);
  if (state.slots.leaveStartDate && state.slots.leaveEndDate) {
    state.slots.employmentStatus = "복직";
  } else if (state.slots.leaveStartDate) {
    state.slots.employmentStatus = "휴직";
  }
  refreshEstimate();
  saveChatState();
  renderResult();
}

function wantsDocGuide(text) {
  return /서류|몇\s*년|몇년도|준비|무엇을|어떤\s*연|소득\s*증명|원천징수/.test(text);
}

async function handleSend(rawText) {
  const text = String(rawText || "").trim();
  if (!text || state.busy) return;

  els.globalError.hidden = true;
  appendMessage("user", text);
  els.input.value = "";

  const local = parseLocalSlots(text);
  if (Object.keys(local).length) applySlots(local);

  setBusy(true);
  try {
    const data = await callChatApi(text);
    if (data.slots && Object.keys(data.slots).length) {
      applySlots(data.slots);
    } else {
      refreshEstimate();
      renderResult();
    }

    let reply = data.reply || "확인했습니다.";
    const guide = getIncomeDocumentGuide(state.slots);
    const missing = listMissingRequired(state.slots);
    if (missing.length && data.intent === "collect") {
      reply += `\n\n아직 필수 미입력: ${missing.join(", ")}`;
    }

    if (
      wantsDocGuide(text) ||
      data.intent === "docs" ||
      state.slots.leaveStartDate ||
      local.leaveStartDate
    ) {
      const guideText = formatDocumentGuideText(guide);
      if (state.slots.leaveStartDate && /일반 재직/.test(reply)) {
        reply = reply.replace(/\[?일반 재직[\s\S]*$/m, "").trim();
        reply += `\n\n${guideText}`;
      } else if (!/준비 서류|휴직 직전|전전년/.test(reply)) {
        reply += `\n\n${guideText}`;
      }
    }

    if (data.intent === "calculate" || /계산/.test(text)) {
      if (state.estimate?.ok) {
        const e = state.estimate;
        reply += `\n\n[참고 산출]\n· 인정 연소득: ${formatCurrency(e.income)}\n· 예상 금리: ${formatPct(
          e.rate.finalRate
        )}\n· DTI: ${e.dti == null ? "대출금액 필요" : formatPct(e.dti)}\n· DSR: ${
          e.dsr?.dsr == null ? "대출금액 필요" : formatPct(e.dsr.dsr)
        }`;
      } else if (state.estimate?.error) {
        reply += `\n\n계산 불가: ${state.estimate.error}`;
      } else if (missing.length) {
        reply += `\n\n계산 전 필수 항목을 채워 주세요: ${missing.join(", ")}`;
      }
    }

    appendMessage("assistant", reply);
  } catch (err) {
    const message = err instanceof Error ? err.message : "오류가 발생했습니다.";
    const guide = getIncomeDocumentGuide(state.slots);

    if (wantsDocGuide(text) || local.leaveStartDate || slotsReadyForIncome(state.slots)) {
      refreshEstimate();
      renderResult();
      appendMessage(
        "assistant",
        `${
          slotsReadyForIncome(state.slots)
            ? `AI 응답에 실패했지만(${message}), 입력값·서류 안내는 반영했습니다.`
            : `AI 응답에 실패했습니다(${message}). 휴직일·연도만으로도 서류 안내는 가능합니다.`
        }\n\n${formatDocumentGuideText(guide)}`
      );
    } else {
      els.globalError.hidden = false;
      els.globalError.textContent = message;
      appendMessage(
        "assistant",
        `죄송해요. AI 응답에 실패했습니다: ${message}\n입사일·소득·청약회차를 「2020-03-01, ${Y_OLD}년 4200만원…」처럼 적어 주시거나, 오른쪽 체크리스트에서 직접 입력해 보세요.`
      );
    }
  } finally {
    setBusy(false);
  }
}

function resetAll() {
  if (!confirm("대화와 입력값을 모두 초기화할까요?")) return;
  state.messages = [{ role: "assistant", content: WELCOME }];
  state.slots = emptySlots();
  state.estimate = null;
  saveChatState();
  saveSummary(null);
  els.globalError.hidden = true;
  refreshEstimate();
  renderChat();
  renderResult();
}

function bindEvents() {
  els.form.addEventListener("submit", (e) => {
    e.preventDefault();
    handleSend(els.input.value);
  });

  els.input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(els.input.value);
    }
  });

  els.clear.addEventListener("click", resetAll);

  els.chips?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-fill]");
    if (!btn) return;
    const key = btn.getAttribute("data-fill");
    const sample = FILL_SAMPLES[key];
    if (!sample) return;
    els.input.value = sample;
    els.input.focus();
  });

  els.result.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-product]");
    if (!btn) return;
    const id = btn.getAttribute("data-product");
    if (!LOAN_PRODUCTS.some((p) => p.id === id)) return;
    state.slots = mergeSlots(state.slots, { loanProduct: id });
    refreshEstimate();
    saveChatState();
    renderResult();
  });

  els.result.addEventListener("change", (e) => {
    const el = e.target.closest(".pw-check-input");
    if (!el) return;
    applyChecklistField(el);
  });

  els.result.addEventListener(
    "focusout",
    (e) => {
      const el = e.target.closest?.(".pw-check-input");
      if (!el || el.tagName === "SELECT" || el.type === "date") return;
      const related = e.relatedTarget;
      const focusSlot = related?.classList?.contains("pw-check-input")
        ? related.getAttribute("data-slot")
        : null;
      applyChecklistField(el, { focusSlot });
    },
    true
  );
}

function init() {
  const saved = loadChatState();
  if (saved?.messages?.length) {
    state.messages = saved.messages;
    state.slots = mergeSlots(emptySlots(), saved.slots || {});
  } else {
    state.messages = [{ role: "assistant", content: WELCOME }];
    state.slots = emptySlots();
  }
  refreshEstimate();
  bindEvents();
  renderChat();
  renderResult();
}

init();
