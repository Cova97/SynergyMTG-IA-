import { redirect } from 'next/navigation';
import { getServerToken } from '@/lib/auth-server';
import Sidebar from '@/components/Sidebar';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const token = await getServerToken();
  if (!token) redirect('/login');

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
