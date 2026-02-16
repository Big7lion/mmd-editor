# Beautiful Mermaid Editor

A modern desktop application for creating and editing Mermaid diagrams with live preview, syntax highlighting, and autocompletion.

## Features

- **Live Preview** - See your diagram render in real-time as you type
- **Syntax Highlighting** - VSCode-style editor with Mermaid syntax support
- **Autocompletion** - Smart suggestions for Mermaid syntax
- **Theme Switching** - Multiple themes (default, forest, dark, neutral)
- **Export** - Export diagrams as PNG, SVG, or PDF
- **Desktop Integration** - Native file dialogs and system integration

## Getting Started

### Prerequisites

- Node.js 20+
- Rust (latest stable)
- npm or pnpm

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run with Tauri (desktop mode)
npm run tauri dev
```

### Building

```bash
# Build for production
npm run tauri build
```

The built app will be in `src-tauri/target/release/bundle/macos/`.

## Tech Stack

- **Tauri v2** - Desktop framework
- **React 19** - UI framework
- **CodeMirror 6** - Code editor
- **beautiful-mermaid** - Mermaid rendering
- **shadcn/ui** - UI components
- **Tailwind CSS v4** - Styling

## License

MIT
