import {
    app,
    shell,
    BrowserWindow,
    ipcMain,
    screen,
    Menu,
    dialog,
} from "electron";
import { join } from "path";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import SocketConnector from "./socket";
import prompt from "electron-prompt";
import ElectronStore from "electron-store";
import SerialConnector from "./serial";

/** @type {null | BrowserWindow} */
let mainWindow = null;
function createWindow() {
    let factor = screen.getPrimaryDisplay().scaleFactor;
    mainWindow = new BrowserWindow({
        fullscreen: true,
        show: false,
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false,
            sandbox: false,
        },
        resizable: false,
    });

    mainWindow.on("ready-to-show", () => {
        mainWindow.show();
    });

    mainWindow.webContents.setWindowOpenHandler((details) => {
        shell.openExternal(details.url);
        return { action: "deny" };
    });

    if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
        mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
    }
}

app.whenReady().then(() => {
    app.on("browser-window-created", (_, window) => {
        optimizer.watchWindowShortcuts(window);
    });

    createWindow();

    app.on("activate", function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

const store = new ElectronStore.default();

function setConfig(key, v) {
    store.set(key, v);
}
function getConfig(key) {
    return store.get(key);
}

function onSocketData(channel, data) {
    if (!mainWindow) return;
    console.log(channel, data);
    mainWindow.webContents.send("socket", channel.trim());
}
const socket = new SocketConnector(onSocketData);

function connectSocket() {
    if (socket.connected) socket.disconnect();
    socket.connect([getConfig("url") ?? ""]);
}
connectSocket();

function onSerialData(data) {
    if (!mainWindow) return;
    mainWindow.webContents.send("serial", data.trim());
}
const serial = new SerialConnector(onSerialData);

function openSerial() {
    if (serial.port) serial.close();
    serial.open(null, getConfig("port") ?? "");
}
openSerial();

ipcMain.on("socket", (evt, data) => {
    console.log("SENDING SOCKET", data);
    if (!socket.connected) {
        console.log("BUT FAILED BECAUSE IT'S DISCONNECTED");
        return;
    }
    socket.send("ctm", data);
});

ipcMain.on("serial", (evt, data) => {
    console.log("SENDING SERIAL", data);
    if (!serial.port) {
        console.log("BUT FAILED BECAUSE IT'S DISCONNECTED");
        return;
    }
    serial.send(data + ".");
});
