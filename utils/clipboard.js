/* Privacy-aware clipboard helper (pattern from the sister Taro app).
   wx.setClipboardData is gated by the 《用户隐私保护指引》 declaration:
   requirePrivacyAuthorize re-prompts accounts that denied it once, and
   failures are classified instead of a bare "copy failed". Every page's
   long-press text selection stays as the ultimate fallback. */

/**
 * Copy text to the clipboard. Returns true on success.
 * @param {string} data
 * @param {string} [title] toast title on success
 */
export async function copyText(data, title = "已复制") {
  if (!data) return false;
  if (typeof wx.requirePrivacyAuthorize === "function") {
    try {
      await wx.requirePrivacyAuthorize();
    } catch (e) {
      wx.showToast({ title: "同意隐私保护指引后才能复制", icon: "none" });
      return false;
    }
  }
  try {
    await wx.setClipboardData({ data });
    wx.showToast({ title, icon: "none" });
    return true;
  } catch (e) {
    const msg = (e && e.errMsg) || "";
    wx.showToast({
      title: /privacy|declared|agreement/i.test(msg)
        ? "复制暂不可用(隐私授权未生效)"
        : "复制失败,可长按选择文本",
      icon: "none",
    });
    return false;
  }
}
