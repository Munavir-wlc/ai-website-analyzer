'use client';

import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import ScanSection from '../components/ScanSection';
import Footer from '../components/Footer';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <ScanSection />
      </main>
      <Footer />
    </div>
  );
}
