/**
 * 전세보증금 반환보증(안심전세 등) 참고용 심사 조건·보증료 추정
 * — HUG 주택가격·담보 비율 공개 기준을 단순화해 브라우저에서만 계산합니다. (입력·표시: 원, 천단위 콤마)
 */
(function () {
  /** @type {string[]} 선순위 임차보증금(D) 입력이 허용되는 주택 유형(참고) */
  var ALLOWS_SENIOR_LEASE = ["단독주택", "다세대주택", "다가구주택", "다중주택"];

  /** @type {string[]} (C+D) ≤ 담보가액×80% 규칙을 함께 볼 유형 */
  var USES_CD80 = ["단독주택", "다세대주택", "다가구주택", "다중주택"];

  /** 필수 금액·면적: 비어 있으면 NaN */
  function parseNumRaw(val) {
    if (val == null || val === "") return NaN;
    var s = String(val).replace(/,/g, "").replace(/\s/g, "").trim();
    if (s === "") return NaN;
    var n = parseFloat(s);
    return Number.isFinite(n) ? n : NaN;
  }

  /** 선택 항목: 비어 있으면 0 */
  function parseNumOrZero(val) {
    var n = parseNumRaw(val);
    return Number.isFinite(n) ? n : 0;
  }

  function $(id) {
    return document.getElementById(id);
  }

  function formatWon(v) {
    if (!Number.isFinite(v)) return "—";
    return Math.round(v).toLocaleString("ko-KR") + " 원";
  }

  /** 담보로 인정되는 주택 가액 = A × 90% (원) */
  function collateralCap(A) {
    return A * 0.9;
  }

  /** 부채비율 = (B+C+D) / (A×90%) */
  function debtRatio(B, C, D, cap) {
    if (!Number.isFinite(cap) || cap <= 0) return NaN;
    return (B + C + D) / cap;
  }

  /**
   * 연간 보증요율(%) — 공시 구간을 단순화(참고). 실제 요율은 HUG 홈페이지·약관 기준.
   */
  function annualFeePercent(ratio) {
    if (!Number.isFinite(ratio) || ratio < 0) return 0.128;
    if (ratio <= 0.5) return 0.115;
    if (ratio <= 0.6) return 0.128;
    if (ratio <= 0.7) return 0.141;
    return 0.154;
  }

  /** 기타주택: (토지분+건물시가)×140% (원) */
  function calcHousePriceFromLandBuilding() {
    var landPerM2 = parseNumRaw($("rg-land-price").value); // 원/㎡
    var area = parseNumRaw($("rg-land-area").value); // ㎡
    var rn = parseFloat($("rg-ratio-n").value) || 0;
    var rd = parseFloat($("rg-ratio-d").value) || 1;
    var building = parseNumRaw($("rg-building").value); // 원

    if (!Number.isFinite(landPerM2) || landPerM2 < 0) return NaN;
    if (!Number.isFinite(area) || area <= 0) return NaN;
    if (!Number.isFinite(rn) || !Number.isFinite(rd) || rd === 0) return NaN;
    if (!Number.isFinite(building) || building < 0) return NaN;

    var landWon = landPerM2 * area * (rn / rd);
    return (landWon + building) * 1.4;
  }

  function setWonFieldFormatted(id, value) {
    var el = $(id);
    if (!el) return;
    if (!Number.isFinite(value)) {
      el.value = "";
      return;
    }
    el.value = Math.round(value).toLocaleString("ko-KR");
  }

  var COMMA_WON_IDS = ["rg-a", "rg-b", "rg-c", "rg-d", "rg-wolse", "rg-building", "rg-land-price"];

  function onWonFocus(e) {
    var v = e.target.value;
    if (v) e.target.value = v.replace(/,/g, "");
  }

  function onWonBlur(e) {
    var el = e.target;
    if (!el.value || String(el.value).trim() === "") return;
    var n = parseNumRaw(el.value);
    if (!Number.isFinite(n)) return;
    el.value = Math.round(n).toLocaleString("ko-KR");
  }

  function onLandAreaBlur(e) {
    var el = e.target;
    if (!el.value || String(el.value).trim() === "") return;
    var n = parseNumRaw(el.value);
    if (!Number.isFinite(n)) return;
    el.value = n.toLocaleString("ko-KR", { maximumFractionDigits: 4, minimumFractionDigits: 0 });
  }

  function onLandAreaFocus(e) {
    var v = e.target.value;
    if (v) e.target.value = v.replace(/,/g, "");
  }

  function wireCommaFormatting() {
    var i;
    for (i = 0; i < COMMA_WON_IDS.length; i++) {
      var el = $(COMMA_WON_IDS[i]);
      if (!el) continue;
      el.addEventListener("focus", onWonFocus);
      el.addEventListener("blur", onWonBlur);
    }
    var areaEl = $("rg-land-area");
    if (areaEl) {
      areaEl.addEventListener("focus", onLandAreaFocus);
      areaEl.addEventListener("blur", onLandAreaBlur);
    }
  }

  function runMainCalc() {
    var type = $("rg-type").value;
    var region = $("rg-region").value;
    var A = parseNumRaw($("rg-a").value);
    var B = parseNumRaw($("rg-b").value);
    var C = parseNumOrZero($("rg-c").value);
    var D = parseNumOrZero($("rg-d").value);
    var months = parseFloat($("rg-months").value) || 25;
    var useWolse = $("rg-wolse-check").checked;
    var wolse = parseNumRaw($("rg-wolse").value);
    var convPct = parseFloat($("rg-conv").value);
    if (!Number.isFinite(convPct) || convPct <= 0) convPct = 4;

    var out = $("rg-result");
    out.innerHTML = "";
    out.hidden = true;

    var errors = [];
    var warns = [];

    if (!Number.isFinite(A) || A <= 0) errors.push("주택가격(A)을 입력하세요.");
    if (!Number.isFinite(B) || B < 0) errors.push("전세보증금(B)을 입력하세요.");
    if (!Number.isFinite(C) || C < 0) C = 0;
    if (!Number.isFinite(D) || D < 0) D = 0;

    var Beff = B;
    if (useWolse) {
      if (!Number.isFinite(wolse) || wolse < 0) {
        errors.push("월세(원)를 입력하거나 월세 포함을 해제하세요.");
      } else {
        var convRate = convPct / 100;
        Beff = B + (wolse * 12) / convRate;
        warns.push(
          "전월전환 포함 환산 보증금: 약 " +
            formatWon(Beff) +
            " (전월전환율 " +
            convPct +
            "% 가정)"
        );
      }
    }

    if (D > 0 && ALLOWS_SENIOR_LEASE.indexOf(type) === -1) {
      errors.push(
        "선순위 임차보증금(D)이 있으면, 통상 단독·다세대·다가구·다중주택 등 일부 유형에서만 반환보증 가입이 가능합니다. 현재 선택한 주택 유형에서는 가입이 어려울 수 있습니다."
      );
    }

    var cap = collateralCap(A);
    var maxB = region === "metro" ? 700000000 : 500000000;
    if (Beff > maxB) {
      warns.push(
        "전세보증금 상한 참고: " +
          (region === "metro" ? "수도권 7억" : "수도권 외 5억") +
          " 원 한도 안내가 있습니다. (실제는 상품·고시 기준)"
      );
    }

    if (errors.length) {
      out.hidden = false;
      out.innerHTML =
        '<div class="rg-result-box rg-result-bad"><strong>입력·조건 확인</strong><ul class="doc-list">' +
        errors.map(function (e) {
          return "<li>" + e + "</li>";
        }).join("") +
        "</ul></div>";
      return;
    }

    var sum = Beff + C + D;
    var passSum = sum <= cap;
    var passC = C <= cap * 0.6;
    var passCD80 = true;
    if (USES_CD80.indexOf(type) !== -1) {
      passCD80 = C + D <= cap * 0.8;
    }

    var ratio = debtRatio(Beff, C, D, cap);
    var feePct = annualFeePercent(ratio);
    var guaranteeBase = Beff;
    var feeWon = (guaranteeBase * (feePct / 100) * months) / 12;

    var html = "";
    if (warns.length) {
      html +=
        '<div class="rg-result-box rg-result-warn"><ul class="doc-list">' +
        warns.map(function (w) {
          return "<li>" + w + "</li>";
        }).join("") +
        "</ul></div>";
    }

    html += '<div class="rg-result-box ' + (passSum && passC && passCD80 ? "rg-result-ok" : "rg-result-bad") + '">';
    html += "<p><strong>담보로 인정되는 주택 가액</strong> (A×90%) = " + formatWon(cap) + "</p>";
    html += "<p><strong>B+C+D 합계</strong> = " + formatWon(sum) + " → " + (passSum ? "✓ 한도 이내" : "✗ 한도 초과") + "</p>";
    html += "<p><strong>선순위채권(C)</strong> ≤ 담보가×60% (" + formatWon(cap * 0.6) + ") → " + (passC ? "✓" : "✗") + "</p>";
    if (USES_CD80.indexOf(type) !== -1) {
      html +=
        "<p><strong>C+D 합계</strong> ≤ 담보가×80% (" +
        formatWon(cap * 0.8) +
        ") → " +
        (passCD80 ? "✓" : "✗") +
        "</p>";
    } else {
      html += "<p class=\"field-hint\">선택한 유형은 (C+D)≤담보×80% 검토가 핵심이 아닐 수 있습니다. D는 0으로 두는 경우가 많습니다.</p>";
    }
    html += "<p><strong>부채비율</strong> (합계÷담보가) = " + (Number.isFinite(ratio) ? (ratio * 100).toFixed(1) + "%" : "—") + "</p>";
    html += "<hr style=\"border:none;border-top:1px solid var(--border);margin:0.75rem 0\" />";
    html += "<p><strong>참고 보증대상 금액</strong> (전세보증금 기준) = " + formatWon(guaranteeBase) + "</p>";
    html +=
      "<p><strong>참고 연간 요율</strong> (부채비율 구간) ≈ " +
      feePct +
      "% · <strong>예상 보증료</strong> (" +
      months +
      "개월, 일할) ≈ " +
      formatWon(feeWon) +
      "</p>";
    html +=
      '<p class="field-hint">보증료는 할인(취약계층)·보증기간 일수·일시납/분할 등에 따라 달라집니다. 반드시 HUG·취급 기관에서 확정하세요.</p>';
    html += "</div>";

    out.innerHTML = html;
    out.hidden = false;
  }

  function runLandCalc() {
    var A = calcHousePriceFromLandBuilding();
    var el = $("rg-land-result");
    if (!Number.isFinite(A)) {
      el.textContent = "토지공시지가(원/㎡)·면적·대지권 비율·건물시가표준액(원)을 확인하세요.";
      el.className = "field-hint";
      return;
    }
    el.textContent = "산출 주택가격(A) ≈ " + formatWon(A) + " (140% 적용)";
    el.className = "field-hint";
    el.style.color = "var(--ok)";
    setWonFieldFormatted("rg-a", A);
  }

  function applyLandToA() {
    var A = calcHousePriceFromLandBuilding();
    if (!Number.isFinite(A)) {
      runLandCalc();
      return;
    }
    setWonFieldFormatted("rg-a", A);
    runLandCalc();
  }

  function resetMain() {
    $("rg-a").value = "";
    $("rg-b").value = "";
    $("rg-c").value = "";
    $("rg-d").value = "";
    $("rg-wolse").value = "";
    $("rg-result").innerHTML = "";
    $("rg-result").hidden = true;
  }

  function resetLand() {
    $("rg-land-price").value = "";
    $("rg-land-area").value = "";
    $("rg-ratio-n").value = "";
    $("rg-ratio-d").value = "";
    $("rg-building").value = "";
    $("rg-land-result").textContent = "";
  }

  document.addEventListener("DOMContentLoaded", function () {
    wireCommaFormatting();
    $("rg-calc-main").addEventListener("click", runMainCalc);
    $("rg-reset-main").addEventListener("click", resetMain);
    $("rg-calc-land").addEventListener("click", runLandCalc);
    $("rg-apply-a").addEventListener("click", applyLandToA);
    $("rg-reset-land").addEventListener("click", resetLand);
  });
})();
