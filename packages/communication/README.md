# @fainthit/rebase-communication

Communication connectors for Rebase applications.

This package provides small connector classes for Socket.IO and serial port
communication. Connectors expose listener APIs so multiple consumers can observe
incoming events without replacing each other.

## Installation

This package is intended to be used inside the Rebase workspace.

```sh
npm install @fainthit/rebase-communication
```

## Exports

```ts
import {
    SerialConnector,
    SocketConnector,
    type SerialChannel,
    type SerialDataHandler,
    type SocketDataHandler,
} from "@fainthit/rebase-communication";
```

You can also import connector-specific entry points:

```ts
import SocketConnector from "@fainthit/rebase-communication/socket";
import SerialConnector from "@fainthit/rebase-communication/serial";
```

## SocketConnector

`SocketConnector` wraps a Socket.IO client connection.

```ts
import { SocketConnector } from "@fainthit/rebase-communication";

const socket = new SocketConnector();

const unsubscribe = socket.addListener((channel, ...data) => {
    if (channel === "connect") {
        const [url] = data;
        console.log(`Connected to ${url}`);
        return;
    }

    console.log("Socket event:", channel, data);
});

const connected = await socket.connect([
    "http://localhost:3000",
    "http://backup-host:3000",
]);

if (connected) {
    socket.send("message", { text: "hello" });
}

unsubscribe();
socket.disconnect();
```

### Constructor

```ts
new SocketConnector(ondata?)
```

The optional `ondata` handler is registered as the first listener. This keeps the
constructor callback style available while allowing additional listeners to be
added later.

### Methods

#### `addListener(listener)`

Registers a listener for incoming socket events.

```ts
const unsubscribe = socket.addListener((channel, ...data) => {
    console.log(channel, data);
});
```

Returns an unsubscribe function.

#### `removeListener(listener)`

Removes a previously registered listener.

```ts
const listener = (channel, ...data) => {
    console.log(channel, data);
};

socket.addListener(listener);
socket.removeListener(listener);
```

#### `connect(urls)`

Connects to the first reachable URL.

```ts
await socket.connect("http://localhost:3000");
await socket.connect(["http://localhost:3000", "http://backup-host:3000"]);
```

Returns `true` when a connection succeeds and `false` when all URLs fail.

When connected, listeners receive:

```ts
("connect", url)
```

After connection, every Socket.IO event is forwarded to listeners as:

```ts
(channel, ...data)
```

#### `send(channel, ...data)`

Emits a Socket.IO event on the active socket.

```ts
socket.send("status:update", { ready: true });
```

If there is no active socket connection, the method logs a message and returns.

#### `disconnect()`

Disconnects the active socket and clears the internal socket reference.

## SerialConnector

`SerialConnector` wraps a `serialport` connection and emits channel-based events.

```ts
import { SerialConnector } from "@fainthit/rebase-communication";

const serial = new SerialConnector();

const unsubscribe = serial.addListener((channel, data) => {
    switch (channel) {
        case "connect":
            console.log(`Serial port opened: ${data}`);
            break;
        case "data":
            console.log("Serial data:", data);
            break;
        case "disconnect":
            console.log("Serial port closed");
            break;
        case "connectionError":
            console.log("Serial connection error");
            break;
    }
});

await serial.open({
    portAlias: "USB-SERIAL",
    baudRate: 9600,
});

serial.send("PING\n");

unsubscribe();
serial.close();
```

### Constructor

```ts
new SerialConnector(ondata?)
```

The optional `ondata` handler is registered as the first listener.

### Serial Events

Serial listeners receive:

```ts
(channel, data)
```

`channel` is one of:

| Channel | Data | Description |
| --- | --- | --- |
| `connect` | `string` | The opened serial port path. |
| `data` | `string` | Trimmed data read from the serial port. |
| `disconnect` | `null` | The serial port was closed. |
| `connectionError` | `null` | The serial port reported a connection error. |

### Methods

#### `addListener(listener)`

Registers a serial event listener and returns an unsubscribe function.

```ts
const unsubscribe = serial.addListener((channel, data) => {
    console.log(channel, data);
});
```

#### `removeListener(listener)`

Removes a previously registered listener.

```ts
const listener = (channel, data) => {
    console.log(channel, data);
};

serial.addListener(listener);
serial.removeListener(listener);
```

#### `open(options?)`

Opens a serial port.

```ts
await serial.open({
    path: "COM3",
    baudRate: 115200,
});
```

Options:

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `path` | `string \| null` | `null` | Explicit serial port path. |
| `portAlias` | `string \| null` | `null` | Friendly-name, manufacturer, or path fragment used to find a port. |
| `baudRate` | `number` | `9600` | Serial baud rate. |

If `portAlias` is set, or `path` is omitted, the connector scans available
serial ports and opens the first port whose friendly name, manufacturer, or path
includes the alias. When no alias is provided, it defaults to matching
`USB-SERIAL`.

If no matching port is found, `open()` returns without opening a port.

#### `send(data)`

Writes data to the open serial port.

```ts
serial.send("PING\n");
```

If there is no open port, the method logs a message and returns.

#### `close()`

Closes the open serial port and emits a `disconnect` event.

## Listener Pattern

Both connectors support the same listener lifecycle:

```ts
const unsubscribe = connector.addListener(listener);

// Later:
unsubscribe();
```

Use `removeListener(listener)` when you need to remove a named handler directly.

Listener callbacks are invoked synchronously in registration order. A listener
should avoid long-running work if other listeners need to receive events quickly.

## Type Reference

```ts
type SocketDataHandler = (
    channel: string,
    ...data: unknown[]
) => void;

type SerialChannel = "connect" | "disconnect" | "data" | "connectionError";

type SerialDataHandler = (
    channel: SerialChannel,
    data: string | null,
) => void;
```

## Build

```sh
npm run typecheck
npm run build
```
