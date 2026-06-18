const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const LOCAL_CONFIG_FILE = path.join(ROOT, "config.local.json");
const PROFILE_FILE = path.join(ROOT, "opportunity_profile.md");
const PORT = Number(process.env.PORT || 4173);

const defaultConfig = {
  radarFile: path.join(DATA_DIR, "radar_opportunities.csv"),
  searchLogFile: path.join(DATA_DIR, "search_run_log.csv"),
  internshipFile: path.join(DATA_DIR, "internship_tracker.csv"),
};

function loadConfig() {
  if (!fs.existsSync(LOCAL_CONFIG_FILE)) return defaultConfig;
  const localConfig = JSON.parse(fs.readFileSync(LOCAL_CONFIG_FILE, "utf8"));
  return {
    ...defaultConfig,
    ...Object.fromEntries(
      Object.entries(localConfig).map(([key, value]) => [
        key,
        path.isAbsolute(value) ? value : path.resolve(ROOT, value),
      ])
    ),
  };
}

const config = loadConfig();

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      field += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.length)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  const [headers = [], ...records] = rows;
  return {
    headers,
    records: records.map((values) =>
      Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]))
    ),
  };
}

function encodeCsvField(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function stringifyCsv(headers, records) {
  const lines = [headers.map(encodeCsvField).join(",")];
  for (const record of records) {
    lines.push(headers.map((header) => encodeCsvField(record[header])).join(","));
  }
  return `${lines.join("\r\n")}\r\n`;
}

function readCsv(file) {
  return parseCsv(fs.readFileSync(file, "utf8"));
}

function writeCsv(file, headers, records) {
  fs.writeFileSync(file, stringifyCsv(headers, records), "utf8");
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function getBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) reject(new Error("Request body too large"));
    });
    request.on("end", () => resolve(body ? JSON.parse(body) : {}));
    request.on("error", reject);
  });
}

function nextApplicationId(records) {
  const year = new Date().getFullYear();
  const max = records.reduce((current, record) => {
    const match = String(record.Application_ID || "").match(/^\d{4}-(\d+)$/);
    return match ? Math.max(current, Number(match[1])) : current;
  }, 0);
  return `${year}-${String(max + 1).padStart(3, "0")}`;
}

function mapRadarToInternship(radar, applicationId) {
  const today = todayIso();
  return {
    Application_ID: applicationId,
    Date_Added: today,
    Source: `Opportunity Radar / ${radar.Source}`,
    Company: radar.Organization,
    Role: radar.Role,
    Location: radar.Location,
    Work_Mode: radar.Work_Mode,
    Internship_Term: radar.Term,
    Application_Link: radar.URL,
    Job_Description_File: "",
    Status: "Saved",
    Stage: "Radar Approved",
    Priority: radar.Priority === "A" ? "High" : radar.Priority === "B" ? "Medium" : "Low",
    Fit_Score: Math.max(1, Math.min(5, Math.ceil(Number(radar.Score || 0) / 20))),
    Deadline: radar.Deadline,
    Date_Applied: "",
    Best_Resume_Variant: radar.Opportunity_Type === "Research" ? "Research Technical" : "TPM Systems Engineering",
    Resume_PDF_Referenced: "",
    Cover_Letter_Needed: "Unknown",
    Cover_Letter_File: "",
    Application_Folder: "",
    Contacts_Referrals: "",
    Next_Action: "Verify live posting and create application packet",
    Next_Action_Date: today,
    Interview_Date: "",
    Outcome: "",
    Compensation_Notes: radar.Compensation,
    Resume_Database_Update: "None",
    Notes: `${radar.Why_Fit} Promoted from Opportunity Radar ${radar.Radar_ID}.`,
  };
}

async function handleApi(request, response, pathname) {
  if (request.method === "GET" && pathname === "/api/radar") {
    return sendJson(response, 200, readCsv(config.radarFile).records);
  }

  if (request.method === "GET" && pathname === "/api/internships") {
    return sendJson(response, 200, readCsv(config.internshipFile).records);
  }

  if (request.method === "GET" && pathname === "/api/search-log") {
    return sendJson(response, 200, readCsv(config.searchLogFile).records);
  }

  if (request.method === "GET" && pathname === "/api/profile") {
    const markdown = fs.existsSync(PROFILE_FILE) ? fs.readFileSync(PROFILE_FILE, "utf8") : "";
    return sendJson(response, 200, { markdown });
  }

  const internshipAppliedMatch = pathname.match(/^\/api\/internships\/([^/]+)\/applied$/);
  if (request.method === "POST" && internshipAppliedMatch) {
    const internshipCsv = readCsv(config.internshipFile);
    const internship = internshipCsv.records.find((item) => item.Application_ID === internshipAppliedMatch[1]);

    if (!internship) return sendJson(response, 404, { error: "Internship application not found" });

    const body = await getBody(request);
    const appliedDate = String(body.appliedDate || todayIso()).trim();
    const nextAction = String(body.nextAction || "Watch for confirmation email or recruiter response").trim();
    const nextActionDate = String(body.nextActionDate || appliedDate).trim();
    const note = `Applied ${appliedDate}. Marked from Opportunity Radar dashboard.`;

    internship.Status = "Applied";
    internship.Stage = "Submitted";
    internship.Date_Applied = appliedDate;
    internship.Next_Action = nextAction;
    internship.Next_Action_Date = nextActionDate;
    internship.Notes = internship.Notes ? `${internship.Notes} ${note}` : note;

    writeCsv(config.internshipFile, internshipCsv.headers, internshipCsv.records);
    return sendJson(response, 200, { applicationId: internship.Application_ID, appliedDate });
  }

  const approveMatch = pathname.match(/^\/api\/radar\/([^/]+)\/approve$/);
  if (request.method === "POST" && approveMatch) {
    const radarCsv = readCsv(config.radarFile);
    const internshipCsv = readCsv(config.internshipFile);
    const radar = radarCsv.records.find((item) => item.Radar_ID === approveMatch[1]);

    if (!radar) return sendJson(response, 404, { error: "Radar opportunity not found" });
    if (!["Internship", "Research"].includes(radar.Opportunity_Type)) {
      return sendJson(response, 400, {
        error: "This item needs a scholarship or travel-grant downstream workflow.",
      });
    }
    if (radar.Downstream_ID) {
      return sendJson(response, 409, { error: `Already linked to ${radar.Downstream_ID}` });
    }

    await getBody(request);
    const applicationId = nextApplicationId(internshipCsv.records);
    internshipCsv.records.push(mapRadarToInternship(radar, applicationId));
    radar.Status = "Approved";
    radar.Downstream_ID = applicationId;

    writeCsv(config.internshipFile, internshipCsv.headers, internshipCsv.records);
    writeCsv(config.radarFile, radarCsv.headers, radarCsv.records);
    return sendJson(response, 200, { applicationId });
  }

  const rejectMatch = pathname.match(/^\/api\/radar\/([^/]+)\/reject$/);
  if (request.method === "POST" && rejectMatch) {
    const radarCsv = readCsv(config.radarFile);
    const radar = radarCsv.records.find((item) => item.Radar_ID === rejectMatch[1]);

    if (!radar) return sendJson(response, 404, { error: "Radar opportunity not found" });
    if (radar.Downstream_ID) {
      return sendJson(response, 409, { error: `Already linked to ${radar.Downstream_ID}` });
    }

    const body = await getBody(request);
    const reason = String(body.reason || "Passed from dashboard").trim();
    const note = `Passed ${todayIso()}: ${reason}`;
    radar.Status = "Rejected";
    radar.Priority = "Pass";
    radar.Recommended_Action = "No action needed. This item was passed from the dashboard.";
    radar.Notes = radar.Notes ? `${radar.Notes} ${note}` : note;

    writeCsv(config.radarFile, radarCsv.headers, radarCsv.records);
    return sendJson(response, 200, { radarId: radar.Radar_ID, reason });
  }

  return sendJson(response, 404, { error: "API route not found" });
}

function serveStatic(response, pathname) {
  const filePath = pathname === "/" ? path.join(PUBLIC_DIR, "index.html") : path.join(PUBLIC_DIR, pathname);
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(PUBLIC_DIR) || !fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) {
    response.writeHead(404);
    return response.end("Not found");
  }

  const extension = path.extname(resolved);
  const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript" };
  response.writeHead(200, { "Content-Type": `${types[extension] || "text/plain"}; charset=utf-8` });
  response.end(fs.readFileSync(resolved));
}

const server = http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
    if (pathname.startsWith("/api/")) return await handleApi(request, response, pathname);
    return serveStatic(response, pathname);
  } catch (error) {
    return sendJson(response, 500, { error: error.message });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Opportunity Radar dashboard running at http://127.0.0.1:${PORT}`);
});
