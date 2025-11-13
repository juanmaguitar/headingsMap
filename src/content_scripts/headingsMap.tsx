import React, { useEffect, useState, useRef, useCallback } from 'react';
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

// Constants
const NO_HEAD_CLASS = 'no-headed';
const HEAD_ERROR_CLASS = 'head_error';
const HEADER_ID_PREFIX = 'hmap-';
const SECTION_ID_PREFIX = 'smap-';
const LIST_CLASS_PREFIX = 'headingsMap-h';
const CLASS_PREFIX = 'biohead';

const HeadingsMapWidget: React.FC<{ settings: Settings; onClose: () => void }> = ({
  settings,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'headings' | 'outline'>('headings');
  const [headingsHTML, setHeadingsHTML] = useState<string>('');
  const [outlineHTML, setOutlineHTML] = useState<string>('');
  const port = useRef(chrome.runtime.connect({ name: 'port-from-cs' }));
  const headingsRef = useRef<HTMLDivElement>(null);
  const outlineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    updateContent();
    
    // Setup mutation observer to detect DOM changes
    const observer = new MutationObserver(debounce(() => {
      updateContent();
    }, 250));
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [settings]);

  // Setup event listeners for rendered content
  useEffect(() => {
    const container = activeTab === 'headings' ? headingsRef.current : outlineRef.current;
    if (!container) return;

    // Add click handlers for headings
    const headingLinks = container.querySelectorAll('a[data-header-id]');
    headingLinks.forEach(link => {
      link.addEventListener('click', handleHeadingClick);
    });

    // Add click handlers for collapsers
    const collapsers = container.querySelectorAll('.collapser');
    collapsers.forEach(collapser => {
      collapser.addEventListener('click', handleCollapserClick);
    });

    return () => {
      headingLinks.forEach(link => {
        link.removeEventListener('click', handleHeadingClick);
      });
      collapsers.forEach(collapser => {
        collapser.removeEventListener('click', handleCollapserClick);
      });
    };
  }, [headingsHTML, outlineHTML, activeTab]);

  const debounce = (func: Function, wait: number) => {
    let timeout: NodeJS.Timeout;
    return (...args: any[]) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  };

  const updateContent = () => {
    const headingsContent = generateHeadingsMap(window, 0);
    const outlineContent = generateHTML5Outline(window, 0);
    
    setHeadingsHTML(headingsContent);
    setOutlineHTML(outlineContent);
  };

  const handleHeadingClick = (e: Event) => {
    e.preventDefault();
    const target = e.currentTarget as HTMLElement;
    const headerId = target.getAttribute('data-header-id');
    if (headerId) {
      scrollToHeader(headerId);
    }
  };

  const handleCollapserClick = (e: Event) => {
    const target = e.target as HTMLElement;
    const listToToggle = target.nextSibling as HTMLElement;
    
    if (listToToggle && listToToggle.tagName === 'UL') {
      if (listToToggle.style.display === 'none') {
        listToToggle.style.display = 'block';
        target.className = 'collapser';
      } else {
        listToToggle.style.display = 'none';
        target.className = 'collapser collapsed';
      }
    }
  };

  const scrollToHeader = (headerId: string) => {
    const headerElement = document.getElementById(headerId);
    if (headerElement) {
      let topPosition = 0;
      let element: HTMLElement | null = headerElement;
      
      while (element && element.tagName !== 'BODY') {
        topPosition += element.offsetTop;
        element = element.offsetParent as HTMLElement;
        if (element === null) break;
      }
      
      document.documentElement.scrollTop = topPosition;
    }
  };

  const generateHeadingsMap = (documentWindow: Window, documentIndex: number): string => {
    const documentToCheck = documentWindow.document;
    const headingElements = documentToCheck.querySelectorAll('h1, h2, h3, h4, h5, h6');
    
    if (headingElements.length === 0) {
      return `<section><h2>${documentToCheck.title || 'Untitled document'}</h2><ul><li><span class="${NO_HEAD_CLASS}">No headings</span></li></ul></section>`;
    }

    let html = '';
    let previous = 0;
    let currentLevel = 0;
    let stack: string[] = [`<ul class="${LIST_CLASS_PREFIX}0">`];
    
    headingElements.forEach((header, i) => {
      const htmlHeader = header as HTMLElement;
      let headerId = htmlHeader.getAttribute('id');
      
      if (!headerId) {
        headerId = `${HEADER_ID_PREFIX}${i}`;
        htmlHeader.setAttribute('id', headerId);
      }

      currentLevel = parseInt(htmlHeader.tagName.substring(1));
      const headerText = getText(htmlHeader);
      const hasError = currentLevel > previous + 1 && 
        ((i === 0 && settings.showHeadErrorH1) || (i > 0)) && 
        settings.showHeadError;

      // Handle nesting changes
      if (currentLevel > previous) {
        // Going deeper
        const classValue = `${LIST_CLASS_PREFIX}${currentLevel}`;
        stack.push(`<ul class="${classValue}">`);
      } else if (currentLevel < previous) {
        // Going shallower - close deeper lists
        stack.push('</li>');
        for (let j = previous; j > currentLevel; j--) {
          stack.push('</ul></li>');
        }
      } else if (i > 0) {
        // Same level - close previous item
        stack.push('</li>');
      }

      const levelText = settings.showHeadLevels ? `<span class="head">${currentLevel} - </span>` : '';
      const errorClass = hasError ? ` class="${HEAD_ERROR_CLASS}"` : '';
      
      stack.push(`<li class="${CLASS_PREFIX}${currentLevel}">
        <a tabindex="0" data-header-id="${headerId}" title="${headerText}"${errorClass}>
          ${levelText}${headerText}
        </a>`);

      previous = currentLevel;
    });

    // Close all remaining open elements
    stack.push('</li>');
    while (stack.length > 1) {
      const last = stack[stack.length - 1];
      if (!last.startsWith('</')) {
        stack.push('</ul>');
        break;
      }
      stack.push('</ul>');
      break;
    }

    html = stack.join('\n');
    
    const title = documentToCheck.title || 'Untitled document';
    return `<section><h2>${title}</h2>${html}</section>`;
  };

  const generateHTML5Outline = (documentWindow: Window, documentIndex: number): string => {
    const documentToCheck = documentWindow.document;
    const bodyElement = documentToCheck.body;
    
    // Simplified HTML5 Outline Algorithm
    let currentSection: any = null;
    let currentOutline: any = null;
    let stack: any[] = [];
    let idCounter = 0;
    let sectionsId: string[] = [];

    const createSection = (node: HTMLElement) => {
      return {
        heading: false as HTMLElement | string | boolean,
        sections: [] as any[],
        startingNode: node,
        container: undefined as any,
        append: function(section: any) {
          section.container = this;
          this.sections.push(section);
        }
      };
    };

    const isHeaderElement = (node: Node): node is HTMLElement => {
      if (node.nodeType !== 1) return false;
      const tagName = (node as HTMLElement).tagName;
      return /^H[1-6]$/.test(tagName);
    };

    const isSectioningElement = (node: Node): node is HTMLElement => {
      if (node.nodeType !== 1) return false;
      const tagName = (node as HTMLElement).tagName;
      return /^(ARTICLE|ASIDE|NAV|SECTION)$/.test(tagName);
    };

    const isSectioningRoot = (node: Node): node is HTMLElement => {
      if (node.nodeType !== 1) return false;
      const tagName = (node as HTMLElement).tagName;
      return /^(BLOCKQUOTE|BODY|DETAILS|FIELDSET|FIGURE|TD)$/.test(tagName);
    };

    const getHeaderLevel = (header: HTMLElement): number => {
      return -parseInt(header.tagName.substring(1));
    };

    const walkDOM = (node: HTMLElement, enterFn: Function, exitFn: Function) => {
      let current: HTMLElement | null = node;
      
      while (current) {
        enterFn(current);
        
        if (current.firstChild) {
          current = current.firstChild as HTMLElement;
          continue;
        }

        while (current) {
          exitFn(current);
          if (current.nextSibling) {
            current = current.nextSibling as HTMLElement;
            break;
          }
          current = current === node ? null : current.parentNode as HTMLElement;
        }
      }
    };

    const enterNode = (node: HTMLElement) => {
      const lastStackItem = stack.length > 0 ? stack[stack.length - 1] : null;
      
      if (isHeaderElement(lastStackItem)) {
        return;
      }
      
      if (isSectioningElement(node) || isSectioningRoot(node)) {
        if (currentSection != null) {
          stack.push(currentSection);
        }
        currentSection = node;
        currentOutline = createSection(node);
        (node as any).outline = {
          sections: [currentOutline],
          startingNode: node
        };
      } else if (currentSection != null && isHeaderElement(node)) {
        if (!currentOutline.heading) {
          currentOutline.heading = node;
          stack.push(node);
        } else {
          const level = getHeaderLevel(node);
          const currentLevel = currentOutline.heading && typeof currentOutline.heading === 'object' 
            ? getHeaderLevel(currentOutline.heading as HTMLElement) 
            : 1;
            
          if (level >= currentLevel) {
            const newSection = createSection(node);
            (currentSection as any).outline.sections.push(newSection);
            currentOutline = newSection;
            currentOutline.heading = node;
          } else {
            let candidateSection = currentOutline;
            while (candidateSection.container) {
              const containerLevel = candidateSection.container.heading && typeof candidateSection.container.heading === 'object'
                ? getHeaderLevel(candidateSection.container.heading as HTMLElement)
                : 1;
              if (level < containerLevel) {
                const newSection = createSection(node);
                candidateSection.container.append(newSection);
                currentOutline = newSection;
                currentOutline.heading = node;
                break;
              }
              candidateSection = candidateSection.container;
            }
          }
          stack.push(node);
        }
      }
    };

    const exitNode = (node: HTMLElement) => {
      const lastStackItem = stack.length > 0 ? stack[stack.length - 1] : null;
      
      if (isHeaderElement(lastStackItem) && lastStackItem === node) {
        stack.pop();
      } else if ((isSectioningElement(node) || isSectioningRoot(node))) {
        if (!currentOutline.heading) {
          currentOutline.heading = `${NO_HEAD_CLASS}no head element`;
        }
        
        if (isSectioningElement(node) && stack.length > 0) {
          currentSection = stack.pop();
          currentOutline = (currentSection as any).outline.sections[(currentSection as any).outline.sections.length - 1];
          
          for (let i = 0; i < (node as any).outline.sections.length; i++) {
            currentOutline.append((node as any).outline.sections[i]);
          }
        } else if (isSectioningRoot(node) && stack.length > 0) {
          currentSection = stack.pop();
          currentOutline = (currentSection as any).outline.sections[(currentSection as any).outline.sections.length - 1];
          while (currentOutline.sections.length > 0) {
            currentOutline = currentOutline.sections[currentOutline.sections.length - 1];
          }
        } else if (isSectioningElement(node) || isSectioningRoot(node)) {
          currentOutline = (currentSection as any).outline.sections[0];
        }
      }
    };

    walkDOM(bodyElement, enterNode, exitNode);

    // Generate HTML from outline
    const generateOutlineHTML = (sections: any[], level: number = 0): string => {
      if (!sections || sections.length === 0) return '';
      
      let html = '<ul>';
      
      sections.forEach((section: any, index: number) => {
        const heading = section.heading;
        let headingHTML = '';

        if (heading && typeof heading === 'object' && isHeaderElement(heading)) {
          const headingText = getText(heading);
          let sectionId = heading.getAttribute('id');
          if (!sectionId) {
            do {
              sectionId = `${SECTION_ID_PREFIX}${idCounter++}`;
            } while (documentToCheck.getElementById(sectionId));
            heading.setAttribute('id', sectionId);
            sectionsId.push(sectionId);
          }
          
          const tagName = section.startingNode.tagName.toLowerCase().replace('body', 'document');
          const elemText = settings.showOutElem ? `<span class="head">[${tagName}] - </span>` : '';
          const indexText = settings.showOutLevels ? `<span class="head_number">${index + 1}${settings.showOutElem ? ' ' : ' - '}</span>` : '';
          
          headingHTML = `<a tabindex="0" data-header-id="${sectionId}" title="${headingText}">${indexText}${elemText}${headingText}</a>`;
        } else {
          const tagName = section.startingNode.tagName.toLowerCase().replace('body', 'document');
          const elemText = settings.showOutElem ? `[${tagName}] - ` : '';
          const errorClass = settings.showOutError ? ` class="${NO_HEAD_CLASS}"` : '';
          const headingText = typeof heading === 'string' ? heading : 'no head element';
          headingHTML = `<span${errorClass} title=" Untitled (${headingText})">${elemText} Untitled (${headingText})</span>`;
        }

        html += '<li>';
        if (section.sections && section.sections.length > 0) {
          html += `<span class="collapser"></span>`;
        }
        html += headingHTML;
        
        if (section.sections && section.sections.length > 0) {
          html += generateOutlineHTML(section.sections, level + 1);
        }
        
        html += '</li>';
      });
      
      html += '</ul>';
      return html;
    };

    const title = documentToCheck.title || 'Untitled document';
    let outlineContent = '';
    
    if ((bodyElement as any).outline && (bodyElement as any).outline.sections) {
      outlineContent = generateOutlineHTML((bodyElement as any).outline.sections);
    } else {
      outlineContent = '<p class="text-gray-500 italic">No outline available</p>';
    }
    
    return `<section><h2>${title}</h2>${outlineContent}</section>`;
  };

  const getText = (element: HTMLElement): string => {
    if (!element) return '';
    
    // Check for alt text on images
    if (element.tagName === 'IMG') {
      const src = element.getAttribute('src') || '';
      if (!src.startsWith('moz-extension://')) {
        return element.getAttribute('alt') || '';
      }
    }
    
    if (element.tagName === 'AREA' || (element.tagName === 'INPUT' && element.getAttribute('type')?.toLowerCase() === 'image')) {
      return element.getAttribute('alt') || '';
    }
    
    let text = '';
    const childNodes = element.childNodes;
    
    for (let i = 0; i < childNodes.length; i++) {
      const node = childNodes[i];
      if (node.nodeType === 3) { // Text node
        const nodeValue = node.nodeValue || '';
        text += nodeValue.replace(/"/g, "'").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      } else if (node.nodeType === 1) { // Element node (not a comment which is nodeType 8)
        text += getText(node as HTMLElement);
      }
    }
    
    return text.replace(/\n/g, ' ').replace(/\t/g, ' ').replace(/\s+/g, ' ').trim();
  };

  const handleRefresh = () => {
    port.current.postMessage({ action: 'update' });
    updateContent();
  };

  const handleSettings = () => {
    port.current.postMessage({ action: 'settings' });
  };

  const handleTabSwitch = (tab: 'headings' | 'outline') => {
    setActiveTab(tab);
    const tabId = tab === 'headings' ? 'headingsMap_headings' : 'headingsMap_outline';
    localStorage.setItem('headingsMap_selectedTab', tabId);
  };

  // Restore selected tab from localStorage
  useEffect(() => {
    const savedTab = localStorage.getItem('headingsMap_selectedTab');
    if (savedTab === 'headingsMap_outline') {
      setActiveTab('outline');
    }
  }, []);

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
              id="headingsMap_refresh"
            >
              🔄
            </button>
            <button
              onClick={handleSettings}
              className="p-2 hover:bg-gray-100 rounded"
              title="Settings"
              id="headingsMap_settings"
            >
              ⚙️
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded"
              title="Close"
              id="headingsMap_closer"
            >
              ✕
            </button>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => handleTabSwitch('headings')}
            className={`flex-1 py-2 px-4 rounded text-sm ${
              activeTab === 'headings'
                ? 'bg-blue-500 text-white active'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            id="headingsTab"
          >
            Headings Structure
          </button>
          <button
            onClick={() => handleTabSwitch('outline')}
            className={`flex-1 py-2 px-4 rounded text-sm ${
              activeTab === 'outline'
                ? 'bg-blue-500 text-white active'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            id="outlineTab"
          >
            HTML5 Outline
          </button>
        </div>
      </div>

      <div className="p-0" id="headingsMapWrapper">
        <div
          ref={headingsRef}
          id="headingsMap_headings"
          style={{ display: activeTab === 'headings' ? 'block' : 'none' }}
          dangerouslySetInnerHTML={{ __html: headingsHTML }}
        />
        <div
          ref={outlineRef}
          id="headingsMap_outline"
          style={{ display: activeTab === 'outline' ? 'block' : 'none' }}
          dangerouslySetInnerHTML={{ __html: outlineHTML }}
        />
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
  let bodyMutationEndingObserver: MutationObserver | null = null;

  chrome.runtime.onMessage.addListener((message: Message) => {
    const settings = Object.assign({}, defaultSettings, message.settings);
    const previous = document.getElementById('headingsMapIframeWrapper');

    if (previous) {
      if (message.action === 'toggle') {
        closeWidget();
      } else if (message.action === 'update') {
        updateWidget(settings);
      }
    } else if (message.action === 'toggle') {
      openWidget(settings);
    }
  });

  function openWidget(settings: Settings) {
    widgetContainer = document.createElement('div');
    widgetContainer.id = 'headingsMapIframeWrapper';
    document.body.parentNode!.insertBefore(widgetContainer, document.body);
    document.documentElement.setAttribute('data-headings-map-active', 'true');
    
    // Apply body margin
    document.body.style.marginLeft = '350px';

    widgetRoot = createRoot(widgetContainer);
    widgetRoot.render(
      <HeadingsMapWidget settings={settings} onClose={closeWidget} />
    );
  }

  function updateWidget(settings: Settings) {
    if (widgetRoot) {
      widgetRoot.render(
        <HeadingsMapWidget settings={settings} onClose={closeWidget} />
      );
    }
  }

  function closeWidget() {
    if (widgetRoot && widgetContainer) {
      widgetRoot.unmount();
      widgetContainer.remove();
      widgetRoot = null;
      widgetContainer = null;
      document.documentElement.removeAttribute('data-headings-map-active');
      document.body.style.marginLeft = '';
      
      if (bodyMutationEndingObserver) {
        bodyMutationEndingObserver.disconnect();
      }
    }
  }
})();
