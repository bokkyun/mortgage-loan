/**
 * 전세보증금 반환보증(안심전세 등) 참고용 심사 조건·보증료 추정
 * — HUG 주택가격·담보 비율 공개 기준을 단순화해 브라우저에서만 계산합니다. (입력·표시: 원, 천단위 콤마)
 * @version hug-table-5 — 결과: 주택가·부채비율·요율·예상보증료 4행
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

  /**
   * 보증료(반환보증) 요율용 부채비율 = (전세보증금+선순위채권) ÷ 주택가격(A) — HUG 자료(참고)
   * 예: A=1억, B=7천만 → 70% / A=1억, C=1천, B=7천 → 80%
   */
  function feeDebtRatio(B, C, A) {
    if (!Number.isFinite(A) || A <= 0) return NaN;
    return (B + C) / A;
  }

  /** 아파트 여부(요율표 상 아파트 vs 기타) */
  function isApartmentType(type) {
    return type === "아파트";
  }

  /**
   * 요율표 세 구간 (HUG 표기와 동일하게): 70% 이하 / 70% 초과·80% 미만 / 80% 이상
   * — (B+C)/A가 정확히 80%인 경우는 중간이 아니라 세 번째(80% 이상) 칸.
   * — 부동소수 오차 방지: 10(B+C)와 7A·8A를 원 단위 정수로 비교.
   */
  function feeTierColumn(B, C, A) {
    if (!Number.isFinite(A) || A <= 0) return 2;
    var n = 10 * (B + C);
    var a7 = 7 * A;
    var a8 = 8 * A;
    if (n <= a7) return 0;
    if (n < a8) return 1;
    return 2;
  }

  /**
   * 반환보증 기준 연요율(%) — 보증금액 구간·주택 유형·부채비율 단계표(참고, HUG)
   * @returns {number} 예: 0.097 = 연 0.097%
   */
  function baseAnnualReturnFeePercent(guaranteeWon, apt, B, C, A) {
    if (!Number.isFinite(guaranteeWon) || guaranteeWon < 0) return NaN;
    if (!Number.isFinite(A) || A <= 0) return NaN;
    var col = feeTierColumn(B, C, A);
    var row;
    if (guaranteeWon <= 100000000) row = 0;
    else if (guaranteeWon <= 200000000) row = 1;
    else if (guaranteeWon <= 500000000) row = 2;
    else row = 3;
    var tApt = [
      [0.097, 0.117, 0.137],
      [0.102, 0.124, 0.146],
      [0.107, 0.131, 0.154],
      [0.113, 0.138, 0.164],
    ];
    var tOth = [
      [0.111, 0.142, 0.172],
      [0.117, 0.151, 0.184],
      [0.124, 0.161, 0.197],
      [0.132, 0.172, 0.211],
    ];
    var t = apt ? tApt : tOth;
    return t[row][col];
  }

  /** 선순위채권(C) > 주택가(A)의 50%이면 기준 연요율에 10%p 할증(×1.1) — HUG 안내(참고) */
  function hasSeniorLienSurcharge(C, A) {
    if (!Number.isFinite(A) || A <= 0) return false;
    return C / A > 0.5;
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

    var guaranteeBase = Beff;
    var rFee = feeDebtRatio(Beff, C, A);
    var baseFeePct = baseAnnualReturnFeePercent(guaranteeBase, isApartmentType(type), Beff, C, A);
    var liSurch = hasSeniorLienSurcharge(C, A);
    var feePct = liSurch ? baseFeePct * 1.1 : baseFeePct;
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

    var pctStr = Number.isFinite(rFee) ? (rFee * 100).toFixed(1) + "%" : "—";
    var rateLine = Number.isFinite(feePct) ? feePct.toFixed(3) + "%/년" : "—";
    if (liSurch && Number.isFinite(baseFeePct) && Number.isFinite(feePct)) {
      rateLine = baseFeePct.toFixed(3) + "% → " + feePct.toFixed(3) + "%/년 (할증)";
    }
    html += '<div class="rg-result-box rg-result-ok rg-result-fee-simple">';
    html += "<p><strong>주택가액 (A)</strong> " + formatWon(A) + "</p>";
    html += "<p><strong>부채비율</strong> " + pctStr + "</p>";
    html += "<p><strong>적용 요율</strong> " + rateLine + "</p>";
    html += "<p><strong>예상 보증료</strong> " + formatWon(feeWon) + "</p>";
    html +=
      '<p class="field-hint" style="margin-top:0.5rem">전세 ' +
      formatWon(guaranteeBase) +
      "·" +
      months +
      "개월 일할, 참고 추정(실제는 HUG·취급 기관 기준)입니다.</p>";
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
