# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run build` — `rimraf ./dist && tsc && npm run plugin-ui`. The `plugin-ui` step copies `src/homebridge-ui/` into `dist/`; if you only run `tsc`, the custom UI server (a plain `.js` file) won't end up in `dist` and the plugin will load without it.
- `npm run lint` — ESLint with `--max-warnings=0`. CI fails on any warning. `npm run lint:fix` to autofix.
- `npm start` — runs `homebridge -U ./test/hbConfig -D`. The `./test/hbConfig` directory is gitignored; create it locally with a `config.json` containing your Ecovacs credentials before running.
- `npm run watch` — `npm link` + `nodemon`, which re-runs `tsc`, copies the UI, and restarts homebridge in debug mode on `src/**/*.ts` changes.
- `npm run prepublishOnly` — runs lint then build; runs automatically on publish.
- No test runner is configured. CI (`.github/workflows/build.yml`) runs lint only on Node 22.x and 24.x.

## Architecture

This is a Homebridge dynamic platform plugin (`platform: "Deebot"`, name `@homebridge-plugins/homebridge-ecovacs`) that bridges Ecovacs/Yeedi cloud-connected vacuums into HomeKit. There are **two parallel device representations** that the platform selects between at runtime in `pluginSetup`:

1. **Legacy HAP path** (`platform.ts > initialiseDevice`) — exposes each vacuum as a HAP accessory built from primitive Switch / MotionSensor / Battery services (`Clean`, `Go Charge`, `Air Drying`, optional `Attention` motion sensor, optional `Battery Level` humidity, custom Eve characteristics `MaxSpeed` / `PredefinedArea` / `TrueDetect` defined in `utils/custom-chars.ts`). State is driven by event listeners on the vacbot `control` object (`CleanReport`, `ChargeState`, `BatteryInfo`, `CleanSpeed`, etc.) routed through `external*Update` methods. User-initiated changes flow through `internal*Update` methods which call `accessory.control.run(...)`.
2. **Matter path** (`devices/EcovacsRoboticVacuumAccessory.ts` + `devices/BaseMatterAccessory.ts`) — exposes each vacuum as a native Matter `RoboticVacuumCleaner` device with `rvcRunMode`, `rvcCleanMode`, `rvcOperationalState`, `serviceArea`, and `powerSource` clusters. The header comment in `EcovacsRoboticVacuumAccessory.ts` documents the cluster ↔ Ecovacs event mapping and is the canonical reference when adding/changing Matter behaviour.

The selector is `this.api.isMatterEnabled?.()` inside `initialiseDevice`: when true the device is built via `initialiseMatterOnlyDevice` and any prior HAP accessory for that DID is unregistered to avoid duplicates; otherwise the legacy HAP path runs. After all devices are loaded, `pluginSetup` registers all accumulated Matter accessories in one call (`api.matter.registerPlatformAccessories`) and then calls `markRegistered()` on each.

### BaseMatterAccessory pre-registration queue

`BaseMatterAccessory.updateState` queues cluster updates if the accessory has not yet been registered with the Matter server. `markRegistered()` flushes the queue. This matters because the Ecovacs `control` object emits state events as soon as `connect()` is called — well before `registerPlatformAccessories` resolves. Don't try to push state directly to `api.matter.updateAccessoryState` from device code; always go through `updateState`.

### Plugin UI server

`src/homebridge-ui/server.js` is a plain JS module (not TypeScript, not bundled) consumed at runtime by the Homebridge UI. It reads commissioning data straight from the homebridge storage `matter/<advertiseAddress>/` directories, reproducing Homebridge's `ExternalMatterAccessoryPublisher` storage-dir hashing (`sha1(uuid)` → MAC bytes → uppercase hex). If you change how UUIDs are generated for Matter accessories, this hashing must continue to match or `/resetMatterDevice` will wipe the wrong directory.

### Config parsing

`platform.ts > applyUserConfig` is a large hand-written switch over user-supplied keys. Per-device config supports up to 15 numbered area entries (`areaType1`–`areaType15`, `spotAreaIDs1`–`15`, `customAreaCoordinates1`–`15`, `areaNote*`). Defaults live in `utils/constants.ts`; the file is shallow-copied into `this.config` and per-device `this.deviceConf[id]` so don't store mutable shared state on those defaults. The `config.schema.json` at the repo root defines the Homebridge UI form and must stay in sync with `config.ts` types.

### Debug mode

The platform sets `this.isBeta = process.argv.includes('-D')`. When `-D` is passed (this is what `npm start` and `npm run watch` do via the homebridge `-D` flag), `log.debug` and `log.debugWarn` are aliased to the regular log so debug output is visible. In normal mode they're `() => {}` no-ops. Per-accessory `accessory.logDebug` follows the same pattern.

### `ecovacs-deebot` patch

`patches/ecovacs-deebot+0.9.6-beta.12.patch` (applied via `patch-package` in `postinstall`) silences the upstream `logEvent` unless `NODE_ENV` is `development` or `dev`. Without this, the Ecovacs library prints every event to stdout. If you bump the `ecovacs-deebot` version, the patch will need to be re-generated against the new tarball.

## Conventions

- TypeScript ESM (`"type": "module"`, `module: "nodenext"`). Use `.js` extensions in relative imports (e.g. `from './settings.js'`) — required by Node's ESM resolver even though the source files are `.ts`.
- ESLint extends `@antfu/eslint-config` with strict `perfectionist/sort-imports` and `sort-named-imports`. Imports must be in the order: type imports → builtin → external → internal → parent/sibling/index → side-effect, with one newline between groups. `lint:fix` will reorganise these for you.
- Single quotes, 1tbs braces, `curly` enforced for multi-line bodies only.
- `noImplicitAny: false` and `useUnknownInCatchVariables: false` in `tsconfig.json` — the legacy HAP path uses a lot of `any` (especially around `accessory.control` which is the upstream vacbot object with no types). Don't fight this in legacy code; new Matter code uses proper types from `homebridge`.
- Supported Node: `^22.12.0 || ^24.0.0`. Homebridge peer: `^2.0.0`.
