const $ = (id) => document.getElementById(id);
let credential = "", busy = false, timer;
function clearNewKey() {
  $("new-key").value = "";
  $("new-key-box").hidden = true;
}
function lock() {
  credential = "";
  clearTimeout(timer);
  $("admin-key").value = "";
  clearNewKey();
  $("customer-list").replaceChildren();
  $("admin-controls").hidden = true;
  $("admin-login-panel").hidden = false;
}
function status(message) { $("admin-status").textContent = message; }
async function api(body) {
  if (location.protocol !== "https:") throw new Error("Use your published HTTPS site.");
  const requestCredential = credential;
  const response = await fetch("/api/admin", {
    method: body ? "POST" : "GET", cache: "no-store",
    headers: { Authorization: `Bearer ${credential}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(20000),
  });
  const data = await response.json();
  if (!credential || credential !== requestCredential) throw new Error("Admin session ended. Sign in again.");
  if (!response.ok) {
    if (response.status === 401) lock();
    throw new Error(data.error || "Request failed");
  }
  return data;
}
async function refresh() {
  const data = await api();
  $("customer-list").replaceChildren();
  for (const customer of data.customers) {
    const card = document.createElement("article");
    card.className = "panel";
    const heading = document.createElement("h3");
    heading.textContent = `${customer.name}${customer.disabled ? " · Revoked" : ""}`;
    const detail = document.createElement("p");
    detail.textContent = `ID: ${customer.id} · Granted: ${customer.granted} · Used: ${customer.used} · Reserved: ${customer.reserved ?? "0"} · Available: ${customer.remaining}`;
    card.append(heading, detail);
    for (const action of ["grant", "revoke"]) {
      const button = document.createElement("button");
      button.className = "secondary";
      button.textContent = action === "grant" ? "Grant tokens" : "Revoke access";
      button.disabled = customer.disabled;
      button.onclick = () => mutate(async () => {
        const reason = prompt("Reason / purchase reference (required; no secrets):");
        if (!reason) return;
        let tokens;
        if (action === "grant") {
          tokens = prompt("How many additional lifetime tokens?");
          if (!tokens) return;
        }
        if (!confirm(`${action === "grant" ? `Grant ${tokens} tokens to` : "Revoke"} ${customer.name}?`)) return;
        await api({ action, customerId: customer.id, tokens, reason, operationId: crypto.randomUUID() });
        status("Saved. Balances refreshed.");
        await refresh();
      });
      card.append(button);
    }
    $("customer-list").append(card);
  }
}
async function mutate(action) {
  if (busy) return;
  busy = true;
  try { await action(); } catch (error) { status(error.message); } finally { busy = false; }
}
$("admin-login").onsubmit = (event) => {
  event.preventDefault();
  mutate(async () => {
    credential = $("admin-key").value.trim();
    $("admin-key").value = "";
    if (!/^sk-admin-[a-f0-9]{64}$/.test(credential)) { lock(); throw new Error("Enter a complete admin key."); }
    try { await refresh(); } catch (error) { lock(); throw error; }
    $("admin-controls").hidden = false;
    $("admin-login-panel").hidden = true;
    clearTimeout(timer);
    timer = setTimeout(() => { lock(); status("Administration locked after 15 minutes. Sign in again."); }, 15 * 60 * 1000);
    status("Connected. Keep this admin session private.");
  });
};
$("create-user").onsubmit = (event) => {
  event.preventDefault();
  mutate(async () => {
    if ($("new-key").value && !confirm("Replace the currently displayed key? Copy it first; it cannot be recovered.")) return;
    if (!confirm("Create this customer and grant the specified tokens? Only do this for a verified purchase or authorized test.")) return;
    const result = await api({
      action: "create", name: $("customer-name").value, tokens: $("grant-tokens").value,
      reason: $("grant-reason").value, operationId: crypto.randomUUID(),
    });
    $("new-key").value = result.key;
    $("new-key-box").hidden = false;
    status("Customer created. The key is shown once below.");
    await refresh();
  });
};
$("admin-refresh").onclick = () => mutate(refresh);
$("admin-logout").onclick = () => { lock(); status("Administration locked."); };
$("dismiss-key").onclick = clearNewKey;
$("copy-key").onclick = async () => {
  try { await navigator.clipboard.writeText($("new-key").value); status("Customer key copied. Deliver privately."); }
  catch { status("Clipboard unavailable. Select the customer key and copy it manually."); }
};
lock();
