# Kimi Cookbook 小程序 · 设计语言

与站点 [kimi-cookbook](https://github.com/aklmans/kimi-cookbook) 的 v3
*Editorial Reading* 同源的移动端转译:纸墨书版、衬线编辑感、克制的
Kimi 蓝。本文档是本工程视觉与组件词汇的唯一标准——改动样式前先读;
实现以 `app.wxss` 的 token 与 `utils/theme.js` 的 `readerTagStyle()` 为准。

---

## 1 · 设计原则

- **内容优先,chrome 退后**:阅读时底部栏下滑收起、大纲收进浮动 ≡,
  页面里几乎只有文字。
- **一套 token,两个主题**:颜色只在 `app.wxss` 的 `.t-light` / `.t-dark`
  里定义,组件永远写 `var(--ink)` 不写死颜色。
- **accent 记账**:Kimi 蓝只出现在该出现的地方——链接下划线、引用/
  代码左边条、句点签名、当前态高亮。同一屏不超过必要次数。
- **直角与发丝线**:按钮直角(半径 0),分隔用 1rpx hairline,
  不用卡片阴影。

## 2 · 色彩

Tokens 定义在 `app.wxss`,挂在页面根 view 的 `t-light` / `t-dark` class 上:

| Token | Light | Dark | 用途 |
| --- | --- | --- | --- |
| `--bg` | `#fafafa` | `#1a1a1a` | 页面底(暖纸 / 墨) |
| `--bg-bar` | `rgba(250,250,250,.86)` | `rgba(26,26,26,.82)` | 毛玻璃浮条底 |
| `--ink` | `#1a1a1a` | `#fafafa` | 正文主色 |
| `--ink-2` | `#3a3a3a` | `#b8b8b8` | 次级正文、lede |
| `--ink-3` | `#6b6b6b` | `#8a8a8a` | eyebrow、辅助、已读置灰 |
| `--border` | `#c0bfba` | `#3a3a3a` | hairline、框线 |
| `--rule` | `#9a9a9a` | `#4a4a4a` | 次规则线 |
| `--accent` | `#1783ff` | `#5e9fff` | Kimi 蓝(深色换浅蓝) |
| `--code-bg` | `#f3f6f9` | `#242a32` | 代码冷蓝面、骨架底 |
| `--card-ink` | `#0e0e13` | `#06080e` | 封面卡底(不反色) |
| `--skeleton` | `#eeece7` | `#262626` | 骨架屏 |

**Accent 规则**
- 正文 HTML 内联 accent(`#1783ff`,脚注数字、标题记号)是**站点契约**,
  两个主题都不改。
- 小程序自绘 accent(链接下划线、引用/代码左边条、按钮文字)跟随主题:
  浅 `#1783ff` / 深 `#5e9fff`,`utils/theme.js` 的 `readerTagStyle()` 计算。
- 主题应用只有一个入口:`utils/theme.js` 的 `applyTheme()` —— 页面 class、
  导航栏、橡皮筋底色(`wx.setBackgroundColor`)三处一起刷,不允许
  各页自行其是。

## 3 · 字体

- **正文衬线**:仓耳今楷 05(W04 正文 / W05 加重,文件名
  `TsangerJinKai02-W0x`),`wx.loadFontFace` 全局加载站点子集,
  失败降级 `"Songti SC","STSong","Noto Serif SC",serif` —— 降级不阻塞阅读。
- **mono**:`"SF Mono",Menlo,Consolas,monospace` —— eyebrow、刊号、
  进度、时长等「档案腔」标签。
- **正文字号**:基准 17px,设置弹层四档 15 / 17 / 19 / 21,
  标题随基准比例缩放(h1 ≈ 1.53×、h2 ≈ 1.21×);行高 1.8,
  阅读容器 `max-width: 680px` 居中。
- **eyebrow 体例**:mono 11px 600、letter-spacing 4rpx、`--ink-3`,
  前缀 em-dash(如 `— 本章目录`、`— I`)。
- **句点签名**:展示标题的收尾句点用 accent 色(`hero__stop` / 节标题
  由小程序自补,**契约文案不带句点**)。

## 4 · 组件词汇

- **按钮 `.btn`**:直角、1rpx 描边、`min-height: 88rpx`、`margin: 0`、
  `border-box`(压住微信 `<button>` UA 的自动边距/行高——view 盒按钮
  同样 88rpx,混排才不高矮不一);`.btn--primary` 反色填充;
  hover 透明度 0.72。
- **带框盒按钮**(章末/弹层次级操作):`flex:1` 等分、1rpx 边框、
  accent 文字、88rpx 高(`.endcard__box` / `.share__boxbtn`)。
- **底部弹层 `.sheet`**:下沿升起 240ms、max-height 62vh
  (分享弹层 86vh)、顶部抓手条、下滑 60px 关闭、遮罩 `rgba(0,0,0,.32)`;
  样式在 `app.wxss`(read/book 共用)。
- **胶囊 chip**(返回引文处 / 恢复位置提示):左下 `left:32rpx`、
  毛玻璃、999rpx 圆角、随底栏收放上下移。
- **FAB ≡**:72rpx 圆形毛玻璃,右下,大纲入口。
- **底部栏**:毛玻璃浮条、icon + mono 小字标签、下滑收起(240ms)。
- **封面卡**:`border-radius: 20rpx` + `overflow:hidden`,
  CoverVisual 月景满铺 + 标语文字层(纸色 `#efe8dc` 常量——图不反色,
  字色也不跟主题;品牌词用图里卫星的蓝 `#1783ff`)。
- **stats 三栏**:`flex:1` 等分 + 竖 hairline 分隔,eyebrow 标签 /
  serif-600 数值 / 小灰 desc,左对齐。
- **骨架屏**:`.skeleton` + sweep 扫光(1.2s),先于内容出现;
  阅读页骨架用独立 `loaded` 标志驱动(不能复用 `!html`,主题冲刷会闪)。
- **海报语法**(utils/poster.js,Zhaphar 海报体):900px 宽、96px 边距、
  右缘对齐 804、无框 hairline、Tsanger + mono、标题字号阶梯(放得下
  才用大)、accent 恰好出现两次(masthead dash + 句点)、
  底部 214px 固定带放小程序码。

## 5 · 动效

克制、单次、短促:页面淡入 180ms;弹层 240ms transform;底栏收放
240ms;进度条 width 80ms linear;hover 只用透明度变化(0.72/0.35)。
不做弹簧、不做视差。

## 6 · 标点与文案

- 半角逗号 + 空格(`, `)、「」引号、em-dash 作 eyebrow 前缀、
  ` · ` 作书名号式分隔(刊头 `KIMI COOKBOOK · NO. 01`)。
- 提示文案说人话、说下一步(「已回到上次阅读位置 · 回开头 ↑」);
  错误文案给路径不给术语(域名白名单指引见 `explainError()`)。
- WXML 里 `<text>` 元素前的空格会被折叠——**空格放进 `<text>` 内部**
  (标语/colophon 的教训)。
