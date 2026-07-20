import { getBook, getLastRead, isFinished, explainError } from "../../utils/api";
import { applyTheme } from "../../utils/theme";
import { copyText } from "../../utils/clipboard";
import { makeBookPoster } from "../../utils/poster";

Page({
  data: {
    theme: "light",
    book: null,
    resumeLabel: "开始阅读 →",
    readCount: 0,
    error: "",
    /** Share sheet: open state, poster temp path + draw state. */
    panel: "",
    posterPath: "",
    posterMaking: false,
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

  /* ── share sheet (whole-book poster) ── */

  openShare() {
    this.setData({ panel: "share" });
    this.ensurePoster();
  },

  closePanel() {
    this.setData({ panel: "" });
  },

  sheetTouchStart(e) {
    this.sheetTouchY = e.touches[0].clientY;
  },

  sheetTouchEnd(e) {
    if (this.sheetTouchY == null) return;
    const dy = e.changedTouches[0].clientY - this.sheetTouchY;
    this.sheetTouchY = null;
    if (dy > 60) this.closePanel();
  },

  /** Whole-book poster, drawn once per visit, previewed in the sheet. */
  async ensurePoster() {
    if (this.data.posterPath || this.data.posterMaking) return;
    const book = this.data.book;
    if (!book) return;
    this.setData({ posterMaking: true });
    try {
      const path = await makeBookPoster(this, {
        coverTitle: book.coverTitle || book.title,
        lede: book.lede,
        chapters: book.chapters.length,
        minutes: book.readMinutes,
        url: "https://kimi.read.wiki/books/kimi",
      });
      if (path) this.setData({ posterPath: path });
    } catch (e) {
      /* the preview area keeps its failure note */
    }
    this.setData({ posterMaking: false });
  },

  savePoster() {
    if (!this.data.posterPath) return;
    wx.saveImageToPhotosAlbum({
      filePath: this.data.posterPath,
      success: () => wx.showToast({ title: "已存到相册" }),
      fail: () =>
        wx.showToast({ title: "保存失败,请检查相册授权", icon: "none" }),
    });
  },

  copyBookLink() {
    copyText("https://kimi.read.wiki/books/kimi", "链接已复制");
  },
});
