# klipper-macro-prompt-protocol

Clean-room reference parser/reducer for the [Klipper Macro Prompt Protocol v1](../../SPEC.md).

```ts
import {
  initialPromptState, parseAction, reducePrompt, disconnectEvent, promptView, promptEpoch, parseMarkup
} from 'klipper-macro-prompt-protocol'

let state = initialPromptState({ frontendId: 'mainsail', frontendCategories: ['web'] })  // liveAppend?: boolean

for (const line of incomingActionLines) {
  const event = parseAction(line)
  if (event) state = reducePrompt(state, event)
}
// on Klipper/Moonraker disconnect:
state = reducePrompt(state, disconnectEvent())

const dialog = promptView(state)   // canonical shape: { visible, title, targets, size, items, footer_buttons }
const key = (i: number) => `${promptEpoch(state)}:${i}`   // render-key hint
// markup item → parseMarkup(item.markup) for a rich-text AST; or render item.plain_text
```

`promptView()` returns the language-neutral shape defined in SPEC.md §"Normalized Fixture State" —
the same shape the conformance fixtures assert and the Python port must match. State is an opaque,
JSON-serializable POJO; store it in Vuex and expose `promptView` via a property getter.

Treat `promptView()` output as an immutable snapshot. This package currently deep-clones that view
with `structuredClone`; integrations targeting older browsers or WebViews should verify runtime
support or adapt the clone boundary with a plain-object fallback before shipping.

`parseAction` expects raw Moonraker console lines carrying the `// action:` prefix (e.g. `// action:prompt_begin ...`), matching the `event_prefix` field used in the conformance fixtures.
