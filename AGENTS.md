# Kimi Cookbook · 微信小程序 — Agent Brief

《Kimi · 从长文本到一套 agent 栈》的小程序阅读端,线上
<https://kimi.read.wiki>。本工程是**纯展示层**:从站点只读 API
(`/api/mp/v1/*`)拉取 → 本地缓存 → 渲染,不含内容源。内容源是平级目录的
站点仓库 `kimi-cookbook`(Next.js),**跨仓库的契约改动必须配对进行**。

**Stack**:原生微信小程序(WXML / WXSS / JS,ES modules 直接用),无 npm、
无构建、无测试套件;富文本靠 vendored mp-html v2.5.2
(`components/mp-html/`,dist/mp-weixin 压缩产物)。

**地图**:README.md(功能/架构/概览)→ `docs/design.md`(设计语言:
token、字体、组件词汇)→ `docs/contributing.md`(二开指南:环境、
内容契约、走查清单、资源再生成)。先读它们,再读这份的硬规则。

---

## 1 · 工程模型(无构建,但有几个坑)

- 微信开发者工具直接导入本目录;`project.config.json` 是 `touristappid`
  占位,本地设置里勾「不校验合法域名」。发布前要换正式 AppID(P3)。
- `app.js` 的 `globalData.baseUrl` 指向线上;本地联调改成站点局域网
  `http://<IP>:3010`(站点 `npm run build && PORT=3010 npm start`)。
- 语法检查(没有测试):`node --input-type=module --check < file` 逐个过
  改动的 .js。wxml/wxss 只能复查 + 按 README 走查清单人工过。
- `app.json` 的 `darkmode: true` 删不得——没有它,系统深色环境会把主题
  API 误报为 light,浅色配色直接画到系统深底上(不可读)。

## 2 · mp-html 的行为契约(最容易踩的坑,都是踩过的)

- **只在 `content` 变化时重排**:改 `tagStyle` 必须冲刷 content
  (`read.js` 的 `flushContent()`),否则旧样式永远烘在节点上;冲刷会塌
  页面高度,必须携带**滚动比例**复位,别把 scrollTop 绝对值存来存去。
- **对任何 `#` 链接,除了触发 linktap 还会自动滚动**(目标存在才滚,
  找不到就静默放弃),页面侧**没有否决手段**。所以「跳不跳」由目标 id
  的存在性控制:引用列表 `<li>` 刻意不带 id(点脚注只开弹层),`fnref-N`
  刻意存在(返回引文处 / ↩ 回跳都靠它)。改内容契约前先想这条。
- 我们传的 props:`use-anchor`、`scroll-table`(宽表格横滚)、`lazy-load`
  + `loading-img`、`selectable="force"`(不传长按不可选,讲代码的书必须开)。
- vendor 文件是压缩产物:**不升级、不重建、尽量不打补丁**。行为问题优先
  在内容契约侧解决(先例就是 refs 去 id,而不是改组件)。
- `rpx` 可以出现在 tagStyle / 内联样式里(代码块出血就靠它)。

## 3 · 主题、排版、按钮

- 主题 = 每页根 view 的 `t-light` / `t-dark` class 挂 CSS 变量
  (`app.wxss`);`utils/theme.js` 的 `applyTheme()` 统一刷导航栏和
  `wx.setBackgroundColor`(橡皮筋底色)。三态存 `globalData.themeMode`,
  设置弹层走 `setThemeMode` / `setFontSize`,没有 cycle 了。
  **完整的色彩 token、字体栈、组件词汇见 `docs/design.md`,改样式前必读。**
- 正文排版全部在 `utils/theme.js` 的 `readerTagStyle(theme, fontSize)`;
  HTML 内联 accent(`#1783ff`)是站点契约**不动**,tagStyle 自己算的
  accent 深色用 `#5e9fff`。
- 仓耳今楷 `wx.loadFontFace` 全局加载,失败降级宋体,阅读不阻塞。
- 按钮统一 `.btn`(`margin:0` + `min-height:88rpx` + `border-box`)压住
  微信 `<button>` UA 的自动边距和行高;view 实现的盒按钮同样 88rpx,
  否则 button 和 view 混排必然高矮不一。

## 4 · 阅读状态语义(全本地 storage,`kc:` 前缀)

- `visited` = 打开过(加载成功即打标);`finished` = 读到章末
  (`onReachBottom`)。首页「已读 N/10」和目录置灰按 **finished** 算,
  目录另有「在读」标。
- 进度**按比例**存(`kc:progress:{slug}` → `{ratio}`),旧格式
  `{scrollTop}` 向后兼容;恢复、字号/主题冲刷全部走比例。
- book / 章节 SWR 缓存 1h(`kc:cache:*`),章末预取下一章。

## 5 · 内容契约(跨仓库,详见 README「内容契约」)

- 章节 HTML 由站点 `lib/mp-render.tsx` 生成:受限 HTML 子集,accent 内联;
  `outline` / `references` / `prompts` / `kicker` 随载荷。
- 关于页:`/api/mp/v1/book` 的可选 `about` 字段(`lede` / `bookline` /
  `intro` / `meta[]` / `sections[{no,title,paragraphs?|ways?,license?,
  contacts?}]` / `kicker`),纯文本无 HTML,数组数量不限,节标题不带句点
  (小程序自补 accent 点);字段缺失或 `sections` 为空时回退
  `pages/about/about.js` 的 `DEFAULT_ABOUT`。
- 外部链接在小程序里点不开,一律「复制」;复制走
  `utils/clipboard.js` 的 `copyText`(隐私指引感知),不要直接用
  `wx.setClipboardData`。

## 6 · 验收与提交

- 提交前:`node --input-type=module --check` 过全部改动 .js;改动涉及
  交互的,在 README 走查清单上补/改对应项。
- 提交信息:`<type>(mp): <中文一行>`,type ∈ feat / fix / chore / docs;
  署名 trailer(协作者图标,账号是项目方注册的 bot 号):

  ```
  Co-authored-by: Moonshot Agent <307365324+moonshot-agent@users.noreply.github.com>
  ```

  **站点仓库是另一套规矩**(npm test / lint / tsc / build gates +
  `Co-Authored-By: Kimi Code <noreply@moonshot.ai>`),两边不要混。
- git 写操作(commit / push 等)必须先得到用户当季确认;惯例是每批做完
  报一个建议提交信息,用户说提交再提交。

## 7 · 接手时先核对的站点侧待办

- 已落地:脚注契约(fnref 锚点、refs 去 id、↩ 回跳)、`book` 载荷
  `about` 字段、`GET /api/mp/v1/qrcode`(按级生成首页/章级码)——
  小程序均有兼容回退;海报端点码随下次小程序发版生效(海报在客户端
  生成,线上旧版仍用兜底的本地官方码)。
- 其余见 README Backlog(SVG 栅格化、version 缓存失效、img 宽高预留)。
