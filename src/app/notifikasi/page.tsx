'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X, Clock, ImageIcon } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { useSessionProfile } from '@/lib/useSessionProfile';
import { createClient } from '@/lib/supabase/client';

interface AssignmentItem {
  id: string;
  question_id: string;
  sent_at: string;
  questions: {
    id: string;
    content: string;
    photo_url: string | null;
    subjects: { name: string } | null;
  } | null;
}

interface MenteeQuestionItem {
  id: string;
  content: string;
  status: string;
  created_at: string;
  subjects: { name: string } | null;
}

const MENTEE_STATUS: Record<string, { label: string; note: string; className: string }> = {
  menunggu: {
    label: 'Mencari tentor',
    note: 'Lagi dicarikan tentor yang paling pas buat jawab soal ini.',
    className: 'bg-accent-50 text-accent-700',
  },
  berjalan: {
    label: 'Ada yang jawab!',
    note: 'Tentor sudah menerima — lanjut ke ruang chat.',
    className: 'bg-online-500/10 text-online-600',
  },
  selesai: { label: 'Selesai', note: 'Sesi belajar ini sudah selesai.', className: 'bg-ink-100 text-ink-600' },
  hangus: {
    label: 'Belum ada yang jawab',
    note: 'Tentor belum bisa menjawab pertanyaanmu kali ini — coba kirim lagi atau tanyakan hal lain, ya!',
    className: 'bg-red-50 text-red-600',
  },
};

export default function NotifikasiPage() {
  const { profile, loading } = useSessionProfile();
  const router = useRouter();
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [menteeQuestions, setMenteeQuestions] = useState<MenteeQuestionItem[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadTentorAssignments = useCallback(async (tentorId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from('question_assignments')
      .select('id, question_id, sent_at, questions(id, content, photo_url, subjects(name))')
      .eq('tentor_id', tentorId)
      .eq('status', 'menunggu')
      .order('sent_at', { ascending: false });
    setAssignments((data as unknown as AssignmentItem[]) ?? []);
  }, []);

  const loadMenteeQuestions = useCallback(async (menteeId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from('questions')
      .select('id, content, status, created_at, subjects(name)')
      .eq('mentee_id', menteeId)
      .order('created_at', { ascending: false })
      .limit(15);
    setMenteeQuestions((data as unknown as MenteeQuestionItem[]) ?? []);
  }, []);

  useEffect(() => {
    if (!profile) return;
    const supabase = createClient();

    if (profile.role === 'tentor') {
      loadTentorAssignments(profile.id);
      const channel = supabase
        .channel('notif-tentor')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'question_assignments', filter: `tentor_id=eq.${profile.id}` },
          () => loadTentorAssignments(profile.id)
        )
        .subscribe();
      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      loadMenteeQuestions(profile.id);
      const channel = supabase
        .channel('notif-mentee')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'questions', filter: `mentee_id=eq.${profile.id}` },
          () => loadMenteeQuestions(profile.id)
        )
        .subscribe();
      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [profile, loadTentorAssignments, loadMenteeQuestions]);

  async function respond(questionId: string, action: 'accept' | 'reject') {
    setBusyId(questionId);
    setNotice(null);
    const res = await fetch(`/api/questions/${questionId}/${action}`, { method: 'POST' });
    const body = await res.json();
    setBusyId(null);

    if (!res.ok) {
      setNotice(body.error ?? 'Terjadi kesalahan.');
      if (profile) loadTentorAssignments(profile.id);
      return;
    }
    if (action === 'accept') {
      router.push(`/chat/${questionId}`);
    } else if (profile) {
      loadTentorAssignments(profile.id);
    }
  }

  if (loading || !profile) {
    return (
      <>
        <Navbar />
        <main className="mx-auto max-w-2xl px-4 py-16 text-center text-ink-400 sm:px-6">Memuat…</main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold text-ink-900">Notifikasi</h1>

        {notice && <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{notice}</div>}

        {profile.role === 'tentor' ? (
          <div className="mt-6 space-y-4">
            {assignments.length === 0 && (
              <div className="card text-center text-ink-500">
                Belum ada tawaran pertanyaan masuk. Pastikan status kamu &ldquo;Tersedia&rdquo; ya.
              </div>
            )}
            {assignments.map((a) => (
              <div key={a.id} className="card">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
                    {a.questions?.subjects?.name ?? 'Mapel'}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-ink-400">
                    <Clock size={12} />{' '}
                    {new Date(a.sent_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="mt-3 text-ink-800">{a.questions?.content}</p>
                {a.questions?.photo_url && (
                  <a
                    href={a.questions.photo_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 flex items-center gap-1.5 text-sm text-brand-600 hover:underline"
                  >
                    <ImageIcon size={14} /> Lihat foto soal
                  </a>
                )}
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => respond(a.question_id, 'accept')}
                    disabled={busyId === a.question_id}
                    className="btn-primary flex-1"
                  >
                    <Check size={16} /> Terima
                  </button>
                  <button
                    onClick={() => respond(a.question_id, 'reject')}
                    disabled={busyId === a.question_id}
                    className="btn-secondary flex-1"
                  >
                    <X size={16} /> Tolak
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {menteeQuestions.length === 0 && (
              <div className="card text-center text-ink-500">Belum ada pertanyaan yang kamu ajukan.</div>
            )}
            {menteeQuestions.map((q) => {
              const status = MENTEE_STATUS[q.status];
              const body = (
                <div className="card transition hover:border-brand-300">
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
                      {q.subjects?.name ?? 'Mapel'}
                    </span>
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${status.className}`}>{status.label}</span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-ink-800">{q.content}</p>
                  <p className="mt-2 text-sm text-ink-500">{status.note}</p>
                </div>
              );
              return q.status === 'berjalan' || q.status === 'selesai' ? (
                <a key={q.id} href={`/chat/${q.id}`}>
                  {body}
                </a>
              ) : (
                <div key={q.id}>{body}</div>
              );
            })}
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
