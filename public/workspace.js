// Navigation is local UI state; the customer key never enters the URL or storage.
const screens = [...document.querySelectorAll("[data-screen]")];
const links = [...document.querySelectorAll(".sidebar nav a")];
const titles = new Map([
  ["overview", "Overview"],
  ["account", "Balance details"],
  ["downloads", "Connect"],
  ["models", "Preset lab"],
]);
function showScreen() {
  const requested = location.hash.slice(1);
  const current = titles.has(requested) ? requested : "overview";
  for (const screen of screens) screen.hidden = screen.id !== current;
  for (const link of links) {
    if (link.getAttribute("href") === `#${current}`) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  document.getElementById("section-name").textContent = titles.get(current);
  if (!document.getElementById("workspace-screen").hidden) {
    document.getElementById(current)?.querySelector("h1")?.focus({ preventScroll: true });
  }
}
window.addEventListener("hashchange", showScreen);
document.getElementById("logout").addEventListener("click", () => {
  location.hash = "#overview";
  showScreen();
});
showScreen();

for (const button of document.querySelectorAll(".copy-command")) {
  button.addEventListener("click", async () => {
    const command = button.parentElement.querySelector("code")?.textContent;
    if (!command) return;
    try {
      await navigator.clipboard.writeText(command);
      document.getElementById("copy-status").textContent = `${button.getAttribute("aria-label").replace("Copy ", "Copied ")}.`;
    } catch {
      document.getElementById("copy-status").textContent = "Clipboard unavailable. Select the command and copy it manually.";
    }
  });
}
