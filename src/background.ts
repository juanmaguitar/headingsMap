import { Settings, Message } from './types';

let tabId: number;

// Open/close when clicking the toolbar button
chrome.browserAction.onClicked.addListener(injectHeadingsMapScript);

// Listen for messages
chrome.runtime.onConnect.addListener(connected);

function injectHeadingsMapScript(tab: chrome.tabs.Tab): void {
  if (!tab.id) return;
  
  tabId = tab.id;

  chrome.tabs.executeScript(
    tabId,
    { file: 'contentScript.js' },
    showHeadingsMap
  );

  chrome.tabs.insertCSS({ file: 'content_scripts/headingsMap.css' });
}

function connected(portFromCS: chrome.runtime.Port): void {
  portFromCS.onMessage.addListener((message: Message) => {
    if (message.action === 'update') {
      updateHeadingsMap();
    } else if (message.action === 'settings') {
      const openOptionsPage = chrome.runtime.openOptionsPage();
      if (openOptionsPage) {
        openOptionsPage.then(reportSuccess, reportError);
      }
    }
  });
}

function sendActionToHeadingsMapScript(action: 'toggle' | 'update'): void {
  const message: Message = { action };

  chrome.storage.local.get(
    [
      'showHeadLevels',
      'showHeadError',
      'showHeadErrorH1',
      'showOutLevels',
      'showOutElem',
      'showOutError',
    ],
    sendActionWithSettings
  );

  function sendActionWithSettings(settings: Settings): void {
    message.settings = settings;
    chrome.tabs.sendMessage(tabId, message);
  }
}

function showHeadingsMap(): void {
  sendActionToHeadingsMapScript('toggle');
}

function updateHeadingsMap(): void {
  sendActionToHeadingsMapScript('update');
}

function reportSuccess(): void {}

function reportError(error: Error): void {
  console.error(error);
}
