// ==================== 收藏管理器 ====================

const FavoritesManager = {
  STORAGE_KEY: 'wechat_favorites',
  
  // 获取所有收藏
  getAll() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('读取收藏失败:', error);
      return [];
    }
  },
  
  // 保存收藏列表
  saveAll(favorites) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(favorites));
      return true;
    } catch (error) {
      console.error('保存收藏失败:', error);
      return false;
    }
  },
  
  // 添加收藏
  add(article) {
    const favorites = this.getAll();
    const articleId = article.link || article.url || article.id;
    
    console.log('🌟 尝试收藏文章:', article.title, 'ID:', articleId);
    
    // 检查是否已收藏
    const exists = favorites.some(item => 
      (item.link || item.url || item.id) === articleId
    );
    
    if (exists) {
      console.log('⚠️ 文章已存在收藏中');
      return { success: false, message: '文章已在收藏中' };
    }
    
    // 添加收藏时间和标签
    const favoriteItem = {
      ...article,
      favoritedAt: Date.now(),
      tags: article.tags || [],
      isRead: article.isRead || false
    };
    
    favorites.unshift(favoriteItem); // 添加到开头
    
    if (this.saveAll(favorites)) {
      console.log('✅ 收藏成功！当前收藏数:', favorites.length);
      return { success: true, message: '收藏成功', count: favorites.length };
    } else {
      console.error('❌ 保存收藏失败');
      return { success: false, message: '保存失败' };
    }
  },
  
  // 删除收藏
  remove(articleId) {
    const favorites = this.getAll();
    const newFavorites = favorites.filter(item => 
      (item.link || item.url || item.id) !== articleId
    );
    
    if (favorites.length === newFavorites.length) {
      return { success: false, message: '文章不在收藏中' };
    }
    
    if (this.saveAll(newFavorites)) {
      return { success: true, message: '已取消收藏', count: newFavorites.length };
    } else {
      return { success: false, message: '删除失败' };
    }
  },
  
  // 检查是否已收藏
  isFavorited(articleId) {
    const favorites = this.getAll();
    return favorites.some(item => 
      (item.link || item.url || item.id) === articleId
    );
  },
  
  // 切换收藏状态
  toggle(article) {
    const articleId = article.link || article.url || article.id;
    if (this.isFavorited(articleId)) {
      return this.remove(articleId);
    } else {
      return this.add(article);
    }
  },
  
  // 按标签筛选
  filterByTag(tag) {
    const favorites = this.getAll();
    if (!tag) return favorites;
    return favorites.filter(item => 
      item.tags && item.tags.includes(tag)
    );
  },
  
  // 搜索收藏
  search(keyword) {
    const favorites = this.getAll();
    if (!keyword) return favorites;
    
    const lowerKeyword = keyword.toLowerCase();
    return favorites.filter(item => 
      (item.title && item.title.toLowerCase().includes(lowerKeyword)) ||
      (item.author && item.author.toLowerCase().includes(lowerKeyword)) ||
      (item.digest && item.digest.toLowerCase().includes(lowerKeyword))
    );
  },
  
  // 更新文章标签
  updateTags(articleId, tags) {
    const favorites = this.getAll();
    const item = favorites.find(fav => 
      (fav.link || fav.url || fav.id) === articleId
    );
    
    if (item) {
      item.tags = tags;
      return this.saveAll(favorites);
    }
    return false;
  },
  
  // 标记为已读
  markAsRead(articleId) {
    const favorites = this.getAll();
    const item = favorites.find(fav => 
      (fav.link || fav.url || fav.id) === articleId
    );
    
    if (item) {
      item.isRead = true;
      return this.saveAll(favorites);
    }
    return false;
  },
  
  // 获取统计信息
  getStats() {
    const favorites = this.getAll();
    const allTags = new Set();
    let readCount = 0;
    
    favorites.forEach(item => {
      if (item.isRead) readCount++;
      if (item.tags) {
        item.tags.forEach(tag => allTags.add(tag));
      }
    });
    
    return {
      total: favorites.length,
      read: readCount,
      unread: favorites.length - readCount,
      tags: Array.from(allTags)
    };
  },
  
  // 清空所有收藏
  clear() {
    if (confirm('确定要清空所有收藏吗？此操作不可恢复！')) {
      localStorage.removeItem(this.STORAGE_KEY);
      return true;
    }
    return false;
  },
  
  // 导出收藏为 JSON
  exportToJSON() {
    const favorites = this.getAll();
    const dataStr = JSON.stringify(favorites, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `favorites_${new Date().getTime()}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
  },
  
  // 从 JSON 导入收藏
  importFromJSON(jsonData) {
    try {
      const imported = JSON.parse(jsonData);
      if (!Array.isArray(imported)) {
        return { success: false, message: 'JSON 格式不正确' };
      }
      
      const existing = this.getAll();
      const merged = [...existing];
      let addedCount = 0;
      
      imported.forEach(item => {
        const articleId = item.link || item.url || item.id;
        if (!existing.some(e => (e.link || e.url || e.id) === articleId)) {
          merged.push(item);
          addedCount++;
        }
      });
      
      if (this.saveAll(merged)) {
        return { 
          success: true, 
          message: `成功导入 ${addedCount} 篇文章`,
          count: merged.length
        };
      } else {
        return { success: false, message: '保存失败' };
      }
    } catch (error) {
      return { success: false, message: '解析 JSON 失败: ' + error.message };
    }
  }
};

// 导出到全局
window.FavoritesManager = FavoritesManager;

// 调试命令
window.testFavorites = () => {
  const stats = FavoritesManager.getStats();
  console.log('📊 收藏统计:', stats);
  console.log('📚 所有收藏:', FavoritesManager.getAll());
  return stats;
};

console.log('✅ 收藏管理器已加载，使用 testFavorites() 查看收藏数据');

