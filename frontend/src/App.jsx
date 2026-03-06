import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
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
import { CollectionsPage, CharacterDirectory, CollectionLeaderboard } from './components/collections';

export default function App() {
  const { user, loading } = useAuth();

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

          <Route path="/collections" element={<CollectionsPage />} />
          <Route path="/collections/characters" element={<CharacterDirectory />} />
          <Route path="/collections/leaderboard" element={<CollectionLeaderboard />} />

          <Route path="/loadouts" element={<Navigate to="/tools/loadouts" replace />} />
          <Route path="/components" element={<Navigate to="/tools/components" replace />} />
          <Route path="/loot" element={<Navigate to="/tools/loot" replace />} />
          <Route path="/re" element={<Navigate to="/tools/re" replace />} />
          <Route path="/fc" element={<Navigate to="/tools/fc" replace />} />
          <Route path="/community" element={<Navigate to="/tools/community" replace />} />
          <Route path="/characters" element={<Navigate to="/collections/characters" replace />} />
          <Route path="/leaderboard" element={<Navigate to="/collections/leaderboard" replace />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
