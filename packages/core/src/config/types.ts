import type { BrowserWindowConstructorOptions } from "electron";

export type RebaseConfig = {
    window?: BrowserWindowConstructorOptions;
    renderer?: RebaseRendererConfig;
    modules?: RebaseConfigModules & Record<string, unknown>;
} & Record<string, unknown>;

export interface RebaseConfigModules {
    communication?: RebaseCommunicationConfig | null;
}

export type RebaseRendererConfig = {
    devUrlEnv?: string;
    openDevTools?: boolean;
};

export type RebaseCommunicationConfig = {
    serial?: {
        portAlias?: string | null;
        path?: string | null;
        baudRate?: number;
        rendererChannel?: string;
        outboundSuffix?: string;
    } | null;
    socket?: {
        urls?: string[];
        rendererChannel?: string;
    } | null;
};
