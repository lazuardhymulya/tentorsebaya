import { redirect } from 'next/navigation';
import { isAdminLoggedIn } from '@/lib/admin-session';
import { AccessCodesManager } from './AccessCodesManager';

export default async function KodeAksesPage() {
  if (!(await isAdminLoggedIn())) {
    redirect('/admin/login');
  }

  return <AccessCodesManager />;
}
