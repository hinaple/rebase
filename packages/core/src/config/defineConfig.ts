import type { RebaseConfig } from "./types.js";

export function defineConfig<TConfig extends RebaseConfig>(
    config: TConfig,
): TConfig {
    return config;
}
