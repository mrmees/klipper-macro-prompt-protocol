# Macro Prompt Protocol v1 Design

Date: 2026-05-29 (revision following Fluidd reference implementation)

## Purpose

KlipperScreen, Mainsail, and Fluidd all consume Klipper `RESPOND TYPE=command` messages that begin with `action:prompt_`, but the behavior is only partially documented and each frontend has grown its own interpretation. This proposal defines a small shared prompt protocol so macro authors can create prompts that work across frontends while still allowing richer clients to support images, markup, rows, and targeting.

The goal is to standardize the existing line-oriented protocol, not replace it with JSON or a new transport. This is a frontend convention layered on existing `[respond]` action messages; it does not require changes to Klipper or Moonraker.

## Transport

Macros continue to emit commands through Klipper's `[respond]` module:

```ini
RESPOND TYPE=command MSG="action:prompt_begin My Prompt"
```

Frontends receive the action message and interpret the command after `action:`. This design describes commands using the shorter form, for example `prompt_begin My Prompt`.

Each command is one line. Command arguments are UTF-8 text, and frontends must not assume ASCII. Use multiple prompt items or `\n` inside `prompt_markup` for line breaks.

## Goals

- Preserve current prompt macros where possible.
- Define core commands every supporting frontend should implement.
- Define optional extensions that unsupported frontends can ignore safely.
- Keep rendering semantic, not pixel-perfect.
- Support richer prompts with images, safe markup, rows, and target filters.
- Keep authoring practical inside Klipper macros.

## Non-Goals

- Replacing the current `action:prompt_*` protocol with JSON.
- Per-pixel layout compatibility across GTK, desktop web, mobile web, and touchscreens.
- Remote image URLs.
- Local absolute paths or `~` paths.
- Arbitrary HTML, CSS, JavaScript, active SVG content, or external resources.
- Per-client prompt ownership or "already answered" state.
- A command to remove or replace individual prompt items.

## Conformance Levels

The proposal separates the base agreement from richer optional features so maintainers can adopt the protocol in stages.

Core v1 conformance covers the transport, core commands, lifecycle through `prompt_show`, button parsing, button groups, button execution, semantic styles, disconnect behavior, and graceful handling of unknown commands.

Optional v1 extensions cover live appends after `prompt_show`, targeting, prompt size, rows, images, and PromptMarkup. These are part of the shared direction, but they should not block agreement on the core protocol.

## Core Commands

These commands form the portable baseline:

```text
prompt_begin <title>
prompt_text <text>
prompt_button <label>|<gcode>|<style>
prompt_footer_button <label>|<gcode>|<style>
prompt_button_group_start
prompt_button_group_end
prompt_show
prompt_end
```

`prompt_begin` starts a prompt and clears any existing prompt state. `prompt_text` appends a plain text block. `prompt_button` appends a content button. `prompt_footer_button` appends a footer/action button. Button group commands mark adjacent content buttons as related. `prompt_show` opens the current prompt. `prompt_end` closes and clears it.

## Optional v1 Extensions

Unsupported extension commands must be ignored without breaking the prompt.

```text
prompt_target <targets>
prompt_size <size>
prompt_row_start
prompt_row_end
prompt_image <config-path>|<alt-text>|<scale>
prompt_markup <markup>
```

`prompt_text_scale` is intentionally not part of the shared v1 protocol. Rich text size is handled by `prompt_markup`. KlipperScreen may keep `prompt_text_scale` as a local compatibility alias, but macros intended for multiple frontends should use markup sizes.

`prompt_image_scale` is also intentionally not part of the shared v1 protocol. Image scale is handled by the optional third field on `prompt_image`. KlipperScreen may keep `prompt_image_scale` as a local compatibility alias, but macros intended for multiple frontends should use the image field form.

Button label markup is also not part of v1. Button labels remain plain text, and button appearance is controlled by semantic styles.

## Normalized Fixture State

The fixture pack describes conformance with an abstract normalized prompt state. Implementations do not need to use this JSON shape internally, but a conformant parser/reducer must be able to replay each core fixture's `events` and produce equivalent state for the fields asserted by that fixture's `expected` object.

Optional fixtures apply to implementations that claim the corresponding extension. When a fixture provides `expected_by_frontend`, use the expected state for the implementation's frontend identity instead of the generic `expected` object.

`schema_version` versions this expected-state shape. Additive optional fields do not require a version bump; breaking shape changes such as renamed required fields, removed fields, or changed event interpretation do.

```text
PromptDialog:
  visible: boolean
  title: string
  targets: string[]                 # ["all"] when untargeted
  size?: "small" | "normal" | "large" | "x-large" | "full-screen" | null
                                     # null means no explicit size hint / frontend default
                                     # absent means not asserted
  items: PromptItem[]
  footer_buttons: FooterButton[]

PromptItem:
  { type: "text", text: string }
  { type: "markup", markup: string, plain_text: string }
  { type: "image", path: string, alt: string, scale: number | null }
  { type: "button", label: string, gcode: string, style: Style }
  { type: "row", children: InlineItem[] }
  { type: "button_group", children: ButtonItem[] }

InlineItem:
  text | markup | image | button

ButtonItem:
  button

FooterButton:
  { label: string, gcode: string, style: Style }

Style:
  "primary" | "secondary" | "info" | "warning" | "error" | "success"
```

`markup` preserves the raw PromptMarkup string. `plain_text` is the decoded fallback text for clients that do not render rich text. The normalized state deliberately excludes implementation-only fields such as renderer keys, stable item IDs, reducer machine state, and parsed markup ASTs.

Implementations that expose this normalized shape to renderers should treat it as an immutable snapshot boundary: consumer mutations to returned items, rows, button groups, or footer buttons must not alter reducer state. JavaScript integrations should verify that their target browser or WebView supports any clone primitive used at that boundary, such as `structuredClone`, or provide a plain-object clone fallback.

## Lifecycle

`prompt_begin` starts a new prompt definition. If a prompt is already being built or displayed, the new prompt replaces it. Prompt content commands received before `prompt_begin` are ignored, except for `prompt_target` and `prompt_size`, which both apply to the next prompt.

`prompt_show` makes the current prompt visible. Repeating `prompt_show` while the prompt is visible is a no-op.

Live appends after `prompt_show` are an optional v1 capability. The portable core baseline is that all content needed for the prompt's initial meaning appears before `prompt_show`. Frontends that support live appends update the visible prompt as later supported content commands arrive. Frontends that snapshot at `prompt_show` may ignore later content until they adopt the live-append capability or a shared reducer that preserves shown-state appends.

`prompt_show` before `prompt_begin` is a no-op.

`prompt_end` closes and clears the current prompt whether it has been shown or is still being built. `prompt_end` also clears pending pre-begin metadata such as `prompt_target` and `prompt_size`. When no prompt exists and no metadata is pending, `prompt_end` is a no-op.

There is no v1 command to remove or replace an individual item. To replace prompt content, emit a new `prompt_begin` and rebuild the prompt.

Frontends must close active prompts on Klipper or Moonraker disconnect.

Disconnect is modeled as an explicit reset, distinct from `prompt_end`: it clears the active prompt,
any pending `prompt_target`/`prompt_size`, and any open `row`/`button_group` container, returning the
prompt to the idle, visible-to-all baseline. Reconnect recovery is reset-then-replay: a frontend
rebuilds prompt state from buffered console history starting from a fresh state, never by diffing
against retained state.

User-initiated dismissal must come from an explicit action on the prompt itself: a dedicated close control (such as a close button on the prompt's own chrome) or a footer button whose gcode emits `prompt_end`. Frontends must not broadcast `prompt_end` as a side effect of unrelated UI events, such as the Escape key closing a different modal, a backdrop click on an adjacent dialog, or routing changes that close other application chrome. Because `prompt_end` is broadcast to all connected clients, accidental dismissal on one frontend would close the prompt on every other connected frontend. Supporting frontends should prefer persistent/modal dialog implementations that require explicit user action to dismiss.

Local lifecycle events on the frontend — browser refresh, tab or window close, app unmount, page navigation, or any client-side teardown — must not emit `prompt_end`. These are local-only events. The active prompt is closed locally because the frontend is going away; emitting `prompt_end` would close the prompt on every other connected client as well. The protocol does not require prompt persistence across reconnects. A reconnecting frontend may reconstruct prompt state from retained console/gcode-store history where that is available, but clients should not depend on another frontend preserving or replaying prompt state.

Compatibility note: KlipperScreen and the Fluidd reference implementation support live appends after `prompt_show`. Current Mainsail renders a snapshot of content before `prompt_show`; its `activePrompt` reconstruction excludes later prompt commands from rendered state. A shared parser/reducer could make this a renderer timing policy over the same normalized state, but current Mainsail behavior should be reviewed explicitly before live appends are promoted beyond optional v1.

## Targeting

Targeting is forward-compatible filtering only. Older frontends will ignore `prompt_target` and may still show the prompt.

```text
prompt_target klipperscreen,touch
prompt_begin Manual Load
prompt_text Use the touchscreen to continue.
prompt_show
```

`prompt_target <targets>` applies to the next `prompt_begin` and is consumed when that prompt begins. If omitted, the prompt targets `all`. If multiple `prompt_target` commands are received before `prompt_begin`, the last one wins.

Targets are comma-separated, trimmed, and compared case-insensitively. Supporting frontends display the prompt only if the target list contains `all`, their concrete frontend ID, or one of their categories. A frontend that supports targeting but does not match the target list ignores the prompt until the next `prompt_begin` or `prompt_end`.

Initial target names are:

```text
all
klipperscreen
mainsail
fluidd
web
touch
```

Target names are extensible. New concrete frontend IDs or categories should be added by updating this spec. A frontend that implements targeting but has no known ID or category should match only `all`.

`prompt_target` received during an active prompt applies only to the next prompt, not the current one.

If `prompt_target` is present but its argument is empty, whitespace-only, or contains only separators after trimming, the resulting target list is empty. Target-aware frontends do not match an empty target list and so do not display the prompt. To target all frontends, omit `prompt_target` entirely instead of supplying an empty list — `all` is the default only in the absence of the command. `prompt_end` clears any pending target list, mirroring the `prompt_size` cleanup rule.

## Prompt Size

`prompt_size` is a forward-compatible advisory hint about the dialog envelope. Older frontends will ignore it and render the prompt at their default size.

```text
prompt_size <size>
```

Supported size values are `small`, `normal`, `large`, `x-large`, and `full-screen`. Values are compared case-insensitively. Missing, empty, or unknown size arguments mean "no explicit size hint"; the prompt renders at the frontend default. This replaces any previously pending size hint, so a bad or empty `prompt_size` does not leak an earlier size into the next prompt.

`prompt_size` applies to the next `prompt_begin` and is consumed when that prompt begins. If omitted, the prompt opens at the frontend's default size, conventionally `normal`. If multiple `prompt_size` commands are received before `prompt_begin`, the last one wins. `prompt_size` received during an active prompt applies only to the next prompt, not the current one.

Pending size metadata is consumed by the next `prompt_begin` even if that prompt is suppressed by `prompt_target` on the receiving frontend. The pending value does not leak across to a later visible prompt.

`prompt_end` clears any pending size, restoring the frontend default for the next `prompt_begin`. This mirrors the behavior of `prompt_target` pending state, so `prompt_end` produces a clean baseline regardless of which extensions were buffered.

`prompt_size` controls the **dialog envelope** size: the outer container that holds prompt content. This is intentionally distinct from PromptMarkup `<size:...>`, which controls the size of **text runs inside content items**. The two operate on different layers; macros may combine them. For example, a prompt declared `prompt_size large` may still contain `<size:small>` text runs.

The `full-screen` value is distinct from the text-size ladder. It requests that the dialog fill the available viewport (or equivalent on touchscreen clients) instead of rendering as a sized modal. Web frontends typically map this to a fullscreen dialog mode (e.g., Vuetify's `fullscreen` prop). KlipperScreen and other clients with fixed dialog sizing should treat `full-screen` as advisory and may render at their largest available size, including `x-large`.

`prompt_size` is a best-effort hint. Frontends may clamp, downgrade, or ignore the value based on viewport constraints, kiosk mode, touchscreen geometry, accessibility preferences, or local UX policy.

Example Fluidd reference implementation mapping (illustrative, not normative):

| Size | Width |
| --- | --- |
| `small` | 400 px max-width |
| `normal` | 600 px max-width (default) |
| `large` | 800 px max-width |
| `x-large` | 1000 px max-width |
| `full-screen` | Viewport-filling (Vuetify `fullscreen`) |

Frontends are free to pick their own pixel mappings or other size mechanisms.

## Button Parsing and Behavior

Buttons use pipe-separated fields:

```text
prompt_button <label>|<gcode>|<style>
prompt_footer_button <label>|<gcode>|<style>
```

`label` is required. If `label` is empty, the button is ignored. `gcode` is optional and defaults to `label` if omitted or empty. `style` is optional and defaults to `secondary` if omitted, empty, or unknown.

Style names are trimmed and compared case-insensitively. Macro authors should still write lower-case style names.

The pipe character `|` is reserved in v1 fields. Portable macros should not put `|` in labels, gcode, alt text, or styles. The sequences `\|` and `\\` are reserved for a future escaping rule and should not be used by portable macros. Complex commands should call a helper macro:

```text
prompt_button Do thing|_PROMPT_DO_THING|primary
```

Pressing a button sends its configured gcode and does not automatically close the prompt. If a button should close the prompt, its gcode should emit `action:prompt_end` directly or call a helper macro that does.

Content buttons expand to fill the available width of their cell or container; frontends should not size a button to its label text. Inside a `row` or `button_group`, this means each button fills its equal-width cell, so a row of buttons reads as a balanced set of equal-width controls. (Footer buttons are sized by their action bar, not by this rule.)

Footer buttons render in an action bar visually separated from prompt content. Their relative order is preserved.

The frontend close control sends:

```ini
RESPOND TYPE=command MSG="action:prompt_end"
```

Supported semantic styles are:

```text
primary
secondary
info
warning
error
success
```

Frontends map these styles to their own UI system. Unknown styles fall back to `secondary`.

## Images

Images are optional prompt items:

```text
prompt_image config/images/spool.svg|Blue PLA spool preview|0.75
```

The image path must be a Moonraker `config/...` resource path.

Valid image paths:

- use forward slashes;
- start with `config/`;
- do not start with `/` or `~`;
- do not contain empty path segments;
- do not contain `.` or `..` path segments;
- do not contain `:` in any path segment.

Remote URLs, local filesystem paths, and Windows drive paths are invalid.

Required interoperable formats are PNG, JPEG, and SVG. SVGs are image assets only. Web frontends should render SVGs through safe image mechanisms such as `<img>` and must not inject SVG markup into the DOM. Macro authors should use static SVGs with no scripts, no external references, and no interactive content.

The second field is optional alt/fallback text. If the image loads, frontends may use alt text for accessibility or tooltips. If the image fails, is unsupported, or is rejected by local policy, the frontend should render the alt text as plain text. If no alt text is present, the failed image may be omitted or replaced with a generic placeholder.

The protocol does not define hard file size or dimension caps. Frontends may downscale, cache, reject, or omit images according to local resource constraints.

Image loading is best-effort and may be asynchronous. Failed image loads must not prevent the rest of the prompt from rendering.

The third field is optional scale. It is an advisory positive finite multiplier. The decimal separator is `.`; values such as `0,35` are invalid. Invalid, non-finite, zero, or negative values are ignored. Frontends may clamp or ignore scale hints according to their layout and device constraints.

Frontends should bound rendered image dimensions so a tall or large image cannot overflow the dialog. The Fluidd and Mainsail implementations fit each image into a square box whose base dimension is tied to the dialog (`prompt_size`) envelope — roughly the dialog width divided by three — and then multiplied by `scale`:

| Dialog size | Image base (scale 1) |
| --- | --- |
| `small` | ~133 px |
| `normal` | ~200 px |
| `large` | ~267 px |
| `x-large` | ~333 px |
| `full-screen` | ~33vw (viewport-relative, tracks window resizing) |

The image is fit within that base × `scale` box with aspect ratio preserved (`object-fit: contain`), so both width and height are bounded. `scale` omitted/invalid means 1. These pixel values are a recommended baseline, not normative — frontends may pick other bounds, but should bound both dimensions rather than render images at intrinsic size.

If scale is needed without alt text, keep the empty alt field:

```text
prompt_image config/images/spool.svg||0.75
```

## Rich Text Markup

`prompt_text` is plain text. It does not parse tags.

`prompt_markup` supports PromptMarkup, a small safe markup language that is not HTML and not Pango markup, even if frontends translate it internally.

Supported PromptMarkup tags are:

```text
<b>...</b>
<i>...</i>
<u>...</u>
<color:#rrggbb>...</color>
<bgcolor:#rrggbb>...</bgcolor>
<size:small>...</size>
<size:normal>...</size>
<size:large>...</size>
<size:x-large>...</size>
```

Tags must be properly nested and may repeat:

```text
prompt_markup <b><color:#22c55e>Ready</color></b>
```

PromptMarkup values:

- Colors are exactly six hexadecimal digits prefixed by `#`, for example `#22c55e`. Hex digits are case-insensitive. Three-digit colors, named colors, RGB functions, and CSS variables are not supported.
- Sizes are `small`, `normal`, `large`, or `x-large`, compared case-insensitively.
- Background color applies to inline text runs. A background span should not be used as a layout block.

Escapes inside PromptMarkup are:

```text
&lt;   renders <
&gt;   renders >
&amp;  renders &
\n     renders a line break
```

Entities are decoded once and never re-parsed as markup. For example, `&amp;lt;` renders as the literal text `&lt;`.

Unknown tags are stripped while preserving inner text. Invalid color or size values are ignored while preserving inner text. Unsupported frontends should strip markup and display readable plain text.

Informal grammar:

```text
markup      = (text | escape | tag)*
tag         = simple_tag | value_tag
simple_tag  = "<" ("b" | "i" | "u") ">" markup "</" same-name ">"
value_tag   = "<" ("color" | "bgcolor" | "size") ":" value ">" markup "</" same-name ">"
```

## Alignment and Layout Defaults

Individual prompt items — text, markup, images, and content buttons — default to **centered** horizontal alignment within the dialog. Frontends SHOULD center item content, and macros may rely on this default rather than specifying alignment.

Layout features change the arrangement *within* that centered default, and are the only v1 mechanisms that do so:

- `prompt_row_*` lays its children out as equal-width cells with content centered within each cell (see Rows).
- `prompt_button_group_*` lays grouped buttons out as equal-width cells (see Button Groups).
- Footer buttons (`prompt_footer_button`) render in a separate action bar, outside the centered content flow (see Button Parsing and Behavior).

Vertical alignment and overall dialog placement are frontend/display conventions and are not specified by v1. A future `prompt_align` extension (see Future Considerations) may add per-item horizontal control; until it exists, centered is the assumed default and portable macros must not depend on any other per-item alignment.

## Rows

Rows group prompt content onto one line:

```text
prompt_row_start
prompt_image config/images/spool.svg|Spool preview|0.35
prompt_markup <b>Blue PLA</b>\n215 C
prompt_row_end
```

Items inside a row render on the same row in source order. Frontends should size row items with relative layout behavior appropriate to the client.

Supporting frontends are recommended to render row items as equal-width cells with content centered within each cell. This convention improves consistency on clients that adopt it: a row of image + text + button reads as one balanced unit instead of three left-flushed items. Portable prompts must remain usable if a frontend chooses a different layout — macro authors should not design prompts that fail to communicate without the equal-width-cells convention. Frontends with strong local layout conventions (small touchscreens, fixed-width GTK widgets, accessibility-driven layouts) may deviate.

Unsupported row commands are ignored; contained items render in source order as normal block items. Rows may contain plain text, markup, images, and inline buttons. Footer buttons remain outside rows.

Rows must not be nested. Rows and button groups must not be nested inside each other in v1. Malformed container commands degrade deterministically: a `row_end` or `button_group_end` with no
matching open container is ignored; a `row_start`/`button_group_start` while a container is already
open is ignored (its inner content items still append to the already-open container, in source order).

## Button Groups

Button groups express that adjacent content buttons belong together:

```text
prompt_button_group_start
prompt_button +10|_MOVE_PLUS_10|secondary
prompt_button +1|_MOVE_PLUS_1|secondary
prompt_button -1|_MOVE_MINUS_1|secondary
prompt_button -10|_MOVE_MINUS_10|secondary
prompt_button_group_end
```

Frontends render grouped buttons together while preserving the source order of the contained buttons.

Frontends are recommended to render grouped buttons with consistent equal-width sizing across the group. This convention improves consistency on clients that adopt it — a `+10 / +1 / -1 / -10` jog cluster reads as one unit of related controls. Portable prompts must remain usable if a frontend chooses a different layout. Frontends with strong local conventions may deviate.

Button groups must not be nested. Button groups and rows must not be nested inside each other in v1. If invalid nesting occurs, frontends may ignore inner grouping commands while preserving the contained content items in source order.

## Multi-Frontend Behavior

Prompt actions are broadcast through Klipper/Moonraker. Multiple connected frontends may display the same prompt.

A button press from any frontend sends its configured gcode to Klipper. If that gcode emits `prompt_end`, all frontends should close the prompt when they receive it.

The v1 protocol does not define per-client routing, ownership, locking, or "already answered" state. `prompt_target` is only a frontend-side filter for clients that implement it.

## Security Model

Prompts are macro-authored UI content, not trusted frontend code.

`prompt_markup` must not execute scripts, event handlers, CSS, links, embedded images, or external resources. SVG images are rendered only as image assets. Remote URLs are not supported.

`prompt_image` paths are limited to Moonraker `config/...` resources. Frontends reject unsafe paths and may reject unsafe markup or images according to local policy.

Unknown commands, unknown tags, invalid colors, invalid sizes, and failed images degrade without breaking the prompt.

Button gcode is intentionally macro-authored command execution. This protocol does not sandbox button actions.

## Macro Author Guidance

Put useful baseline content before `prompt_show`. Live appends are optional, so portable prompts should not depend on post-show content for their initial meaning.

Use `prompt_text` when formatting is not needed. Use `prompt_markup` for concise emphasis, but do not make the prompt depend entirely on color.

Keep button labels short. Always use explicit `label|gcode|style` for portable buttons. Use helper macros for complex commands. Avoid `|` in labels, commands, alt text, and styles.

Put prompt assets under `config/images/` or `config/prompt-assets/`. Provide alt text for important images.

Design prompts so they still make sense if images, markup, rows, scaling, or targeting are unsupported.

Use `prompt_target` only as forward-compatible filtering. Older frontends may still show the prompt.

Avoid prompts that only a targeted frontend can answer unless a fallback path exists. If no connected supporting frontend matches the target, the prompt may be invisible while the macro waits for input.

Use `prompt_end` explicitly when a button should close the prompt.

Prompts do not persist across Klipper restarts, Moonraker reconnects, or frontend disconnects. Frontends close active prompts on disconnect (see Lifecycle). To resume a prompt after a controlled restart — for example, a `RESTART` that interrupts a multi-step manual workflow — define the prompt in a `[delayed_gcode]` block and trigger it conditionally at startup based on persisted macro state. The pattern keeps resume responsibility in macro space without requiring per-client state in the protocol:

```ini
# Re-emits the prompt. Called from the conditional check below.
[delayed_gcode RESUME_LOAD_FILAMENT_PROMPT]
gcode:
  RESPOND TYPE=command MSG="action:prompt_begin Resume filament load"
  RESPOND TYPE=command MSG="action:prompt_text Continue from where you left off."
  RESPOND TYPE=command MSG="action:prompt_footer_button Continue|_RESUME_LOAD_STEP_2|primary"
  RESPOND TYPE=command MSG="action:prompt_show"

# Runs once at Klipper startup (initial_duration triggers it).
# Re-fires the prompt only if the workflow was mid-flight when the restart happened.
[delayed_gcode CHECK_RESUME_AFTER_RESTART]
initial_duration: 1
gcode:
  {% set svv = printer.save_variables.variables %}
  {% if svv.resume_load_pending|default(false) %}
    UPDATE_DELAYED_GCODE ID=RESUME_LOAD_FILAMENT_PROMPT DURATION=1
  {% endif %}
```

The macro that begins the workflow is responsible for setting the persistent flag (`SAVE_VARIABLE VARIABLE=resume_load_pending VALUE=True`) when the prompt is first shown, and clearing it (`SAVE_VARIABLE VARIABLE=resume_load_pending VALUE=False`) on completion or explicit cancel. `[save_variables]` must be configured in `printer.cfg` for the persisted flag to survive restarts.

The protocol intentionally has no per-client routing or "already answered" state. Macros that need restart resumption should treat this as macro-side responsibility.

## Future Considerations

The following ideas were discussed during initial design and deferred from v1. They are recorded here so future revisions can resume the design conversation without losing context. They are NOT part of the v1 protocol. Frontends should not implement them based on this section, and macros should not depend on them.

### Per-item alignment

Discussed 2026-05-29 during the Fluidd reference implementation design and deferred. Frontends should NOT implement this based on this section; it is design context only, not a forward commitment.

Rationale for deferral: per Alignment and Layout Defaults, individual items already default to centered alignment, so the motivating use case — fine-grained per-item layout polish — is not a generally-felt pain. When macro authors do need richer composition (e.g., a label-then-value horizontal layout, or padding to push content into a particular cell), the existing `row` primitive composes naturally: multiple rows, padded with empty-string text items or blank images, give authors layout control without protocol surface growth. Authors who want that level of polish are also the authors most willing to spend effort composing it from existing primitives.

If a future revision revisits this, it should define requirements and compatibility constraints before choosing command syntax.

### Prompt inputs

Discussed 2026-05-30 after reviewing the existing Mainsail experimental prompt-input work. `prompt_input` is reserved as a possible future optional extension so future designs do not accidentally choose an incompatible command name, but it is NOT part of v1. Frontends should not implement it based on this section alone, and portable v1 macros must not depend on it.

Observed experimental Mainsail shape:

```text
prompt_input <label>|<macro-name>|<variable-name>|<default-value>|<placeholder>
```

The separating space after `prompt_input` matters for the existing line grammar; `prompt_input|...` would be parsed as the command name rather than as an input command with pipe-separated fields.

Before promotion, a future revision should define at least: input lifecycle and submit timing, escaping/serialization for arbitrary user text, behavior when macro or variable names are missing or invalid, whether the frontend should write macro variables directly or emit a macro-authored gcode action, how multiple connected frontends race or synchronize edits, whether input values are visible in console history, and fallback behavior for frontends that ignore the command.

## Observed Current Support

This table is based on source review on 2026-05-28 (KlipperScreen, Mainsail, and Fluidd upstream/current) plus the Fluidd reference implementation as of 2026-05-29. It should be corrected by maintainers if inaccurate.

| Feature | KlipperScreen current | Mainsail current | Fluidd current | Fluidd reference branch |
| --- | --- | --- | --- | --- |
| Base prompt lifecycle and buttons | Yes | Yes | Yes | Yes |
| Live appends after `prompt_show` | Yes | No, snapshot on show | Yes | Yes |
| Button groups | Yes | Yes | No | Yes |
| Rows | In KlipperScreen markup experiment | No | No | Yes |
| Images | In KlipperScreen prompt image work | No | No | Yes |
| Image scale | In KlipperScreen prompt image work as standalone command | No | No | Yes |
| Markup | In KlipperScreen markup experiment | No | No | Yes |
| Target filtering | No | No | No | Yes |
| Prompt size (envelope) | No | No | No | Yes, incl. `full-screen` |
| Equal-width-cells row/group layout convention | Unknown | Unknown | Unknown | Yes |
| Explicit-dismissal-only dialog convention | Unknown | Unknown | Unknown | Yes |

Because button groups are now part of core v1, current Fluidd would need button-group support before claiming v1 core conformance.

The Fluidd reference implementation lives on `mrmees/fluidd` branch `feat/macro-prompt-protocol-v1`. It implements core v1, all optional v1 extensions, and `prompt_size`. It is not (yet) proposed for merge into upstream `fluidd`.

Observed behavior references:

- KlipperScreen prompt routing: `screen.py::process_action`; prompt decoding: `ks_includes/widgets/prompts.py::Prompt.decode`.
- Mainsail prompt reconstruction: `src/components/dialogs/TheMacroPrompt.vue`, especially `activePrompt` and `activePromptContent`.
- Fluidd prompt state updates: `src/store/console/actions.ts::onUpdatePromptDialog`; dialog rendering: `src/components/common/ActionCommandPromptDialog.vue`.
- KlipperScreen image support work: commit `0fc9c142` on this branch.
- KlipperScreen markup and row experiment: commit `d09d0efb` / branch `prompt-markup-experiment`.

## Proposed Rollout

Current draft home: `mrmees/klipper-macro-prompt-protocol`. This document is the v1 draft hosted there. Fixtures and macro examples live alongside it under `fixtures/`. A permanent canonical home should be decided after cross-frontend maintainer agreement.

Open a discussion-style issue titled "Cross-frontend prompt protocol v1: align existing action:prompt_* semantics" and cross-link it from KlipperScreen, Mainsail, and Fluidd. The proposer should file the initial issue and link this spec from each project. The Fluidd reference implementation (`mrmees/fluidd` branch `feat/macro-prompt-protocol-v1`) is available as a working artifact to ground the discussion.

The issue should focus on the shared spec first, not code changes. The asks are:

- Confirm the compatibility table.
- Identify behavior changes each frontend would need.
- Agree on core vs optional commands.
- Agree on ambiguity fixes: lifecycle, live-append capability level, button defaults, button-group semantics, pipe reservation, image fields, image path scope, markup grammar, row semantics, targeting, prompt size, dismissal semantics, equal-width-cells layout convention for rows and button groups, normalized fixture state, and the recommended restart-resumption pattern via `[delayed_gcode]`.

After maintainers agree on the spec, each frontend can open implementation PRs against its own codebase.
