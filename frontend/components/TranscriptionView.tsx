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
  MessageCircle,
  Upload
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startRealtime = async () => {
    try {
      if (captureMode === "mobile" || captureMode === "whatsapp") {
        fileInputRef.current?.click();
        return;
      }

      let stream: MediaStream;
      if (captureMode === "system") {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: { displaySurface: "browser" },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        
        if (stream.getAudioTracks().length === 0) {
          stream.getTracks().forEach(t => t.stop());
          alert("System audio capture requires 'Share audio' to be checked in the popup.");
          return;
        }
        stream.getVideoTracks().forEach(track => track.stop());
      } else {
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true
          } 
        });
      }

      streamRef.current = stream;
      const socket = new WebSocket(`${WS_BASE}/ws/transcribe`);
      socketRef.current = socket;

      socket.onopen = () => {
        let modeLabel = captureMode.charAt(0).toUpperCase() + captureMode.slice(1);
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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", selectedCategory.id);
    formData.append("title", `${file.name} (${captureMode === 'whatsapp' ? 'WhatsApp' : 'Mobile'} Upload)`);

    try {
      setIsRecording(true);
      setRealtimeText(`Uploading and processing ${file.name}...`);
      
      const response = await fetch(`${API_BASE}/transcribe-file`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Upload failed");

      const data = await response.json();
      setTranscripts((prev) => [data.transcript, ...prev]);
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Failed to process audio file.");
    } finally {
      setIsRecording(false);
      setRealtimeText("");
      if (fileInputRef.current) fileInputRef.current.value = "";
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

  const downloadTranscript = async (transcript: Transcript) => {
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

    const filename = `${transcript.title.replace(/\s+/g, '_')}_transcript.txt`;
    const blob = new Blob([content], { type: "text/plain" });

    // iOS Safari / Web Share API Check
    if (navigator.share && /iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      try {
        const file = new File([blob], filename, { type: "text/plain" });
        await navigator.share({
          files: [file],
          title: transcript.title,
          text: "Meeting transcript from MeetScribe"
        });
        return;
      } catch (err) {
        console.log("Share failed, falling back to download", err);
      }
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        accept="audio/*" 
        className="hidden" 
      />
      
      {/* Header */}
      <div className="flex-none px-6 py-8 border-b border-slate-100 bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
        <h1 className="text-3xl font-black tracking-tight mb-2">Meeting Room</h1>
        <p className="text-blue-100 opacity-90">Real-time transcription for Teams, Zoom, WhatsApp & Calls.</p>
      </div>

      <div className="flex-1 overflow-auto bg-slate-50 custom-scrollbar">
        <div className="max-w-4xl mx-auto px-6 py-10">
          
          {/* Main Controls Card */}
          <div className="bg-white rounded-3xl shadow-xl shadow-blue-900/5 border border-slate-200 p-8 mb-10 transition-all hover:shadow-2xl hover:shadow-blue-900/10">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
              
              <div className="space-y-6">
                <div>
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3 block">Capture Mode</label>
                  <div className="flex flex-wrap gap-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200">
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
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                          captureMode === mode.id 
                            ? "bg-white text-blue-600 shadow-sm border border-slate-200" 
                            : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
                        } ${isRecording ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        <mode.icon size={16} />
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3 block">Meeting Category</label>
                  <div className="relative">
                    <button
                      onClick={() => !isRecording && setShowCategoryDropdown(!showCategoryDropdown)}
                      disabled={isRecording}
                      className={`w-full flex items-center justify-between px-5 py-4 bg-white border border-slate-200 rounded-2xl shadow-sm transition-all ${
                        isRecording ? "opacity-50 cursor-not-allowed" : "hover:border-blue-400 hover:shadow-md active:scale-[0.98]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                          <selectedCategory.icon size={18} />
                        </div>
                        <span className="font-bold text-slate-700">{selectedCategory.label}</span>
                      </div>
                      <ChevronDown size={20} className={`text-slate-400 transition-transform ${showCategoryDropdown ? 'rotate-180' : ''}`} />
                    </button>

                    {showCategoryDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden py-2 animate-in fade-in slide-in-from-top-2">
                        {MEETING_CATEGORIES.map((cat) => (
                          <button
                            key={cat.id}
                            onClick={() => {
                              setSelectedCategory(cat);
                              setShowCategoryDropdown(false);
                            }}
                            className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-blue-50 text-left transition-colors"
                          >
                            <cat.icon size={18} className="text-slate-400" />
                            <span className="font-semibold text-slate-700">{cat.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col justify-end h-full">
                <button
                  onClick={isRecording ? stopRealtime : startRealtime}
                  className={`w-full py-6 rounded-2xl font-black text-xl flex items-center justify-center gap-4 transition-all shadow-lg active:scale-95 ${
                    isRecording 
                      ? "bg-rose-500 hover:bg-rose-600 text-white shadow-rose-200" 
                      : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200"
                  }`}
                >
                  {isRecording ? <StopCircle size={28} /> : (captureMode === 'mobile' || captureMode === 'whatsapp' ? <Upload size={28} /> : <Mic size={28} />)}
                  {isRecording ? "End Session" : (captureMode === 'mobile' || captureMode === 'whatsapp' ? "Upload Audio" : "Start Live")}
                </button>
                <p className="text-center text-xs font-bold text-slate-400 mt-4 uppercase tracking-widest">
                  {isRecording ? "Recording in progress..." : "Ready to transcribe"}
                </p>
              </div>
            </div>
          </div>

          {/* Live View Area */}
          {isRecording && (
            <div className="space-y-6 mb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-rose-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(244,63,94,0.8)]"></div>
                    <span className="text-white font-black uppercase tracking-widest text-sm">
                      Live {captureMode === 'system' ? 'System Audio' : captureMode === 'whatsapp' ? 'WhatsApp' : captureMode === 'mobile' ? 'Mobile' : 'Mic'} Stream
                    </span>
                  </div>
                  <div className="px-3 py-1 bg-white/10 rounded-full text-xs font-bold text-white/50 border border-white/5">
                    Capturing...
                  </div>
                </div>
                
                <div className="min-h-[160px] max-h-[300px] overflow-auto custom-scrollbar">
                  <p className="text-xl md:text-2xl font-medium text-slate-300 leading-relaxed italic">
                    {realtimeText || "Listening to meeting conversations..."}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                  <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 mb-4">
                    <User size={14} className="text-blue-500" />
                    Speaker Detection
                  </h4>
                  <p className="text-sm font-bold text-slate-400 animate-pulse">Identifying participants...</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                  <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 mb-4">
                    <Zap size={14} className="text-amber-500" />
                    AI Insights
                  </h4>
                  <p className="text-sm font-bold text-slate-400 animate-pulse">Summarizing key points...</p>
                </div>
              </div>

              {captureMode === "mic" && (
                <div className="flex items-start gap-4 p-5 bg-blue-50 border border-blue-100 rounded-2xl">
                  <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
                    <Phone size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-blue-900 uppercase tracking-tight mb-1">Speakerphone Tip</h4>
                    <p className="text-sm font-bold text-blue-700/70">For calls, ensure speakerphone is on so MeetScribe can hear all parties clearly.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Results Area */}
          <div className="space-y-12">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-black text-slate-800 tracking-tight">Recent Meetings</h3>
              <div className="px-4 py-1.5 bg-slate-200 text-slate-500 rounded-full text-xs font-black uppercase tracking-widest">
                {transcripts.length} Saved
              </div>
            </div>

            {transcripts.length === 0 && !isRecording && (
              <div className="py-24 flex flex-col items-center justify-center bg-white rounded-3xl border-2 border-dashed border-slate-200 opacity-60">
                <div className="p-6 bg-slate-50 rounded-full mb-6">
                  <MessageSquare size={48} className="text-slate-300" />
                </div>
                <h4 className="text-xl font-black text-slate-400 mb-2">Start your first meeting</h4>
                <p className="text-sm font-bold text-slate-300">Conversations will be automatically transcribed and summarized.</p>
              </div>
            )}

            <div className="space-y-8">
              {transcripts.map((t) => (
                <div key={t.id} className="group bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:shadow-xl hover:border-blue-200">
                  <div className="p-8">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
                      <div>
                        <h3 className="text-2xl font-black text-slate-800 group-hover:text-blue-600 transition-colors mb-2">{t.title}</h3>
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-widest rounded-lg border border-blue-100">{t.category}</span>
                          <span className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                            <Clock size={14} />
                            {new Date(t.created_at).toLocaleDateString()} at {new Date(t.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                      <button 
                        onClick={() => downloadTranscript(t)}
                        className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 hover:bg-blue-600 text-white rounded-xl text-sm font-black transition-all shadow-lg active:scale-95"
                      >
                        <Download size={18} />
                        Download TXT
                      </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                      {/* Transcript */}
                      <div className="lg:col-span-7 space-y-6">
                        <div className="flex items-center gap-3 mb-2">
                          <FileText size={16} className="text-slate-400" />
                          <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Conversation History</h4>
                        </div>
                        <div className="space-y-6 max-h-[400px] overflow-auto pr-4 custom-scrollbar">
                          {t.segments.map((s, i) => (
                            <div key={i} className="flex gap-4">
                              <div className="flex-none w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center font-black text-slate-400 border border-slate-200">
                                {s.speaker_id.charAt(0)}
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-black text-slate-700">{s.speaker_id}</span>
                                  <span className="text-[10px] font-bold text-slate-400">{Math.floor(s.start_time)}s</span>
                                </div>
                                <p className="text-slate-600 leading-relaxed font-medium">{s.text}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Summary Side */}
                      <div className="lg:col-span-5 space-y-8">
                        {t.summary && (
                          <div className="bg-blue-50/50 rounded-2xl p-6 border border-blue-100/50">
                            <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-blue-600 mb-4">
                              <Zap size={14} />
                              Executive Summary
                            </h4>
                            <p className="text-slate-700 leading-relaxed font-bold italic">"{t.summary}"</p>
                          </div>
                        )}
                        
                        {t.minutes && t.minutes.length > 0 && (
                          <div className="bg-emerald-50/50 rounded-2xl p-6 border border-emerald-100/50">
                            <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-emerald-600 mb-4">
                              <ClipboardList size={14} />
                              Actionable Minutes
                            </h4>
                            <ul className="space-y-3">
                              {t.minutes.map((item, i) => (
                                <li key={i} className="flex items-start gap-3 text-sm font-bold text-emerald-900/80">
                                  <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 flex-none" />
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        <div className="pt-4 flex items-center gap-3">
                          <CheckCircle2 size={16} className="text-emerald-500" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Processed by MeetScribe AI</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
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
