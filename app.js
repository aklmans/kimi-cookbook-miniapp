/* Kimi Cookbook Mini Program — reading client for
   《Kimi · 从长文本到一套 agent 栈》 (kimi.read.wiki).
   Content comes from the Next.js content API (/api/mp/v1/*); the
   Mini Program is a pure presentation layer: fetch, cache, render. */

import { getBook } from "./utils/api";
import { FONT_SIZES } from "./utils/theme";

App({
  globalData: {
    /** Production content API. For local development point this at the
        site's local server, e.g. http://192.168.x.x:3010, and disable
        domain verification in DevTools (详情 → 本地设置). */
    baseUrl: "https://kimi.read.wiki",
    /** "system" | "light" | "dark" */
    themeMode: "system",
    /** Reader body size in px — one of FONT_SIZES. */
    fontSize: 17,
    /** Tsanger JinKai (the site's editorial serif) finished downloading. */
    tsangerReady: false,
  },

  onLaunch() {
    this.globalData.themeMode = wx.getStorageSync("kc:theme") || "system";
    this.globalData.fontSize = this.loadFontSize();
    this.loadTsanger();
    // Advertise both share entry points in the capsule menu — without this
    // only 发送给朋友 shows, even though every page defines onShareTimeline.
    wx.showShareMenu({
      withShareTicket: false,
      menus: ["shareAppMessage", "shareTimeline"],
    });
    // Warm the book payload so the first page paints from cache next time.
    getBook().catch(() => {});
    // Follow OS / WeChat dark-mode flips while the app is alive: without
    // this, a user who switches mid-read keeps the old theme until the
    // next page load. Pages implement applyThemeRefresh() to repaint.
    wx.onThemeChange(() => {
      for (const page of getCurrentPages()) {
        if (typeof page.applyThemeRefresh === "function") {
          page.applyThemeRefresh();
        }
      }
    });
  },

  /* Tsanger JinKai02 — the site's editorial serif, subset to ~0.5 MB per
     weight and served from the site itself. Loads globally so every page
     and mp-html can stack it ahead of the system Songti fallback; the
     fallback chain keeps text visible while the download is in flight. */
  loadTsanger() {
    const base = this.globalData.baseUrl;
    for (const family of ["TsangerJinKai02-W04", "TsangerJinKai02-W05"]) {
      wx.loadFontFace({
        family,
        source: `url("${base}/fonts/${family}.subset.woff2")`,
        global: true,
        scopes: ["webview", "native"],
        success: () => {
          this.globalData.tsangerReady = true;
        },
        fail: () => {
          /* typography degrades to Songti — reading continues */
        },
      });
    }
  },

  /** Effective theme after the "system" resolution. */
  resolveTheme() {
    const mode = this.globalData.themeMode;
    if (mode !== "system") return mode;
    try {
      const info = wx.getAppBaseInfo ? wx.getAppBaseInfo() : wx.getSystemInfoSync();
      return info.theme === "dark" ? "dark" : "light";
    } catch (e) {
      return "light";
    }
  },

  /** Persisted font size, migrating the old two-level "kc:font-large"
      flag (true → 19) on first launch after the upgrade. */
  loadFontSize() {
    const saved = Number(wx.getStorageSync("kc:font-size"));
    if (FONT_SIZES.includes(saved)) return saved;
    return wx.getStorageSync("kc:font-large") ? 19 : 17;
  },

  /** Reader-settings setters (the read page's settings sheet picks values
      directly — no cycling). Both persist and return the applied value. */
  setFontSize(size) {
    const next = FONT_SIZES.includes(size) ? size : 17;
    this.globalData.fontSize = next;
    wx.setStorageSync("kc:font-size", next);
    return next;
  },

  setThemeMode(mode) {
    const next = ["system", "light", "dark"].includes(mode) ? mode : "system";
    this.globalData.themeMode = next;
    wx.setStorageSync("kc:theme", next);
    return this.resolveTheme();
  },
});
