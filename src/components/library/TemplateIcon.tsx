import {
  CalendarRange,
  Clapperboard,
  Images,
  KanbanSquare,
  Lightbulb,
  NotebookPen,
  Share2,
  Square,
  type LucideIcon,
} from "lucide-react";
import type { TemplateId } from "../../lib/templates";

const ICONS: Record<TemplateId, LucideIcon> = {
  blank: Square,
  brainstorm: Lightbulb,
  mindmap: Share2,
  plan: KanbanSquare,
  moodboard: Images,
  storyboard: Clapperboard,
  week: CalendarRange,
  meeting: NotebookPen,
};

export default function TemplateIcon({ id, size = 18 }: { id: TemplateId; size?: number }) {
  const Icon = ICONS[id];
  return <Icon size={size} strokeWidth={1.7} />;
}
