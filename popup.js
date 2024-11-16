// 基础搜索功能
class BookmarkSearch {
  constructor() {
    this.searchInput = document.getElementById('searchInput');
    this.resultsDiv = document.getElementById('results');
    this.showFolders = document.getElementById('showFolders');
    this.sortBy = document.getElementById('sortBy');
    
    this.pageSize = 5;
    this.currentPage = 1;
    this.searchResults = [];

    this.init();
  }

  init() {
    this.searchInput.addEventListener('input', debounce(() => {
      this.currentPage = 1;
      this.handleSearch();
    }, 300));
    this.showFolders.addEventListener('change', () => this.handleSearch());
    this.sortBy.addEventListener('change', () => this.handleSearch());
    this.searchInput.focus();
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
      this.searchResults = filteredBookmarks;

      if (filteredBookmarks.length === 0) {
        this.resultsDiv.innerHTML = '<div class="empty-state">未找到相关结果</div>';
        return;
      }

      await this.updateResultsList(query);
    } catch (error) {
      this.resultsDiv.innerHTML = `<div class="error">搜索出错: ${error.message}</div>`;
    }
  }

  async updateResultsList(query) {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    const pageItems = this.searchResults.slice(startIndex, endIndex);
    const totalPages = Math.ceil(this.searchResults.length / this.pageSize);

    let resultsHtml = `
      <div class="results-count">找到 ${this.searchResults.length} 个结果</div>
      <div class="results-list">
    `;

    // 等待所有书签路径获取完成
    for (const bookmark of pageItems) {
      const path = await this.getBookmarkPath(bookmark.id);
      resultsHtml += this.createBookmarkItem(bookmark, path, query);
    }

    resultsHtml += `
      </div>
      <div class="pagination">
        <button class="page-btn first" data-action="first" ${this.currentPage === 1 ? 'disabled' : ''}>
          ⏮
        </button>
        <button class="page-btn prev" data-action="prev" ${this.currentPage === 1 ? 'disabled' : ''}>
          ◀
        </button>
        <span class="page-info">${this.currentPage}/${totalPages}</span>
        <button class="page-btn next" data-action="next" ${this.currentPage === totalPages ? 'disabled' : ''}>
          ▶
        </button>
        <button class="page-btn last" data-action="last" ${this.currentPage === totalPages ? 'disabled' : ''}>
          ⏭
        </button>
      </div>
    `;

    this.resultsDiv.innerHTML = resultsHtml;
    
    // 绑定事件
    this.bindEvents();
    this.bindPaginationEvents(totalPages);
  }

  bindEvents() {
    // 绑定打开链接事件
    this.resultsDiv.querySelectorAll('[data-action="open"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const url = btn.dataset.url;
        if (url) chrome.tabs.create({ url });
      });
    });

    // 绑定分享事件
    this.resultsDiv.querySelectorAll('[data-action="share"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const url = btn.dataset.url;
        const title = btn.dataset.title;
        if (url) this.showQRCode(url, title);
      });
    });

    // 绑定文件夹展开/收起事件
    this.resultsDiv.querySelectorAll('.folder-toggle').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const folderId = btn.dataset.id;
        const folderItem = btn.closest('.folder-item');
        const folderContent = folderItem.querySelector('.folder-content');
        const toggleIcon = btn.querySelector('.toggle-icon');

        if (folderItem.classList.contains('expanded')) {
          folderItem.classList.remove('expanded');
          toggleIcon.textContent = '▶';
          folderContent.querySelector('.folder-items').innerHTML = '';
        } else {
          folderItem.classList.add('expanded');
          toggleIcon.textContent = '▼';
          
          try {
            const children = await chrome.bookmarks.getChildren(folderId);
            const folderItems = folderContent.querySelector('.folder-items');
            folderItems.innerHTML = '';
            
            for (const child of children) {
              const childPath = await this.getBookmarkPath(child.id);
              folderItems.innerHTML += this.createBookmarkItem(child, childPath, this.searchInput.value.trim());
            }
            
            // 为新添加的项目绑定事件
            this.bindEvents();
          } catch (error) {
            folderContent.innerHTML = '<div class="error">加载失败</div>';
          }
        }
      });
    });
  }

  bindPaginationEvents(totalPages) {
    const buttons = this.resultsDiv.querySelectorAll('.page-btn');
    buttons.forEach(button => {
      button.addEventListener('click', async () => {
        const action = button.dataset.action;
        switch (action) {
          case 'first':
            this.currentPage = 1;
            break;
          case 'prev':
            this.currentPage = Math.max(1, this.currentPage - 1);
            break;
          case 'next':
            this.currentPage = Math.min(totalPages, this.currentPage + 1);
            break;
          case 'last':
            this.currentPage = totalPages;
            break;
        }
        
        // 先滚动到顶部，再更新内容
        this.scrollToTop();
        await this.updateResultsList(this.searchInput.value.trim());
      });
    });
  }

  scrollToTop() {
    // 直接滚动结果区域
    this.resultsDiv.scrollTo({
      top: 0,
      behavior: 'smooth'
    });

    // 同时滚动父容器
    const container = this.resultsDiv.closest('.container');
    if (container) {
      container.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }

    // 滚动整个文档
    document.body.scrollTo({
      top: 0,
      behavior: 'smooth'
    });

    // 兜底方案：直接设置滚动位置
    this.resultsDiv.scrollTop = 0;
    if (container) container.scrollTop = 0;
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
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
    const isFolder = !bookmark.url;
    
    // 返回 HTML 字符串而不是 DOM 元素
    return `
      <div class="bookmark-item ${isFolder ? 'folder-item' : 'bookmark-item'}">
        <div class="item-header">
          <div class="item-icon">${isFolder ? '📁' : '🔖'}</div>
          <div class="item-content">
            <div class="item-title">${this.highlight(bookmark.title, query)}</div>
            <div class="item-path">${path}</div>
            ${bookmark.url ? `
              <div class="item-url">${this.highlight(bookmark.url, query)}</div>
            ` : ''}
          </div>
          ${bookmark.url ? `
            <div class="item-actions">
              <button class="item-action" data-action="open" title="打开" data-url="${bookmark.url}">🔗</button>
              <button class="item-action" data-action="share" title="分享" data-url="${bookmark.url}" data-title="${bookmark.title}">📤</button>
            </div>
          ` : `
            <button class="folder-toggle" title="展开/收起" data-id="${bookmark.id}">
              <span class="toggle-icon">▶</span>
            </button>
          `}
        </div>
        ${isFolder ? `
          <div class="folder-content" data-folder-id="${bookmark.id}">
            <div class="folder-items"></div>
          </div>
        ` : ''}
      </div>
    `;
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
    this.pageSize = 5; // 每页显示数量
    this.currentPage = 1;
    this.recentBookmarks = [];
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
    this.recentBookmarks = stats.recent.sort((a, b) => b.dateAdded - a.dateAdded);
    this.updateRecentBookmarksList();

    // 更新重复书签列表
    this.updateDuplicateBookmarks(stats.duplicates);
  }

  updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  }

  updateRecentBookmarksList() {
    const recentList = document.getElementById('recentBookmarks');
    if (!recentList) return;

    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    const pageItems = this.recentBookmarks.slice(startIndex, endIndex);
    const totalPages = Math.ceil(this.recentBookmarks.length / this.pageSize);

    recentList.innerHTML = `
      <div class="recent-items">
        ${pageItems.map(bookmark => `
          <div class="recent-item">
            <div class="item-icon">🔖</div>
            <div class="item-content">
              <div class="item-title">${this.escapeHtml(bookmark.title)}</div>
              <div class="item-url">${this.escapeHtml(bookmark.url)}</div>
              <div class="item-time">${this.formatDate(bookmark.dateAdded)}</div>
            </div>
            <div class="item-actions">
              <button class="item-action" data-action="open" title="打开">🔗</button>
              <button class="item-action" data-action="share" title="分享">📤</button>
            </div>
          </div>
        `).join('')}
      </div>
      <div class="pagination">
        <button class="page-btn first" data-action="first" ${this.currentPage === 1 ? 'disabled' : ''}>
          ⏮
        </button>
        <button class="page-btn prev" data-action="prev" ${this.currentPage === 1 ? 'disabled' : ''}>
          ◀
        </button>
        <span class="page-info">${this.currentPage}/${totalPages}</span>
        <button class="page-btn next" data-action="next" ${this.currentPage === totalPages ? 'disabled' : ''}>
          ▶
        </button>
        <button class="page-btn last" data-action="last" ${this.currentPage === totalPages ? 'disabled' : ''}>
          ⏭
        </button>
      </div>
    `;

    // 绑定分页按钮事件
    this.bindPaginationEvents(recentList, totalPages);
    // 绑定操作按钮事件
    this.bindRecentItemActions(recentList);
  }

  bindPaginationEvents(container, totalPages) {
    const buttons = container.querySelectorAll('.page-btn');
    buttons.forEach(button => {
      button.addEventListener('click', () => {
        const action = button.dataset.action;
        switch (action) {
          case 'first':
            this.currentPage = 1;
            break;
          case 'prev':
            this.currentPage = Math.max(1, this.currentPage - 1);
            break;
          case 'next':
            this.currentPage = Math.min(totalPages, this.currentPage + 1);
            break;
          case 'last':
            this.currentPage = totalPages;
            break;
        }
        
        // 更新列表
        this.updateRecentBookmarksList();
        
        // 平滑滚动到顶部
        this.scrollToTop(container);
      });
    });
  }

  scrollToTop(container) {
    // 滚动统计面板内容
    const statsContent = container.closest('.stats-content');
    if (statsContent) {
      statsContent.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
      
      // 兜底方案
      statsContent.scrollTop = 0;
    }

    // 滚动整个面板
    const statsPanel = container.closest('.stats-panel');
    if (statsPanel) {
      statsPanel.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
      statsPanel.scrollTop = 0;
    }
  }

  bindRecentItemActions(container) {
    container.querySelectorAll('.item-action').forEach(button => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        const item = button.closest('.recent-item');
        const url = item.querySelector('.item-url').textContent;
        const action = button.dataset.action;

        if (action === 'open') {
          chrome.tabs.create({ url });
        } else if (action === 'share') {
          this.showQRCode(url, item.querySelector('.item-title').textContent);
        }
      });
    });
  }

  showQRCode(url, title) {
    // 显示二维码弹窗
    const modal = document.createElement('div');
    modal.className = 'qr-modal show';
    modal.innerHTML = `
      <div class="qr-content">
        <div class="qr-header">
          <h3>分享链接</h3>
          <button class="close-qr">×</button>
        </div>
        <div class="qr-code">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}" 
               alt="QR Code" 
               title="${title}">
        </div>
        <div class="qr-title">${title}</div>
        <div class="qr-url">${url}</div>
      </div>
    `;

    document.body.appendChild(modal);

    // 绑定关闭事件
    const closeBtn = modal.querySelector('.close-qr');
    closeBtn.addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
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

// 初始化工具栏控制
class ToolbarControls {
  constructor() {
    this.statsBtn = document.querySelector('.stats-btn');
    this.minimizeBtn = document.querySelector('.minimize-btn');
    this.closeBtn = document.querySelector('.close-btn');
    
    this.init();
  }

  init() {
    if (this.statsBtn) {
      this.statsBtn.addEventListener('click', () => {
        const statsPanel = document.getElementById('statsPanel');
        if (statsPanel) {
          statsPanel.classList.toggle('show');
          if (statsPanel.classList.contains('show')) {
            new BookmarkStats().loadStats();
          }
        }
      });
    }

    if (this.minimizeBtn) {
      this.minimizeBtn.addEventListener('click', () => {
        chrome.windows.getCurrent(window => {
          chrome.windows.update(window.id, { state: 'minimized' });
        });
      });
    }

    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => {
        window.close();
      });
    }
  }
}

// 初始化所有功能
document.addEventListener('DOMContentLoaded', () => {
  new BookmarkSearch();
  new ToolbarControls();
  new WatermarkAnimation();
}); 