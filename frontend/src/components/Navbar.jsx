import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Menu, X, Crosshair, Box, Search, Users, LogOut, User, Wrench,
  FlaskConical, Cpu, Trophy, Medal, UserCircle
} from 'lucide-react';

const NAV_ITEMS = [
  // ── Loadout Tool ──
  { to: '/', label: 'Builder', icon: Crosshair },
  { to: '/loadouts', label: 'Loadouts', icon: Box, auth: true },
  { to: '/components', label: 'Components', icon: Wrench, auth: true },
  { to: '/re', label: 'RE Calc', icon: FlaskConical },
  { to: '/fc', label: 'FC Calc', icon: Cpu },
  { to: '/loot', label: 'Loot', icon: Search },
  { to: '/community', label: 'Community', icon: Users },
  // ── Collections (NEW) ──
  { to: '/collections', label: 'Collections', icon: Trophy, divider: true },
  { to: '/characters', label: 'Characters', icon: UserCircle },
  { to: '/leaderboard', label: 'Leaderboard', icon: Medal },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleItems = NAV_ITEMS.filter(i => !i.auth || user);

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-40 bg-hull-800/90 backdrop-blur-md border-b border-hull-500/40">
        <div className="max-w-[90rem] mx-auto px-4 h-16 flex items-center gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group shrink-0 min-w-fit">
            <div className="w-8 h-8 rounded-lg bg-plasma-500/20 border border-plasma-500/40 flex items-center justify-center group-hover:shadow-glow transition-all">
              <Crosshair size={18} className="text-plasma-400" />
            </div>
            <span className="font-display font-bold text-lg tracking-wider text-hull-100 hidden sm:block whitespace-nowrap">
              SWG:L <span className="text-plasma-400">SPACE TOOLS</span>
            </span>
            <span className="font-display font-bold text-lg tracking-wider text-plasma-400 sm:hidden whitespace-nowrap">SWG:L</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-1 flex-1 min-w-0 overflow-x-auto no-scrollbar">
            {visibleItems.map((item, i) => (
              <React.Fragment key={item.to}>
                {/* Visual separator between loadout and collections sections */}
                {item.divider && (
                  <div className="w-px h-6 bg-hull-500/40 mx-1" />
                )}
                <Link
                  to={item.to}
                  className={`nav-link flex items-center gap-1.5 text-sm whitespace-nowrap shrink-0 ${location.pathname === item.to ? 'nav-link-active' : ''}`}
                >
                  <item.icon size={15} />
                  {item.label}
                </Link>
              </React.Fragment>
            ))}
          </div>

          {/* Auth / Mobile toggle */}
          <div className="flex items-center gap-2 shrink-0 ml-auto">
            {user ? (
              <div className="hidden lg:flex items-center gap-2 xl:gap-3 shrink-0">
                <span className="hidden 2xl:inline-flex items-center text-sm text-hull-200 font-display whitespace-nowrap">
                  <User size={14} className="inline mr-1" />{user.display_name || user.username}
                </span>
                <button onClick={logout} className="btn-ghost text-xs flex items-center gap-1">
                  <LogOut size={14} /> Sign Out
                </button>
              </div>
            ) : (
              <Link to="/auth" className="hidden lg:block btn-primary text-xs">Sign In</Link>
            )}
            <button className="lg:hidden p-2 rounded-lg hover:bg-hull-600" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="mobile-drawer lg:hidden" onClick={() => setMobileOpen(false)}>
          <div className="pt-20 px-6 space-y-2" onClick={e => e.stopPropagation()}>
            {visibleItems.map(item => (
              <React.Fragment key={item.to}>
                {item.divider && <div className="section-divider" />}
                <Link
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-lg font-display tracking-wide transition-all
                    ${location.pathname === item.to ? 'bg-hull-700 text-plasma-400 shadow-glow' : 'text-hull-200 hover:bg-hull-700'}`}
                >
                  <item.icon size={20} />
                  {item.label}
                </Link>
              </React.Fragment>
            ))}
            <div className="section-divider" />
            {user ? (
              <>
                <div className="px-4 py-2 text-hull-200 font-display">
                  Signed in as <span className="text-hull-100">{user.display_name || user.username}</span>
                </div>
                <button onClick={() => { logout(); setMobileOpen(false); }}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-lg font-display text-laser-red hover:bg-hull-700 w-full">
                  <LogOut size={20} /> Sign Out
                </button>
              </>
            ) : (
              <Link to="/auth" onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-lg font-display text-plasma-400 hover:bg-hull-700">
                <User size={20} /> Sign In / Register
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}
