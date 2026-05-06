import type { RebaseCommunicationConfig, RebaseConfig } from "./types.js";

export const defaultCommunicationConfig: RebaseCommunicationConfig = {};

export function resolveCommunicationConfig(
    config: RebaseConfig,
): RebaseCommunicationConfig {
    return {
        ...defaultCommunicationConfig,
        ...config.modules?.communication,
    };
}
