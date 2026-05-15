# @fainthit/rebase-core

[한국어](./README_ko.md)

REBASE core package provides the shared configuration helpers and Electron
bootstrap logic used by REBASE applications.

## Installation

```sh
npm install @fainthit/rebase-core
```

`@fainthit/rebase-core` expects the Electron runtime packages to be provided by
the application.

```sh
npm install electron electron-store @electron-toolkit/utils
```

## Exports

```ts
import {
    defineConfig,
    resolveConfig,
    resolveCommunicationConfig,
} from "@fainthit/rebase-core/config";

import { RebaseApp } from "@fainthit/rebase-core/electron";
```

The package root also re-exports both modules.

```ts
import { defineConfig, RebaseApp } from "@fainthit/rebase-core";
```

## Configuration

Use `defineConfig` in `rebase.config.js` to keep the configuration shape explicit
and type-friendly.

```js
import { defineConfig } from "@fainthit/rebase-core/config";

export default defineConfig({
    modules: {
        communication: {
            serial: {
                portAlias: "USB-SERIAL",
                path: null,
                baudRate: 9600,
                rendererChannel: "serial",
                outboundSuffix: "",
            },
            socket: {
                urls: ["ws://localhost:8080"],
                rendererChannel: "socket",
            },
        },
    },
});
```

### Communication Config

```ts
type RebaseCommunicationConfig = {
    serial?: {
        portAlias?: string | null;
        path?: string | null;
        baudRate?: number;
        rendererChannel?: string;
        outboundSuffix?: string;
    } | null;
    socket?: {
        urls?: string[];
        rendererChannel?: string;
    } | null;
};
```

`resolveConfig(config)` merges the provided config with the package defaults.
`resolveCommunicationConfig(config)` reads `config.modules.communication` and
returns the communication-specific configuration, or `null` when communication
is not configured.

## Electron

`RebaseApp` creates the main Electron window, loads the renderer, sets up basic
Electron app lifecycle handlers, and optionally wires socket and serial
communication to the renderer process.

```js
import { join } from "path";
import { RebaseApp } from "@fainthit/rebase-core/electron";
import rebaseConfig from "../../rebase.config.js";

new RebaseApp({
    config: rebaseConfig,
    indexHtmlPath: join(__dirname, "../renderer/index.html"),
}).start();
```

### Renderer Loading

By default, development mode reads the renderer URL from
`ELECTRON_RENDERER_URL`. If the variable exists, the window loads that URL.
Otherwise, it loads `indexHtmlPath`.

```js
new RebaseApp({
    indexHtmlPath: join(__dirname, "../renderer/index.html"),
    renderer: {
        devUrlEnv: "ELECTRON_RENDERER_URL",
        openDevTools: true,
    },
}).start();
```

### Window Options

The default window is fullscreen, hidden until ready, menu-less, and not
resizable. Pass `window` to override Electron `BrowserWindow` options.

```js
new RebaseApp({
    window: {
        fullscreen: false,
        width: 1280,
        height: 720,
        resizable: true,
    },
}).start();
```

## Communication

Communication setup is disabled unless `config.modules.communication` is set.
Omit `modules.communication` or set it to `null` to keep both connectors off.

```js
export default defineConfig({
    modules: {
        communication: null,
    },
});
```

When configured, REBASE creates socket and serial connectors from
`@fainthit/rebase-communication`. Each connector is enabled independently:
provide `communication.socket` to enable socket, and `communication.serial` to
enable serial.

Default IPC channels:

| Direction        | Channel  | Behavior                                                   |
| ---------------- | -------- | ---------------------------------------------------------- |
| main -> renderer | `socket` | Sends inbound socket channel data to the renderer.         |
| renderer -> main | `socket` | Sends renderer data to the requested socket event channel. |
| main -> renderer | `serial` | Sends inbound serial events to the renderer.               |
| renderer -> main | `serial` | Sends renderer data to the serial connector.               |

You can configure connection details and renderer bridge channel names in
`config.modules.communication`.

```js
export default defineConfig({
    modules: {
        communication: {
            socket: {
                urls: ["ws://localhost:8080"],
                rendererChannel: "socket",
            },
            serial: {
                portAlias: "USB-SERIAL",
                baudRate: 9600,
                rendererChannel: "serial",
                outboundSuffix: ".",
            },
        },
    },
});
```

Socket events are forwarded to the renderer as:

```ts
ipcRenderer.on("socket", (_event, channel, ...data) => {});
```

For socket `connect` events, the first data item is the connected URL.

Serial events are forwarded to the renderer as:

```ts
ipcRenderer.on("serial", (_event, channel, data) => {});
```

`channel` is one of `connect`, `data`, `disconnect`, or `connectionError`.

## RebaseApp

`RebaseApp` passes itself to `onReady` and `onWindowCreated`.

```ts
type RebaseAppContext = {
    config: RebaseConfig;
    store: ElectronStore;
    ipcMain: typeof ipcMain;
    socket: SocketConnector | null;
    serial: SerialConnector | null;
    getMainWindow: () => BrowserWindow | null;
    sendToRenderer: (channel: string, ...args: unknown[]) => void;
    setConfig: (key: string, value: unknown) => void;
    getConfig: <TValue = unknown>(key: string) => TValue | undefined;
};
```

When a connector is configured, `socket` and `serial` expose the underlying
`@fainthit/rebase-communication` connectors. Main process code can register its
own listeners or send data directly. Unconfigured connectors remain `null`.

Example:

```js
const rebase = new RebaseApp({
    onReady(context) {
        context.setConfig("lastStartedAt", Date.now());

        context.socket?.addListener((channel, ...data) => {
            console.log("socket", channel, data);
        });

        context.serial?.addListener((channel, data) => {
            console.log("serial", channel, data);
        });
    },
    onWindowCreated(context, window) {
        window.webContents.once("did-finish-load", () => {
            context.sendToRenderer("app:ready");
        });
    },
}).start();

rebase.socket?.send("message", { text: "hello" });
rebase.serial?.send("PING\n");
```

## API Reference

### `defineConfig(config)`

Returns the provided config without changing it. Use it in config files to make
the intended REBASE configuration shape clear.

### `resolveConfig(config?)`

Merges a config object with `defaultConfig`.

### `resolveCommunicationConfig(config)`

Returns the communication config from `config.modules.communication`, or `null`
when communication is not configured.

### `new RebaseApp(options?)`

Creates a `RebaseApp` instance. Call `start()` to start the Electron application
lifecycle.

```ts
type RebaseAppOptions = {
    config?: RebaseConfig;
    indexHtmlPath: string;
    window?: BrowserWindowConstructorOptions;
    renderer?: {
        devUrlEnv?: string;
        openDevTools?: boolean;
    };
    onReady?: (context: RebaseAppContext) => void | Promise<void>;
    onWindowCreated?: (
        context: RebaseAppContext,
        window: BrowserWindow,
    ) => void | Promise<void>;
};
```

```ts
class RebaseApp {
    readonly config: RebaseConfig;
    readonly store: ElectronStore;
    readonly ipcMain: typeof ipcMain;
    socket: SocketConnector | null;
    serial: SerialConnector | null;

    constructor(options: string | RebaseAppOptions);
    start(): this;
    getMainWindow(): BrowserWindow | null;
    sendToRenderer(channel: string, ...args: unknown[]): void;
    setConfig(key: string, value: unknown): void;
    getConfig<TValue = unknown>(key: string): TValue | undefined;
}
```
