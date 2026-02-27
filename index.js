#!/usr/bin/env node
/**
 * WeChat MP Publisher - 微信公众号发布工具
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// 引入封面生成器
const { generateCoverImage } = require('./cover-generator');

const CONFIG_PATH = path.join(__dirname, 'config.json');

// 读取配置
function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error('❌ 配置文件不存在，请创建 config.json');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

// HTTP 请求封装
function request(url, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = new URL(url);
    const reqOptions = {
      hostname: options.hostname,
      path: options.pathname + options.search,
      method: method,
      headers: data ? { 'Content-Type': 'application/json' } : {}
    };

    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

// 获取 Access Token
async function getAccessToken(appid, appsecret) {
  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appid}&secret=${appsecret}`;
  const res = await request(url);
  if (res.access_token) {
    // 缓存 token
    const cache = { token: res.access_token, expires: Date.now() + (res.expires_in - 300) * 1000 };
    fs.writeFileSync(path.join(__dirname, '.token_cache.json'), JSON.stringify(cache));
    return res.access_token;
  }
  throw new Error(`获取 token 失败: ${res.errmsg || JSON.stringify(res)}`);
}

// 获取缓存的 Token
async function getCachedToken(config) {
  const cachePath = path.join(__dirname, '.token_cache.json');
  if (fs.existsSync(cachePath)) {
    const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    if (cache.expires > Date.now()) {
      return cache.token;
    }
  }
  return getAccessToken(config.appid, config.appsecret);
}

// 获取默认封面图 media_id (使用 exec 调用 curl)
async function getDefaultThumbMediaId(token) {
  const { execSync } = require('child_process');
  try {
    const cmd = `curl -s -X POST "https://api.weixin.qq.com/cgi-bin/material/batchget_material?access_token=${token}" \
      -H "Content-Type: application/json" \
      -d '{"type":"image","offset":0,"count":1}'`;
    const result = JSON.parse(execSync(cmd).toString());
    if (result.item && result.item.length > 0) {
      return result.item[0].media_id;
    }
    return null;
  } catch (e) {
    return null;
  }
}

// 上传图片素材 (multipart/form-data)
async function uploadThumbImage(token, imagePath) {
  return new Promise((resolve, reject) => {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const url = `https://api.weixin.qq.com/cgi-bin/material/add_material?access_token=${token}&type=thumb`;
    
    // 读取图片文件
    const fileData = fs.readFileSync(imagePath);
    const fileName = path.basename(imagePath);
    
    // 构建 multipart body
    const postData = Buffer.concat([
      Buffer.from(`------${boundary}\r\n`),
      Buffer.from(`Content-Disposition: form-data; name="media"; filename="${fileName}"\r\n`),
      Buffer.from(`Content-Type: image/jpeg\r\n\r\n`),
      fileData,
      Buffer.from(`\r\n------${boundary}--\r\n`)
    ]);
    
    const options = new URL(url);
    const req = https.request({
      hostname: options.hostname,
      path: options.pathname + options.search,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=----${boundary}`,
        'Content-Length': postData.length
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.media_id) {
            resolve(result.media_id);
          } else {
            reject(new Error(`上传失败: ${result.errmsg || data}`));
          }
        } catch (e) {
          reject(new Error(`解析响应失败: ${data}`));
        }
      });
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// 下载网络图片到临时文件
async function downloadImage(url, tempPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(tempPath);
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`下载失败: ${res.statusCode}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(tempPath);
      });
    }).on('error', reject);
  });
}

// 创建草稿
async function createDraft(token, article) {
  const url = `https://api.weixin.qq.com/cgi-bin/draft/add?access_token=${token}`;
  const articleData = {
    title: article.title,
    author: article.author || '',
    digest: article.digest || '',
    content: article.content,
    content_source_url: article.content_source_url || '',
    need_open_comment: article.need_open_comment ?? 1,
    only_fans_can_comment: article.only_fans_can_comment ?? 0
  };
  
  // 只有提供封面时才添加 thumb_media_id
  if (article.thumb_media_id) {
    articleData.thumb_media_id = article.thumb_media_id;
  }
  
  const data = { articles: [articleData] };
  return request(url, 'POST', data);
}

// 发布文章（群发）
async function publishArticle(token, mediaId) {
  const url = `https://api.weixin.qq.com/cgi-bin/freepublish/submit?access_token=${token}`;
  return request(url, 'POST', { media_id: mediaId });
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'help') {
    console.log(`
📢 WeChat MP Publisher - 微信公众号发布工具

用法:
  node index.js <command> [options]

命令:
  token                    获取 access_token
  draft                    创建草稿
  publish                  发布文章（群发）
  config                   显示配置

示例:
  # 创建草稿（无封面）
  node index.js draft --title "标题" --content "内容"

  # 创建草稿（带指定封面）
  node index.js draft --title "标题" --content "内容" --thumb "/path/to/image.jpg"

  # 创建草稿（自动生成封面）
  node index.js draft --title "标题" --content "内容" --auto-cover

  # 发布文章（带网络封面图）
  node index.js publish --title "标题" --content "内容" --thumb "https://example.com/image.jpg" --digest "摘要"

参数:
  --title       文章标题（必需）
  --content     文章内容，支持HTML（必需）
  --thumb       封面图路径或URL（可选）
  --auto-cover  根据内容自动生成封面图（可选）
  --digest      文章摘要（可选）
`);
    return;
  }

  const config = loadConfig();

  switch (command) {
    case 'token':
      console.log('🔑 获取 access_token...');
      const token = await getAccessToken(config.appid, config.appsecret);
      console.log('✅ Token:', token.substring(0, 10) + '...');
      console.log('💾 已缓存，2小时后过期');
      break;

    case 'config':
      console.log('📋 配置信息:');
      console.log('  AppID:', config.appid);
      console.log('  AppSecret:', config.appsecret.substring(0, 4) + '****');
      break;

    case 'draft':
    case 'publish': {
      // 解析参数
      const params = {};
      for (let i = 1; i < args.length; i += 2) {
        const key = args[i].replace('--', '');
        params[key] = args[i + 1];
      }

      if (!params.title || !params.content) {
        console.error('❌ 缺少必需参数: --title 和 --content');
        process.exit(1);
      }

      console.log(`📝 ${command === 'draft' ? '创建草稿' : '发布文章'}...`);
      
      const accessToken = await getCachedToken(config);
      
      // 处理封面图
      let thumbMediaId = '';
      if (params.thumb) {
        console.log('🖼️  上传封面图...');
        try {
          let imagePath = params.thumb;
          
          // 如果是网络图片，先下载
          if (params.thumb.startsWith('http')) {
            const tempPath = `/tmp/wechat_thumb_${Date.now()}.jpg`;
            await downloadImage(params.thumb, tempPath);
            imagePath = tempPath;
            console.log('   已下载到:', tempPath);
          }
          
          thumbMediaId = await uploadThumbImage(accessToken, imagePath);
          console.log('   封面图上传成功!');
          
          // 清理临时文件
          if (params.thumb.startsWith('http') && fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
          }
        } catch (err) {
          console.error('⚠️ 封面上传失败:', err.message);
          console.log('   尝试使用默认封面...');
          thumbMediaId = await getDefaultThumbMediaId(accessToken);
          if (thumbMediaId) {
            console.log('   使用默认封面成功!');
          }
        }
      } else if (params['auto-cover'] !== undefined) {
        // 自动生成封面图
        console.log('🎨 自动生成封面图...');
        try {
          const coverPath = await generateCoverImage(params.title, params.content);
          console.log('   封面图生成成功:', coverPath);
          
          // 上传生成的封面图
          thumbMediaId = await uploadThumbImage(accessToken, coverPath);
          console.log('   封面上传成功!');
          
          // 清理临时文件
          fs.unlinkSync(coverPath);
        } catch (err) {
          console.error('⚠️ 自动生成封面失败:', err.message);
          console.log('   尝试使用默认封面...');
          thumbMediaId = await getDefaultThumbMediaId(accessToken);
          if (thumbMediaId) {
            console.log('   使用默认封面成功!');
          }
        }
      } else {
        // 没有提供封面，自动生成封面
        console.log('🎨 自动生成封面图...');
        try {
          const coverPath = await generateCoverImage(params.title, params.content);
          console.log('   封面图生成成功:', coverPath);
          
          // 上传生成的封面图
          thumbMediaId = await uploadThumbImage(accessToken, coverPath);
          console.log('   封面上传成功!');
          
          // 清理临时文件
          fs.unlinkSync(coverPath);
        } catch (err) {
          console.error('⚠️ 自动生成封面失败:', err.message);
          console.log('   尝试使用默认封面...');
          thumbMediaId = await getDefaultThumbMediaId(accessToken);
          if (thumbMediaId) {
            console.log('   默认封面设置成功!');
          } else {
            console.error('❌ 没有可用的封面图');
            process.exit(1);
          }
        }
      }
      
      const result = await createDraft(accessToken, {
        title: params.title,
        content: params.content,
        digest: params.digest || '',
        thumb_media_id: thumbMediaId
      });

      if (result.media_id) {
        console.log('✅ 草稿创建成功!');
        console.log('   Media ID:', result.media_id);
        
        if (command === 'publish') {
          console.log('📢 正在发布...');
          const pubResult = await publishArticle(accessToken, result.media_id);
          if (pubResult.errcode === 0 || pubResult.publish_id) {
            console.log('✅ 发布成功!');
            console.log('   Publish ID:', pubResult.publish_id);
          } else {
            console.error('❌ 发布失败:', pubResult.errmsg);
          }
        }
      } else {
        console.error('❌ 创建失败:', result.errmsg || JSON.stringify(result));
      }
      break;
    }

    default:
      console.error('❌ 未知命令:', command);
      process.exit(1);
  }
}

main().catch(err => {
  console.error('❌ 错误:', err.message);
  process.exit(1);
});
