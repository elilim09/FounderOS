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
  designOutput.innerHTML = "설계 중... 멀티 에이전트가 논의 중입니다.";

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

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error ?? `설계 실패: ${res.status}`);
    }

    currentDesignId = data.designId;
    buildBtn.disabled = false;

    designOutput.innerHTML = `
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
  } catch (err) {
    designOutput.innerHTML = `<pre>${escapeHtml(String(err))}</pre>`;
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

    buildOutput.innerHTML = `
      <p><strong>Timestamp:</strong> ${escapeHtml(data.timestamp)}</p>
      <p><strong>Output Directory:</strong> ${escapeHtml(data.outputDirectory)}</p>
      <h3>구축 계획</h3>
      <pre>${escapeHtml(data.buildPlan)}</pre>
      <h3>생성 산출물</h3>
      ${data.generatedArtifacts
        .map((a) => `<details><summary>${escapeHtml(a.name)}</summary><pre>${escapeHtml(a.content)}</pre></details>`)
        .join("")}
      <h3>운영 체크리스트</h3>
      <ul>${data.operationsChecklist.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>
    `;
  } catch (err) {
    buildOutput.innerHTML = `<pre>${escapeHtml(String(err))}</pre>`;
  } finally {
    buildBtn.disabled = false;
  }
});
