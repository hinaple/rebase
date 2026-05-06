import { SerialPort } from "serialport";

type dataHandler = (data: string) => any;
type connectHandler = (data: string) => any;

export default class SerialConnector {
    private port: null | SerialPort;
    private ondata: dataHandler;
    private onconnect: connectHandler;

    constructor(ondata: dataHandler, onconnect: connectHandler) {
        this.port = null;
        this.ondata = ondata;
        this.onconnect = onconnect;
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
        if (this.port) this.port.close();

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
        this.onconnect?.(realPort);

        this.port.on("readable", () => {
            const data = this.port?.read();
            this.ondata?.(data.toString().trim());
        });
        this.port.on("disconnect", () => {
            this.close();
        });
        this.port.on("connectionError", () => {
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
    }
}
