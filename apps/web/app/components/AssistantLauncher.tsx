"use client";

import { Maximize2, Minimize2, Plus, Send, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ASSISTANT_FULL_NAME, ASSISTANT_NAME, CHAT_PROMPT_LIMIT, createAssistantStorage } from "../../../mobile/lib/assistantChat";
import { formatAssistantReply, type InlineText } from "../../../mobile/lib/assistantReply";
import { useAssistantChat } from "../../../mobile/lib/useAssistantChat";
import { supabase } from "@/lib/supabase";

const storage = createAssistantStorage({
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
});

export default function AssistantLauncher() {
  const chat = useAssistantChat(supabase, "/api/assistant", storage);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const transcript = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const panel = transcript.current;
    if (panel) panel.scrollTop = panel.scrollHeight;
  }, [chat.messages, chat.sending, chat.error, open, expanded]);

  function submit(event: FormEvent) {
    event.preventDefault();
    chat.send(chat.draft);
  }

  function composerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
    event.preventDefault();
    if (!event.repeat && chat.ready && !chat.sending && chat.draft.trim()) event.currentTarget.form?.requestSubmit();
  }

  return (
    <>
      <button className="button primary assistant-launcher" type="button" aria-label={`Open ${ASSISTANT_NAME}`} title={`Open ${ASSISTANT_NAME}`}
        aria-haspopup="dialog" aria-expanded={open} aria-controls="assistant-dialog"
        onClick={() => {
          dialog.current?.showModal();
          setOpen(true);
        }}>
        <Sparkles size={24} aria-hidden="true" />
      </button>
      <dialog id="assistant-dialog" ref={dialog} className={expanded ? "assistant-dialog expanded" : "assistant-dialog"}
        aria-labelledby="assistant-title" onClose={() => setOpen(false)}>
        <header className="assistant-header">
          <h2 id="assistant-title">{ASSISTANT_NAME}</h2>
          <div className="assistant-actions">
            <button type="button" className="icon-button" aria-label="New chat" title="New chat" disabled={!chat.ready} onClick={() => {
              chat.clear();
              input.current?.focus();
            }}>
              <Plus size={18} aria-hidden="true" />
            </button>
            <button type="button" className="icon-button" aria-label={expanded ? "Shrink chat" : "Expand chat"}
              title={expanded ? "Shrink chat" : "Expand chat"} onClick={() => setExpanded((current) => !current)}>
              {expanded ? <Minimize2 size={18} aria-hidden="true" /> : <Maximize2 size={18} aria-hidden="true" />}
            </button>
            <button type="button" className="icon-button" aria-label="Close chat" title="Close chat" onClick={() => dialog.current?.close()}>
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </header>
        <section className="assistant-chat" aria-label="Fitness chat">
          <div className="assistant-transcript" ref={transcript} role="log" aria-label="Conversation">
            {!chat.ready && <p className="muted" role="status">{chat.signedOut ? "Sign in to use the assistant." : "Loading chat…"}</p>}
            {chat.ready && !chat.messages.length && (
              <div className="assistant-empty stack">
                <Sparkles size={28} aria-hidden="true" />
                <h2>What are you working on?</h2>
                <span className="muted">{ASSISTANT_FULL_NAME}</span>
                <div className="row wrap">
                  {chat.starters.map((prompt) => (
                    <button className="button" key={prompt} type="button" onClick={() => chat.send(prompt)}>{prompt}</button>
                  ))}
                </div>
              </div>
            )}
            {chat.messages.map((message, index) => (
              <article className={`assistant-message ${message.role}`} key={index}>
                <strong className="assistant-author">{message.role === "user" ? "You" : ASSISTANT_NAME}</strong>
                {message.role === "assistant" ? <AssistantReply content={message.content} /> : <p>{message.content}</p>}
              </article>
            ))}
            {chat.sending && <p className="muted" role="status">Thinking…</p>}
            {chat.error && <div className="stack">
              <p className="auth-error" role="alert">{chat.error}</p>
              <button type="button" className="button assistant-retry" onClick={chat.retry}>Retry</button>
            </div>}
            {chat.storageError && <p className="muted" role="status">{chat.storageError}</p>}
          </div>
          <form className="assistant-composer" onSubmit={submit}>
            <textarea ref={input} className="input" aria-label="Message" placeholder="Ask about workouts, nutrition, or recovery"
              value={chat.draft} onChange={(event) => chat.setDraft(event.target.value)} onKeyDown={composerKeyDown}
              maxLength={CHAT_PROMPT_LIMIT} rows={2} disabled={!chat.ready} />
            <button type="submit" className="button primary" aria-label="Send message" disabled={!chat.ready || !chat.draft.trim() || chat.sending}>
              <Send size={19} aria-hidden="true" />
            </button>
          </form>
          <p className="muted assistant-privacy">Your messages and relevant records are sent to Groq to answer your questions.</p>
        </section>
      </dialog>
    </>
  );
}

function ReplyText({ parts }: { parts: InlineText[] }) {
  return parts.map(({ text, style }, index) => {
    if (style === "boldItalic") return <strong key={index}><em>{text}</em></strong>;
    const Tag = style === "bold" ? "strong" : style === "italic" ? "em" : style === "code" ? "code" : "span";
    return <Tag key={index}>{text}</Tag>;
  });
}

function AssistantReply({ content }: { content: string }) {
  return (
    <div className="assistant-reply">
      {formatAssistantReply(content).map((block, index) => {
        if (block.kind === "table") {
          return (
            <div className="assistant-table-scroll" key={index} role="region" aria-label="Scrollable data table" tabIndex={0}>
              <table className="assistant-table">
                <thead>
                  <tr>{block.headers.map((cell, column) => (
                    <th key={column} scope="col" style={{ textAlign: block.alignment[column] }}><ReplyText parts={cell} /></th>
                  ))}</tr>
                </thead>
                <tbody>{block.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>{row.map((cell, column) => (
                    <td key={column} style={{ textAlign: block.alignment[column] }}><ReplyText parts={cell} /></td>
                  ))}</tr>
                ))}</tbody>
              </table>
            </div>
          );
        }
        if (block.kind === "list") {
          const List = block.ordered ? "ol" : "ul";
          return <List key={index}>{block.items.map((item, itemIndex) => (
            <li key={itemIndex} value={block.ordered ? item.number : undefined}><ReplyText parts={item.text} /></li>
          ))}</List>;
        }
        const Tag = block.kind === "heading" ? "h3" : "p";
        return <Tag key={index}><ReplyText parts={block.text} /></Tag>;
      })}
    </div>
  );
}
