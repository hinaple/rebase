export type RebaseConfig = {
    modules?: RebaseConfigModules & Record<string, unknown>;
} & Record<string, unknown>;

export interface RebaseConfigModules {}
