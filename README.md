# WeChat MP Publisher

微信公众号文章发布自动化工具，基于 Node.js 和微信官方 API。

## 功能特性

- ✅ 获取 access_token
- ✅ 上传图片素材
- ✅ 创建图文草稿
- ✅ 发布文章（需认证号）
- ✅ 自动封面图处理

## 安装

```bash
git clone https://github.com/YOUR_USERNAME/wechat-mp-publisher.git
cd wechat-mp-publisher
npm install
```

## 配置

1. 复制配置模板：
```bash
cp config.example.json config.json
```

2. 编辑 `config.json`，填入你的微信公众号凭证：
```json
{
  "appid": "wx-your-app-id",
  "appsecret": "your-app-secret"
}
```

## 使用

### 1. 获取 Access Token
```bash
node index.js token
```

### 2. 创建草稿
```bash
node index.js draft \
  --title "文章标题" \
  --content "文章内容（支持HTML）" \
  --digest "摘要"
```

### 3. 带封面图发布
```bash
node index.js draft \
  --title "文章标题" \
  --content "文章内容" \
  --thumb "/path/to/image.jpg" \
  --digest "摘要"
```

## 注意事项

- 公众号需要完成认证才能使用群发接口
- 服务器 IP 需要添加到公众号白名单
- 封面图会自动从素材库获取或上传

## 许可证

MIT
