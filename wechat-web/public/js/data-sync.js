// ==================== 数据同步管理器 ====================

const DataSyncManager = {
  
  // 导出所有数据
  exportAllData() {
    const data = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      favorites: this.getFavorites(),
      accounts: this.getAccounts(),
      settings: this.getSettings(),
      readProgress: this.getReadProgress()
    };
    
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `wechat_data_backup_${Date.now()}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
    
    if (window.showToast) {
      window.showToast('✅ 数据导出成功', 'success');
    } else {
      alert('数据导出成功！');
    }
  },
  
  // 导入数据
  importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result);
          
          // 验证数据格式
          if (!data.version) {
            throw new Error('数据格式错误');
          }
          
          // 导入数据
          if (data.favorites) {
            localStorage.setItem('wechat_favorites', JSON.stringify(data.favorites));
          }
          if (data.accounts) {
            localStorage.setItem('wechat_accounts', JSON.stringify(data.accounts));
          }
          if (data.settings) {
            localStorage.setItem('wechat_settings', JSON.stringify(data.settings));
          }
          if (data.readProgress) {
            localStorage.setItem('wechat_read_progress', JSON.stringify(data.readProgress));
          }
          
          if (window.showToast) {
            window.showToast('✅ 数据导入成功，请刷新页面', 'success');
          } else {
            alert('数据导入成功！请刷新页面。');
          }
          
          // 3秒后自动刷新
          setTimeout(() => {
            window.location.reload();
          }, 3000);
          
        } catch (error) {
          console.error('导入失败:', error);
          if (window.showToast) {
            window.showToast('❌ 导入失败：' + error.message, 'error');
          } else {
            alert('导入失败：' + error.message);
          }
        }
      };
      
      reader.readAsText(file);
    };
    
    input.click();
  },
  
  // 获取收藏数据
  getFavorites() {
    try {
      return JSON.parse(localStorage.getItem('wechat_favorites') || '[]');
    } catch (e) {
      return [];
    }
  },
  
  // 获取账号数据
  getAccounts() {
    try {
      return JSON.parse(localStorage.getItem('wechat_accounts') || '[]');
    } catch (e) {
      return [];
    }
  },
  
  // 获取设置数据
  getSettings() {
    try {
      return JSON.parse(localStorage.getItem('wechat_settings') || '{}');
    } catch (e) {
      return {};
    }
  },
  
  // 获取阅读进度
  getReadProgress() {
    try {
      return JSON.parse(localStorage.getItem('wechat_read_progress') || '{}');
    } catch (e) {
      return {};
    }
  },
  
  // 获取数据统计
  getStats() {
    return {
      favorites: this.getFavorites().length,
      accounts: this.getAccounts().length,
      readArticles: Object.keys(this.getReadProgress()).length
    };
  },
  
  // 清空所有数据
  clearAllData() {
    if (!confirm('⚠️ 确定要清空所有数据吗？此操作不可恢复！\n\n建议先导出备份！')) {
      return false;
    }
    
    if (!confirm('最后确认：真的要删除所有数据吗？')) {
      return false;
    }
    
    localStorage.removeItem('wechat_favorites');
    localStorage.removeItem('wechat_accounts');
    localStorage.removeItem('wechat_settings');
    localStorage.removeItem('wechat_read_progress');
    localStorage.removeItem('wechat_likes');
    localStorage.removeItem('wechat_comments');
    localStorage.removeItem('wechat_follows');
    
    if (window.showToast) {
      window.showToast('✅ 数据已清空', 'success');
    } else {
      alert('数据已清空！');
    }
    
    setTimeout(() => {
      window.location.reload();
    }, 1000);
    
    return true;
  },
  
  // 初始化
  init() {
    // 添加全局快捷键
    document.addEventListener('keydown', (e) => {
      // Cmd/Ctrl + E: 导出数据
      if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
        e.preventDefault();
        this.exportAllData();
      }
      // Cmd/Ctrl + I: 导入数据
      if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
        e.preventDefault();
        this.importData();
      }
    });
    
    console.log('✅ 数据同步管理器已加载');
    console.log('📊 当前数据统计:', this.getStats());
    console.log('💡 快捷键: Cmd/Ctrl+E 导出, Cmd/Ctrl+I 导入');
  }
};

// 页面加载后初始化
document.addEventListener('DOMContentLoaded', () => {
  DataSyncManager.init();
});

// 导出到全局
window.DataSyncManager = DataSyncManager;

console.log('✅ 数据同步模块已加载');

