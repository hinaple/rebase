import { SerialPort } from "serialport";

export type SerialChannel = "connect" | "disconnect" | "data" | "connectionError";
export type SerialDataHandler = (
    channel: SerialChannel,
    data: string | null,
) => void;

export default class SerialConnector {
    private port: null | SerialPort;
    private listeners: Set<SerialDataHandler>;

    constructor(ondata?: SerialDataHandler) {
        this.port = null;
        this.listeners = new Set();
        if (ondata) this.addListener(ondata);
    }

    addListener(listener: SerialDataHandler) {
        this.listeners.add(listener);
        return () => {
            this.removeListener(listener);
        };
    }

    removeListener(listener: SerialDataHandler) {
        this.listeners.delete(listener);
    }

    private emitData(channel: SerialChannel, data: string | null) {
        for (const listener of this.listeners) {
            listener(channel, data);
        }
    }

    async open({
        portAlias = null,
        path = null,
        baudRate = 9600,
    }: {
        portAlias?: string | null;
        path?: string | null;
        baudRate?: number;
    } = {}): Promise<void> {
        if (this.port) this.close();

        let realPort = path;

        if (portAlias || !path) {
            const list = await SerialPort.list();
            realPort =
                list.find((port) => {
                    const friendlyName = (port as { friendlyName?: string })
                        .friendlyName;
                    const label = friendlyName ?? port.manufacturer ?? port.path;

                    return label.includes(portAlias || "USB-SERIAL");
                })?.path ?? path;
        }

        if (!realPort) return;

        this.port = new SerialPort({
            path: realPort,
            baudRate: baudRate ?? 9600,
        });

        console.log("SERIAL OPENED: ", realPort);
        this.emitData("connect", realPort);

        this.port.on("readable", () => {
            const data = this.port?.read();
            if (!data) return;
            this.emitData("data", data.toString().trim());
        });
        this.port.on("disconnect", () => {
            this.close();
        });
        this.port.on("connectionError", () => {
            this.emitData("connectionError", null);
            this.close();
        });
    }

    send(data: string) {
        if (!this.port) {
            console.log("No port connection");
            return;
        }
        this.port.write(data.toString());
    }

    close() {
        if (!this.port || !this.port.isOpen) return;
        this.port.close();
        this.port = null;
        this.emitData("disconnect", null);
    }
}
