import { join } from "path";
import { startRebaseApp } from "@fainthit/rebase-core/electron";
import rebaseConfig from "../../rebase.config.js";

startRebaseApp({
    config: rebaseConfig,
    renderer: {
        indexHtmlPath: join(__dirname, "../renderer/index.html"),
    },
});
