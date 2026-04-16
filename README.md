# Browser Extensions For Ophelia

This repo now uses a single WXT project for both Chrome and Firefox.

## Setup

```bash
bun install
```

## Development

```bash
bun dev
```

Firefox:

```bash
bun run dev:firefox
```

## Build

Chrome:

```bash
bun run build
```

Firefox:

```bash
bun run build:firefox
```

## Package

Chrome ZIP:

```bash
bun run zip -- -b chrome
```

Firefox ZIP and source bundle:

```bash
bun run zip:firefox
```
