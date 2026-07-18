# Kimi Cookbook · 微信小程序

《Kimi · 从长文本到一套 agent 栈》的小程序阅读端。内容来自
[kimi-cookbook](https://github.com/aklmans/kimi-cookbook) 站点的
只读内容 API(`GET /api/mp/v1/*`),本工程是纯展示层:拉取 → 本地缓存 →
渲染,不含任何内容源。

## 结构

```
app.js / app.json / app.wxss   全局:主题(浅/深/跟随系统)、设计 token
pages/book/                    首页 = 书页(封面卡、简介、开始/继续阅读)
pages/toc/                     目录(10 章,已读置灰)
pages/read/                    阅读器(mp-html + 上一章/下一章 + 字号 + 主题)
pages/about/                   关于本书(作者、授权、网页版)
components/mp-html/            富文本渲染器(vendored mp-html v2.5.2,
                               dist/mp-weixin,免 npm 构建)
utils/api.js                   内容 API 客户端(SWR 缓存 1h)+ 阅读状态
utils/theme.js                 主题应用 + mp-html tag-style 排版表
assets/moon-tile.png           月之暗面站标(与网页 favicon 同构图)
```

## 本地跑起来(验收)

1. **起内容 API**:在 `kimi-cookbook` 仓库里 `npm run build && PORT=3010 npm start`。
2. **改 API 地址**:`app.js` 里 `globalData.baseUrl` 默认
   `https://kimi.read.wiki`;本地验收改成 `http://<你 Mac 的局域网 IP>:3010`
   (localhost/127.0.0.1 在模拟器里指手机自身,别用)。
3. **导入工程**:微信开发者工具 → 导入本目录;AppID 先用「测试号」
   (`project.config.json` 里是 `touristappid` 占位,发布前换成正式 AppID)。
4. **关域名校验**:详情 → 本地设置 → 勾选「不校验合法域名、web-view、TLS
   版本以及 HTTPS 证书」(备案 + 白名单是 P3 的事,本地不用管)。
5. 编译预览:首页书页 → 目录 → 逐章阅读;切深 / 浅色、A+ 字号;
   读一半退出再进,应回到上次位置。

## 内容契约(改动须知)

- 章节 HTML 由站点 `lib/mp-render.tsx` 生成:受限 HTML 子集
  (h1-h4 / p / blockquote / figure / table / dl / ol / ul / pre / code /
  span / sup / a),accent 色是内联 `style`,结构化排版由本工程
  `utils/theme.js` 的 `readerTagStyle()` 按主题 + 字号计算。
- 外部链接在小程序里点不开,阅读页统一「复制链接」(`onLinkTap`)。
- 内联 SVG 图(3 张概念图)当前降级为「见网页版」提示,栅格化是 P2 项。

## P2 backlog

搜索(复用 `/search-index.json`)、分享海报、仓耳今楷 `wx.loadFontFace`、
SVG 图 / 封面卡栅格化、`/api/mp/v1/version` 缓存失效精确化。
