import { useStore } from "../store/excaliStore";

function newer(latest: string, current: string): boolean {
  const parse = (v: string) => v.replace(/^v/, "").split(".").map(Number);
  const [lM, lm, lp] = parse(latest);
  const [cM, cm, cp] = parse(current);
  if (lM !== cM) return lM > cM;
  if (lm !== cm) return lm > cm;
  return lp > cp;
}

/** Ask GitHub for the latest release and say what was found. */
export async function checkForUpdates(): Promise<void> {
  const toast = useStore.getState().pushToast;
  try {
    const [info, app] = await Promise.all([
      window.excali.checkForUpdates(),
      window.excali.getAppInfo(),
    ]);
    if (!info) return toast("Couldn't reach the update server", "error");
    if (newer(info.version, app.version)) {
      toast(`Cadanraw ${info.version.replace(/^v/, "")} is out. Opening the download page…`, "success");
      setTimeout(() => void window.excali.openExternal(info.url), 600);
    } else toast(`You're up to date (${app.version})`, "success");
  } catch {
    toast("Update check failed", "error");
  }
}
