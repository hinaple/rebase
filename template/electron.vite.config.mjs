import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import renderer from "vite-plugin-electron-renderer";

export default defineConfig({
    main: {
        plugins: [
            externalizeDepsPlugin({
                include: ["serialport", "socket.io-client"],
                exclude: [
                    "@fainthit/rebase-core",
                    "@fainthit/rebase-communication",
                ],
            }),
        ],
    },
    renderer: {
        plugins: [svelte(), renderer()],
    },
});
