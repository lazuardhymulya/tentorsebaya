"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  MessageCircleQuestion,
  Star,
  TrendingUp,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { useSessionProfile } from "@/lib/useSessionProfile";
import { createClient } from "@/lib/supabase/client";
import type { QuestionRow } from "@/lib/types";

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  menunggu: {
    label: "Mencari tentor",
    className: "bg-accent-50 text-accent-700",
  },
  berjalan: {
    label: "Sedang berlangsung",
    className: "bg-online-500/10 text-online-600",
  },
  selesai: { label: "Selesai", className: "bg-ink-100 text-ink-600" },
  hangus: { label: "Kedaluwarsa", className: "bg-red-50 text-red-600" },
};

export default function DashboardPage() {
  const { profile, loading } = useSessionProfile();
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [pendingOffers, setPendingOffers] = useState(0);

  const loadMenteeQuestions = useCallback(async (menteeId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("questions")
      .select("*")
      .eq("mentee_id", menteeId)
      .order("created_at", { ascending: false })
      .limit(10);
    setQuestions((data as QuestionRow[]) ?? []);
  }, []);

  const loadTentorData = useCallback(async (tentorId: string) => {
    const supabase = createClient();
    const { count } = await supabase
      .from("question_assignments")
      .select("id", { count: "exact", head: true })
      .eq("tentor_id", tentorId)
      .eq("status", "menunggu");
    setPendingOffers(count ?? 0);

    const { data } = await supabase
      .from("questions")
      .select("*")
      .eq("accepted_tentor_id", tentorId)
      .order("created_at", { ascending: false })
      .limit(10);
    setQuestions((data as QuestionRow[]) ?? []);
  }, []);

  // Data awal + ikut update otomatis lewat Supabase Realtime (tanpa perlu refresh)
  // begitu ada pertanyaan baru, status berubah, atau tawaran baru masuk/terjawab.
  useEffect(() => {
    if (!profile) return;
    const supabase = createClient();

    if (profile.role === "mentee") {
      loadMenteeQuestions(profile.id);
      const channel = supabase
        .channel("dashboard-mentee")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "questions",
            filter: `mentee_id=eq.${profile.id}`,
          },
          () => loadMenteeQuestions(profile.id),
        )
        .subscribe();
      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      loadTentorData(profile.id);
      const channel = supabase
        .channel("dashboard-tentor")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "question_assignments",
            filter: `tentor_id=eq.${profile.id}`,
          },
          () => loadTentorData(profile.id),
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "questions",
            filter: `accepted_tentor_id=eq.${profile.id}`,
          },
          () => loadTentorData(profile.id),
        )
        .subscribe();
      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [profile, loadMenteeQuestions, loadTentorData]);

  if (loading || !profile) {
    return (
      <>
        <Navbar />
        <main className="mx-auto max-w-4xl px-4 py-16 text-center text-ink-400 sm:px-6">
          Memuat…
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold text-ink-900">
          Halo, {profile.username} 👋
        </h1>

        {profile.role === "mentee" ? (
          <Link
            href="/pertanyaan/ajukan"
            className="mt-6 flex items-center justify-between rounded-3xl bg-brand-500 px-6 py-5 text-white shadow-sm transition hover:bg-brand-600"
          >
            <span className="flex items-center gap-3">
              <MessageCircleQuestion size={22} />
              <span className="font-medium">
                Ada soal yang belum kelar? Ajukan pertanyaan
              </span>
            </span>
            <ArrowRight size={20} />
          </Link>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="card">
              <p className="flex items-center gap-1.5 text-sm text-ink-500">
                <Star size={14} /> Rating
              </p>
              <p className="mt-1 font-display text-2xl font-semibold text-ink-900">
                {profile.tentor?.rating.toFixed(1) ?? "3.0"}
              </p>
            </div>
            <div className="card">
              <p className="flex items-center gap-1.5 text-sm text-ink-500">
                <TrendingUp size={14} /> Status
              </p>
              <p className="mt-1 font-display text-lg font-semibold text-ink-900">
                {profile.tentor?.is_available ? "Tersedia" : "Tidak tersedia"}
              </p>
            </div>
            <Link
              href="/notifikasi"
              className="card transition hover:border-brand-300"
            >
              <p className="text-sm text-ink-500">Tawaran menunggu</p>
              <p className="mt-1 font-display text-2xl font-semibold text-accent-600">
                {pendingOffers}
              </p>
            </Link>
          </div>
        )}

        <h2 className="mt-10 text-lg font-semibold text-ink-900">
          {profile.role === "mentee" ? "Pertanyaan kamu" : "Riwayat bimbingan"}
        </h2>

        {questions.length === 0 ? (
          <div className="card mt-4 text-center text-ink-500">
            {profile.role === "mentee"
              ? "Belum ada pertanyaan. Yuk ajukan yang pertama."
              : "Belum ada riwayat bimbingan. Nyalakan status tersedia buat mulai dapat tawaran."}
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {questions.map((q) => {
              const status = STATUS_LABEL[q.status];
              const clickable =
                q.status === "berjalan" || q.status === "selesai";
              const content = (
                <div className="card flex items-center justify-between gap-4 transition hover:border-brand-300">
                  <p className="line-clamp-1 flex-1 text-ink-800">
                    {q.content}
                  </p>
                  <span
                    className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${status.className}`}
                  >
                    {status.label}
                  </span>
                </div>
              );
              return clickable ? (
                <Link key={q.id} href={`/chat/${q.id}`}>
                  {content}
                </Link>
              ) : (
                <div key={q.id}>{content}</div>
              );
            })}
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
