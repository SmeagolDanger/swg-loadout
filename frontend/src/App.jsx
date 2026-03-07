import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
import PublicLoadouts from './components/PublicLoadouts';
import BuildoutExplorer from './components/BuildoutExplorer';
import AdminPage from './components/AdminPage';
import { CollectionsPage, CharacterDirectory, CollectionLeaderboard } from './components/collections';

export default function App() {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  const showCredits = pathname.startsWith('/tools') || pathname === '/';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-hull-900">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-plasma-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-hull-200 font-display tracking-wider">INITIALIZING SYSTEMS...</p>
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

          <Route path="/tools" element={<LoadoutBuilder />} />
          <Route path="/tools/loadouts" element={user ? <LoadoutManager /> : <Navigate to="/auth" />} />
          <Route path="/tools/components" element={user ? <ComponentManager /> : <Navigate to="/auth" />} />
          <Route path="/tools/loot" element={<LootLookup />} />
          <Route path="/tools/re" element={<RECalculator />} />
          <Route path="/tools/fc" element={<FCCalculator />} />
          <Route path="/tools/community" element={<PublicLoadouts />} />
          <Route path="/tools/buildouts" element={<BuildoutExplorer />} />

          <Route path="/collections" element={<CollectionsPage />} />
          <Route path="/collections/characters" element={<CharacterDirectory />} />
          <Route path="/collections/leaderboard" element={<CollectionLeaderboard />} />

          <Route path="/admin" element={user?.role === 'admin' || user?.is_admin ? <AdminPage /> : <Navigate to="/" />} />

          <Route path="/loadouts" element={<Navigate to="/tools/loadouts" replace />} />
          <Route path="/components" element={<Navigate to="/tools/components" replace />} />
          <Route path="/loot" element={<Navigate to="/tools/loot" replace />} />
          <Route path="/re" element={<Navigate to="/tools/re" replace />} />
          <Route path="/fc" element={<Navigate to="/tools/fc" replace />} />
          <Route path="/community" element={<Navigate to="/tools/community" replace />} />
          <Route path="/buildouts" element={<Navigate to="/tools/buildouts" replace />} />
          <Route path="/characters" element={<Navigate to="/collections/characters" replace />} />
          <Route path="/leaderboard" element={<Navigate to="/collections/leaderboard" replace />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {showCredits && (
        <footer className="text-center text-hull-200 text-xs font-display tracking-wide py-6 border-t border-hull-400/30 mt-12 bg-hull-900/60">
          Space tools based on{' '}
          <a href="https://github.com/SeraphExodus/Seraphs-Loadout-Tool" target="_blank" rel="noopener noreferrer" className="text-hull-200 hover:text-plasma-400 transition-colors">
            Seraph's Loadout Tool
          </a>
          {' · '}
          <a href="https://github.com/SmeagolDanger/swg-loadout" target="_blank" rel="noopener noreferrer" className="text-hull-200 hover:text-plasma-400 transition-colors">
            Source (GPL-2.0)
          </a>
        </footer>
      )}
    </div>
  );
}
