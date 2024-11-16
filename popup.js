class BookmarkSearch {
  constructor() {
    console.log('Initializing BookmarkSearch...');
    this.searchInput = document.getElementById('searchInput');
    this.resultsDiv = document.getElementById('results');
    this.showFolders = document.getElementById('showFolders');
    this.sortBy = document.getElementById('sortBy');
    
    console.log('Elements found:', {
      searchInput: this.searchInput,
      resultsDiv: this.resultsDiv,
      showFolders: this.showFolders,
      sortBy: this.sortBy
    });

    this.pageSize = 5;
    this.currentPage = 1;
    this.searchResults = [];

    this.init();

    // 初始化工具栏按钮
    this.initToolbarButtons();

    // 创建tooltip元素
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'tooltip';
    document.body.appendChild(this.tooltip);
    
    // 绑定tooltip事件
    this.handleTooltip = this.handleTooltip.bind(this);

    // 移除搜索框的历史记录相关事件
    this.searchHistory = [];
    this.loadSearchHistory();
    this.historyPageSize = 5;
    this.historyCurrentPage = 1;
    
    // 初始化历史按钮
    this.initHistoryButton();
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

  initToolbarButtons() {
    // 统计按钮
    const statsBtn = document.querySelector('.stats-btn');
    if (statsBtn) {
      statsBtn.addEventListener('click', () => {
        // 隐藏主搜索界面
        document.querySelector('.container').style.display = 'none';
        
        // 显示统计页面
        const statsPage = document.createElement('div');
        statsPage.className = 'stats-page';
        statsPage.innerHTML = `
          <div class="stats-header">
            <h1>收藏夹统计</h1>
            <div class="header-actions">
              <button class="check-links-btn">
                <span class="btn-icon">🔍</span>
                检查失效链接
              </button>
              <button class="back-btn">×</button>
            </div>
          </div>
          <div class="stats-content">
            <div class="stats-cards">
              <div class="stats-card">
                <div class="card-icon">📚</div>
                <div class="card-label">总收藏数</div>
                <div class="card-value" id="totalBookmarks">-</div>
              </div>
              <div class="stats-card">
                <div class="card-icon">📁</div>
                <div class="card-label">文件夹数</div>
                <div class="card-value" id="totalFolders">-</div>
              </div>
              <div class="stats-card">
                <div class="card-icon">⚠️</div>
                <div class="card-label">重复链接</div>
                <div class="card-value" id="duplicateLinks">-</div>
              </div>
            </div>
            <div class="stats-details">
              <div class="stats-section">
                <h2>重复的链接</h2>
                <div id="duplicatesList"></div>
              </div>
            </div>
          </div>
        `;
        document.body.appendChild(statsPage);

        // 加载统计数据
        this.loadStats();

        // 绑定返回按钮事件
        statsPage.querySelector('.back-btn').addEventListener('click', () => {
          statsPage.remove();
          document.querySelector('.container').style.display = 'flex';
        });

        // 绑定检查链接按钮事件
        statsPage.querySelector('.check-links-btn').addEventListener('click', () => {
          this.checkBrokenLinks();
        });
      });
    }
  }

  async loadStats() {
    try {
      const bookmarks = await chrome.bookmarks.getTree();
      const stats = this.analyzeBookmarks(bookmarks);

      // 更新统计数据
      document.getElementById('totalBookmarks').textContent = stats.total;
      document.getElementById('totalFolders').textContent = stats.folders;
      document.getElementById('duplicateLinks').textContent = stats.duplicates.size;

      // 显示重复链接列表
      this.showDuplicatesList(stats.duplicates);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }

  async showStatsPanel() {
    console.log('Showing stats panel'); // 调试日志
    const statsPanel = document.getElementById('statsPanel');
    if (!statsPanel) {
      console.error('Stats panel not found');
      return;
    }

    // 显示面板
    statsPanel.classList.add('show');
    statsPanel.style.display = 'flex';

    try {
      statsPanel.innerHTML = '<div class="loading">加载统计信息...</div>';
      
      const bookmarks = await chrome.bookmarks.getTree();
      const stats = this.analyzeBookmarks(bookmarks);
      
      statsPanel.innerHTML = `
        <div class="stats-header">
          <h2>收藏夹统计</h2>
          <div class="stats-actions">
            <button class="check-links-btn">
              <span class="btn-icon">🔍</span>
              <span class="btn-text">检查失效链接</span>
            </button>
            <button class="close-stats">×</button>
          </div>
        </div>
        <div class="stats-content">
          <div class="stats-summary">
            <div class="stat-item">
              <div class="stat-icon">📚</div>
              <div class="stat-label">总收藏数</div>
              <div class="stat-value">${stats.total}</div>
            </div>
            <div class="stat-item">
              <div class="stat-icon">📁</div>
              <div class="stat-label">文件夹数</div>
              <div class="stat-value">${stats.folders}</div>
            </div>
            <div class="stat-item">
              <div class="stat-icon">⚠️</div>
              <div class="stat-label">重复链接</div>
              <div class="stat-value">${stats.duplicates.size}</div>
            </div>
          </div>
          
          <div class="stats-details">
            <div class="stats-section">
              <h3>🔄 重复的链接</h3>
              <div class="duplicate-list">
                ${this.renderDuplicatesList(stats.duplicates)}
              </div>
            </div>
          </div>
        </div>
      `;

      // 绑定关闭按钮事件
      const closeStatsBtn = statsPanel.querySelector('.close-stats');
      if (closeStatsBtn) {
        closeStatsBtn.addEventListener('click', () => {
          statsPanel.classList.remove('show');
          statsPanel.style.display = 'none';
        });
      }

      // 绑定检查链接按钮事件
      const checkLinksBtn = statsPanel.querySelector('.check-links-btn');
      if (checkLinksBtn) {
        checkLinksBtn.addEventListener('click', () => this.checkBrokenLinks());
      }

    } catch (error) {
      console.error('Failed to load stats:', error);
      statsPanel.innerHTML = '<div class="error">加载统计信息失败</div>';
    }
  }

  renderDuplicatesList(duplicates) {
    let html = '';
    for (const [url, items] of duplicates.entries()) {
      if (items.length > 1) {
        html += `
          <div class="duplicate-group">
            <div class="duplicate-url">${url}</div>
            ${items.map(item => `
              <div class="duplicate-item">
                <div class="item-title">${item.title}</div>
                <div class="item-path">${this.getBookmarkPath(item.id)}</div>
                <div class="item-actions">
                  <button class="item-btn" data-action="open" title="打开">🔗</button>
                  <button class="item-btn" data-action="delete" title="删除">🗑️</button>
                </div>
              </div>
            `).join('')}
          </div>
        `;
      }
    }
    return html || '<div class="empty-message">没有发现重复的链接</div>';
  }

  async checkBrokenLinks() {
    const statsPanel = document.getElementById('statsPanel');
    const statsContent = statsPanel.querySelector('.stats-content');
    
    try {
      // 更新界面显示检查状态
      statsContent.innerHTML = `
        <div class="check-status">
          <div class="progress-info">正在检查链接...</div>
          <div class="progress-bar">
            <div class="progress-fill"></div>
          </div>
          <div class="progress-text">0%</div>
        </div>
        <div class="broken-links-list"></div>
      `;

      const progressFill = statsContent.querySelector('.progress-fill');
      const progressText = statsContent.querySelector('.progress-text');
      const progressInfo = statsContent.querySelector('.progress-info');
      const brokenLinksList = statsContent.querySelector('.broken-links-list');

      // 获取所有书签
      const bookmarks = await this.getAllBookmarks();
      const total = bookmarks.length;
      let checked = 0;
      let brokenLinks = [];

      // 分批检查链接
      const batchSize = 5;
      for (let i = 0; i < bookmarks.length; i += batchSize) {
        const batch = bookmarks.slice(i, i + batchSize);
        const results = await Promise.all(batch.map(bookmark => this.checkLink(bookmark)));
        
        checked += batch.length;
        brokenLinks = brokenLinks.concat(results.filter(result => result.broken));

        // 更新进度
        const progress = (checked / total * 100).toFixed(1);
        progressFill.style.width = `${progress}%`;
        progressText.textContent = `${progress}%`;
        progressInfo.textContent = `正在检查链接 (${checked}/${total})`;

        // 更新失效链接列表
        this.updateBrokenLinksList(brokenLinksList, brokenLinks);

        // 给浏览器喘息的机会
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // 检查完成
      progressInfo.textContent = `检查完成，发现 ${brokenLinks.length} 个失效链接`;

    } catch (error) {
      console.error('Failed to check links:', error);
      statsContent.innerHTML = '<div class="error">检查失效链接时出错</div>';
    }
  }

  async getAllBookmarks() {
    const bookmarks = [];
    
    const processNode = (node) => {
      if (node.url) {
        bookmarks.push(node);
      }
      if (node.children) {
        node.children.forEach(processNode);
      }
    };

    const tree = await chrome.bookmarks.getTree();
    tree.forEach(processNode);
    return bookmarks;
  }

  async checkLink(bookmark) {
    try {
      const response = await fetch(bookmark.url, {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-cache',
      });
      
      return {
        bookmark,
        broken: !response.ok,
        status: response.status
      };
    } catch (error) {
      return {
        bookmark,
        broken: true,
        error: error.message
      };
    }
  }

  updateBrokenLinksList(container, brokenLinks) {
    container.innerHTML = brokenLinks.length ? brokenLinks.map(item => `
      <div class="broken-link-item">
        <div class="broken-link-content">
          <div class="broken-link-title">${item.bookmark.title}</div>
          <div class="broken-link-url">${item.bookmark.url}</div>
          ${item.error ? `<div class="broken-link-error">错误: ${item.error}</div>` : ''}
        </div>
        <div class="broken-link-actions">
          <button class="link-action" data-action="open" data-url="${item.bookmark.url}" title="打开链接">🔗</button>
          <button class="link-action" data-action="delete" data-id="${item.bookmark.id}" title="删除书签">🗑️</button>
        </div>
      </div>
    `).join('') : '<div class="empty-message">未现失效链接</div>';

    // 绑定操作按钮事件
    container.querySelectorAll('.link-action').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const action = btn.dataset.action;
        if (action === 'open') {
          chrome.tabs.create({ url: btn.dataset.url });
        } else if (action === 'delete') {
          if (confirm('确定要删除这个失效链接吗？')) {
            await chrome.bookmarks.remove(btn.dataset.id);
            btn.closest('.broken-link-item').remove();
          }
        }
      });
    });
  }

  analyzeBookmarks(nodes) {
    let stats = {
      total: 0,
      folders: 0,
      duplicates: new Map(),
      urls: new Set()
    };

    const processNode = (node) => {
      if (node.url) {
        stats.total++;
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
    return stats;
  }

  async handleSearch() {
    const query = this.searchInput.value.trim();
    
    try {
      console.log('Searching for:', query);
      
      // 显示加状态
      this.resultsDiv.innerHTML = '<div class="loading">搜索中...</div>';
      
      if (!query) {
        this.resultsDiv.innerHTML = '<div class="empty-state">请输入搜索关键词</div>';
        return;
      }

      // 修改这里：直接传入查询词
      const bookmarks = await chrome.bookmarks.search(query);

      // 过滤结果
      let filteredBookmarks = bookmarks.filter(bookmark => 
        this.showFolders.checked || bookmark.url  // 如果显示文件夹，或者是书签
      );

      filteredBookmarks = this.sortBookmarks(filteredBookmarks, this.sortBy.value, query);
      this.searchResults = filteredBookmarks;

      if (filteredBookmarks.length === 0) {
        this.resultsDiv.innerHTML = '<div class="empty-state">未找到相关结果</div>';
        return;
      }

      // 保存搜索历史
      if (query) {
        await this.saveSearchHistory(query);
      }

      const startIndex = (this.currentPage - 1) * this.pageSize;
      const endIndex = startIndex + this.pageSize;
      const pageItems = this.searchResults.slice(startIndex, endIndex);
      const totalPages = Math.ceil(this.searchResults.length / this.pageSize);

      // 构建搜索结果
      let resultsHtml = `
        <div class="results-header">找 ${this.searchResults.length} 个结果</div>
        <div class="results-list">
          ${(await Promise.all(pageItems.map(async bookmark => {
            const path = await this.getBookmarkPath(bookmark.id);
            return this.createBookmarkItem(bookmark, path, query);
          }))).join('')}
        </div>
        <div class="pagination">
          <button class="page-btn first" data-action="first" ${this.currentPage === 1 ? 'disabled' : ''}>⏮</button>
          <button class="page-btn prev" data-action="prev" ${this.currentPage === 1 ? 'disabled' : ''}>◀</button>
          <span class="page-info">${this.currentPage}/${totalPages}</span>
          <button class="page-btn next" data-action="next" ${this.currentPage === totalPages ? 'disabled' : ''}>▶</button>
          <button class="page-btn last" data-action="last" ${this.currentPage === totalPages ? 'disabled' : ''}>⏭</button>
        </div>
      `;

      this.resultsDiv.innerHTML = resultsHtml;
      this.bindItemEvents(this.resultsDiv.querySelector('.results-list'));
      this.bindPaginationEvents(this.resultsDiv.querySelector('.pagination'), totalPages);

    } catch (error) {
      console.error('Search error:', error);
      this.resultsDiv.innerHTML = `<div class="error">搜索出错: ${error.message}</div>`;
    }
  }

  createBookmarkItem(bookmark, path, query) {
    const isFolder = !bookmark.url;
    
    return `
      <div class="bookmark-item ${isFolder ? 'folder-item' : ''}" data-id="${bookmark.id}">
        <div class="item-header">
          <div class="item-icon">${isFolder ? '📁' : '🔖'}</div>
          <div class="item-content">
            <div class="item-title" data-full-text="${this.escapeHtml(bookmark.title)}">
              ${this.highlight(bookmark.title, query)}
            </div>
            <div class="item-path">${path}</div>
            ${bookmark.url ? `
              <div class="item-url hidden" data-url="${this.escapeHtml(bookmark.url)}">
                ${this.highlight(bookmark.url, query)}
              </div>
              <button class="view-url-btn">查看链接</button>
            ` : ''}
          </div>
          ${bookmark.url ? `
            <div class="item-actions">
              <button class="item-action" data-action="open" data-url="${this.escapeHtml(bookmark.url)}" title="打开">🔗</button>
              <button class="item-action" data-action="share" data-url="${this.escapeHtml(bookmark.url)}" data-title="${this.escapeHtml(bookmark.title)}" title="分享">📤</button>
            </div>
          ` : `
            <button class="folder-toggle" data-id="${bookmark.id}" title="展开/收起">
              <span class="toggle-icon">▶</span>
            </button>
          `}
        </div>
        ${isFolder ? `
          <div class="folder-content">
            <div class="folder-items"></div>
          </div>
        ` : ''}
      </div>
    `;
  }

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  checkTitleTruncation(titleElement) {
    if (titleElement.scrollHeight > titleElement.clientHeight) {
      titleElement.classList.add('truncated');
    }
  }

  handleTooltip(e) {
    const titleElement = e.target.closest('.item-title');
    if (!titleElement) return;

    const fullText = titleElement.dataset.fullText;
    if (!fullText) return;

    // 获取元素位置
    const rect = titleElement.getBoundingClientRect();
    
    // 设置tooltip位置和内容
    this.tooltip.textContent = fullText;
    this.tooltip.style.left = `${rect.left}px`;
    this.tooltip.style.top = `${rect.bottom + 8}px`;
    this.tooltip.classList.add('show');

    // 确保tooltip不超出窗口
    const tooltipRect = this.tooltip.getBoundingClientRect();
    if (tooltipRect.right > window.innerWidth) {
      this.tooltip.style.left = `${window.innerWidth - tooltipRect.width - 8}px`;
    }
    if (tooltipRect.bottom > window.innerHeight) {
      this.tooltip.style.top = `${rect.top - tooltipRect.height - 8}px`;
    }
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

  formatDate(timestamp) {
    const date = new Date(timestamp);
    
    // 始终显示完整的年月日时��
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false // 使用24小时制
    }).replace(/\//g, '-'); // 斜杠替换为横杠
  }

  showQRCode(url, title) {
    // 创建二维码弹窗
    const modal = document.createElement('div');
    modal.className = 'qr-modal';
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

    // 添加到文档中
    document.body.appendChild(modal);

    // 添加显示动画
    requestAnimationFrame(() => {
      modal.classList.add('show');
    });

    // 绑定关闭事件
    const closeBtn = modal.querySelector('.close-qr');
    const closeModal = () => {
      modal.classList.remove('show');
      setTimeout(() => modal.remove(), 300);
    };

    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeModal();
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });

    // ESC 键关闭
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeModal();
      }
    });
  }

  bindItemEvents(container) {
    // 绑定打开链接事件
    container.querySelectorAll('[data-action="open"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const url = btn.dataset.url;
        if (url) chrome.tabs.create({ url });
      });
    });

    // 绑定分享事件
    container.querySelectorAll('[data-action="share"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const url = btn.dataset.url;
        const title = btn.dataset.title;
        if (url) this.showQRCode(url, title);
      });
    });

    // 绑定文件夹展开/收起事件
    container.querySelectorAll('.folder-toggle').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const folderId = btn.dataset.id;
        const folderItem = btn.closest('.folder-item');
        const folderContent = folderItem.querySelector('.folder-content');
        const folderItems = folderContent.querySelector('.folder-items');
        const toggleIcon = btn.querySelector('.toggle-icon');

        if (folderItem.classList.contains('expanded')) {
          // 收起文件夹
          folderItem.classList.remove('expanded');
          toggleIcon.textContent = '▶';
          folderContent.style.display = 'none';
          folderItems.innerHTML = '';
          return;
        }

        // 展开文件夹
        folderItem.classList.add('expanded');
        toggleIcon.textContent = '▼';
        folderContent.style.display = 'block';
        folderItems.innerHTML = '<div class="loading">加载中...</div>';

        try {
          const children = await chrome.bookmarks.getChildren(folderId);
          folderItems.innerHTML = '';

          if (children.length === 0) {
            folderItems.innerHTML = '<div class="empty-folder">空文件夹</div>';
            return;
          }

          // 加载子项目
          for (const child of children) {
            try {
              const childPath = await this.getBookmarkPath(child.id);
              const childItem = document.createElement('div');
              childItem.className = child.url ? 'bookmark-item' : 'bookmark-item folder-item';
              childItem.innerHTML = `
                <div class="item-header">
                  <div class="item-icon">${child.url ? '🔖' : '📁'}</div>
                  <div class="item-content">
                    <div class="item-title">${child.title}</div>
                    <div class="item-path">${childPath}</div>
                    ${child.url ? `
                      <div class="item-url hidden" data-url="${child.url}">
                        ${child.url}
                      </div>
                      <button class="view-url-btn">查看链接</button>
                    ` : ''}
                  </div>
                  ${child.url ? `
                    <div class="item-actions">
                      <button class="item-action" data-action="open" data-url="${child.url}" title="打开">🔗</button>
                      <button class="item-action" data-action="share" data-url="${child.url}" data-title="${child.title}" title="分享">📤</button>
                    </div>
                  ` : `
                    <button class="folder-toggle" data-id="${child.id}" title="展开/收起">
                      <span class="toggle-icon">▶</span>
                    </button>
                  `}
                </div>
                ${!child.url ? `
                  <div class="folder-content">
                    <div class="folder-items"></div>
                  </div>
                ` : ''}
              `;
              
              folderItems.appendChild(childItem);
            } catch (error) {
              console.error('Error processing child:', error);
            }
          }

          // 为新添加的子项目绑定事件
          this.bindItemEvents(folderItems);

        } catch (error) {
          console.error('Failed to load folder contents:', error);
          folderItems.innerHTML = '<div class="error">加载失败</div>';
        }
      });
    });

    // 绑定书签项点击事件
    container.querySelectorAll('.bookmark-item:not(.folder-item)').forEach(item => {
      item.addEventListener('click', (e) => {
        if (!e.target.closest('.item-actions')) {
          const url = item.querySelector('.item-url')?.textContent;
          if (url) chrome.tabs.create({ url });
        }
      });
    });

    // 绑定查看链接按钮事件
    container.querySelectorAll('.view-url-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const urlDiv = btn.previousElementSibling;
        const isHidden = urlDiv.classList.contains('hidden');
        
        if (isHidden) {
          urlDiv.classList.remove('hidden');
          btn.textContent = '隐藏链接';
        } else {
          urlDiv.classList.add('hidden');
          btn.textContent = '查看链接';
        }
      });
    });

    // 绑定tooltip事件
    container.querySelectorAll('.item-title').forEach(title => {
      title.addEventListener('mouseenter', this.handleTooltip);
      title.addEventListener('mouseleave', () => {
        this.tooltip.classList.remove('show');
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

  bindPaginationEvents(container, totalPages) {
    container.querySelectorAll('.page-btn').forEach(button => {
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
        this.handleSearch();
      });
    });
  }

  // 加载搜索历史
  async loadSearchHistory() {
    try {
      const result = await chrome.storage.local.get('searchHistory');
      this.searchHistory = result.searchHistory || [];
      console.log('Loaded search history:', this.searchHistory);  // 调试日志
    } catch (error) {
      console.error('Failed to load search history:', error);
      this.searchHistory = [];
    }
  }

  // 保存搜索历史
  async saveSearchHistory(query) {
    if (!query?.trim()) return;  // 添加可选链操作符
    
    try {
      // 确保 searchHistory 是数组
      if (!Array.isArray(this.searchHistory)) {
        this.searchHistory = [];
      }

      // 查找是否已存在该搜索词
      const existingIndex = this.searchHistory.findIndex(item => 
        item?.query?.toLowerCase() === query.toLowerCase()  // 添加安全检查
      );
      
      if (existingIndex !== -1) {
        // 如果存在，增加计数
        this.searchHistory[existingIndex].count += 1;
        this.searchHistory[existingIndex].lastSearchTime = Date.now();
      } else {
        // 如果不存在，添加新记录
        this.searchHistory.unshift({
          query: query,
          count: 1,
          lastSearchTime: Date.now()
        });
      }
      
      // 限制数量为10条
      this.searchHistory = this.searchHistory.slice(0, 10);
      
      await chrome.storage.local.set({ searchHistory: this.searchHistory });
      console.log('Saved search history:', this.searchHistory);
    } catch (error) {
      console.error('Failed to save search history:', error);
    }
  }

  // 修改历史按钮初始化方法
  initHistoryButton() {
    // 创建历史记录按钮
    const historyBtn = document.createElement('button');
    historyBtn.className = 'toolbar-btn history-btn';
    historyBtn.innerHTML = '📜';
    historyBtn.title = '搜索历史';
    
    // 将按钮添加到工具栏
    const toolbarRight = document.querySelector('.window-controls');
    if (toolbarRight) {
      toolbarRight.insertBefore(historyBtn, toolbarRight.firstChild);
    }

    // 绑定点击事件 - 切换到历史页面
    historyBtn.addEventListener('click', () => {
      this.showHistoryPage();
    });
  }

  // 添加显示历史页面方法
  showHistoryPage() {
    document.querySelector('.container').style.display = 'none';
    
    const historyPage = document.createElement('div');
    historyPage.className = 'history-page';
    historyPage.innerHTML = `
      <div class="title-bar">
        <div class="title-content">
          <button class="back-btn">◀</button>
          <span>搜索历史</span>
        </div>
      </div>
      <div class="history-content">
        ${this.searchHistory.length === 0 ? 
          '<div class="empty-history">暂无搜索历史</div>' :
          `<div class="history-list">
            ${this.searchHistory.map(item => `
              <div class="history-item">
                <div class="history-item-content">
                  <span class="history-query">${this.escapeHtml(item.query)}</span>
                  <div class="history-meta">
                    <span class="history-count" title="搜索次数">🔍 ${item.count}次</span>
                    <span class="history-time" title="最后搜索时间">
                      ${this.formatTime(item.lastSearchTime)}
                    </span>
                  </div>
                </div>
                <div class="history-actions">
                  <button class="history-search" title="搜索">🔍</button>
                  <button class="history-delete" title="删除">×</button>
                </div>
              </div>
            `).join('')}
          </div>`
        }
      </div>
    `;
    
    document.body.appendChild(historyPage);

    historyPage.querySelector('.back-btn').addEventListener('click', () => {
      historyPage.remove();
      document.querySelector('.container').style.display = 'flex';
    });

    this.bindHistoryPageEvents(historyPage);
  }

  // 添加时间格式化方法
  formatTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    
    // 小于1分钟
    if (diff < 60000) {
      return '刚刚';
    }
    // 小于1小时
    if (diff < 3600000) {
      return `${Math.floor(diff / 60000)}分钟前`;
    }
    // 小于24小时
    if (diff < 86400000) {
      return `${Math.floor(diff / 3600000)}小时前`;
    }
    // 小于7天
    if (diff < 604800000) {
      return `${Math.floor(diff / 86400000)}天前`;
    }
    
    // 超过7天显示具体日期
    return new Date(timestamp).toLocaleDateString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // 修改历史页面事件绑定方法
  bindHistoryPageEvents(historyPage) {
    historyPage.querySelectorAll('.history-item').forEach(item => {
      const query = item.querySelector('.history-query').textContent;
      
      // 搜索按钮事件
      item.querySelector('.history-search').addEventListener('click', () => {
        this.searchInput.value = query;
        this.handleSearch();
        historyPage.remove();
        document.querySelector('.container').style.display = 'flex';
      });

      // 修改删除按钮事件
      item.querySelector('.history-delete').addEventListener('click', async () => {
        // 使用 query 来查找和过滤历史记录
        this.searchHistory = this.searchHistory.filter(historyItem => 
          historyItem.query !== query
        );
        
        await chrome.storage.local.set({ searchHistory: this.searchHistory });
        
        // 如果没有历史记录了，显示空状态
        if (this.searchHistory.length === 0) {
          historyPage.querySelector('.history-content').innerHTML = 
            '<div class="empty-history">暂无搜索历史</div>';
        } else {
          // 否则移除当前项
          item.remove();
        }
      });
    });
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
    
    // 显示加载状
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

    // ���新重复书签列表
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
      
      // 兜方案
      statsContent.scrollTop = 0;
    }

    // 滚动整个板
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
    // 创建二维码弹
    const modal = document.createElement('div');
    modal.className = 'qr-modal';
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

    // 添加到文档中
    document.body.appendChild(modal);

    // 添加显示动画
    requestAnimationFrame(() => {
      modal.classList.add('show');
    });

    // 绑定关闭事件
    const closeBtn = modal.querySelector('.close-qr');
    const closeModal = () => {
      modal.classList.remove('show');
      setTimeout(() => modal.remove(), 300);
    };

    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeModal();
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });

    // ESC 键关闭
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeModal();
      }
    });
  }

  updateDuplicateBookmarks(duplicates) {
    const container = document.getElementById('duplicateBookmarks');
    if (!container) return;

    const duplicateItems = Array.from(duplicates.entries())
      .filter(([_, items]) => items.length > 1);

    if (duplicateItems.length === 0) {
      container.innerHTML = '<div class="empty-message">没有发重复的书签</div>';
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
  console.log('DOM loaded, initializing search...');
  new BookmarkSearch();
  new ToolbarControls();
  new WatermarkAnimation();
}); 

// 添加虚拟列表
class VirtualList {
  constructor(options) {
    this.container = options.container;
    this.itemHeight = options.itemHeight;
    this.buffer = options.buffer || 5; // 上缓冲区量
    this.items = [];
    this.visibleItems = new Map();
    this.scrollTop = 0;
    this.containerHeight = 0;
    this.createItemFn = options.createItem;
    
    this.init();
  }

  init() {
    // 创建滚动容器
    this.scrollContainer = document.createElement('div');
    this.scrollContainer.className = 'virtual-scroll-container';
    this.scrollContainer.style.position = 'relative';
    this.scrollContainer.style.overflow = 'auto';
    this.scrollContainer.style.height = '100%';

    // 创建内容容器
    this.content = document.createElement('div');
    this.content.className = 'virtual-content';
    this.content.style.position = 'relative';

    this.scrollContainer.appendChild(this.content);
    this.container.appendChild(this.scrollContainer);

    // 绑定滚动事件
    this.scrollContainer.addEventListener('scroll', this.onScroll.bind(this));
    // 监听容器大小变化
    new ResizeObserver(this.onResize.bind(this)).observe(this.scrollContainer);
  }

  setItems(items) {
    this.items = items;
    this.content.style.height = `${items.length * this.itemHeight}px`;
    this.render();
  }

  onScroll() {
    this.scrollTop = this.scrollContainer.scrollTop;
    this.render();
  }

  onResize(entries) {
    this.containerHeight = entries[0].contentRect.height;
    this.render();
  }

  render() {
    const startIndex = Math.max(0, Math.floor(this.scrollTop / this.itemHeight) - this.buffer);
    const endIndex = Math.min(
      this.items.length,
      Math.ceil((this.scrollTop + this.containerHeight) / this.itemHeight) + this.buffer
    );

    // 移除再可见的项
    for (const [index, element] of this.visibleItems.entries()) {
      if (index < startIndex || index >= endIndex) {
        element.remove();
        this.visibleItems.delete(index);
      }
    }

    // 添加新的可见项
    for (let i = startIndex; i < endIndex; i++) {
      if (!this.visibleItems.has(i) && i < this.items.length) {
        const item = this.createItemFn(this.items[i], i);
        item.style.position = 'absolute';
        item.style.top = `${i * this.itemHeight}px`;
        item.style.width = '100%';
        this.content.appendChild(item);
        this.visibleItems.set(i, item);
      }
    }
  }
} 

// 水印动画类
class WatermarkAnimation {
  constructor() {
    this.watermark = document.querySelector('.watermark');
    if (!this.watermark) return;

    // 初始位置 - 随机位置
    this.x = Math.random() * (window.innerWidth - 100);
    this.y = Math.random() * (window.innerHeight - 30);
    
    // 移动速度
    this.dx = 2;
    this.dy = 2;
    
    // 颜色配置
    this.colors = [
      'rgba(0, 120, 212, 0.5)',    // 蓝色
      'rgba(16, 124, 16, 0.5)',    // 绿色
      'rgba(200, 0, 100, 0.5)',    // 粉色
      'rgba(134, 0, 179, 0.5)',    // 紫色
      'rgba(216, 59, 1, 0.5)',     // 橙色
      'rgba(0, 153, 153, 0.5)'     // 青色
    ];
    this.currentColorIndex = 0;

    // 设置初始样式
    this.watermark.style.position = 'fixed';
    this.watermark.style.zIndex = '10000';
    this.watermark.style.transition = 'color 0.3s ease';
    this.watermark.style.userSelect = 'none';
    this.watermark.style.pointerEvents = 'none';
    this.watermark.style.color = this.colors[0];

    // 开始动画
    this.animate();
  }

  animate() {
    // 更新位置
    this.x += this.dx;
    this.y += this.dy;

    // 检查边界碰撞
    const maxX = window.innerWidth - this.watermark.offsetWidth;
    const maxY = window.innerHeight - this.watermark.offsetHeight;

    // 水平碰撞
    if (this.x <= 0 || this.x >= maxX) {
      this.dx = -this.dx;
      this.x = Math.max(0, Math.min(this.x, maxX));
      this.changeColor();
      this.addBounceEffect('x');
    }

    // 垂直碰撞
    if (this.y <= 0 || this.y >= maxY) {
      this.dy = -this.dy;
      this.y = Math.max(0, Math.min(this.y, maxY));
      this.changeColor();
      this.addBounceEffect('y');
    }

    // 更新水印位置
    this.watermark.style.transform = `translate(${this.x}px, ${this.y}px)`;

    // 继续动画
    requestAnimationFrame(() => this.animate());
  }

  changeColor() {
    this.currentColorIndex = (this.currentColorIndex + 1) % this.colors.length;
    this.watermark.style.color = this.colors[this.currentColorIndex];
    this.watermark.style.textShadow = `0 0 10px ${this.colors[this.currentColorIndex]}`;
  }

  addBounceEffect(axis) {
    if (axis === 'x') {
      this.watermark.style.transform = `translate(${this.x}px, ${this.y}px) scale(0.8, 1.2)`;
    } else {
      this.watermark.style.transform = `translate(${this.x}px, ${this.y}px) scale(1.2, 0.8)`;
    }

    setTimeout(() => {
      this.watermark.style.transform = `translate(${this.x}px, ${this.y}px) scale(1)`;
    }, 150);
  }
} 

// 添加节流函数
function throttle(func, limit) {
  let inThrottle;
  let lastResult;
  return function(...args) {
    if (!inThrottle) {
      lastResult = func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
    return lastResult;
  };
} 