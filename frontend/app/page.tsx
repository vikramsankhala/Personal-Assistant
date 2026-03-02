"use client";

import { useState } from "react";
import { Mic, Upload, MessageSquare, FileText } from "lucide-react";
import { TranscriptionView } from "@/components/TranscriptionView";
import { AssistantView } from "@/components/AssistantView";

type Tab = "transcribe" | "assistant";

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("transcribe");

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-ink-700/50 bg-ink-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
              <Mic className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-ink-50">VPA</h1>
              <p className="text-xs text-ink-400">Virtual Stenographer & Assistant</p>
            </div>
          </div>

          <nav className="flex gap-1 p-1 rounded-lg bg-ink-800/50">
            <button
              onClick={() => setActiveTab("transcribe")}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === "transcribe"
                  ? "bg-ink-700 text-ink-50"
                  : "text-ink-400 hover:text-ink-200"
              }`}
            >
              <FileText className="w-4 h-4" />
              Transcribe
            </button>
            <button
              onClick={() => setActiveTab("assistant")}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === "assistant"
                  ? "bg-ink-700 text-ink-50"
                  : "text-ink-400 hover:text-ink-200"
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Assistant
            </button>
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">
        {activeTab === "transcribe" && <TranscriptionView />}
        {activeTab === "assistant" && <AssistantView />}
      </main>
    </div>
  );
}
