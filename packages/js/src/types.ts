// Public types for the Klipper Macro Prompt Protocol v1 engine.

export type PromptStyle = 'primary' | 'secondary' | 'info' | 'warning' | 'error' | 'success'
export type PromptTextSize = 'small' | 'normal' | 'large' | 'x-large'
export type PromptSize = PromptTextSize | 'full-screen'
export type PromptAlign = 'left' | 'center' | 'right'
export type PromptItemAlign = Exclude<PromptAlign, 'center'>

// ---- Canonical semantic view (== conformance == interop shape) -------------
export interface PromptView {
  visible: boolean
  title: string
  targets: string[]
  size: PromptSize | null
  items: PromptItem[]
  footer_buttons: PromptFooterButton[]
}

export type PromptItem =
  | { type: 'text'; text: string; align?: PromptItemAlign }
  | { type: 'markup'; markup: string; plain_text: string; align?: PromptItemAlign }
  | { type: 'image'; path: string; alt: string; scale: number | null; align?: PromptItemAlign }
  | { type: 'button'; label: string; gcode: string; style: PromptStyle; align?: PromptItemAlign }
  | { type: 'row'; children: PromptInlineItem[]; align?: PromptItemAlign }
  | { type: 'button_group'; children: PromptButtonItem[]; align?: PromptItemAlign }

export type PromptButtonItem = { type: 'button'; label: string; gcode: string; style: PromptStyle }
export type PromptInlineItem =
  | { type: 'text'; text: string }
  | { type: 'markup'; markup: string; plain_text: string }
  | { type: 'image'; path: string; alt: string; scale: number | null }
  | PromptButtonItem

export interface PromptFooterButton { label: string; gcode: string; style: PromptStyle }

// ---- Markup AST (returned by parseMarkup, for renderers; never stored) ------
export type MarkupNode =
  | { type: 'text'; text: string }
  | { type: 'tag'; tag: 'b' | 'i' | 'u'; children: MarkupNode[] }
  | { type: 'tag'; tag: 'color' | 'bgcolor'; value: string; children: MarkupNode[] }
  | { type: 'tag'; tag: 'size'; value: PromptTextSize; children: MarkupNode[] }

// ---- Protocol events (output of parseAction / disconnectEvent) --------------
export type PromptEvent =
  | { kind: 'begin'; title: string }
  | { kind: 'text'; text: string }
  | { kind: 'markup'; markup: string; plain_text: string }
  | { kind: 'image'; path: string; alt: string; scale: number | null }
  | { kind: 'button'; label: string; gcode: string; style: PromptStyle }
  | { kind: 'footer_button'; label: string; gcode: string; style: PromptStyle }
  | { kind: 'row_start' } | { kind: 'row_end' }
  | { kind: 'button_group_start' } | { kind: 'button_group_end' }
  | { kind: 'target'; targets: string[] }
  | { kind: 'size'; size: PromptSize | null }
  | { kind: 'align'; align: PromptAlign | null }
  | { kind: 'show' } | { kind: 'end' } | { kind: 'disconnect' }

export interface EngineOptions {
  frontendId: string
  frontendCategories: string[]
  liveAppend?: boolean
}

// ---- Opaque, JSON-serializable state ---------------------------------------
declare const PROMPT_STATE_BRAND: unique symbol
export interface PromptState { readonly [PROMPT_STATE_BRAND]: 'PromptState' }

// Internal shape (not part of the public contract; reached only via promptView/promptEpoch).
export interface PromptStateData {
  lifecycle: 'idle' | 'building' | 'shown' | 'suppressed'
  epoch: number
  title: string
  size: PromptSize | null
  activeTargets: string[]
  items: PromptItem[]
  footerButtons: PromptFooterButton[]
  activeContainer: 'row' | 'button_group' | null
  pendingTargets: string[] | null
  pendingSize: PromptSize | null
  currentAlign: PromptAlign
  opts: Required<EngineOptions>
}
