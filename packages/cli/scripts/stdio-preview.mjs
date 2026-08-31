import { BUILTIN_HOSTS } from "@distilly/protocol";
import { openPreviewMcpApplication } from "../lib/preview.js";

const root = process.env.DISTILLY_PREVIEW_ROOT;
const assetsDir = process.env.DISTILLY_PREVIEW_PANEL_ASSETS;
const panelPort = Number(process.env.DISTILLY_PREVIEW_PANEL_PORT);
if (!root || !assetsDir || !Number.isSafeInteger(panelPort)) {
  throw new Error("Preview stdio fixture requires root, Panel assets, and Panel port.");
}

const application = await openPreviewMcpApplication({
  root,
  host: BUILTIN_HOSTS.codex,
  sessionId: "built-preview-stdio",
  capacity: {
    maximumInputTokens: 4_194_304,
    maximumToolResultBytes: 4_194_304,
    source: "binding_fixture",
  },
  panel: { assetsDir, port: panelPort },
});

try {
  await application.runStdio();
} finally {
  await application.close();
}
