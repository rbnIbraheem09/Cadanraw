import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
}

/**
 * Catches render crashes inside the Excalidraw editor (e.g. an irrecoverably
 * damaged scene) so the whole app doesn't white-screen. Reset by keying this
 * boundary on the canvas id in CanvasArea, so switching canvases clears it.
 */
export default class CanvasErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Canvas failed to render", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full w-full items-center justify-center p-8 text-center">
          <div className="max-w-sm">
            <h2 className="text-base font-semibold text-ink">
              This canvas couldn’t be displayed
            </h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-dim">
              The file may be damaged. Try restoring an earlier snapshot from the
              History panel, or open another canvas.
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
