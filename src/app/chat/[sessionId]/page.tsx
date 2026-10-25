'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Camera, Hourglass, Mic, PartyPopper, Send, Square, Star } from 'lucide-react';
import Link from 'next/link';
import { useSessionProfile } from '@/lib/useSessionProfile';
import { createClient } from '@/lib/supabase/client';
import { UserLink } from '@/components/UserLink';
import type { MessageRow } from '@/lib/types';

interface QuestionDetail {
  id: string;
  title: string | null;
  content: string;
  photo_url: string | null;
  status: string;
  rating_given: number | null;
  mentee_id: string;
  accepted_tentor_id: string | null;
  subjects: { name: string } | null;
}

interface WaitInfo {
  status: string;
  offeredCount: number;
  pendingCount: number;
  declinedCount: number;
  expiresAt: string | null;
  tentorUsername: string | null;
}

function waitMessage(info: WaitInfo | null): string {
  if (!info) return 'Memeriksa status pertanyaanmu…';
  if (info.offeredCount === 0) {
    return 'Belum ada tentor yang online untuk mapel ini. Pertanyaanmu otomatis ditawarkan begitu ada tentor yang tersedia.';
  }
  const declined = info.declinedCount > 0 ? ` ${info.declinedCount} di antaranya menolak.` : '';
  return `Sudah ditawarkan ke ${info.offeredCount} tentor dan belum ada yang menerima.${declined} Tawaran diperbarui tiap jam.`;
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
  const [reviewText, setReviewText] = useState('');
  const [publishConsent, setPublishConsent] = useState(false);
  const [publishAnonymous, setPublishAnonymous] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [waitInfo, setWaitInfo] = useState<WaitInfo | null>(null);
  const [acceptedNotice, setAcceptedNotice] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const prevStatusRef = useRef<string | null>(null);

  const loadMessages = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('question_id', questionId)
      .order('created_at', { ascending: true });
    setMessages((data as MessageRow[]) ?? []);
  }, [questionId]);

  const loadQuestion = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('questions')
      .select('id, title, content, photo_url, status, rating_given, mentee_id, accepted_tentor_id, subjects(name)')
      .eq('id', questionId)
      .maybeSingle();
    if (data) setQuestion(data as unknown as QuestionDetail);
  }, [questionId]);

  const loadWaitInfo = useCallback(async () => {
    const res = await fetch(`/api/questions/${questionId}/status`);
    if (res.ok) setWaitInfo((await res.json()) as WaitInfo);
  }, [questionId]);

  // Data awal + langganan realtime: pesan baru DAN perubahan status sesi
  // (supaya begitu tentor menerima, kolom ketik langsung aktif tanpa keluar-masuk).
  useEffect(() => {
    const supabase = createClient();
    loadQuestion();
    loadMessages();

    const channel = supabase
      .channel(`chat-${questionId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `question_id=eq.${questionId}` },
        (payload) => setMessages((prev) => [...prev, payload.new as MessageRow])
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'questions', filter: `id=eq.${questionId}` },
        () => {
          loadQuestion();
          loadWaitInfo();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [questionId, loadQuestion, loadMessages, loadWaitInfo]);

  // Cadangan kalau sinyal realtime terlambat: selama masih menunggu, cek status tiap 5 detik
  const status = question?.status;
  useEffect(() => {
    if (status !== 'menunggu') return;
    loadWaitInfo();
    const timer = setInterval(() => {
      loadQuestion();
      loadWaitInfo();
    }, 5000);
    return () => clearInterval(timer);
  }, [status, loadQuestion, loadWaitInfo]);

  // Kabar singkat saat status berubah dari "menunggu" menjadi "berjalan"
  useEffect(() => {
    if (!question) return;
    if (prevStatusRef.current === 'menunggu' && question.status === 'berjalan') {
      setAcceptedNotice('Pertanyaanmu diterima! Silakan mulai ngobrol.');
      loadMessages();
      const t = setTimeout(() => setAcceptedNotice(null), 6000);
      prevStatusRef.current = question.status;
      return () => clearTimeout(t);
    }
    prevStatusRef.current = question.status;
  }, [question, loadMessages]);

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
  }, [messages, question?.status]);

  // Tinggi layar yang sebenarnya terlihat (di HP: tanpa toolbar browser dan keyboard),
  // supaya kolom ketik tidak tertutup.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => document.documentElement.style.setProperty('--vvh', `${vv.height}px`);
    update();
    vv.addEventListener('resize', update);
    return () => {
      vv.removeEventListener('resize', update);
      document.documentElement.style.removeProperty('--vvh');
    };
  }, []);

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
    setRatingError(null);
    setRatingSubmitting(true);
    const res = await fetch(`/api/sessions/${questionId}/end`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        rating: ratingValue,
        review: reviewText.trim() || undefined,
        publish: publishConsent,
        anonymous: publishConsent && publishAnonymous,
      }),
    });
    setRatingSubmitting(false);
    if (res.ok) {
      setRatingOpen(false);
      router.push('/dashboard');
      return;
    }
    const body = await res.json().catch(() => ({}));
    setRatingError(body.error ?? 'Gagal mengakhiri sesi. Coba lagi.');
  }

  if (!question || !profile) {
    return <main className="flex h-dvh items-center justify-center text-ink-400">Memuat…</main>;
  }

  const isActive = question.status === 'berjalan';
  const isWaiting = question.status === 'menunggu';
  const isExpired = question.status === 'hangus';
  const isMentee = profile.role === 'mentee';
  const expiresText = waitInfo?.expiresAt
    ? new Date(waitInfo.expiresAt).toLocaleString('id-ID', {
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div className="flex flex-col bg-ink-50" style={{ height: 'var(--vvh, 100dvh)' }}>
      <header className="flex items-center justify-between border-b border-ink-100 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="rounded-full p-1.5 hover:bg-ink-100">
            <ArrowLeft size={18} />
          </Link>
          <div>
            {partnerName && partnerName !== '—' ? (
              <UserLink username={partnerName} withAt={false} />
            ) : (
              <p className="font-medium text-ink-900">{isWaiting ? 'Mencari tentor…' : partnerName}</p>
            )}
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

      {acceptedNotice && (
        <div className="flex items-center gap-2 bg-brand-50 px-4 py-2 text-sm font-medium text-brand-700">
          <PartyPopper size={16} /> {acceptedNotice}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-2xl space-y-3">
          <div className="card border-brand-100 bg-brand-50/40">
            <p className="text-sm font-medium text-brand-700">Pertanyaan awal</p>
            {question.title && <p className="mt-1 font-semibold text-ink-900">{question.title}</p>}
            <p className="mt-1 text-ink-800">{question.content}</p>
            {question.photo_url && (
              // eslint-disable-next-line @next/next/no-img-element
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
                    // eslint-disable-next-line @next/next/no-img-element
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

      {isActive && (
        <div className="border-t border-ink-100 bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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
              enterKeyHint="send"
              placeholder="Tulis pesan…"
              className="input-field flex-1"
            />
            <button onClick={sendText} className="rounded-full bg-brand-500 p-3 text-white hover:bg-brand-600">
              <Send size={18} />
            </button>
          </div>
        </div>
      )}

      {isWaiting && (
        <div className="border-t border-accent-100 bg-accent-50 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto flex max-w-2xl items-start gap-3 text-sm text-accent-700">
            <Hourglass size={18} className="mt-0.5 shrink-0" />
            <div>
              {isMentee ? (
                <>
                  <p className="font-medium">Menunggu tentor menerima pertanyaanmu</p>
                  <p className="mt-0.5">{waitMessage(waitInfo)}</p>
                  {expiresText && <p className="mt-0.5 text-accent-600">Kami terus mencari sampai {expiresText}.</p>}
                </>
              ) : (
                <p className="font-medium">Sesi ini belum kamu terima.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {isExpired && (
        <div className="border-t border-red-100 bg-red-50 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-sm text-red-700">
          <div className="mx-auto max-w-2xl">
            <p className="font-medium">Belum ada tentor yang menerima pertanyaanmu.</p>
            <p className="mt-0.5">
              Tentor belum bisa menjawab kali ini. Coba kirim lagi atau tanyakan hal lain.{' '}
              {isMentee && (
                <Link href="/pertanyaan/ajukan" className="font-semibold underline">
                  Ajukan lagi
                </Link>
              )}
            </p>
          </div>
        </div>
      )}

      {question.status === 'selesai' && (
        <div className="border-t border-ink-100 bg-ink-100 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center text-sm text-ink-500">
          Sesi ini sudah berakhir.
        </div>
      )}

      {ratingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="max-h-full w-full max-w-sm overflow-y-auto rounded-3xl bg-white p-6">
            <h2 className="text-lg font-semibold text-ink-900">Kasih bintang buat {partnerName}</h2>
            <p className="mt-1 text-sm text-ink-600">Bintang wajib diisi. Ulasan boleh dikosongkan.</p>
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
            <textarea
              className="input-field mt-4 min-h-24 text-sm"
              value={reviewText}
              maxLength={500}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="Tulis ulasan untuk tentor (opsional). Ulasan tampil di profilnya."
            />
            <div className="mt-4 rounded-2xl border border-ink-100 p-3">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={publishConsent}
                  onChange={(e) => setPublishConsent(e.target.checked)}
                />
                <span className="text-sm">
                  <span className="block font-medium text-ink-900">Izinkan sesi ini dipublikasikan di forum</span>
                  <span className="block text-ink-500">
                    Chat tidak tayang otomatis. Tentor memilih pesan yang ditampilkan dan menambah penjelasan, isi pesan tidak diubah, dan voice note tidak pernah tampil. Kamu dapat notifikasi saat sudah tayang dan bisa menariknya kapan saja.
                  </span>
                </span>
              </label>
              {publishConsent && (
                <label className="mt-3 flex cursor-pointer items-center gap-3 border-t border-ink-100 pt-3 text-sm text-ink-700">
                  <input type="checkbox" checked={publishAnonymous} onChange={(e) => setPublishAnonymous(e.target.checked)} />
                  Tampilkan sebagai anonim (username-mu tidak muncul)
                </label>
              )}
            </div>
            {ratingError && <p className="mt-2 text-sm text-red-600">{ratingError}</p>}
            <div className="mt-4 flex gap-2">
              <button onClick={() => setRatingOpen(false)} className="btn-secondary flex-1">Batal</button>
              <button onClick={submitRating} disabled={ratingSubmitting} className="btn-primary flex-1">
                {ratingSubmitting ? 'Mengirim…' : 'Kirim & Akhiri'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
