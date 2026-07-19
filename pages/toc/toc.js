import { getBook, isVisited, isFinished, explainError } from "../../utils/api";
import { applyTheme } from "../../utils/theme";

Page({
  data: {
    theme: "light",
    book: null,
    rows: [],
    error: "",
  },

  onLoad() {
    applyTheme(this);
    getBook()
      .then((book) => {
        this.setData({ book });
        this.refreshRows();
      })
      .catch((err) => this.setData({ error: explainError(err) }));
  },

  onShow() {
    this.applyThemeRefresh();
    if (this.data.book) this.refreshRows();
  },

  applyThemeRefresh() {
    applyTheme(this);
  },

  onShareAppMessage() {
    return { title: "目录 · Kimi Cookbook", path: "/pages/toc/toc" };
  },

  onShareTimeline() {
    return { title: "目录 · Kimi Cookbook", query: "" };
  },

  refreshRows() {
    const rows = this.data.book.chapters.map((c) => ({
      ...c,
      visited: isVisited(c.slug),
      finished: isFinished(c.slug),
    }));
    this.setData({ rows });
  },

  goHome() {
    wx.reLaunch({ url: "/pages/book/book" });
  },

  openChapter(e) {
    const { slug } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/read/read?slug=${slug}` });
  },
});
