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
  CheckCircle2, 
  Monitor,
  Download,
  Phone,
  MessageCircle
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
  const [captureMode, setCaptureMode] = useState<"mic" | "system" | "mobile" | "whatsapp">("mic");
  const [realtimeText, setRealtimeText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(MEETING_CATEGORIES[0]);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startRealtime = async () => {
    try {
      let stream: MediaStream;
      
      if (captureMode === "system") {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: { displaySurface: "browser" },
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        });
        if (stream.getAudioTracks().length === 0) {
          stream.getTracks().forEach(t => t.stop());
          alert("System audio capture requires 'Share audio' to be checked in the popup.");
          return;
        }
        stream.getVideoTracks().forEach(track => track.stop());
      } else {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true }
        });
      }

      streamRef.current = stream;
      const socket = new WebSocket(`${WS_BASE}/ws/transcribe`);
      socketRef.current = socket;

      socket.onopen = () => {
        let modeLabel = captureMode.charAt(0).toUpperCase() + captureMode.slice(1);
        if (captureMode === 'whatsapp') modeLabel = "WhatsApp";
        
        socket.send(JSON.stringify({
          type: "start",
          category: selectedCategory.id,
          title: `Live ${selectedCategory.label} (${modeLabel} Audio)`
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
    streamRef.current?.getTracks().forEach(track => track.stop());
    setIsRecording(false);
    setRealtimeText("");
  };

  const downloadTranscript = (transcript: Transcript) => {
    let content = `MEETSCRIBE TRANSCRIPT: ${transcript.title}
`;
    content += `Date: ${new Date(transcript.created_at).toLocaleString()}
`;
    content += `Category: ${transcript.category}
`;
    content += `------------------------------------------

`;
    
    if (transcript.summary) {
      content += `EXECUTIVE SUMMARY:
${transcript.summary}

`;
    }
    
    if (transcript.minutes && transcript.minutes.length > 0) {
      content += `MEETING MINUTES:
`;
      transcript.minutes.forEach(m => content += `- ${m}
`);
      content += `
`;
    }
    
    content += `FULL CONVERSATION:
`;
    transcript.segments.forEach(s => {
      content += `[${s.speaker_id}] ${s.text}
`;
    });

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${transcript.title.replace(/\s+/g, '_')}_transcript.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 overflow-auto bg-slate-50 custom-scrollbar">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-2">Meeting Room</h2>
          <p className="text-slate-500">Real-time transcription for Teams, Zoom, WhatsApp & Calls.</p>
        </div>

        {/* Capture Mode Toggle */}
        <div className="mb-8 flex justify-center">
          <div className="inline-flex p-1 bg-slate-200/50 rounded-xl">
            {[
              { id: 'mic', label: 'Mic', icon: Mic },
              { id: 'system', label: 'System Audio', icon: Monitor },
              { id: 'mobile', label: 'Mobile Audio', icon: Phone },
              { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
            ].map((mode) => (
              <button
                key={mode.id}
                onClick={() => setCaptureMode(mode.id as any)}
                disabled={isRecording}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  captureMode === mode.id
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                } ${isRecording ? "opacity-50" : ""}`}
              >
                <mode.icon className="w-4 h-4" />
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-center gap-4 mb-12">
          {/* Category Selector */}
          <div className="relative w-full md:w-64">
            <button
              onClick={() => !isRecording && setShowCategoryDropdown(!showCategoryDropdown)}
              disabled={isRecording}
              className={`w-full flex items-center justify-between px-5 py-3 bg-white border rounded-xl shadow-sm transition-all ${
                isRecording ? "opacity-50 cursor-not-allowed" : "hover:border-blue-400 hover:shadow-md"
              }`}
            >
              <div className="flex items-center gap-3">
                <selectedCategory.icon className="w-5 h-5 text-blue-500" />
                <span className="font-medium text-slate-700">{selectedCategory.label}</span>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showCategoryDropdown ? 'rotate-180' : ''}`} />
            </button>
            {showCategoryDropdown && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border rounded-xl shadow-xl z-10 overflow-hidden">
                {MEETING_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setSelectedCategory(cat);
                      setShowCategoryDropdown(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 text-left transition-colors"
                  >
                    <cat.icon className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-medium text-slate-700">{cat.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={isRecording ? stopRealtime : startRealtime}
            className={`w-full md:w-auto flex items-center justify-center gap-3 px-10 py-3 rounded-xl font-bold text-white transition-all shadow-lg ${
              isRecording 
                ? "bg-rose-500 hover:bg-rose-600 animate-pulse" 
                : "bg-blue-600 hover:bg-blue-700 hover:-translate-y-0.5"
            }`}
          >
            {isRecording ? <StopCircle className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            {isRecording ? "End Meeting" : "Start Transcribing"}
          </button>
        </div>

        {isRecording && (
          <div className="mb-12 p-8 bg-white rounded-2xl shadow-xl border border-blue-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-rose-500 rounded-full animate-ping" />
                <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">
                  Live {captureMode === 'system' ? 'System Audio' : captureMode === 'whatsapp' ? 'WhatsApp' : captureMode.charAt(0).toUpperCase() + captureMode.slice(1)} Stream
                </span>
              </div>
              <span className="text-xs font-medium text-slate-400">Capturing...</span>
            </div>
            
            <div className="min-h-[200px] p-6 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-600 leading-relaxed mb-8">
              {realtimeText || "Listening to meeting conversations..."}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-bold text-blue-900">Speaker Detection</span>
                </div>
                <p className="text-xs text-blue-700">Identifying participants...</p>
              </div>
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-bold text-amber-900">AI Insights</span>
                </div>
                <p className="text-xs text-amber-700">Summarizing key points...</p>
              </div>
            </div>

            {(captureMode === "mobile" || captureMode === "whatsapp") && (
              <div className="mt-6 p-4 bg-slate-900 rounded-xl text-slate-300 text-sm flex gap-3 items-center">
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center flex-shrink-0 text-blue-400">i</div>
                <p>TIP: For mobile/whatsapp calls, ensure your speakerphone is on so MeetScribe can hear both parties clearly.</p>
              </div>
            )}
          </div>
        )}

        <div className="border-t border-slate-200 pt-12">
          <h3 className="text-xl font-bold text-slate-900 mb-8 flex items-center gap-2">
            <Clock className="w-5 h-5 text-slate-400" />
            Recent Meetings
          </h3>

          {transcripts.length === 0 && !isRecording && (
            <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-8 h-8 text-slate-300" />
              </div>
              <h4 className="text-slate-900 font-bold mb-1">Start your first meeting</h4>
              <p className="text-slate-500 text-sm">Conversations will be automatically transcribed and summarized.</p>
            </div>
          )}

          <div className="space-y-8">
            {transcripts.map((t) => (
              <div key={t.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
                <div className="p-6 md:p-8">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 mb-2">{t.title}</h3>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-bold uppercase tracking-wider border border-blue-100">
                          {t.category}
                        </span>
                        <span className="text-xs font-medium text-slate-400">
                          {new Date(t.created_at).toLocaleDateString()} at {new Date(t.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => downloadTranscript(t)}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-bold transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        Download TXT
                      </button>
                      <div className="flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100">
                        <CheckCircle2 className="w-3 h-3" />
                        Processed by AI
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                    {/* Transcript segments */}
                    <div className="lg:col-span-7">
                      <div className="flex items-center gap-2 mb-6 text-slate-400 uppercase text-[10px] font-bold tracking-[0.2em]">
                        <FileText className="w-3 h-3" />
                        Conversation History
                      </div>
                      <div className="space-y-6 max-h-[500px] overflow-auto pr-4 custom-scrollbar">
                        {t.segments.map((s, i) => (
                          <div key={i} className="group">
                            <div className="flex items-start gap-4">
                              <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                {s.speaker_id.charAt(0)}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-1">
                                  <span className="text-xs font-bold text-slate-900">{s.speaker_id}</span>
                                  <span className="text-[10px] text-slate-400 font-medium">{Math.floor(s.start_time)}s</span>
                                </div>
                                <p className="text-sm text-slate-600 leading-relaxed">{s.text}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Summary area */}
                    <div className="lg:col-span-5 space-y-8">
                      {t.summary && (
                        <div className="p-6 bg-blue-50/50 rounded-2xl border border-blue-100/50">
                          <div className="flex items-center gap-2 mb-4 text-blue-600 uppercase text-[10px] font-bold tracking-[0.2em]">
                            <Zap className="w-3 h-3" />
                            Executive Summary
                          </div>
                          <p className="text-sm text-slate-700 leading-relaxed font-medium italic">
                            "{t.summary}"
                          </p>
                        </div>
                      )}

                      {t.minutes && t.minutes.length > 0 && (
                        <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                          <div className="flex items-center gap-2 mb-4 text-slate-400 uppercase text-[10px] font-bold tracking-[0.2em]">
                            <ClipboardList className="w-3 h-3" />
                            Meeting Minutes
                          </div>
                          <ul className="space-y-3">
                            {t.minutes.map((item, i) => (
                              <li key={i} className="flex items-start gap-3 text-sm text-slate-600">
                                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}</style>
    </div>
  );
}
