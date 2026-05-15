import { join } from "path";
import { RebaseApp } from "@fainthit/rebase-core/electron";
import rebaseConfig from "../../rebase.config.js";

new RebaseApp({
    config: rebaseConfig,
    indexHtmlPath: join(__dirname, "../renderer/index.html"),
}).start();
