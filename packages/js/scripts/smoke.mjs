import * as api from '../dist/index.js'
const required = ['parseAction','disconnectEvent','initialPromptState','reducePrompt','promptView','promptEpoch','parseMarkup','markupToPlainText']
const missing = required.filter(n => typeof api[n] !== 'function')
if (missing.length) { console.error('smoke FAIL, missing:', missing); process.exit(1) }
// exercise a minimal flow
let s = api.initialPromptState({ frontendId: 'mainsail', frontendCategories: ['web'] })
for (const l of ['// action:prompt_begin T','// action:prompt_text hi','// action:prompt_show']) { const e = api.parseAction(l); if (e) s = api.reducePrompt(s, e) }
const v = api.promptView(s)
if (!v.visible || v.items.length !== 1) { console.error('smoke FAIL: bad view', JSON.stringify(v)); process.exit(1) }
console.log('smoke OK')
