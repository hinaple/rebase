export type RebaseConfig = {
    modules?: RebaseConfigModules & Record<string, unknown>;
} & Record<string, unknown>;

export interface RebaseConfigModules {
    communication?: RebaseCommunicationConfig;
}

export type RebaseCommunicationConfig = {
    serial?: {
        portAlias?: string | null;
        path?: string | null;
        baudRate?: number;
    };
    socket?: {
        urls?: string[];
    };
};
