const LIST_URL = "https://cdn.jsdelivr.net/gh/YOUR_USERNAME/ai-slop-list@main/channels.json";
const REFRESH_INTERVAL_MS = 60 * 60 * 1000;

async function fetchChannelList() {
  const { cachedList, lastFetch } = await chrome.storage.local.get(["cachedList", "lastFetch"]);
  const now = Date.now();

  if (cachedList && lastFetch && now - lastFetch < REFRESH_INTERVAL_MS) {
    return cachedList;
  }

  try {
    const res = await fetch(LIST_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    await chrome.storage.local.set({ cachedList: data, lastFetch: now });
    return data;
  } catch (err) {
    console.warn("SlopBlock: list fetch failed, using cache", err);
    return cachedList || { channels: {} };
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "LOOKUP_CHANNELS") {
    fetchChannelList().then((data) => {
      const results = {};
      for (const id of msg.ids) {
        results[id] = data.channels[id] || { status: "unknown" };
      }
      sendResponse({ ok: true, data: results });
    });
    return true;
  }

  if (msg.type === "GET_LIST_INFO") {
    chrome.storage.local.get(["lastFetch", "cachedList"], (stored) => {
      const channelCount = stored.cachedList?.channels
        ? Object.keys(stored.cachedList.channels).length
        : 0;
      sendResponse({
        ok: true,
        data: {
          lastFetch: stored.lastFetch || 0,
          channelCount
        }
      });
    });
    return true;
  }

  if (msg.type === "FORCE_REFRESH") {
    chrome.storage.local.remove(["lastFetch"], () => {
      fetchChannelList().then(() => sendResponse({ ok: true }));
    });
    return true;
  }
});