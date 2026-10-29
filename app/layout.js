import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';
import Shell from '@/components/Shell';
import { SITE_NAME } from '@/lib/site';

export const metadata = {
  title: SITE_NAME,
  description: 'Levels, schedules, loot and raid sign-ups for our WoW group',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <Shell>{children}</Shell>
        </AuthProvider>
      </body>
    </html>
  );
}
