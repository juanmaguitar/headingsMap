import React, { useEffect, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/main.css';
import { Settings, Message } from '../types';

const defaultSettings: Settings = {
  showHeadLevels: true,
  showHeadError: true,
  showHeadErrorH1: true,
  showOutLevels: true,
  showOutElem: true,
  showOutError: true,
};

interface HeadingItem {
  id: string;
  level: number;
  text: string;
  element: HTMLElement;
  hasError: boolean;
}

const HeadingsMapWidget: React.FC<{ settings: Settings; onClose: () => void }> = ({
  settings,
  onClose,
}) => {
  const [headings, setHeadings] = useState<HeadingItem[]>([]);
  const [activeTab, setActiveTab] = useState<'headings' | 'outline'>('headings');
  const port = useRef(chrome.runtime.connect({ name: 'port-from-cs' }));

  useEffect(() => {
    extractHeadings();
    
    // Setup mutation observer to detect DOM changes
    const observer = new MutationObserver(debounce(() => {
      extractHeadings();
    }, 250));
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [settings]);

  const extractHeadings = () => {
    const headingElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const headingsList: HeadingItem[] = [];
    let previousLevel = 0;

    headingElements.forEach((element, index) => {
      if (element instanceof HTMLElement) {
        let headingId = element.getAttribute('id');
        if (!headingId) {
          headingId = `hmap-${index}`;
          element.setAttribute('id', headingId);
        }

        const level = parseInt(element.tagName.substring(1));
        const text = getElementText(element);
        const hasError = level > previousLevel + 1 && 
          (index === 0 ? settings.showHeadErrorH1 : true) && 
          settings.showHeadError;

        headingsList.push({
          id: headingId,
          level,
          text,
          element,
          hasError,
        });

        previousLevel = level;
      }
    });

    setHeadings(headingsList);
  };

  const getElementText = (element: HTMLElement): string => {
    const text = element.textContent || '';
    return text.replace(/\s+/g, ' ').trim();
  };

  const scrollToHeading = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleRefresh = () => {
    port.current.postMessage({ action: 'update' });
    extractHeadings();
  };

  const handleSettings = () => {
    port.current.postMessage({ action: 'settings' });
  };

  const debounce = (func: Function, wait: number) => {
    let timeout: NodeJS.Timeout;
    return (...args: any[]) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  };

  const renderHeadingsList = () => {
    if (headings.length === 0) {
      return (
        <div className="p-4 text-gray-500 italic">No headings found</div>
      );
    }

    return (
      <ul className="list-none p-0">
        {headings.map((heading, index) => (
          <li
            key={index}
            className={`pl-${heading.level * 4} py-1`}
            style={{ paddingLeft: `${heading.level * 16}px` }}
          >
            <a
              onClick={() => scrollToHeading(heading.id)}
              className={`cursor-pointer hover:text-blue-600 ${
                heading.hasError ? 'text-red-600' : 'text-gray-700'
              }`}
              title={heading.text}
            >
              {settings.showHeadLevels && (
                <span className="text-xs text-gray-500 mr-1">
                  {heading.level} -
                </span>
              )}
              <span>{heading.text}</span>
            </a>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="fixed left-0 top-0 h-full w-80 bg-white shadow-lg overflow-auto z-[100000]">
      <div className="sticky top-0 bg-white border-b border-gray-200 p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-800">HeadingsMap</h2>
          <div className="flex gap-2">
            <button
              onClick={handleRefresh}
              className="p-2 hover:bg-gray-100 rounded"
              title="Refresh"
            >
              🔄
            </button>
            <button
              onClick={handleSettings}
              className="p-2 hover:bg-gray-100 rounded"
              title="Settings"
            >
              ⚙️
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded"
              title="Close"
            >
              ✕
            </button>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('headings')}
            className={`flex-1 py-2 px-4 rounded ${
              activeTab === 'headings'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Headings Structure
          </button>
          <button
            onClick={() => setActiveTab('outline')}
            className={`flex-1 py-2 px-4 rounded ${
              activeTab === 'outline'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            HTML5 Outline
          </button>
        </div>
      </div>

      <div className="p-4">
        {activeTab === 'headings' ? (
          renderHeadingsList()
        ) : (
          <div className="text-gray-500 italic">
            HTML5 Outline view (simplified for this refactoring)
          </div>
        )}
      </div>
    </div>
  );
};

// Main content script logic
(function () {
  if ((window as any).hasHeadingsMapRun) {
    return;
  }
  (window as any).hasHeadingsMapRun = true;

  let widgetRoot: ReturnType<typeof createRoot> | null = null;
  let widgetContainer: HTMLDivElement | null = null;

  chrome.runtime.onMessage.addListener((message: Message) => {
    const settings = Object.assign({}, defaultSettings, message.settings);

    if (message.action === 'toggle') {
      if (widgetContainer) {
        closeWidget();
      } else {
        openWidget(settings);
      }
    } else if (message.action === 'update') {
      if (widgetContainer) {
        closeWidget();
        openWidget(settings);
      }
    }
  });

  function openWidget(settings: Settings) {
    widgetContainer = document.createElement('div');
    widgetContainer.id = 'headingsMapIframeWrapper';
    document.body.insertBefore(widgetContainer, document.body.firstChild);
    document.documentElement.setAttribute('data-headings-map-active', 'true');
    
    // Apply body margin
    document.body.style.marginLeft = '350px';

    widgetRoot = createRoot(widgetContainer);
    widgetRoot.render(
      <HeadingsMapWidget settings={settings} onClose={closeWidget} />
    );
  }

  function closeWidget() {
    if (widgetRoot && widgetContainer) {
      widgetRoot.unmount();
      widgetContainer.remove();
      widgetRoot = null;
      widgetContainer = null;
      document.documentElement.removeAttribute('data-headings-map-active');
      document.body.style.marginLeft = '';
    }
  }
})();
