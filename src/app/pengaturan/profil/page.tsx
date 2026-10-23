'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Avatar } from '@/components/Avatar';
import { createClient } from '@/lib/supabase/client';
import { PRIVACY_OPTIONS, TAUGHT_LEVELS, type PrivacyValue } from '@/lib/profile';
import type { Subject } from '@/lib/types';

interface ProfileData {
  profile: {
    id: string;
    role: 'tentor' | 'mentee';
    username: string;
    bio: string | null;
    photo_url: string | null;
    privacy: PrivacyValue;
  };
  tentor: {
    achievements: string;
    expertiseTags: string[];
    taughtLevels: string[];
    subjectIds: string[];
  } | null;
}

/** Potong jadi persegi tengah, kecilkan ke 256px, simpan JPEG: hasilnya hanya puluhan KB. */
async function resizeToSquareJpeg(file: File, size = 256): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Browser tidak mendukung pemrosesan foto.');
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Gagal memproses foto.'))), 'image/jpeg', 0.85)
  );
  return new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
}

export default function PengaturanProfilPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<ProfileData | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [bio, setBio] = useState('');
  const [privacy, setPrivacy] = useState<PrivacyValue>('terbatas');
  const [achievements, setAchievements] = useState('');
  const [tags, setTags] = useState('');
  const [levels, setLevels] = useState<Set<string>>(new Set());
  const [subjectIds, setSubjectIds] = useState<Set<string>>(new Set());
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/profile')
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? 'Gagal memuat profil.');
        return body as ProfileData;
      })
      .then((d) => {
        setData(d);
        setBio(d.profile.bio ?? '');
        setPrivacy(d.profile.privacy ?? 'terbatas');
        setPhotoUrl(d.profile.photo_url);
        if (d.tentor) {
          setAchievements(d.tentor.achievements);
          setTags(d.tentor.expertiseTags.join(', '));
          setLevels(new Set(d.tentor.taughtLevels));
          setSubjectIds(new Set(d.tentor.subjectIds));
        }
      })
      .catch((e: Error) => setLoadError(e.message));

    createClient()
      .from('subjects')
      .select('id, name, group_name, sort_order')
      .order('sort_order')
      .then(({ data: rows }) => setSubjects((rows as Subject[]) ?? []));
  }, []);

  const grouped = useMemo(() => {
    const map: Record<string, Subject[]> = { IPA: [], IPS: [], Wajib: [] };
    for (const s of subjects) map[s.group_name]?.push(s);
    return map;
  }, [subjects]);

  function toggle(set: Set<string>, setter: (s: Set<string>) => void, value: string) {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setter(next);
  }

  async function handlePhoto(file: File) {
    setError(null);
    setPhotoBusy(true);
    try {
      const small = await resizeToSquareJpeg(file);
      const formData = new FormData();
      formData.set('file', small);
      const res = await fetch('/api/profile/photo', { method: 'POST', body: formData });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Gagal mengunggah foto.');
      setPhotoUrl(body.photoUrl);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengunggah foto.');
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removePhoto() {
    setError(null);
    setPhotoBusy(true);
    const res = await fetch('/api/profile/photo', { method: 'DELETE' });
    setPhotoBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Gagal menghapus foto.');
      return;
    }
    setPhotoUrl(null);
    router.refresh();
  }

  async function save() {
    if (!data) return;
    setError(null);
    setSaving(true);
    const payload: Record<string, unknown> = { bio };
    if (data.profile.role === 'mentee') {
      payload.privacy = privacy;
    } else {
      payload.achievements = achievements;
      payload.expertiseTags = tags;
      payload.taughtLevels = Array.from(levels);
      payload.subjectIds = Array.from(subjectIds);
    }
    const res = await fetch('/api/profile', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? 'Gagal menyimpan profil.');
      return;
    }
    router.push(`/profil/${encodeURIComponent(data.profile.username)}`);
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

  const isTentor = data.profile.role === 'tentor';

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold text-ink-900">Edit profil</h1>
        <p className="mt-1 text-ink-600">Yang kamu isi di sini tampil di profil publikmu.</p>

        <div className="card mt-6 space-y-6">
          {/* Foto */}
          <div className="flex items-center gap-4">
            <Avatar username={data.profile.username} photoUrl={photoUrl} size="lg" />
            <div className="space-y-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handlePhoto(f);
                  e.target.value = '';
                }}
              />
              <button type="button" onClick={() => fileRef.current?.click()} disabled={photoBusy} className="btn-secondary">
                {photoBusy ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                {photoUrl ? 'Ganti foto' : 'Unggah foto'}
              </button>
              {photoUrl && (
                <button type="button" onClick={removePhoto} disabled={photoBusy} className="btn-ghost text-sm">
                  <Trash2 size={14} /> Hapus foto
                </button>
              )}
              <p className="text-xs text-ink-400">Opsional. Otomatis dipotong persegi dan dikecilkan.</p>
            </div>
          </div>

          {/* Deskripsi */}
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Deskripsi singkat</label>
            <textarea
              className="input-field min-h-28"
              value={bio}
              maxLength={500}
              onChange={(e) => setBio(e.target.value)}
              placeholder={isTentor ? 'Ceritakan singkat soal dirimu dan cara kamu mengajar…' : 'Ceritakan singkat soal dirimu…'}
            />
            <p className="mt-1 text-right text-xs text-ink-400">{bio.length}/500</p>
          </div>

          {/* Mentee: privasi */}
          {!isTentor && (
            <div>
              <p className="mb-2 text-sm font-medium text-ink-700">Siapa yang bisa melihat profilmu</p>
              <div className="space-y-2">
                {PRIVACY_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition ${
                      privacy === opt.value ? 'border-brand-500 bg-brand-50' : 'border-ink-100 hover:border-brand-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="privacy"
                      className="mt-1"
                      checked={privacy === opt.value}
                      onChange={() => setPrivacy(opt.value)}
                    />
                    <span>
                      <span className="block font-medium text-ink-900">{opt.label}</span>
                      <span className="block text-sm text-ink-500">{opt.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Tentor: bidang, kelas, prestasi */}
          {isTentor && (
            <>
              <div>
                <p className="mb-2 text-sm font-medium text-ink-700">Mapel yang kamu kuasai</p>
                {(['IPA', 'IPS', 'Wajib'] as const).map((group) => (
                  <div key={group} className="mb-3">
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">{group}</p>
                    <div className="flex flex-wrap gap-2">
                      {grouped[group]?.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => toggle(subjectIds, setSubjectIds, s.id)}
                          className={`rounded-full border px-3 py-1.5 text-sm transition ${
                            subjectIds.has(s.id)
                              ? 'border-brand-500 bg-brand-500 text-white'
                              : 'border-ink-200 bg-white text-ink-600 hover:border-brand-300'
                          }`}
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-ink-700">Tag keahlian (opsional)</label>
                <input
                  className="input-field"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="Pisahkan dengan koma, maksimal 5. Contoh: astronomi, mekanika"
                />
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-ink-700">Kelas yang kamu ajar</p>
                <div className="flex gap-2">
                  {TAUGHT_LEVELS.map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => toggle(levels, setLevels, level)}
                      className={`rounded-full border px-4 py-1.5 text-sm transition ${
                        levels.has(level)
                          ? 'border-brand-500 bg-brand-500 text-white'
                          : 'border-ink-200 bg-white text-ink-600 hover:border-brand-300'
                      }`}
                    >
                      Kelas {level}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-ink-700">Prestasi (opsional)</label>
                <textarea
                  className="input-field min-h-28"
                  value={achievements}
                  maxLength={1000}
                  onChange={(e) => setAchievements(e.target.value)}
                  placeholder="Tulis prestasi yang pernah kamu raih, satu per baris."
                />
                <p className="mt-1 text-right text-xs text-ink-400">{achievements.length}/1000</p>
              </div>
            </>
          )}

          {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

          <div className="flex gap-2">
            <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">
              Batal
            </button>
            <button type="button" onClick={save} disabled={saving} className="btn-primary flex-1">
              {saving ? <Loader2 size={18} className="animate-spin" /> : 'Simpan'}
            </button>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
