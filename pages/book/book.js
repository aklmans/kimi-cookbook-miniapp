import { getBook, getLastRead, isFinished, explainError } from "../../utils/api";
import { applyTheme } from "../../utils/theme";

Page({
  data: {
    theme: "light",
    book: null,
    resumeLabel: "开始阅读 →",
    readCount: 0,
    error: "",
  },

  onLoad() {
    applyTheme(this);
    this.loadBook();
  },

  onShow() {
    this.applyThemeRefresh();
    this.refreshResume();
  },

  applyThemeRefresh() {
    applyTheme(this);
  },

  onShareAppMessage() {
    const book = this.data.book;
    return {
      title: book ? book.title : "Kimi Cookbook",
      path: "/pages/book/book",
      imageUrl: "/assets/moon-tile.png",
    };
  },

  onShareTimeline() {
    const book = this.data.book;
    return {
      title: book ? `${book.title} · Zhapar` : "Kimi Cookbook",
      query: "",
    };
  },

  loadBook() {
    this.setData({ error: "" });
    getBook((fresh) => {
      if (fresh && JSON.stringify(fresh) !== JSON.stringify(this.data.book)) {
        this.setData({ book: fresh });
      }
    })
      .then((book) => {
        this.setData({ book });
        this.refreshResume();
      })
      .catch((err) => this.setData({ error: explainError(err) }));
  },

  refreshResume() {
    const book = this.data.book;
    if (!book || !book.chapters.length) return;
    // 已读 = 读到章末 (markFinished), not merely opened (markVisited).
    const readCount = book.chapters.filter((c) => isFinished(c.slug)).length;
    const last = getLastRead();
    const exists = last && book.chapters.some((c) => c.slug === last.slug);
    if (exists) {
      const ch = book.chapters.find((c) => c.slug === last.slug);
      this.setData({
        resumeLabel: `继续 · ${ch.titleShort} →`,
        resumeSlug: last.slug,
        readCount,
      });
    } else {
      this.setData({
        resumeLabel: "开始阅读 →",
        resumeSlug: book.chapters[0].slug,
        readCount,
      });
    }
  },

  startReading() {
    wx.navigateTo({ url: `/pages/read/read?slug=${this.data.resumeSlug}` });
  },

  openToc() {
    wx.navigateTo({ url: "/pages/toc/toc" });
  },

  openAbout() {
    wx.navigateTo({ url: "/pages/about/about" });
  },
});
