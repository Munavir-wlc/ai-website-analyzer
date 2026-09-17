import './globals.css';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { AuthProvider } from '../lib/AuthContext';
import { ThemeProvider } from '../lib/ThemeContext';
import { WorkspaceProvider } from '../lib/WorkspaceContext';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata = {
  title: 'AI Website Analyzer | SEO & Security Audit Platform',
  description: 'Analyze SEO, performance, and security vulnerabilities in seconds.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="antialiased font-sans bg-background text-foreground transition-colors duration-300">
        <ThemeProvider>
          <AuthProvider>
            <WorkspaceProvider>
              {children}
            </WorkspaceProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

