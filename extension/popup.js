const API_URL = "https://api.addevent.com/calevent/v2/events";
const DEFAULT_DURATION_MIN = 60;

const $ = id => document.getElementById(id);
const form = $("event-form");
const submitButton = $("submit");
const result = $("result");
const linkEl = $("link");
const statusEl = $("status");

let endEdited = false;  // once the user changes the end, stop auto-filling it

// Prefill start with the next full hour and end one hour later
const nextHour = new Date();
nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
setDateTime("start", nextHour);
syncEnd();

$("start-date").addEventListener("change", syncEnd);
$("start-time").addEventListener("change", syncEnd);
$("end-date").addEventListener("change", () => { endEdited = true; });
$("end-time").addEventListener("change", () => { endEdited = true; });

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  statusEl.textContent = "";
  result.style.display = "none";

  const start = readDateTime("start");
  const end = readDateTime("end");
  if (end <= start) {
    statusEl.textContent = "End must be after start.";
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Creating...";

  try {
    const env = await loadEnv();
    const missing = ["ADDEVENT_API_KEY", "PAGE_URL"].filter(key => !env[key]);
    if (missing.length) throw new Error(`Missing ${missing.join(", ")} in .env`);

    const details = {
      title: $("title").value.trim(),
      location: $("location").value.trim(),
      description: $("description").value.trim(),
      start,
      end,
    };

    await createAddEventEvent(env, details);
    const url = buildPageUrl(env.PAGE_URL, details);

    linkEl.textContent = url;
    linkEl.href = url;
    result.style.display = "block";
  } catch (err) {
    statusEl.textContent = "Something went wrong: " + err.message;
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Create link";
  }
});

$("copy").addEventListener("click", async () => {
  await navigator.clipboard.writeText(linkEl.href);
  statusEl.textContent = "Copied!";
});

function syncEnd() {
  if (endEdited) return;
  const start = readDateTime("start");
  if (isNaN(start)) return;
  setDateTime("end", new Date(start.getTime() + DEFAULT_DURATION_MIN * 60000));
}

// Date/time inputs are in the user's local time zone
function readDateTime(prefix) {
  return new Date(`${$(prefix + "-date").value}T${$(prefix + "-time").value}`);
}

function setDateTime(prefix, date) {
  const pad = n => String(n).padStart(2, "0");
  $(prefix + "-date").value = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  $(prefix + "-time").value = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Reads KEY=value pairs from the .env file bundled with the extension
async function loadEnv() {
  const response = await fetch(chrome.runtime.getURL(".env"));
  if (!response.ok) throw new Error("Couldn't read .env");
  const env = {};
  for (const raw of (await response.text()).split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const [key, ...rest] = line.split("=");
    env[key.trim()] = rest.join("=").trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

async function createAddEventEvent(env, details) {
  // AddEvent takes local wall-clock times plus a time zone
  const pad = n => String(n).padStart(2, "0");
  const local = date =>
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  const payload = {
    title: details.title,
    datetime_start: local(details.start),
    datetime_end: local(details.end),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
  if (details.location) payload.location = details.location;
  if (details.description) payload.description = details.description;
  if (env.ADDEVENT_CALENDAR_ID) payload.calendar_id = env.ADDEVENT_CALENDAR_ID;

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${env.ADDEVENT_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const reasons = (data.property_validation_errors || []).map(e => `${e.name}: ${e.reason}`).join("; ");
    throw new Error(`AddEvent API ${response.status}${data.error_message ? " – " + data.error_message : ""}${reasons ? " (" + reasons + ")" : ""}`);
  }
  return data;
}

// Landing page params match docs/index.html: t, s, e, l, n
function buildPageUrl(pageUrl, details) {
  const utc = date => date.toISOString().replace(/[-:]/g, "").slice(0, 13) + "Z";  // 20260924T2300Z
  const params = new URLSearchParams({ t: details.title, s: utc(details.start), e: utc(details.end) });
  if (details.location) params.set("l", details.location);
  if (details.description) params.set("n", details.description);
  return pageUrl.replace(/\/+$/, "") + "/?" + params.toString();
}
