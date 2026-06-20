const state = {
  radar: [],
  internships: [],
  searchLog: [],
  selectedId: null,
  filter: "Verified",
  search: "",
};

const filters = ["Verified", "Monitor", "Strong Fits", "Nuclear", "Systems", "Research", "Local Melbourne", "Travel Grants", "Rejected"];
let deferredInstallPrompt = null;

function scoreNumber(value) {
  return Number(value || 0);
}

function selectedOpportunity() {
  return state.radar.find((item) => item.Radar_ID === state.selectedId) || state.radar[0];
}

function filteredRadar() {
  const search = state.search.trim().toLowerCase();
  return state.radar
    .filter((item) => {
      const haystack = `${item.Organization} ${item.Role} ${item.Location} ${item.Opportunity_Type} ${item.Why_Fit}`.toLowerCase();
      if (search && !haystack.includes(search)) return false;
      if (state.filter === "Verified") return item.Status === "Verified";
      if (state.filter === "Monitor") return item.Status === "Monitor";
      if (state.filter === "Rejected") return item.Status === "Rejected";
      if (item.Status === "Rejected") return false;
      if (state.filter === "Strong Fits") return scoreNumber(item.Score) >= 80;
      if (state.filter === "Nuclear") return /nuclear|oklo|aalo|terrapower|ans|inl/i.test(haystack);
      if (state.filter === "Systems") return /systems|program|project|operations|controls/i.test(haystack);
      if (state.filter === "Research") return item.Opportunity_Type === "Research";
      if (state.filter === "Local Melbourne") return /melbourne/i.test(item.Location);
      if (state.filter === "Travel Grants") return item.Opportunity_Type === "Travel Grant";
      return true;
    })
    .sort((a, b) => scoreNumber(b.Score) - scoreNumber(a.Score));
}

function renderFilters() {
  document.getElementById("filters").innerHTML = filters
    .map((filter) => `<button class="filter ${state.filter === filter ? "active" : ""}" data-filter="${filter}">${filter}</button>`)
    .join("");
  document.querySelectorAll(".filter").forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      render();
    });
  });
}

function renderMetrics() {
  const strongFits = state.radar.filter((item) => scoreNumber(item.Score) >= 80 && !["Archived", "Rejected"].includes(item.Status)).length;
  const verified = state.radar.filter((item) => item.Status === "Verified").length;
  const nuclear = state.radar.filter((item) => /nuclear|oklo|aalo|terrapower|ans|inl/i.test(`${item.Organization} ${item.Role} ${item.Why_Fit}`)).length;
  const travel = state.radar.filter((item) => item.Opportunity_Type === "Travel Grant").length;
  document.getElementById("metrics").innerHTML = [
    ["blue", verified, "Verified current items"],
    ["green", state.internships.length, "Applications in live internship tracker"],
    ["amber", strongFits, "Strong fits including monitors"],
    ["", travel, "Conference travel leads"],
  ].map(([tone, value, label]) => `<div class="metric ${tone}"><strong>${value}</strong><span>${label}</span></div>`).join("");
}

function renderRadar() {
  const rows = filteredRadar();
  document.getElementById("queueCount").textContent = `${rows.length} visible`;
  document.getElementById("radarRows").innerHTML = rows.map((item) => `
    <tr class="${item.Radar_ID === state.selectedId ? "selected" : ""}" data-id="${item.Radar_ID}">
      <td><span class="score">${item.Score}</span></td>
      <td><span class="org">${item.Organization}</span><span class="role">${item.Role}</span></td>
      <td>${item.Opportunity_Type}</td>
      <td>${item.Term}</td>
      <td>${item.Location}</td>
      <td><span class="status status-${item.Status.toLowerCase()}">${item.Status}</span></td>
    </tr>`).join("");
  document.querySelectorAll("#radarRows tr").forEach((row) => {
    row.addEventListener("click", () => {
      state.selectedId = row.dataset.id;
      render();
    });
  });
}

function renderPipeline() {
  document.getElementById("pipelineCount").textContent = `${state.internships.length} records`;
  document.getElementById("pipelineRows").innerHTML = state.internships.map((item) => `
    <div class="pipeline-item">
      <div>
        <strong>${item.Company}</strong>
        <span>${item.Role} · ${item.Location}</span>
      </div>
      <div>
        <strong class="pipeline-stage">${item.Status}</strong>
        <span>${item.Stage}</span>
      </div>
    </div>`).join("");
}

function renderInternshipTracker() {
  const count = document.getElementById("trackerCount");
  const rows = document.getElementById("trackerRows");
  if (!count || !rows) return;

  count.textContent = `${state.internships.length} tracked`;
  rows.innerHTML = state.internships.map((item) => {
    const isApplied = String(item.Status || "").toLowerCase() === "applied";
    const link = item.Application_Link
      ? `<a href="${item.Application_Link}" target="_blank" rel="noreferrer">Open posting</a>`
      : `<span class="tracker-muted">No link</span>`;
    const nextDate = item.Next_Action_Date || item.Deadline || "No date";
    return `
      <article class="tracker-card">
        <div class="tracker-card-top">
          <div>
            <span class="tracker-id">${item.Application_ID}</span>
            <h3>${item.Company}</h3>
            <p>${item.Role}</p>
          </div>
          <span class="tracker-status tracker-status-${String(item.Status || "").toLowerCase().replace(/\s+/g, "-")}">${item.Status || "Saved"}</span>
        </div>
        <div class="tracker-meta">
          <span>${item.Stage || "No stage"}</span>
          <span>${item.Location || "No location"}</span>
          <span>${item.Internship_Term || "No term"}</span>
          <span>Fit ${item.Fit_Score || "?"}/5</span>
        </div>
        <div class="tracker-action">
          <strong>Next</strong>
          <span>${item.Next_Action || "No next action set"}</span>
        </div>
        <p class="tracker-note" id="tracker-note-${item.Application_ID}">
          ${item.Date_Applied ? `Applied on ${item.Date_Applied}` : ""}
        </p>
        <div class="tracker-footer">
          <span>${nextDate}</span>
          <span>${item.Best_Resume_Variant || "Resume TBD"}</span>
          ${link}
        </div>
        <button class="tracker-apply-button" data-application-id="${item.Application_ID}" ${isApplied ? "disabled" : ""}>
          ${isApplied ? "Already applied" : "Mark as applied"}
        </button>
      </article>`;
  }).join("");

  document.querySelectorAll(".tracker-apply-button").forEach((button) => {
    if (!button.disabled) {
      button.addEventListener("click", () => markInternshipApplied(button.dataset.applicationId));
    }
  });
}

function renderSearchLog() {
  const target = document.getElementById("searchLogRows");
  if (!target) return;
  const latest = state.searchLog[0];
  if (!latest) {
    target.innerHTML = "<p>No search runs logged yet.</p>";
    return;
  }
  target.innerHTML = `
    <div class="search-run">
      <div>
        <strong>${latest.Run_Date}</strong>
        <span>${latest.Summary}</span>
      </div>
      <div class="search-run-counts">
        <span>${latest.Verified_Items} verified</span>
        <span>${latest.Monitor_Items} monitors</span>
      </div>
    </div>
    <p class="source-list">${latest.Sources_Checked}</p>
    <p class="next-focus">Next focus: ${latest.Next_Run_Focus}</p>`;
}

function renderInspector() {
  const item = selectedOpportunity();
  const inspector = document.getElementById("inspector");
  if (!item) {
    inspector.innerHTML = "<p>Select an opportunity to inspect its score.</p>";
    return;
  }
  state.selectedId = item.Radar_ID;
  const linked = item.Downstream_ID;
  const canApprove = ["Internship", "Research"].includes(item.Opportunity_Type) && item.Status === "Verified" && !linked;
  const canReject = !linked && item.Status !== "Rejected";
  inspector.innerHTML = `
    <div class="inspector-topline"><span>${item.Radar_ID}</span><span>Score ${item.Score}</span></div>
    <h2>${item.Role}</h2>
    <div class="company">${item.Organization}</div>
    <div class="detail-block">
      <div class="detail-line"><span>Type</span><span>${item.Opportunity_Type}</span></div>
      <div class="detail-line"><span>Location</span><span>${item.Location}</span></div>
      <div class="detail-line"><span>Term</span><span>${item.Term}</span></div>
      <div class="detail-line"><span>Compensation</span><span>${item.Compensation}</span></div>
      <div class="detail-line"><span>Verification</span><span>${item.Verified_On}</span></div>
    </div>
    <div class="detail-block">
      <h3>Why this fits</h3>
      <p class="reason">${item.Why_Fit}</p>
    </div>
    <div class="detail-block">
      <h3>Score breakdown</h3>
      ${[
        ["Role alignment", item.Role_Alignment, 25],
        ["Sector and mission", item.Sector_Fit, 20],
        ["Eligibility", item.Eligibility, 15],
        ["Career leverage", item.Career_Leverage, 15],
        ["Funding", item.Funding, 10],
        ["Deadline urgency", item.Deadline_Urgency, 10],
        ["Effort to value", item.Effort_Value, 5],
      ].map(([label, value, max]) => `<div class="score-line"><span>${label}</span><span>${value}/${max}</span></div>`).join("")}
    </div>
    <div class="detail-block">
      <h3>Recommended action</h3>
      <p class="reason">${item.Recommended_Action}</p>
      <p class="action-note" id="actionNote">${linked ? `Linked to internship tracker as ${linked}.` : ""}</p>
      <a href="${item.URL}" target="_blank" rel="noreferrer">Open source page</a>
      <button id="approveButton" class="primary-button" ${canApprove ? "" : "disabled"}>
        ${linked ? `Approved as ${linked}` : item.Status !== "Verified" ? "Monitor item, not ready to approve" : item.Opportunity_Type === "Travel Grant" ? "Travel workflow coming next" : "Approve to internship tracker"}
      </button>
      <div class="reject-actions">
        <button class="reject-button" data-reason="Expired deadline" ${canReject ? "" : "disabled"}>Pass: expired</button>
        <button class="reject-button" data-reason="Not applying" ${canReject ? "" : "disabled"}>Pass: not applying</button>
        <button class="reject-button" data-reason="Weak fit" ${canReject ? "" : "disabled"}>Pass: weak fit</button>
      </div>
    </div>`;
  const approveButton = document.getElementById("approveButton");
  if (canApprove) approveButton.addEventListener("click", () => approve(item.Radar_ID));
  document.querySelectorAll(".reject-button").forEach((button) => {
    if (!button.disabled) {
      button.addEventListener("click", () => rejectOpportunity(item.Radar_ID, button.dataset.reason));
    }
  });
}

async function approve(id) {
  const button = document.getElementById("approveButton");
  const note = document.getElementById("actionNote");
  button.disabled = true;
  button.textContent = "Approving...";
  const response = await fetch(`/api/radar/${id}/approve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  const result = await response.json();
  if (!response.ok) {
    note.textContent = result.error;
    button.textContent = "Could not approve";
    return;
  }
  note.textContent = `Added to your existing internship tracker as ${result.applicationId}.`;
  await load();
}

async function rejectOpportunity(id, reason) {
  const note = document.getElementById("actionNote");
  note.textContent = `Passing: ${reason}...`;
  const response = await fetch(`/api/radar/${id}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  const result = await response.json();
  if (!response.ok) {
    note.textContent = result.error;
    return;
  }
  state.filter = "Verified";
  state.selectedId = null;
  await load();
}

async function markInternshipApplied(id) {
  const button = document.querySelector(`[data-application-id="${id}"]`);
  const note = document.getElementById(`tracker-note-${id}`);
  if (button) {
    button.disabled = true;
    button.textContent = "Marking applied...";
  }
  if (note) note.textContent = "Updating application tracker...";

  const response = await fetch(`/api/internships/${id}/applied`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const result = await response.json();

  if (!response.ok) {
    if (note) note.textContent = result.error;
    if (button) {
      button.disabled = false;
      button.textContent = "Mark as applied";
    }
    return;
  }

  if (note) note.textContent = `Applied on ${result.appliedDate}`;
  await load();
}

function render() {
  renderMetrics();
  renderFilters();
  renderRadar();
  renderPipeline();
  renderInternshipTracker();
  renderSearchLog();
  renderInspector();
}

async function load() {
  const [radarResponse, internshipResponse, logResponse] = await Promise.all([fetch("/api/radar"), fetch("/api/internships"), fetch("/api/search-log")]);
  state.radar = await radarResponse.json();
  state.internships = await internshipResponse.json();
  state.searchLog = await logResponse.json();
  if (!state.selectedId && state.radar.length) state.selectedId = state.radar[0].Radar_ID;
  render();
}

document.getElementById("searchInput").addEventListener("input", (event) => {
  state.search = event.target.value;
  render();
});
document.getElementById("refreshButton").addEventListener("click", load);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn("Service worker registration failed:", error);
    });
  });
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  const installButton = document.getElementById("installButton");
  if (installButton) installButton.hidden = false;
});

document.getElementById("installButton")?.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  document.getElementById("installButton").hidden = true;
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  const installButton = document.getElementById("installButton");
  if (installButton) installButton.hidden = true;
});

load();
