async function fetchJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
  return response.json();
}

const [index, manifest, m01, quiz, ignored, aliases, sanitation, quizSecurity] = await Promise.all([
  fetchJson("/data/public/course-index.json"),
  fetchJson("/data/public/content-manifest.json"),
  fetchJson("/data/public/m01-dataset.json"),
  fetchJson("/data/public/quizzes/M01_L01.json"),
  fetchJson("/data/reports/ignored-files.json"),
  fetchJson("/data/reports/alias-resolution.json"),
  fetchJson("/data/reports/sanitization-report.json"),
  fetchJson("/data/reports/quiz-security-report.json"),
]);

const totals = document.querySelector("#totals");
for (const [label, value] of Object.entries({
  Modules: index.course.moduleCount,
  Lessons: index.course.lessonCount,
  Projects: index.course.projectCount,
  Questions: index.course.quizQuestionCount,
})) {
  const metric = document.createElement("div");
  metric.className = "metric";
  const strong = document.createElement("strong");
  strong.textContent = String(value);
  const span = document.createElement("span");
  span.textContent = label;
  metric.append(strong, span);
  totals.append(metric);
}

const rows = [
  ...index.modules.map((item) => ({ code: item.code, type: "MODULE", title: item.titleRu, status: item.status })),
  ...index.lessons.map((item) => ({ code: item.code, type: "LESSON", title: item.titleRu, status: item.status })),
  ...index.projects.map((item) => ({ code: item.code, type: "PROJECT", title: `${item.titleRu} / ${item.formatType}`, status: item.status })),
  ...manifest.assetRegistry.map((item) => ({ code: item.contentCode ?? item.fileName, type: "ASSET", title: item.role ?? item.classification, status: item.status })),
];

const statusSelect = document.querySelector("#status");
for (const status of [...new Set(rows.map((item) => item.status))].sort()) {
  const option = document.createElement("option");
  option.value = status;
  option.textContent = status;
  statusSelect.append(option);
}

function appendCell(row, value) {
  const cell = document.createElement("td");
  cell.textContent = String(value ?? "");
  row.append(cell);
}

function render() {
  const query = document.querySelector("#search").value.toLowerCase();
  const status = statusSelect.value;
  const type = document.querySelector("#type").value;
  const visible = rows.filter((item) =>
    (!query || JSON.stringify(item).toLowerCase().includes(query)) &&
    (!status || item.status === status) &&
    (!type || item.type === type));
  const body = document.querySelector("#rows");
  body.replaceChildren();
  for (const item of visible) {
    const row = document.createElement("tr");
    appendCell(row, item.code);
    appendCell(row, item.type);
    appendCell(row, item.title);
    appendCell(row, item.status);
    body.append(row);
  }
}

document.querySelector("#search").addEventListener("input", render);
statusSelect.addEventListener("change", render);
document.querySelector("#type").addEventListener("change", render);
render();

const first = m01.lessons[0];
document.querySelector("#mnot").textContent = JSON.stringify(first.miniOutput, null, 2).slice(0, 4000);
document.querySelector("#transcript").textContent = JSON.stringify(first.transcript.sections.slice(0, 2), null, 2);
document.querySelector("#vocab").textContent = JSON.stringify(first.vocabularyEntries.slice(0, 3), null, 2);
document.querySelector("#quiz").textContent = JSON.stringify(quiz, null, 2).slice(0, 4000);
document.querySelector("#server-key-status").textContent =
  `Server-only answer sets: ${quizSecurity.serverAnswerCount}. ` +
  "The inspector exposes status only; its explicit data allowlist denies the server-only content root, so no answer key is returned to this browser.";

console.info({
  ignored: ignored.items.length,
  aliases: aliases.items.length,
  sanitationWarnings: sanitation.summary,
  quizSecurityResult: quizSecurity.result,
});
