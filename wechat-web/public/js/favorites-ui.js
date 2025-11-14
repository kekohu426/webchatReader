// ==================== 收藏页面 UI ====================

// 全局状态
const favoritesState = {
  currentTag: '',
  searchKeyword: '',
  filter: 'all'
};

// 渲染收藏列表
function renderFavorites() {
  const container = document.getElementById('kb-articles-list');
  if (!container) {
    console.warn('收藏容器未找到：kb-articles-list');
    return;
  }
  
  let favorites = window.FavoritesManager.getAll();
  console.log('📚 渲染收藏列表，共', favorites.length, '篇文章', favorites);
  
  // 应用筛选
  if (favoritesState.currentTag) {
    favorites = favorites.filter(item => 
      item.tags && item.tags.includes(favoritesState.currentTag)
    );
  }
  
  // 应用搜索
  if (favoritesState.searchKeyword) {
    favorites = window.FavoritesManager.search(favoritesState.searchKeyword);
  }
  
  // 应用状态筛选
  if (favoritesState.filter === 'starred') {
    // 已收藏就是全部
  } else if (favoritesState.filter === 'read') {
    favorites = favorites.filter(item => item.isRead);
  } else if (favoritesState.filter === 'unread') {
    favorites = favorites.filter(item => !item.isRead);
  }
  
  // 清空容器
  container.innerHTML = '';
  
  if (favorites.length === 0) {
    container.innerHTML = `
      <div class="empty-state-modern">
        <div class="empty-illustration">
          <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
            <circle cx="60" cy="60" r="50" fill="#f0f0f0"/>
            <text x="60" y="75" font-size="48" text-anchor="middle">📚</text>
          </svg>
        </div>
        <h3 class="empty-title">还没有收藏</h3>
        <p class="empty-desc">开始收藏你喜欢的文章吧</p>
        <div class="empty-actions">
          <button class="btn-primary" onclick="window.switchPage('accounts')">
            去浏览文章
          </button>
          <button class="btn-secondary" onclick="document.getElementById('btn-import-article').click()">
            导入文章
          </button>
        </div>
      </div>
    `;
    return;
  }
  
  // 渲染文章卡片
  favorites.forEach(article => {
    const card = createFavoriteCard(article);
    container.appendChild(card);
  });
  
  // 更新统计信息
  updateFavoritesStats();
}

// 创建收藏文章卡片
function createFavoriteCard(article) {
  const card = document.createElement('div');
  card.className = 'article-card';
  if (article.isRead) {
    card.classList.add('read');
  }
  
  const articleId = article.link || article.url || article.id;
  const cover = article.cover || 'https://via.placeholder.com/120x90?text=封面';
  const title = article.title || '未知标题';
  const author = article.author || '未知作者';
  const date = formatDate(article.create_time || article.favoritedAt);
  const digest = article.digest || '';
  
  card.innerHTML = `
    <div class="card-cover">
      <img src="${cover}" alt="${title}" onerror="this.src='https://via.placeholder.com/120x90?text=封面'">
      ${article.isRead ? '<span class="read-badge">已读</span>' : ''}
    </div>
    <div class="card-content">
      <h3 class="card-title">${title}</h3>
      <p class="card-digest">${digest}</p>
      <div class="card-meta">
        <span class="meta-item">
          <span class="meta-icon">✍️</span>
          <span class="meta-text">${author}</span>
        </span>
        <span class="meta-item">
          <span class="meta-icon">📅</span>
          <span class="meta-text">${date}</span>
        </span>
      </div>
      ${article.tags && article.tags.length > 0 ? `
        <div class="card-tags">
          ${article.tags.map(tag => `<span class="tag-badge">${tag}</span>`).join('')}
        </div>
      ` : ''}
    </div>
    <div class="card-actions">
      <button class="btn-icon btn-read" title="阅读">
        📖
      </button>
      <button class="btn-icon btn-unfavorite" title="取消收藏">
        ⭐
      </button>
      <button class="btn-icon btn-delete" title="删除">
        🗑️
      </button>
    </div>
  `;
  
  // 点击卡片阅读
  card.querySelector('.card-content').addEventListener('click', () => {
    readFavoriteArticle(article);
  });
  
  // 阅读按钮
  card.querySelector('.btn-read').addEventListener('click', (e) => {
    e.stopPropagation();
    readFavoriteArticle(article);
  });
  
  // 取消收藏按钮
  card.querySelector('.btn-unfavorite').addEventListener('click', (e) => {
    e.stopPropagation();
    if (confirm(`确定要取消收藏《${title}》吗？`)) {
      const result = window.FavoritesManager.remove(articleId);
      if (result.success) {
        showToast(result.message, 'success');
        renderFavorites();
      }
    }
  });
  
  // 删除按钮
  card.querySelector('.btn-delete').addEventListener('click', (e) => {
    e.stopPropagation();
    if (confirm(`确定要删除《${title}》吗？`)) {
      const result = window.FavoritesManager.remove(articleId);
      if (result.success) {
        showToast('已删除', 'success');
        renderFavorites();
      }
    }
  });
  
  return card;
}

// 阅读收藏的文章
async function readFavoriteArticle(article) {
  const articleId = article.link || article.url || article.id;
  
  // 标记为已读
  window.FavoritesManager.markAsRead(articleId);
  
  // 切换到文章列表页并显示详情
  if (window.switchPage) {
    window.switchPage('accounts');
  }
  
  // 显示文章详情
  if (window.showArticleDetail) {
    window.showArticleDetail(article);
  }
}

// 更新统计信息
function updateFavoritesStats() {
  const stats = window.FavoritesManager.getStats();
  
  // 更新统计卡片
  const totalEl = document.getElementById('kb-total-count');
  const unreadEl = document.getElementById('kb-unread-count');
  const readEl = document.getElementById('kb-read-count');
  
  if (totalEl) totalEl.textContent = stats.total;
  if (unreadEl) unreadEl.textContent = stats.unread;
  if (readEl) readEl.textContent = stats.read;
}

// 格式化日期
function formatDate(timestamp) {
  if (!timestamp) return '未知日期';
  
  const date = new Date(typeof timestamp === 'string' ? parseInt(timestamp) * 1000 : timestamp);
  const now = new Date();
  const diff = now - date;
  
  // 一天内显示时间
  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / (60 * 60 * 1000));
    if (hours < 1) {
      const minutes = Math.floor(diff / (60 * 1000));
      return minutes < 1 ? '刚刚' : `${minutes}分钟前`;
    }
    return `${hours}小时前`;
  }
  
  // 一周内显示天数
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    return `${days}天前`;
  }
  
  // 否则显示日期
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  if (year === now.getFullYear()) {
    return `${month}-${day}`;
  }
  return `${year}-${month}-${day}`;
}

// ==================== 事件监听 ====================

document.addEventListener('DOMContentLoaded', () => {
  console.log('📚 收藏页面模块已加载');
  
  // 搜索按钮
  const searchBtn = document.getElementById('kb-search-btn');
  const searchInput = document.getElementById('kb-search-input');
  
  if (searchBtn && searchInput) {
    searchBtn.addEventListener('click', () => {
      favoritesState.searchKeyword = searchInput.value.trim();
      renderFavorites();
    });
    
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        favoritesState.searchKeyword = searchInput.value.trim();
        renderFavorites();
      }
    });
  }
  
  // 标签筛选
  const tagFilters = document.getElementById('kb-tag-filters');
  if (tagFilters) {
    tagFilters.addEventListener('click', (e) => {
      if (e.target.classList.contains('tag-chip')) {
        // 更新激活状态
        tagFilters.querySelectorAll('.tag-chip').forEach(btn => {
          btn.classList.remove('active');
        });
        e.target.classList.add('active');
        
        // 筛选
        favoritesState.currentTag = e.target.dataset.tag || '';
        renderFavorites();
      }
    });
  }
  
  // 状态筛选
  const filterSelect = document.getElementById('kb-filter-select');
  if (filterSelect) {
    filterSelect.addEventListener('change', () => {
      favoritesState.filter = filterSelect.value;
      renderFavorites();
    });
  }
  
  // 不在初始化时渲染，等待用户切换到收藏页面
  // renderFavorites();
});

// 导出到全局
window.renderFavorites = renderFavorites;
window.readFavoriteArticle = readFavoriteArticle;

console.log('✅ 收藏管理模块已就绪');

