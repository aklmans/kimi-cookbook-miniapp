/* Kimi Cookbook Mini Program — reading client for
   《Kimi · 从长文本到一套 agent 栈》 (kimi.read.wiki).
   Content comes from the Next.js content API (/api/mp/v1/*); the
   Mini Program is a pure presentation layer: fetch, cache, render. */

App({
  globalData: {
    /** Production content API. For local development point this at the
        site's local server, e.g. http://192.168.x.x:3010, and disable
        domain verification in DevTools (详情 → 本地设置). */
    baseUrl: "https://kimi.read.wiki",
    /** "system" | "light" | "dark" */
    themeMode: "system",
    fontLarge: false,
  },

  onLaunch() {
    this.globalData.themeMode = wx.getStorageSync("kc:theme") || "system";
    this.globalData.fontLarge = Boolean(wx.getStorageSync("kc:font-large"));
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

  /** Cycle 跟随系统 → 浅色 → 深色, persist, and return the effective theme. */
  cycleTheme() {
    const order = { system: "light", light: "dark", dark: "system" };
    this.globalData.themeMode = order[this.globalData.themeMode] || "system";
    wx.setStorageSync("kc:theme", this.globalData.themeMode);
    return this.resolveTheme();
  },
});
