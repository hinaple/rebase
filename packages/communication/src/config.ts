import type { RebaseConfig } from "@fainthit/rebase-core/config";

export type CommunicationConfig = {
    serial?: {
        portAlias?: string | null;
        path?: string | null;
        baudRate?: number;
    };
    socket?: {
        urls?: string[];
    };
};

export const defaultCommunicationConfig: CommunicationConfig = {};

export function resolveCommunicationConfig(
    config: RebaseConfig,
): CommunicationConfig {
    return {
        ...defaultCommunicationConfig,
        ...config.modules?.communication,
    };
}

declare module "@fainthit/rebase-core/config" {
    interface RebaseConfigModules {
        communication?: CommunicationConfig;
    }
}
