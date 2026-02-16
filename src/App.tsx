import { useState, useEffect, useRef, useCallback } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { mermaid } from 'codemirror-lang-mermaid'
import { keymap } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { renderMermaid, THEMES } from 'beautiful-mermaid'
import { open, save } from '@tauri-apps/plugin-dialog'
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
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

function App() {
  const [state, setState] = useState<AppState>({
    currentFile: null,
    isDirty: false,
    currentTheme: 'default',
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

  const getThemeColors = (themeName: string): ThemeColors => {
    return themeMap[themeName] || themeMap.default
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
        keymap.of([...defaultKeymap, ...historyKeymap]),
        history(),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            setState(prev => ({ ...prev, isDirty: true }))
            debouncedRender()
          }
        }),
        EditorView.theme({
          '&': { height: '100%' },
          '.cm-scroller': { overflow: 'auto' },
          '.cm-content': { fontFamily: 'monospace', fontSize: '14px' },
        }),
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

  const handleExport = () => {
    const previewEl = document.getElementById('preview')
    const svgEl = previewEl?.querySelector('svg')
    if (!svgEl) {
      setStatus('No diagram to export')
      setIsError(true)
      return
    }

    const svgData = new XMLSerializer().serializeToString(svgEl)
    const blob = new Blob([svgData], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = 'diagram.svg'
    link.click()

    URL.revokeObjectURL(url)
    setStatus('Exported SVG')
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
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -10 : 10
      setZoom(z => Math.min(200, Math.max(25, z + delta)))
    }
  }

  const handleResetView = () => {
    setZoom(100)
    setPan({ x: 0, y: 0 })
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col h-screen bg-background">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 border-b bg-card">
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

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={handleExport}>
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export as SVG</TooltipContent>
            </Tooltip>

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
          <div className="w-1/2 border-r flex flex-col">
            <div className="px-3 py-2 text-sm font-medium text-muted-foreground bg-muted/50 flex items-center gap-2">
              <FileCode className="w-4 h-4" />
              Editor
            </div>
            <div id="editor" className="flex-1 overflow-auto" />
          </div>

          {/* Preview */}
          <div className="w-1/2 flex flex-col">
            <div className="px-3 py-2 text-sm font-medium text-muted-foreground bg-muted/50 flex items-center justify-between">
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
                  onClick={() => setZoom(z => Math.min(200, z + 25))}
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
        <div className="flex items-center justify-between px-4 py-1.5 border-t bg-card text-sm">
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
          <div className="text-muted-foreground">
            Theme: {state.currentTheme}
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}

export default App
