'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Camera, Mic, Send, Square, Star } from 'lucide-react';
import Link from 'next/link';
import { useSessionProfile } from '@/lib/useSessionProfile';
import { createClient } from '@/lib/supabase/client';
import type { MessageRow } from '@/lib/types';

interface QuestionDetail {
  id: string;
  content: string;
  photo_url: string | null;
  status: string;
  rating_given: number | null;
  mentee_id: string;
  accepted_tentor_id: string | null;
  subjects: { name: string } | null;
}

export default function ChatPage() {
  const params = useParams<{ sessionId: string }>();
  const questionId = params.sessionId;
  const router = useRouter();
  const { profile } = useSessionProfile();

  const [question, setQuestion] = useState<QuestionDetail | null>(null);
  const [partnerName, setPartnerName] = useState('');
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [ratingValue, setRatingValue] = useState(5);
  const bottomRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const loadMessages = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('question_id', questionId)
      .order('created_at', { ascending: true });
    setMessages((data as MessageRow[]) ?? []);
  }, [questionId]);

  useEffect(() => {
    const supabase = createClient();

    supabase
      .from('questions')
      .select('id, content, photo_url, status, rating_given, mentee_id, accepted_tentor_id, subjects(name)')
      .eq('id', questionId)
      .maybeSingle()
      .then(({ data }) => setQuestion(data as unknown as QuestionDetail));

    loadMessages();

    const channel = supabase
      .channel(`chat-${questionId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `question_id=eq.${questionId}` },
        (payload) => setMessages((prev) => [...prev, payload.new as MessageRow])
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [questionId, loadMessages]);

  useEffect(() => {
    if (!question || !profile) return;
    const partnerId = profile.role === 'mentee' ? question.accepted_tentor_id : question.mentee_id;
    if (!partnerId) return;
    const supabase = createClient();
    supabase
      .from('profiles')
      .select('username')
      .eq('id', partnerId)
      .maybeSingle()
      .then(({ data }) => setPartnerName(data?.username ?? '—'));
  }, [question, profile]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendText() {
    if (!text.trim() || !profile) return;
    const supabase = createClient();
    const body = text.trim();
    setText('');
    await supabase.from('messages').insert({
      question_id: questionId,
      sender_id: profile.id,
      type: 'teks',
      content: body,
    });
  }

  async function uploadFile(file: File, type: 'foto' | 'suara') {
    setUploading(true);
    const formData = new FormData();
    formData.set('questionId', questionId);
    formData.set('type', type);
    formData.set('file', file);
    await fetch('/api/chat/upload', { method: 'POST', body: formData });
    setUploading(false);
  }

  async function toggleRecording() {
    if (recording) {
      mediaRecorderRef.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach((t) => t.stop());
        await uploadFile(new File([blob], 'voice-note.webm', { type: 'audio/webm' }), 'suara');
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch {
      alert('Tidak bisa mengakses mikrofon. Pastikan izin mikrofon diaktifkan.');
    }
  }

  async function submitRating() {
    const res = await fetch(`/api/sessions/${questionId}/end`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rating: ratingValue }),
    });
    if (res.ok) {
      setRatingOpen(false);
      router.push('/dashboard');
    }
  }

  if (!question || !profile) {
    return <main className="flex h-screen items-center justify-center text-ink-400">Memuat…</main>;
  }

  const isActive = question.status === 'berjalan';
  const isMentee = profile.role === 'mentee';

  return (
    <div className="flex h-screen flex-col bg-ink-50">
      <header className="flex items-center justify-between border-b border-ink-100 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="rounded-full p-1.5 hover:bg-ink-100">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <p className="font-medium text-ink-900">{partnerName}</p>
            <p className="text-xs text-ink-500">{question.subjects?.name}</p>
          </div>
        </div>
        {isMentee && isActive && (
          <button onClick={() => setRatingOpen(true)} className="btn-secondary text-sm">
            Akhiri & Beri Nilai
          </button>
        )}
        {question.status === 'selesai' && question.rating_given != null && (
          <span className="flex items-center gap-1 text-sm font-medium text-accent-600">
            <Star size={14} className="fill-accent-500 text-accent-500" /> {question.rating_given}
          </span>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-2xl space-y-3">
          <div className="card border-brand-100 bg-brand-50/40">
            <p className="text-sm font-medium text-brand-700">Pertanyaan awal</p>
            <p className="mt-1 text-ink-800">{question.content}</p>
            {question.photo_url && (
              <img src={question.photo_url} alt="Foto soal" className="mt-2 max-h-64 rounded-2xl object-cover" />
            )}
          </div>

          {messages.map((m) => {
            const mine = m.sender_id === profile.id;
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[75%] rounded-chat px-4 py-2.5 ${
                    mine ? 'bg-brand-500 text-white' : 'border border-ink-100 bg-white text-ink-800'
                  }`}
                >
                  {m.type === 'teks' && <p className="whitespace-pre-wrap">{m.content}</p>}
                  {m.type === 'foto' && (
                    <img src={m.content} alt="Foto" className="max-h-56 rounded-xl object-cover" />
                  )}
                  {m.type === 'suara' && <audio controls src={m.content} className="max-w-[220px]" />}
                  <p className={`mt-1 text-[10px] ${mine ? 'text-brand-100' : 'text-ink-400'}`}>
                    {new Date(m.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      {isActive ? (
        <div className="border-t border-ink-100 bg-white px-4 py-3">
          <div className="mx-auto flex max-w-2xl items-center gap-2">
            <label className="cursor-pointer rounded-full p-2.5 text-ink-500 hover:bg-ink-100">
              <Camera size={20} />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadFile(f, 'foto');
                  e.target.value = '';
                }}
              />
            </label>
            <button
              onClick={toggleRecording}
              className={`rounded-full p-2.5 ${recording ? 'bg-red-500 text-white' : 'text-ink-500 hover:bg-ink-100'}`}
            >
              {recording ? <Square size={20} /> : <Mic size={20} />}
            </button>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendText()}
              placeholder="Tulis pesan…"
              className="input-field flex-1"
            />
            <button onClick={sendText} className="rounded-full bg-brand-500 p-3 text-white hover:bg-brand-600">
              <Send size={18} />
            </button>
          </div>
        </div>
      ) : (
        <div className="border-t border-ink-100 bg-ink-100 px-4 py-3 text-center text-sm text-ink-500">
          Sesi ini sudah berakhir.
        </div>
      )}

      {ratingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6">
            <h2 className="text-lg font-semibold text-ink-900">Kasih bintang buat {partnerName}</h2>
            <p className="mt-1 text-sm text-ink-600">Wajib diisi sebelum sesi ditutup.</p>
            <div className="mt-4 flex justify-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => setRatingValue(n)} aria-label={`${n} bintang`}>
                  <Star
                    size={32}
                    className={n <= ratingValue ? 'fill-accent-500 text-accent-500' : 'text-ink-200'}
                  />
                </button>
              ))}
            </div>
            <div className="mt-6 flex gap-2">
              <button onClick={() => setRatingOpen(false)} className="btn-secondary flex-1">Batal</button>
              <button onClick={submitRating} className="btn-primary flex-1">Kirim & Akhiri</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
