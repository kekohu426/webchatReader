// ==================== 阅读增强功能 ====================

// Toast 通知函数
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) {
    console.error('Toast container not found');
    return;
  }
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  
  container.appendChild(toast);
  
  // 3秒后自动消失
  setTimeout(() => {
    toast.classList.add('hiding');
    setTimeout(() => {
      if (container.contains(toast)) {
        container.removeChild(toast);
      }
    }, 300);
  }, 3000);
}

// 导出到全局
window.showToast = showToast;

// 阅读增强管理器
const ReadingEnhancer = {
  currentArticleId: null,
  currentArticleData: null,
  
  init() {
    this.bindEvents();
    console.log('✅ 阅读增强功能已加载');
  },
  
  // 绑定事件
  bindEvents() {
    // 暂无需要绑定的事件
  },
  
  // 设置当前文章
  setCurrentArticle(articleId, articleData) {
    this.currentArticleId = articleId;
    this.currentArticleData = articleData;
  }
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  ReadingEnhancer.init();
});

// 导出到全局
window.ReadingEnhancer = ReadingEnhancer;

console.log('✅ 阅读增强模块已加载');

