import { convertToExcalidrawElements } from "@excalidraw/excalidraw";
import { blockSize, createBlockElement, newBlockData } from "./blocks";
import type { BlockData, BlockKind } from "./block-data";

export const TEMPLATES = [
  { id: "blank", name: "Blank", blurb: "An open board" },
  { id: "brainstorm", name: "Brainstorm", blurb: "A topic and a ring of notes" },
  { id: "mindmap", name: "Mind map", blurb: "Branches that stay connected" },
  { id: "plan", name: "Project plan", blurb: "Kanban, milestones, next steps" },
  { id: "moodboard", name: "Moodboard", blurb: "Frames for images and a palette" },
  { id: "storyboard", name: "Storyboard", blurb: "Six panels with captions" },
  { id: "week", name: "Weekly planner", blurb: "Seven days and a priority list" },
  { id: "meeting", name: "Meeting notes", blurb: "Agenda, decisions, actions" },
] as const;

export type TemplateId = (typeof TEMPLATES)[number]["id"];

type Skeleton = NonNullable<Parameters<typeof convertToExcalidrawElements>[0]>[number];
type SceneElement = ReturnType<typeof convertToExcalidrawElements>[number];

const INK = "#1e1e1e"; // Excalidraw's default stroke: light on dark themes, dark on light ones.
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function block(
  kind: BlockKind,
  x: number,
  y: number,
  data: Partial<BlockData> = {},
  size: Partial<{ width: number; height: number }> = {},
): SceneElement {
  return createBlockElement(newBlockData(kind, "", data), {
    x,
    y,
    ...blockSize(kind),
    ...size,
  }) as SceneElement;
}

const HAND_FONT = "Excalifont";
const handFontLoaded = () =>
  [...document.fonts].some(
    (f) => f.family.replace(/["']/g, "") === HAND_FONT && f.status === "loaded",
  );

/** Load the hand-drawn font if Excalidraw has registered it, so template text
 *  is measured in the face it will be drawn in. */
export async function prepareTemplateFonts(): Promise<void> {
  await document.fonts.load(`20px ${HAND_FONT}`).catch(() => []);
}

/** Excalidraw sizes text once, when it's created. If the hand-drawn font isn't
 *  in yet, that measurement comes from a narrower fallback and the text would
 *  be clipped, so leave room for it. */
function shapes(skeletons: Skeleton[]): SceneElement[] {
  const elements = convertToExcalidrawElements(skeletons);
  if (handFontLoaded()) return elements;
  return elements.map((el) => {
    if (el.type !== "text") return el;
    const extra = el.width * 0.3;
    return { ...el, width: el.width + extra, x: el.containerId ? el.x - extra / 2 : el.x };
  });
}

const heading = (text: string, x: number, y: number, fontSize = 36): Skeleton => ({
  type: "text",
  x,
  y,
  text,
  fontSize,
  strokeColor: INK,
});

const items = (texts: string[]) =>
  texts.map((text) => ({ id: crypto.randomUUID(), text, done: false }));

function brainstorm(): SceneElement[] {
  const tones = ["sand", "sage", "rose", "slate", "peach", "lavender"];
  const prompts = [
    "What we know",
    "What would be great",
    "What's in the way",
    "Who it's for",
    "Smallest first step",
    "Wild ideas",
  ];
  const ring = prompts.map((title, i) => {
    const angle = (Math.PI * 2 * i) / prompts.length - Math.PI / 2;
    return block("note", 520 + Math.cos(angle) * 520 - 150, 420 + Math.sin(angle) * 330 - 95, {
      title,
      color: tones[i],
    }, { width: 300, height: 190 });
  });
  const centre = shapes([
    {
      type: "ellipse",
      x: 350,
      y: 340,
      width: 340,
      height: 160,
      strokeColor: INK,
      backgroundColor: "#ffec99",
      fillStyle: "solid",
      label: { text: "The big question", fontSize: 22, strokeColor: INK },
    },
  ]);
  return [...centre, ...ring];
}

function mindmap(): SceneElement[] {
  const centre = { x: 520, y: 380, w: 240, h: 100 };
  const fills = ["#a5d8ff", "#b2f2bb", "#ffc9c9", "#d0bfff", "#ffd8a8", "#99e9f2"];
  const branches = [
    { label: "Branch one", x: 940, y: 180 },
    { label: "Branch two", x: 980, y: 395 },
    { label: "Branch three", x: 940, y: 610 },
    { label: "Branch four", x: 120, y: 180 },
    { label: "Branch five", x: 80, y: 395 },
    { label: "Branch six", x: 120, y: 610 },
  ];
  const size = { w: 200, h: 70 };
  const skeletons: Skeleton[] = [
    {
      type: "ellipse",
      id: "mm-centre",
      x: centre.x,
      y: centre.y,
      width: centre.w,
      height: centre.h,
      strokeColor: INK,
      backgroundColor: "#ffec99",
      fillStyle: "solid",
      label: { text: "Main idea", fontSize: 22, strokeColor: INK },
    },
  ];
  branches.forEach((b, i) => {
    const right = b.x > centre.x;
    const from = { x: right ? centre.x + centre.w + 8 : centre.x - 8, y: centre.y + centre.h / 2 };
    const to = { x: right ? b.x - 8 : b.x + size.w + 8, y: b.y + size.h / 2 };
    skeletons.push(
      {
        type: "rectangle",
        id: `mm-${i}`,
        x: b.x,
        y: b.y,
        width: size.w,
        height: size.h,
        strokeColor: INK,
        backgroundColor: fills[i],
        fillStyle: "solid",
        roundness: { type: 3 },
        label: { text: b.label, fontSize: 18, strokeColor: INK },
      },
      {
        type: "arrow",
        x: from.x,
        y: from.y,
        width: to.x - from.x,
        height: to.y - from.y,
        points: [
          [0, 0],
          [to.x - from.x, to.y - from.y],
        ],
        strokeColor: INK,
        endArrowhead: null,
        start: { id: "mm-centre" },
        end: { id: `mm-${i}` },
      } as Skeleton,
    );
  });
  return shapes(skeletons);
}

function plan(): SceneElement[] {
  return [
    ...shapes([heading("Project plan", 100, 90)]),
    block("kanban", 100, 170, { title: "Workstream" }),
    block("checklist", 980, 170, {
      title: "Milestones",
      items: items(["Kick-off", "First draft", "Review", "Ship"]),
    }, { height: 420 }),
    block("note", 100, 630, {
      title: "Goal",
      text: "What does done look like, and why does it matter?",
      color: "sand",
    }, { width: 410, height: 230 }),
    block("note", 530, 630, {
      title: "Risks & open questions",
      color: "rose",
    }, { width: 410, height: 230 }),
    block("calendar", 980, 630, { title: "Dates" }),
  ];
}

function moodboard(): SceneElement[] {
  const frames: Skeleton[] = [
    [100, 190, 420, 300],
    [540, 190, 280, 300],
    [840, 190, 360, 460],
    [100, 510, 280, 300],
    [400, 510, 420, 300],
  ].map(([x, y, width, height]) => ({
    type: "rectangle",
    x,
    y,
    width,
    height,
    strokeColor: INK,
    strokeStyle: "dashed",
    strokeWidth: 1,
    roughness: 0,
    opacity: 50,
    roundness: { type: 3 },
    label: { text: "Drop an image", fontSize: 16, strokeColor: INK },
  }));
  const swatches: Skeleton[] = ["#ffc9c9", "#ffd8a8", "#ffec99", "#b2f2bb", "#a5d8ff", "#d0bfff"].map(
    (backgroundColor, i) => ({
      type: "ellipse",
      x: 860 + i * 58,
      y: 690,
      width: 46,
      height: 46,
      strokeColor: "transparent",
      backgroundColor,
      fillStyle: "solid",
      roughness: 0,
    }),
  );
  return [
    ...shapes([heading("Moodboard", 100, 90), ...frames, ...swatches]),
    block("note", 1220, 190, {
      title: "Direction",
      text: "Three words for the feeling you're after.",
      color: "lavender",
    }, { width: 300, height: 220 }),
    block("note", 1220, 430, {
      title: "Avoid",
      color: "rose",
    }, { width: 300, height: 220 }),
  ];
}

function storyboard(): SceneElement[] {
  const out: SceneElement[] = shapes([heading("Storyboard", 100, 90)]);
  for (let i = 0; i < 6; i++) {
    const x = 100 + (i % 3) * 470;
    const y = 180 + Math.floor(i / 3) * 500;
    out.push(
      ...shapes([
        {
          type: "rectangle",
          x,
          y,
          width: 440,
          height: 248,
          strokeColor: INK,
          roughness: 0,
          roundness: { type: 3 },
        },
        { type: "text", x: x + 14, y: y + 10, text: String(i + 1), fontSize: 20, strokeColor: INK },
      ]),
      block("note", x, y + 264, {
        title: `Shot ${i + 1}`,
        text: "What happens, and what we hear.",
        color: "charcoal",
      }, { width: 440, height: 190 }),
    );
  }
  return out;
}

function week(): SceneElement[] {
  const monday = new Date();
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const label = monday.toLocaleDateString(undefined, { day: "numeric", month: "long" });
  return [
    ...shapes([heading(`Week of ${label}`, 100, 90)]),
    ...DAYS.map((day, i) =>
      block("checklist", 100 + (i % 4) * 340, 180 + Math.floor(i / 4) * 340, {
        title: day,
        items: items([""]),
      }, { width: 320, height: 320 }),
    ),
    block("note", 100 + 3 * 340, 180 + 340, {
      title: "This week matters because…",
      color: "sand",
    }, { width: 320, height: 320 }),
  ];
}

function meeting(): SceneElement[] {
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return [
    ...shapes([heading("Meeting notes", 100, 90), { type: "text", x: 102, y: 142, text: today, fontSize: 18, strokeColor: INK, opacity: 60 }]),
    block("checklist", 100, 200, {
      title: "Agenda",
      items: items(["", "", ""]),
    }, { width: 420, height: 320 }),
    block("note", 540, 200, { title: "Notes", color: "slate" }, { width: 520, height: 320 }),
    block("table", 100, 540, {
      title: "Decisions",
      rows: [
        ["Decision", "Owner"],
        ["", ""],
        ["", ""],
      ],
    }, { width: 520, height: 300 }),
    block("checklist", 640, 540, {
      title: "Action items",
      items: items(["", ""]),
    }, { width: 420, height: 300 }),
  ];
}

const BUILDERS: Record<TemplateId, () => SceneElement[]> = {
  blank: () => [],
  brainstorm,
  mindmap,
  plan,
  moodboard,
  storyboard,
  week,
  meeting,
};

/** A complete .excalidraw document for a template, ready to import. */
export function buildTemplateScene(id: TemplateId): string {
  return JSON.stringify({
    type: "excalidraw",
    version: 2,
    source: "cadanraw",
    elements: BUILDERS[id](),
    appState: {},
    files: {},
  });
}
