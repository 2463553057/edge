let searchWindow = null;

// 点击扩展图标时的处理
chrome.action.onClicked.addListener(() => {
  if (searchWindow) {
    chrome.windows.update(searchWindow.id, { focused: true });
    chrome.runtime.sendMessage({ type: 'popupOpened' });
  } else {
    chrome.windows.create({
      url: 'popup.html',
      type: 'popup',
      width: 360,
      height: 480,
      focused: true,
      left: Math.round((screen.width - 360) / 2),
      top: Math.round((screen.height - 480) / 2)
    }, (window) => {
      searchWindow = window;
      chrome.runtime.sendMessage({ type: 'popupOpened' });
    });
  }
});

// 窗口关闭时的处理
chrome.windows.onRemoved.addListener((windowId) => {
  if (searchWindow && searchWindow.id === windowId) {
    searchWindow = null;
  }
});

// 右键菜单
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'searchBookmarks',
    title: '搜索收藏夹中的"%s"',
    contexts: ['selection']
  });
});

// 右键菜单点击处理
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'searchBookmarks') {
    if (searchWindow) {
      chrome.windows.update(searchWindow.id, { focused: true });
      chrome.runtime.sendMessage({ type: 'performSearch', query: info.selectionText });
    } else {
      chrome.windows.create({
        url: 'popup.html',
        type: 'popup',
        width: 360,
        height: 480,
        focused: true,
        left: Math.round((screen.width - 360) / 2),
        top: Math.round((screen.height - 480) / 2)
      }, (window) => {
        searchWindow = window;
        setTimeout(() => {
          chrome.runtime.sendMessage({ type: 'performSearch', query: info.selectionText });
        }, 500);
      });
    }
  }
}); 