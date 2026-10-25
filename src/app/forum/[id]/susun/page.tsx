'use client';

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Camera, Loader2, X } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';

interface ComposeData {
  post: {
    id: string;
    status: string;
    anonymous: boolean;
    selectedMessageIds: string[];
    description: string;
    descriptionPhotos: string[];
    showQuestionPhoto: boolean;
    expiresAt: string;
  };
  question: {
    title: string | null;
    content: string;
    photo_url: string | null;
    subjects: { name: string } | null;
  } | null;
  messages: { id: string; sender_id: string; type: 'teks' | 'foto'; content: string; created_at: string }[];
  menteeId: string;
  menteeUsername: string;
}

/** Kecilkan foto (sisi terpanjang maksimal 1280px) jadi JPEG supaya hemat penyimpanan. */
async function shrinkImage(file: File, maxSide = 1280): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Browser tidak mendukung pemrosesan foto.');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Gagal memproses foto.'))), 'image/jpeg', 0.82)
  );
  return new File([blob], 'foto.jpg', { type: 'image/jpeg' });
}

export default function SusunPostinganPage() {
  const params = useParams<{ id: string }>();
  const postId = params.id;
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [data, setData] = useState<ComposeData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [showQuestionPhoto, setShowQuestionPhoto] = useState(true);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/posts/${postId}/compose`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? 'Gagal memuat bahan postingan.');
        return body as ComposeData;
      })
      .then((d) => {
        setData(d);
        setSelected(new Set(d.post.selectedMessageIds));
        setDescription(d.post.description);
        setPhotos(d.post.descriptionPhotos);
        setShowQuestionPhoto(d.post.showQuestionPhoto);
      })
      .catch((e: Error) => setLoadError(e.message));
  }, [postId]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function addPhoto(file: File) {
    setError(null);
    setPhotoBusy(true);
    try {
      const small = await shrinkImage(file);
      const formData = new FormData();
      formData.set('file', small);
      const res = await fetch(`/api/posts/${postId}/photo`, { method: 'POST', body: formData });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Gagal mengunggah foto.');
      setPhotos((prev) => [...prev, body.url as string]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengunggah foto.');
    } finally {
      setPhotoBusy(false);
    }
  }

  async function publish() {
    if (!data) return;
    setError(null);
    setSaving(true);
    const res = await fetch(`/api/posts/${postId}/publish`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        selectedMessageIds: Array.from(selected),
        description,
        photos,
        showQuestionPhoto,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? 'Gagal menayangkan postingan.');
      return;
    }
    router.push(`/forum/${postId}`);
    router.refresh();
  }

  if (loadError) {
    return (
      <>
        <Navbar />
        <main className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
          <p className="rounded-2xl bg-red-50 px-4 py-3 text-red-600">{loadError}</p>
        </main>
        <Footer />
      </>
    );
  }
  if (!data) {
    return (
      <>
        <Navbar />
        <main className="mx-auto max-w-2xl px-4 py-16 text-center text-ink-400 sm:px-6">Memuat…</main>
        <Footer />
      </>
    );
  }

  const editing = data.post.status === 'tayang';
  const expires = new Date(data.post.expiresAt).toLocaleString('id-ID', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold text-ink-900">{editing ? 'Perbarui postingan' : 'Susun postingan forum'}</h1>
        <p className="mt-1 text-ink-600">
          {data.post.anonymous ? 'Penanya' : `@${data.menteeUsername}`} menyetujui sesi ini dipublikasikan. Pilih bagian chat yang ingin ditampilkan, lalu tulis penjelasan tambahan.
        </p>
        <p className="mt-2 rounded-2xl bg-ink-50 px-4 py-3 text-sm text-ink-600">
          Isi pesan tidak bisa diubah, kamu hanya memilih mana yang tampil. Voice note tidak pernah ditampilkan.
          {!editing && ` Batas menyusun: ${expires}, setelah itu sesi tetap privat.`}
        </p>

        {/* Pertanyaan utama */}
        <section className="card mt-6">
          <h2 className="font-semibold text-ink-900">Pertanyaan utama (selalu tampil)</h2>
          {data.question?.title && <p className="mt-2 font-medium text-ink-900">{data.question.title}</p>}
          <p className="mt-1 whitespace-pre-wrap text-ink-800">{data.question?.content}</p>
          {data.question?.photo_url && (
            <>
              <img src={data.question.photo_url} alt="Foto soal" className="mt-3 max-h-56 rounded-2xl object-cover" />
              <label className="mt-2 flex items-center gap-2 text-sm text-ink-600">
                <input type="checkbox" checked={showQuestionPhoto} onChange={(e) => setShowQuestionPhoto(e.target.checked)} />
                Tampilkan foto soal
              </label>
            </>
          )}
        </section>

        {/* Pilih pesan */}
        <section className="card mt-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold text-ink-900">Pilih pesan yang ditampilkan</h2>
            <div className="flex gap-2 text-sm">
              <button type="button" className="text-brand-600 hover:underline" onClick={() => setSelected(new Set(data.messages.map((m) => m.id)))}>
                Pilih semua
              </button>
              <button type="button" className="text-ink-500 hover:underline" onClick={() => setSelected(new Set())}>
                Kosongkan
              </button>
            </div>
          </div>

          {data.messages.length === 0 ? (
            <p className="mt-3 text-ink-400">Tidak ada pesan teks atau foto di sesi ini. Kamu tetap bisa menayangkan lewat penjelasan tambahan.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {data.messages.map((m) => {
                const mine = m.sender_id !== data.menteeId;
                const checked = selected.has(m.id);
                return (
                  <li key={m.id}>
                    <label
                      className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition ${
                        checked ? 'border-brand-500 bg-brand-50' : 'border-ink-100 hover:border-brand-300'
                      }`}
                    >
                      <input type="checkbox" className="mt-1" checked={checked} onChange={() => toggle(m.id)} />
                      <span className="min-w-0 flex-1">
                        <span className="mb-1 block text-xs font-semibold text-ink-500">
                          {mine ? 'Kamu (tentor)' : data.post.anonymous ? 'Penanya' : `Penanya @${data.menteeUsername}`}
                        </span>
                        {m.type === 'teks' ? (
                          <span className="block whitespace-pre-wrap text-ink-800">{m.content}</span>
                        ) : (
                          <img src={m.content} alt="Foto dari chat" className="max-h-48 rounded-xl object-cover" />
                        )}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Penjelasan tambahan */}
        <section className="card mt-4">
          <h2 className="font-semibold text-ink-900">Penjelasan tambahan</h2>
          <p className="mt-1 text-sm text-ink-500">Jelaskan lebih rapi dan jelas untuk orang yang membaca nanti. Jangan masukkan data pribadi.</p>
          <textarea
            className="input-field mt-3 min-h-40"
            value={description}
            maxLength={3000}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Tulis penjelasan lengkapnya di sini…"
          />
          <p className="mt-1 text-right text-xs text-ink-400">{description.length}/3000</p>

          <div className="mt-2 flex flex-wrap gap-3">
            {photos.map((url) => (
              <div key={url} className="relative">
                <img src={url} alt="Foto penjelasan" className="h-24 w-24 rounded-xl object-cover" />
                <button
                  type="button"
                  aria-label="Hapus foto"
                  onClick={() => setPhotos((prev) => prev.filter((p) => p !== url))}
                  className="absolute -right-2 -top-2 rounded-full bg-ink-900 p-1 text-white"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            {photos.length < 3 && (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) addPhoto(f);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={photoBusy}
                  className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-ink-300 text-xs text-ink-500 hover:border-brand-400 hover:text-brand-600"
                >
                  {photoBusy ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
                  Tambah foto
                </button>
              </>
            )}
          </div>
          <p className="mt-2 text-xs text-ink-400">Maksimal 3 foto, otomatis dikecilkan.</p>
        </section>

        {error && <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

        <div className="mt-6 flex gap-2">
          <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">
            Batal
          </button>
          <button type="button" onClick={publish} disabled={saving || description.trim().length < 10} className="btn-primary flex-1">
            {saving ? <Loader2 size={18} className="animate-spin" /> : editing ? 'Simpan perubahan' : 'Tayangkan'}
          </button>
        </div>
      </main>
      <Footer />
    </>
  );
}
