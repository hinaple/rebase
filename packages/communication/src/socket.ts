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

type dataHandler = (channel: string, data: string | null, url: string) => any;

export default class SocketConnector {
    private socket: null | Socket;
    private ondata: dataHandler;
    private url: null | string;

    public connected: boolean = false;

    constructor(ondata: dataHandler) {
        this.socket = null;
        this.ondata = ondata;
        this.url = null;
        this.connected = false;
    }
    async connect(urls: [string]) {
        if (!Array.isArray(urls)) urls = [urls];
        if (this.socket && this.connected) return true;
        else if (this.socket) this.disconnect();

        for (const url of urls) {
            const result = await tryToConnect(url);
            if (result.succeed && result.socket) {
                this.url = url;
                this.socket = result.socket;
                this.connected = true;
                this.ondata?.("connect", null, url);
                this.socket.onAny((channel, data) => {
                    if (channel === "disconnect" || channel === "connect_error")
                        this.connected = false;
                    if (channel === "connect") this.connected = true;
                    this.ondata?.(channel, data, url);
                });
                return true;
            }
        }
        return false;
    }
    send(channel: string, ...data: [any]) {
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
