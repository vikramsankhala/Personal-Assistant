"use client";

import { useState, useRef } from "react";
import { Upload, Mic, Download, Loader2, StopCircle, FileAudio, User, MessageSquare, ClipboardList } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
const WS_BASE = (process.env.NEXT_PUBLIC_API_URL || "").replace(/^http/, "ws");

type TranscriptSegment = {
  speaker_id: string;
  start_time: number;
  end_time: number;
  text: string;
};

type Transcript = {
  id: string;
  title: string;
  status: string;
  full_text?: string;
  summary?: string;
  action_items?: string[];
  segments: TranscriptSegment[];
};

export function TranscriptionView() {
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [realtimeText, setRealtimeText] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  const startRealtime = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const socket = new WebSocket(`${WS_BASE}/ws/transcribe`);
      socketRef.current = socket;

      socket.onopen = () => {
        const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0 && socket.readyState === WebSocket.OPEN) {
            socket.send(event.data);
          }
        };

        mediaRecorder.start(500);
      };

      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.text) {
          setRealtimeText((prev) => prev + " " + data.text);
        }
      };

      socket.onerror = (err) => console.error("WebSocket error", err);

      setIsRecording(true);
    } catch (err) {
      console.error("Failed to start recording:", err);
    }
  };

  const stopRealtime = () => {
    mediaRecorderRef.current?.stop();
    socketRef.current?.close();
    setIsRecording(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_BASE}/api/transcripts/upload`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setTranscripts((prev) => [data, ...prev]);
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Transcription</h1>
        <div className="flex gap-3">
          <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors text-sm font-medium">
            <Upload size={18} />
            Upload Audio
            <input type="file" className="hidden" accept="audio/*,video/*" onChange={handleFileUpload} />
          </label>
          <button
            onClick={isRecording ? stopRealtime : startRealtime}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
              isRecording
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "bg-emerald-600 hover:bg-emerald-700 text-white"
            }`}
          >
            {isRecording ? <StopCircle size={18} /> : <Mic size={18} />}
            {isRecording ? "Stop" : "Live Transcribe"}
          </button>
        </div>
      </div>

      {/* Live transcription display */}
      {isRecording && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
          <div className="flex items-center gap-2 text-emerald-700 font-semibold mb-2">
            <span className="w-2 h-2 bg-emerald-600 rounded-full animate-ping" />
            Listening live...
          </div>
          <p className="text-gray-700 italic leading-relaxed">
            {realtimeText || "Waiting for speech..."}
          </p>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-500 gap-4">
          <Loader2 className="animate-spin" size={48} />
          <p className="text-lg">Processing your audio with AI...</p>
          <p className="text-sm text-gray-400">Transcribing, diarizing speakers, and generating summaries</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && transcripts.length === 0 && !isRecording && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-4">
          <FileAudio size={64} className="text-gray-200" />
          <div className="text-center">
            <p className="text-lg font-medium text-gray-500">No transcripts yet</p>
            <p className="text-sm mt-1">Upload an audio file or use Live Transcribe to get started</p>
          </div>
        </div>
      )}

      {/* Transcript cards */}
      <div className="space-y-6">
        {transcripts.map((t) => (
          <div key={t.id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            {/* Card header */}
            <div className="p-5 border-b bg-gray-50 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <FileAudio className="text-blue-600" size={18} />
                  {t.title}
                </h3>
                <span
                  className={`text-xs mt-1 inline-block px-2 py-0.5 rounded-full font-medium ${
                    t.status === "completed"
                      ? "bg-green-100 text-green-700"
                      : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {t.status}
                </span>
              </div>
              <button
                title="Download transcript"
                className="p-2 text-gray-400 hover:text-blue-600 transition-colors rounded-lg hover:bg-blue-50"
              >
                <Download size={18} />
              </button>
            </div>

            {/* Card body */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Segments */}
              <div>
                <div className="flex items-center gap-2 font-semibold text-gray-800 mb-4 pb-2 border-b">
                  <MessageSquare size={16} />
                  Transcript
                </div>
                <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
                  {t.segments.length > 0 ? (
                    t.segments.map((s, i) => (
                      <div key={i} className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <User size={14} className="text-blue-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 text-xs text-gray-400 mb-0.5">
                            <span className="font-semibold text-gray-700">{s.speaker_id}</span>
                            <span>&bull;</span>
                            <span>{s.start_time.toFixed(1)}s &ndash; {s.end_time.toFixed(1)}s</span>
                          </div>
                          <p className="text-sm text-gray-800 leading-relaxed">{s.text}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-400 italic">{t.full_text || "No segments available."}</p>
                  )}
                </div>
              </div>

              {/* Summary & Action items */}
              <div className="space-y-6">
                {t.summary && (
                  <div>
                    <div className="flex items-center gap-2 font-semibold text-gray-800 mb-3 pb-2 border-b">
                      <ClipboardList size={16} />
                      AI Summary
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">{t.summary}</p>
                  </div>
                )}
                {t.action_items && t.action_items.length > 0 && (
                  <div>
                    <div className="font-semibold text-gray-800 mb-3">Action Items</div>
                    <ul className="space-y-1.5">
                      {t.action_items.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
