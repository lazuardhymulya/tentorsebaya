import { NextResponse } from 'next/server';

/** Balasan error seragam supaya browser selalu menerima JSON yang jelas, bukan respons kosong. */
export function unexpected(err: unknown) {
  return NextResponse.json(
    { error: 'Terjadi kesalahan tak terduga: ' + (err instanceof Error ? err.message : String(err)) },
    { status: 500 }
  );
}

export function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}
