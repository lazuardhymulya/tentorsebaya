import { redirect } from 'next/navigation';
import { isAdminLoggedIn } from '@/lib/admin-session';
import { ReportsManager } from './ReportsManager';

export default async function LaporanPage() {
  if (!(await isAdminLoggedIn())) {
    redirect('/admin/login');
  }
  return <ReportsManager />;
}
