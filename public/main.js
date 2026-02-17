const designBtn = document.getElementById("designBtn");
const buildBtn = document.getElementById("buildBtn");
const designOutput = document.getElementById("designOutput");
const buildOutput = document.getElementById("buildOutput");
const healthStatus = document.getElementById("healthStatus");
const inputValidation = document.getElementById("inputValidation");
const ideaTemplateSelect = document.getElementById("ideaTemplate");

let currentDesignId = null;

const ideaTemplates = {
  creator: {
    startupName: "CreatorPilot",
    problem: "1인 크리에이터가 콘텐츠 일정, 후원자 관리, 수익 분석을 동시에 처리하기 어렵다.",
    targetCustomer: "유튜버, 뉴스레터 운영자, 1인 지식창업가",
    constraints: "1개월 내 베타, 월 운영비 30만원 이내, 모바일 우선",
    additionalContext: "초기에는 자동화 정확도보다 사용 편의성을 우선하고 싶음.",
    requestedAgentCount: "4"
  },
  local: {
    startupName: "LocalFlow",
    problem: "동네 가게 사장이 예약, 문의 응대, 매출 정리를 수기로 해서 시간이 많이 든다.",
    targetCustomer: "카페, 미용실, 필라테스 등 소상공인",
    constraints: "2주 MVP, 기존 카카오톡 사용 습관 유지, 교육 없이 바로 사용",
    additionalContext: "복잡한 대시보드보다 쉬운 알림 중심 경험이 필요함.",
    requestedAgentCount: "3"
  },
  education: {
    startupName: "UpSkillMate",
    problem: "직장인이 이직/업무 역량 강화를 위해 무엇을 먼저 공부해야 할지 판단하기 어렵다.",
    targetCustomer: "3~10년차 직장인",
    constraints: "첫 출시까지 3주, 개인정보 최소 수집, 콘텐츠 제작 인력 1명",
    additionalContext: "개인 맞춤 로드맵과 매주 회고 리포트를 제공하고 싶음.",
    requestedAgentCount: "4"
  }
};

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function value(id) {
  return document.getElementById(id).value;
}

function applyTemplate(templateKey) {
  const template = ideaTemplates[templateKey];
  if (!template) return;

  Object.entries(template).forEach(([key, text]) => {
    const el = document.getElementById(key);
    if (el) {
      el.value = text;
    }
  });
}

function validateInput() {
  const checks = [
    {
      ok: value("startupName").trim().length >= 2,
      message: "서비스/회사명은 최소 2글자 이상으로 입력해 주세요."
    },
    {
      ok: value("problem").trim().length >= 10,
      message: "해결 문제를 조금 더 구체적으로(최소 10글자) 적어 주세요."
    },
    {
      ok: value("targetCustomer").trim().length >= 2,
      message: "타겟 고객을 한 줄이라도 입력해 주세요."
    },
    {
      ok: value("constraints").trim().length >= 2,
      message: "기간/비용/인력 등 제약사항을 입력해 주세요."
    }
  ];

  return checks.filter((c) => !c.ok).map((c) => c.message);
}

function simplifyBlueprint(blueprint = {}) {
  const components = Array.isArray(blueprint.components) ? blueprint.components : [];
  const risks = Array.isArray(blueprint.risks) ? blueprint.risks : [];
  const milestones = Array.isArray(blueprint.milestones) ? blueprint.milestones : [];

  return {
    componentNames: components.slice(0, 4).map((c) => c.name || "핵심 모듈"),
    riskNames: risks.slice(0, 3).map((r) => r.name || r),
    milestoneNames: milestones.slice(0, 3).map((m) => m.name || m)
  };
}

async function checkHealth() {
  try {
    const res = await fetch("/api/health");
    const data = await res.json();
    if (data.openaiConfigured) {
      healthStatus.className = "status ok";
      healthStatus.innerHTML = `OpenAI 연결 준비 완료 (model: <strong>${escapeHtml(data.model)}</strong>)`;
    } else {
      healthStatus.className = "status warn";
      healthStatus.innerHTML = "OPENAI_API_KEY가 설정되지 않았습니다. 실제 설계/구축 호출이 실패합니다.";
    }
  } catch {
    healthStatus.className = "status warn";
    healthStatus.textContent = "상태 확인 실패";
  }
}

checkHealth();

ideaTemplateSelect.addEventListener("change", (event) => {
  const key = event.target.value;
  if (key) {
    applyTemplate(key);
    inputValidation.style.display = "none";
  }
});

designBtn.addEventListener("click", async () => {
  const errors = validateInput();
  if (errors.length > 0) {
    inputValidation.className = "status warn";
    inputValidation.style.display = "block";
    inputValidation.innerHTML = `<strong>입력 보완이 필요합니다.</strong><ul class="error-list">${errors
      .map((msg) => `<li>${escapeHtml(msg)}</li>`)
      .join("")}</ul>`;
    return;
  }

  inputValidation.style.display = "none";
  designBtn.disabled = true;
  buildBtn.disabled = true;
  designOutput.innerHTML = "";

  const progressContainer = document.createElement("div");
  progressContainer.className = "progress-container";

  const statusEl = document.createElement("div");
  statusEl.className = "current-step";
  statusEl.innerHTML = "🚀 시스템 초기화 중...";

  const detailsEl = document.createElement("details");
  const summaryEl = document.createElement("summary");
  summaryEl.textContent = "자세히 보기 (실시간 로그)";
  const logContainer = document.createElement("div");
  logContainer.className = "log-details";

  detailsEl.appendChild(summaryEl);
  detailsEl.appendChild(logContainer);

  progressContainer.appendChild(statusEl);
  progressContainer.appendChild(detailsEl);
  designOutput.appendChild(progressContainer);

  const payload = {
    startupName: value("startupName"),
    problem: value("problem"),
    targetCustomer: value("targetCustomer"),
    constraints: value("constraints"),
    additionalContext: value("additionalContext"),
    requestedAgentCount: Number(value("requestedAgentCount"))
  };

  try {
    const res = await fetch("/api/design", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error ?? `설계 실패: ${res.status}`);
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
            statusEl.innerHTML = escapeHtml(event.message);
            logContainer.innerHTML += `<div class="log-entry"><strong>[STEP]</strong> ${escapeHtml(event.message)}</div>`;
          } else if (event.type === "log") {
            const rolePrefix = event.role ? `<span class="log-role">[${escapeHtml(event.role)}]</span> ` : "";
            logContainer.innerHTML += `<div class="log-entry">${rolePrefix}${escapeHtml(event.content)}</div>`;
            logContainer.scrollTop = logContainer.scrollHeight;
          } else if (event.type === "result") {
            const data = event.data;
            currentDesignId = data.designId;
            buildBtn.disabled = false;
            statusEl.innerHTML = "✅ 설계 완료!";

            const simplified = simplifyBlueprint(data.systemBlueprint);
            const resultHtml = `
              <hr style="margin: 20px 0; border: 0; border-top: 1px solid #ddd;">
              <p><strong>Design ID:</strong> ${escapeHtml(data.designId)}</p>
              <div class="status ok">
                <strong>비개발자용 핵심 요약</strong>
                <ul>
                  <li>핵심 기능 묶음: ${escapeHtml(simplified.componentNames.join(" / ") || "설계 데이터 확인 필요")}</li>
                  <li>우선 점검 리스크: ${escapeHtml(simplified.riskNames.join(" / ") || "리스크 항목 없음")}</li>
                  <li>다음 실행 단계: ${escapeHtml(simplified.milestoneNames.join(" → ") || "마일스톤 항목 없음")}</li>
                </ul>
              </div>
              <details>
                <summary>지금 바로 할 일 (추천)</summary>
                <ol>
                  <li>"구축 요청"을 눌러 산출물을 생성한다.</li>
                  <li>생성된 구축 계획에서 기간/비용 가정을 검토한다.</li>
                  <li>채팅에서 에이전트에게 "오늘 해야 할 작업 3개"를 요청한다.</li>
                </ol>
              </details>
              <h3>1차 에이전트 의견</h3>
              ${data.opinions
                .map(
                  (op) => `<details><summary>${escapeHtml(op.role)}</summary>
                    <pre>입장: ${escapeHtml(op.stance)}\n\n우선순위:\n- ${escapeHtml(op.priorities.join("\n- "))}\n\n반대/우려:\n- ${escapeHtml(op.objections.join("\n- "))}</pre></details>`
                )
                .join("")}
              <h3>2차 상호토론</h3>
              ${data.debateRound
                .map(
                  (d) => `<details><summary>${escapeHtml(d.role)}</summary><pre>반박/조정: ${escapeHtml(d.rebuttal)}\n\n업데이트 우선순위:\n- ${escapeHtml(d.updatedPriorities.join("\n- "))}</pre></details>`
                )
                .join("")}
              <h3>최종 합의안</h3>
              <pre>${escapeHtml(data.consensusSummary)}</pre>
              <h3>시스템 블루프린트</h3>
              <pre>${escapeHtml(JSON.stringify(data.systemBlueprint, null, 2))}</pre>
            `;
            const resultContainer = document.createElement("div");
            resultContainer.innerHTML = resultHtml;
            designOutput.appendChild(resultContainer);
          } else if (event.type === "error") {
            throw new Error(event.message);
          }
        } catch (e) {
          console.error("Error parsing stream:", e);
        }
      }
    }
  } catch (err) {
    designOutput.innerHTML += `<div class="status warn"><pre>Error: ${escapeHtml(String(err))}</pre></div>`;
  } finally {
    designBtn.disabled = false;
  }
});

buildBtn.addEventListener("click", async () => {
  if (!currentDesignId) return;
  buildBtn.disabled = true;
  buildOutput.innerHTML = "구축 중... 구현 에이전트들이 산출물을 생성 중입니다.";

  try {
    const res = await fetch(`/api/build/${currentDesignId}`, { method: "POST" });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error ?? `구축 실패: ${res.status}`);
    }

    const agentCard = document.getElementById("agentCard");
    const agentSelect = document.getElementById("agentSelect");
    const chatHistory = document.getElementById("chatHistory");
    const chatInput = document.getElementById("chatInput");
    const sendChatBtn = document.getElementById("sendChatBtn");

    agentSelect.innerHTML = "";
    if (data.agentPrompts) {
      Object.keys(data.agentPrompts).forEach((role) => {
        const option = document.createElement("option");
        option.value = role;
        option.textContent = role;
        agentSelect.appendChild(option);
      });
      agentCard.style.display = "block";
    }

    buildOutput.innerHTML = `
      <p><strong>Timestamp:</strong> ${escapeHtml(data.timestamp)}</p>
      <p><strong>Output Directory:</strong> ${escapeHtml(data.outputDirectory)}</p>
      <div class="status ok">✅ 에이전트 구축 완료! 아래 채팅창에서 바로 업무를 지시하세요.</div>
      <details>
        <summary>비개발자 실행 가이드</summary>
        <ol>
          <li>"구축 계획"에서 일정/역할을 확인합니다.</li>
          <li>"생성 산출물"의 내용을 복사해 팀/외주에게 공유합니다.</li>
          <li>채팅에서 "내일 데모 준비 체크리스트"를 요청해 실행합니다.</li>
        </ol>
      </details>
      <h3>구축 계획</h3>
      <pre>${escapeHtml(data.buildPlan)}</pre>
      <h3>생성 산출물</h3>
      ${data.generatedArtifacts
        .map((a) => `<details><summary>${escapeHtml(a.name)}</summary><pre>${escapeHtml(a.content)}</pre></details>`)
        .join("")}
      <h3>운영 체크리스트</h3>
      <ul>${data.operationsChecklist.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>
    `;

    sendChatBtn.onclick = async () => {
      const role = agentSelect.value;
      const message = chatInput.value;
      if (!message) return;

      chatHistory.innerHTML += `<div style="text-align: right; margin-bottom: 8px;">
        <span style="background: #007bff; color: white; padding: 6px 10px; border-radius: 12px; display: inline-block;">${escapeHtml(message)}</span>
      </div>`;
      chatInput.value = "";
      chatHistory.scrollTop = chatHistory.scrollHeight;

      const loadingId = "loading-" + Date.now();
      chatHistory.innerHTML += `<div id="${loadingId}" style="text-align: left; margin-bottom: 8px;">
        <span style="background: #f1f1f1; padding: 6px 10px; border-radius: 12px; display: inline-block; color: #555;">Typing...</span>
      </div>`;
      chatHistory.scrollTop = chatHistory.scrollHeight;

      try {
        const res = await fetch(`/api/chat/${currentDesignId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ designId: currentDesignId, role, message })
        });
        const data = await res.json();

        document.getElementById(loadingId).remove();

        if (data.error) throw new Error(data.error);

        chatHistory.innerHTML += `<div style="text-align: left; margin-bottom: 8px;">
          <small style="display:block; color: #888; margin-bottom: 2px;">${escapeHtml(role)}</small>
          <span style="background: #e9ecef; padding: 8px 12px; border-radius: 12px; display: inline-block;">${escapeHtml(data.response)}</span>
        </div>`;
      } catch (err) {
        document.getElementById(loadingId).innerText = "Error: " + err.message;
      }
      chatHistory.scrollTop = chatHistory.scrollHeight;
    };
  } catch (err) {
    buildOutput.innerHTML = `<pre>${escapeHtml(String(err))}</pre>`;
  } finally {
    buildBtn.disabled = false;
  }
});
