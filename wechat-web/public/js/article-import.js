// ==================== 文章导入功能 ====================

const ArticleImporter = {
  // 导入单个URL
  async importSingleURL(url) {
    if (!url || !url.trim()) {
      return { success: false, message: '请输入文章URL' };
    }
    
    url = url.trim();
    
    // 验证URL格式
    if (!url.includes('mp.weixin.qq.com')) {
      return { success: false, message: '请输入有效的微信公众号文章链接' };
    }
    
    try {
      // 通过后端API获取文章内容
      const response = await fetch('/api/article-content', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url })
      });
      
      if (!response.ok) {
        throw new Error('获取文章失败');
      }
      
      const html = await response.text();
      
      // 从HTML中提取标题和作者信息
      const article = this.extractArticleInfo(html, url);
      
      // 添加到收藏
      const result = window.FavoritesManager.add(article);
      
      if (result.success) {
        return {
          success: true,
          message: `文章《${article.title}》已导入并收藏`,
          article
        };
      } else {
        return result;
      }
    } catch (error) {
      console.error('导入文章失败:', error);
      return { 
        success: false, 
        message: '导入失败: ' + error.message 
      };
    }
  },
  
  // 批量导入URL
  async importBatchURLs(urls) {
    if (!urls || urls.length === 0) {
      return { success: false, message: '请输入文章URL' };
    }
    
    const results = {
      total: urls.length,
      success: 0,
      failed: 0,
      skipped: 0,
      articles: []
    };
    
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i].trim();
      
      if (!url) {
        results.skipped++;
        continue;
      }
      
      // 更新进度
      if (window.updateImportProgress) {
        window.updateImportProgress(i + 1, urls.length, `正在导入第 ${i + 1} 篇...`);
      }
      
      // 导入单个URL
      const result = await this.importSingleURL(url);
      
      if (result.success) {
        results.success++;
        results.articles.push(result.article);
      } else if (result.message.includes('已在收藏中')) {
        results.skipped++;
      } else {
        results.failed++;
      }
      
      // 延迟，避免请求过快
      if (i < urls.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    return {
      success: true,
      message: `导入完成！成功: ${results.success}, 跳过: ${results.skipped}, 失败: ${results.failed}`,
      ...results
    };
  },
  
  // 从HTML中提取文章信息
  extractArticleInfo(html, url) {
    // 创建一个临时的 DOM 解析器
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // 提取标题
    let title = doc.querySelector('meta[property="og:title"]')?.content ||
                doc.querySelector('title')?.textContent ||
                doc.querySelector('h1')?.textContent ||
                '未知标题';
    
    // 提取作者
    let author = doc.querySelector('meta[name="author"]')?.content ||
                 doc.querySelector('#js_name')?.textContent ||
                 doc.querySelector('.profile_nickname')?.textContent ||
                 '未知作者';
    
    // 提取描述
    let digest = doc.querySelector('meta[property="og:description"]')?.content ||
                 doc.querySelector('meta[name="description"]')?.content ||
                 '';
    
    // 提取发布时间
    let publishTime = doc.querySelector('meta[property="article:published_time"]')?.content ||
                      doc.querySelector('#publish_time')?.textContent ||
                      '';
    
    // 提取封面图
    let cover = doc.querySelector('meta[property="og:image"]')?.content ||
                doc.querySelector('#js_cover')?.src ||
                '';
    
    return {
      title: title.trim(),
      author: author.trim(),
      digest: digest.trim().substring(0, 200),
      link: url,
      url: url,
      cover: cover,
      create_time: publishTime || Date.now(),
      importedAt: Date.now(),
      source: 'import',
      tags: ['导入']
    };
  }
};

// 导出到全局
window.ArticleImporter = ArticleImporter;

// ==================== UI 交互逻辑 ====================

document.addEventListener('DOMContentLoaded', () => {
  // 单个URL导入按钮
  const btnImportSingle = document.createElement('button');
  btnImportSingle.id = 'btn-import-single-url';
  btnImportSingle.className = 'btn-primary';
  btnImportSingle.style.width = '100%';
  btnImportSingle.style.marginTop = '10px';
  btnImportSingle.textContent = '📥 导入到收藏';
  
  const singleUrlTab = document.getElementById('import-tab-url');
  if (singleUrlTab) {
    // 移除"功能待开发"提示
    const devNotice = singleUrlTab.querySelector('.dev-notice');
    if (devNotice) devNotice.remove();
    
    // 添加导入按钮
    singleUrlTab.appendChild(btnImportSingle);
  }
  
  // 批量URL导入按钮
  const btnImportBatch = document.createElement('button');
  btnImportBatch.id = 'btn-import-batch-urls';
  btnImportBatch.className = 'btn-primary';
  btnImportBatch.style.width = '100%';
  btnImportBatch.style.marginTop = '10px';
  btnImportBatch.textContent = '📥 批量导入到收藏';
  
  const batchUrlTab = document.getElementById('import-tab-batch-url');
  if (batchUrlTab) {
    // 移除"功能待开发"提示
    const devNotice = batchUrlTab.querySelector('.dev-notice');
    if (devNotice) devNotice.remove();
    
    // 添加导入按钮
    batchUrlTab.appendChild(btnImportBatch);
    
    // 添加进度显示
    const progressDiv = document.createElement('div');
    progressDiv.id = 'batch-import-progress';
    progressDiv.style.display = 'none';
    progressDiv.style.marginTop = '20px';
    progressDiv.innerHTML = `
      <div class="progress-bar" style="width: 100%; height: 30px; background: #f0f0f0; border-radius: 15px; overflow: hidden; margin-bottom: 10px;">
        <div class="progress-fill" id="batch-import-progress-fill" style="width: 0%; height: 100%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); transition: width 0.3s;"></div>
      </div>
      <div class="progress-text" style="text-align: center; font-size: 14px; color: #666;">
        <span id="batch-import-progress-text">准备导入...</span>
      </div>
    `;
    batchUrlTab.appendChild(progressDiv);
  }
  
  // 单个URL导入事件
  btnImportSingle.addEventListener('click', async () => {
    const input = document.getElementById('import-single-url-input');
    const url = input.value.trim();
    
    if (!url) {
      showToast('请输入文章URL', 'warning');
      return;
    }
    
    btnImportSingle.disabled = true;
    btnImportSingle.textContent = '导入中...';
    
    const result = await ArticleImporter.importSingleURL(url);
    
    btnImportSingle.disabled = false;
    btnImportSingle.textContent = '📥 导入到收藏';
    
    if (result.success) {
      showToast(result.message, 'success');
      input.value = '';
      
      // 刷新收藏页面（如果正在该页面）
      if (window.renderFavorites) {
        window.renderFavorites();
      }
    } else {
      showToast(result.message, 'error');
    }
  });
  
  // 批量URL导入事件
  btnImportBatch.addEventListener('click', async () => {
    const textarea = document.getElementById('import-batch-urls-input');
    const urlsText = textarea.value.trim();
    
    if (!urlsText) {
      showToast('请输入文章URL', 'warning');
      return;
    }
    
    // 解析URL列表
    const urls = urlsText.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    if (urls.length === 0) {
      showToast('请输入有效的文章URL', 'warning');
      return;
    }
    
    if (urls.length > 50) {
      showToast('一次最多导入50篇文章', 'warning');
      return;
    }
    
    if (!confirm(`确定要导入 ${urls.length} 篇文章吗？`)) {
      return;
    }
    
    btnImportBatch.disabled = true;
    btnImportBatch.textContent = '导入中...';
    
    const progressDiv = document.getElementById('batch-import-progress');
    progressDiv.style.display = 'block';
    
    // 设置进度更新函数
    window.updateImportProgress = (current, total, message) => {
      const percent = Math.round((current / total) * 100);
      document.getElementById('batch-import-progress-fill').style.width = percent + '%';
      document.getElementById('batch-import-progress-text').textContent = 
        `${message} (${current}/${total})`;
    };
    
    const result = await ArticleImporter.importBatchURLs(urls);
    
    btnImportBatch.disabled = false;
    btnImportBatch.textContent = '📥 批量导入到收藏';
    
    showToast(result.message, 'success');
    textarea.value = '';
    progressDiv.style.display = 'none';
    
    // 刷新收藏页面
    if (window.renderFavorites) {
      window.renderFavorites();
    }
  });
});

