const designBtn = document.getElementById("designBtn");
const buildBtn = document.getElementById("buildBtn");
const designOutput = document.getElementById("designOutput");
const buildOutput = document.getElementById("buildOutput");

let currentDesignId = null;

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function value(id) {
  return document.getElementById(id).value;
}

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

    if (!res.ok) {
      throw new Error(`설계 실패: ${res.status}`);
    }

    const data = await res.json();
    currentDesignId = data.designId;
    buildBtn.disabled = false;

    designOutput.innerHTML = `
      <p><strong>Design ID:</strong> ${escapeHtml(data.designId)}</p>
      <h3>에이전트 의견</h3>
      ${data.opinions
        .map(
          (op) => `<details><summary>${escapeHtml(op.role)}</summary><pre>${escapeHtml(op.opinion)}</pre></details>`
        )
        .join("")}
      <h3>합의안</h3>
      <pre>${escapeHtml(data.consensusSummary)}</pre>
      <h3>블루프린트</h3>
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

    if (!res.ok) {
      throw new Error(`구축 실패: ${res.status}`);
    }

    const data = await res.json();
    buildOutput.innerHTML = `
      <p><strong>Timestamp:</strong> ${escapeHtml(data.timestamp)}</p>
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
