"use client";

import { useState, useRef, useEffect } from "react";
import { Send, User, Bot } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

type Message = {
  role: "user" | "assistant";
  content: string;
  taskType?: string;
};

export function AssistantView() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/assistant/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: data.reply,
          taskType: data.task_type,
        },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: "Sorry, I couldn't process that. Make sure Ollama is running (`ollama run llama3.1`).",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)]">
      <div className="rounded-2xl border border-ink-700/50 bg-ink-800/30 flex flex-col flex-1 min-h-0">
        {/* Chat area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 && (
            <div className="text-center py-12 text-ink-400">
              <p className="font-medium text-ink-300 mb-2">Personal Assistant</p>
              <p className="text-sm max-w-md mx-auto">
                Ask me to take notes, set reminders, draft documents, summarize, or answer questions.
                Powered by LLM (Ollama).
              </p>
              <div className="mt-6 flex flex-wrap gap-2 justify-center">
                {[
                  "Take a note: meeting at 3pm",
                  "Remind me to call John tomorrow",
                  "Summarize my last transcript",
                  "Draft an email to the team",
                ].map((s) => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
                    className="px-4 py-2 rounded-lg bg-ink-700/50 text-ink-300 text-sm hover:bg-ink-700"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-4 ${
                msg.role === "user" ? "flex-row-reverse" : ""
              }`}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  msg.role === "user"
                    ? "bg-accent/20 text-accent"
                    : "bg-ink-700 text-ink-300"
                }`}
              >
                {msg.role === "user" ? (
                  <User className="w-5 h-5" />
                ) : (
                  <Bot className="w-5 h-5" />
                )}
              </div>
              <div
                className={`flex-1 max-w-[80%] ${
                  msg.role === "user" ? "text-right" : ""
                }`}
              >
                <div
                  className={`inline-block p-4 rounded-2xl ${
                    msg.role === "user"
                      ? "bg-accent/20 text-ink-100"
                      : "bg-ink-800 text-ink-200"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  {msg.taskType && msg.role === "assistant" && (
                    <span className="text-xs text-ink-500 mt-2 block">
                      Task: {msg.taskType}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-ink-700 flex items-center justify-center shrink-0">
                <Bot className="w-5 h-5 text-ink-400" />
              </div>
              <div className="p-4 rounded-2xl bg-ink-800 text-ink-400">
                Thinking…
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-ink-700/50">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex gap-3"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a command or question..."
              className="flex-1 px-4 py-3 rounded-xl bg-ink-800 border border-ink-600 text-ink-100 placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="px-6 py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium disabled:opacity-50 flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
