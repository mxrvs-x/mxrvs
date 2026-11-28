import { formatAssistantReply } from "../lib/assistantReply";

it("renders emphasis, headings, and bullets without exposing Markdown markers", () => {
  const result = formatAssistantReply([
    "Your bench press PR is **54 kg × 10 reps**.",
    "",
    "### Walking record",
    "- **Distance:** 7.99 km",
    "* **Steps:** 10,293",
    "",
    "You logged it on May 31.",
  ].join("\n"));

  expect(result).toEqual([
    { kind: "paragraph", text: [{ text: "Your bench press PR is " }, { text: "54 kg × 10 reps", style: "bold" }, { text: "." }] },
    { kind: "heading", text: [{ text: "Walking record" }] },
    {
      kind: "list", ordered: false, items: [
        { number: 0, text: [{ text: "Distance:", style: "bold" }, { text: " 7.99 km" }] },
        { number: 0, text: [{ text: "Steps:", style: "bold" }, { text: " 10,293" }] },
      ],
    },
    { kind: "paragraph", text: [{ text: "You logged it on May 31." }] },
  ]);
});

it("preserves numbered steps, escaped symbols, and visible link labels", () => {
  const result = formatAssistantReply("2. Try *one* set\r\n3) Log \\* if needed\r\n\r\n[Training log](https://example.test)");
  expect(result).toMatchObject([
    { kind: "list", ordered: true, items: [
      { number: 2, text: [{ text: "Try " }, { text: "one", style: "italic" }, { text: " set" }] },
      { number: 3, text: [{ text: "Log " }, { text: "*" }, { text: " if needed" }] },
    ] },
    { kind: "paragraph", text: [{ text: "Training log" }] },
  ]);
});

it("parses tables with inline formatting, aligned columns, and empty cells", () => {
  const blocks = formatAssistantReply([
    "Here are your records.",
    "| Period | **Training** | Sets |",
    "| :----- | :----------: | ---: |",
    "| Nov 22–28 | Upper \\| Lower | **7 sets** |",
    "| Nov 22–28 | Sleep |",
    "### What to train next",
    "Try an upper-body session.",
  ].join("\n"));

  expect(blocks).toMatchObject([
    { kind: "paragraph", text: [{ text: "Here are your records." }] },
    { kind: "table",
      headers: [[{ text: "Period" }], [{ text: "Training", style: "bold" }], [{ text: "Sets" }]],
      alignment: ["left", "center", "right"],
      rows: [
        [[{ text: "Nov 22–28" }], [{ text: "Upper | Lower" }], [{ text: "7 sets", style: "bold" }]],
        [[{ text: "Nov 22–28" }], [{ text: "Sleep" }], []],
      ],
    },
    { kind: "heading", text: [{ text: "What to train next" }] },
    { kind: "paragraph", text: [{ text: "Try an upper-body session." }] },
  ]);
});

it("recognizes a table without outside pipes but preserves other pipe-delimited text", () => {
  expect(formatAssistantReply("Date | Steps\n--- | ---:\nNov 27 | 4500")[0]).toMatchObject({
    kind: "table", rows: [[[{ text: "Nov 27" }], [{ text: "4500" }]]],
  });
  expect(formatAssistantReply("Push | Pull\nHere are two options.")).toEqual([
    { kind: "paragraph", text: [{ text: "Push | Pull" }, { text: "\n" }, { text: "Here are two options." }] },
  ]);
});
