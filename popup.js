// 基础搜索功能
class BookmarkSearch {
  constructor() {
    this.searchInput = document.getElementById('searchInput');
    this.resultsDiv = document.getElementById('results');
    this.showFolders = document.getElementById('showFolders');
    this.sortBy = document.getElementById('sortBy');

    this.init();
    this.addFloatingCollapseButton();
  }

  init() {
    this.searchInput.addEventListener('input', debounce(() => this.handleSearch(), 300));
    this.showFolders.addEventListener('change', () => this.handleSearch());
    this.sortBy.addEventListener('change', () => this.handleSearch());
    this.searchInput.focus();
  }

  addFloatingCollapseButton() {
    // 创建浮动收起按钮
    const floatingBtn = document.createElement('button');
    floatingBtn.className = 'floating-collapse-btn';
    floatingBtn.innerHTML = '收起文件夹 ▲';
    document.body.appendChild(floatingBtn);

    // 监听滚动事件
    this.resultsDiv.addEventListener('scroll', () => {
      const expandedFolders = this.resultsDiv.querySelectorAll('.folder-item.expanded');
      if (expandedFolders.length > 0 && this.resultsDiv.scrollTop > 100) {
        floatingBtn.classList.add('show');
      } else {
        floatingBtn.classList.remove('show');
      }
    });

    // 点击收起所有展开的文件夹
    floatingBtn.addEventListener('click', () => {
      const expandedFolders = this.resultsDiv.querySelectorAll('.folder-item.expanded');
      expandedFolders.forEach(folder => {
        const toggleIcon = folder.querySelector('.toggle-icon');
        const folderItems = folder.querySelector('.folder-items');
        folder.classList.remove('expanded');
        if (toggleIcon) toggleIcon.textContent = '▶';
        if (folderItems) folderItems.innerHTML = '';
      });
      floatingBtn.classList.remove('show');
      
      // 平滑滚动到顶部
      this.resultsDiv.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  }

  async handleSearch() {
    try {
      const query = this.searchInput.value.trim();
      
      this.resultsDiv.innerHTML = '<div class="loading">搜索中...</div>';
      
      const bookmarks = await chrome.bookmarks.search({});
      
      if (!query) {
        this.resultsDiv.innerHTML = '<div class="empty-state">请输入搜索关键词</div>';
        return;
      }

      let filteredBookmarks = bookmarks.filter(bookmark => 
        (bookmark.title.toLowerCase().includes(query.toLowerCase()) || 
         bookmark.url?.toLowerCase().includes(query.toLowerCase())) &&
        (this.showFolders.checked || bookmark.url)
      );

      filteredBookmarks = this.sortBookmarks(filteredBookmarks, this.sortBy.value, query);

      if (filteredBookmarks.length === 0) {
        this.resultsDiv.innerHTML = '<div class="empty-state">未找到相关结果</div>';
        return;
      }

      this.resultsDiv.innerHTML = '';
      for (const bookmark of filteredBookmarks) {
        const path = await this.getBookmarkPath(bookmark.id);
        const item = this.createBookmarkItem(bookmark, path, query);
        this.resultsDiv.appendChild(item);
      }
    } catch (error) {
      this.resultsDiv.innerHTML = `<div class="error">搜索出错: ${error.message}</div>`;
    }
  }

  async getBookmarkPath(id) {
    const nodes = [];
    let node = (await chrome.bookmarks.get(id))[0];
    
    while (node.parentId) {
      node = (await chrome.bookmarks.get(node.parentId))[0];
      nodes.unshift(node.title);
    }
    
    return nodes.join(' > ');
  }

  createBookmarkItem(bookmark, path, query) {
    const item = document.createElement('div');
    const isFolder = !bookmark.url;
    
    item.className = `bookmark-item ${isFolder ? 'folder-item' : 'bookmark-item'}`;
    
    item.innerHTML = `
      <div class="item-header">
        <div class="item-icon">${isFolder ? '📁' : '🔖'}</div>
        <div class="item-content">
          <div class="item-title">${this.highlight(bookmark.title, query)}</div>
          <div class="item-path">${path}</div>
          ${bookmark.url ? `
            <div class="item-url">${this.highlight(bookmark.url, query)}</div>
            <div class="item-actions">
              <button class="share-btn" title="分享二维码">
                <span class="share-icon">🔗</span>
              </button>
            </div>
          ` : ''}
        </div>
        ${isFolder ? `
          <button class="folder-toggle" title="展开/收起">
            <span class="toggle-icon">▶</span>
          </button>
        ` : ''}
      </div>
      ${isFolder ? `
        <div class="folder-content">
          <div class="folder-header">
            <span class="folder-title">${bookmark.title}</span>
            <button class="folder-collapse" title="收起文件夹">收起</button>
          </div>
          <div class="folder-items"></div>
        </div>
      ` : ''}
      
      <!-- 二维码弹窗 -->
      ${bookmark.url ? `
        <div class="qr-modal">
          <div class="qr-content">
            <div class="qr-header">
              <h3>分享链接</h3>
              <button class="close-qr">×</button>
            </div>
            <div class="qr-code">
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(bookmark.url)}" 
                   alt="QR Code" 
                   title="${bookmark.title}">
            </div>
            <div class="qr-title">${bookmark.title}</div>
            <div class="qr-url">${bookmark.url}</div>
          </div>
        </div>
      ` : ''}
    `;

    if (!isFolder) {
      // 绑定分享按钮事件
      const shareBtn = item.querySelector('.share-btn');
      const qrModal = item.querySelector('.qr-modal');
      const closeQr = item.querySelector('.close-qr');
      
      shareBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // 先关闭所有其他打开的二维码弹窗
        document.querySelectorAll('.qr-modal.show').forEach(modal => {
          if (modal !== qrModal) {
            modal.classList.remove('show');
          }
        });
        
        // 显示当前二维码
        qrModal.classList.add('show');
      });

      // 关闭二维码弹窗
      closeQr.addEventListener('click', (e) => {
        e.stopPropagation();
        qrModal.classList.remove('show');
      });

      // 点击弹窗外部关闭
      qrModal.addEventListener('click', (e) => {
        if (e.target === qrModal) {
          qrModal.classList.remove('show');
        }
      });

      // ESC 键关闭当前打开的弹窗
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && qrModal.classList.contains('show')) {
          qrModal.classList.remove('show');
        }
      });

      // 书签点击处理
      item.addEventListener('click', () => {
        chrome.tabs.create({ url: bookmark.url });
      });
    }

    if (isFolder) {
      const toggleBtn = item.querySelector('.folder-toggle');
      const collapseBtn = item.querySelector('.folder-collapse');
      const folderContent = item.querySelector('.folder-content');
      const folderItems = item.querySelector('.folder-items');
      const toggleIcon = item.querySelector('.toggle-icon');

      // 展开/收起按钮点击
      toggleBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const isExpanded = item.classList.contains('expanded');
        
        if (isExpanded) {
          // 收起
          item.classList.remove('expanded');
          toggleIcon.textContent = '▶';
          folderItems.innerHTML = '';
        } else {
          // 展开
          item.classList.add('expanded');
          toggleIcon.textContent = '▼';
          
          try {
            const children = await chrome.bookmarks.getChildren(bookmark.id);
            folderItems.innerHTML = '';
            
            if (children.length === 0) {
              folderItems.innerHTML = '<div class="empty-folder">空文件夹</div>';
              return;
            }

            for (const child of children) {
              const childPath = await this.getBookmarkPath(child.id);
              const childItem = this.createBookmarkItem(child, childPath, query);
              folderItems.appendChild(childItem);
            }
          } catch (error) {
            folderItems.innerHTML = '<div class="error">加载失败</div>';
            console.error('Failed to load folder contents:', error);
          }
        }
      });

      // 收起按钮点击
      collapseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        item.classList.remove('expanded');
        toggleIcon.textContent = '▶';
        folderItems.innerHTML = '';
      });
    }

    return item;
  }

  highlight(text, query) {
    if (!query) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }

  sortBookmarks(bookmarks, sortType, query) {
    switch (sortType) {
      case 'relevance':
        return bookmarks.sort((a, b) => {
          const aScore = this.getRelevanceScore(a, query);
          const bScore = this.getRelevanceScore(b, query);
          return bScore - aScore;
        });
      case 'date':
        return bookmarks.sort((a, b) => b.dateAdded - a.dateAdded);
      case 'title':
        return bookmarks.sort((a, b) => a.title.localeCompare(b.title));
      default:
        return bookmarks;
    }
  }

  getRelevanceScore(bookmark, query) {
    let score = 0;
    if (bookmark.title.toLowerCase().includes(query.toLowerCase())) score += 2;
    if (bookmark.url?.toLowerCase().includes(query.toLowerCase())) score += 1;
    return score;
  }
}

// 统计功能
class BookmarkStats {
  constructor() {
    this.statsBtn = document.querySelector('.stats-btn');
    this.statsPanel = document.getElementById('statsPanel');
    this.closeStatsBtn = document.querySelector('.close-stats');
    this.init();
  }

  init() {
    if (this.statsBtn) {
      this.statsBtn.addEventListener('click', () => this.showStats());
    }
    if (this.closeStatsBtn) {
      this.closeStatsBtn.addEventListener('click', () => this.hideStats());
    }
  }

  async showStats() {
    if (!this.statsPanel) return;
    
    // 显示面板
    this.statsPanel.classList.add('show');
    
    // 显示加载状态
    this.showLoadingState();
    
    try {
      const bookmarks = await chrome.bookmarks.getTree();
      const stats = this.analyzeBookmarks(bookmarks);
      await this.updateStatsUI(stats);
    } catch (error) {
      console.error('Failed to load stats:', error);
      this.showErrorState('加载统计数据失败');
    }
  }

  hideStats() {
    if (this.statsPanel) {
      this.statsPanel.classList.remove('show');
    }
  }

  showLoadingState() {
    const elements = ['totalBookmarks', 'totalFolders', 'brokenCount', 'recentBookmarks', 'duplicateBookmarks'];
    elements.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.innerHTML = '<div class="loading">加载中...</div>';
      }
    });
  }

  showErrorState(message) {
    const elements = ['totalBookmarks', 'totalFolders', 'brokenCount', 'recentBookmarks', 'duplicateBookmarks'];
    elements.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.innerHTML = `<div class="error">${message}</div>`;
      }
    });
  }

  analyzeBookmarks(nodes) {
    let stats = {
      total: 0,
      folders: 0,
      recent: [],
      duplicates: new Map(),
      urls: new Set()
    };

    const processNode = (node) => {
      if (node.url) {
        stats.total++;
        stats.recent.push(node);
        
        // 检查重复
        if (stats.urls.has(node.url)) {
          if (!stats.duplicates.has(node.url)) {
            stats.duplicates.set(node.url, []);
          }
          stats.duplicates.get(node.url).push(node);
        } else {
          stats.urls.add(node.url);
        }
      } else if (node.title || node.id !== '0') {
        stats.folders++;
      }

      if (node.children) {
        node.children.forEach(processNode);
      }
    };

    nodes.forEach(processNode);

    // 排序最近添加的书签
    stats.recent.sort((a, b) => b.dateAdded - a.dateAdded);
    stats.recent = stats.recent.slice(0, 10);

    return stats;
  }

  async updateStatsUI(stats) {
    // 更新基础统计
    this.updateElement('totalBookmarks', stats.total);
    this.updateElement('totalFolders', stats.folders);
    this.updateElement('brokenCount', stats.duplicates.size);

    // 更新最近添加列表
    this.updateRecentBookmarks(stats.recent);

    // 更新重复书签列表
    this.updateDuplicateBookmarks(stats.duplicates);
  }

  updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  }

  updateRecentBookmarks(recentBookmarks) {
    const container = document.getElementById('recentBookmarks');
    if (!container) return;

    container.innerHTML = recentBookmarks.map(bookmark => `
      <div class="recent-item" data-url="${bookmark.url}">
        <div class="item-icon">🔖</div>
        <div class="item-content">
          <div class="item-title">${this.escapeHtml(bookmark.title)}</div>
          <div class="item-url">${this.escapeHtml(bookmark.url)}</div>
          <div class="item-time">${this.formatDate(bookmark.dateAdded)}</div>
        </div>
      </div>
    `).join('');

    // 添加点击事件
    container.querySelectorAll('.recent-item').forEach(item => {
      item.addEventListener('click', () => {
        const url = item.dataset.url;
        if (url) {
          chrome.tabs.create({ url });
        }
      });
    });
  }

  updateDuplicateBookmarks(duplicates) {
    const container = document.getElementById('duplicateBookmarks');
    if (!container) return;

    const duplicateItems = Array.from(duplicates.entries())
      .filter(([_, items]) => items.length > 1);

    if (duplicateItems.length === 0) {
      container.innerHTML = '<div class="empty-message">没有发现重复的书签</div>';
      return;
    }

    container.innerHTML = duplicateItems.map(([url, items]) => `
      <div class="duplicate-group">
        <div class="duplicate-url">${this.escapeHtml(url)}</div>
        ${items.map(item => `
          <div class="duplicate-item" data-id="${item.id}" data-url="${item.url}">
            <div class="item-content">
              <div class="item-title">${this.escapeHtml(item.title)}</div>
              <div class="item-time">${this.formatDate(item.dateAdded)}</div>
            </div>
            <div class="item-actions">
              <button class="item-action" data-action="open" title="打开">🔗</button>
              <button class="item-action" data-action="delete" title="删除">🗑️</button>
            </div>
          </div>
        `).join('')}
      </div>
    `).join('');

    // 添加事件处理
    this.bindDuplicateActions(container);
  }

  bindDuplicateActions(container) {
    container.addEventListener('click', async (e) => {
      const action = e.target.closest('.item-action');
      if (!action) return;

      const item = action.closest('.duplicate-item');
      const { id, url } = item.dataset;

      if (action.dataset.action === 'open') {
        chrome.tabs.create({ url });
      } else if (action.dataset.action === 'delete') {
        if (confirm('确定要删除这个书签吗？')) {
          try {
            await chrome.bookmarks.remove(id);
            item.remove();
            // 重新加载统计
            this.showStats();
          } catch (error) {
            console.error('Failed to delete bookmark:', error);
          }
        }
      }
    });
  }

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  formatDate(timestamp) {
    return new Date(timestamp).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

// 工具函数
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  new BookmarkSearch();
  new BookmarkStats();
  new BouncingWatermark();
}); 