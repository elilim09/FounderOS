const STORAGE_KEY = "founderos-workspace-data";
const CONTEXT_KEY = "founderos-workspace-context";

const $ = (id) => document.getElementById(id);

const defaultData = {
  tasks: [],
  interviews: [],
  okrs: [],
  risks: [],
  finance: {
    cash: 0,
    monthlyBurn: 1,
    monthlyRevenue: 0,
  },
};

let state = loadState();

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!parsed) return structuredClone(defaultData);
    return {
      ...structuredClone(defaultData),
      ...parsed,
      finance: { ...defaultData.finance, ...(parsed.finance || {}) },
    };
  } catch {
    return structuredClone(defaultData);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function pct(val) {
  return `${Math.max(0, Math.min(100, Number(val) || 0))}%`;
}

function renderContext() {
  const info = $("projectInfo");
  try {
    const c = JSON.parse(localStorage.getItem(CONTEXT_KEY) || "null");
    if (!c) return;
    info.textContent = `${c.startupName || "프로젝트"} · ${c.targetCustomer || "고객 미정"} · 설계ID ${c.designId || "-"}`;
  } catch {
    // ignore malformed context
  }
}

function renderKpis() {
  const totalTasks = state.tasks.length;
  const doneTasks = state.tasks.filter((t) => t.status === "done").length;
  const progress = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;
  $("taskProgress").textContent = `${progress}%`;
  $("taskProgressSub").textContent = `${doneTasks}/${totalTasks} 완료`;

  const netBurn = Math.max(1, Number(state.finance.monthlyBurn) - Number(state.finance.monthlyRevenue));
  const runway = Math.floor(Number(state.finance.cash || 0) / netBurn);
  $("runway").textContent = `${runway}개월`;
  $("runwaySub").textContent = `순소진 ${netBurn.toLocaleString("ko-KR")}원/월`;

  $("interviewCount").textContent = `${state.interviews.length}건`;
  $("interviewSub").textContent = state.interviews.length ? "최근 인터뷰 기반" : "아직 인터뷰 없음";

  const risky = state.risks.filter((r) => r.level !== "low").length;
  $("riskCount").textContent = `${risky}건`;
}

function renderTasks() {
  const box = $("taskList");
  box.innerHTML = state.tasks.map((t) => `
    <div class="item">
      <div>
        <strong>${escapeHtml(t.title)}</strong>
      </div>
      <div class="row">
        <span class="pill ${t.status}">${t.status === "todo" ? "할 일" : t.status === "doing" ? "진행중" : "완료"}</span>
        <button class="btn" data-remove-task="${t.id}">삭제</button>
      </div>
    </div>
  `).join("") || '<p class="sub">작업을 추가해 오늘 실행할 목록을 만드세요.</p>';
}

function renderInterviews() {
  const box = $("interviewList");
  box.innerHTML = state.interviews.map((i) => `
    <div class="item">
      <div>
        <strong>${escapeHtml(i.person)}</strong>
        <div class="sub">${escapeHtml(i.pain)}</div>
      </div>
      <button class="btn" data-remove-interview="${i.id}">삭제</button>
    </div>
  `).join("") || '<p class="sub">인터뷰를 기록해 문제-해결 적합성을 검증하세요.</p>';
}

function renderOkrs() {
  const box = $("okrList");
  box.innerHTML = state.okrs.map((o) => `
    <div class="item">
      <div>
        <strong>${escapeHtml(o.objective)}</strong>
        <div class="sub">KR: ${escapeHtml(o.keyResult)}</div>
        <div class="sub">진척도: ${pct(o.progress)}</div>
      </div>
      <button class="btn" data-remove-okr="${o.id}">삭제</button>
    </div>
  `).join("") || '<p class="sub">분기 목표와 핵심 결과를 세워 방향을 고정하세요.</p>';
}

function renderRisks() {
  const box = $("riskList");
  box.innerHTML = state.risks.map((r) => `
    <div class="item">
      <div>
        <strong>${escapeHtml(r.title)}</strong>
        <div class="sub risk ${r.level}">위험도: ${r.level === "high" ? "높음" : r.level === "mid" ? "중간" : "낮음"}</div>
        <div class="sub">대응: ${escapeHtml(r.mitigation)}</div>
      </div>
      <button class="btn" data-remove-risk="${r.id}">삭제</button>
    </div>
  `).join("") || '<p class="sub">리스크를 문서화하면 실행 중 사고를 줄일 수 있습니다.</p>';
}

function renderFinanceInputs() {
  $("cash").value = state.finance.cash || "";
  $("monthlyBurn").value = state.finance.monthlyBurn || "";
  $("monthlyRevenue").value = state.finance.monthlyRevenue || "";
}

function renderAll() {
  renderContext();
  renderTasks();
  renderInterviews();
  renderOkrs();
  renderRisks();
  renderFinanceInputs();
  renderKpis();
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

$("addTask").addEventListener("click", () => {
  const title = $("taskTitle").value.trim();
  const status = $("taskStatus").value;
  if (title.length < 2) return;
  state.tasks.unshift({ id: uid(), title, status });
  $("taskTitle").value = "";
  saveState();
  renderAll();
});

$("addInterview").addEventListener("click", () => {
  const person = $("interviewPerson").value.trim();
  const pain = $("interviewPain").value.trim();
  if (person.length < 2 || pain.length < 3) return;
  state.interviews.unshift({ id: uid(), person, pain });
  $("interviewPerson").value = "";
  $("interviewPain").value = "";
  saveState();
  renderAll();
});

$("addOkr").addEventListener("click", () => {
  const objective = $("okrObjective").value.trim();
  const keyResult = $("okrKeyResult").value.trim();
  const progress = Number($("okrProgress").value || 0);
  if (objective.length < 3 || keyResult.length < 3) return;
  state.okrs.unshift({ id: uid(), objective, keyResult, progress: Math.max(0, Math.min(100, progress)) });
  $("okrObjective").value = "";
  $("okrKeyResult").value = "";
  $("okrProgress").value = "";
  saveState();
  renderAll();
});

$("saveFinance").addEventListener("click", () => {
  const cash = Number($("cash").value || 0);
  const monthlyBurn = Number($("monthlyBurn").value || 1);
  const monthlyRevenue = Number($("monthlyRevenue").value || 0);
  state.finance = {
    cash: Math.max(0, cash),
    monthlyBurn: Math.max(1, monthlyBurn),
    monthlyRevenue: Math.max(0, monthlyRevenue),
  };
  saveState();
  renderAll();
});

$("addRisk").addEventListener("click", () => {
  const title = $("riskTitle").value.trim();
  const level = $("riskLevel").value;
  const mitigation = $("riskMitigation").value.trim();
  if (title.length < 3 || mitigation.length < 3) return;
  state.risks.unshift({ id: uid(), title, level, mitigation });
  $("riskTitle").value = "";
  $("riskMitigation").value = "";
  saveState();
  renderAll();
});

document.body.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const removeTask = btn.dataset.removeTask;
  if (removeTask) state.tasks = state.tasks.filter((t) => t.id !== removeTask);

  const removeInterview = btn.dataset.removeInterview;
  if (removeInterview) state.interviews = state.interviews.filter((i) => i.id !== removeInterview);

  const removeOkr = btn.dataset.removeOkr;
  if (removeOkr) state.okrs = state.okrs.filter((o) => o.id !== removeOkr);

  const removeRisk = btn.dataset.removeRisk;
  if (removeRisk) state.risks = state.risks.filter((r) => r.id !== removeRisk);

  if (removeTask || removeInterview || removeOkr || removeRisk) {
    saveState();
    renderAll();
  }
});

$("resetWorkspace").addEventListener("click", () => {
  state = structuredClone(defaultData);
  saveState();
  renderAll();
});

renderAll();
