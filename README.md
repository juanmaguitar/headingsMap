## HeadingsMap Browser Extension

A browser extension to visualize and audit the heading structure of web pages.

### Features
* List of headings and optional information about their level and if they break the hierarchical structure
* List of sections with header information and includes optional information about errors in the structure
* You can click on the headers so that the document scrolls to the position of the element
* Detects changes in the DOM and when they finish, updates its content (if necessary)
* It can also be refreshed manually
* Compatible with Firefox and Chrome:
  * Firefox: https://addons.mozilla.org/es/firefox/addon/headingsmap/
  * Chrome: https://chrome.google.com/webstore/detail/headingsmap/flbjommegcjonpdmenkdiocclhjacmbi?hl=es
* Allow collapsing list of headers by levels

### Tech Stack
* **React 19** - Modern UI framework
* **TypeScript** - Type-safe development
* **Tailwind CSS** - Utility-first styling
* **Webpack** - Module bundler

### Development

#### Prerequisites
* Node.js 16+ and npm

#### Setup
```bash
# Install dependencies
npm install

# Build the extension
npm run build

# Development mode with watch
npm run dev
```

#### Loading the Extension
1. Build the project: `npm run build`
2. The extension files will be in the `dist/` directory
3. Load the extension in your browser:
   - **Chrome**: Go to `chrome://extensions/`, enable "Developer mode", click "Load unpacked" and select the `dist/` folder
   - **Firefox**: Go to `about:debugging#/runtime/this-firefox`, click "Load Temporary Add-on" and select the `manifest.json` file in the `dist/` folder

### Project Structure
```
src/
├── background.ts              # Background script
├── content_scripts/
│   └── headingsMap.tsx       # Main content script with React UI
├── options/
│   ├── OptionsComponent.tsx  # Options page React component
│   └── options.tsx           # Options page entry point
├── styles/
│   └── main.css              # Tailwind CSS styles
└── types/
    └── index.ts              # TypeScript type definitions
```

### Nice to have and/or working on:
* Scroll to section even if it doesn't have header
* Create a page with the documentation
* Show information of all documents that are present, including those that are inside iframes
* Improve (better code and performance) the changes detection and updates
* Improve the styling
* Integrate it as panel or/and in dev-tools

Any comments and suggestions are welcome ...

