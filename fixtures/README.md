# Macro Prompt Protocol Fixtures

These fixtures are the shared Phase 1 contract for implementing Macro Prompt Protocol v1 in KlipperScreen, Fluidd, and Mainsail.

The fixture pack has two audiences:

- frontend tests can replay `fixtures.json` and compare final prompt state;
- maintainers can copy `macro-examples.cfg` into a Klipper config and inspect rendered prompts manually.

The fixtures intentionally use the received console/action message form:

```text
// action:prompt_begin Example
```

Frontends that parse the shorter command form can strip the `// action:` prefix before dispatching.

## Files

- `fixtures.json` contains machine-readable event streams and expected final state.
- `macro-examples.cfg` contains Klipper macros that emit equivalent prompt command streams.

## Expected State Shape

Each fixture has:

- `events`: ordered action messages to replay;
- `expected`: final state after all events are processed by a spec-compatible frontend;
- `notes`: compatibility details that may matter during implementation.

The expected shape is deliberately renderer-neutral. A GTK dialog, Vuetify dialog, or other UI does not need to match visual dimensions. It does need to preserve prompt state, item order, command parsing, fallback values, targeting decisions, and graceful degradation.

## Schema Versioning

`schema_version: 1` allows additive optional fields in `expected`. Implementations consuming fixtures must ignore unknown fields they do not yet support, and treat absent fields as "not asserted by this fixture" — not as "must equal default". This lets the fixture pack grow alongside new optional extensions (`prompt_size`, future hints) without forcing a major schema bump every time the protocol gains a per-prompt metadata field. A schema_version bump is reserved for breaking shape changes such as renamed required fields, removed fields, or changes in event-stream interpretation.

## Image Assets

Image fixtures reference files under:

```text
config/prompt-assets/
```

This repository includes the referenced fixture assets in `fixtures/prompt-assets/`:

- `spool.svg`
- `nozzle.png`
- `valid.svg`

For manual testing, copy those files into the printer config path used by Moonraker:

```text
~/printer_data/config/prompt-assets/
```

Parser tests can validate image item state without fetching the image bytes, but manual rendering tests should use these files so every frontend is tested against the same image sources.

## Target-Aware Tests

`target-touch-only` includes expected visibility for known frontend IDs:

- `klipperscreen`: visible
- `mainsail`: hidden
- `fluidd`: hidden

Older frontends that do not support `prompt_target` may still show the prompt. That is allowed by the spec and should be treated as legacy behavior, not fixture failure for target-unaware implementations.

## Portability Notes

- Do not treat unsupported optional commands as fatal.
- Do not require images to load before prompt content appears.
- Treat button field pipes as reserved separators.
- Keep `\|` and `\\` reserved for future escaping; these fixtures do not use them.
- Treat `PromptMarkup` as a protocol markup language, not HTML or Pango.
