'use client';

import { useEffect, useState } from 'react';
import { Copy, Plus, ShieldCheck } from 'lucide-react';

interface CodeRow {
  id: string;
  code: string;
  usage_limit: number;
  usage_count: number;
  created_at: string;
}

export function AccessCodesManager() {
  const [codes, setCodes] = useState<CodeRow[]>([]);
  const [usageLimit, setUsageLimit] = useState(1);
  const [customCode, setCustomCode] = useState('');
  const [loading, setLoading] = useState(false);

  async function load() {
    const res = await fetch('/api/access-codes');
    const body = await res.json();
    setCodes(body.codes ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function createCode() {
    setLoading(true);
    await fetch('/api/access-codes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: customCode || undefined, usageLimit }),
    });
    setCustomCode('');
    setUsageLimit(1);
    setLoading(false);
    load();
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="flex items-center gap-2">
        <ShieldCheck size={20} className="text-brand-600" />
        <h1 className="text-2xl font-semibold text-ink-900">Kode Akses Tentor</h1>
      </div>
      <p className="mt-1 text-ink-600">Kode ini hanya dipakai sekali oleh tiap tentor saat pendaftaran pertama.</p>

      <div className="card mt-6">
        <p className="mb-3 text-sm font-medium text-ink-700">Buat kode baru</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className="input-field"
            placeholder="Kosongkan untuk auto-generate"
            value={customCode}
            onChange={(e) => setCustomCode(e.target.value)}
          />
          <input
            type="number"
            min={1}
            className="input-field sm:w-32"
            value={usageLimit}
            onChange={(e) => setUsageLimit(Number(e.target.value))}
          />
          <button onClick={createCode} disabled={loading} className="btn-primary whitespace-nowrap">
            <Plus size={16} /> Buat
          </button>
        </div>
        <p className="mt-2 text-xs text-ink-400">Angka di kanan = berapa kali kode ini boleh dipakai (beda tentor).</p>
      </div>

      <div className="mt-6 space-y-2">
        {codes.map((c) => (
          <div key={c.id} className="card flex items-center justify-between">
            <div>
              <p className="font-mono text-lg font-semibold text-ink-900">{c.code}</p>
              <p className="text-sm text-ink-500">
                Terpakai {c.usage_count}/{c.usage_limit}
              </p>
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(c.code)}
              className="rounded-full p-2 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
              aria-label="Salin kode"
            >
              <Copy size={16} />
            </button>
          </div>
        ))}
        {codes.length === 0 && <p className="text-center text-ink-400">Belum ada kode akses.</p>}
      </div>
    </main>
  );
}
