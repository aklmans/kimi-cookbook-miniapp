import {
  getChapter,
  markVisited,
  saveProgress,
  getProgress,
  prefetchChapter,
} from "../../utils/api";
import { applyTheme, readerTagStyle, THEME_LABEL } from "../../utils/theme";

/* Resolved lazily per call — getApp() at module top level can precede
   App() registration. */
const app = () => getApp();

Page({
  data: {
    theme: "light",
    themeLabel: "跟随系统",
    fontLarge: false,
    chapter: null,
    html: "",
    tagStyle: {},
    containerStyle: "",
    outline: [],
    references: [],
    error: "",
    barHidden: false,
    /** "" | "outline" | "footnote" */
    panel: "",
    activeRef: null,
  },

  onLoad(options) {
    const slug = options.slug;
    if (!slug) {
      this.setData({ error: "缺少章节参数" });
      return;
    }
    this.slug = slug;
    this.restored = false;
    this.setData({
      fontLarge: app().globalData.fontLarge,
      themeLabel: THEME_LABEL[app().globalData.themeMode],
    });
    applyTheme(this);
    this.applyReaderStyle();
    this.loadChapter();
  },

  onShareAppMessage() {
    const ch = this.data.chapter;
    return {
      title: ch ? `${ch.title} · Kimi Cookbook` : "Kimi Cookbook",
      path: `/pages/read/read?slug=${this.slug}`,
      imageUrl: "/assets/moon-tile.png",
    };
  },

  onPageScroll(e) {
    // Immersive chrome: the bottom bar hides scrolling down, returns
    // scrolling up.
    const last = this.lastScrollTop || 0;
    const delta = e.scrollTop - last;
    if (Math.abs(delta) > 10) {
      const hide = delta > 0 && e.scrollTop > 160;
      if (hide !== this.data.barHidden) this.setData({ barHidden: hide });
    }
    this.lastScrollTop = e.scrollTop;

    if (!this.restored) return;
    if (this.scrollTimer) return;
    this.scrollTimer = setTimeout(() => {
      this.scrollTimer = null;
      saveProgress(this.slug, e.scrollTop);
    }, 400);
  },

  loadChapter() {
    this.setData({ error: "" });
    getChapter(this.slug)
      .then((chapter) => {
        markVisited(this.slug);
        this.setData({
          chapter,
          html: chapter.html,
          outline: chapter.outline || [],
          references: chapter.references || [],
        });
        wx.setNavigationBarTitle({ title: chapter.title.split(" · ")[0] });
        this.restoreScroll();
        if (chapter.next) prefetchChapter(chapter.next.slug);
      })
      .catch(() => this.setData({ error: "加载失败，请检查网络后重试" }));
  },

  restoreScroll() {
    const progress = getProgress(this.slug);
    wx.nextTick(() => {
      setTimeout(() => {
        if (progress && progress.scrollTop > 120) {
          wx.pageScrollTo({ scrollTop: progress.scrollTop, duration: 0 });
        }
        // Gate saving until the restored position (or the top) has been
        // applied, so onPageScroll doesn't immediately overwrite it.
        this.restored = true;
      }, 350);
    });
  },

  applyReaderStyle() {
    const theme = app().resolveTheme();
    const base = this.data.fontLarge ? 19 : 17;
    this.setData({
      tagStyle: readerTagStyle(theme, this.data.fontLarge),
      containerStyle: `font-size:${base}px;line-height:1.8;color:${theme === "dark" ? "#fafafa" : "#1a1a1a"};max-width:680px;margin:0 auto;`,
    });
  },

  toggleFont() {
    app().globalData.fontLarge = !app().globalData.fontLarge;
    wx.setStorageSync("kc:font-large", app().globalData.fontLarge);
    wx.vibrateShort({ type: "light" });
    this.setData({ fontLarge: app().globalData.fontLarge });
    this.applyReaderStyle();
  },

  toggleTheme() {
    app().cycleTheme();
    wx.vibrateShort({ type: "light" });
    this.setData({ themeLabel: THEME_LABEL[app().globalData.themeMode] });
    applyTheme(this);
    this.applyReaderStyle();
  },

  openPrev() {
    const prev = this.data.chapter && this.data.chapter.prev;
    if (prev) {
      wx.redirectTo({ url: `/pages/read/read?slug=${prev.slug}` });
    }
  },

  openNext() {
    const next = this.data.chapter && this.data.chapter.next;
    if (next) {
      wx.redirectTo({ url: `/pages/read/read?slug=${next.slug}` });
    }
  },

  openToc() {
    wx.navigateTo({ url: "/pages/toc/toc" });
  },

  /* ── in-chapter outline (mp-html anchors) ── */

  toggleOutline() {
    this.setData({ panel: this.data.panel === "outline" ? "" : "outline" });
  },

  closePanel() {
    this.setData({ panel: "" });
  },

  jumpToSection(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ panel: "" });
    this.selectComponent("#mp-html")
      .navigateTo(id)
      .catch(() => {});
  },

  jumpToRefs() {
    this.setData({ panel: "" });
    this.selectComponent("#mp-html")
      .navigateTo("kc-refs")
      .catch(() => {});
  },

  /** Links: footnote anchors open the reference sheet, other internal
      anchors scroll, external URLs get copied (a Mini Program can't
      open them). */
  onLinkTap(e) {
    const href = e.detail && e.detail.href;
    if (!href) return;
    if (href.startsWith("#fn-")) {
      const id = Number(href.slice(4));
      const ref = (this.data.references || []).find((r) => r.id === id);
      if (ref) {
        this.setData({ panel: "footnote", activeRef: ref });
      }
      return;
    }
    if (href.startsWith("#")) {
      this.selectComponent("#mp-html")
        .navigateTo(href.slice(1))
        .catch(() => {});
      return;
    }
    wx.setClipboardData({
      data: href,
      success() {
        wx.showToast({ title: "链接已复制", icon: "none" });
      },
    });
  },

  copyRefLink() {
    const ref = this.data.activeRef;
    if (ref && ref.url) {
      wx.setClipboardData({
        data: ref.url,
        success() {
          wx.showToast({ title: "链接已复制", icon: "none" });
        },
      });
    }
  },

  onImgTap(e) {
    const src = e.detail && e.detail.src;
    if (src) {
      wx.previewImage({ urls: [src] });
    }
  },
});
