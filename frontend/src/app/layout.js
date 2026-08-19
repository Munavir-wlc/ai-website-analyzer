import './globals.css';
import { Inter } from 'next/font/google';
import { AuthProvider } from '../lib/AuthContext';
import { ThemeProvider } from '../lib/ThemeContext';
import { WorkspaceProvider } from '../lib/WorkspaceContext';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata = {
  title: 'AI Website Analyzer | SEO & Security Audit Platform',
  description: 'Analyze SEO, performance, and security vulnerabilities in seconds.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
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

