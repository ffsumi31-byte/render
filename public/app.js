const $ = (id) => document.getElementById(id);
let sessionKey = "";
const localPreview = location.protocol === "http:" &&
  ["localhost", "127.0.0.1"].includes(location.hostname);
if (localPreview) {
  $("preview-workspace").hidden = false;
  $("preview-workspace").onclick = () => {
    $("name").textContent = "Sample customer (preview)";
    $("granted").textContent = "10,000,000";
    $("used").textContent = "250,000";
    $("reserved").textContent = "0";
    $("remaining").textContent = "9,750,000";
    $("overview-remaining").textContent = "9,750,000";
    $("overview-granted").textContent = "10,000,000";
    $("overview-used").textContent = "250,000";
    updateUsageShare("10000000", "250000", "9750000");
    $("inference-status").textContent = "Unavailable";
    $("connection-copy").textContent = "Hosted connection is not ready yet.";
    $("connection-label").textContent = "Local preview · not connected";
    $("tracker-status").textContent = "Sample values only. No account ledger was queried.";
    $("balance-placeholder").hidden = true;
    $("balance").hidden = false;
    $("preview-notice").hidden = false;
    $("refresh-usage").disabled = true;
    setAuthenticated(true);
    $("login-heading").focus();
  };
}
function setAuthenticated(connected) {
  $("auth-screen").hidden = connected;
  $("workspace-screen").hidden = !connected;
}
function updateUsageShare(grantedValue, usedValue, remainingValue) {
  const granted = BigInt(grantedValue);
  const used = BigInt(usedValue);
  const remaining = BigInt(remainingValue);
  const tenths = granted > 0n ? (used * 1000n) / granted : 0n;
  const percentage = Number(tenths < 0n ? 0n : tenths > 1000n ? 1000n : tenths) / 10;
  const available = granted > 0n ? (remaining * 100n) / granted : 0n;
  $("usage-meter").value = percentage;
  $("usage-percent").textContent = `${percentage}%`;
  $("overview-meter").value = Number(available < 0n ? 0n : available > 100n ? 100n : available);
}
setAuthenticated(false);
$("show").onclick = () => {
  $("key").type = $("key").type === "password" ? "text" : "password";
  $("show").textContent = $("key").type === "password" ? "Show" : "Hide";
  $("show").setAttribute("aria-pressed", String($("key").type === "text"));
  $("show").setAttribute("aria-label", $("key").type === "password" ? "Show customer key" : "Hide customer key");
};
$("logout").onclick = () => {
  sessionKey = "";
  setAuthenticated(false);
  $("key").value = "";
  $("key").type = "password";
  $("show").textContent = "Show";
  $("balance").hidden = true;
  $("balance-placeholder").hidden = false;
  $("preview-notice").hidden = true;
  $("refresh-usage").disabled = false;
  $("connection-label").textContent = "Not connected";
  $("show").setAttribute("aria-pressed", "false");
  $("show").setAttribute("aria-label", "Show customer key");
  $("name").textContent = "";
  for (const field of ["granted", "used", "remaining"]) $(field).textContent = "";
  $("reserved").textContent = "";
  $("usage-meter").value = 0;
  $("overview-meter").value = 0;
  $("usage-percent").textContent = "0%";
  $("overview-remaining").textContent = "—";
  $("overview-granted").textContent = "—";
  $("overview-used").textContent = "—";
  $("inference-status").textContent = "Checking status";
  $("connection-copy").textContent = "Hosted connection is not ready yet.";
  $("status").textContent = "Disconnected.";
  $("key").focus();
  for (const card of document.querySelectorAll("[data-tier]")) {
    const selected = card.dataset.tier === "fast";
    card.classList.toggle("selected", selected);
    card.setAttribute("aria-pressed", String(selected));
  }
  $("tier-note").textContent = "Haiku preset · 1× credit weight. Preview only; not actual Claude model routing.";
};
let pending = false;
$("login").onsubmit = async (event) => {
  event.preventDefault();
  if (pending) return;
  $("balance").hidden = true;
  $("balance-placeholder").hidden = false;
  $("connection-label").textContent = "Not connected";
  if (location.protocol !== "https:") {
    $("status").textContent = "Open your published HTTPS site to connect.";
    return;
  }
  const key = $("key").value.trim();
  if (!/^sk-gw-[a-f0-9]{64}$/.test(key)) {
    $("status").textContent = "Enter your complete customer key, not a provider key.";
    return;
  }
  pending = true;
  $("connect-button").disabled = true;
  $("status").textContent = "Checking…";
  try {
    const response = await fetch("/api/account", {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to connect");
    if (!data.customer?.id || typeof data.customer.name !== "string" || !data.tokens ||
        !["granted", "used", "remaining"].every((field) => /^-?\d+$/.test(String(data.tokens[field])))) {
      throw new Error("Invalid account response. Please contact the service administrator.");
    }
    $("name").textContent = data.customer.name;
    for (const field of ["granted", "used", "remaining"]) {
      $(field).textContent = BigInt(data.tokens[field]).toLocaleString();
    }
    $("reserved").textContent = BigInt(data.tokens.reserved ?? "0").toLocaleString();
    $("balance").hidden = false;
    $("balance-placeholder").hidden = true;
    $("preview-notice").hidden = true;
    $("connection-label").textContent = "Account connected";
    updateUsageShare(data.tokens.granted, data.tokens.used, data.tokens.remaining);
    $("status").textContent = data.inferenceEnabled ? "Connected. Hosted main-provider route is enabled." : "Connected. Hosted inference is disabled.";
    $("inference-status").textContent = data.inferenceEnabled ? "Enabled" : "Unavailable";
    $("connection-copy").textContent = data.inferenceEnabled ?
      "Hosted messages are enabled. The launcher is not published yet." :
      "Hosted connection is not ready yet.";
    $("overview-remaining").textContent = BigInt(data.tokens.remaining).toLocaleString();
    $("overview-granted").textContent = BigInt(data.tokens.granted).toLocaleString();
    $("overview-used").textContent = BigInt(data.tokens.used).toLocaleString();
    updateUsageShare(data.tokens.granted, data.tokens.used, data.tokens.remaining);
    $("key").value = "";
    $("key").type = "password";
    $("show").textContent = "Show";
    $("show").setAttribute("aria-pressed", "false");
    $("show").setAttribute("aria-label", "Show customer key");
    setAuthenticated(true);
    sessionKey = key;
    $("login-heading").focus();
  } catch (error) {
    $("status").textContent = error.name === "TimeoutError" ? "Connection timed out." : error.message;
  } finally { pending = false; $("connect-button").disabled = false; }
};
$("refresh-usage").onclick = async () => {
  const key = sessionKey;
  if (!key) return;
  $("refresh-usage").disabled = true;
  try {
    const response = await fetch("/api/account", {
      headers: { Authorization: `Bearer ${key}` }, cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (key !== sessionKey) return;
    if (response.status === 401) {
      $("logout").onclick();
      $("status").textContent = "Your customer key was revoked or is no longer valid.";
      return;
    }
    const data = await response.json();
    if (!response.ok) throw new Error("Cannot refresh your balance.");
    for (const field of ["granted", "used", "remaining", "reserved"]) {
      $(field).textContent = BigInt(data.tokens[field] ?? "0").toLocaleString();
    }
    $("overview-remaining").textContent = BigInt(data.tokens.remaining).toLocaleString();
    $("overview-granted").textContent = BigInt(data.tokens.granted).toLocaleString();
    $("overview-used").textContent = BigInt(data.tokens.used).toLocaleString();
    $("tracker-status").textContent = "Tracker refreshed from the server. Reservations are not final settled usage.";
  } catch {
    if (key === sessionKey) $("tracker-status").textContent = "Refresh failed. The previous balance may be out of date.";
  } finally { $("refresh-usage").disabled = false; }
};
// No localStorage, cookies, analytics, or key-in-URL login.
const tierDescriptions = {
  fast: "Haiku preset · 1× credit weight: direct answers.",
  balanced: "Sonnet preset · 2× credit weight: targeted checks.",
  advanced: "Opus preset · 4× credit weight: plan, implement, test, and review.",
  expert: "Fable preset · 8× credit weight: specialist assistance.",
};
for (const button of document.querySelectorAll("[data-tier]")) {
  button.onclick = () => {
    for (const card of document.querySelectorAll("[data-tier]")) {
      const selected = card === button;
      card.classList.toggle("selected", selected);
      card.setAttribute("aria-pressed", String(selected));
    }
    $("tier-note").textContent = `${tierDescriptions[button.dataset.tier]} Selecting a card does not change a provider or spend credits.`;
  };
}
