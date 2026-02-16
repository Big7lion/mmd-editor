import { useState, useEffect, useRef, useCallback } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { mermaid } from 'codemirror-lang-mermaid'
import { autocompletion, CompletionContext, CompletionResult } from '@codemirror/autocomplete'
import { keymap } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
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
      <div className="flex flex-col h-screen bg-background overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 border-b bg-card flex-shrink-0">
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
