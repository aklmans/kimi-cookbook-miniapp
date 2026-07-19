import {
  getBook,
  getChapter,
  markVisited,
  saveProgress,
  getProgress,
  prefetchChapter,
  explainError,
} from "../../utils/api";
import { copyText } from "../../utils/clipboard";
import { makeChapterPoster } from "../../utils/poster";
import { applyTheme, readerTagStyle, THEME_LABEL } from "../../utils/theme";

/* Resolved lazily per call — getApp() at module top level can precede
   App() registration. */
const app = () => getApp();

const AI_PROMPT =
  "请帮我阅读 Zhapar 写的这本关于 Kimi 的书, 按需为我总结要点、回答具体问题、做读书笔记。引用时请保留作者署名和章节链接。\n\n完整 markdown: https://kimi.read.wiki/books/kimi/llms.md\n书的网页版 (含评论): https://kimi.read.wiki/books/kimi";

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
    prompts: [],
    error: "",
    barHidden: false,
    /** "" | "outline" | "footnote" */
    panel: "",
    activeRef: null,
    showAiPrompt: false,
    aiPromptText: "",
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
    this.applyThemeRefresh();
    this.loadChapter();
  },

  /** Single theme-refresh path — onLoad, manual toggle, and WeChat's
      onThemeChange all land here. The reader's content styles derive
      from the theme ALREADY APPLIED to the page (page.data.theme), never
      from a second resolution, so the page chrome and the article body
      can never disagree. */
  applyThemeRefresh() {
    applyTheme(this);
    this.applyReaderStyle();
  },

  onShareAppMessage() {
    const ch = this.data.chapter;
    return {
      title: ch ? `${ch.title} · Kimi Cookbook` : "Kimi Cookbook",
      path: `/pages/read/read?slug=${this.slug}`,
      imageUrl: "/assets/moon-tile.png",
    };
  },

  onShareTimeline() {
    const ch = this.data.chapter;
    return {
      title: ch ? `${ch.title} · Kimi Cookbook` : "Kimi Cookbook",
      query: `slug=${this.slug}`,
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
          prompts: chapter.prompts || [],
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
    const theme = this.data.theme || app().resolveTheme();
    const base = this.data.fontLarge ? 19 : 17;
    this.setData({
      tagStyle: readerTagStyle(theme, this.data.fontLarge),
      containerStyle: `font-size:${base}px;line-height:1.8;color:${theme === "dark" ? "#fafafa" : "#1a1a1a"};max-width:680px;margin:0 auto;`,
    });
    // mp-html only re-parses when `content` changes — a tagStyle update
    // alone leaves the already-baked node styles stale (the article would
    // keep the old theme's colors). Flush the content so the new styles
    // get baked in.
    const html = this.data.html;
    if (html) {
      this.setData({ html: "" });
      wx.nextTick(() => this.setData({ html }));
    }
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
    this.applyThemeRefresh();
  },

  openShare() {
    this.setData({ panel: "share" });
  },

  async makePoster() {
    this.setData({ panel: "" });
    const ch = this.data.chapter;
    if (!ch) return;
    wx.showLoading({ title: "正在画海报", mask: true });
    try {
      let lede = "";
      try {
        const book = await getBook();
        const row = (book.chapters || []).find((c) => c.slug === this.slug);
        lede = (row && row.lede) || "";
      } catch (e) {
        /* lede is optional */
      }
      const ord = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"][
        Number(ch.number) - 1
      ];
      await makeChapterPoster(this, {
        number: `${ch.number} · 第${ord}章`,
        title: ch.title,
        lede,
        url: `https://kimi.read.wiki/books/kimi/${this.slug}`,
      });
    } catch (e) {
      wx.showToast({ title: "海报生成失败", icon: "none" });
    } finally {
      wx.hideLoading();
    }
  },

  shareToAI() {
    this.setData({ showAiPrompt: true, aiPromptText: AI_PROMPT });
  },

  copyAiPrompt() {
    copyText(AI_PROMPT, "已复制,粘贴给 AI 即可");
  },

  closeAiPrompt() {
    this.setData({ showAiPrompt: false });
  },

  copyChapterLink() {
    this.setData({ panel: "" });
    copyText(`https://kimi.read.wiki/books/kimi/${this.slug}`, "链接已复制");
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

  goHome() {
    wx.reLaunch({ url: "/pages/book/book" });
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
    if (href.startsWith("#kc-prompt-")) {
      const id = Number(href.slice("#kc-prompt-".length));
      const prompt = (this.data.prompts || []).find((p) => p.id === id);
      if (prompt) {
        const text = prompt.example
          ? `${prompt.template}\n\n—— 示例 ——\n\n${prompt.example}`
          : prompt.template;
        copyText(text, "提示词已复制");
      }
      return;
    }
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
    copyText(href, "链接已复制");
  },

  copyRefLink() {
    const ref = this.data.activeRef;
    if (ref && ref.url) copyText(ref.url, "链接已复制");
  },

  onImgTap(e) {
    const src = e.detail && e.detail.src;
    if (src) {
      wx.previewImage({ urls: [src] });
    }
  },
});
