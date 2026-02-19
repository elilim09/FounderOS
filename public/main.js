/* FounderOS — main.js
 * HTML 요소 참조와 백엔드 데이터 구조에 완벽히 맞춤
 */

// ═══════════════════════════════════════
// DOM References
// ═══════════════════════════════════════
const $ = (id) => document.getElementById(id);

const healthStatus = $("healthStatus");
const inputCard = $("inputCard");
const designCard = $("designCard");
const buildCard = $("buildCard");

const designBtn = $("designBtn");
const buildBtn = $("buildBtn");

const meetingRoom = $("meetingRoom");
const meetingStatus = $("meetingStatus");
const agentGrid = $("agentGrid");
const logContainer = $("logContainer");
const designResult = $("designResult");

const buildStatus = $("buildStatus");
const buildOutput = $("buildOutput");
const chatInterface = $("chatInterface");
const chatHistory = $("chatHistory");
const chatInput = $("chatInput");
const sendChatBtn = $("sendChatBtn");
const agentSelect = $("agentSelect");

const inputValidation = $("inputValidation");
const ideaTemplateSelect = $("ideaTemplate");

let currentDesignId = null;

// ═══════════════════════════════════════
// Role Mapping (영어 역할명 → 한글 + 이모지)
// ═══════════════════════════════════════
const ROLE_MAP = {
  "MarketAnalyst": { ko: "시장 분석가", emoji: "📊" },
  "ProductStrategist": { ko: "제품 전략가", emoji: "🎯" },
  "TechArchitect": { ko: "기술 설계자", emoji: "🏗️" },
  "OperationsDesigner": { ko: "운영 설계자", emoji: "⚙️" },
  "GrowthPlanner": { ko: "성장 기획자", emoji: "📈" },
  "ImplementationLead": { ko: "실행 리더", emoji: "🔧" },
  "Facilitator": { ko: "진행자", emoji: "🎤" },
};

function displayRole(role) {
  const mapped = ROLE_MAP[role];
  return mapped ? `${mapped.emoji} ${mapped.ko}` : `🤖 ${role}`;
}

function roleEmoji(role) {
  return ROLE_MAP[role]?.emoji || "🤖";
}

// ═══════════════════════════════════════
// Templates
// ═══════════════════════════════════════
const ideaTemplates = {
  creator: {
    startupName: "PixelFan",
    problem: "1인 크리에이터가 콘텐츠 일정, 후원자 관리, 수익 분석을 동시에 처리하기 어렵다.",
    targetCustomer: "유튜버, 뉴스레터 운영자",
    constraints: "1개월 내 베타, 월 운영비 30만원 이내",
    additionalContext: "사용 편의성 최우선, 모바일 친화적 UI",
  },
  local: {
    startupName: "ShopKeeper",
    problem: "동네 가게 사장이 예약, 문의 응대, 매출 정리를 수기로 해서 시간이 많이 든다.",
    targetCustomer: "카페, 미용실 소상공인",
    constraints: "2주 MVP, 카카오톡 연동 필수",
    additionalContext: "복잡한 기능 없이 알림 중심 경험 필요",
  },
  education: {
    startupName: "PromoPath",
    problem: "직장인이 이직/업무 역량 강화를 위해 무엇을 먼저 공부해야 할지 판단하기 어렵다.",
    targetCustomer: "3~5년차 주니어 직장인",
    constraints: "데이터 수집 최소화, 개인화 추천 알고리즘",
    additionalContext: "로드맵 시각화 기능 중요",
  },
};

// ═══════════════════════════════════════
// Utilities
// ═══════════════════════════════════════
function val(id) {
  return $(id)?.value?.trim() ?? "";
}

function esc(text) {
  if (!text) return "";
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function persistWorkspaceContext(payload = {}) {
  const context = {
    designId: currentDesignId,
    startupName: val("startupName"),
    targetCustomer: val("targetCustomer"),
    generatedAt: new Date().toISOString(),
    ...payload,
  };
  localStorage.setItem("founderos-workspace-context", JSON.stringify(context));
}

function setStep(n) {
  document.querySelectorAll(".progress-step").forEach((el) => {
    const step = Number(el.dataset.step);
    el.classList.remove("active", "done");
    if (step < n) el.classList.add("done");
    if (step === n) el.classList.add("active");
  });
}

// ═══════════════════════════════════════
// Health Check
// ═══════════════════════════════════════
async function checkHealth() {
  try {
    const res = await fetch("/api/health");
    const data = await res.json();
    if (data.openaiConfigured) {
      healthStatus.className = "status-bar ok";
      healthStatus.innerHTML = `<i class="fas fa-check-circle"></i> 시스템 준비 완료 — AI 모델: ${esc(data.model)}`;
    } else {
      healthStatus.className = "status-bar warn";
      healthStatus.innerHTML = `<i class="fas fa-exclamation-triangle"></i> API 키가 설정되지 않았습니다. 관리자에게 문의하세요.`;
    }
  } catch {
    healthStatus.className = "status-bar warn";
    healthStatus.innerHTML = `<i class="fas fa-times-circle"></i> 서버에 연결할 수 없습니다.`;
  }
}
checkHealth();

// ═══════════════════════════════════════
// Template Selection
// ═══════════════════════════════════════
ideaTemplateSelect.addEventListener("change", (e) => {
  const key = e.target.value;
  if (!key || !ideaTemplates[key]) return;
  const t = ideaTemplates[key];
  $("startupName").value = t.startupName;
  $("problem").value = t.problem;
  $("targetCustomer").value = t.targetCustomer;
  $("constraints").value = t.constraints;
  $("additionalContext").value = t.additionalContext;
  inputValidation.classList.remove("visible");
});

// ═══════════════════════════════════════
// Agent Avatar Components
// ═══════════════════════════════════════
function createAgentAvatar(role) {
  const el = document.createElement("div");
  el.className = "agent-avatar";
  el.id = `avatar-${role}`;
  el.innerHTML = `
    <div class="agent-circle">${roleEmoji(role)}</div>
    <div class="agent-label">${esc(ROLE_MAP[role]?.ko || role)}</div>
  `;
  return el;
}

function highlightAgent(role) {
  document.querySelectorAll(".agent-avatar").forEach((el) => el.classList.remove("active"));
  if (!role) return;

  let avatar = $(`avatar-${role}`);
  if (!avatar) {
    avatar = createAgentAvatar(role);
    agentGrid.appendChild(avatar);
  }
  avatar.classList.add("active");
}

function addLog(text, role = null) {
  const div = document.createElement("div");
  div.className = role ? "log-item" : "log-item system-log";

  if (role) {
    const truncated = text.length > 180 ? text.substring(0, 180) + "…" : text;
    div.innerHTML = `<span class="role-tag">${esc(ROLE_MAP[role]?.ko || role)}:</span> ${esc(truncated)}`;
  } else {
    div.textContent = text;
  }

  logContainer.appendChild(div);
  logContainer.scrollTop = logContainer.scrollHeight;
}

// ═══════════════════════════════════════
// DESIGN FLOW
// ═══════════════════════════════════════
designBtn.addEventListener("click", async () => {
  // --- Validation ---
  const errors = [];
  if (val("startupName").length < 2) errors.push("서비스 이름을 입력해주세요 (최소 2글자).");
  if (val("problem").length < 5) errors.push("해결하려는 문제를 조금 더 자세히 적어주세요.");
  if (val("targetCustomer").length < 2) errors.push("대상 고객을 입력해주세요.");
  if (val("constraints").length < 2) errors.push("제약 사항을 입력해주세요.");
  const requestedAgentCount = Number(val("requestedAgentCount"));
  if (!Number.isFinite(requestedAgentCount) || requestedAgentCount < 2 || requestedAgentCount > 100) {
    errors.push("운영 에이전트 수는 2~100 사이 숫자로 입력해주세요.");
  }

  if (errors.length > 0) {
    inputValidation.innerHTML = errors.map((e) => `• ${e}`).join("<br>");
    inputValidation.classList.add("visible");
    return;
  }
  inputValidation.classList.remove("visible");

  // --- UI Transition ---
  designBtn.disabled = true;
  designBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> AI 팀이 분석 중입니다...';
  setStep(2);

  designCard.style.display = "block";
  meetingRoom.classList.add("visible");
  designResult.classList.remove("visible");
  agentGrid.innerHTML = "";
  logContainer.innerHTML = "";
  meetingStatus.textContent = "계층형 AI 운영 조직이 회의실에 입장하고 있습니다...";

  setTimeout(() => designCard.scrollIntoView({ behavior: "smooth", block: "start" }), 100);

  const payload = {
    startupName: val("startupName"),
    problem: val("problem"),
    targetCustomer: val("targetCustomer"),
    constraints: val("constraints"),
    additionalContext: val("additionalContext"),
    requestedAgentCount,
  };

  try {
    const res = await fetch("/api/design", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `서버 오류 (${res.status})`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);

          if (event.type === "step") {
            // Translate step messages to friendlier Korean
            const friendly = friendlyStep(event.message);
            meetingStatus.textContent = friendly;
            addLog(friendly);

          } else if (event.type === "log") {
            highlightAgent(event.role);
            addLog(event.content, event.role);

          } else if (event.type === "result") {
            currentDesignId = event.data.designId;
            renderDesignResult(event.data);

          } else if (event.type === "error") {
            throw new Error(event.message);
          }
        } catch (e) {
          if (e.message !== "Unexpected end of JSON input") {
            console.error("Stream parse error:", e);
          }
        }
      }
    }
  } catch (err) {
    meetingStatus.textContent = "⚠️ 오류가 발생했습니다";
    addLog(`오류: ${err.message}`);
    designBtn.disabled = false;
    designBtn.innerHTML = '<i class="fas fa-redo"></i> 다시 시도하기';
  }
});

function friendlyStep(msg) {
  // Make orchestrator step messages more accessible
  if (msg.includes("시스템 설계를 시작")) return "🚀 AI 설계를 시작합니다...";
  if (msg.includes("계층형 운영 조직")) return "🏢 회사형 계층 구조의 운영 조직을 설계하고 있습니다...";
  if (msg.includes("운영 에이전트와")) return "👥 운영 에이전트와 전략 위원회를 편성하고 있습니다...";
  if (msg.includes("전문 에이전트를 소집")) return `👥 AI 전문가 팀을 구성하고 있습니다...`;
  if (msg.includes("1차 의견 수집")) return "🧠 각 전문가가 아이디어를 분석하고 있습니다...";
  if (msg.includes("2차 상호 토론")) return "🔥 전문가들이 서로 의견을 나누며 토론 중입니다...";
  if (msg.includes("최종 합의 도출")) return "🤝 모든 의견을 종합하여 결론을 내리고 있습니다...";
  if (msg.includes("블루프린트 설계")) return "📐 최종 설계도를 작성하고 있습니다...";
  return msg;
}

// ═══════════════════════════════════════
// Render Design Result
// ═══════════════════════════════════════
function renderDesignResult(data) {
  highlightAgent(null);
  meetingStatus.textContent = "✅ 회의 완료!";
  designBtn.innerHTML = '<i class="fas fa-check"></i> 설계 완료';

  // --- Map backend SystemBlueprint fields ---
  // Backend: { architecture, agentTopology, coreFlows[], riskControls[] }
  const bp = data.systemBlueprint || {};
  const hierarchy = Array.isArray(bp.operatingHierarchy) ? bp.operatingHierarchy : [];

  const coreFlowsHtml = (bp.coreFlows || [])
    .map((f) => `<li>${esc(f)}</li>`)
    .join("");

  const riskHtml = (bp.riskControls || [])
    .map((r) => `<span class="tag warn">${esc(r)}</span>`)
    .join("");

  const hierarchyHtml = hierarchy
    .slice(0, 24)
    .map((agent) => `<li>${esc(agent.tier)} · <strong>${esc(agent.role)}</strong> — ${esc(agent.mission)}${agent.reportsTo ? ` <span class="tag">보고: ${esc(agent.reportsTo)}</span>` : ""}</li>`)
    .join("");

  // Opinions summary
  const opinionsHtml = (data.opinions || [])
    .map(
      (op) => `
      <details class="expand-section">
        <summary>${displayRole(op.role)} — ${esc(op.stance?.slice(0, 60))}${op.stance?.length > 60 ? "..." : ""}</summary>
        <div class="expand-content">
<strong>핵심 입장:</strong> ${esc(op.stance)}

<strong>우선순위:</strong>
${(op.priorities || []).map((p) => `• ${esc(p)}`).join("\n")}

<strong>우려 사항:</strong>
${(op.objections || []).map((o) => `• ${esc(o)}`).join("\n")}
        </div>
      </details>`
    )
    .join("");

  // Debate summary
  const debateHtml = (data.debateRound || [])
    .map(
      (d) => `
      <details class="expand-section">
        <summary>${displayRole(d.role)} — 토론 결과</summary>
        <div class="expand-content">
<strong>반박/조정 의견:</strong>
${esc(d.rebuttal)}

<strong>수정된 우선순위:</strong>
${(d.updatedPriorities || []).map((p) => `• ${esc(p)}`).join("\n")}
        </div>
      </details>`
    )
    .join("");

  designResult.innerHTML = `
    <div class="result-banner">
      <h3>🎉 설계 합의가 완료되었습니다</h3>
      <p>${esc(data.consensusSummary?.slice(0, 200))}${data.consensusSummary?.length > 200 ? "..." : ""}</p>
    </div>

    <div class="result-grid">
      <div class="result-box">
        <div class="result-box-title"><i class="fas fa-sitemap"></i> 시스템 구조</div>
        <p style="font-size: 0.88rem; color: var(--text-muted); line-height: 1.6;">${esc(bp.architecture || "분석 결과 없음")}</p>
      </div>
      <div class="result-box">
        <div class="result-box-title"><i class="fas fa-project-diagram"></i> 핵심 동작 흐름</div>
        <ul>${coreFlowsHtml || "<li>분석 결과 없음</li>"}</ul>
      </div>
    </div>

    <div class="result-box" style="margin-bottom: 16px;">
      <div class="result-box-title"><i class="fas fa-sitemap"></i> 운영 계층 구조 (${hierarchy.length}명)</div>
      <ul>${hierarchyHtml || "<li>운영 계층 정보가 없습니다.</li>"}</ul>
      ${hierarchy.length > 24 ? `<p class="muted">...외 ${hierarchy.length - 24}명</p>` : ""}
    </div>

    <div class="result-box" style="margin-bottom: 16px;">
      <div class="result-box-title"><i class="fas fa-shield-alt"></i> 리스크 관리 방안</div>
      <div class="tag-cloud">${riskHtml || '<span class="tag">식별된 주요 리스크 없음</span>'}</div>
    </div>

    <details class="expand-section" style="margin-bottom: 8px;">
      <summary>📋 전체 합의 내용 보기</summary>
      <div class="expand-content">${esc(data.consensusSummary)}</div>
    </details>

    <details class="expand-section" style="margin-bottom: 8px;">
      <summary>🧠 전문가별 1차 의견 보기</summary>
      <div class="expand-content" style="padding: 0;">${opinionsHtml}</div>
    </details>

    <details class="expand-section" style="margin-bottom: 8px;">
      <summary>🔥 2차 토론 결과 보기</summary>
      <div class="expand-content" style="padding: 0;">${debateHtml}</div>
    </details>
  `;

  designResult.classList.add("visible");
  buildBtn.disabled = false;
  setTimeout(() => buildBtn.scrollIntoView({ behavior: "smooth", block: "center" }), 200);
}

// ═══════════════════════════════════════
// BUILD FLOW
// ═══════════════════════════════════════
buildBtn.addEventListener("click", async () => {
  if (!currentDesignId) return;

  setStep(3);
  buildCard.style.display = "block";
  buildStatus.classList.add("visible");
  buildStatus.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 구축 진행 중... 잠시만 기다려주세요.';
  buildOutput.classList.remove("visible");
  chatInterface.classList.remove("visible");

  buildBtn.disabled = true;
  buildBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 구축 중...';
  setTimeout(() => buildCard.scrollIntoView({ behavior: "smooth", block: "start" }), 100);

  try {
    const res = await fetch(`/api/build/${currentDesignId}`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "구축 실패");

    // --- Success ---
    buildStatus.innerHTML = `<i class="fas fa-check-circle" style="color: var(--success);"></i> 구축 완료! (${esc(data.timestamp)})`;
    buildBtn.innerHTML = '<i class="fas fa-check"></i> 구축 완료됨';

    // Build output
    const artifactsHtml = (data.generatedArtifacts || [])
      .map(
        (a) => `
      <details class="expand-section">
        <summary><i class="fas fa-file-code"></i> ${esc(a.name)}</summary>
        <div class="expand-content">${esc(a.content)}</div>
      </details>`
      )
      .join("");

    const checklistHtml = (data.operationsChecklist || [])
      .map((item) => `<li>${esc(item)}</li>`)
      .join("");

    buildOutput.innerHTML = `
      <div class="build-success-box">
        <div class="big-icon"><i class="fas fa-check-circle"></i></div>
        <h3>프로젝트 파일이 생성되었습니다!</h3>
        <div class="dir-path">${esc(data.outputDirectory)}</div>
        <p>위 경로에서 결과물을 확인할 수 있습니다.</p>
        <div style="margin-top: 16px;">
          <button id="openWorkspaceBtn" class="btn btn-primary">
            <i class="fas fa-door-open"></i> 개인 작업실 열기
          </button>
        </div>
      </div>

      <details class="expand-section" style="margin-bottom: 8px;">
        <summary>📋 구축 계획서 보기</summary>
        <div class="expand-content">${esc(data.buildPlan)}</div>
      </details>

      ${artifactsHtml}

      <details class="expand-section" style="margin-bottom: 8px;">
        <summary>✅ 운영 체크리스트 (${data.operationsChecklist?.length || 0}개 항목)</summary>
        <div class="expand-content"><ul style="padding-left: 18px;">${checklistHtml}</ul></div>
      </details>
    `;
    buildOutput.classList.add("visible");
    persistWorkspaceContext({
      outputDirectory: data.outputDirectory,
      buildTimestamp: data.timestamp,
      buildPlan: data.buildPlan,
      generatedArtifacts: data.generatedArtifacts,
      operationsChecklist: data.operationsChecklist,
      agentPrompts: data.agentPrompts,
    });

    // --- Setup Chat ---
    agentSelect.innerHTML = '<option value="">대화 상대 선택</option>';
    if (data.agentPrompts) {
      Object.keys(data.agentPrompts).forEach((role) => {
        const opt = document.createElement("option");
        opt.value = role;
        opt.textContent = ROLE_MAP[role]?.ko || role;
        agentSelect.appendChild(opt);
      });
    }
    chatInterface.classList.add("visible");
    setTimeout(() => chatInterface.scrollIntoView({ behavior: "smooth", block: "start" }), 300);

  } catch (err) {
    buildStatus.innerHTML = `<i class="fas fa-times-circle" style="color: var(--danger);"></i> 오류: ${esc(err.message)}`;
    buildBtn.disabled = false;
    buildBtn.innerHTML = '<i class="fas fa-redo"></i> 다시 시도하기';
  }
});

buildCard.addEventListener("click", (event) => {
  const button = event.target.closest("#openWorkspaceBtn");
  if (!button) return;
  window.location.href = "/studio.html";
});

// ═══════════════════════════════════════
// CHAT LOGIC
// ═══════════════════════════════════════
sendChatBtn.addEventListener("click", sendMessage);
chatInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendMessage();
});

async function sendMessage() {
  const role = agentSelect.value;
  const text = chatInput.value.trim();

  if (!role) {
    // Flash the select
    agentSelect.style.borderColor = "var(--danger)";
    setTimeout(() => (agentSelect.style.borderColor = ""), 1500);
    return;
  }
  if (!text) return;

  addChatMessage(text, "user");
  chatInput.value = "";

  const loadingId = "msg-loading-" + Date.now();
  addChatMessage("입력 중...", "agent", loadingId, role);

  try {
    const res = await fetch(`/api/chat/${currentDesignId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ designId: currentDesignId, role, message: text }),
    });
    const data = await res.json();

    const loader = $(loadingId);
    if (loader) loader.remove();

    if (data.error) throw new Error(data.error);
    addChatMessage(data.response, "agent", null, role);

  } catch (err) {
    const loader = $(loadingId);
    if (loader) {
      loader.querySelector(".agent-msg-role").textContent = "오류";
      loader.childNodes[loader.childNodes.length - 1].textContent = err.message;
    }
  }
}

function addChatMessage(text, type, id = null, role = null) {
  const div = document.createElement("div");
  div.className = `message ${type}`;
  if (id) div.id = id;

  if (type === "agent" && role) {
    const roleLabel = document.createElement("div");
    roleLabel.className = "agent-msg-role";
    roleLabel.textContent = ROLE_MAP[role]?.ko || role;
    div.appendChild(roleLabel);
  }

  const textNode = document.createTextNode(text);
  div.appendChild(textNode);

  chatHistory.appendChild(div);
  chatHistory.scrollTop = chatHistory.scrollHeight;
}
