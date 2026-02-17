const designBtn = document.getElementById("designBtn");
const buildBtn = document.getElementById("buildBtn");
const designOutput = document.getElementById("designOutput");
const buildOutput = document.getElementById("buildOutput");
const healthStatus = document.getElementById("healthStatus");

let currentDesignId = null;

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

designBtn.addEventListener("click", async () => {
  designBtn.disabled = true;
  buildBtn.disabled = true;
  designOutput.innerHTML = ""; // Clear previous output

  // Create progress UI structure
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
      buffer = lines.pop(); // Keep the last partial line

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);

          if (event.type === "step") {
            statusEl.innerHTML = escapeHtml(event.message);
            // Also log step changes
            logContainer.innerHTML += `<div class="log-entry"><strong>[STEP]</strong> ${escapeHtml(event.message)}</div>`;
          } else if (event.type === "log") {
            const rolePrefix = event.role ? `<span class="log-role">[${escapeHtml(event.role)}]</span> ` : "";
            logContainer.innerHTML += `<div class="log-entry">${rolePrefix}${escapeHtml(event.content)}</div>`;
            logContainer.scrollTop = logContainer.scrollHeight; // Auto-scroll
          } else if (event.type === "result") {
            const data = event.data;
            currentDesignId = data.designId;
            buildBtn.disabled = false;
            statusEl.innerHTML = "✅ 설계 완료!";

            // Render final result below progress
            const resultHtml = `
              <hr style="margin: 20px 0; border: 0; border-top: 1px solid #ddd;">
              <p><strong>Design ID:</strong> ${escapeHtml(data.designId)}</p>
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

    // Populate Agent Select
    agentSelect.innerHTML = "";
    if (data.agentPrompts) {
      Object.keys(data.agentPrompts).forEach(role => {
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
      <h3>구축 계획</h3>
      <pre>${escapeHtml(data.buildPlan)}</pre>
      <h3>생성 산출물</h3>
      ${data.generatedArtifacts
        .map((a) => `<details><summary>${escapeHtml(a.name)}</summary><pre>${escapeHtml(a.content)}</pre></details>`)
        .join("")}
      <h3>운영 체크리스트</h3>
      <ul>${data.operationsChecklist.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>
    `;

    // Chat Logic
    sendChatBtn.onclick = async () => {
      const role = agentSelect.value;
      const message = chatInput.value;
      if (!message) return;

      // Add user message to history
      chatHistory.innerHTML += `<div style="text-align: right; margin-bottom: 8px;">
        <span style="background: #007bff; color: white; padding: 6px 10px; border-radius: 12px; display: inline-block;">${escapeHtml(message)}</span>
      </div>`;
      chatInput.value = "";
      chatHistory.scrollTop = chatHistory.scrollHeight;

      // Add loading message
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

        // Remove loading
        document.getElementById(loadingId).remove();

        if (data.error) throw new Error(data.error);

        // Add agent response
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
