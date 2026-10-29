import './globals.css';
import { Inter, Outfit } from 'next/font/google';
import Script from 'next/script';
import { AuthProvider } from '@/components/AuthProvider';
import Shell from '@/components/Shell';
import { SITE_NAME } from '@/lib/site';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit', display: 'swap' });

export const metadata = {
  title: SITE_NAME,
  description: 'Levels, schedules, loot and raid sign-ups for our WoW group',
};

// Runs before the page paints, so there's no flash of the wrong theme.
const themeScript = `
(function () {
  try {
    var saved = localStorage.getItem('theme');
    var theme = saved || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    document.documentElement.dataset.theme = theme;
  } catch (e) {
    document.documentElement.dataset.theme = 'dark';
  }
})();
`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <AuthProvider>
          <Shell>{children}</Shell>
        </AuthProvider>
        {/* Hover an item name to see its full in-game tooltip */}
        <Script id="wowhead-config" strategy="afterInteractive">
          {`window.whTooltips = { colorLinks: false, iconizeLinks: false, renameLinks: false };`}
        </Script>
        <Script src="https://wow.zamimg.com/js/tooltips.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
