#!/usr/bin/env node
/**
 * Cover Image Generator - 封面图自动生成工具
 * 基于文章内容生成微信封面图
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// 提取文章关键词
function extractKeywords(title, content) {
  // 简单的关键词提取逻辑
  const text = title + ' ' + content;
  const keywords = [];
  
  // 常见技术/AI 关键词
  const techKeywords = [
    'AI', '人工智能', '自动化', '微信', '公众号', '写作', '创作',
    '效率', '工具', '智能', '科技', '未来', '创新', '数字',
    '机器人', '助手', '助理', '生成', '内容', '媒体'
  ];
  
  techKeywords.forEach(kw => {
    if (text.toLowerCase().includes(kw.toLowerCase())) {
      keywords.push(kw);
    }
  });
  
  return keywords.slice(0, 3); // 最多返回3个关键词
}

// 从 Unsplash 搜索图片
async function searchUnsplashImage(keyword) {
  return new Promise((resolve, reject) => {
    // 使用 Unsplash Source API（免费，无需 Key）
    const url = `https://source.unsplash.com/900x500/?${encodeURIComponent(keyword)}`;
    
    https.get(url, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        // 跟随重定向
        const redirectUrl = res.headers.location;
        resolve(redirectUrl);
      } else if (res.statusCode === 200) {
        resolve(url);
      } else {
        reject(new Error(`搜索失败: ${res.statusCode}`));
      }
    }).on('error', reject);
  });
}

// 下载图片
async function downloadImage(url, outputPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    https.get(url, (res) => {
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
  });
}

// 生成封面图主函数
async function generateCoverImage(title, content, outputDir = '/tmp') {
  console.log('🎨 分析文章内容...');
  
  const keywords = extractKeywords(title, content);
  console.log('   提取关键词:', keywords.join(', ') || '通用');
  
  // 选择主要关键词
  const mainKeyword = keywords[0] || 'technology';
  
  console.log('🔍 搜索匹配图片...');
  try {
    // 搜索 Unsplash
    const imageUrl = await searchUnsplashImage(mainKeyword);
    console.log('   找到图片:', imageUrl.substring(0, 60) + '...');
    
    // 下载图片
    const timestamp = Date.now();
    const outputPath = path.join(outputDir, `cover_${timestamp}.jpg`);
    
    console.log('📥 下载封面图...');
    await downloadImage(imageUrl, outputPath);
    
    const stats = fs.statSync(outputPath);
    const sizeKB = (stats.size / 1024).toFixed(1);
    
    console.log('✅ 封面图生成成功!');
    console.log('   路径:', outputPath);
    console.log('   大小:', sizeKB + ' KB');
    console.log('   尺寸: 900x500');
    
    return outputPath;
  } catch (err) {
    console.error('❌ 生成失败:', err.message);
    
    // 使用备用方案：默认科技图片
    console.log('   使用备用图片...');
    const fallbackUrl = 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=900&h=500&fit=crop';
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
  - 从免费图库搜索匹配图片
  - 下载 900x500 尺寸封面图
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

module.exports = { generateCoverImage, extractKeywords };
