import {
    app,
    BrowserWindow,
    ipcMain,
    screen,
    shell,
    type BrowserWindowConstructorOptions,
} from "electron";
import { is, optimizer } from "@electron-toolkit/utils";
import {
    SerialConnector,
    SocketConnector,
} from "@fainthit/rebase-communication";
import ElectronStoreModule from "electron-store";
import { resolveCommunicationConfig, resolveConfig } from "../config/index.js";
import type { RebaseConfig } from "../config/index.js";

type ElectronStoreConstructor = typeof import("electron-store").default;

const electronStoreExport = ElectronStoreModule as ElectronStoreConstructor & {
    default?: ElectronStoreConstructor;
};
const ElectronStore = electronStoreExport.default ?? electronStoreExport;

export type RebaseAppContext = {
    config: RebaseConfig;
    store: InstanceType<ElectronStoreConstructor>;
    ipcMain: typeof ipcMain;
    socket: SocketConnector | null;
    serial: SerialConnector | null;
    getMainWindow: () => BrowserWindow | null;
    sendToRenderer: (channel: string, ...args: unknown[]) => void;
    setConfig: (key: string, value: unknown) => void;
    getConfig: <TValue = unknown>(key: string) => TValue | undefined;
};

export type RebaseAppOptions = {
    config?: RebaseConfig;
    indexHtmlPath: string;
    onReady?: (context: RebaseAppContext) => void | Promise<void>;
    onWindowCreated?: (
        context: RebaseAppContext,
        window: BrowserWindow,
    ) => void | Promise<void>;
};

const defaultWindowOptions: BrowserWindowConstructorOptions = {
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
};

export class RebaseApp implements RebaseAppContext {
    readonly config: RebaseConfig;
    readonly store: InstanceType<ElectronStoreConstructor>;
    readonly ipcMain = ipcMain;

    socket: SocketConnector | null = null;
    serial: SerialConnector | null = null;

    private mainWindow: BrowserWindow | null = null;
    private started = false;

    private readonly options: RebaseAppOptions;

    constructor(indexHtmlPath: string);
    constructor(options: RebaseAppOptions);
    constructor(options: string | RebaseAppOptions) {
        this.options =
            typeof options === "string" ? { indexHtmlPath: options } : options;
        this.config = resolveConfig(this.options.config ?? {});
        this.store = new ElectronStore<Record<string, unknown>>();
        this.setupCommunication();
    }

    start() {
        if (this.started) return this;
        this.started = true;

        app.whenReady().then(() => {
            app.on("browser-window-created", (_, window) => {
                optimizer.watchWindowShortcuts(window);
            });

            this.createWindow();
            void this.options.onReady?.(this);
            this.connectCommunication();

            app.on("activate", () => {
                if (BrowserWindow.getAllWindows().length === 0) {
                    this.createWindow();
                }
            });
        });

        app.on("window-all-closed", () => {
            if (process.platform !== "darwin") {
                app.quit();
            }
        });

        return this;
    }

    getMainWindow() {
        return this.mainWindow;
    }

    sendToRenderer(channel: string, ...args: unknown[]) {
        this.mainWindow?.webContents.send(channel, ...args);
    }

    setConfig(key: string, value: unknown) {
        this.store.set(key, value);
    }

    getConfig<TValue = unknown>(key: string) {
        return this.store.get(key) as TValue | undefined;
    }

    private createWindow() {
        screen.getPrimaryDisplay();
        const windowOptions = {
            ...defaultWindowOptions,
            ...this.config.window,
        };
        const rendererOptions = {
            ...this.config.renderer,
        };

        this.mainWindow = new BrowserWindow({
            ...windowOptions,
            webPreferences: {
                ...defaultWindowOptions.webPreferences,
                ...this.config.window?.webPreferences,
            },
        });

        this.mainWindow.on("ready-to-show", () => {
            this.mainWindow?.show();
        });

        this.mainWindow.webContents.setWindowOpenHandler((details) => {
            shell.openExternal(details.url);
            return { action: "deny" };
        });

        const devUrlEnv = rendererOptions.devUrlEnv ?? "ELECTRON_RENDERER_URL";
        const devUrl = process.env[devUrlEnv];

        if (is.dev && devUrl) {
            this.mainWindow.loadURL(devUrl);
            if (rendererOptions.openDevTools ?? true) {
                this.mainWindow.webContents.openDevTools();
            }
        } else {
            this.mainWindow.loadFile(this.options.indexHtmlPath);
        }

        void this.options.onWindowCreated?.(this, this.mainWindow);

        return this.mainWindow;
    }

    private setupCommunication() {
        const communicationConfig = resolveCommunicationConfig(this.config);
        if (!communicationConfig) return;

        const socketRendererChannel =
            communicationConfig.socket?.rendererChannel ?? "socket";
        const serialRendererChannel =
            communicationConfig.serial?.rendererChannel ?? "serial";
        const serialOutboundSuffix =
            communicationConfig.serial?.outboundSuffix ?? "";

        if (communicationConfig.socket) {
            this.socket = new SocketConnector();
            this.socket.addListener((channel, ...data) => {
                console.log(channel, data);
                this.sendToRenderer(socketRendererChannel, channel, ...data);
            });

            ipcMain.on(socketRendererChannel, (_, channel, ...data) => {
                console.log("SENDING SOCKET", channel, data);
                if (!this.socket?.connected) {
                    console.log("BUT FAILED BECAUSE IT'S DISCONNECTED");
                    return;
                }
                this.socket.send(channel, ...data);
            });
        }

        if (communicationConfig.serial) {
            this.serial = new SerialConnector();
            this.serial.addListener((channel, data) => {
                this.sendToRenderer(serialRendererChannel, channel, data);
            });

            ipcMain.on(serialRendererChannel, (_, data) => {
                console.log("SENDING SERIAL", data);
                this.serial?.send(`${data}${serialOutboundSuffix}`);
            });
        }
    }

    private connectCommunication() {
        const communicationConfig = resolveCommunicationConfig(this.config);
        if (!communicationConfig) return;

        if (this.socket && communicationConfig.socket) {
            if (this.socket.connected) this.socket.disconnect();
            void this.socket.connect(communicationConfig.socket?.urls ?? [""]);
        }

        if (this.serial && communicationConfig.serial) {
            this.serial.close();
            void this.serial.open(communicationConfig.serial);
        }
    }
}
