import { redirect } from 'next/navigation';
import AdminDashboard from '@/components/AdminDashboard';
import { getSessionAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const admin = await getSessionAdmin();
  if (!admin) {
    redirect('/admin/login');
  }
  return <AdminDashboard admin={admin} />;
}
