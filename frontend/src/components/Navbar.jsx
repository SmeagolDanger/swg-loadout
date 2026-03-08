import React, { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Menu,
  X,
  Crosshair,
  Box,
  Search,
  Users,
  LogOut,
  User,
  Wrench,
  FlaskConical,
  Cpu,
  Trophy,
  Medal,
  UserCircle,
  ChevronRight,
  Shield,
  Orbit,
  Flag,
} from 'lucide-react';

const TOOL_NAV_ITEMS = [
  { to: '/tools', label: 'Builder', icon: Crosshair },
  { to: '/tools/loadouts', label: 'Loadouts', icon: Box, auth: true },
  { to: '/tools/components', label: 'Components', icon: Wrench, auth: true },
  { to: '/tools/re', label: 'RE Calc', icon: FlaskConical },
  { to: '/tools/fc', label: 'FC Calc', icon: Cpu },
  { to: '/tools/loot', label: 'Loot', icon: Search },
  { to: '/tools/community', label: 'Community', icon: Users },
  { to: '/tools/gcw', label: 'GCW Calc', icon: Flag },
];

const COLLECTION_NAV_ITEMS = [
  { to: '/collections', label: 'Tracker', icon: Trophy },
  { to: '/collections/characters', label: 'Characters', icon: UserCircle },
  { to: '/collections/leaderboard', label: 'Leaderboard', icon: Medal },
];

function isActive(pathname, itemPath) {
  if (itemPath === '/tools' || itemPath === '/collections') {
    return pathname === itemPath;
  }
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const section = useMemo(() => {
    if (location.pathname.startsWith('/tools/buildouts')) return 'buildouts';
    if (location.pathname.startsWith('/collections')) return 'collections';
    if (location.pathname.startsWith('/tools')) return 'tools';
    return 'home';
  }, [location.pathname]);

  const navItems = useMemo(() => {
    if (section === 'collections') return COLLECTION_NAV_ITEMS;
    if (section === 'tools') return TOOL_NAV_ITEMS;
    return [];
  }, [section]);

  const visibleItems = navItems.filter((item) => !item.auth || user);

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-40 bg-hull-800/90 backdrop-blur-md border-b border-hull-500/40 overflow-hidden">
        <div className="max-w-[90rem] mx-auto px-4 h-16 flex items-center gap-4 overflow-hidden">
          <Link to="/" className="flex items-center gap-2 group shrink-0 min-w-fit">
            <div className="w-8 h-8 rounded-lg bg-plasma-500/20 border border-plasma-500/40 flex items-center justify-center group-hover:shadow-glow transition-all">
              <Crosshair size={18} className="text-plasma-400" />
            </div>
            <span className="font-display font-bold text-lg tracking-wider text-hull-100 hidden sm:block whitespace-nowrap">
              SWG:L <span className="text-plasma-400">TOOLS</span>
            </span>
            <span className="font-display font-bold text-lg tracking-wider text-plasma-400 sm:hidden whitespace-nowrap">
              SWG:L
            </span>
          </Link>

          <div className="hidden lg:flex items-center gap-2 shrink-0">
            <Link
              to="/tools"
              className={`section-pill ${section === 'tools' ? 'section-pill-active' : ''}`}
            >
              <Crosshair size={14} />
              Space Tools
            </Link>

            <Link
              to="/collections"
              className={`section-pill ${section === 'collections' ? 'section-pill-active section-pill-collections' : ''}`}
            >
              <Trophy size={14} />
              Collections
            </Link>

            <Link
              to="/tools/buildouts"
              className={`section-pill ${section === 'buildouts' ? 'section-pill-active' : ''}`}
            >
              <Orbit size={14} />
              Buildouts
            </Link>
          </div>

          {section !== 'home' ? (
            <div className="hidden lg:flex items-center gap-1 flex-1 min-w-0 overflow-hidden">
              <div className="w-px h-6 bg-hull-500/40 mx-1 shrink-0" />

              {section === 'buildouts' ? (
                <div className="flex items-center gap-2 text-sm text-hull-300 font-display tracking-wide min-w-0">
                  <ChevronRight size={14} className="text-plasma-400 shrink-0" />
                  <span className="truncate">Mission &amp; Spawn Map Parser</span>
                </div>
              ) : (
                visibleItems.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`nav-link flex items-center gap-1.5 text-sm whitespace-nowrap shrink-0 ${
                      isActive(location.pathname, item.to) ? 'nav-link-active' : ''
                    }`}
                  >
                    <item.icon size={15} />
                    {item.label}
                  </Link>
                ))
              )}
            </div>
          ) : (
            <div className="hidden lg:flex items-center gap-2 text-sm text-hull-300 font-display tracking-wide flex-1 min-w-0">
              <ChevronRight size={14} className="text-plasma-400 shrink-0" />
              <span className="truncate">Select a section above to get started.</span>
            </div>
          )}

          <div className="flex items-center gap-1.5 shrink-0">
            {user ? (
              <div className="hidden lg:flex items-center gap-1.5 shrink-0">
                <span className="text-xs text-hull-200 font-display whitespace-nowrap max-w-[120px] truncate">
                  {user.display_name || user.username}
                </span>
                {(user.role === 'admin' || user.is_admin) && (
                  <Link to="/admin" className="btn-ghost p-2 text-laser-red" title="Admin Panel">
                    <Shield size={15} />
                  </Link>
                )}
                <button
                  onClick={logout}
                  className="btn-ghost p-2 text-hull-300 hover:text-hull-100"
                  title="Sign Out"
                >
                  <LogOut size={15} />
                </button>
              </div>
            ) : (
              <Link to="/auth" className="hidden lg:block btn-primary text-xs">
                Sign In
              </Link>
            )}

            <button
              className="lg:hidden p-2 rounded-lg hover:bg-hull-600"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </nav>

      {mobileOpen && (
        <div className="mobile-drawer lg:hidden" onClick={() => setMobileOpen(false)}>
          <div className="pt-20 px-6 space-y-2" onClick={(e) => e.stopPropagation()}>
            <Link
              to="/tools"
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-lg font-display tracking-wide transition-all ${
                section === 'tools'
                  ? 'bg-hull-700 text-plasma-400 shadow-glow'
                  : 'text-hull-200 hover:bg-hull-700'
              }`}
            >
              <Crosshair size={20} />
              Space Tools
            </Link>

            <Link
              to="/collections"
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-lg font-display tracking-wide transition-all ${
                section === 'collections'
                  ? 'bg-hull-700 text-laser-yellow shadow-glow'
                  : 'text-hull-200 hover:bg-hull-700'
              }`}
            >
              <Trophy size={20} />
              Collections
            </Link>

            <Link
              to="/tools/buildouts"
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-lg font-display tracking-wide transition-all ${
                section === 'buildouts'
                  ? 'bg-hull-700 text-plasma-400 shadow-glow'
                  : 'text-hull-200 hover:bg-hull-700'
              }`}
            >
              <Orbit size={20} />
              Buildouts
            </Link>

            {section !== 'home' && <div className="section-divider" />}

            {section === 'tools' &&
              visibleItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-lg font-display tracking-wide transition-all ${
                    isActive(location.pathname, item.to)
                      ? 'bg-hull-700 text-plasma-400 shadow-glow'
                      : 'text-hull-200 hover:bg-hull-700'
                  }`}
                >
                  <item.icon size={20} />
                  {item.label}
                </Link>
              ))}

            {section === 'collections' &&
              visibleItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-lg font-display tracking-wide transition-all ${
                    isActive(location.pathname, item.to)
                      ? 'bg-hull-700 text-plasma-400 shadow-glow'
                      : 'text-hull-200 hover:bg-hull-700'
                  }`}
                >
                  <item.icon size={20} />
                  {item.label}
                </Link>
              ))}

            {section === 'buildouts' && (
              <div className="px-4 py-2 text-hull-200 font-display">
                Mission &amp; Spawn Map Parser
              </div>
            )}

            <div className="section-divider" />

            {user ? (
              <>
                <div className="px-4 py-2 text-hull-200 font-display">
                  Signed in as <span className="text-hull-100">{user.display_name || user.username}</span>
                </div>

                {(user.role === 'admin' || user.is_admin) && (
                  <Link
                    to="/admin"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-lg font-display text-laser-red hover:bg-hull-700"
                  >
                    <Shield size={20} /> Admin Panel
                  </Link>
                )}

                <button
                  onClick={() => {
                    logout();
                    setMobileOpen(false);
                  }}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-lg font-display text-laser-red hover:bg-hull-700 w-full"
                >
                  <LogOut size={20} /> Sign Out
                </button>
              </>
            ) : (
              <Link
                to="/auth"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-lg font-display text-plasma-400 hover:bg-hull-700"
              >
                <User size={20} /> Sign In / Register
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}