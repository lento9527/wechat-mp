#!/usr/bin/env node
/**
 * Cover Image Generator - 封面图自动生成工具
 * 基于文章内容生成微信封面图
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// 关键词到图片主题的映射
const KEYWORD_THEMES = {
  // 科技类
  'AI': ['artificial-intelligence', 'technology', 'robot'],
  '人工智能': ['artificial-intelligence', 'technology', 'future'],
  '自动化': ['automation', 'technology', 'robot'],
  '科技': ['technology', 'tech', 'digital'],
  '科技': ['technology', 'innovation', 'future'],
  '数字': ['digital', 'technology', 'data'],
  '机器人': ['robot', 'automation', 'AI'],
  
  // 写作/内容类
  '写作': ['writing', 'typewriter', 'notebook'],
  '创作': ['creative', 'design', 'art'],
  '内容': ['content', 'media', 'blog'],
  '媒体': ['media', 'news', 'press'],
  '公众号': ['social-media', 'communication', 'message'],
  '微信': ['social-media', 'chat', 'communication'],
  
  // 效率/工具类
  '效率': ['productivity', 'efficient', 'organization'],
  '工具': ['tools', 'equipment', 'gear'],
  '助手': ['assistant', 'help', 'support'],
  '助理': ['assistant', 'service', 'support'],
  
  // 通用主题
  '创新': ['innovation', 'creative', 'idea'],
  '未来': ['future', 'technology', 'modern'],
  '智能': ['smart', 'intelligence', 'brain']
};

// 默认主题（无匹配关键词时使用）
const DEFAULT_THEMES = [
  'technology', 'abstract', 'design', 'creative', 'modern'
];

// 提取文章关键词并匹配主题
function extractThemes(title, content) {
  const text = title + ' ' + content;
  const matchedThemes = [];
  
  // 遍历关键词映射
  for (const [keyword, themes] of Object.entries(KEYWORD_THEMES)) {
    if (text.toLowerCase().includes(keyword.toLowerCase())) {
      matchedThemes.push(...themes);
    }
  }
  
  // 去重并限制数量
  const uniqueThemes = [...new Set(matchedThemes)];
  
  // 如果没有匹配到，使用默认主题
  if (uniqueThemes.length === 0) {
    // 随机选择 2-3 个默认主题
    const shuffled = DEFAULT_THEMES.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 2);
  }
  
  return uniqueThemes.slice(0, 3);
}

// 从 Picsum 获取随机图片（可靠的免费图库）
async function getPicsumImage(seed, width = 900, height = 500) {
  // Picsum Photos 是可靠的免费图库
  return `https://picsum.photos/seed/${seed}/${width}/${height}`;
}

// 从 Unsplash 获取图片（使用新的 API）
async function getUnsplashImage(keyword, width = 900, height = 500) {
  // 使用 Unsplash 的图片 ID 列表（预选的优质图片）
  const UNSPLASH_COLLECTIONS = {
    'technology': ['150463972559', '1518770660439', '151938995047'],
    'artificial-intelligence': ['1677442136019', '1620712943543', '1516110835767'],
    'writing': ['1455390582262', '1457364887197', '1517842645767'],
    'creative': ['1507003211169', '1513364776144', '1493932484895'],
    'design': ['1561070791625', '1558655146', '1542744173'],
    'business': ['1507679799987', '1556761175', '1460925895917'],
    'abstract': ['1550684848', '1541700612607', '1558591714']
  };
  
  // 获取对应主题的图片 ID，如果没有则使用通用科技图片
  const ids = UNSPLASH_COLLECTIONS[keyword] || UNSPLASH_COLLECTIONS['technology'];
  const randomId = ids[Math.floor(Math.random() * ids.length)];
  
  return `https://images.unsplash.com/photo-${randomId}?w=${width}&h=${height}&fit=crop`;
}

// 生成随机种子（用于 Picsum）
function generateSeed(text) {
  // 基于文本内容生成确定性种子
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36).substring(0, 8);
}

// 下载图片（支持重定向）
async function downloadImage(url, outputPath, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    const doDownload = (currentUrl, redirectsLeft) => {
      const file = fs.createWriteStream(outputPath);
      https.get(currentUrl, (res) => {
        // 处理重定向
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          if (redirectsLeft > 0) {
            console.log(`   跟随重定向 (${res.statusCode})...`);
            doDownload(res.headers.location, redirectsLeft - 1);
            return;
          } else {
            reject(new Error('重定向次数过多'));
            return;
          }
        }
        
        if (res.statusCode !== 200) {
          reject(new Error(`下载失败: ${res.statusCode}`));
          return;
        }
        
        res.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve(outputPath);
        });
      }).on('error', (err) => {
        fs.unlink(outputPath, () => {});
        reject(err);
      });
    };
    
    doDownload(url, maxRedirects);
  });
}

// 生成封面图主函数
async function generateCoverImage(title, content, outputDir = '/tmp') {
  console.log('🎨 分析文章内容...');
  
  const themes = extractThemes(title, content);
  console.log('   匹配主题:', themes.join(', '));
  
  // 选择主主题
  const mainTheme = themes[0];
  const seed = generateSeed(title + content);
  
  console.log('🔍 生成封面图...');
  
  try {
    // 方案1: 使用 Picsum（最可靠）
    const imageUrl = await getPicsumImage(`${mainTheme}-${seed}`);
    console.log('   图片来源: Picsum Photos');
    console.log('   图片 URL:', imageUrl);
    
    // 下载图片
    const timestamp = Date.now();
    const outputPath = path.join(outputDir, `cover_${mainTheme}_${timestamp}.jpg`);
    
    console.log('📥 下载封面图...');
    await downloadImage(imageUrl, outputPath);
    
    const stats = fs.statSync(outputPath);
    const sizeKB = (stats.size / 1024).toFixed(1);
    
    console.log('✅ 封面图生成成功!');
    console.log('   主题:', mainTheme);
    console.log('   路径:', outputPath);
    console.log('   大小:', sizeKB + ' KB');
    console.log('   尺寸: 900x500');
    
    return outputPath;
  } catch (err) {
    console.error('❌ 生成失败:', err.message);
    
    // 备用方案: 使用固定的优质图片
    console.log('   使用备用图片...');
    const fallbackUrl = `https://picsum.photos/seed/ai-${Date.now()}/900/500`;
    const outputPath = path.join(outputDir, `cover_fallback_${Date.now()}.jpg`);
    await downloadImage(fallbackUrl, outputPath);
    return outputPath;
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log(`
📷 Cover Image Generator - 封面图自动生成工具

用法:
  node cover-generator.js "文章标题" "文章内容"

示例:
  node cover-generator.js "AI写作工具推荐" "OpenClaw是一款强大的AI写作助手..."

功能:
  - 自动提取文章关键词
  - 智能匹配图片主题
  - 从免费图库生成封面图
  - 保存到 /tmp 目录
`);
    process.exit(1);
  }
  
  const title = args[0];
  const content = args[1];
  
  generateCoverImage(title, content).then(path => {
    console.log('\n💡 提示: 可以在微信发布时使用此图片作为封面');
  }).catch(err => {
    console.error('错误:', err.message);
    process.exit(1);
  });
}

module.exports = { generateCoverImage, extractThemes };
