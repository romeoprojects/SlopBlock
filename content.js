const CARD_SELECTORS = [
  "ytd-rich-item-renderer",
  "ytd-video-renderer",
  "ytd-compact-video-renderer",
  "ytd-grid-video-renderer",
  "ytd-reel-item-renderer",
  "ytd-playlist-video-renderer"
];

function extractChannelId(card) {
  const links = card.querySelectorAll('a[href*="/channel/"], a[href^="/@"], a[href*="/@"]');
  for (const link of links) {
    const href = link.getAttribute("href") || "";
    const channelMatch = href.match(/\/channel\/(UC[\w-]{10,})/);
    if (channelMatch) return { id: channelMatch[1], name: link.textContent.trim() };
  }
  for (const link of links) {
    const href = link.getAttribute("href") || "";
    const handleMatch = href.match(/\/@([\w.-]+)/);
    if (handleMatch) return { id: `@${handleMatch[1]}`, name: link.textContent.trim() || `@${handleMatch[1]}` };
  }
  return null;
}

function applyBadge(card, entry) {
  card.querySelector(".ahg-badge")?.remove();

  if (entry.status === "slop") {
    const badge = document.createElement("div");
    badge.className = "ahg-badge ahg-badge-slop";
    badge.textContent = `⚠ AI Slop (${entry.slopVotes || 0})`;
    badge.title = entry.reason || "Community-flagged as AI-generated content";
    card.style.position = "relative";
    card.appendChild(badge);
  } else if (entry.status === "human") {
    const badge = document.createElement("div");
    badge.className = "ahg-badge ahg-badge-human";
    badge.textContent = "✓ Human-Made";
    badge.title = `${entry.humanVotes || 0} community votes confirming human-made content`;
    card.style.position = "relative";
    card.appendChild(badge);
  }
}

let pending = new Map();
let debounceTimer = null;

function scheduleLookup() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(runLookup, 300);
}

function runLookup() {
  const ids = Array.from(pending.keys());
  if (!ids.length) return;

  chrome.runtime.sendMessage({ type: "LOOKUP_CHANNELS", ids }, (res) => {
    if (!res?.ok) return;
    for (const [id, entry] of Object.entries(res.data)) {
      if (entry.status === "unknown") continue;
      for (const { card } of pending.get(id) || []) {
        if (document.body.contains(card)) applyBadge(card, entry);
      }
    }
    pending.clear();
  });
}

function scanCard(card) {
  if (card.dataset.ahgScanned) return;
  const info = extractChannelId(card);
  if (!info) return;
  card.dataset.ahgScanned = "1";
  if (!pending.has(info.id)) pending.set(info.id, []);
  pending.get(info.id).push({ card, channelInfo: info });
  scheduleLookup();
}

function scanAll(root = document) {
  for (const selector of CARD_SELECTORS) {
    root.querySelectorAll(selector).forEach(scanCard);
  }
}

const observer = new MutationObserver((mutations) => {
  for (const m of mutations) {
    m.addedNodes.forEach((node) => {
      if (node.nodeType !== 1) return;
      if (CARD_SELECTORS.some((s) => node.matches?.(s))) scanCard(node);
      else scanAll(node);
    });
  }
});
observer.observe(document.body, { childList: true, subtree: true });

scanAll();
document.addEventListener("yt-navigate-finish", scanAll);