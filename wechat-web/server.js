const express = require('express');
const axios = require('axios');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const ExcelJS = require('exceljs');
const cheerio = require('cheerio');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件配置
// 启用 gzip 压缩
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6 // 压缩级别 0-9，6是平衡性能和压缩率
}));

app.use(cors({
  origin: true, // 允许所有来源（开发环境）
  credentials: true // 允许携带凭证
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'wechat-crawler-secret-2024',
  resave: false,
  saveUninitialized: true, // 改为 true，确保创建 session
  cookie: { 
    secure: false, // 生产环境设置为 true（需要 HTTPS）
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24小时
    sameSite: 'lax' // 允许同站点请求携带 cookie
  }
}));

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// 内存存储（生产环境建议使用数据库）
const storage = {
  accounts: [],
  articles: {}, // 文章列表缓存：{ fakeid: { articles: [], lastUpdate: timestamp } }
  articleContent: {}, // 文章内容缓存：{ url: { html: '', lastUpdate: timestamp } }
  settings: {}
};

// 缓存配置
const CACHE_CONFIG = {
  ARTICLE_LIST_TTL: 30 * 60 * 1000, // 文章列表缓存30分钟
  ARTICLE_CONTENT_TTL: 7 * 24 * 60 * 60 * 1000, // 文章内容缓存7天（延长缓存时间）
  MAX_CONTENT_CACHE: 500 // 最多缓存500篇文章内容（增加缓存数量）
};

// 检查缓存是否有效
function isCacheValid(lastUpdate, ttl) {
  if (!lastUpdate) return false;
  return (Date.now() - lastUpdate) < ttl;
}

// 清理过期的文章内容缓存
function cleanExpiredContentCache() {
  const now = Date.now();
  let cleaned = 0;
  
  for (const url in storage.articleContent) {
    const cache = storage.articleContent[url];
    if (!isCacheValid(cache.lastUpdate, CACHE_CONFIG.ARTICLE_CONTENT_TTL)) {
      delete storage.articleContent[url];
      cleaned++;
    }
  }
  
  // 如果缓存数量超过限制，删除最旧的
  const cacheKeys = Object.keys(storage.articleContent);
  if (cacheKeys.length > CACHE_CONFIG.MAX_CONTENT_CACHE) {
    const sorted = cacheKeys
      .map(url => ({ url, time: storage.articleContent[url].lastUpdate }))
      .sort((a, b) => a.time - b.time);
    
    const toDelete = sorted.slice(0, sorted.length - CACHE_CONFIG.MAX_CONTENT_CACHE);
    toDelete.forEach(item => {
      delete storage.articleContent[item.url];
      cleaned++;
    });
  }
  
  if (cleaned > 0) {
    console.log(`🧹 清理了 ${cleaned} 个过期缓存`);
  }
}

// 定期清理缓存（每小时）
setInterval(cleanExpiredContentCache, 60 * 60 * 1000);

// ================== 辅助函数 ==================

// 获取 User-Agent
function getUserAgent() {
  return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.99 Safari/537.36';
}

// 延迟函数
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 从 session / 头部 / 请求体提取设置（适配无状态环境）
function getSettings(req) {
  const sessionSettings = (req.session && req.session.settings) || {};
  const headerToken = req.headers['x-auth-token'];
  const headerCookie = req.headers['x-auth-cookie'];
  const headerFingerprint = req.headers['x-auth-fingerprint'];
  const body = req.body || {};
  let cookieFromClient = null;
  try {
    const raw = req.cookies && (req.cookies.WX_AUTH || req.cookies['wx_auth']);
    if (raw) cookieFromClient = Buffer.from(raw, 'base64').toString('utf8');
  } catch {}
  return {
    token: sessionSettings.token || headerToken || body.token || '',
    cookie: sessionSettings.cookie || cookieFromClient || headerCookie || body.cookie || '',
    fingerprint: sessionSettings.fingerprint || headerFingerprint || body.fingerprint || ''
  };
}

// 允许通过代理的域名
const ALLOWED_SUFFIXES = ['qpic.cn', 'wx.qq.com', 'qlogo.cn'];

function isAllowedUrl(u) {
  try {
    const parsed = new URL(u);
    if (parsed.hostname === 'mp.weixin.qq.com') return true;
    return ALLOWED_SUFFIXES.some(suf => parsed.hostname.endsWith(suf));
  } catch {
    return false;
  }
}

function toAbsoluteUrl(originalUrl, src) {
  try {
    const base = new URL(originalUrl);
    if (!src) return '';
    // handle protocol-relative
    if (src.startsWith('//')) return `${base.protocol}${src}`;
    // handle absolute
    if (/^https?:\/\//i.test(src)) return src;
    // handle relative
    return new URL(src, base).toString();
  } catch {
    return src || '';
  }
}

function rewriteToProxy(u, pageUrl) {
  const enc = encodeURIComponent(u);
  const page = pageUrl ? `&page=${encodeURIComponent(pageUrl)}` : '';
  return `/api/proxy?url=${enc}${page}`;
}

function addWxFmtIfNeeded(url, fmtHint) {
  try {
    const p = new URL(url);
    const host = p.hostname;
    if (!ALLOWED_SUFFIXES.some(s => host.endsWith(s))) return url;
    // ensure wx_fmt param
    const hasFmt = p.searchParams.has('wx_fmt');
    if (!hasFmt) {
      const fmt = (fmtHint || '').toLowerCase();
      const ext = (p.pathname.split('.').pop() || '').toLowerCase();
      const chosen = fmt || (ext.match(/^(jpeg|jpg|png|gif|webp)$/) ? (ext === 'jpg' ? 'jpeg' : ext) : 'jpeg');
      p.searchParams.set('wx_fmt', chosen);
    }
    return p.toString();
  } catch {
    return url;
  }
}

function processArticleHtml(html, originalUrl) {
  const $ = cheerio.load(html, { decodeEntities: false });
  // Remove heavy scripts to avoid delays
  $('script').remove();
  // Normalize images
  $('img').each((_, el) => {
    const $el = $(el);
    const ds = $el.attr('data-src') || $el.attr('data-original') || $el.attr('data-backup-src') || $el.attr('data-raw-src');
    const src = $el.attr('src');
    let finalSrc = toAbsoluteUrl(originalUrl, ds || src);
    const fmtHint = $el.attr('data-type') || $el.attr('data-wx_fmt') || '';
    finalSrc = addWxFmtIfNeeded(finalSrc, fmtHint);
    if (finalSrc) {
      const proxied = rewriteToProxy(finalSrc, originalUrl);
      $el.attr('src', proxied);
      $el.removeAttr('data-src');
      $el.removeAttr('data-original');
      $el.removeAttr('data-backup-src');
      $el.removeAttr('data-raw-src');
      $el.removeAttr('crossorigin');
      $el.removeAttr('referrerpolicy');
      $el.removeAttr('nonce');
    }
  });
  // Normalize source tags inside picture
  $('source').each((_, el) => {
    const $el = $(el);
    const ds = $el.attr('data-srcset') || $el.attr('data-original-set') || $el.attr('data-dsrc');
    const ss = $el.attr('srcset');
    const raw = ds || ss || '';
    if (raw) {
      const parts = raw.split(',').map(s => s.trim()).filter(Boolean).map(part => {
        const [url, size] = part.split(' ').filter(Boolean);
        let abs = toAbsoluteUrl(originalUrl, url);
        abs = addWxFmtIfNeeded(abs, '');
        const prox = rewriteToProxy(abs, originalUrl);
        return size ? `${prox} ${size}` : prox;
      });
      $el.attr('srcset', parts.join(', '));
      $el.removeAttr('data-srcset');
      $el.removeAttr('data-original-set');
      $el.removeAttr('data-dsrc');
    }
  });
  // Rewrite inline background-image URLs
  $('[style]').each((_, el) => {
    const $el = $(el);
    const style = $el.attr('style') || '';
    const replaced = style.replace(/url\(("|')?(.*?)\1\)/g, (_, __, url) => {
      let abs = toAbsoluteUrl(originalUrl, url);
      abs = addWxFmtIfNeeded(abs, '');
      const prox = rewriteToProxy(abs, originalUrl);
      return `url('${prox}')`;
    });
    if (replaced !== style) {
      $el.attr('style', replaced);
    }
  });
  // Add base for relative links (if any)
  $('head').prepend(`<base href="${originalUrl}">`);
  // Ensure body hidden overflow to avoid inner scrollbars
  $('head').append('<style>body{overflow:hidden!important}</style>');
  return $.html();
}

// ================== API 路由 ==================

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '服务运行正常' });
});

// 保存设置（Cookie、Token、Fingerprint）
app.post('/api/settings', (req, res) => {
  try {
    const { cookie, token, fingerprint } = req.body;
    
    // 保存到 session
    req.session.settings = {
      cookie: cookie || '',
      token: token || '',
      fingerprint: fingerprint || '',
      lastUpdated: new Date().toISOString()
    };
    
    // 同步到客户端（Base64 编码，避免特殊字符破坏）：便于无状态环境在资源代理时携带
    try {
      const b64 = Buffer.from(cookie || '', 'utf8').toString('base64');
      res.cookie('WX_AUTH', b64, { httpOnly: true, sameSite: 'lax', maxAge: 24 * 60 * 60 * 1000 });
    } catch {}
    
    
    res.json({ 
      success: true, 
      message: '设置保存成功',
      data: {
        hasToken: !!token,
        hasCookie: !!cookie,
        hasFingerprint: !!fingerprint
      }
    });
  } catch (error) {
    console.error('保存设置失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '保存设置失败: ' + error.message 
    });
  }
});

// 获取设置
app.get('/api/settings', (req, res) => {
  const settings = req.session.settings || {};
  res.json({ 
    success: true,
    data: {
      hasToken: !!settings.token,
      hasCookie: !!settings.cookie,
      hasFingerprint: !!settings.fingerprint,
      lastUpdated: settings.lastUpdated || null
    }
  });
});

// 搜索公众号
app.post('/api/search-account', async (req, res) => {
  try {
    const { accountName, query } = req.body;
    const accountQuery = (accountName || query || '').trim();
    const settings = getSettings(req);
    
    if (!accountQuery) {
      return res.status(400).json({ success: false, message: '缺少账号名称' });
    }

    console.log('🔍 搜索公众号:', accountQuery);
    console.log('📝 配置检查 - Token:', settings.token ? '✅已配置' : '❌未配置');
    console.log('📝 配置检查 - Cookie:', settings.cookie ? '✅已配置' : '❌未配置');
    
    if (!settings.cookie || !settings.token) {
      return res.status(401).json({ 
        success: false, 
        message: '请先配置 Cookie 和 Token' 
      });
    }
    
    const url = 'https://mp.weixin.qq.com/cgi-bin/searchbiz';
    const params = {
      action: 'search_biz',
      begin: 0,
      count: 5,
      query: accountQuery,
      fingerprint: settings.fingerprint || '',
      token: settings.token,
      lang: 'zh_CN',
      f: 'json',
      ajax: '1'
    };
    
    console.log('📡 发送请求到:', url);
    console.log('🔑 Token:', settings.token);
    
    const response = await axios.get(url, {
      params,
      headers: {
        'Cookie': settings.cookie,
        'User-Agent': getUserAgent(),
        'Referer': 'https://mp.weixin.qq.com/'
      },
      timeout: 10000
    });
    
    console.log('📥 API响应:', JSON.stringify(response.data, null, 2));
    
    if (response.data.base_resp.ret === 0 && response.data.list && response.data.list.length > 0) {
      const account = response.data.list[0];
      console.log('✅ 找到公众号:', account.nickname);
      res.json({
        success: true,
        data: {
          fakeid: account.fakeid,
          nickname: account.nickname,
          alias: account.alias || '',
          avatar: account.round_head_img || '',
          signature: account.signature || ''
        }
      });
    } else {
      const errorCode = response.data.base_resp.ret;
      let errorMsg = '未找到该公众号';
      
      if (errorCode === 200003) {
        errorMsg = 'Cookie或Token已过期，请重新配置';
      } else if (errorCode === 200013) {
        errorMsg = '请求过于频繁，请稍后再试';
      } else if (errorCode === -1) {
        errorMsg = '系统错误，请检查Cookie和Token是否正确';
      } else if (response.data.list && response.data.list.length === 0) {
        errorMsg = `未找到公众号"${accountName}"，请检查名称是否正确`;
      }
      
      console.log('❌ 搜索失败 - 错误码:', errorCode, '错误信息:', errorMsg);
      
      res.json({
        success: false,
        message: errorMsg,
        errorCode: errorCode
      });
    }
  } catch (error) {
    console.error('❌ 搜索公众号异常:', error.message);
    if (error.response) {
      console.error('📥 错误响应:', error.response.data);
    }
    
    let errorMessage = '搜索失败';
    if (error.code === 'ECONNABORTED') {
      errorMessage = '请求超时，请检查网络连接';
    } else if (error.response?.status === 401 || error.response?.status === 403) {
      errorMessage = 'Cookie或Token已过期，请重新配置';
    } else if (error.response?.data?.base_resp) {
      errorMessage = error.response.data.base_resp.err_msg || '搜索失败';
    } else {
      errorMessage = error.message;
    }
    
    res.status(500).json({
      success: false,
      message: errorMessage
    });
  }
});

// 获取文章列表
app.post('/api/articles', async (req, res) => {
  try {
    const { fakeid, page = 1, count = 10, forceRefresh = false } = req.body;
    const settings = getSettings(req);
    
    if (!settings.cookie || !settings.token) {
      return res.status(401).json({ 
        success: false, 
        message: '登录已过期，请重新登录' 
      });
    }
    
    // 检查缓存
    const sessionId = req.sessionID || (req.session && req.session.id) || req.headers['x-session-id'] || 'anon';
    const cacheKey = `${sessionId}:${fakeid}_${page}`;
    const cached = storage.articles[cacheKey];
    
    if (!forceRefresh && cached && isCacheValid(cached.lastUpdate, CACHE_CONFIG.ARTICLE_LIST_TTL)) {
      console.log('📦 使用缓存的文章列表:', cacheKey);
      return res.json({
        success: true,
        data: cached.data,
        fromCache: true
      });
    }
    
    const url = 'https://mp.weixin.qq.com/cgi-bin/appmsg';
    const params = {
      action: 'list_ex',
      begin: (page - 1) * count,
      count: count,
      fakeid: fakeid,
      type: '9',
      query: '',
      token: settings.token,
      lang: 'zh_CN',
      f: 'json',
      ajax: '1'
    };
    
    console.log('🌐 从微信API获取文章列表:', cacheKey);
    await sleep(500); // 防止频率限制
    
    const response = await axios.get(url, {
      params,
      headers: {
        'Cookie': settings.cookie,
        'User-Agent': getUserAgent(),
        'Referer': 'https://mp.weixin.qq.com/'
      },
      timeout: 15000
    });
    
    if (response.data.base_resp.ret === 0) {
      const articles = response.data.app_msg_list || [];
      const totalCount = response.data.app_msg_cnt || 0;
      
      const result = {
        articles: articles.map(article => ({
          aid: article.aid,
          title: article.title,
          link: article.link,
          digest: article.digest || '',
          cover: article.cover || '',
          create_time: article.create_time * 1000, // 转换为毫秒
          update_time: article.update_time * 1000,
          author: article.author || '',
          itemidx: article.itemidx || 1
        })),
        total: totalCount,
        page: page,
        hasMore: (page * count) < totalCount
      };
      
      // 保存到缓存
      storage.articles[cacheKey] = {
        data: result,
        lastUpdate: Date.now()
      };
      
      console.log('💾 文章列表已缓存:', cacheKey);
      
      res.json({
        success: true,
        data: result,
        fromCache: false
      });
    } else {
      // 处理特定错误码
      const errorCode = response.data.base_resp.ret;
      let errorMessage = '获取文章失败';
      
      if (errorCode === 200003) {
        errorMessage = '登录已过期，请重新登录';
      } else if (errorCode === 200013) {
        errorMessage = '请求过于频繁，请稍后再试';
      } else if (errorCode === 200040 || errorCode === 200041) {
        errorMessage = '认证信息已过期，请重新登录';
      }
      
      res.json({
        success: false,
        message: errorMessage,
        errorCode: errorCode
      });
    }
  } catch (error) {
    console.error('获取文章列表失败:', error.message);
    res.status(500).json({
      success: false,
      message: '获取文章失败: ' + error.message
    });
  }
});

// 获取文章内容代理
app.post('/api/article-content', async (req, res) => {
  try {
    const { url, forceRefresh = false } = req.body;
    const settings = getSettings(req);
    
    if (!url) {
      return res.status(400).json({
        success: false,
        message: '缺少文章链接'
      });
    }
    
    // 检查缓存
    const sessionId = req.sessionID || (req.session && req.session.id) || req.headers['x-session-id'] || 'anon';
    const contentKey = `${sessionId}:${url}`;
    const cached = storage.articleContent[contentKey];
    if (!forceRefresh && cached && isCacheValid(cached.lastUpdate, CACHE_CONFIG.ARTICLE_CONTENT_TTL)) {
      console.log('📦 使用缓存的文章内容:', url.substring(0, 80));
      res.setHeader('X-Cache-Hit', 'true');
      return res.send(cached.html);
    }
    
    console.log('📖 从微信获取文章内容:', url.substring(0, 80));
    
    // 通过后端代理获取文章内容
    const response = await axios.get(url, {
      headers: {
        'Cookie': settings.cookie || '',
        'User-Agent': getUserAgent(),
        'Referer': 'https://mp.weixin.qq.com/'
      },
      timeout: 20000, // 增加超时时间到20秒
      maxContentLength: 50 * 1024 * 1024, // 最大50MB
      maxBodyLength: 50 * 1024 * 1024
    });
    const processed = processArticleHtml(response.data, url);
    // 保存到缓存
    storage.articleContent[contentKey] = {
      html: processed,
      lastUpdate: Date.now()
    };
    
    console.log('💾 文章内容已缓存，当前缓存数:', Object.keys(storage.articleContent).length);
    
    // 返回HTML内容
    res.setHeader('X-Cache-Hit', 'false');
    res.send(processed);
  
  } catch (error) {
    console.error('❌ 获取文章内容失败:', error.message);
    res.status(500).send(`
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 40px;
              text-align: center;
              background: #f5f5f5;
            }
            .error-box {
              background: white;
              padding: 30px;
              border-radius: 8px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
              max-width: 500px;
              margin: 0 auto;
            }
            h2 { color: #ff4d4f; }
            .btn {
              margin-top: 20px;
              padding: 10px 20px;
              background: #1890ff;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              text-decoration: none;
              display: inline-block;
            }
          </style>
        </head>
        <body>
          <div class="error-box">
            <h2>⚠️ 无法加载文章</h2>
            <p>${error.message}</p>
            <p>可能原因：Cookie已过期或文章链接无效</p>
            <a href="${req.body.url}" target="_blank" class="btn">在新窗口打开</a>
          </div>
        </body>
      </html>
    `);
  }
});

// 资源代理（图片/CSS）
app.get('/api/proxy', async (req, res) => {
  try {
    const target = req.query.url;
    const page = req.query.page;
    const settings = getSettings(req);
    if (!target || !isAllowedUrl(target)) {
      return res.status(400).send('Invalid target');
    }
    let fetchUrl = target;
    try {
      const u = new URL(target);
      const h = u.hostname;
      if (h.endsWith('qpic.cn')) {
        // 使用微信内部图片获取端点，提升成功率
        fetchUrl = `https://mp.weixin.qq.com/mp/getimg?url=${encodeURIComponent(u.toString())}`;
      }
    } catch {}

    const response = await axios.get(fetchUrl, {
      responseType: 'arraybuffer',
      headers: {
        'Cookie': settings.cookie || '',
        'User-Agent': getUserAgent(),
        'Referer': page || 'https://mp.weixin.qq.com/',
        'Origin': 'https://mp.weixin.qq.com',
        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
      },
      timeout: 15000
    });
    const ct = response.headers['content-type'] || 'application/octet-stream';
    res.setHeader('Content-Type', ct);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(Buffer.from(response.data));
  } catch (err) {
    console.error('资源代理失败:', err.message);
    res.status(500).send('Proxy error');
  }
});

// 获取缓存统计
app.get('/api/cache-stats', (req, res) => {
  const listCacheCount = Object.keys(storage.articles).length;
  const contentCacheCount = Object.keys(storage.articleContent).length;
  
  res.json({
    success: true,
    data: {
      articleListCache: listCacheCount,
      articleContentCache: contentCacheCount,
      total: listCacheCount + contentCacheCount
    }
  });
});

// 清除缓存
app.post('/api/clear-cache', (req, res) => {
  const { type = 'all' } = req.body;
  
  let cleared = 0;
  
  if (type === 'all' || type === 'list') {
    cleared += Object.keys(storage.articles).length;
    storage.articles = {};
  }
  
  if (type === 'all' || type === 'content') {
    cleared += Object.keys(storage.articleContent).length;
    storage.articleContent = {};
  }
  
  console.log(`🧹 清除了 ${cleared} 个缓存项 (类型: ${type})`);
  
  res.json({
    success: true,
    message: `已清除${cleared}个缓存项`,
    cleared: cleared
  });
});

// 导出Excel
app.post('/api/export', async (req, res) => {
  try {
    const { articles, accountName } = req.body;
    
    if (!articles || articles.length === 0) {
      return res.status(400).json({
        success: false,
        message: '没有可导出的文章'
      });
    }
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('文章列表');
    
    // 设置列
    worksheet.columns = [
      { header: '标题', key: 'title', width: 50 },
      { header: '作者', key: 'author', width: 20 },
      { header: '发布时间', key: 'create_time', width: 20 },
      { header: '摘要', key: 'digest', width: 60 },
      { header: '链接', key: 'link', width: 80 }
    ];
    
    // 添加数据
    articles.forEach(article => {
      worksheet.addRow({
        title: article.title,
        author: article.author || '',
        create_time: new Date(article.create_time).toLocaleString('zh-CN'),
        digest: article.digest || '',
        link: article.link
      });
    });
    
    // 设置表头样式
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
    
    // 生成文件
    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `${accountName || '文章列表'}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.send(buffer);
    
  } catch (error) {
    console.error('导出Excel失败:', error);
    res.status(500).json({
      success: false,
      message: '导出失败: ' + error.message
    });
  }
});

// ================== 前端路由 ==================

// 主页
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 处理
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    message: '接口不存在' 
  });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({ 
    success: false, 
    message: '服务器内部错误: ' + err.message 
  });
});

if (process.env.VERCEL) {
  module.exports = app;
} else {
  app.listen(PORT, () => {
    console.log('='.repeat(50));
    console.log('🚀 微信公众号文章抓取工具 - Web版');
    console.log('='.repeat(50));
    console.log(`📱 服务器运行在: http://localhost:${PORT}`);
    console.log(`📱 移动端访问: http://[你的IP]:${PORT}`);
    console.log('='.repeat(50));
    console.log('💡 提示：');
    console.log('  - 请先在设置中配置 Cookie 和 Token');
    console.log('  - 支持桌面端和移动端访问');
    console.log('  - 按 Ctrl+C 停止服务器');
    console.log('='.repeat(50));
  });
}
