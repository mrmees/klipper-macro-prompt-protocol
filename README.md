# Klipper Macro Prompt Protocol

Draft shared protocol for Klipper macro prompts rendered by KlipperScreen, Mainsail, Fluidd, and other Moonraker frontends.

This repository is a neutral home for the protocol proposal and shared fixtures. It does not require changes to Klipper or Moonraker. The protocol is layered on top of existing Klipper `[respond]` action messages, for example:

```ini
RESPOND TYPE=command MSG="action:prompt_begin My Prompt"
```

## Status

Draft. The goal is to use this repository as the basis for cross-project discussion and implementation work.

## Contents

- [SPEC.md](SPEC.md) describes Macro Prompt Protocol v1.
- [fixtures/fixtures.json](fixtures/fixtures.json) contains renderer-neutral event streams and expected prompt state.
- [fixtures/macro-examples.cfg](fixtures/macro-examples.cfg) contains Klipper macros for manual frontend testing.
- [fixtures/README.md](fixtures/README.md) explains how to use the fixture pack.

## Implementation Targets

Initial implementation work is expected to happen in forks/branches for:

- KlipperScreen
- Fluidd
- Mainsail

Each frontend can render prompts differently, but parser/state behavior should match the shared fixtures where the relevant core or optional feature is supported.
