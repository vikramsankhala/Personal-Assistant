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
  Upload,
  Languages
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

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi" },
  { code: "bn", label: "Bengali" },
  { code: "mr", label: "Marathi" },
  { code: "te", label: "Telugu" },
  { code: "ta", label: "Tamil" },
  { code: "gu", label: "Gujarati" },
  { code: "kn", label: "Kannada" },
  { code: "ml", label: "Malayalam" },
  { code: "kha", label: "Khasi (Meghalaya)" },
  { code: "grt", label: "Garo (Meghalaya)" },
  { code: "pnr", label: "Jaintia/Pnar (Meghalaya)" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
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
  source_lang?: string;
  target_lang?: string;
};

export function TranscriptionView() {
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [captureMode, setCaptureMode] = useState<"mic" | "system" | "mobile" | "whatsapp">("mic");
  const [realtimeText, setRealtimeText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(MEETING_CATEGORIES[0]);
  const [sourceLang, setSourceLang] = useState("en");
  const [targetLang, setTargetLang] = useState("en");
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
        socket.send(JSON.stringify({ 
          type: "config", 
          category: selectedCategory.id,
          source_lang: sourceLang,
          target_lang: targetLang,
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
    formData.append("source_lang", sourceLang);
    formData.append("target_lang", targetLang);
    formData.append("title", `${file.name} (${captureMode === 'whatsapp' ? 'WhatsApp' : 'Mobile'} Upload)`);

    try {
      setIsRecording(true);
      setRealtimeText(`Processing ${file.name}... (Translating from ${sourceLang} to ${targetLang})`);
      
      const response = await fetch(`${API_BASE}/transcripts/upload`, {
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
    content += `Source: ${LANGUAGES.find(l => l.code === transcript.source_lang)?.label || transcript.source_lang}
`;
    content += `Transcript Language: ${LANGUAGES.find(l => l.code === transcript.target_lang)?.label || transcript.target_lang}
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
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="audio/*" className="hidden" />
      
      <div className="flex-none px-6 py-8 border-b border-slate-100 bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
        <h1 className="text-3xl font-black tracking-tight mb-2">Meeting Room</h1>
        <p className="text-blue-100 opacity-90">Multilingual transcription & AI translation for global meetings.</p>
      </div>

      <div className="flex-1 overflow-auto bg-slate-50 custom-scrollbar">
        <div className="max-w-4xl mx-auto px-6 py-10">
          
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 p-8 mb-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div className="space-y-6">
                <div>
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3 block">Capture Mode</label>
                  <div className="flex flex-wrap gap-2 p-1.5 bg-slate-100 rounded-2xl">
                    {[
                      { id: 'mic', label: 'Mic', icon: Mic },
                      { id: 'system', label: 'System', icon: Monitor },
                      { id: 'mobile', label: 'Mobile', icon: Phone },
                      { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
                    ].map((mode) => (
                      <button
                        key={mode.id}
                        onClick={() => setCaptureMode(mode.id as any)}
                        disabled={isRecording}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                          captureMode === mode.id ? "bg-white text-blue-600 shadow-sm shadow-blue-900/10" : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        <mode.icon size={14} /> {mode.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2 block">Voice Language</label>
                    <select
                      value={sourceLang}
                      onChange={(e) => setSourceLang(e.target.value)}
                      disabled={isRecording}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-400"
                    >
                      {LANGUAGES.map(lang => <option key={lang.code} value={lang.code}>{lang.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2 block">Output Language</label>
                    <select
                      value={targetLang}
                      onChange={(e) => setTargetLang(e.target.value)}
                      disabled={isRecording}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-blue-600 outline-none focus:border-blue-400"
                    >
                      {LANGUAGES.map(lang => <option key={lang.code} value={lang.code}>{lang.label}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex flex-col justify-end space-y-4">
                <button
                  onClick={isRecording ? stopRealtime : startRealtime}
                  className={`w-full py-6 rounded-2xl font-black text-xl flex items-center justify-center gap-4 transition-all shadow-lg active:scale-95 ${
                    isRecording ? "bg-rose-500 hover:bg-rose-600 text-white" : "bg-blue-600 hover:bg-blue-700 text-white"
                  }`}
                >
                  {isRecording ? <StopCircle size={28} /> : (captureMode === 'mobile' || captureMode === 'whatsapp' ? <Upload size={28} /> : <Mic size={28} />)}
                  {isRecording ? "Stop Room" : (captureMode === 'mobile' || captureMode === 'whatsapp' ? "Upload Recording" : "Go Live")}
                </button>
                <p className="text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                  {sourceLang !== targetLang ? `Translating ${LANGUAGES.find(l=>l.code===sourceLang)?.label} ➔ ${LANGUAGES.find(l=>l.code===targetLang)?.label}` : "Capturing Audio..."}
                </p>
              </div>
            </div>
          </div>

          {isRecording && (
            <div className="space-y-6 mb-10">
              <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]"></div>
                    <span className="text-white font-black uppercase tracking-widest text-sm">Real-time Stream</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1 bg-blue-600 rounded-lg text-[10px] font-black text-white uppercase tracking-widest">
                    <Languages size={12} /> {targetLang.toUpperCase()}
                  </div>
                </div>
                <div className="min-h-[160px] max-h-[300px] overflow-auto custom-scrollbar">
                  <p className="text-xl md:text-2xl font-medium text-slate-300 leading-relaxed italic">
                    {realtimeText || "Awaiting voice data..."}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-8">
            <h3 className="text-2xl font-black text-slate-800 tracking-tight">Meeting History</h3>
            {transcripts.map((t) => (
              <div key={t.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-8">
                <div className="flex flex-col md:flex-row justify-between gap-6 mb-8">
                  <div>
                    <h3 className="text-2xl font-black text-slate-800 mb-2">{t.title}</h3>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-widest rounded-lg border border-blue-100">
                        {LANGUAGES.find(l=>l.code===t.source_lang)?.label || t.source_lang} ➔ {LANGUAGES.find(l=>l.code===t.target_lang)?.label || t.target_lang}
                      </span>
                      <span className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                        <Clock size={14} /> {new Date(t.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => downloadTranscript(t)} className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 hover:bg-blue-600 text-white rounded-xl text-sm font-black transition-all shadow-lg active:scale-95">
                    <Download size={18} /> Download
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                  <div className="lg:col-span-7 space-y-6">
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      <FileText size={14} /> Full Transcript ({LANGUAGES.find(l=>l.code===t.target_lang)?.label})
                    </h4>
                    <div className="space-y-4 max-h-[400px] overflow-auto pr-4 custom-scrollbar">
                      {t.segments.map((s, i) => (
                        <div key={i} className="flex gap-4">
                          <div className="flex-none w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center font-black text-slate-400">{s.speaker_id.charAt(0)}</div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-black text-slate-700">{s.speaker_id}</span>
                            </div>
                            <p className="text-slate-600 font-medium leading-relaxed">{s.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="lg:col-span-5 space-y-6">
                    {t.summary && (
                      <div className="bg-amber-50 rounded-2xl p-6 border border-amber-100">
                        <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-amber-700 mb-3">
                          <Zap size={14} /> AI Summary
                        </h4>
                        <p className="text-amber-900 font-bold italic leading-relaxed text-sm">"{t.summary}"</p>
                      </div>
                    )}
                    <div className="flex items-center gap-3 pt-4">
                      <CheckCircle2 size={16} className="text-emerald-500" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Translated by MeetScribe AI</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
          /* ORPHANED INTEGRATION SECTION - TO BE FIXED
<div className="mt-4 px-4 pb-4">
            <div className="border-t border-slate-200 pt-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <span>Integrations</span>
              </h3>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
                {[
                  { id: 'notion', label: 'Notion', color: 'bg-gray-100 text-gray-700' },
                  { id: 'slack', label: 'Slack', color: 'bg-green-100 text-green-700' },
                  { id: 'hubspot', label: 'HubSpot', color: 'bg-orange-100 text-orange-700' },
                  { id: 'attio', label: 'Attio', color: 'bg-blue-100 text-blue-700' },
                  { id: 'affinity', label: 'Affinity', color: 'bg-purple-100 text-purple-700' },
                  { id: 'zapier', label: 'Zapier', color: 'bg-red-100 text-red-700' },
                ].map(app => (
                  <button
                    key={app.id}
                    onClick={() => {
                      const key = prompt(`Enter your ${app.label} API key or Webhook URL:`);
                      if (!key) return;
                      const body: Record<string,string> = {};
                      if (['slack','zapier'].includes(app.id)) body.webhook_url = key;
                      else body.api_key = key;
                      fetch(`${API_BASE}/api/transcripts/${t.id}/send-to/${app.id}`, {
                        method: 'POST',
                        headers: {'Content-Type':'application/json'},
                        body: JSON.stringify(body)
                      })
                      .then(r => r.json())
                      .then(d => alert(d.success ? `Sent to ${app.label}!` : `Error: ${d.error}`))
                      .catch(() => alert('Failed to connect'));
                    }}
                    className={`${app.color} text-xs font-medium py-1.5 px-2 rounded-lg border border-current/20 hover:opacity-80 transition-opacity`}
                  >
                    {app.label}
                  </button>
                ))}
              </div>
            </div>
      </div>
*/

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}</style>
    </div>
  );
}
