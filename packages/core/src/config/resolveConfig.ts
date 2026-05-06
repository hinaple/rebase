import { defaultConfig } from "./defaults.js";
import type { RebaseConfig } from "./types.js";

export function resolveConfig<TConfig extends RebaseConfig>(
    config = {} as TConfig,
): RebaseConfig & TConfig {
    return {
        ...defaultConfig,
        ...config,
    };
}
