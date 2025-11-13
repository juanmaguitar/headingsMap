# Migration Guide: Vanilla JS to React + TypeScript + Tailwind

## Overview
This document describes the refactoring of the headingsMap browser extension from vanilla JavaScript to React, TypeScript, and Tailwind CSS.

## Key Changes

### 1. Project Structure

**Before:**
```
├── background.js
├── content_scripts/
│   ├── headingsMap.js
│   └── headingsMap.css
├── options/
│   ├── options.html
│   ├── options.js
│   └── style.css
├── html/
│   └── style.css
└── manifest.json
```

**After:**
```
├── src/
│   ├── background.ts
│   ├── content_scripts/
│   │   └── headingsMap.tsx
│   ├── options/
│   │   ├── OptionsComponent.tsx
│   │   └── options.tsx
│   ├── styles/
│   │   └── main.css
│   └── types/
│       └── index.ts
├── dist/ (generated)
├── webpack.config.js
├── tsconfig.json
├── tailwind.config.js
├── package.json
└── manifest.json
```

### 2. Technology Stack

| Component | Before | After |
|-----------|--------|-------|
| Language | JavaScript (ES5/ES6) | TypeScript 5.9 |
| UI Framework | Vanilla JS DOM manipulation | React 19 |
| Styling | Plain CSS | Tailwind CSS v4 |
| Build Tool | None | Webpack 5 |
| Package Manager | None | npm |

### 3. Code Conversion Examples

#### Background Script
**Before (background.js):**
```javascript
var tabId;
chrome.browserAction.onClicked.addListener(injectHeadingsMapScript);

function injectHeadingsMapScript(tab) {
    tabId = tab.id;
    chrome.tabs.executeScript(tabId, {file: 'content_scripts/headingsMap.js'}, showHeadingsMap);
}
```

**After (src/background.ts):**
```typescript
let tabId: number;
chrome.browserAction.onClicked.addListener(injectHeadingsMapScript);

function injectHeadingsMapScript(tab: chrome.tabs.Tab): void {
  if (!tab.id) return;
  tabId = tab.id;
  chrome.tabs.executeScript(tabId, { file: 'contentScript.js' }, showHeadingsMap);
}
```

#### Options Page
**Before (options/options.js):**
```javascript
var select = document.getElementsByTagName('select');
for (var i = 0; i < select.length; i++) {
    select[i].onchange = function () {
        saveOption(this);
    };
}
```

**After (src/options/OptionsComponent.tsx):**
```typescript
const Options: React.FC = () => {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  
  const handleOptionChange = (key: keyof Settings, value: boolean) => {
    setSettings({ ...settings, [key]: value });
    chrome.storage.local.set({ [key]: value });
  };
  
  return (
    <select 
      value={settings.showHeadLevels.toString()}
      onChange={(e) => handleOptionChange('showHeadLevels', e.target.value === 'true')}
    >
      <option value="true">Yes</option>
      <option value="false">No</option>
    </select>
  );
};
```

#### Content Script
**Before (content_scripts/headingsMap.js):**
```javascript
function headingsMap(documentWindow, documentIndex) {
    var headersList = createElement('ul');
    var headingElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    
    for (var i = 0; i < headingElements.length; i++) {
        var item = createElement('li');
        var linkElement = createElement('a');
        linkElement.onclick = scrollToHeader;
        headersList.appendChild(item);
    }
}
```

**After (src/content_scripts/headingsMap.tsx):**
```typescript
const HeadingsMapWidget: React.FC<{ settings: Settings }> = ({ settings }) => {
  const [headings, setHeadings] = useState<HeadingItem[]>([]);
  
  useEffect(() => {
    const headingElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const headingsList = Array.from(headingElements).map((el, index) => ({
      id: el.id || `hmap-${index}`,
      level: parseInt(el.tagName.substring(1)),
      text: el.textContent || '',
      element: el as HTMLElement,
      hasError: false,
    }));
    setHeadings(headingsList);
  }, []);
  
  return (
    <ul>
      {headings.map((heading, index) => (
        <li key={index} onClick={() => scrollToHeading(heading.id)}>
          {heading.text}
        </li>
      ))}
    </ul>
  );
};
```

### 4. Styling Changes

**Before (Plain CSS):**
```css
#headingsMapWrapper {
    width: 98%;
    text-align: left;
    font-weight: normal;
    font-family: Arial, Verdana, sans-serif;
    font-size: 13px;
    color: #444;
}
```

**After (Tailwind CSS):**
```typescript
<div className="fixed left-0 top-0 h-full w-80 bg-white shadow-lg overflow-auto">
  <h2 className="text-lg font-semibold text-gray-800">HeadingsMap</h2>
</div>
```

### 5. Type Definitions

New TypeScript interfaces ensure type safety:

```typescript
// src/types/index.ts
export interface Settings {
  showHeadLevels: boolean;
  showHeadError: boolean;
  showHeadErrorH1: boolean;
  showOutLevels: boolean;
  showOutElem: boolean;
  showOutError: boolean;
}

export interface Message {
  action: 'toggle' | 'update' | 'settings';
  settings?: Settings;
}

export interface HeadingItem {
  id: string;
  level: number;
  text: string;
  element: HTMLElement;
  hasError: boolean;
}
```

### 6. Build Process

**Before:**
- No build step
- Files loaded directly by browser

**After:**
```bash
# Development
npm install
npm run dev    # Watch mode for development

# Production
npm run build  # Creates optimized bundle in dist/
```

### 7. Benefits of the Refactoring

1. **Type Safety**: TypeScript catches errors at compile time
2. **Modern Tooling**: Access to npm ecosystem and modern build tools
3. **Component Architecture**: Reusable React components
4. **Better Developer Experience**: 
   - Auto-completion in IDEs
   - Better error messages
   - Hot reload during development
5. **Maintainability**: Clear separation of concerns
6. **Styling**: Utility-first CSS with Tailwind for faster development
7. **Bundle Optimization**: Webpack minification and tree-shaking

### 8. Compatibility

- Maintains manifest v2 for browser compatibility
- Same permissions and functionality
- Settings stored in chrome.storage.local (unchanged)
- Works in Chrome and Firefox (same as before)

### 9. File Size Comparison

| File | Before | After (minified) |
|------|--------|------------------|
| Background | ~1.5 KB | 708 bytes |
| Content Script | ~28 KB | 207 KB (includes React) |
| Options | ~1.5 KB | 208 KB (includes React) |

Note: The increase in size for content script and options is due to including React runtime. This is a reasonable trade-off for the benefits of React's component model and developer experience.

### 10. Development Workflow

**Before:**
1. Edit JS/HTML/CSS files
2. Reload extension in browser
3. Test changes

**After:**
1. Edit TS/TSX files
2. Run `npm run build` (or `npm run dev` for watch mode)
3. Reload extension in browser
4. Test changes

With watch mode (`npm run dev`), changes are automatically compiled.

## Conclusion

This refactoring brings the headingsMap extension into the modern web development ecosystem while maintaining full functionality and browser compatibility. The code is now more maintainable, type-safe, and ready for future enhancements.
