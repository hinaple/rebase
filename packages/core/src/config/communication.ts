import type { RebaseCommunicationConfig, RebaseConfig } from "./types.js";

export function resolveCommunicationConfig(
    config: RebaseConfig,
): RebaseCommunicationConfig | null {
    return config.modules?.communication ?? null;
}
