import { applyTheme } from "../../utils/theme";

Page({
  data: { theme: "light" },

  onLoad() {
    applyTheme(this);
  },

  onShow() {
    this.applyThemeRefresh();
  },

  applyThemeRefresh() {
    applyTheme(this);
  },

  onShareAppMessage() {
    return { title: "关于本书 · Kimi Cookbook", path: "/pages/about/about" };
  },

  copy(e) {
    const { text, label } = e.currentTarget.dataset;
    wx.setClipboardData({
      data: text,
      success() {
        wx.showToast({ title: `${label || "内容"}已复制`, icon: "none" });
      },
    });
  },
});
