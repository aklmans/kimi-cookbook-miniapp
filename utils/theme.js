/* Theme application shared by every page: sets the page's `theme`
   data (drives the root view's .t-light/.t-dark class, which owns the
   CSS vars) and repaints the navigation bar to match. */

export function applyTheme(page) {
  const app = getApp();
  const theme = app.resolveTheme();
  page.setData({ theme });
  wx.setNavigationBarColor({
    frontColor: theme === "dark" ? "#ffffff" : "#000000",
    backgroundColor: theme === "dark" ? "#1a1a1a" : "#fafafa",
    animation: { duration: 200, timingFunc: "easeIn" },
  });
}

export const THEME_LABEL = {
  system: "跟随系统",
  light: "浅色",
  dark: "深色",
};

/* Reader typography for mp-html. mp-html is style-isolated: page WXSS
   can't reach inside it, so structure styles go through its `tag-style`
   prop (computed here per theme + font size), while accents ride as
   inline styles in the HTML itself (lib/mp-render.tsx). */
export function readerTagStyle(theme, fontSize) {
  const dark = theme === "dark";
  const ink = dark ? "#fafafa" : "#1a1a1a";
  const ink2 = dark ? "#b8b8b8" : "#3a3a3a";
  const ink3 = dark ? "#8a8a8a" : "#6b6b6b";
  const border = dark ? "#3a3a3a" : "#c0bfba";
  const codeBg = dark ? "#242a32" : "#f3f6f9";
  const serif = '"TsangerJinKai02-W04","Songti SC","STSong","Noto Serif SC",serif';
  const serif600 = '"TsangerJinKai02-W05","Songti SC","STSong","Noto Serif SC",serif';
  const mono = '"SF Mono",Menlo,Consolas,monospace';
  /* Headings scale with the body size (base) instead of fixed two-level
     values — 17px base reproduces the original 26/21 heading pair. */
  const base = fontSize || 17;
  const h1 = Math.round(base * 1.53);
  const h2 = Math.round(base * 1.21);
  /* Shiki dual-theme resolution: rehype-pretty-code emits each token span
     with BOTH --shiki-light and --shiki-dark custom properties inline but
     no color declaration (the web resolves them via globals.css Round-8).
     Here the span rule picks the right var per theme — the vars resolve
     locally on each span, so code keeps its Kimi-blue highlight in both
     themes. Accent spans carry their own inline color and win over this. */
  const shikiVar = dark ? "var(--shiki-dark)" : "var(--shiki-light)";

  return {
    h1: `font-family:${serif600};font-size:${h1}px;font-weight:600;line-height:1.35;margin:0 0 16px;color:${ink}`,
    h2: `font-family:${serif600};font-size:${h2}px;font-weight:600;line-height:1.4;margin:44px 0 18px;color:${ink}`,
    h3: `font-family:${serif600};font-size:${Math.round(h2 * 0.86)}px;font-weight:600;line-height:1.45;margin:32px 0 12px;color:${ink}`,
    h4: `font-family:${serif600};font-size:1em;font-weight:600;margin:24px 0 8px;color:${ink}`,
    p: `margin:0 0 20px;color:${ink}`,
    span: `color:${shikiVar}`,
    small: `font-size:0.78em;color:${ink3}`,
    strong: `font-family:${serif600};font-weight:600;color:${ink}`,
    em: `font-style:normal;color:${ink2}`,
    a: `color:${ink};text-decoration:underline;text-decoration-color:#1783ff;text-underline-offset:3px`,
    blockquote: `margin:24px 0;padding:14px 18px;border-left:2px solid #1783ff;background:${codeBg};color:${ink2}`,
    pre: `margin:24px 0;padding:16px 18px;background:${codeBg};border-left:2px solid #1783ff;font-family:${mono};font-size:0.82em;line-height:1.7;white-space:pre-wrap;word-break:break-all;color:${ink}`,
    code: `font-family:${mono};font-size:0.86em;background:${codeBg};padding:2px 5px;color:${ink}`,
    "pre code": `background:transparent;padding:0;font-size:1em`,
    img: `max-width:100%;display:block;margin:0 auto`,
    figure: `margin:28px 0`,
    figcaption: `margin-top:10px;font-size:0.78em;color:${ink3};text-align:center`,
    hr: `border:none;border-top:1px solid ${border};margin:32px 0`,
    table: `width:100%;border-collapse:collapse;margin:24px 0;font-size:0.85em`,
    th: `text-align:left;padding:8px 10px;border-bottom:1px solid ${border};font-family:${mono};font-size:0.78em;color:${ink3};font-weight:600`,
    td: `padding:8px 10px;border-bottom:1px solid ${border};color:${ink};vertical-align:top`,
    ol: `margin:0 0 20px;padding-left:1.4em;color:${ink}`,
    ul: `margin:0 0 20px;padding-left:1.4em;color:${ink}`,
    li: `margin:6px 0`,
    dl: `margin:0 0 20px`,
    dt: `font-family:${serif600};font-weight:600;color:${ink};margin-top:12px`,
    dd: `margin:4px 0 0;color:${ink2}`,
    sup: `font-size:0.7em;line-height:0`,
    kbd: `font-family:${mono};font-size:0.82em;border:1px solid ${border};padding:1px 6px;background:${codeBg};color:${ink}`,
  };
}
