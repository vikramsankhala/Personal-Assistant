"use client";

import { useState, useRef, useEffect } from "react";
import { 
  Mic, 
  StopCircle, 
  User, 
  MessageSquare, 
  ClipboardList, 
  FileText, 
  ChevronDown, 
  Globe, 
  Briefcase, 
  Zap,
  Clock,
  CheckCircle2
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
const WS_BASE = (process.env.NEXT_PUBLIC_API_URL || "").replace(/^http/, "ws");

const MEETING_CATEGORIES = [
  { id: "general", label: "General Meeting", icon: Globe },
  { id: "sales", label: "Sales Call", icon: Briefcase },
  { id: "standup", label: "Daily Standup", icon: Zap },
  { id: "interview", label: "Interview", icon: User },
  { id: "board", label: "Board Meeting", icon: ClipboardList },
];

type TranscriptSegment = {
  speaker_id: string;
  start_time: number;
  end_time: number;
  text: string;
};

type Transcript = {
  id: string;
  title: string;
  category: string;
  status: string;
  summary?: string;
  minutes?: string[];
  segments: TranscriptSegment[];
  created_at: string;
};

export function TranscriptionView() {
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [realtimeText, setRealtimeText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(MEETING_CATEGORIES[0]);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  const startRealtime = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const socket = new WebSocket(`${WS_BASE}/ws/transcribe`);
      socketRef.current = socket;

      socket.onopen = () => {
        // Send initial metadata about the meeting
        socket.send(JSON.stringify({ 
          type: "start", 
          category: selectedCategory.id,
          title: `Live ${selectedCategory.label}`
        }));

        const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0 && socket.readyState === WebSocket.OPEN) {
            socket.send(event.data);
          }
        };

        mediaRecorder.start(1000);
      };

      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "transcript_update") {
          setRealtimeText((prev) => prev + " " + data.text);
        } else if (data.type === "final_result") {
          setTranscripts((prev) => [data.transcript, ...prev]);
          stopRealtime();
        }
      };

      setIsRecording(true);
    } catch (err) {
      console.error("Failed to start recording:", err);
    }
  };

  const stopRealtime = () => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "stop" }));
    }
    mediaRecorderRef.current?.stop();
    socketRef.current?.close();
    setIsRecording(false);
    setRealtimeText("");
  };

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-10">
      {/* Hero Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b pb-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-black tracking-tight text-gray-900">Meeting Room</h1>
          <p className="text-gray-500 text-lg">Real-time transcription, speaker identification, and instant minutes.</p>
        </div>

        <div className="flex items-center gap-4">
          {/* Category Dropdown */}
          <div className="relative">
            <button
              onClick={() => !isRecording && setShowCategoryDropdown(!showCategoryDropdown)}
              disabled={isRecording}
              className={`flex items-center gap-3 px-5 py-3 bg-white border rounded-xl shadow-sm transition-all ${
                isRecording ? "opacity-50 cursor-not-allowed" : "hover:border-blue-400 hover:shadow-md"
              }`}
            >
              <selectedCategory.icon size={20} className="text-blue-600" />
              <span className="font-semibold text-gray-700">{selectedCategory.label}</span>
              <ChevronDown size={16} className="text-gray-400" />
            </button>

            {showCategoryDropdown && (
              <div className="absolute top-full mt-2 w-64 bg-white border rounded-xl shadow-xl z-50 overflow-hidden">
                {MEETING_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setSelectedCategory(cat);
                      setShowCategoryDropdown(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left transition-colors"
                  >
                    <cat.icon size={18} className="text-gray-400" />
                    <span className="text-sm font-medium text-gray-700">{cat.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={isRecording ? stopRealtime : startRealtime}
            className={`flex items-center gap-3 px-8 py-3 rounded-xl font-bold transition-all shadow-lg hover:shadow-xl ${
              isRecording
                ? "bg-red-600 hover:bg-red-700 text-white animate-pulse"
                : "bg-black hover:bg-gray-800 text-white"
            }`}
          >
            {isRecording ? <StopCircle size={22} /> : <Mic size={22} />}
            {isRecording ? "End Meeting" : "Start Transcribing"}
          </button>
        </div>
      </div>

      {/* Live Stream View */}
      {isRecording && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-600 font-bold">
                <span className="flex h-3 w-3 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                LIVE TRANSCRIPTION
              </div>
              <div className="text-gray-400 text-sm flex items-center gap-1">
                <Clock size={14} />
                Capturing audio...
              </div>
            </div>
            <div className="min-h-[300px] p-8 bg-gray-900 rounded-3xl text-white font-mono text-lg leading-relaxed shadow-2xl border-4 border-gray-800">
              {realtimeText || "Listening to your meeting conversations..."}
              <span className="w-2 h-6 bg-blue-500 inline-block ml-1 animate-bounce" />
            </div>
          </div>
          
          <div className="bg-blue-50 rounded-3xl p-8 border border-blue-100 space-y-6">
            <div className="p-4 bg-white rounded-2xl shadow-sm border border-blue-200">
              <div className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-1">Speaker Detection</div>
              <div className="text-sm text-gray-600">Identifying participants in real-time...</div>
            </div>
            <div className="p-4 bg-white rounded-2xl shadow-sm border border-blue-200">
              <div className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-1">AI Insights</div>
              <div className="text-sm text-gray-600">Summarizing key points as you speak...</div>
            </div>
          </div>
        </div>
      )}

      {/* Transcript List */}
      <div className="space-y-8">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="text-gray-400" />
          Recent Meetings
        </h2>
        
        {transcripts.length === 0 && !isRecording && (
          <div className="py-20 text-center border-2 border-dashed rounded-3xl border-gray-100">
            <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mic size={32} className="text-gray-300" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">Start your first meeting</h3>
            <p className="text-gray-500 mt-1">Conversations will be automatically transcribed and summarized.</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-8">
          {transcripts.map((t) => (
            <div key={t.id} className="bg-white border rounded-3xl shadow-sm hover:shadow-xl transition-all overflow-hidden border-gray-200">
              {/* Header */}
              <div className="p-8 bg-gray-50 border-b flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-bold text-gray-900">{t.title}</h3>
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-black uppercase rounded-full">
                      {t.category}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 flex items-center gap-2 font-medium">
                    <Clock size={14} />
                    {new Date(t.created_at).toLocaleDateString()} at {new Date(t.created_at).toLocaleTimeString()}
                  </div>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 rounded-xl text-sm font-bold">
                  <CheckCircle2 size={16} />
                  PROCESSED BY AI
                </div>
              </div>

              {/* Content */}
              <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-12">
                {/* Conversation */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2 font-black text-gray-900 uppercase tracking-widest text-xs">
                    <MessageSquare size={16} className="text-blue-600" />
                    Conversation History
                  </div>
                  <div className="space-y-6 max-h-[500px] overflow-y-auto pr-4 custom-scrollbar">
                    {t.segments.map((s, i) => (
                      <div key={i} className="group relative">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 rounded-2xl bg-gray-900 flex items-center justify-center text-white font-bold shadow-lg">
                            {s.speaker_id.charAt(0)}
                          </div>
                          <div>
                            <div className="text-sm font-black text-gray-900">{s.speaker_id}</div>
                            <div className="text-[10px] font-bold text-gray-400">{Math.floor(s.start_time)}s</div>
                          </div>
                        </div>
                        <p className="pl-13 text-gray-700 leading-relaxed text-sm bg-gray-50 p-4 rounded-2xl border border-transparent group-hover:border-gray-200 transition-all">
                          {s.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Summary & Minutes */}
                <div className="space-y-10">
                  {/* Summary */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 font-black text-gray-900 uppercase tracking-widest text-xs">
                      <ClipboardList size={16} className="text-blue-600" />
                      Executive Summary
                    </div>
                    <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100 italic text-blue-900 text-sm leading-relaxed">
                      "{t.summary}"
                    </div>
                  </div>

                  {/* Minutes */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 font-black text-gray-900 uppercase tracking-widest text-xs">
                      <Zap size={16} className="text-blue-600" />
                      Meeting Minutes
                    </div>
                    <ul className="space-y-3">
                      {t.minutes?.map((item, i) => (
                        <li key={i} className="flex items-start gap-4 p-4 bg-white border rounded-2xl hover:border-blue-300 transition-all shadow-sm">
                          <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                          <span className="text-sm text-gray-700 font-medium">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}</style>
    </div>
  );
}
