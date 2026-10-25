import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isAdminLoggedIn } from '@/lib/admin-session';
import { createAdminClient } from '@/lib/supabase/admin';
import { fail, unexpected } from '@/lib/api';

interface ReportRow {
  id: string;
  target_type: 'post' | 'comment';
  target_id: string;
  reason: string | null;
  created_at: string;
  reporter: { username: string } | null;
}

export async function GET() {
  try {
    if (!(await isAdminLoggedIn())) return fail('Tidak diizinkan.', 403);
    const admin = createAdminClient();

    const { data } = await admin
      .from('content_reports')
      .select('id, target_type, target_id, reason, created_at, reporter:profiles!reporter_id(username)')
      .eq('status', 'baru')
      .order('created_at', { ascending: false })
      .limit(100);
    const reports = (data ?? []) as unknown as ReportRow[];

    const commentIds = reports.filter((r) => r.target_type === 'comment').map((r) => r.target_id);
    const { data: commentRows } = commentIds.length
      ? await admin
          .from('post_comments')
          .select('id, post_id, content, hidden, author:profiles!author_id(username)')
          .in('id', commentIds)
      : { data: [] };
    const comments = new Map(
      ((commentRows ?? []) as unknown as { id: string; post_id: string; content: string; hidden: boolean; author: { username: string } | null }[]).map(
        (c) => [c.id, c]
      )
    );

    const postIds = [
      ...reports.filter((r) => r.target_type === 'post').map((r) => r.target_id),
      ...Array.from(comments.values()).map((c) => c.post_id),
    ];
    const { data: postRows } = postIds.length
      ? await admin.from('session_posts').select('id, status, question:questions(title)').in('id', postIds)
      : { data: [] };
    const posts = new Map(
      ((postRows ?? []) as unknown as { id: string; status: string; question: { title: string | null } | null }[]).map((p) => [p.id, p])
    );

    const items = reports.map((r) => {
      const comment = r.target_type === 'comment' ? comments.get(r.target_id) : undefined;
      const postId = r.target_type === 'post' ? r.target_id : comment?.post_id ?? null;
      const post = postId ? posts.get(postId) : undefined;
      return {
        id: r.id,
        targetType: r.target_type,
        reason: r.reason,
        reporter: r.reporter?.username ?? 'pengguna',
        createdAt: r.created_at,
        postId,
        postTitle: post?.question?.title ?? null,
        postStatus: post?.status ?? null,
        commentText: comment?.content ?? null,
        commentAuthor: comment?.author?.username ?? null,
        commentHidden: comment?.hidden ?? false,
      };
    });

    return NextResponse.json({ reports: items });
  } catch (err) {
    return unexpected(err);
  }
}

const schema = z.object({
  reportId: z.string().uuid(),
  action: z.enum(['sembunyikan', 'tarik', 'abaikan']),
});

export async function POST(request: Request) {
  try {
    if (!(await isAdminLoggedIn())) return fail('Tidak diizinkan.', 403);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return fail('Data tidak valid.', 400);
    const { reportId, action } = parsed.data;

    const admin = createAdminClient();
    const { data: report } = await admin
      .from('content_reports')
      .select('target_type, target_id')
      .eq('id', reportId)
      .maybeSingle();
    if (!report) return fail('Laporan tidak ditemukan.', 404);

    if (action === 'sembunyikan') {
      if (report.target_type !== 'comment') return fail('Aksi ini hanya untuk komentar.', 400);
      await admin.from('post_comments').update({ hidden: true }).eq('id', report.target_id);
    } else if (action === 'tarik') {
      if (report.target_type !== 'post') return fail('Aksi ini hanya untuk postingan.', 400);
      await admin
        .from('session_posts')
        .update({ status: 'ditarik', withdrawn_at: new Date().toISOString() })
        .eq('id', report.target_id);
    }

    // Semua laporan untuk target yang sama dianggap selesai
    await admin
      .from('content_reports')
      .update({ status: 'selesai' })
      .eq('target_type', report.target_type)
      .eq('target_id', report.target_id);

    return NextResponse.json({ status: 'ok' });
  } catch (err) {
    return unexpected(err);
  }
}
