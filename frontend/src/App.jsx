import React from 'react';
import { Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import WelcomeScreen from './components/WelcomeScreen';
import LoadoutBuilder from './components/LoadoutBuilder';
import LoadoutManager from './components/LoadoutManager';
import ComponentManager from './components/ComponentManager';
import LootLookup from './components/LootLookup';
import RECalculator from './components/RECalculator';
import FCCalculator from './components/FCCalculator';
import AuthPage from './components/AuthPage';
import DiscordAuthCallback from './components/DiscordAuthCallback';
import ResetPasswordPage from './components/ResetPasswordPage';
import PublicLoadouts from './components/PublicLoadouts';
import BuildoutExplorer from './components/BuildoutExplorer';
import GCWCalculator from './components/GCWCalculator';
import EntBuffBuilder from './components/EntBuffBuilder';
import ModsBrowser from './components/ModsBrowser';
import AdminPage from './components/AdminPage';
import PrivacyPage from './components/PrivacyPage';
import { CollectionsPage, CharacterDirectory, CollectionLeaderboard } from './components/collections';

function resolveFooter(pathname) {
  if (pathname.startsWith('/tools/gcw')) {
    return {
      id: 'gcw',
      content: (
        <>
          GCW calculator inspired by{' '}
          <a
            href="https://github.com/a727891/gcwcalc"
            target="_blank"
            rel="noopener noreferrer"
            className="text-hull-200 hover:text-plasma-400 transition-colors"
          >
            gcwcalc
          </a>
          .
        </>
      ),
    };
  }

  if (pathname.startsWith('/tools/ent-buffs')) {
    return {
      id: 'ent',
      content: (
        <>
          Entertainer Buff Builder inspired by the original{' '}
          <a
            href="http://entbuff.sipherius.net/legends/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-hull-200 hover:text-plasma-400 transition-colors"
          >
            Star Wars Galaxies Entertainer Buff Builder
          </a>
          {' '}by Sipherius.
        </>
      ),
    };
  }

  if (pathname.startsWith('/mods')) {
    return {
      id: 'mods',
      content: <>Curated game mods are an original feature of this site.</>,
    };
  }

  if (pathname.startsWith('/collections')) {
    return {
      id: 'collections',
      content: <>Collections is an original feature of this site.</>,
    };
  }

  if (pathname.startsWith('/tools')) {
    return {
      id: 'tools',
      content: (
        <>
          Space tools and buildouts based on{' '}
          <a
            href="https://github.com/SeraphExodus/Seraphs-Loadout-Tool"
            target="_blank"
            rel="noopener noreferrer"
            className="text-hull-200 hover:text-plasma-400 transition-colors"
          >
            Seraph&apos;s Loadout Tool
          </a>
          {' · '}
          <a
            href="https://github.com/SmeagolDanger/swg-loadout"
            target="_blank"
            rel="noopener noreferrer"
            className="text-hull-200 hover:text-plasma-400 transition-colors"
          >
            Source (GPL-2.0)
          </a>
        </>
      ),
    };
  }

  return null;
}

export default function App() {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  const footer = resolveFooter(pathname);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-hull-900">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-plasma-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-hull-200 font-display tracking-wider">Loading your command deck...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-hull-900">
      <Navbar />
      <main className="pt-16">
        <Routes>
          <Route path="/" element={<WelcomeScreen />} />
          <Route path="/auth" element={user ? <Navigate to="/tools" /> : <AuthPage />} />
          <Route path="/auth/discord/callback" element={<DiscordAuthCallback />} />
          <Route path="/auth/reset-password" element={<ResetPasswordPage />} />

          <Route path="/tools" element={<LoadoutBuilder />} />
          <Route path="/tools/loadouts" element={user ? <LoadoutManager /> : <Navigate to="/auth" />} />
          <Route path="/tools/components" element={user ? <ComponentManager /> : <Navigate to="/auth" />} />
          <Route path="/tools/loot" element={<LootLookup />} />
          <Route path="/tools/re" element={<RECalculator />} />
          <Route path="/tools/fc" element={<FCCalculator />} />
          <Route path="/tools/community" element={<PublicLoadouts />} />
          <Route path="/tools/starters" element={<PublicLoadouts />} />
          <Route path="/tools/buildouts" element={<BuildoutExplorer />} />
          <Route path="/tools/gcw" element={<GCWCalculator />} />
          <Route path="/tools/ent-buffs" element={<EntBuffBuilder />} />
          <Route path="/mods" element={<ModsBrowser />} />
          <Route path="/mods/:slug" element={<ModsBrowser />} />

          <Route path="/collections" element={<CollectionsPage />} />
          <Route path="/collections/characters" element={<CharacterDirectory />} />
          <Route path="/collections/leaderboard" element={<CollectionLeaderboard />} />

          <Route path="/admin" element={user?.role === 'admin' || user?.is_admin ? <AdminPage /> : <Navigate to="/" />} />
          <Route path="/privacy" element={<PrivacyPage />} />

          <Route path="/loadouts" element={<Navigate to="/tools/loadouts" replace />} />
          <Route path="/components" element={<Navigate to="/tools/components" replace />} />
          <Route path="/loot" element={<Navigate to="/tools/loot" replace />} />
          <Route path="/re" element={<Navigate to="/tools/re" replace />} />
          <Route path="/fc" element={<Navigate to="/tools/fc" replace />} />
          <Route path="/community" element={<Navigate to="/tools/community" replace />} />
          <Route path="/starters" element={<Navigate to="/tools/starters" replace />} />
          <Route path="/buildouts" element={<Navigate to="/tools/buildouts" replace />} />
          <Route path="/gcw" element={<Navigate to="/tools/gcw" replace />} />
          <Route path="/ent-buffs" element={<Navigate to="/tools/ent-buffs" replace />} />
          <Route path="/tools/mods" element={<Navigate to="/mods" replace />} />
          <Route path="/characters" element={<Navigate to="/collections/characters" replace />} />
          <Route path="/leaderboard" element={<Navigate to="/collections/leaderboard" replace />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className="border-t border-hull-400/30 mt-10 bg-hull-900/70">
        <div className="max-w-[90rem] mx-auto px-4 sm:px-6 py-5 text-center text-hull-200 text-xs sm:text-sm font-display tracking-wide space-y-3">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <Link
              to="/privacy"
              className="text-hull-100 hover:text-plasma-400 transition-colors"
            >
              Privacy
            </Link>
            <a
              href="https://github.com/SmeagolDanger/swg-loadout"
              target="_blank"
              rel="noopener noreferrer"
              className="text-hull-100 hover:text-plasma-400 transition-colors"
            >
              GitHub
            </a>
          </div>

          {footer && <div>{footer.content}</div>}
        </div>
      </footer>
    </div>
  );
}
