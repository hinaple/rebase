import {
    app,
    BrowserWindow,
    ipcMain,
    screen,
    shell,
    type BrowserWindowConstructorOptions,
} from "electron";
import { is, optimizer } from "@electron-toolkit/utils";
import { SerialConnector, SocketConnector } from "@fainthit/rebase-communication";
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
    getMainWindow: () => BrowserWindow | null;
    sendToRenderer: (channel: string, ...args: unknown[]) => void;
    setConfig: (key: string, value: unknown) => void;
    getConfig: <TValue = unknown>(key: string) => TValue | undefined;
};

export type StartRebaseAppOptions = {
    config?: RebaseConfig;
    communication?: false | RebaseCommunicationOptions;
    window?: BrowserWindowConstructorOptions;
    renderer?: {
        indexHtmlPath: string;
        devUrlEnv?: string;
        openDevTools?: boolean;
    };
    onReady?: (context: RebaseAppContext) => void | Promise<void>;
    onWindowCreated?: (
        context: RebaseAppContext,
        window: BrowserWindow,
    ) => void | Promise<void>;
};

export type RebaseCommunicationOptions = {
    socket?: {
        rendererChannel?: string;
        outboundChannel?: string;
    };
    serial?: {
        rendererChannel?: string;
        outboundSuffix?: string;
    };
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

export function startRebaseApp(options: StartRebaseAppOptions = {}) {
    const config = resolveConfig(options.config ?? {});
    const store = new ElectronStore<Record<string, unknown>>();
    let mainWindow: BrowserWindow | null = null;

    const context: RebaseAppContext = {
        config,
        store,
        ipcMain,
        getMainWindow: () => mainWindow,
        sendToRenderer(channel, ...args) {
            mainWindow?.webContents.send(channel, ...args);
        },
        setConfig(key, value) {
            store.set(key, value);
        },
        getConfig<TValue = unknown>(key: string) {
            return store.get(key) as TValue | undefined;
        },
    };

    function createWindow() {
        screen.getPrimaryDisplay();

        mainWindow = new BrowserWindow({
            ...defaultWindowOptions,
            ...options.window,
            webPreferences: {
                ...defaultWindowOptions.webPreferences,
                ...options.window?.webPreferences,
            },
        });

        mainWindow.on("ready-to-show", () => {
            mainWindow?.show();
        });

        mainWindow.webContents.setWindowOpenHandler((details) => {
            shell.openExternal(details.url);
            return { action: "deny" };
        });

        const devUrlEnv = options.renderer?.devUrlEnv ?? "ELECTRON_RENDERER_URL";
        const devUrl = process.env[devUrlEnv];

        if (is.dev && devUrl) {
            mainWindow.loadURL(devUrl);
            if (options.renderer?.openDevTools ?? true) {
                mainWindow.webContents.openDevTools();
            }
        } else if (options.renderer?.indexHtmlPath) {
            mainWindow.loadFile(options.renderer.indexHtmlPath);
        }

        void options.onWindowCreated?.(context, mainWindow);

        return mainWindow;
    }

    function setupCommunication() {
        if (options.communication === false) return;

        const communicationConfig = resolveCommunicationConfig(config);
        const communicationOptions = options.communication ?? {};
        const socketRendererChannel =
            communicationOptions.socket?.rendererChannel ?? "socket";
        const socketOutboundChannel =
            communicationOptions.socket?.outboundChannel ?? "ctm";
        const serialRendererChannel =
            communicationOptions.serial?.rendererChannel ?? "serial";
        const serialOutboundSuffix =
            communicationOptions.serial?.outboundSuffix ?? ".";

        const socket = new SocketConnector((channel, data) => {
            console.log(channel, data);
            context.sendToRenderer(socketRendererChannel, channel.trim());
        });

        const serial = new SerialConnector((data) => {
            context.sendToRenderer(serialRendererChannel, data.trim());
        });

        if (socket.connected) socket.disconnect();
        void socket.connect(communicationConfig.socket?.urls ?? [""]);

        serial.close();
        void serial.open(communicationConfig.serial);

        ipcMain.on(socketRendererChannel, (_, data) => {
            console.log("SENDING SOCKET", data);
            if (!socket.connected) {
                console.log("BUT FAILED BECAUSE IT'S DISCONNECTED");
                return;
            }
            socket.send(socketOutboundChannel, data);
        });

        ipcMain.on(serialRendererChannel, (_, data) => {
            console.log("SENDING SERIAL", data);
            serial.send(`${data}${serialOutboundSuffix}`);
        });
    }

    app.whenReady().then(() => {
        app.on("browser-window-created", (_, window) => {
            optimizer.watchWindowShortcuts(window);
        });

        createWindow();
        setupCommunication();
        void options.onReady?.(context);

        app.on("activate", () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                createWindow();
            }
        });
    });

    app.on("window-all-closed", () => {
        if (process.platform !== "darwin") {
            app.quit();
        }
    });

    return context;
}
