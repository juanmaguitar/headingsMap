import React, { useEffect, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
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
  const wrapperRef = useRef<HTMLDivElement>(null);

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

  // Setup event listeners for rendered content and collapsers
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    // Add click handlers for headings
    const headingLinks = wrapper.querySelectorAll('a[data-header-id]');
    headingLinks.forEach(link => {
      link.addEventListener('click', handleHeadingClick);
    });

    // Add collapsers to nested lists
    const nestedLists = wrapper.querySelectorAll('ul ul');
    nestedLists.forEach((list: Element) => {
      if (list instanceof HTMLElement && list.parentNode) {
        // Check if collapser already exists
        const prevSibling = list.previousSibling;
        if (!prevSibling || !(prevSibling as Element).classList?.contains('collapser')) {
          const collapser = document.createElement('span');
          collapser.className = 'collapser';
          collapser.addEventListener('click', handleCollapserClick);
          list.parentNode.insertBefore(collapser, list);
        }
      }
    });

    // Add click handlers for existing collapsers
    const collapsers = wrapper.querySelectorAll('.collapser');
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

        html += '<li>' + headingHTML;
        
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
    <div id="headingsMapWrapper" ref={wrapperRef}>
      <a id="headingsMap_refresh" onClick={handleRefresh} title="Refresh"></a>
      <a id="headingsMap_settings" onClick={handleSettings} title="Settings"></a>
      <a id="headingsMap_closer" onClick={onClose} title="Close"></a>
      
      <a
        id="headingsTab"
        className={activeTab === 'headings' ? 'active' : ''}
        onClick={() => handleTabSwitch('headings')}
      >
        Headings Structure
      </a>
      <a
        id="outlineTab"
        className={activeTab === 'outline' ? 'active' : ''}
        onClick={() => handleTabSwitch('outline')}
      >
        HTML5 Outline
      </a>

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
  );
};

// Main content script logic
(function () {
  if ((window as any).hasHeadingsMapRun) {
    return;
  }
  (window as any).hasHeadingsMapRun = true;

  let widgetRoot: ReturnType<typeof createRoot> | null = null;
  let iframeWidget: HTMLIFrameElement | null = null;
  let iframeContentDocument: Document | null = null;
  let iframeBody: HTMLElement | null = null;
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
    createIframeWidget(settings);
  }

  function createIframeWidget(settings: Settings) {
    const baseURL = chrome.runtime.getURL('html/');
    
    iframeWidget = document.createElement('iframe');
    iframeWidget.id = 'headingsMapIframeWrapper';
    iframeWidget.style.cssText = 'position: fixed !important; height: 100% !important; margin: 0 !important; left: 0 !important; z-index: 100000 !important; overflow: auto !important; background: #FFFFFF !important; width: 350px !important; box-shadow: 0 0 5px rgba(50, 50, 50, .7) !important;';
    
    document.body.parentNode!.insertBefore(iframeWidget, document.body);
    document.documentElement.setAttribute('data-headings-map-active', 'true');
    document.body.style.marginLeft = '350px';

    const iframeContentWindow = iframeWidget.contentWindow;
    if (!iframeContentWindow) return;

    iframeContentWindow.stop();
    iframeContentDocument = iframeContentWindow.document;
    iframeBody = iframeContentDocument.body;

    // Load CSS
    const xmlhttp = new XMLHttpRequest();
    xmlhttp.open('GET', baseURL + 'style.css', true);
    
    xmlhttp.onload = function (e) {
      if (xmlhttp.readyState === 4 && xmlhttp.status === 200 && iframeContentDocument && iframeBody) {
        const iframeCSS = xmlhttp.responseText;
        const iframeHead = '<base href="' + baseURL + '" /><style>' + iframeCSS + '</style>';
        iframeContentDocument.head.innerHTML = iframeHead;

        // Create container for React
        const reactContainer = iframeContentDocument.createElement('div');
        iframeBody.appendChild(reactContainer);

        widgetRoot = createRoot(reactContainer);
        widgetRoot.render(
          <HeadingsMapWidget settings={settings} onClose={closeWidget} />
        );

        // Switch to saved panel
        const savedTab = localStorage.getItem('headingsMap_selectedTab');
        // Tab switching is handled by React component
      }
    };
    
    xmlhttp.onerror = function (e) {
      console.error('Failed to load CSS for headingsMap');
    };
    
    xmlhttp.send(null);
  }

  function updateWidget(settings: Settings) {
    if (widgetRoot) {
      widgetRoot.render(
        <HeadingsMapWidget settings={settings} onClose={closeWidget} />
      );
    }
  }

  function closeWidget() {
    if (widgetRoot) {
      widgetRoot.unmount();
      widgetRoot = null;
    }
    
    if (iframeWidget && iframeWidget.parentNode) {
      iframeWidget.parentNode.removeChild(iframeWidget);
      iframeWidget = null;
    }
    
    iframeContentDocument = null;
    iframeBody = null;
    document.documentElement.removeAttribute('data-headings-map-active');
    document.body.style.marginLeft = '';
    
    if (bodyMutationEndingObserver) {
      bodyMutationEndingObserver.disconnect();
    }
  }
})();
