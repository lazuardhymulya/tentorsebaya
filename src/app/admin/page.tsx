import { redirect } from 'next/navigation';
import { isAdminLoggedIn } from '@/lib/admin-session';

export default async function AdminIndexPage() {
  redirect((await isAdminLoggedIn()) ? '/admin/kode-akses' : '/admin/login');
}
