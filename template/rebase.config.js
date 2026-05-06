import { defineConfig } from "@fainthit/rebase-core/config";

export default defineConfig({
    modules: {
        communication: {
            serial: {
                portAlias: "USB-SERIAL",
                path: null,
                baudRate: 9600,
            },
            socket: {
                urls: [""],
            },
        },
    },
});
