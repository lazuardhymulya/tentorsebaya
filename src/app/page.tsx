import Link from "next/link";
import {
  ArrowRight,
  MessageCircleQuestion,
  Radar,
  Sparkles,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ReviewSection } from "@/components/ReviewSection";

export default function LandingPage() {
  return (
    <>
      <Navbar />

      <main>
        {/* HERO */}
        <section className="relative overflow-hidden">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700">
                <Sparkles size={14} /> Dicocokkan otomatis, bukan diketik manual
              </span>
              <h1 className="mt-5 text-4xl font-semibold leading-[1.1] tracking-tight text-ink-900 sm:text-5xl">
                Nyangkut soal? Tanya, langsung nyambung ke tentor sebaya yang
                lagi online.
              </h1>
              <p className="mt-5 max-w-md text-lg text-ink-600">
                Pernyataanmu akan dijawab oleh pelajar SMA lain yang paham
                pelajaran kamu dan siap bantu lewat chat.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/daftar/mentee" className="btn-primary">
                  Ajukan Pertanyaan <ArrowRight size={18} />
                </Link>
                <Link href="/daftar/tentor" className="btn-secondary">
                  Gabung jadi Tentor
                </Link>
              </div>
            </div>

            {/* Visual radar — momen paling khas di halaman ini */}
            <div className="relative mx-auto flex h-72 w-72 items-center justify-center sm:h-80 sm:w-80">
              <div className="radar-ring animate-pulse-ring [animation-delay:0s]" />
              <div className="radar-ring animate-pulse-ring [animation-delay:0.6s]" />
              <div className="radar-ring animate-pulse-ring [animation-delay:1.2s]" />
              <div className="relative z-10 flex h-28 w-28 items-center justify-center rounded-full bg-brand-500 text-white shadow-lg shadow-brand-500/30">
                <Radar size={40} />
              </div>
              <span className="absolute bottom-2 rounded-full bg-white px-3 py-1 text-xs font-medium text-ink-600 shadow-sm">
                Mencari tentor yang online…
              </span>
            </div>
          </div>
        </section>

        {/* CARA KERJA */}
        <section id="cara-kerja" className="border-y border-ink-100 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="text-3xl font-semibold text-ink-900">
              Cara kerjanya
            </h2>
            <div className="mt-8 grid gap-8 sm:grid-cols-3">
              <div>
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                  <MessageCircleQuestion size={22} />
                </div>
                <h3 className="font-display text-lg font-semibold text-ink-900">
                  Tulis pertanyaanmu
                </h3>
                <p className="mt-1 text-ink-600">
                  Pilih mapel, tulis soalnya, boleh lampirkan foto kalau lebih
                  gampang difoto daripada diketik.
                </p>
              </div>
              <div>
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                  <Radar size={22} />
                </div>
                <h3 className="font-display text-lg font-semibold text-ink-900">
                  Sistem mencarikan tentor
                </h3>
                <p className="mt-1 text-ink-600">
                  Otomatis ditawarkan ke tentor yang sesuai mapel dan sedang
                  online.
                </p>
              </div>
              <div>
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                  <Sparkles size={22} />
                </div>
                <h3 className="font-display text-lg font-semibold text-ink-900">
                  Ngobrol sampai paham
                </h3>
                <p className="mt-1 text-ink-600">
                  Begitu ada yang menerima, chat langsung terbuka. Selesai
                  belajar, kasih bintang buat tentornya.
                </p>
              </div>
            </div>
          </div>
        </section>

        <ReviewSection />
      </main>

      <Footer />
    </>
  );
}
