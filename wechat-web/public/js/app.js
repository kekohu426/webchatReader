// ==================== 全局状态管理 ====================
const state = {
  accounts: [],
  currentAccount: null,
  articles: [],
  allArticles: [],
  currentPage: 1,
  hasMore: true,
  isLoading: false,
  searchTerm: '',
  sortOrder: 'desc',
  settings: {
    cookie: '',
    token: '',
    fingerprint: ''
  }
};

// ==================== DOM 元素 ====================
const elements = {
  // 侧边栏
  sidebar: document.getElementById('sidebar'),
  sidebarClose: document.getElementById('sidebar-close'),
  menuToggle: document.getElementById('menu-toggle'),
  accountsList: document.getElementById('accounts-list'),
  accountNameInput: document.getElementById('account-name'),
  btnAddAccount: document.getElementById('btn-add-account'),
  accountCount: document.getElementById('account-count'),
  loginStatus: document.getElementById('login-status'),
  
  // 文章列表
  articlesView: document.getElementById('articles-view'),
  currentAccountName: document.getElementById('current-account-name'),
  searchInput: document.getElementById('search-input'),
  sortOrder: document.getElementById('sort-order'),
  articlesList: document.getElementById('articles-list'),
  btnLoadMore: document.getElementById('btn-load-more'),
  btnExport: document.getElementById('btn-export'),
  
  // 文章详情
  articleDetail: document.getElementById('article-detail'),
  btnBack: document.getElementById('btn-back'),
  detailTitle: document.getElementById('detail-title'),
  detailAuthor: document.getElementById('detail-author'),
  detailDate: document.getElementById('detail-date'),
  detailIframe: document.getElementById('detail-iframe'),
  
  // 设置
  settingsModal: document.getElementById('settings-modal'),
  btnSettings: document.getElementById('btn-settings'),
  mobileSettingsBtn: document.getElementById('mobile-settings-btn'),
  closeSettings: document.getElementById('close-settings'),
  settingsStatusText: document.getElementById('settings-status-text'),
  lastLoginTime: document.getElementById('last-login-time'),
  lastLoginContainer: document.getElementById('last-login-container'),
  cookieInput: document.getElementById('cookie-input'),
  tokenInput: document.getElementById('token-input'),
  fingerprintInput: document.getElementById('fingerprint-input'),
  btnSaveSettings: document.getElementById('btn-save-settings'),
  btnRefreshCacheStats: document.getElementById('btn-refresh-cache-stats'),
  btnClearCache: document.getElementById('btn-clear-cache'),
  listCacheCount: document.getElementById('list-cache-count'),
  contentCacheCount: document.getElementById('content-cache-count'),
  
  // 加载和提示
  loadingOverlay: document.getElementById('loading-overlay'),
  loadingText: document.getElementById('loading-text'),
  toast: document.getElementById('toast')
};

// ==================== 工具函数 ====================

// 显示提示
function showToast(message, type = 'info') {
  elements.toast.textContent = message;
  elements.toast.className = 'toast show ' + type;
  
  setTimeout(() => {
    elements.toast.className = 'toast';
  }, 3000);
}

// 显示加载
function showLoading(text = '加载中...') {
  elements.loadingText.textContent = text;
  elements.loadingOverlay.style.display = 'flex';
}

// 隐藏加载
function hideLoading() {
  elements.loadingOverlay.style.display = 'none';
}

// 格式化日期
function formatDate(timestamp) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// API 请求封装
async function apiRequest(url, options = {}) {
  try {
    const response = await fetch(url, {
      credentials: 'include', // 重要：包含 session cookie
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}

// ==================== 设置管理 ====================

// 加载设置
async function loadSettings() {
  try {
    const result = await apiRequest('/api/settings');
    if (result.success && result.data) {
      updateLoginStatus(result.data);
      if (result.data.lastUpdated) {
        elements.lastLoginContainer.style.display = 'block';
        elements.lastLoginTime.textContent = new Date(result.data.lastUpdated).toLocaleString('zh-CN');
      }
    }
  } catch (error) {
    console.error('加载设置失败:', error);
  }
}

// 更新登录状态
function updateLoginStatus(data) {
  const isLoggedIn = data.hasToken && data.hasCookie;
  
  const statusElements = [elements.loginStatus, elements.settingsStatusText];
  statusElements.forEach(el => {
    if (el) {
      el.textContent = isLoggedIn ? '已登录' : '未登录';
      el.className = isLoggedIn ? 'status-badge logged-in' : 'status-badge not-logged-in';
    }
  });
  
  // 检查Cookie有效期并显示提醒
  if (isLoggedIn && data.lastUpdated) {
    checkCookieExpiry(data.lastUpdated);
  }
}

// 检查Cookie有效期
function checkCookieExpiry(lastUpdated) {
  const expireContainer = document.getElementById('expire-warning-container');
  const expireText = document.getElementById('expire-warning-text');
  
  if (!expireContainer || !expireText) return;
  
  const lastUpdateTime = new Date(lastUpdated);
  const now = new Date();
  const hoursElapsed = (now - lastUpdateTime) / (1000 * 60 * 60);
  const hoursRemaining = 24 - hoursElapsed;
  
  if (hoursRemaining <= 0) {
    // 已过期
    expireContainer.style.display = 'flex';
    expireText.textContent = 'Cookie可能已过期，建议重新配置';
    expireText.style.color = '#ff4d4f';
    showToast('⚠️ Cookie可能已过期，请重新配置', 'error');
  } else if (hoursRemaining <= 4) {
    // 快过期（4小时内）
    expireContainer.style.display = 'flex';
    expireText.textContent = `Cookie将在约${Math.floor(hoursRemaining)}小时后过期，建议尽快更新`;
    expireText.style.color = '#ff4d4f';
  } else if (hoursRemaining <= 8) {
    // 预警（8小时内）
    expireContainer.style.display = 'flex';
    expireText.textContent = `Cookie将在约${Math.floor(hoursRemaining)}小时后过期`;
    expireText.style.color = '#faad14';
  } else {
    // 正常
    expireContainer.style.display = 'none';
  }
}

// 保存设置
async function saveSettings() {
  const cookie = elements.cookieInput.value.trim();
  const token = elements.tokenInput.value.trim();
  const fingerprint = elements.fingerprintInput.value.trim();
  
  if (!cookie || !token) {
    showToast('请填写 Cookie 和 Token', 'error');
    return;
  }
  
  showLoading('保存设置中...');
  
  try {
    const result = await apiRequest('/api/settings', {
      method: 'POST',
      body: JSON.stringify({ cookie, token, fingerprint })
    });
    
    if (result.success) {
      state.settings = { cookie, token, fingerprint };
      showToast('设置保存成功！', 'success');
      updateLoginStatus(result.data);
      closeSettingsModal();
      elements.lastLoginContainer.style.display = 'block';
      elements.lastLoginTime.textContent = new Date().toLocaleString('zh-CN');
    } else {
      showToast('保存失败: ' + result.message, 'error');
    }
  } catch (error) {
    showToast('保存失败: ' + error.message, 'error');
  } finally {
    hideLoading();
  }
}

// ==================== 公众号管理 ====================

// 检查是否是Cookie过期错误
function isCookieExpiredError(result) {
  if (!result) return false;
  const message = result.message || '';
  const errorCode = result.errorCode;
  
  // 检查错误码或错误信息
  return (
    errorCode === 200003 || 
    errorCode === 200040 || 
    errorCode === 200041 ||
    message.includes('过期') || 
    message.includes('expired') ||
    message.includes('invalid csrf token') ||
    message.includes('Cookie')
  );
}

// 处理Cookie过期
function handleCookieExpired() {
  showToast('⚠️ Cookie已过期，请重新配置', 'error');
  
  // 弹出友好提示
  setTimeout(() => {
    if (confirm('检测到Cookie已过期，是否立即打开设置页面重新配置？\n\n点击"确定"打开设置，点击"取消"稍后配置')) {
      openSettingsModal();
    }
  }, 500);
}

// 添加公众号
async function addAccount() {
  const accountName = elements.accountNameInput.value.trim();
  
  if (!accountName) {
    showToast('请输入公众号名称', 'error');
    return;
  }
  
  // 检查是否已存在
  if (state.accounts.find(a => a.name === accountName)) {
    showToast('该公众号已存在', 'error');
    return;
  }
  
  showLoading('搜索公众号中...');
  
  try {
    const result = await apiRequest('/api/search-account', {
      method: 'POST',
      body: JSON.stringify({ accountName })
    });
    
    if (result.success && result.data) {
      const account = {
        name: result.data.nickname,
        fakeid: result.data.fakeid,
        alias: result.data.alias,
        avatar: result.data.avatar,
        signature: result.data.signature
      };
      
      state.accounts.push(account);
      saveAccountsToStorage();
      renderAccounts();
      elements.accountNameInput.value = '';
      showToast('添加成功！', 'success');
      
      // 自动选择新添加的公众号
      selectAccount(account);
    } else {
      // 检查是否是Cookie过期
      if (isCookieExpiredError(result)) {
        handleCookieExpired();
      } else if (result.message.includes('Token')) {
        showToast(result.message + '，请先在设置中配置', 'error');
        setTimeout(() => openSettingsModal(), 1000);
      } else {
        showToast(result.message || '添加失败', 'error');
      }
    }
  } catch (error) {
    showToast('搜索失败: ' + error.message, 'error');
  } finally {
    hideLoading();
  }
}

// 渲染公众号列表
function renderAccounts() {
  elements.accountsList.innerHTML = '';
  elements.accountCount.textContent = state.accounts.length;
  
  if (state.accounts.length === 0) {
    elements.accountsList.innerHTML = `
      <li style="text-align: center; padding: var(--space-2xl); color: var(--text-tertiary); list-style: none;">
        <div style="font-size: 48px; opacity: 0.5; margin-bottom: var(--space);">📭</div>
        <div>暂无订阅</div>
        <div style="font-size: var(--font-size-xs); margin-top: var(--space-xs);">在上方添加公众号</div>
      </li>
    `;
    return;
  }
  
  state.accounts.forEach(account => {
    const li = document.createElement('li');
    li.className = 'account-item';
    if (state.currentAccount && state.currentAccount.fakeid === account.fakeid) {
      li.classList.add('active');
    }
    
    li.innerHTML = `
      <div class="account-item-content">
        <input type="checkbox" class="account-checkbox" 
               data-fakeid="${account.fakeid}" 
               onclick="event.stopPropagation(); updateSelectedCount();" />
        <div class="account-name">${account.name}</div>
      </div>
      <div class="account-actions">
        <button class="btn-danger btn-sm" 
                onclick="event.stopPropagation(); deleteAccount('${account.fakeid}');" 
                title="删除">
          🗑️
        </button>
      </div>
    `;
    
    li.addEventListener('click', (e) => {
      if (!e.target.closest('.account-actions') && e.target.type !== 'checkbox') {
        selectAccount(account);
      }
    });
    
    elements.accountsList.appendChild(li);
  });
}

// 选择公众号
function selectAccount(account) {
  state.currentAccount = account;
  state.currentPage = 1;
  state.articles = [];
  state.allArticles = [];
  state.hasMore = true;
  
  renderAccounts();
  elements.currentAccountName.textContent = account.name;
  elements.articlesList.innerHTML = '';
  elements.btnExport.disabled = false;
  
  // 切换到"我的订阅"页面并显示文章列表
  if (window.switchPage) {
    window.switchPage('accounts');
  }
  
  // 确保显示文章列表视图（而不是文章详情）
  elements.articlesView.style.display = 'block';
  elements.articleDetail.style.display = 'none';
  
  // 加载文章列表
  loadArticles();
  
  // 移动端自动关闭侧边栏
  if (window.innerWidth <= 768) {
    closeSidebar();
  }
}

// 删除公众号
function deleteAccount(fakeid) {
  if (!confirm('确定要删除这个公众号吗？')) return;
  
  state.accounts = state.accounts.filter(a => a.fakeid !== fakeid);
  saveAccountsToStorage();
  renderAccounts();
  
  if (state.currentAccount && state.currentAccount.fakeid === fakeid) {
    state.currentAccount = null;
    state.articles = [];
    elements.currentAccountName.textContent = '请选择公众号';
    elements.articlesList.innerHTML = '<div class="empty-state"><p>👈 请在左侧选择公众号</p></div>';
    elements.btnExport.disabled = true;
  }
  
  showToast('删除成功', 'success');
}

// ==================== 文章管理 ====================

// 加载文章
async function loadArticles() {
  if (!state.currentAccount || state.isLoading) return;
  
  state.isLoading = true;
  elements.btnLoadMore.disabled = true;
  showLoading('加载文章中...');
  
  try {
    const result = await apiRequest('/api/articles', {
      method: 'POST',
      body: JSON.stringify({
        fakeid: state.currentAccount.fakeid,
        page: state.currentPage,
        count: 10
      })
    });
    
    if (result.success && result.data) {
      state.allArticles = [...state.allArticles, ...result.data.articles];
      state.hasMore = result.data.hasMore;
      applySearchAndSort();
      renderArticles();
      
      elements.btnLoadMore.disabled = !state.hasMore;
      elements.btnLoadMore.textContent = state.hasMore ? '加载更多' : '已加载全部';
      
      const cacheHint = result.fromCache ? '（使用缓存）' : '';
      showToast(`加载成功！共 ${state.allArticles.length} 篇文章${cacheHint}`, 'success');
    } else {
      // 检查是否是Cookie过期
      if (isCookieExpiredError(result)) {
        handleCookieExpired();
      } else if (result.message.includes('登录')) {
        showToast(result.message, 'error');
        setTimeout(() => openSettingsModal(), 1000);
      } else {
        showToast(result.message || '加载失败', 'error');
      }
    }
  } catch (error) {
    showToast('加载失败: ' + error.message, 'error');
  } finally {
    state.isLoading = false;
    hideLoading();
  }
}

// 应用搜索和排序
function applySearchAndSort() {
  let filtered = [...state.allArticles];
  
  // 搜索过滤
  if (state.searchTerm) {
    filtered = filtered.filter(article =>
      article.title.toLowerCase().includes(state.searchTerm.toLowerCase())
    );
  }
  
  // 排序
  filtered.sort((a, b) => {
    return state.sortOrder === 'desc'
      ? b.create_time - a.create_time
      : a.create_time - b.create_time;
  });
  
  state.articles = filtered;
}

// 渲染文章列表
function renderArticles() {
  elements.articlesList.innerHTML = '';
  
  if (state.articles.length === 0) {
    elements.articlesList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📖</div>
        <p>暂无文章</p>
        <p class="empty-hint">试试搜索或加载更多</p>
      </div>
    `;
    return;
  }
  
  state.articles.forEach(article => {
    const articleId = article.link || article.aid;
    const isStarred = isArticleStarred(articleId);
    const isRead = window.ReadingProgress ? window.ReadingProgress.isRead(articleId) : false;
    
    const card = document.createElement('div');
    card.className = 'article-card';
    card.innerHTML = `
      <div class="article-card-header">
        <div class="article-title">${article.title}</div>
        <div class="article-actions">
          <button class="btn-star ${isStarred ? 'starred' : ''}" 
                  onclick="event.stopPropagation(); toggleArticleStar('${articleId}', this);" 
                  title="${isStarred ? '取消收藏' : '收藏'}">
            ${isStarred ? '⭐' : '☆'}
          </button>
        </div>
      </div>
      <div class="article-meta">
        <span>👤 ${article.author || '未知作者'}</span>
        <span>📅 ${formatDate(article.create_time)}</span>
      </div>
      <div class="article-digest">${article.digest || '暂无摘要'}</div>
      <div class="article-card-footer">
        <span class="reading-badge ${isRead ? 'read' : 'unread'}">
          ${isRead ? '✓ 已读' : '○ 未读'}
        </span>
        ${isStarred ? '<span class="reading-badge" style="background: linear-gradient(135deg, rgba(250, 219, 20, 0.1) 0%, rgba(245, 158, 11, 0.1) 100%); color: #f59e0b; border-color: rgba(250, 219, 20, 0.3);">⭐ 已收藏</span>' : ''}
      </div>
    `;
    
    card.addEventListener('click', () => {
      showArticleDetail(article);
      // 标记为已读
      if (window.ReadingProgress) {
        window.ReadingProgress.markAsRead(articleId);
      }
    });
    
    elements.articlesList.appendChild(card);
  });
}

// 显示文章详情
async function showArticleDetail(article) {
  // 切换到详情视图
  elements.articlesView.style.display = 'none';
  elements.articleDetail.style.display = 'flex';
  
  // 显示文章信息
  elements.detailTitle.textContent = article.title;
  
  // 更新作者和日期（新格式）
  const authorMeta = document.querySelector('#detail-author .meta-text');
  const dateMeta = document.querySelector('#detail-date .meta-text');
  if (authorMeta) authorMeta.textContent = article.author || '未知作者';
  if (dateMeta) dateMeta.textContent = formatDate(article.create_time);
  
  // 设置当前文章ID（用于收藏等功能）
  const articleId = article.link || article.aid;
  if (window.ReadingEnhancer) {
    window.ReadingEnhancer.setCurrentArticle(articleId, article);
  }
  
  // 重置阅读进度
  const progressFill = document.getElementById('reading-progress-fill');
  if (progressFill) progressFill.style.width = '0%';
  
  // 滚动到顶部
  const contentWrapper = document.getElementById('detail-content-wrapper');
  if (contentWrapper) {
    contentWrapper.scrollTop = 0;
  }
  
  // 显示加载状态
  const loadingStartTime = Date.now();
  showLoading('正在获取文章内容...');
  
  try {
    // 通过后端代理获取文章内容
    const proxyUrl = `/api/article-content`;
    const response = await fetch(proxyUrl, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url: article.link })
    });
    
    if (response.ok) {
      const html = await response.text();
      const loadTime = Date.now() - loadingStartTime;
      
      // 创建一个 blob URL 来加载 HTML
      const blob = new Blob([html], { type: 'text/html' });
      const blobUrl = URL.createObjectURL(blob);
      
      // 显示渲染提示
      if (loadTime > 2000) {
        showLoading('正在渲染文章...');
      }
      
      elements.detailIframe.src = blobUrl;
      
      // 清理旧的 blob URL
      elements.detailIframe.onload = () => {
        hideLoading();
        // 5秒后释放 blob URL
        setTimeout(() => {
          if (blobUrl) URL.revokeObjectURL(blobUrl);
        }, 5000);
      };
      
      // iframe 加载超时处理
      const iframeTimeout = setTimeout(() => {
        hideLoading();
        showToast('文章渲染较慢，请稍候...', 'warning');
      }, 3000);
      
      elements.detailIframe.onload = () => {
        clearTimeout(iframeTimeout);
        hideLoading();
        try {
          const iframeDoc = elements.detailIframe.contentDocument || elements.detailIframe.contentWindow.document;
          if (iframeDoc) {
            const style = iframeDoc.createElement('style');
            style.textContent = `
              body {
                font-size: 15px !important;
                line-height: 1.8 !important;
                -webkit-font-smoothing: antialiased !important;
                overflow: hidden !important;
              }
              h1, h2, h3, h4, h5, h6 { line-height: 1.6 !important; }
              h1 { font-size: 1.5em !important; }
              h2 { font-size: 1.3em !important; }
              h3 { font-size: 1.1em !important; }
              p, div, span, ul, ol, li, blockquote { font-size: inherit !important; }
              code, pre { font-size: 0.9em !important; }
            `;
            iframeDoc.head.appendChild(style);

            const resizeIframe = () => {
              const height = Math.max(
                iframeDoc.documentElement.scrollHeight,
                iframeDoc.body ? iframeDoc.body.scrollHeight : 0
              );
              if (height && height > 0) {
                elements.detailIframe.style.height = height + 'px';
              }
            };

            resizeIframe();
            setTimeout(resizeIframe, 100);
            setTimeout(resizeIframe, 500);
          }
        } catch (e) {
          console.log('无法处理iframe内容:', e);
        }

        const totalTime = Date.now() - loadingStartTime;
        const cacheHit = response.headers.get('X-Cache-Hit') === 'true';
        console.log(`📖 文章加载完成，耗时: ${totalTime}ms, 缓存命中: ${cacheHit}`);
      };
      
      const cacheHit = response.headers.get('X-Cache-Hit') === 'true';
      if (!cacheHit && loadTime > 3000) {
        showToast('文章较大，首次加载较慢，已缓存供下次快速访问', 'info');
      }
    } else {
      throw new Error('加载失败');
    }
  } catch (error) {
    console.error('加载文章失败:', error);
    hideLoading();
    
    // 显示错误信息并提供备选方案
    elements.detailIframe.srcdoc = `
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
              margin: 40px auto;
            }
            h2 { color: #ff4d4f; margin-bottom: 20px; }
            p { margin: 10px 0; color: #666; line-height: 1.6; }
            .btn {
              margin-top: 20px;
              padding: 12px 24px;
              background: #1890ff;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              text-decoration: none;
              display: inline-block;
              font-size: 14px;
            }
            .btn:hover { background: #40a9ff; }
          </style>
        </head>
        <body>
          <div class="error-box">
            <h2>⚠️ 无法在此处加载文章</h2>
            <p>可能原因：Cookie已过期或网络问题</p>
            <p>请点击下方按钮在新窗口中打开文章</p>
            <a href="${article.link}" target="_blank" class="btn">在新窗口打开文章</a>
          </div>
        </body>
      </html>
    `;
    
    showToast('加载失败，请在新窗口打开', 'error');
  }
}

// 返回列表
function backToList() {
  elements.articleDetail.style.display = 'none';
  elements.articlesView.style.display = 'flex';
  elements.detailIframe.src = '';
}

// 加载更多
function loadMore() {
  state.currentPage++;
  loadArticles();
}

// 导出Excel
async function exportArticles() {
  if (!state.currentAccount || state.articles.length === 0) {
    showToast('没有可导出的文章', 'error');
    return;
  }
  
  showLoading('导出中...');
  
  try {
    const response = await fetch('/api/export', {
      method: 'POST',
      credentials: 'include', // 包含 session cookie
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        articles: state.articles,
        accountName: state.currentAccount.name
      })
    });
    
    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${state.currentAccount.name}_${formatDate(Date.now())}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showToast('导出成功！', 'success');
    } else {
      showToast('导出失败', 'error');
    }
  } catch (error) {
    showToast('导出失败: ' + error.message, 'error');
  } finally {
    hideLoading();
  }
}

// ==================== 本地存储 ====================

function saveAccountsToStorage() {
  localStorage.setItem('wechat_accounts', JSON.stringify(state.accounts));
}

function loadAccountsFromStorage() {
  const saved = localStorage.getItem('wechat_accounts');
  if (saved) {
    state.accounts = JSON.parse(saved);
    renderAccounts();
  }
}

// ==================== 界面交互 ====================

// 打开设置
function openSettingsModal() {
  elements.settingsModal.classList.add('active');
}

// 关闭设置
function closeSettingsModal() {
  elements.settingsModal.classList.remove('active');
}

// 打开侧边栏（移动端）
function openSidebar() {
  elements.sidebar.classList.add('active');
}

// 关闭侧边栏（移动端）
function closeSidebar() {
  elements.sidebar.classList.remove('active');
}

// ==================== 事件绑定 ====================

// 侧边栏切换
elements.menuToggle?.addEventListener('click', openSidebar);
elements.sidebarClose?.addEventListener('click', closeSidebar);

// 设置
elements.btnSettings?.addEventListener('click', openSettingsModal);
elements.mobileSettingsBtn?.addEventListener('click', openSettingsModal);
elements.closeSettings?.addEventListener('click', closeSettingsModal);
elements.btnSaveSettings?.addEventListener('click', saveSettings);
elements.loginStatus?.addEventListener('click', openSettingsModal);
elements.settingsStatusText?.addEventListener('click', openSettingsModal);

// 点击模态背景关闭
elements.settingsModal?.addEventListener('click', (e) => {
  if (e.target === elements.settingsModal) {
    closeSettingsModal();
  }
});

// 公众号
elements.btnAddAccount?.addEventListener('click', addAccount);
elements.accountNameInput?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') addAccount();
});

// 文章
elements.btnLoadMore?.addEventListener('click', loadMore);
elements.btnExport?.addEventListener('click', exportArticles);
elements.btnBack?.addEventListener('click', backToList);

// 搜索
elements.searchInput?.addEventListener('input', (e) => {
  state.searchTerm = e.target.value;
  applySearchAndSort();
  renderArticles();
});

// 排序
elements.sortOrder?.addEventListener('change', (e) => {
  state.sortOrder = e.target.value;
  applySearchAndSort();
  renderArticles();
});

// ==================== 初始化 ====================

// 获取缓存统计
async function loadCacheStats() {
  try {
    const response = await fetch('/api/cache-stats');
    const result = await response.json();
    
    if (result.success) {
      elements.listCacheCount.textContent = result.data.articleListCache;
      elements.contentCacheCount.textContent = result.data.articleContentCache;
    }
  } catch (error) {
    console.error('加载缓存统计失败:', error);
  }
}

// 清除缓存
async function clearCache() {
  if (!confirm('确定要清除所有缓存吗？\n\n清除后需要重新获取文章数据。')) {
    return;
  }
  
  try {
    showLoading('清除缓存中...');
    
    const response = await fetch('/api/clear-cache', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ type: 'all' })
    });
    
    const result = await response.json();
    
    hideLoading();
    
    if (result.success) {
      showToast(`✅ ${result.message}`, 'success');
      await loadCacheStats();
    } else {
      showToast('清除失败: ' + result.message, 'error');
    }
  } catch (error) {
    hideLoading();
    console.error('清除缓存失败:', error);
    showToast('清除失败: ' + error.message, 'error');
  }
}

async function init() {
  console.log('应用初始化...');
  loadAccountsFromStorage();
  await loadSettings();
  await loadCacheStats();
  
  // 添加缓存管理按钮事件监听
  if (elements.btnRefreshCacheStats) {
    elements.btnRefreshCacheStats.addEventListener('click', loadCacheStats);
  }
  if (elements.btnClearCache) {
    elements.btnClearCache.addEventListener('click', clearCache);
  }
  
  console.log('初始化完成！');
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// ==================== 收藏功能（前端状态） ====================

// 获取收藏的文章列表（从localStorage）
function getStarredArticles() {
  const starred = localStorage.getItem('starred_articles');
  return starred ? JSON.parse(starred) : [];
}

// 保存收藏列表
function saveStarredArticles(articles) {
  localStorage.setItem('starred_articles', JSON.stringify(articles));
}

// 检查文章是否已收藏
function isArticleStarred(articleId) {
  // 优先使用新的收藏管理器
  if (window.FavoritesManager) {
    return window.FavoritesManager.isFavorited(articleId);
  }
  // 兼容旧逻辑
  const starred = getStarredArticles();
  return starred.includes(articleId);
}

// 切换文章收藏状态
function toggleArticleStar(articleId, buttonElement) {
  // 从全局 state 中查找文章数据
  const article = state.allArticles.find(a => (a.link || a.aid) === articleId);
  
  if (!article) {
    showToast('无法收藏：文章数据不完整', 'warning');
    return;
  }
  
  // 使用新的收藏管理器
  if (window.FavoritesManager) {
    console.log('📝 文章数据:', article);
    const result = window.FavoritesManager.toggle(article);
    console.log('📝 收藏操作结果:', result);
    
    if (result.success) {
      const isStarred = window.FavoritesManager.isFavorited(articleId);
      buttonElement.classList.toggle('starred', isStarred);
      buttonElement.textContent = isStarred ? '⭐' : '☆';
      buttonElement.title = isStarred ? '取消收藏' : '收藏';
      showToast(result.message, 'success');
      
      // 刷新收藏页面（如果正在该页面）
      if (window.renderFavorites) {
        window.renderFavorites();
      }
    } else {
      showToast(result.message, 'info');
    }
  } else {
    // 兼容旧逻辑
    let starred = getStarredArticles();
    if (starred.includes(articleId)) {
      starred = starred.filter(id => id !== articleId);
      buttonElement.classList.remove('starred');
      buttonElement.textContent = '☆';
      buttonElement.title = '收藏';
      showToast('已取消收藏', 'success');
    } else {
      starred.push(articleId);
      buttonElement.classList.add('starred');
      buttonElement.textContent = '⭐';
      buttonElement.title = '取消收藏';
      showToast('已加入知识库', 'success');
    }
    saveStarredArticles(starred);
  }
}

// 暴露必要的全局函数
window.deleteAccount = deleteAccount;
window.toggleArticleStar = toggleArticleStar;
window.isArticleStarred = isArticleStarred;
