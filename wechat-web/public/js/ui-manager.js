// ==================== UI管理器：页面切换、批量操作等 ====================

// 页面切换
function switchPage(pageName) {
  // 隐藏所有页面
  document.querySelectorAll('.page-container').forEach(page => {
    page.style.display = 'none';
  });
  
  // 显示目标页面
  const targetPage = document.getElementById(`page-${pageName}`);
  if (targetPage) {
    targetPage.style.display = 'block';
  }
  
  // 更新导航激活状态（兼容新旧导航）
  document.querySelectorAll('.nav-link, .nav-item').forEach(link => {
    link.classList.remove('active');
  });
  const activeLink = document.querySelector(`.nav-item[data-page="${pageName}"], .nav-link[data-page="${pageName}"]`);
  if (activeLink) {
    activeLink.classList.add('active');
  }
  
  // 订阅管理区只在"我的订阅"页面显示
  const subscriptionSection = document.querySelector('.subscription-section');
  const sidebarDivider = document.querySelector('.sidebar-divider');
  if (subscriptionSection) {
    subscriptionSection.style.display = pageName === 'accounts' ? 'flex' : 'none';
  }
  if (sidebarDivider) {
    sidebarDivider.style.display = pageName === 'accounts' ? 'block' : 'none';
  }
  
  // 切换到收藏页面时，刷新收藏列表
  if (pageName === 'knowledge' && window.renderFavorites) {
    setTimeout(() => window.renderFavorites(), 100);
  }
  
  // 设置页面直接打开设置模态框
  if (pageName === 'settings') {
    openSettingsModal();
    // 切回默认页面
    setTimeout(() => switchPage('accounts'), 100);
  }
}

// 导航点击事件
document.addEventListener('DOMContentLoaded', () => {
  // 侧边栏导航链接（新）
  document.querySelectorAll('.nav-item').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const pageName = link.getAttribute('data-page');
      switchPage(pageName);
      
      // 更新激活状态
      document.querySelectorAll('.nav-item').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
    });
  });
  
  // 兼容旧的导航链接
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const pageName = link.getAttribute('data-page');
      switchPage(pageName);
    });
  });
  
  // 导入文章按钮
  const btnImportArticle = document.getElementById('btn-import-article');
  if (btnImportArticle) {
    btnImportArticle.addEventListener('click', () => {
      openImportArticleModal();
    });
  }
  
  // 导入模态框Tab切换
  document.querySelectorAll('[data-import-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.getAttribute('data-import-tab');
      switchImportTab(tabName);
      
      // 更新按钮状态
      document.querySelectorAll('[data-import-tab]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
  
  // 批量导入公众号（模态框内）
  const btnImportBatchAccountsModal = document.getElementById('btn-import-batch-accounts-modal');
  if (btnImportBatchAccountsModal) {
    btnImportBatchAccountsModal.addEventListener('click', importBatchAccountsFromModal);
  }
  
  // 导入页面Tab切换
  document.querySelectorAll('.import-tabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // 更新按钮状态
      document.querySelectorAll('.import-tabs .tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // 切换内容
      const tabName = btn.getAttribute('data-tab');
      document.querySelectorAll('.import-tab-content').forEach(content => {
        content.style.display = 'none';
      });
      document.getElementById(`tab-${tabName}`).style.display = 'block';
    });
  });
  
  // 批量导入公众号按钮
  const btnBatchImport = document.getElementById('btn-batch-import');
  if (btnBatchImport) {
    btnBatchImport.addEventListener('click', () => {
      document.getElementById('batch-import-modal').style.display = 'flex';
    });
  }
  
  // 开始批量导入
  const btnStartBatchImport = document.getElementById('btn-start-batch-import');
  if (btnStartBatchImport) {
    btnStartBatchImport.addEventListener('click', startBatchImportAccounts);
  }
  
  // 批量订阅设置按钮
  const btnBatchSubscribe = document.getElementById('btn-batch-subscribe');
  if (btnBatchSubscribe) {
    btnBatchSubscribe.addEventListener('click', () => {
      showToast('⏳ 定时订阅功能待开发（需要后端支持）', 'warning');
      document.getElementById('subscribe-modal').style.display = 'flex';
    });
  }
  
  // 批量获取文章按钮
  const btnBatchFetch = document.getElementById('btn-batch-fetch');
  if (btnBatchFetch) {
    btnBatchFetch.addEventListener('click', batchFetchArticles);
  }
  
  // 全选复选框
  const selectAllCheckbox = document.getElementById('select-all-accounts');
  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', (e) => {
      const checkboxes = document.querySelectorAll('.account-checkbox');
      checkboxes.forEach(cb => cb.checked = e.target.checked);
      updateSelectedCount();
    });
  }
  
  // 导入页面按钮事件
  setupImportPageEvents();
});

// ==================== 批量导入公众号 ====================
async function startBatchImportAccounts() {
  const textarea = document.getElementById('batch-import-textarea');
  const accountNames = textarea.value
    .split('\n')
    .map(name => name.trim())
    .filter(name => name.length > 0);
  
  if (accountNames.length === 0) {
    showToast('请输入至少一个公众号名称', 'error');
    return;
  }
  
  if (accountNames.length > 50) {
    showToast('最多支持50个公众号', 'error');
    return;
  }
  
  // 关闭模态框
  document.getElementById('batch-import-modal').style.display = 'none';
  
  // 显示进度
  showLoading(`正在批量添加 ${accountNames.length} 个公众号...`);
  
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < accountNames.length; i++) {
    const name = accountNames[i];
    showLoading(`正在添加: ${name} (${i + 1}/${accountNames.length})`);
    
    try {
      // 调用添加公众号函数
      const result = await searchAndAddAccount(name);
      if (result) {
        successCount++;
      } else {
        errorCount++;
      }
    } catch (error) {
      console.error(`添加 ${name} 失败:`, error);
      errorCount++;
    }
    
    // 延迟500ms，避免请求过快
    if (i < accountNames.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  hideLoading();
  
  // 显示结果
  showToast(
    `批量添加完成！✅ 成功: ${successCount}  ❌ 失败: ${errorCount}`,
    successCount > 0 ? 'success' : 'error'
  );
  
  // 清空输入框
  textarea.value = '';
}

// 搜索并添加公众号（复用现有函数）
async function searchAndAddAccount(accountName) {
  try {
    const result = await apiRequest('/api/search-account', {
      method: 'POST',
      body: JSON.stringify({ accountName })
    });
    
    if (result.success && result.data) {
      const account = result.data;
      
      // 检查是否已存在
      if (window.state && window.state.accounts.some(a => a.fakeid === account.fakeid)) {
        console.log(`${accountName} 已存在，跳过`);
        return false;
      }
      
      // 添加到列表
      if (window.state) {
        window.state.accounts.push(account);
        saveAccountsToStorage();
        renderAccounts();
      }
      
      return true;
    }
    return false;
  } catch (error) {
    console.error('添加失败:', error);
    return false;
  }
}

// ==================== 批量获取文章 ====================
async function batchFetchArticles() {
  const selectedAccounts = getSelectedAccounts();
  
  if (selectedAccounts.length === 0) {
    showToast('请先选择要获取文章的公众号', 'warning');
    return;
  }
  
  showLoading(`正在获取 ${selectedAccounts.length} 个公众号的文章...`);
  
  for (let i = 0; i < selectedAccounts.length; i++) {
    const account = selectedAccounts[i];
    showLoading(`正在获取: ${account.name} (${i + 1}/${selectedAccounts.length})`);
    
    try {
      // 切换到该公众号
      if (window.selectAccount) {
        window.selectAccount(account);
      }
      
      // 等待加载完成
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`获取 ${account.name} 失败:`, error);
    }
    
    // 延迟500ms
    if (i < selectedAccounts.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  hideLoading();
  showToast('批量获取完成！', 'success');
}

// 获取选中的公众号
function getSelectedAccounts() {
  const checkboxes = document.querySelectorAll('.account-checkbox:checked');
  const selectedAccounts = [];
  
  checkboxes.forEach(cb => {
    const fakeid = cb.getAttribute('data-fakeid');
    const account = window.state && window.state.accounts.find(a => a.fakeid === fakeid);
    if (account) {
      selectedAccounts.push(account);
    }
  });
  
  return selectedAccounts;
}

// 更新选中数量
function updateSelectedCount() {
  const count = document.querySelectorAll('.account-checkbox:checked').length;
  const countElement = document.getElementById('selected-count');
  if (countElement) {
    countElement.textContent = `已选 ${count} 个`;
  }
  
  // 显示/隐藏批量操作栏
  const batchActions = document.getElementById('batch-actions');
  if (batchActions) {
    batchActions.style.display = count > 0 ? 'flex' : 'none';
  }
}

// ==================== 导入页面功能 ====================
function setupImportPageEvents() {
  // 单个URL导入
  const btnImportSingle = document.getElementById('btn-import-single');
  if (btnImportSingle) {
    btnImportSingle.addEventListener('click', () => {
      showToast('⏳ URL内容提取功能待开发（需要cheerio库）', 'warning');
    });
  }
  
  // 批量URL导入
  const btnImportBatch = document.getElementById('btn-import-batch');
  if (btnImportBatch) {
    btnImportBatch.addEventListener('click', () => {
      showToast('⏳ 批量URL导入功能待开发', 'warning');
    });
  }
  
  // 批量公众号添加（导入页面中的）
  const btnImportBatchAccounts = document.getElementById('btn-import-batch-accounts');
  if (btnImportBatchAccounts) {
    btnImportBatchAccounts.addEventListener('click', importBatchAccountsFromPage);
  }
  
  // 清空按钮
  document.getElementById('btn-clear-single')?.addEventListener('click', () => {
    document.getElementById('import-single-url').value = '';
  });
  
  document.getElementById('btn-clear-batch')?.addEventListener('click', () => {
    document.getElementById('import-batch-urls').value = '';
  });
  
  document.getElementById('btn-clear-batch-accounts')?.addEventListener('click', () => {
    document.getElementById('import-batch-accounts-input').value = '';
  });
}

// 从导入页面批量添加公众号
async function importBatchAccountsFromPage() {
  const textarea = document.getElementById('import-batch-accounts-input');
  const accountNames = textarea.value
    .split('\n')
    .map(name => name.trim())
    .filter(name => name.length > 0);
  
  if (accountNames.length === 0) {
    showToast('请输入至少一个公众号名称', 'error');
    return;
  }
  
  if (accountNames.length > 50) {
    showToast('最多支持50个公众号', 'error');
    return;
  }
  
  // 显示进度区域
  const progressEl = document.getElementById('batch-accounts-progress');
  const detailsEl = document.getElementById('batch-accounts-details');
  progressEl.style.display = 'block';
  detailsEl.innerHTML = '';
  
  const progressFill = document.getElementById('batch-accounts-progress-fill');
  const progressText = document.getElementById('batch-accounts-progress-text');
  const progressPercent = document.getElementById('batch-accounts-progress-percent');
  const successCountEl = document.getElementById('batch-accounts-success-count');
  const errorCountEl = document.getElementById('batch-accounts-error-count');
  
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < accountNames.length; i++) {
    const name = accountNames[i];
    const current = i + 1;
    const percent = Math.round((current / accountNames.length) * 100);
    
    // 更新进度
    progressFill.style.width = `${percent}%`;
    progressText.textContent = `${current} / ${accountNames.length}`;
    progressPercent.textContent = `${percent}%`;
    
    try {
      const result = await searchAndAddAccount(name);
      if (result) {
        successCount++;
        detailsEl.innerHTML += `<div class="progress-item" style="color: #52c41a;">✅ ${name} - 添加成功</div>`;
      } else {
        errorCount++;
        detailsEl.innerHTML += `<div class="progress-item" style="color: #ff4d4f;">❌ ${name} - 已存在或添加失败</div>`;
      }
    } catch (error) {
      errorCount++;
      detailsEl.innerHTML += `<div class="progress-item" style="color: #ff4d4f;">❌ ${name} - 错误: ${error.message}</div>`;
    }
    
    // 更新统计
    successCountEl.textContent = successCount;
    errorCountEl.textContent = errorCount;
    
    // 延迟500ms
    if (i < accountNames.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  showToast(
    `批量添加完成！✅ 成功: ${successCount}  ❌ 失败: ${errorCount}`,
    successCount > 0 ? 'success' : 'error'
  );
}

// ==================== 🌙 夜间模式管理 ====================
const ThemeManager = {
  init() {
    this.themeToggle = document.getElementById('theme-toggle');
    this.currentTheme = localStorage.getItem('theme') || 'light';
    
    // 应用保存的主题
    if (this.currentTheme === 'dark') {
      document.body.classList.add('dark-mode');
      if (this.themeToggle) this.themeToggle.textContent = '☀️';
    }
    
    // 监听切换按钮
    if (this.themeToggle) {
      this.themeToggle.addEventListener('click', () => this.toggle());
    }
    
    // 监听系统主题变化
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        if (!localStorage.getItem('theme')) {
          this.setTheme(e.matches ? 'dark' : 'light');
        }
      });
    }
  },
  
  toggle() {
    this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    this.setTheme(this.currentTheme);
  },
  
  setTheme(theme) {
    this.currentTheme = theme;
    
    if (theme === 'dark') {
      document.body.classList.add('dark-mode');
      if (this.themeToggle) this.themeToggle.textContent = '☀️';
      showToast('🌙 已切换到夜间模式', 'info');
    } else {
      document.body.classList.remove('dark-mode');
      if (this.themeToggle) this.themeToggle.textContent = '🌙';
      showToast('☀️ 已切换到日间模式', 'info');
    }
    
    localStorage.setItem('theme', theme);
  }
};

// ==================== ⌨️ 键盘快捷键 ====================
const KeyboardShortcuts = {
  init() {
    document.addEventListener('keydown', (e) => {
      // Cmd/Ctrl + K: 聚焦搜索框
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      }
      
      // Cmd/Ctrl + D: 切换夜间模式
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault();
        ThemeManager.toggle();
      }
      
      // ESC: 关闭模态框或侧边栏
      if (e.key === 'Escape') {
        // 关闭所有打开的模态框
        document.querySelectorAll('.modal.active').forEach(modal => {
          modal.classList.remove('active');
        });
        
        // 移动端关闭侧边栏
        const sidebar = document.getElementById('sidebar');
        if (sidebar && sidebar.classList.contains('active')) {
          sidebar.classList.remove('active');
        }
      }
    });
  }
};

// ==================== 📊 阅读进度管理 ====================
const ReadingProgress = {
  // 获取已读文章ID列表
  getReadArticles() {
    const read = localStorage.getItem('read_articles');
    return read ? JSON.parse(read) : [];
  },
  
  // 保存已读文章
  markAsRead(articleId) {
    let read = this.getReadArticles();
    if (!read.includes(articleId)) {
      read.push(articleId);
      localStorage.setItem('read_articles', JSON.stringify(read));
    }
  },
  
  // 检查文章是否已读
  isRead(articleId) {
    return this.getReadArticles().includes(articleId);
  },
  
  // 清除所有已读标记
  clearAll() {
    if (confirm('确定要清除所有已读标记吗？')) {
      localStorage.removeItem('read_articles');
      showToast('已清除所有已读标记', 'success');
      // 刷新当前文章列表
      if (window.renderArticles) {
        window.renderArticles();
      }
    }
  }
};

// ==================== 📖 阅读功能增强 ====================
const ReadingEnhancer = {
  fontSize: 'medium', // small, medium, large, xlarge
  width: 'normal', // narrow, normal, wide
  isImmersive: false,
  currentArticleId: null,
  
  init() {
    this.bindEvents();
    this.initScrollProgress();
    this.initBackToTop();
  },
  
  bindEvents() {
    // 字体大小调节
    document.getElementById('btn-font-decrease')?.addEventListener('click', () => {
      this.decreaseFontSize();
    });
    
    document.getElementById('btn-font-increase')?.addEventListener('click', () => {
      this.increaseFontSize();
    });
    
    // 宽度切换
    document.getElementById('btn-width-toggle')?.addEventListener('click', () => {
      this.toggleWidth();
    });
    
    // 沉浸模式
    document.getElementById('btn-immersive-mode')?.addEventListener('click', () => {
      this.toggleImmersiveMode();
    });
    
    // 阅读页收藏按钮
    document.getElementById('btn-reading-star')?.addEventListener('click', () => {
      this.toggleCurrentArticleStar();
    });
  },
  
  // 字体大小调节
  decreaseFontSize() {
    const sizes = ['small', 'medium', 'large', 'xlarge'];
    const currentIndex = sizes.indexOf(this.fontSize);
    if (currentIndex > 0) {
      this.setFontSize(sizes[currentIndex - 1]);
    }
  },
  
  increaseFontSize() {
    const sizes = ['small', 'medium', 'large', 'xlarge'];
    const currentIndex = sizes.indexOf(this.fontSize);
    if (currentIndex < sizes.length - 1) {
      this.setFontSize(sizes[currentIndex + 1]);
    }
  },
  
  setFontSize(size) {
    this.fontSize = size;
    const container = document.getElementById('article-container');
    if (container) {
      container.className = container.className.replace(/font-\w+/, '');
      container.classList.add(`font-${size}`);
      
      const sizeNames = {
        small: '小',
        medium: '中',
        large: '大',
        xlarge: '超大'
      };
      showToast(`字体大小：${sizeNames[size]}`, 'info');
    }
  },
  
  // 宽度切换
  toggleWidth() {
    const widths = ['narrow', 'normal', 'wide'];
    const currentIndex = widths.indexOf(this.width);
    const nextIndex = (currentIndex + 1) % widths.length;
    this.setWidth(widths[nextIndex]);
  },
  
  setWidth(width) {
    this.width = width;
    const container = document.getElementById('article-container');
    if (container) {
      container.className = container.className.replace(/width-\w+/, '');
      if (width !== 'normal') {
        container.classList.add(`width-${width}`);
      }
      
      const widthNames = {
        narrow: '窄',
        normal: '标准',
        wide: '宽'
      };
      showToast(`阅读宽度：${widthNames[width]}`, 'info');
    }
  },
  
  // 沉浸模式
  toggleImmersiveMode() {
    this.isImmersive = !this.isImmersive;
    document.body.classList.toggle('immersive-mode', this.isImmersive);
    
    const btn = document.getElementById('btn-immersive-mode');
    if (btn) {
      btn.textContent = this.isImmersive ? '📕' : '📖';
      btn.title = this.isImmersive ? '退出沉浸模式' : '沉浸模式';
    }
    
    showToast(
      this.isImmersive ? '已进入沉浸模式' : '已退出沉浸模式',
      'info'
    );
  },
  
  // 收藏当前文章
  toggleCurrentArticleStar() {
    if (!this.currentArticleId || !this.currentArticleData) {
      showToast('无法收藏：文章数据不完整', 'warning');
      return;
    }
    
    const btn = document.getElementById('btn-reading-star');
    if (btn && window.FavoritesManager) {
      const result = window.FavoritesManager.toggle(this.currentArticleData);
      
      if (result.success) {
        const isStarred = window.FavoritesManager.isFavorited(this.currentArticleId);
        btn.textContent = isStarred ? '⭐' : '☆';
        btn.classList.toggle('starred', isStarred);
        showToast(result.message, 'success');
        
        // 刷新收藏页面（如果正在该页面）
        if (window.renderFavorites) {
          window.renderFavorites();
        }
      } else {
        showToast(result.message, 'info');
      }
    }
  },
  
  // 设置当前文章
  setCurrentArticle(articleId, articleData) {
    this.currentArticleId = articleId;
    this.currentArticleData = articleData;
    
    // 更新收藏按钮状态
    const btn = document.getElementById('btn-reading-star');
    if (btn && window.FavoritesManager) {
      const isStarred = window.FavoritesManager.isFavorited(articleId);
      btn.textContent = isStarred ? '⭐' : '☆';
      btn.classList.toggle('starred', isStarred);
    }
  },
  
  // 滚动进度
  initScrollProgress() {
    const progressFill = document.getElementById('reading-progress-fill');
    if (!progressFill) return;
    const updateProgress = () => {
      const doc = document.documentElement;
      const scrollTop = window.pageYOffset || doc.scrollTop || 0;
      const scrollHeight = (doc.scrollHeight || 0) - (window.innerHeight || 0);
      const progress = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
      progressFill.style.width = `${progress}%`;
    };
    window.addEventListener('scroll', updateProgress, { passive: true });
    updateProgress();
  },
  
  // 返回顶部
  initBackToTop() {
    const backToTopBtn = document.getElementById('btn-back-to-top');
    
    if (backToTopBtn) {
      const toggleBtn = () => {
        if ((window.pageYOffset || document.documentElement.scrollTop || 0) > 300) {
          backToTopBtn.classList.add('show');
        } else {
          backToTopBtn.classList.remove('show');
        }
      };
      window.addEventListener('scroll', toggleBtn, { passive: true });
      toggleBtn();

      backToTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  },
  
  // 重置设置
  reset() {
    this.setFontSize('medium');
    this.setWidth('normal');
    if (this.isImmersive) {
      this.toggleImmersiveMode();
    }
  }
};

// 初始化新功能
document.addEventListener('DOMContentLoaded', () => {
  // 延迟初始化主题和快捷键，确保 showToast 已定义
  setTimeout(() => {
    ThemeManager.init();
    KeyboardShortcuts.init();
    ReadingEnhancer.init();
  }, 100);
});

// ==================== 📥 导入文章模态框 ====================

// 打开导入文章模态框
function openImportArticleModal() {
  document.getElementById('import-article-modal').style.display = 'flex';
}

// 切换导入Tab
function switchImportTab(tabName) {
  // 隐藏所有Tab内容
  document.querySelectorAll('.import-tab-content').forEach(content => {
    content.style.display = 'none';
  });
  
  // 显示目标Tab
  const targetTab = document.getElementById(`import-tab-${tabName}`);
  if (targetTab) {
    targetTab.style.display = 'block';
  }
}

// 从模态框批量导入公众号
async function importBatchAccountsFromModal() {
  const textarea = document.getElementById('import-batch-accounts-input');
  const accountNames = textarea.value
    .split('\n')
    .map(name => name.trim())
    .filter(name => name.length > 0);
  
  if (accountNames.length === 0) {
    showToast('请输入至少一个公众号名称', 'error');
    return;
  }
  
  if (accountNames.length > 50) {
    showToast('最多支持50个公众号', 'error');
    return;
  }
  
  // 显示进度区域
  const progressEl = document.getElementById('import-progress-modal');
  progressEl.style.display = 'block';
  
  const progressFill = document.getElementById('import-progress-fill');
  const progressText = document.getElementById('import-progress-text');
  const progressPercent = document.getElementById('import-progress-percent');
  const successCountEl = document.getElementById('import-success-count');
  const errorCountEl = document.getElementById('import-error-count');
  
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < accountNames.length; i++) {
    const name = accountNames[i];
    const current = i + 1;
    const percent = Math.round((current / accountNames.length) * 100);
    
    // 更新进度
    progressFill.style.width = `${percent}%`;
    progressText.textContent = `${current} / ${accountNames.length}`;
    progressPercent.textContent = `${percent}%`;
    
    try {
      const result = await searchAndAddAccount(name);
      if (result) {
        successCount++;
      } else {
        errorCount++;
      }
    } catch (error) {
      errorCount++;
    }
    
    // 更新统计
    successCountEl.textContent = successCount;
    errorCountEl.textContent = errorCount;
    
    // 延迟500ms
    if (i < accountNames.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  showToast(
    `批量添加完成！✅ 成功: ${successCount}  ❌ 失败: ${errorCount}`,
    successCount > 0 ? 'success' : 'error'
  );
  
  // 清空输入框
  textarea.value = '';
}

// 导出全局函数
window.switchPage = switchPage;
window.updateSelectedCount = updateSelectedCount;
window.ThemeManager = ThemeManager;
window.ReadingProgress = ReadingProgress;
window.ReadingEnhancer = ReadingEnhancer;
window.openImportArticleModal = openImportArticleModal;

console.log('✨ UI Manager loaded with enhanced reading features');
