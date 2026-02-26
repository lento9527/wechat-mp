---
name: WeChat MP Publisher
description: 微信公众号文章发布工具。支持草稿创建、图文消息发布、定时群发等功能。
version: 1.0.0
author: Jarvis
---

# WeChat MP Publisher

微信公众号内容发布自动化工具。

## 功能

- ✅ 获取 access_token
- ✅ 上传图片素材
- ✅ 创建图文草稿
- ✅ 发布文章（群发）
- ✅ 查询发布状态

## 配置

在 `config.json` 中配置：

```json
{
  "appid": "your-app-id",
  "appsecret": "your-app-secret"
}
```

## 使用

### 1. 发布图文消息

```bash
openclaw wechat-mp publish \
  --title "文章标题" \
  --content "文章内容（支持HTML）" \
  --thumb "封面图URL或本地路径" \
  --digest "摘要（可选）"
```

### 2. 创建草稿（不发布）

```bash
openclaw wechat-mp draft \
  --title "草稿标题" \
  --content "内容"
```

### 3. 获取 Access Token

```bash
openclaw wechat-mp token
```

## API 参考

基于微信公众平台的 [草稿箱](https://developers.weixin.qq.com/doc/offiaccount/Draft_Box/Add_draft.html) 和 [发布能力](https://developers.weixin.qq.com/doc/offiaccount/Publish/Publish.html) 接口。
