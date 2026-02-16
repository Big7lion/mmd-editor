import { useState, useEffect, useRef, useCallback } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState, Compartment } from '@codemirror/state'
import { mermaid } from 'codemirror-lang-mermaid'
import { autocompletion, CompletionContext, CompletionResult } from '@codemirror/autocomplete'
import { keymap } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { renderMermaid, THEMES } from 'beautiful-mermaid'
import { open, save, ask } from '@tauri-apps/plugin-dialog'
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { readText } from '@tauri-apps/plugin-clipboard-manager'
import { 
  FilePlus, 
  FolderOpen, 
  Save, 
  Download, 
  Check, 
  X,
  FileCode,
  Palette,
  ZoomIn,
  ZoomOut,
  RotateCcw
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { demos } from './demos'

interface ThemeColors {
  bg: string
  fg: string
  line?: string
  accent?: string
  muted?: string
  surface?: string
  border?: string
  transparent?: boolean
}

interface AppState {
  currentFile: string | null
  isDirty: boolean
  currentTheme: string
}

const DEFAULT_CODE = `graph TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug]
    D --> B
`

const themeMap: Record<string, ThemeColors> = {
  default: { bg: '#ffffff', fg: '#333333' },
  dark: { bg: '#1e1e1e', fg: '#d4d4d4' },
  'tokyo-night': THEMES['tokyo-night'],
  dracula: THEMES['dracula'],
  'github-dark': THEMES['github-dark'],
  nord: THEMES['nord'],
  'one-dark': THEMES['one-dark'],
  'solarized-light': THEMES['solarized-light'],
  'solarized-dark': THEMES['solarized-dark'],
  monokai: THEMES['monokai'],
}

function getThemeColors(themeName: string): ThemeColors {
  return themeMap[themeName] || themeMap.default
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function lightenColor(hex: string, amount: number): string {
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount)
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount)
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

function darkenColor(hex: string, amount: number): string {
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amount)
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amount)
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amount)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

function getEditorTheme(themeName: string) {
  const colors = getThemeColors(themeName)
  const isDark = colors.bg === '#1e1e1e' || parseInt(colors.bg.slice(1, 3), 16) < 128
  
  return EditorView.theme({
    '&': {
      height: '100%',
      backgroundColor: colors.bg,
      color: colors.fg,
    },
    '.cm-scroller': {
      overflow: 'auto',
    },
    '.cm-content': {
      fontFamily: 'monospace',
      fontSize: '14px',
      minHeight: '100%',
    },
    '.cm-gutters': {
      backgroundColor: isDark ? darkenColor(colors.bg, 10) : lightenColor(colors.bg, 5),
      color: colors.muted || colors.fg,
      border: 'none',
    },
    '.cm-activeLineGutter': {
      backgroundColor: isDark ? darkenColor(colors.bg, 20) : lightenColor(colors.bg, 10),
      color: colors.accent || colors.fg,
    },
    '.cm-lineNumbers .cm-gutterElement': {
      padding: '0 8px 0 4px',
      minWidth: '20px',
      textAlign: 'right',
    },
    '.cm-cursor': {
      borderLeftColor: colors.accent || colors.fg,
    },
    '.cm-selectionBackground': {
      background: colors.surface ? hexToRgba(colors.surface, 0.3) : hexToRgba(colors.accent || colors.fg, 0.2),
    },
    '.cm-focused .cm-selectionBackground': {
      background: colors.surface ? hexToRgba(colors.surface, 0.4) : hexToRgba(colors.accent || colors.fg, 0.3),
    },
    '.cm-activeLine': {
      backgroundColor: isDark ? darkenColor(colors.bg, 15) : lightenColor(colors.bg, 8),
    },
    '.cm-matchingBracket': {
      backgroundColor: colors.accent ? hexToRgba(colors.accent, 0.3) : hexToRgba(colors.fg, 0.2),
      color: colors.accent || colors.fg,
      fontWeight: 'bold',
    },
    '.cm-nonmatchingBracket': {
      color: isDark ? '#ff6b6b' : '#e74c3c',
    },
    '.cm-searchMatch': {
      backgroundColor: colors.accent ? hexToRgba(colors.accent, 0.4) : hexToRgba(colors.fg, 0.3),
    },
    '.cm-searchMatch.cm-searchMatch-selected': {
      backgroundColor: colors.accent ? hexToRgba(colors.accent, 0.6) : hexToRgba(colors.fg, 0.5),
    },
  }, { dark: isDark })
}

function getHighlightStyle(themeName: string) {
  const colors = getThemeColors(themeName)
  const isDark = colors.bg === '#1e1e1e' || parseInt(colors.bg.slice(1, 3), 16) < 128
  
  const highlightStyles = {
    keyword: { color: isDark ? '#c678dd' : '#6f42c1', fontWeight: '500' },
    operator: { color: isDark ? '#56b6c2' : '#17a2b8' },
    propertyName: { color: isDark ? '#98c379' : '#28a745' },
    string: { color: isDark ? '#98c379' : '#28a745' },
    number: { color: isDark ? '#d19a66' : '#fd7e14' },
    comment: { color: isDark ? '#5c6370' : '#6c757d', fontStyle: 'italic' },
    variableName: { color: isDark ? '#e06c75' : '#d63384' },
    typeName: { color: isDark ? '#e5c07b' : '#fd7e14' },
    function: { color: isDark ? '#61afef' : '#007bff' },
    content: { color: isDark ? '#e06c75' : '#d63384' },
    modifier: { color: isDark ? '#c678dd' : '#6f42c1' },
  }
  
  return HighlightStyle.define([
    { tag: tags.keyword, ...highlightStyles.keyword },
    { tag: tags.operator, ...highlightStyles.operator },
    { tag: tags.propertyName, ...highlightStyles.propertyName },
    { tag: tags.string, ...highlightStyles.string },
    { tag: tags.number, ...highlightStyles.number },
    { tag: tags.comment, ...highlightStyles.comment },
    { tag: tags.variableName, ...highlightStyles.variableName },
    { tag: tags.typeName, ...highlightStyles.typeName },
    { tag: tags.function(tags.variableName), ...highlightStyles.function },
    { tag: tags.content, ...highlightStyles.content },
    { tag: tags.modifier, ...highlightStyles.modifier },
  ])
}

function App() {
  const [state, setState] = useState<AppState>(() => {
    const savedTheme = localStorage.getItem('mermaid-editor-theme')
    return {
      currentFile: null,
      isDirty: false,
      currentTheme: savedTheme || 'default',
    }
  })
  const [status, setStatus] = useState('Ready')
  const [isError, setIsError] = useState(false)
  const [svg, setSvg] = useState('')
  const [zoom, setZoom] = useState(100)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  
  const editorViewRef = useRef<EditorView | null>(null)
  const renderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const themeCompartmentRef = useRef(new Compartment())
  const updateListenerCompartmentRef = useRef(new Compartment())
  const highlightCompartmentRef = useRef(new Compartment())

  const mermaidCompletions = (context: CompletionContext): CompletionResult | null => {
    const word = context.matchBefore(/\w*/)
    if (!word || (word.from === word.to && !context.explicit)) return null

    const diagramTypes = [
      { label: 'graph', type: 'keyword', detail: 'Directed graph', info: 'Create a directed graph' },
      { label: 'flowchart', type: 'keyword', detail: 'Flowchart', info: 'Create a flowchart' },
      { label: 'sequenceDiagram', type: 'keyword', detail: 'Sequence diagram', info: 'Create a sequence diagram' },
      { label: 'sequence', type: 'keyword', detail: 'Sequence diagram', info: 'Create a sequence diagram' },
      { label: 'classDiagram', type: 'keyword', detail: 'Class diagram', info: 'Create a class diagram' },
      { label: 'class', type: 'keyword', detail: 'Class diagram', info: 'Create a class diagram' },
      { label: 'stateDiagram-v2', type: 'keyword', detail: 'State diagram', info: 'Create a state diagram' },
      { label: 'stateDiagram', type: 'keyword', detail: 'State diagram', info: 'Create a state diagram' },
      { label: 'state', type: 'keyword', detail: 'State diagram', info: 'Create a state diagram' },
      { label: 'erDiagram', type: 'keyword', detail: 'ER diagram', info: 'Create an ER diagram' },
      { label: 'er', type: 'keyword', detail: 'ER diagram', info: 'Create an ER diagram' },
      { label: 'gantt', type: 'keyword', detail: 'Gantt chart', info: 'Create a Gantt chart' },
      { label: 'pie', type: 'keyword', detail: 'Pie chart', info: 'Create a pie chart' },
      { label: 'mindmap', type: 'keyword', detail: 'Mind map', info: 'Create a mind map' },
      { label: 'journey', type: 'keyword', detail: 'User journey', info: 'Create a user journey diagram' },
      { label: 'gitGraph', type: 'keyword', detail: 'Git graph', info: 'Create a Git graph' },
      { label: 'requirementDiagram', type: 'keyword', detail: 'Requirement diagram', info: 'Create a requirement diagram' },
      { label: 'C4Context', type: 'keyword', detail: 'C4 diagram', info: 'Create a C4 diagram' },
    ]

    const graphKeywords = [
      { label: 'TD', type: 'keyword', detail: 'Top-Down', info: 'Top-Down layout' },
      { label: 'BT', type: 'keyword', detail: 'Bottom-Top', info: 'Bottom-Top layout' },
      { label: 'LR', type: 'keyword', detail: 'Left-Right', info: 'Left-Right layout' },
      { label: 'RL', type: 'keyword', detail: 'Right-Left', info: 'Right-Left layout' },
      { label: 'subgraph', type: 'keyword', detail: 'Subgraph', info: 'Create a subgraph' },
      { label: 'end', type: 'keyword', detail: 'End subgraph', info: 'End a subgraph' },
      { label: 'style', type: 'function', detail: 'Style', info: 'Apply style to node' },
      { label: 'linkStyle', type: 'function', detail: 'Link Style', info: 'Apply style to link' },
      { label: 'classDef', type: 'function', detail: 'Class Definition', info: 'Define a class style' },
      { label: 'class', type: 'keyword', detail: 'Class', info: 'Apply class to node' },
      { label: 'direction', type: 'keyword', detail: 'Direction', info: 'Set graph direction' },
    ]

    const sequenceKeywords = [
      { label: 'participant', type: 'keyword', detail: 'Participant', info: 'Define a participant' },
      { label: 'actor', type: 'keyword', detail: 'Actor', info: 'Define an actor' },
      { label: 'loop', type: 'keyword', detail: 'Loop', info: 'Loop section' },
      { label: 'alt', type: 'keyword', detail: 'Alternative', info: 'Alternative paths' },
      { label: 'else', type: 'keyword', detail: 'Else', info: 'Else branch' },
      { label: 'opt', type: 'keyword', detail: 'Optional', info: 'Optional section' },
      { label: 'par', type: 'keyword', detail: 'Parallel', info: 'Parallel section' },
      { label: 'note', type: 'keyword', detail: 'Note', info: 'Add a note' },
      { label: 'over', type: 'keyword', detail: 'Over', info: 'Note over participants' },
      { label: 'title', type: 'keyword', detail: 'Title', info: 'Diagram title' },
      { label: 'autonumber', type: 'keyword', detail: 'Autonumber', info: 'Enable auto numbering' },
      { label: 'hide', type: 'keyword', detail: 'Hide', info: 'Hide sequence numbers' },
    ]

    const classKeywords = [
      { label: 'class', type: 'keyword', detail: 'Class', info: 'Define a class' },
      { label: 'interface', type: 'keyword', detail: 'Interface', info: 'Define an interface' },
      { label: 'enum', type: 'keyword', detail: 'Enum', info: 'Define an enum' },
      { label: 'extends', type: 'keyword', detail: 'Extends', info: 'Inheritance' },
      { label: 'implements', type: 'keyword', detail: 'Implements', info: 'Implementation' },
      { label: '--', type: 'operator', detail: 'Line', info: 'Connection line' },
      { label: '..>', type: 'operator', detail: 'Dotted arrow', info: 'Dotted arrow' },
      { label: '-->', type: 'operator', detail: 'Arrow', info: 'Arrow line' },
      { label: '..|>', type: 'operator', detail: 'Dotted open', info: 'Dotted open arrow' },
      { label: '|>', type: 'operator', detail: 'Open', info: 'Open arrow' },
    ]

    const allCompletions = [...diagramTypes, ...graphKeywords, ...sequenceKeywords, ...classKeywords]

    return {
      from: word.from,
      options: allCompletions,
      validFor: /^\w*$/,
    }
  }

  const renderDiagram = useCallback(async () => {
    const editorView = editorViewRef.current
    if (!editorView) return

    const code = editorView.state.doc.toString()
    const theme = getThemeColors(state.currentTheme)

    if (!code.trim()) {
      setSvg('<div class="text-muted-foreground">Enter mermaid code to preview</div>')
      setStatus('Ready')
      setIsError(false)
      return
    }

    try {
      const result = await renderMermaid(code, theme)
      setSvg(result)
      setStatus('Syntax OK')
      setIsError(false)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      setSvg(`<div class="text-red-500 p-4">${errorMessage}</div>`)
      setStatus(`Error: ${errorMessage}`)
      setIsError(true)
    }
  }, [state.currentTheme])

  const debouncedRender = useCallback(() => {
    if (renderTimeoutRef.current) {
      clearTimeout(renderTimeoutRef.current)
    }
    renderTimeoutRef.current = setTimeout(() => {
      renderDiagram()
    }, 300)
  }, [renderDiagram])

  useEffect(() => {
    const editorEl = document.getElementById('editor')
    if (!editorEl) return

    const startState = EditorState.create({
      doc: DEFAULT_CODE,
      extensions: [
        basicSetup,
        mermaid(),
        autocompletion({ override: [mermaidCompletions] }),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        history(),
        updateListenerCompartmentRef.current.of(
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              setState(prev => ({ ...prev, isDirty: true }))
              debouncedRender()
            }
          })
        ),
        themeCompartmentRef.current.of(getEditorTheme(state.currentTheme)),
        highlightCompartmentRef.current.of(syntaxHighlighting(getHighlightStyle(state.currentTheme))),
      ],
    })

    editorViewRef.current = new EditorView({
      state: startState,
      parent: editorEl,
    })

    renderDiagram()

    return () => {
      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current)
      }
      editorViewRef.current?.destroy()
    }
  }, [])

  useEffect(() => {
    renderDiagram()
  }, [state.currentTheme, renderDiagram])

  useEffect(() => {
    const editorView = editorViewRef.current
    if (editorView) {
      editorView.dispatch({
        effects: [
          themeCompartmentRef.current.reconfigure(getEditorTheme(state.currentTheme)),
          highlightCompartmentRef.current.reconfigure(syntaxHighlighting(getHighlightStyle(state.currentTheme))),
        ],
      })
    }
    localStorage.setItem('mermaid-editor-theme', state.currentTheme)
  }, [state.currentTheme])

  useEffect(() => {
    const editorView = editorViewRef.current
    if (editorView) {
      editorView.dispatch({
        effects: updateListenerCompartmentRef.current.reconfigure(
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              setState(prev => ({ ...prev, isDirty: true }))
              debouncedRender()
            }
          })
        ),
      })
    }
  }, [debouncedRender])

  useEffect(() => {
    const args = (window as { __CLI_ARGS__?: { file?: string; theme?: string } }).__CLI_ARGS__
    if (!args) return

    if (args.theme) {
      const validThemes = ['default', 'dark', 'tokyo-night', 'dracula', 'github-dark', 'nord', 'one-dark', 'solarized-light', 'solarized-dark', 'monokai']
      if (validThemes.includes(args.theme)) {
        setState(prev => ({ ...prev, currentTheme: args.theme! }))
      }
    }

    if (args.file) {
      readTextFile(args.file)
        .then((content: string) => {
          setCode(content)
          setState(prev => ({ ...prev, currentFile: args.file!, isDirty: false }))
          setStatus(`Opened: ${args.file}`)
        })
        .catch((error: Error) => {
          setStatus(`Failed to open: ${error.message}`)
          setIsError(true)
        })
    }
  }, [])

  useEffect(() => {
    const checkClipboard = async () => {
      try {
        const clipboardText = await readText()
        if (!clipboardText || clipboardText.trim().length === 0) return

        const trimmed = clipboardText.trim()
        
        const keywords = ['graph', 'flowchart', 'sequenceDiagram', 'classDiagram', 'stateDiagram', 'erDiagram', 'gantt', 'pie', 'mindmap', 'journey', 'gitGraph', 'requirementDiagram', 'C4Context']
        const hasMermaidKeyword = keywords.some(kw => 
          trimmed.toLowerCase().startsWith(kw.toLowerCase()) || 
          trimmed.toLowerCase().includes(kw.toLowerCase() + ' ') ||
          trimmed.toLowerCase().includes('\n' + kw.toLowerCase())
        )

        if (hasMermaidKeyword && trimmed.length > 5) {
          const result = await ask(`Found Mermaid content in clipboard (${Math.min(trimmed.length, 50)} chars). Do you want to import it?`)
          
          if (result) {
            setCode(trimmed)
            setState(prev => ({ ...prev, isDirty: true }))
            setStatus('Imported from clipboard')
            setIsError(false)
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error('Failed to read clipboard:', errorMessage)
      }
    }

    const timer = setTimeout(() => {
      checkClipboard()
    }, 500)

    return () => clearTimeout(timer)
  }, [])

  const getCode = () => editorViewRef.current?.state.doc.toString() || ''

  const setCode = (code: string) => {
    const editorView = editorViewRef.current
    if (!editorView) return
    editorView.dispatch({
      changes: { from: 0, to: editorView.state.doc.length, insert: code },
    })
  }

  const handleNew = () => {
    setCode(DEFAULT_CODE)
    setState({ currentFile: null, isDirty: false, currentTheme: 'default' })
    setStatus('New file')
  }

  const handleOpen = async () => {
    try {
      const filePath = await open({ multiple: false })
      if (filePath && typeof filePath === 'string') {
        const content = await readTextFile(filePath)
        setCode(content)
        setState(prev => ({ ...prev, currentFile: filePath, isDirty: false }))
        setStatus(`Opened: ${filePath}`)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      setStatus(`Failed to open: ${errorMessage}`)
      setIsError(true)
    }
  }

  const handleSave = async () => {
    try {
      let filePath = state.currentFile

      if (!filePath) {
        const savePath = await save({ defaultPath: 'diagram.mmd' })
        if (!savePath) return
        filePath = savePath
      }

      const content = getCode()
      await writeTextFile(filePath, content)
      setState(prev => ({ ...prev, currentFile: filePath, isDirty: false }))
      setStatus(`Saved: ${filePath}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      setStatus(`Failed to save: ${errorMessage}`)
      setIsError(true)
    }
  }

  const svgToPng = (svgEl: SVGSVGElement): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Failed to get canvas context'))
        return
      }

      const svgData = new XMLSerializer().serializeToString(svgEl)
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(svgBlob)

      const img = new Image()
      img.onload = () => {
        canvas.width = img.width * 2
        canvas.height = img.height * 2
        ctx.scale(2, 2)
        ctx.drawImage(img, 0, 0)
        URL.revokeObjectURL(url)
        
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('Failed to create PNG blob'))
          }
        }, 'image/png')
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Failed to load SVG'))
      }
      img.src = url
    })
  }

  const handleExport = (format: 'svg' | 'png') => {
    const previewEl = document.getElementById('preview')
    const svgEl = previewEl?.querySelector('svg')
    if (!svgEl) {
      setStatus('No diagram to export')
      setIsError(true)
      return
    }

    if (format === 'svg') {
      const svgData = new XMLSerializer().serializeToString(svgEl)
      const blob = new Blob([svgData], { type: 'image/svg+xml' })
      const url = URL.createObjectURL(blob)

      const link = document.createElement('a')
      link.href = url
      link.download = 'diagram.svg'
      link.click()

      URL.revokeObjectURL(url)
      setStatus('Exported SVG')
    } else {
      svgToPng(svgEl)
        .then((blob) => {
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = 'diagram.png'
          link.click()
          URL.revokeObjectURL(url)
          setStatus('Exported PNG')
        })
        .catch((error) => {
          setStatus(`Export failed: ${error instanceof Error ? error.message : String(error)}`)
          setIsError(true)
        })
    }
    setIsError(false)
  }

  const handleLoadDemo = (demoCode: string) => {
    setCode(demoCode)
    setState(prev => ({ ...prev, isDirty: true }))
    setStatus('Loaded demo')
    setIsError(false)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    setIsDragging(true)
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation()
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -10 : 10
      setZoom(z => Math.min(500, Math.max(25, z + delta)))
    }
  }

  const handleResetView = () => {
    setZoom(100)
    setPan({ x: 0, y: 0 })
  }

  return (
    <TooltipProvider>
      <div 
        className="flex flex-col h-screen overflow-hidden"
        style={{ 
          backgroundColor: getThemeColors(state.currentTheme).bg,
          color: getThemeColors(state.currentTheme).fg,
        }}
      >
        {/* Toolbar */}
        <div 
          className="flex items-center justify-between px-4 py-2 border-b flex-shrink-0"
          style={{
            backgroundColor: getThemeColors(state.currentTheme).surface 
              ? hexToRgba(getThemeColors(state.currentTheme).surface!, 0.1)
              : (parseInt(getThemeColors(state.currentTheme).bg.slice(1, 3), 16) < 128
                  ? lightenColor(getThemeColors(state.currentTheme).bg, 8)
                  : darkenColor(getThemeColors(state.currentTheme).bg, 5)),
            borderColor: getThemeColors(state.currentTheme).border 
              ? hexToRgba(getThemeColors(state.currentTheme).border!, 0.3)
              : hexToRgba(getThemeColors(state.currentTheme).fg, 0.2),
          }}
        >
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={handleNew}>
                  <FilePlus className="w-4 h-4 mr-2" />
                  New
                </Button>
              </TooltipTrigger>
              <TooltipContent>New (Ctrl+N)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={handleOpen}>
                  <FolderOpen className="w-4 h-4 mr-2" />
                  Open
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open (Ctrl+O)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={handleSave}>
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </Button>
              </TooltipTrigger>
              <TooltipContent>Save (Ctrl+S)</TooltipContent>
            </Tooltip>

            <Separator orientation="vertical" className="h-6" />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="focus-visible:ring-0 focus-visible:outline-none">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleExport('svg')}>
                  Export as SVG
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('png')}>
                  Export as PNG
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Select onValueChange={handleLoadDemo}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Demos" />
              </SelectTrigger>
              <SelectContent>
                {demos.map((demo) => (
                  <SelectItem key={demo.name} value={demo.code}>
                    {demo.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-muted-foreground" />
            <Select 
              value={state.currentTheme} 
              onValueChange={(value) => setState(prev => ({ ...prev, currentTheme: value }))}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Theme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="tokyo-night">Tokyo Night</SelectItem>
                <SelectItem value="dracula">Dracula</SelectItem>
                <SelectItem value="github-dark">GitHub Dark</SelectItem>
                <SelectItem value="nord">Nord</SelectItem>
                <SelectItem value="one-dark">One Dark</SelectItem>
                <SelectItem value="solarized-light">Solarized Light</SelectItem>
                <SelectItem value="solarized-dark">Solarized Dark</SelectItem>
                <SelectItem value="monokai">Monokai</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Editor */}
          <div 
            className="w-1/2 flex flex-col border-r"
            style={{
              borderColor: getThemeColors(state.currentTheme).border
                ? hexToRgba(getThemeColors(state.currentTheme).border!, 0.3)
                : hexToRgba(getThemeColors(state.currentTheme).fg, 0.2),
            }}
          >
            <div 
              className="px-3 py-2 text-sm font-medium flex items-center gap-2 h-10"
              style={{
                backgroundColor: getThemeColors(state.currentTheme).surface
                  ? hexToRgba(getThemeColors(state.currentTheme).surface!, 0.05)
                  : (parseInt(getThemeColors(state.currentTheme).bg.slice(1, 3), 16) < 128
                      ? lightenColor(getThemeColors(state.currentTheme).bg, 5)
                      : darkenColor(getThemeColors(state.currentTheme).bg, 3)),
                color: getThemeColors(state.currentTheme).muted || getThemeColors(state.currentTheme).fg,
                borderColor: getThemeColors(state.currentTheme).border
                  ? hexToRgba(getThemeColors(state.currentTheme).border!, 0.2)
                  : hexToRgba(getThemeColors(state.currentTheme).fg, 0.15),
              }}
            >
              <FileCode className="w-4 h-4" />
              Editor
            </div>
            <div id="editor" className="flex-1 overflow-auto" />
          </div>

          {/* Preview */}
          <div className="w-1/2 flex flex-col">
            <div 
              className="px-3 py-2 text-sm font-medium flex items-center justify-between h-10"
              style={{
                backgroundColor: getThemeColors(state.currentTheme).surface
                  ? hexToRgba(getThemeColors(state.currentTheme).surface!, 0.05)
                  : (parseInt(getThemeColors(state.currentTheme).bg.slice(1, 3), 16) < 128
                      ? lightenColor(getThemeColors(state.currentTheme).bg, 5)
                      : darkenColor(getThemeColors(state.currentTheme).bg, 3)),
                color: getThemeColors(state.currentTheme).muted || getThemeColors(state.currentTheme).fg,
                borderColor: getThemeColors(state.currentTheme).border
                  ? hexToRgba(getThemeColors(state.currentTheme).border!, 0.2)
                  : hexToRgba(getThemeColors(state.currentTheme).fg, 0.15),
              }}
            >
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4" />
                Preview
              </div>
              <div className="flex items-center gap-1">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 px-2"
                  onClick={() => setZoom(z => Math.max(25, z - 25))}
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3 h-3" />
                </Button>
                <span className="text-xs min-w-[40px] text-center">{zoom}%</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 px-2"
                  onClick={() => setZoom(z => Math.min(500, z + 25))}
                  title="Zoom In"
                >
                  <ZoomIn className="w-3 h-3" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 px-2"
                  onClick={handleResetView}
                  title="Reset View"
                >
                  <RotateCcw className="w-3 h-3" />
                </Button>
              </div>
            </div>
            <div 
              id="preview" 
              className="flex-1 overflow-hidden flex items-center justify-center p-4 cursor-grab"
              style={{ 
                backgroundColor: getThemeColors(state.currentTheme).bg,
                userSelect: 'none',
                touchAction: 'none',
                overscrollBehavior: 'none',
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={handleWheel}
            >
              <div 
                className={isDragging ? '' : 'transition-transform duration-200'}
                style={{ 
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom / 100})`,
                  transformOrigin: 'center center',
                  cursor: isDragging ? 'grabbing' : 'grab',
                  userSelect: 'none',
                  pointerEvents: 'none',
                }}
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            </div>
          </div>
        </div>

        {/* Status Bar */}
        <div 
          className="flex items-center justify-between px-4 py-1.5 border-t text-sm"
          style={{
            backgroundColor: getThemeColors(state.currentTheme).surface
              ? hexToRgba(getThemeColors(state.currentTheme).surface!, 0.1)
              : (parseInt(getThemeColors(state.currentTheme).bg.slice(1, 3), 16) < 128
                  ? lightenColor(getThemeColors(state.currentTheme).bg, 8)
                  : darkenColor(getThemeColors(state.currentTheme).bg, 5)),
            borderColor: getThemeColors(state.currentTheme).border
              ? hexToRgba(getThemeColors(state.currentTheme).border!, 0.3)
              : hexToRgba(getThemeColors(state.currentTheme).fg, 0.2),
          }}
        >
          <div className="flex items-center gap-2">
            {isError ? (
              <X className="w-4 h-4 text-red-500" />
            ) : (
              <Check className="w-4 h-4 text-green-500" />
            )}
            <span className={isError ? 'text-red-500' : 'text-green-500'}>
              {status}
            </span>
          </div>
          <div style={{ color: getThemeColors(state.currentTheme).muted || getThemeColors(state.currentTheme).fg }}>
            Theme: {state.currentTheme}
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}

export default App
