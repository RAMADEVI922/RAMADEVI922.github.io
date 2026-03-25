import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { QrCode, Shield, UtensilsCrossed, ArrowRight } from 'lucide-react';

// Free restaurant/chef ambience videos from Pixabay CDN (no auth needed)
const BG_VIDEOS = [
  'https://cdn.pixabay.com/video/2024/01/15/197237-905263852_large.mp4',  // chef cooking
  'https://cdn.pixabay.com/video/2023/12/28/195358-899026896_large.mp4',   // restaurant ambience
];

export default function Index() {
  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">

      {/* ── Background video ── */}
      <div className="fixed inset-0 -z-10">
        <video
          autoPlay
          muted
          loop
          playsInline
          className="w-full h-full object-cover"
          style={{ filter: 'blur(3px) brightness(0.45) saturate(1.2)', transform: 'scale(1.05)' }}
        >
          <source src={BG_VIDEOS[0]} type="video/mp4" />
          <source src={BG_VIDEOS[1]} type="video/mp4" />
        </video>
        {/* Dark gradient overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/60" />
      </div>

      {/* ── Header ── */}
      <header className="relative z-10 border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCode className="h-6 w-6 text-orange-400" />
            <span className="font-bold text-lg text-white">QR Menu</span>
          </div>
          <Link to="/menu/T1">
            <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10">
              View Menu
            </Button>
          </Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-6">
        <div className="max-w-2xl text-center">

          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/20 border border-orange-400/30 text-orange-300 text-xs font-semibold mb-6 backdrop-blur-sm animate-fade-in">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-400 animate-pulse" />
            Contactless Dining Experience
          </div>

          <div className="animate-fade-in">
            <h1 className="text-4xl sm:text-6xl font-bold leading-tight tracking-tight text-white drop-shadow-lg">
              Taste the Future
              <span className="block text-orange-400 mt-1">of Dining.</span>
            </h1>
            <p className="mt-5 text-lg text-white/70 max-w-md mx-auto leading-relaxed">
              Scan. Browse. Order. Your table, your pace — a seamless restaurant experience from kitchen to you.
            </p>
          </div>

          {/* CTA buttons */}
          <div
            className="mt-8 flex flex-col sm:flex-row gap-3 justify-center animate-fade-in"
            style={{ animationDelay: '0.1s' }}
          >
            <Link to="/menu/T1">
              <Button
                size="lg"
                className="gap-2 w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/30 border-0"
              >
                <UtensilsCrossed className="h-4 w-4" />
                View Demo Menu
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/admin-login">
              <Button
                variant="outline"
                size="lg"
                className="gap-2 w-full sm:w-auto bg-white/10 border-white/20 text-white hover:bg-white/20 backdrop-blur-sm"
              >
                <Shield className="h-4 w-4" />
                Admin Panel
              </Button>
            </Link>
            <Link to="/waiter-login">
              <Button
                variant="outline"
                size="lg"
                className="gap-2 w-full sm:w-auto bg-white/10 border-white/20 text-white hover:bg-white/20 backdrop-blur-sm"
              >
                <UtensilsCrossed className="h-4 w-4" />
                Waiter Panel
              </Button>
            </Link>
          </div>

          {/* Feature cards */}
          <div
            className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left animate-fade-in"
            style={{ animationDelay: '0.2s' }}
          >
            {[
              { emoji: '📱', title: 'Scan & Order', desc: 'Customers scan a QR code at their table to instantly access the menu and place orders.' },
              { emoji: '⚡', title: 'Real-time Updates', desc: 'Waiters receive instant notifications. Menu changes reflect immediately.' },
              { emoji: '🎛️', title: 'Full Control', desc: 'Admin panel to manage menu items, tables, waiters, and track billing.' },
            ].map((f) => (
              <div
                key={f.title}
                className="p-4 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-md hover:bg-white/15 transition-all"
              >
                <div className="text-2xl mb-2">{f.emoji}</div>
                <h3 className="font-semibold text-sm text-white">{f.title}</h3>
                <p className="text-sm text-white/60 mt-1 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-white/10 py-5 text-center bg-black/20 backdrop-blur-sm">
        <p className="text-xs text-white/40">QR Based Restaurant Menu System · Built with ReactJS</p>
      </footer>
    </div>
  );
}
