import { useEffect } from "react";
import { Minimize2 } from "lucide-react";
import HomeView from "../library/HomeView";
import SettingsView from "../settings/SettingsView";
import { useStore } from "../../store/excaliStore";
import { useUi } from "../../store/ui";
import { mod } from "../../lib/platform";
import TitleBar from "./TitleBar";
import Sidebar from "../sidebar/Sidebar";
import CanvasArea from "../canvas/CanvasArea";

export default function AppLayout() {
  const homeOpen = useStore((s) => s.homeOpen);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const settingsOpen = useUi((s) => s.settingsOpen);
  // Focus mode is for the board: everything else steps out of the way.
  const focus = useUi((s) => s.focusMode) && !homeOpen && !settingsOpen;
  const toggleFocus = useUi((s) => s.toggleFocusMode);

  useEffect(() => {
    void window.excali.window.setButtonsHidden(focus);
  }, [focus]);

  return (
    <div
      className={`app-shell ${focus ? "focus-mode" : ""} ${sidebarOpen ? "" : "sidebar-closed"}`}
    >
      <div className="titlebar-slot" {...(focus ? { inert: "" } : {})}>
        <TitleBar />
      </div>
      <div className="flex min-h-0 flex-1">
        <Sidebar hidden={focus} />
        <main className="app-main">
          {homeOpen ? <HomeView /> : <CanvasArea />}
          {settingsOpen && <SettingsView />}
        </main>
      </div>
      {focus && (
        <div className="focus-exit">
          <button onClick={toggleFocus}>
            <Minimize2 size={13} /> Leave focus mode <kbd>{mod(".")}</kbd>
          </button>
        </div>
      )}
    </div>
  );
}
