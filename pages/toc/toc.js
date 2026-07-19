import { getBook, isVisited } from "../../utils/api";
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
      .catch(() => this.setData({ error: "加载失败，请检查网络后重试" }));
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

  refreshRows() {
    const rows = this.data.book.chapters.map((c) => ({
      ...c,
      visited: isVisited(c.slug),
    }));
    this.setData({ rows });
  },

  openChapter(e) {
    const { slug } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/read/read?slug=${slug}` });
  },
});
