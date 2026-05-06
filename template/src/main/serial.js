import { SerialPort } from "serialport";

export default class SerialConnector {
    constructor(ondata, onconnect) {
        this.port = null;
        this.ondata = ondata;
        this.onconnect = onconnect;
    }

    async open(portAlias, path, baudRate = 9600) {
        if (this.port) this.port.close();

        let realPort = path;

        if (portAlias || !path) {
            const list = await SerialPort.list();
            realPort =
                list.find((p) =>
                    p.friendlyName.includes(portAlias || "USB-SERIAL")
                )?.path ?? path;
        }

        if (!realPort) return;

        this.port = new SerialPort({
            path: realPort,
            baudRate: baudRate ?? 9600,
        });

        console.log("SERIAL OPENED: ", realPort);
        this.onconnect?.(realPort);

        this.port.on("readable", () => {
            const data = this.port.read();
            this.ondata?.(data.toString().trim());
        });
        this.port.on("disconnect", () => {
            this.close();
        });
        this.port.on("connectionError", () => {
            this.close();
        });
    }

    send(data) {
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
