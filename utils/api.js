/* Thin content-API client with local caching.
   Book + chapters are cached for an hour; the /api/mp/v1/version
   beacon exists for a future staleness check (P2). */

const TTL_MS = 60 * 60 * 1000;

/* getApp() must not run at module top level — modules load before
   App() finishes registering, so resolve it lazily per call. */
const app = () => getApp();

function request(path) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: app().globalData.baseUrl + path,
      method: "GET",
      success(res) {
        if (res.statusCode === 200) resolve(res.data);
        else reject(new Error(`HTTP ${res.statusCode} for ${path}`));
      },
      fail(err) {
        reject(new Error(err.errMsg || `request failed: ${path}`));
      },
    });
  });
}

async function cached(key, path, ttlMs = TTL_MS) {
  try {
    const hit = wx.getStorageSync(key);
    if (hit && hit.time && Date.now() - hit.time < ttlMs && hit.data) {
      return hit.data;
    }
  } catch (e) {
    /* corrupted cache entry — fall through to the network */
  }
  const data = await request(path);
  try {
    wx.setStorageSync(key, { time: Date.now(), data });
  } catch (e) {
    /* storage full is non-fatal — reading still works uncached */
  }
  return data;
}

/** Stale-while-revalidate: return the cache immediately when present,
    refreshing it in the background. First call falls back to network. */
function swr(key, path, onFresh) {
  let hit = null;
  try {
    hit = wx.getStorageSync(key);
  } catch (e) {
    /* ignore */
  }
  const fresh = request(path)
    .then((data) => {
      try {
        wx.setStorageSync(key, { time: Date.now(), data });
      } catch (e) {
        /* ignore */
      }
      if (typeof onFresh === "function") onFresh(data);
      return data;
    })
    .catch(() => null);
  if (hit && hit.data) return Promise.resolve(hit.data);
  return fresh.then((data) => {
    if (data) return data;
    throw new Error("network unavailable and no cache");
  });
}

export function getBook(onFresh) {
  return swr("kc:cache:book", "/api/mp/v1/book", onFresh);
}

export function getChapter(slug, onFresh) {
  return swr(`kc:cache:ch:${slug}`, `/api/mp/v1/chapters/${slug}`, onFresh);
}

/** Map a request failure to reader-facing guidance. The WeChat domain
    whitelist error is the common one on real devices — say so plainly
    instead of a generic "check your network". */
export function explainError(err) {
  const msg = ((err && err.message) || "").toLowerCase();
  if (msg.includes("domain list")) {
    return "接口域名未加入白名单\n在小程序后台「开发管理 → 服务器域名」把 kimi.read.wiki 加入 request 合法域名;或在真机预览里开启「调试模式」。";
  }
  return "加载失败,请检查网络后重试";
}

export function getVersion() {
  return cached("kc:cache:version", "/api/mp/v1/version", 60 * 1000);
}

/** Silent prefetch — fills the cache, never throws, never renders. */
export function prefetchChapter(slug) {
  if (!slug) return;
  request(`/api/mp/v1/chapters/${slug}`)
    .then((data) => {
      try {
        wx.setStorageSync(`kc:cache:ch:${slug}`, { time: Date.now(), data });
      } catch (e) {
        /* ignore */
      }
    })
    .catch(() => {});
}

/* ── reading state (visited + progress), all local ── */

export function markVisited(slug) {
  try {
    wx.setStorageSync(`kc:visited:${slug}`, Date.now());
  } catch (e) {
    /* ignore */
  }
}

export function isVisited(slug) {
  try {
    return Boolean(wx.getStorageSync(`kc:visited:${slug}`));
  } catch (e) {
    return false;
  }
}

export function saveProgress(slug, scrollTop) {
  try {
    wx.setStorageSync(`kc:progress:${slug}`, { scrollTop, time: Date.now() });
    wx.setStorageSync("kc:last-read", { slug, time: Date.now() });
  } catch (e) {
    /* ignore */
  }
}

export function getProgress(slug) {
  try {
    return wx.getStorageSync(`kc:progress:${slug}`) || null;
  } catch (e) {
    return null;
  }
}

export function getLastRead() {
  try {
    return wx.getStorageSync("kc:last-read") || null;
  } catch (e) {
    return null;
  }
}
