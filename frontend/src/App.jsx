import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import LoadoutBuilder from './components/LoadoutBuilder';
import LoadoutManager from './components/LoadoutManager';
import ComponentManager from './components/ComponentManager';
import LootLookup from './components/LootLookup';
import RECalculator from './components/RECalculator';
import FCCalculator from './components/FCCalculator';
import AuthPage from './components/AuthPage';
import PublicLoadouts from './components/PublicLoadouts';

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
          <Route path="/" element={<LoadoutBuilder />} />
          <Route path="/auth" element={user ? <Navigate to="/" /> : <AuthPage />} />
          <Route path="/loadouts" element={user ? <LoadoutManager /> : <Navigate to="/auth" />} />
          <Route path="/components" element={user ? <ComponentManager /> : <Navigate to="/auth" />} />
          <Route path="/loot" element={<LootLookup />} />
          <Route path="/re" element={<RECalculator />} />
          <Route path="/fc" element={<FCCalculator />} />
          <Route path="/community" element={<PublicLoadouts />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}
