"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Upload, Mic, Download, Loader2, StopCircle, Play, FileAudio, User, MessageSquare, ClipboardList } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
const WS_BASE = API_BASE.replace("http", "ws");

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
      const socket = new WebSocket(`${WS_BASE}/api/transcribe/ws`);
      socketRef.current = socket;

      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "partial") {
          setRealtimeText(prev => prev + " " + data.text);
        }
      };

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && socket.readyState === WebSocket.OPEN) {
          socket.send(event.data);
        }
      };

      mediaRecorder.start(500); // Send chunks every 500ms
      setIsRecording(true);
    } catch (err) {
      console.error("Failed to start recording", err);
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

    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_BASE}/api/transcribe/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setTranscripts(prev => [data, ...prev]);
    } catch (err) {
      console.error("Upload failed", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Transcription</h1>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors">
            <Upload size={20} />
            <span>Upload Audio</span>
            <input type="file" className="hidden" accept="audio/*" onChange={handleFileUpload} />
          </label>
          <button
            onClick={isRecording ? stopRealtime : startRealtime}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              isRecording ? "bg-red-600 hover:bg-red-700 text-white" : "bg-emerald-600 hover:bg-emerald-700 text-white"
            }`}
          >
            {isRecording ? <StopCircle size={20} /> : <Mic size={20} />}
            <span>{isRecording ? "Stop Recording" : "Live Transcribe"}</span>
          </button>
        </div>
      </div>

      {isRecording && (
        <div className="p-4 bg-gray-50 border rounded-xl animate-pulse">
          <div className="flex items-center gap-2 text-emerald-600 font-medium mb-2">
            <div className="w-2 h-2 bg-emerald-600 rounded-full animate-ping" />
            Listening...
          </div>
          <p className="text-gray-700 italic">{realtimeText || "Waiting for speech..."}</p>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-12 text-gray-500">
          <Loader2 className="animate-spin mb-4" size={48} />
          <p className="text-lg">Processing your audio with AI...</p>
        </div>
      )}

      <div className="space-y-6">
        {transcripts.map((t) => (
          <div key={t.id} className="bg-white border rounded-xl shadow-sm overflow-hidden">
            <div className="p-6 border-b bg-gray-50 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <FileAudio className="text-blue-600" size={20} />
                  {t.title}
                </h3>
                <span className="text-sm text-gray-500">Status: {t.status}</span>
              </div>
              <button className="p-2 text-gray-400 hover:text-blue-600 transition-colors">
                <Download size={20} />
              </button>
            </div>
            
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="flex items-center gap-2 font-medium text-gray-900 border-b pb-2">
                  <MessageSquare size={18} />
                  Transcript & Speakers
                </div>
                <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                  {t.segments.map((s, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <User size={16} className="text-blue-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                          <span className="font-bold text-gray-700">Speaker {s.speaker_id}</span>
                          <span>•</span>
                          <span>{Math.floor(s.start_time)}s</span>
                        </div>
                        <p className="text-sm text-gray-800 leading-relaxed">{s.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                {t.summary && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 font-medium text-gray-900 border-b pb-2">
                      <ClipboardList size={18} />
                      AI Summary
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">{t.summary}</p>
                  </div>
                )}
                
                {t.action_items && t.action_items.length > 0 && (
                  <div className="space-y-3">
                    <div className="font-medium text-gray-900">Action Items</div>
                    <ul className="list-disc list-inside space-y-1">
                      {t.action_items.map((item, i) => (
                        <li key={i} className="text-sm text-gray-700">{item}</li>
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
