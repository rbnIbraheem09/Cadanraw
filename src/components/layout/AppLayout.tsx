import HomeView from "../library/HomeView";
import { useStore } from "../../store/excaliStore";
import TitleBar from "./TitleBar";
import Sidebar from "../sidebar/Sidebar";
import CanvasArea from "../canvas/CanvasArea";

export default function AppLayout() {
  const homeOpen=useStore(s=>s.homeOpen);
  return (
    <div className="flex h-full flex-col bg-deep text-ink">
      <TitleBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="relative min-w-0 flex-1 overflow-hidden">
          {homeOpen ? <HomeView/> : <CanvasArea />}
        </main>
      </div>
    </div>
  );
}
