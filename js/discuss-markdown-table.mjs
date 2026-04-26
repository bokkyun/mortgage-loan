/** 마크다운 표 문자열 생성 + textarea 커서 위치 삽입 */

export function buildMarkdownTable(dataRows, cols) {
  var dr = parseInt(String(dataRows), 10);
  var co = parseInt(String(cols), 10);
  if (!Number.isFinite(dr) || dr < 1) dr = 3;
  if (dr > 20) dr = 20;
  if (!Number.isFinite(co) || co < 2) co = 3;
  if (co > 10) co = 10;

  var headerCells = [];
  for (var c = 0; c < co; c++) {
    headerCells.push("제목" + (c + 1));
  }
  var lines = [];
  lines.push("| " + headerCells.join(" | ") + " |");
  lines.push("| " + Array(co).fill("---").join(" | ") + " |");
  for (var r = 0; r < dr; r++) {
    var cells = [];
    for (var j = 0; j < co; j++) {
      cells.push(" ");
    }
    lines.push("| " + cells.join(" | ") + " |");
  }
  return "\n" + lines.join("\n") + "\n";
}

export function insertAtCursor(textarea, text) {
  if (!textarea || text == null) return;
  var start = textarea.selectionStart;
  var end = textarea.selectionEnd;
  var v = textarea.value;
  textarea.value = v.slice(0, start) + text + v.slice(end);
  var pos = start + text.length;
  textarea.selectionStart = textarea.selectionEnd = pos;
  textarea.focus();
}
