import { io, Socket } from "socket.io-client";

function tryToConnect(
    url: string,
): Promise<{ succeed: true; socket?: Socket } | { succeed: false }> {
    return new Promise((res) => {
        const socket = io(url);

        socket.on("connect", () => {
            res({ succeed: true, socket });
            socket.removeAllListeners();
        });
        socket.on("connect-error", () => {
            res({ succeed: false });
            socket.removeAllListeners();
            socket.disconnect();
        });
    });
}

export type SocketDataHandler = (channel: string, ...data: unknown[]) => void;

export default class SocketConnector {
    private socket: null | Socket;
    private listeners: Set<SocketDataHandler>;

    public connected: boolean = false;
    public url: null | string;

    constructor(ondata?: SocketDataHandler) {
        this.socket = null;
        this.listeners = new Set();
        this.url = null;
        this.connected = false;
        if (ondata) this.addListener(ondata);
    }

    addListener(listener: SocketDataHandler) {
        this.listeners.add(listener);
        return () => {
            this.removeListener(listener);
        };
    }

    removeListener(listener: SocketDataHandler) {
        this.listeners.delete(listener);
    }

    private emitData(channel: string, ...data: unknown[]) {
        for (const listener of this.listeners) {
            listener(channel, ...data);
        }
    }

    async connect(urls: string | string[]) {
        if (!Array.isArray(urls)) urls = [urls];
        if (this.socket && this.connected) return true;
        else if (this.socket) this.disconnect();

        for (const url of urls) {
            const result = await tryToConnect(url);
            if (result.succeed && result.socket) {
                this.url = url;
                this.socket = result.socket;
                this.connected = true;
                this.emitData("connect", url);
                this.socket.onAny((channel, ...data) => {
                    if (channel === "disconnect" || channel === "connect_error")
                        this.connected = false;
                    if (channel === "connect") this.connected = true;
                    this.emitData(channel, ...data);
                });
                return true;
            }
        }
        this.connected = false;
        this.url = null;
        return false;
    }
    send(channel: string, ...data: any[]) {
        if (!channel) return;

        if (!this.socket) {
            console.log("No socket connection");
            return;
        }
        this.socket.emit(channel, ...data);
    }

    disconnect() {
        if (!this.socket) return;
        this.socket.disconnect();
        this.socket = null;
    }
}
