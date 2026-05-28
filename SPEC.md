# Macro Prompt Protocol v1 Design

Date: 2026-05-28

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

Core v1 conformance covers the transport, core commands, lifecycle, live appends after `prompt_show`, button parsing, button execution, semantic styles, disconnect behavior, and graceful handling of unknown commands.

Optional v1 extensions cover targeting, button groups, rows, images, and PromptMarkup. These are part of the shared direction, but they should not block agreement on the core protocol.

## Core Commands

These commands form the portable baseline:

```text
prompt_begin <title>
prompt_text <text>
prompt_button <label>|<gcode>|<style>
prompt_footer_button <label>|<gcode>|<style>
prompt_show
prompt_end
```

`prompt_begin` starts a prompt and clears any existing prompt state. `prompt_text` appends a plain text block. `prompt_button` appends a content button. `prompt_footer_button` appends a footer/action button. `prompt_show` opens the current prompt. `prompt_end` closes and clears it.

## Optional v1 Extensions

Unsupported extension commands must be ignored without breaking the prompt.

```text
prompt_target <targets>
prompt_button_group_start
prompt_button_group_end
prompt_row_start
prompt_row_end
prompt_image <config-path>|<alt-text>|<scale>
prompt_markup <markup>
```

`prompt_text_scale` is intentionally not part of the shared v1 protocol. Rich text size is handled by `prompt_markup`. KlipperScreen may keep `prompt_text_scale` as a local compatibility alias, but macros intended for multiple frontends should use markup sizes.

`prompt_image_scale` is also intentionally not part of the shared v1 protocol. Image scale is handled by the optional third field on `prompt_image`. KlipperScreen may keep `prompt_image_scale` as a local compatibility alias, but macros intended for multiple frontends should use the image field form.

Button label markup is also not part of v1. Button labels remain plain text, and button appearance is controlled by semantic styles.

## Lifecycle

`prompt_begin` starts a new prompt definition. If a prompt is already being built or displayed, the new prompt replaces it. Prompt content commands received before `prompt_begin` are ignored, except for `prompt_target`, which applies to the next prompt.

`prompt_show` makes the current prompt visible but does not finalize it. Supported content commands received after `prompt_show` are appended live in source order. Repeating `prompt_show` while the prompt is visible is a no-op.

`prompt_show` before `prompt_begin` is a no-op.

`prompt_end` closes and clears the current prompt whether it has been shown or is still being built. `prompt_end` when no prompt exists is a no-op.

There is no v1 command to remove or replace an individual item. To replace prompt content, emit a new `prompt_begin` and rebuild the prompt.

Frontends must close active prompts on Klipper or Moonraker disconnect.

Compatibility note: KlipperScreen and Fluidd currently support live appends after `prompt_show`. Mainsail currently renders a snapshot of content before `prompt_show`. Adopting core v1 would require Mainsail to change that behavior, so this should be called out explicitly in the maintainer discussion.

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

## Rows

Rows group prompt content onto one line:

```text
prompt_row_start
prompt_image config/images/spool.svg|Spool preview|0.35
prompt_markup <b>Blue PLA</b>\n215 C
prompt_row_end
```

Items inside a row render on the same row in source order. Frontends should size row items with relative layout behavior appropriate to the client.

Unsupported row commands are ignored; contained items render in source order as normal block items. Rows may contain plain text, markup, images, and inline buttons. Footer buttons remain outside rows.

Rows must not be nested. Rows and button groups must not be nested inside each other in v1. If invalid nesting occurs, frontends may ignore inner grouping commands while preserving the contained content items in source order.

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

Supporting frontends render grouped buttons together. Unsupported frontends ignore group commands and still render contained buttons in source order.

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

Put useful baseline content before `prompt_show`, even though live appends are supported.

Use `prompt_text` when formatting is not needed. Use `prompt_markup` for concise emphasis, but do not make the prompt depend entirely on color.

Keep button labels short. Always use explicit `label|gcode|style` for portable buttons. Use helper macros for complex commands. Avoid `|` in labels, commands, alt text, and styles.

Put prompt assets under `config/images/` or `config/prompt-assets/`. Provide alt text for important images.

Design prompts so they still make sense if images, markup, rows, scaling, button groups, or targeting are unsupported.

Use `prompt_target` only as forward-compatible filtering. Older frontends may still show the prompt.

Avoid prompts that only a targeted frontend can answer unless a fallback path exists. If no connected supporting frontend matches the target, the prompt may be invisible while the macro waits for input.

Use `prompt_end` explicitly when a button should close the prompt.

## Observed Current Support

This table is based on source review on 2026-05-28 and should be corrected by maintainers if inaccurate.

| Feature | KlipperScreen | Mainsail | Fluidd |
| --- | --- | --- | --- |
| Core prompt commands | Yes | Yes | Yes |
| Live appends after `prompt_show` | Yes | No, snapshot on show | Yes |
| Button groups | Yes | Yes | No |
| Images | In KlipperScreen prompt image work | No | No |
| Image scale | In KlipperScreen prompt image work as standalone command | No | No |
| Markup | In KlipperScreen markup experiment | No | No |
| Rows | In KlipperScreen markup experiment | No | No |
| Target filtering | No | No | No |

Observed behavior references:

- KlipperScreen prompt routing: `screen.py::process_action`; prompt decoding: `ks_includes/widgets/prompts.py::Prompt.decode`.
- Mainsail prompt reconstruction: `src/components/dialogs/TheMacroPrompt.vue`, especially `activePrompt` and `activePromptContent`.
- Fluidd prompt state updates: `src/store/console/actions.ts::onUpdatePromptDialog`; dialog rendering: `src/components/common/ActionCommandPromptDialog.vue`.
- KlipperScreen image support work: commit `0fc9c142` on this branch.
- KlipperScreen markup and row experiment: commit `d09d0efb` / branch `prompt-markup-experiment`.

## Proposed Rollout

Proposed canonical home: a small neutral Markdown spec repository named `klipper-macro-prompt-protocol`. Until that exists, this document can serve as the initial draft linked from discussion issues.

Open a discussion-style issue titled "Cross-frontend prompt protocol v1: align existing action:prompt_* semantics" and cross-link it from KlipperScreen, Mainsail, and Fluidd. The proposer should file the initial issue and link the same draft/spec from each project.

The issue should focus on the shared spec first, not code changes. The asks are:

- Confirm the compatibility table.
- Identify behavior changes each frontend would need.
- Agree on core vs optional commands.
- Agree on ambiguity fixes: lifecycle, live appends, button defaults, pipe reservation, image fields, image path scope, markup grammar, row semantics, and targeting.

After maintainers agree on the spec, each frontend can open implementation PRs against its own codebase.
