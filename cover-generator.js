#!/usr/bin/env node
/**
 * Cover Image Generator - 封面图自动生成工具
 * 基于文章内容生成微信封面图 - 儿童故事优化版
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// 关键词到图片主题的映射 - 添加儿童故事关键词
const KEYWORD_THEMES = {
  // 儿童故事类 - 新增
  '童话': ['fairy-tale', 'fantasy', 'magic', 'dream'],
  '故事': ['story', 'book', 'imagination', 'dream'],
  '小兔子': ['rabbit', 'bunny', 'cute-animal', 'forest'],
  '兔子': ['rabbit', 'bunny', 'cute-animal'],
  '小狐狸': ['fox', 'cute-animal', 'forest'],
  '狐狸': ['fox', 'cute-animal', 'forest'],
  '小熊': ['bear', 'cute-animal', 'forest'],
  '小猫': ['cat', 'kitten', 'cute-animal'],
  '小狗': ['dog', 'puppy', 'cute-animal'],
  '小猴子': ['monkey', 'cute-animal', 'jungle'],
  '小鸟': ['bird', 'cute-animal', 'sky'],
  '森林': ['forest', 'nature', 'trees', 'woods'],
  '星星': ['stars', 'night-sky', 'galaxy', 'dream'],
  '月亮': ['moon', 'night-sky', 'dream'],
  '时间': ['clock', 'time', 'hourglass', 'sand'],
  '银行': ['bank', 'building', 'gold', 'treasure'],
  '勇气': ['bravery', 'mountain', 'sunrise', 'light'],
  '梦想': ['dream', 'clouds', 'sky', 'stars'],
  '友谊': ['friendship', 'hands', 'heart', 'together'],
  '分享': ['sharing', 'hands', 'gift', 'heart'],
  '魔法': ['magic', 'sparkle', 'fantasy', 'stars'],
  '冒险': ['adventure', 'mountain', 'forest', 'path'],
  
  // 科技类
  'AI': ['artificial-intelligence', 'technology', 'robot'],
  '人工智能': ['artificial-intelligence', 'technology', 'future'],
  '自动化': ['automation', 'technology', 'robot'],
  '科技': ['technology', 'tech', 'digital'],
  '数字': ['digital', 'technology', 'data'],
  '机器人': ['robot', 'automation', 'AI'],
  
  // 写作/内容类
  '写作': ['writing', 'typewriter', 'notebook'],
  '创作': ['creative', 'design', 'art'],
  '内容': ['content', 'media', 'blog'],
  '媒体': ['media', 'news', 'press'],
  
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

// 默认主题（无匹配关键词时使用）- 儿童故事默认用梦幻主题
const DEFAULT_THEMES = [
  'dream', 'imagination', 'story', 'fantasy', 'magic'
];

// 儿童故事相关的 Pollinations 提示词模板
const STORY_PROMPT_TEMPLATES = {
  'rabbit': 'cute fluffy rabbit in a magical forest, childrens book illustration, soft pastel colors, warm lighting, storybook art style',
  'bunny': 'adorable bunny character, storybook illustration, gentle colors, whimsical scene, childrens illustration',
  'fox': 'friendly fox character, forest setting, storybook illustration, warm colors, childrens book art',
  'bear': 'cute bear character, friendly expression, forest background, storybook style, soft lighting',
  'cat': 'cute cat character, cozy scene, storybook illustration, warm pastel colors, childrens art',
  'dog': 'friendly puppy, playful scene, storybook illustration, bright cheerful colors, childrens book',
  'monkey': 'playful monkey, jungle scene, storybook illustration, vibrant colors, childrens art style',
  'bird': 'cute bird character, sky background, storybook illustration, soft colors, whimsical',
  'stars': 'magical starry night, twinkling stars, dreamy atmosphere, storybook illustration, soft glow',
  'moon': 'gentle moon in night sky, dreamy clouds, storybook illustration, soft blue and silver',
  'forest': 'enchanted forest, magical trees, storybook illustration, soft lighting, childrens art',
  'time': 'magical clock, golden hourglass, sparkles, storybook illustration, warm colors',
  'bank': 'magical treasury, golden coins, sparkle, storybook illustration, warm lighting',
  'dream': 'dreamy clouds, magical atmosphere, soft pastel colors, storybook illustration, whimsical',
  'friendship': 'cute animals together, heartwarming scene, storybook illustration, warm colors',
  'magic': 'magical sparkles, enchanted scene, storybook illustration, golden light, fantasy',
  'adventure': 'exciting journey path, magical landscape, storybook illustration, vibrant colors'
};

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

// 基于主题生成 AI 图片提示词
function generateAIPrompt(title, content, themes) {
  // 检查是否匹配到故事模板
  for (const [key, template] of Object.entries(STORY_PROMPT_TEMPLATES)) {
    if (themes.some(t => t.includes(key))) {
      return `${template}, high quality, detailed, 900x500 banner format`;
    }
  }
  
  // 通用儿童故事提示词
  const mainTheme = themes[0] || 'story';
  return `childrens storybook illustration, ${mainTheme} theme, ${title}, magical atmosphere, soft pastel colors, warm lighting, whimsical art style, high quality, 900x500 banner format`;
}

// 从 Pollinations.ai 生成 AI 图片（根据文字提示）
async function generateAICover(prompt, width = 900, height = 500) {
  // Pollinations.ai 是免费的 AI 图片生成服务
  const encodedPrompt = encodeURIComponent(prompt);
  return `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&nologo=true`;
}

// 从 Picsum 获取随机图片（备用方案）
async function getPicsumImage(seed, width = 900, height = 500) {
  return `https://picsum.photos/seed/${seed}/${width}/${height}`;
}

// 生成随机种子
function generateSeed(text) {
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
  
  const mainTheme = themes[0];
  const seed = generateSeed(title + content);
  
  console.log('🔍 生成封面图...');
  
  // 方案1: 使用 Pollinations.ai 生成 AI 封面（根据文章主题）
  try {
    const aiPrompt = generateAIPrompt(title, content, themes);
    console.log('   使用 AI 生成图片...');
    console.log('   提示词:', aiPrompt.substring(0, 60) + '...');
    
    const aiImageUrl = await generateAICover(aiPrompt);
    console.log('   图片 URL:', aiImageUrl.substring(0, 60) + '...');
    
    const timestamp = Date.now();
    const outputPath = path.join(outputDir, `cover_ai_${mainTheme}_${timestamp}.jpg`);
    
    console.log('📥 下载 AI 封面图...');
    await downloadImage(aiImageUrl, outputPath);
    
    const stats = fs.statSync(outputPath);
    const sizeKB = (stats.size / 1024).toFixed(1);
    
    console.log('✅ AI 封面图生成成功!');
    console.log('   主题:', mainTheme);
    console.log('   路径:', outputPath);
    console.log('   大小:', sizeKB + ' KB');
    console.log('   尺寸: 900x500');
    
    return outputPath;
  } catch (err) {
    console.error('⚠️ AI 生成失败:', err.message);
    console.log('   切换到备用方案...');
  }
  
  // 方案2: 使用 Picsum（备用）
  try {
    const imageUrl = await getPicsumImage(`${mainTheme}-${seed}`);
    console.log('   图片来源: Picsum Photos');
    
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
    
    return outputPath;
  } catch (err) {
    console.error('❌ 生成失败:', err.message);
    
    // 最终备用方案
    console.log('   使用通用备用图片...');
    const fallbackUrl = `https://picsum.photos/seed/story-${Date.now()}/900/500`;
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
📷 Cover Image Generator - 封面图自动生成工具（儿童故事版）

用法:
  node cover-generator.js "文章标题" "文章内容"

示例:
  node cover-generator.js "时间银行" "小兔子去时间银行存时间..."

功能:
  - 自动提取文章关键词（支持儿童故事主题）
  - 使用 AI 生成独特封面图
  - 智能匹配故事角色（兔子、狐狸、熊等）
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

module.exports = { generateCoverImage, extractThemes, generateAIPrompt };
