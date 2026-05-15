# @fainthit/rebase-core

[English](./README.md)

REBASE core 패키지는 REBASE 애플리케이션에서 공통으로 사용하는 설정 헬퍼와 Electron 부트스트랩 로직을 제공합니다.

## 설치

```sh
npm install @fainthit/rebase-core
```

`@fainthit/rebase-core`는 Electron 런타임 패키지를 애플리케이션이 제공한다고 가정합니다.

```sh
npm install electron electron-store @electron-toolkit/utils
```

## Export

```ts
import {
    defineConfig,
    resolveConfig,
    resolveCommunicationConfig,
} from "@fainthit/rebase-core/config";

import { RebaseApp } from "@fainthit/rebase-core/electron";
```

패키지 루트에서도 config와 electron 모듈을 함께 re-export합니다.

```ts
import { defineConfig, RebaseApp } from "@fainthit/rebase-core";
```

## 설정

`rebase.config.js`에서 `defineConfig`를 사용하면 설정 구조를 명확하고 타입 친화적으로 작성할 수 있습니다.

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

### Communication 설정

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

`resolveConfig(config)`는 전달받은 설정과 패키지 기본 설정을 병합합니다.
`resolveCommunicationConfig(config)`는 `config.modules.communication` 값을 읽고, communication이 설정되지 않았으면 `null`을 반환합니다.

## Electron

`RebaseApp`은 Electron 메인 윈도우를 만들고 renderer를 로드하며, 기본 Electron 앱 생명주기 처리를 설정합니다. 설정이 있으면 socket과 serial communication도 renderer process에 연결합니다.

```js
import { join } from "path";
import { RebaseApp } from "@fainthit/rebase-core/electron";
import rebaseConfig from "../../rebase.config.js";

new RebaseApp({
    config: rebaseConfig,
    indexHtmlPath: join(__dirname, "../renderer/index.html"),
}).start();
```

### Renderer 로딩

개발 모드에서는 기본적으로 `ELECTRON_RENDERER_URL` 환경 변수를 읽습니다. 값이 있으면 해당 URL을 로드하고, 없으면 `indexHtmlPath` 파일을 로드합니다.

```js
new RebaseApp({
    indexHtmlPath: join(__dirname, "../renderer/index.html"),
    renderer: {
        devUrlEnv: "ELECTRON_RENDERER_URL",
        openDevTools: true,
    },
}).start();
```

### Window 옵션

기본 window는 fullscreen, ready 전까지 hidden, menu hidden, non-resizable 상태입니다. Electron `BrowserWindow` 옵션을 바꾸려면 `window`를 전달합니다.

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

communication은 `config.modules.communication`이 설정된 경우에만 동작합니다. connector를 모두 끄려면 `modules.communication`을 생략하거나 `null`로 설정합니다.

```js
export default defineConfig({
    modules: {
        communication: null,
    },
});
```

설정이 있으면 REBASE는 `@fainthit/rebase-communication`의 socket, serial connector를 생성합니다. `communication.socket`을 제공하면 socket이 켜지고, `communication.serial`을 제공하면 serial이 켜집니다.

기본 IPC 채널:

| 방향             | 채널     | 동작                                                      |
| ---------------- | -------- | --------------------------------------------------------- |
| main -> renderer | `socket` | socket에서 받은 channel 데이터를 renderer로 보냅니다.     |
| renderer -> main | `socket` | renderer 데이터를 지정한 socket event channel로 보냅니다. |
| main -> renderer | `serial` | serial에서 받은 이벤트를 renderer로 보냅니다.             |
| renderer -> main | `serial` | renderer 데이터를 serial connector로 보냅니다.            |

연결 정보와 renderer bridge 채널명은 `config.modules.communication`에서 설정합니다.

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

socket 이벤트는 renderer로 다음 형태로 전달됩니다.

```ts
ipcRenderer.on("socket", (_event, channel, ...data) => {});
```

socket `connect` 이벤트에서는 첫 번째 data 값이 연결된 URL입니다.

serial 이벤트는 renderer로 다음 형태로 전달됩니다.

```ts
ipcRenderer.on("serial", (_event, channel, data) => {});
```

`channel`은 `connect`, `data`, `disconnect`, `connectionError` 중 하나입니다.

## RebaseApp

`RebaseApp`은 `onReady`와 `onWindowCreated`에 자기 자신을 전달합니다.

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

connector가 설정되어 있으면 `socket`과 `serial`은 내부 `@fainthit/rebase-communication` connector를 노출합니다. main process 코드는 직접 listener를 등록하거나 데이터를 보낼 수 있습니다. 설정되지 않은 connector는 `null`로 남습니다.

예시:

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

전달받은 config를 그대로 반환합니다. config 파일에서 REBASE 설정 형태를 명확하게 표현할 때 사용합니다.

### `resolveConfig(config?)`

config 객체와 `defaultConfig`를 병합합니다.

### `resolveCommunicationConfig(config)`

`config.modules.communication` 값을 반환합니다. communication이 설정되지 않았으면 `null`을 반환합니다.

### `new RebaseApp(options?)`

`RebaseApp` 인스턴스를 생성합니다. Electron 애플리케이션 생명주기를 시작하려면 `start()`를 호출합니다.

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
