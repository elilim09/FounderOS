const STORAGE_KEY = "founderos-studio-data";
const CONTEXT_KEY = "founderos-workspace-context";

const ROLE_LABEL = {
  MarketAnalyst: "시장 분석가",
  ProductStrategist: "제품 전략가",
  TechArchitect: "기술 설계자",
  OperationsDesigner: "운영 설계자",
  GrowthPlanner: "성장 기획자",
  ImplementationLead: "실행 리더",
  Facilitator: "진행자",
};

const $ = (id) => document.getElementById(id);

const defaultState = {
  tasks: [],
  risks: [],
  okrs: [],
  interviews: [],
  handoffs: [],
  operationMemo: "",
  finance: { cash: 0, monthlyBurn: 1, monthlyRevenue: 0 },
};

let context = loadContext();
let state = loadState();

hydrateBuildDefaults();
renderAll();
wireEvents();

function loadContext() {
  try {
    return JSON.parse(localStorage.getItem(CONTEXT_KEY) || "null") || {};
  } catch {
    return {};
  }
}

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!parsed) return structuredClone(defaultState);
    return {
      ...structuredClone(defaultState),
      ...parsed,
      finance: { ...defaultState.finance, ...(parsed.finance || {}) },
    };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function hydrateBuildDefaults() {
  const checklist = Array.isArray(context.operationsChecklist) ? context.operationsChecklist : [];
  if (!state.tasks.length && checklist.length) {
    state.tasks = checklist.map((item) => ({
      id: uid(),
      title: item,
      status: "todo",
      source: "build",
    }));
  }

  const agentRoles = getAgentRoles();
  if (!state.handoffs.length && agentRoles.length > 1) {
    const first = agentRoles[0];
    const second = agentRoles[1];
    state.handoffs = [{
      id: uid(),
      task: "핵심 사용자 플로우 정의 초안 전달",
      from: first,
      to: second,
      state: "pending",
    }];
  }
  saveState();
}

function wireEvents() {
  $("addTask").addEventListener("click", () => {
    const title = $("taskTitle").value.trim();
    const status = $("taskStatus").value;
    if (title.length < 2) return;
    state.tasks.unshift({ id: uid(), title, status });
    $("taskTitle").value = "";
    saveAndRender();
  });

  $("addRisk").addEventListener("click", () => {
    const title = $("riskTitle").value.trim();
    const level = $("riskLevel").value;
    const mitigation = $("riskMitigation").value.trim();
    if (title.length < 3 || mitigation.length < 3) return;
    state.risks.unshift({ id: uid(), title, level, mitigation });
    $("riskTitle").value = "";
    $("riskMitigation").value = "";
    saveAndRender();
  });

  $("addOkr").addEventListener("click", () => {
    const objective = $("okrObjective").value.trim();
    const keyResult = $("okrKeyResult").value.trim();
    const progress = clampPct($("okrProgress").value);
    if (objective.length < 3 || keyResult.length < 3) return;
    state.okrs.unshift({ id: uid(), objective, keyResult, progress });
    $("okrObjective").value = "";
    $("okrKeyResult").value = "";
    $("okrProgress").value = "";
    saveAndRender();
  });

  $("addInterview").addEventListener("click", () => {
    const person = $("interviewPerson").value.trim();
    const pain = $("interviewPain").value.trim();
    if (person.length < 2 || pain.length < 3) return;
    state.interviews.unshift({ id: uid(), person, pain });
    $("interviewPerson").value = "";
    $("interviewPain").value = "";
    saveAndRender();
  });

  $("saveFinance").addEventListener("click", () => {
    state.finance = {
      cash: Math.max(0, Number($("cash").value || 0)),
      monthlyBurn: Math.max(1, Number($("monthlyBurn").value || 1)),
      monthlyRevenue: Math.max(0, Number($("monthlyRevenue").value || 0)),
    };
    saveAndRender();
  });

  $("addHandoff").addEventListener("click", () => {
    const task = $("handoffTask").value.trim();
    const from = $("handoffFrom").value;
    const to = $("handoffTo").value;
    const handoffState = $("handoffState").value;
    if (task.length < 3 || !from || !to) return;
    state.handoffs.unshift({ id: uid(), task, from, to, state: handoffState });
    $("handoffTask").value = "";
    saveAndRender();
  });

  $("saveMemo").addEventListener("click", () => {
    state.operationMemo = $("operationMemo").value;
    saveState();
  });

  $("resetStudio").addEventListener("click", () => {
    state = structuredClone(defaultState);
    hydrateBuildDefaults();
    saveAndRender();
  });

  $("exportStudio").addEventListener("click", () => {
    const snapshot = {
      exportedAt: new Date().toISOString(),
      context,
      state,
    };
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `founderos-studio-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  });

  document.body.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;

    const keyMap = [
      ["removeTask", "tasks"],
      ["removeRisk", "risks"],
      ["removeOkr", "okrs"],
      ["removeInterview", "interviews"],
      ["removeHandoff", "handoffs"],
    ];

    for (const [dataKey, store] of keyMap) {
      const id = button.dataset[dataKey];
      if (!id) continue;
      state[store] = state[store].filter((entry) => entry.id !== id);
      saveAndRender();
      return;
    }
  });
}

function renderAll() {
  renderHeader();
  renderAgentBoard();
  renderSelectors();
  renderRunbook();
  renderArtifacts();
  renderTasks();
  renderRisks();
  renderOkrs();
  renderInterviews();
  renderHandoffs();
  renderFinance();
  renderKpis();
  $("operationMemo").value = state.operationMemo || "";
}

function renderHeader() {
  const startupName = context.startupName || "프로젝트";
  const targetCustomer = context.targetCustomer || "고객 미정";
  const designId = context.designId || "-";
  const timestamp = context.buildTimestamp || "미기록";
  $("projectInfo").textContent = `${startupName} · ${targetCustomer} · 설계ID ${designId} · 구축시각 ${timestamp}`;
}

function renderAgentBoard() {
  const box = $("agentBoard");
  const roles = getAgentRoles();
  box.innerHTML = roles.map((role) => `
    <div class="agent-chip">
      <strong>${escapeHtml(roleName(role))}</strong>
      <span>${escapeHtml(role)}</span>
    </div>
  `).join("") || '<p class="muted">에이전트 정보가 없습니다.</p>';
}

function renderSelectors() {
  const roles = getAgentRoles();
  const options = ['<option value="">역할 선택</option>']
    .concat(roles.map((role) => `<option value="${escapeHtml(role)}">${escapeHtml(roleName(role))}</option>`))
    .join("");
  $("handoffFrom").innerHTML = options;
  $("handoffTo").innerHTML = options;
}

function renderRunbook() {
  const checklist = Array.isArray(context.operationsChecklist) ? context.operationsChecklist : [];
  const plan = context.buildPlan || "구축 계획 정보가 없습니다.";
  const list = checklist.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  $("buildRunbook").innerHTML = `
    <p>${escapeHtml(plan)}</p>
    <ul>${list || "<li>운영 체크리스트가 없습니다.</li>"}</ul>
  `;
}

function renderArtifacts() {
  const artifacts = Array.isArray(context.generatedArtifacts) ? context.generatedArtifacts : [];
  const box = $("artifactList");
  box.innerHTML = artifacts.map((artifact) => `
    <div class="item" style="display:block;">
      <strong>${escapeHtml(artifact.name)}</strong>
      <pre style="white-space: pre-wrap; margin: 8px 0 0; color: #cbd5e1;">${escapeHtml(String(artifact.content).slice(0, 3200))}</pre>
    </div>
  `).join("") || '<p class="muted">미리보기 가능한 생성 파일이 없습니다.</p>';
}

function renderTasks() {
  $("taskList").innerHTML = state.tasks.map((task) => `
    <div class="item">
      <div>
        <strong>${escapeHtml(task.title)}</strong>
        ${task.source ? `<div class="muted">출처: ${escapeHtml(task.source)}</div>` : ""}
      </div>
      <div class="row">
        <span class="pill ${task.status}">${taskStateLabel(task.status)}</span>
        <button class="btn" data-remove-task="${task.id}">삭제</button>
      </div>
    </div>
  `).join("") || '<p class="muted">오늘 실행할 작업을 추가하세요.</p>';
}

function renderRisks() {
  $("riskList").innerHTML = state.risks.map((risk) => `
    <div class="item">
      <div>
        <strong>${escapeHtml(risk.title)}</strong>
        <div class="muted ${riskClass(risk.level)}">위험도: ${riskLabel(risk.level)}</div>
        <div class="muted">대응: ${escapeHtml(risk.mitigation)}</div>
      </div>
      <button class="btn" data-remove-risk="${risk.id}">삭제</button>
    </div>
  `).join("") || '<p class="muted">운영 리스크를 등록하세요.</p>';
}

function renderOkrs() {
  $("okrList").innerHTML = state.okrs.map((okr) => `
    <div class="item">
      <div>
        <strong>${escapeHtml(okr.objective)}</strong>
        <div class="muted">KR: ${escapeHtml(okr.keyResult)}</div>
        <div class="muted">진척도: ${clampPct(okr.progress)}%</div>
      </div>
      <button class="btn" data-remove-okr="${okr.id}">삭제</button>
    </div>
  `).join("") || '<p class="muted">OKR을 설정해 에이전트 작업 정렬을 유지하세요.</p>';
}

function renderInterviews() {
  $("interviewList").innerHTML = state.interviews.map((interview) => `
    <div class="item">
      <div>
        <strong>${escapeHtml(interview.person)}</strong>
        <div class="muted">${escapeHtml(interview.pain)}</div>
      </div>
      <button class="btn" data-remove-interview="${interview.id}">삭제</button>
    </div>
  `).join("") || '<p class="muted">고객 인터뷰 인사이트를 누적하세요.</p>';
}

function renderHandoffs() {
  $("handoffList").innerHTML = state.handoffs.map((handoff) => `
    <div class="item">
      <div>
        <strong>${escapeHtml(handoff.task)}</strong>
        <div class="muted">${escapeHtml(roleName(handoff.from))} → ${escapeHtml(roleName(handoff.to))}</div>
      </div>
      <div class="row">
        <span class="pill ${mapHandoffState(handoff.state)}">${handoffLabel(handoff.state)}</span>
        <button class="btn" data-remove-handoff="${handoff.id}">삭제</button>
      </div>
    </div>
  `).join("") || '<p class="muted">에이전트 간 작업 전달 내역이 없습니다.</p>';
}

function renderFinance() {
  $("cash").value = state.finance.cash || "";
  $("monthlyBurn").value = state.finance.monthlyBurn || "";
  $("monthlyRevenue").value = state.finance.monthlyRevenue || "";
}

function renderKpis() {
  const totalTasks = state.tasks.length;
  const doneTasks = state.tasks.filter((task) => task.status === "done").length;
  const taskProgress = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;
  $("taskProgress").textContent = `${taskProgress}%`;
  $("taskProgressSub").textContent = `${doneTasks}/${totalTasks} 완료`;

  const roles = getAgentRoles();
  const ready = roles.length;
  $("agentReadiness").textContent = ready ? `${ready}명 활성` : "미구성";
  $("agentReadinessSub").textContent = ready ? "역할 배정 완료" : "설계/구축 후 자동 생성";

  const alertCount = state.risks.filter((risk) => risk.level !== "low").length
    + state.handoffs.filter((handoff) => handoff.state === "blocked").length;
  $("alertCount").textContent = `${alertCount}건`;
  $("alertSub").textContent = `고위험 ${state.risks.filter((risk) => risk.level === "high").length} + 차단 ${state.handoffs.filter((handoff) => handoff.state === "blocked").length}`;

  const netBurn = Math.max(1, Number(state.finance.monthlyBurn) - Number(state.finance.monthlyRevenue));
  const runway = Math.floor(Number(state.finance.cash || 0) / netBurn);
  $("runway").textContent = `${runway}개월`;
  $("runwaySub").textContent = `순소진 ${netBurn.toLocaleString("ko-KR")}원/월`;
}

function getAgentRoles() {
  const prompts = context.agentPrompts || {};
  return Object.keys(prompts);
}

function roleName(role) {
  return ROLE_LABEL[role] || role;
}

function taskStateLabel(stateName) {
  if (stateName === "doing") return "진행중";
  if (stateName === "done") return "완료";
  return "할 일";
}

function handoffLabel(stateName) {
  if (stateName === "in_progress") return "진행중";
  if (stateName === "blocked") return "차단";
  if (stateName === "done") return "완료";
  return "대기";
}

function mapHandoffState(stateName) {
  if (stateName === "in_progress") return "doing";
  if (stateName === "done") return "done";
  return "todo";
}

function riskClass(level) {
  if (level === "high") return "risk-high";
  if (level === "mid") return "risk-mid";
  return "risk-low";
}

function riskLabel(level) {
  if (level === "high") return "높음";
  if (level === "mid") return "중간";
  return "낮음";
}

function saveAndRender() {
  saveState();
  renderAll();
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function clampPct(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
