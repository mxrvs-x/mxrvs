type InlineStyle = "bold" | "italic" | "boldItalic" | "code";
export type InlineText = { text: string; style?: InlineStyle };
type ColumnAlignment = "left" | "center" | "right";

export type ReplyTable = {
  kind: "table";
  headers: InlineText[][];
  alignment: ColumnAlignment[];
  rows: InlineText[][][];
};

type ReplyBlock =
  | { kind: "paragraph" | "heading"; text: InlineText[] }
  | { kind: "list"; ordered: boolean; items: { number: number; text: InlineText[] }[] }
  | ReplyTable;

function inlineText(value: string): InlineText[] {
  const parts: InlineText[] = [];
  let offset = 0;
  const markup = /\\([\\`*_\[\]#>~-])|\[([^\]\n]+)\]\([^\n)]*\)|(\*\*\*|___|\*\*|__|~~|`|\*|_)(?=\S)(.*?\S)\3/g;
  for (const match of value.matchAll(markup)) {
    if (match.index > offset) parts.push({ text: value.slice(offset, match.index) });
    const [, literal, label, marker, content] = match;
    const style = marker === "`" ? "code" : marker === "~~" ? undefined
      : marker?.length === 3 ? "boldItalic" : marker?.length === 2 ? "bold"
      : marker ? "italic" : undefined;
    parts.push({ text: literal ?? label ?? content, style });
    offset = match.index + match[0].length;
  }
  if (offset < value.length) parts.push({ text: value.slice(offset) });
  return parts;
}

function tableCells(line: string): string[] {
  const cells: string[] = [];
  let offset = 0;
  for (const pipe of line.matchAll(/\\.|(\|)/g)) {
    if (!pipe[1]) continue;
    if (pipe.index > 0) cells.push(line.slice(offset, pipe.index));
    offset = pipe.index + 1;
  }
  if (!offset) return [];
  if (offset < line.length) cells.push(line.slice(offset));
  return cells.map((cell) => cell.trim().replace(/\\\|/g, "|"));
}

export function formatAssistantReply(content: string): ReplyBlock[] {
  const blocks: ReplyBlock[] = [];
  let paragraph: string[] = [];

  function flushParagraph() {
    if (paragraph.length) blocks.push({ kind: "paragraph", text: paragraph.flatMap((line, index) =>
      index === 0 ? inlineText(line) : [{ text: "\n" }, ...inlineText(line)],
    ) });
    paragraph = [];
  }

  const lines = content.split(/\r?\n/).map((line) => line.trim());
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (!line || /^(?:-{3,}|\*{3,}|_{3,}|`{3,}[\w-]*)$/.test(line)) {
      flushParagraph();
      continue;
    }
    const cells = line.includes("|") ? tableCells(line) : [];
    const separator = cells.length ? tableCells(lines[index + 1] ?? "") : [];
    if (cells.length && cells.length === separator.length && separator.every((cell) => /^:?-+:?$/.test(cell))) {
      flushParagraph();
      const alignment = separator.map<ColumnAlignment>((cell) => {
        if (!cell.endsWith(":")) return "left";
        return cell.startsWith(":") ? "center" : "right";
      });
      const rows: InlineText[][][] = [];
      index++;
      while (index + 1 < lines.length) {
        const row = tableCells(lines[index + 1]);
        if (!row.length) break;
        rows.push(cells.map((_, column) => inlineText(row[column] ?? "")));
        index++;
      }
      blocks.push({ kind: "table", headers: cells.map(inlineText), alignment, rows });
      continue;
    }
    const heading = /^#{1,6}\s+(.+)$/.exec(line);
    const item = /^(?:(\d{1,4})[.)]|[-*+•])\s+(.+)$/.exec(line);
    if (heading) {
      flushParagraph();
      blocks.push({ kind: "heading", text: inlineText(heading[1]) });
    } else if (item) {
      flushParagraph();
      const ordered = item[1] !== undefined;
      const entry = { number: Number(item[1] ?? 0), text: inlineText(item[2]) };
      const previous = blocks.at(-1);
      if (previous?.kind === "list" && previous.ordered === ordered) previous.items.push(entry);
      else blocks.push({ kind: "list", ordered, items: [entry] });
    } else {
      paragraph.push(line.replace(/^>\s+/, ""));
    }
  }
  flushParagraph();
  return blocks;
}
