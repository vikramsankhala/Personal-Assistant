"use client";

import { useState, useCallback } from "react";
import { Upload, Mic, Download, Loader2 } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

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
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = useCallback(async () => {
    if (!file) return;
    setError(null);
    setUploading(true);
    setTranscript(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_BASE}/api/transcripts/upload`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setTranscript(data);

      // Poll for completion
      if (data.status === "processing") {
        const poll = async () => {
          const r = await fetch(`${API_BASE}/api/transcripts/${data.id}`);
          const t = await r.json();
          setTranscript(t);
          if (t.status === "processing") setTimeout(poll, 2000);
        };
        setTimeout(poll, 2000);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, [file]);

  const handleExport = async (format: string) => {
    if (!transcript) return;
    window.open(
      `${API_BASE}/api/transcripts/${transcript.id}/export?format=${format}`,
      "_blank"
    );
  };

  return (
    <div className="space-y-8">
      {/* Upload zone */}
      <div className="rounded-2xl border border-ink-700/50 bg-ink-800/30 p-8">
        <h2 className="text-lg font-semibold text-ink-100 mb-4 flex items-center gap-2">
          <Upload className="w-5 h-5 text-accent" />
          Upload Audio
        </h2>
        <p className="text-sm text-ink-400 mb-4">
          MP3, WAV, M4A, OGG, FLAC — up to 100MB. Supports speaker diarization.
        </p>

        <div
          className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
            file
              ? "border-accent/50 bg-accent/5"
              : "border-ink-600 hover:border-ink-500"
          }`}
        >
          <input
            type="file"
            accept=".mp3,.wav,.m4a,.ogg,.flac,.webm"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="hidden"
            id="file-upload"
          />
          <label htmlFor="file-upload" className="cursor-pointer block">
            {file ? (
              <p className="text-ink-200 font-medium">{file.name}</p>
            ) : (
              <p className="text-ink-400">
                Drag and drop or <span className="text-accent">browse</span>
              </p>
            )}
          </label>
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="mt-4 px-6 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white font-medium disabled:opacity-50 flex items-center gap-2 mx-auto"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing…
              </>
            ) : (
              "Transcribe"
            )}
          </button>
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-400">{error}</p>
        )}
      </div>

      {/* Live transcription placeholder */}
      <div className="rounded-2xl border border-ink-700/50 bg-ink-800/30 p-8 opacity-75">
        <h2 className="text-lg font-semibold text-ink-100 mb-4 flex items-center gap-2">
          <Mic className="w-5 h-5 text-accent" />
          Live Transcription
        </h2>
        <p className="text-sm text-ink-400">
          Connect a microphone for real-time transcription via WebSocket. Coming soon.
        </p>
      </div>

      {/* Transcript result */}
      {transcript && (
        <div className="rounded-2xl border border-ink-700/50 bg-ink-800/30 p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-ink-100">{transcript.title}</h2>
            <div className="flex gap-2">
              <button
                onClick={() => handleExport("json")}
                className="px-3 py-1.5 rounded-lg bg-ink-700 text-ink-200 text-sm hover:bg-ink-600 flex items-center gap-1"
              >
                <Download className="w-4 h-4" />
                JSON
              </button>
              <button
                onClick={() => handleExport("markdown")}
                className="px-3 py-1.5 rounded-lg bg-ink-700 text-ink-200 text-sm hover:bg-ink-600 flex items-center gap-1"
              >
                <Download className="w-4 h-4" />
                Markdown
              </button>
              <button
                onClick={() => handleExport("srt")}
                className="px-3 py-1.5 rounded-lg bg-ink-700 text-ink-200 text-sm hover:bg-ink-600 flex items-center gap-1"
              >
                <Download className="w-4 h-4" />
                SRT
              </button>
            </div>
          </div>

          {transcript.status === "processing" && (
            <div className="flex items-center gap-2 text-ink-400 mb-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing audio… (ASR → Diarization → Summarization)
            </div>
          )}

          {transcript.summary && (
            <div className="mb-6 p-4 rounded-xl bg-ink-800/50">
              <h3 className="text-sm font-medium text-ink-300 mb-2">Summary</h3>
              <p className="text-ink-200">{transcript.summary}</p>
            </div>
          )}

          {transcript.action_items && transcript.action_items.length > 0 && (
            <div className="mb-6 p-4 rounded-xl bg-ink-800/50">
              <h3 className="text-sm font-medium text-ink-300 mb-2">Action Items</h3>
              <ul className="list-disc list-inside text-ink-200 space-y-1">
                {transcript.action_items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-3">
            <h3 className="text-sm font-medium text-ink-300">Transcript</h3>
            {transcript.segments?.length ? (
              transcript.segments.map((seg, i) => (
                <div
                  key={i}
                  className="flex gap-4 p-3 rounded-lg bg-ink-800/30 hover:bg-ink-800/50"
                >
                  <span className="text-xs text-accent font-mono shrink-0 w-24">
                    {seg.start_time.toFixed(1)}s
                  </span>
                  <span className="text-xs text-ink-500 shrink-0">
                    {seg.speaker_id}
                  </span>
                  <p className="text-ink-200">{seg.text}</p>
                </div>
              ))
            ) : transcript.full_text ? (
              <p className="text-ink-200 whitespace-pre-wrap">{transcript.full_text}</p>
            ) : (
              <p className="text-ink-500">No transcript yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
