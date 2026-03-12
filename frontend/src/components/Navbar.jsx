import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  Box,
  ChevronDown,
  ChevronRight,
  Crosshair,
  Cpu,
  Download,
  Flag,
  FlaskConical,
  LogOut,
  Medal,
  Menu,
  Music4,
  Orbit,
  Palette,
  Search,
  Shield,
  Sparkles,
  Trophy,
  User,
  UserCircle,
  Users,
  Wrench,
  X,
} from 'lucide-react';

const TOOL_NAV_ITEMS = [
  { to: '/tools', label: 'Builder', icon: Crosshair },
  { to: '/tools/loadouts', label: 'Loadouts', icon: Box, auth: true },
  { to: '/tools/components', label: 'Components', icon: Wrench, auth: true },
  { to: '/tools/re', label: 'RE Calc', icon: FlaskConical },
  { to: '/tools/fc', label: 'FC Calc', icon: Cpu },
  { to: '/tools/loot', label: 'Loot', icon: Search },
  { to: '/tools/logs', label: 'Log Analyzer', icon: ScrollText },
  { to: '/tools/starters', label: 'Starter Builds', icon: Sparkles },
  { to: '/tools/community', label: 'Community', icon: Users },
];

const COLLECTION_NAV_ITEMS = [
  { to: '/collections', label: 'Tracker', icon: Trophy },
  { to: '/collections/characters', label: 'Characters', icon: UserCircle },
  { to: '/collections/leaderboard', label: 'Leaderboard', icon: Medal },
];

const FEATURE_MODES = [
  { key: 'tools', to: '/tools', label: 'Space Tools', icon: Crosshair, sublabel: 'Builders and calculators' },
  { key: 'buildouts', to: '/tools/buildouts', label: 'Buildout Maps', icon: Orbit, sublabel: 'Zone parser and map tools' },
  { key: 'gcw', to: '/tools/gcw', label: 'GCW Calculator', icon: Flag, sublabel: 'Rank and decay projection' },
  { key: 'ent', to: '/tools/ent-buffs', label: 'Ent Buffs', icon: Music4, sublabel: 'Buff planning and requests' },
  { key: 'logs', to: '/tools/logs', label: 'Log Analyzer', icon: ScrollText, sublabel: 'Combat parsing and encounter summaries' },
  { key: 'mods', to: '/mods', label: 'Game Mods', icon: Download, sublabel: 'Curated downloads and screenshots' },
  { key: 'collections', to: '/collections', label: 'Collections', icon: Trophy, sublabel: 'Tracker and leaderboard' },
];

function isActive(pathname, itemPath) {
  if (itemPath === '/tools' || itemPath === '/collections') {
    return pathname === itemPath;
  }
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}

function resolveSection(pathname) {
  if (pathname.startsWith('/tools/buildouts')) return 'buildouts';
  if (pathname.startsWith('/tools/gcw')) return 'gcw';
  if (pathname.startsWith('/tools/ent-buffs')) return 'ent';
  if (pathname.startsWith('/tools/logs')) return 'logs';
  if (pathname.startsWith('/mods')) return 'mods';
  if (pathname.startsWith('/collections')) return 'collections';
  if (pathname.startsWith('/tools')) return 'tools';
  return 'home';
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const { theme, setTheme, themes } = useTheme();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [modeOpen, setModeOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  const section = useMemo(() => resolveSection(location.pathname), [location.pathname]);
  const currentMode = FEATURE_MODES.find((mode) => mode.key === section) || FEATURE_MODES.find((mode) => mode.key === 'tools') || FEATURE_MODES[0];

  const navItems = useMemo(() => {
    if (section === 'collections') return COLLECTION_NAV_ITEMS;
    if (section === 'tools') return TOOL_NAV_ITEMS;
    return [];
  }, [section]);

  const sectionLabel = useMemo(() => {
    switch (section) {
      case 'buildouts':
        return 'Mission & Spawn Map Parser';
      case 'gcw':
        return 'Faction rank projection and decay planning';
      case 'ent':
        return 'Entertainer buff planning and request generator';
      case 'logs':
        return 'Combat parsing, encounter summaries, and roster review';
      case 'mods':
        return 'Curated mod downloads, screenshots, and install notes';
      case 'collections':
        return 'Collection tracking and leaderboard tools';
      case 'tools':
        return null;
      default:
        return 'Choose a feature from the menu to get started.';
    }
  }, [section]);

  const visibleItems = navItems.filter((item) => !item.auth || user);

  useEffect(() => {
    setModeOpen(false);
    setMobileOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentThemeLabel = themes.find((item) => item.key === theme)?.label ?? 'Theme';

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-40 bg-hull-800/90 backdrop-blur-md border-b border-hull-500/40 overflow-visible">
        <div className="max-w-[90rem] mx-auto px-3 sm:px-4 h-14 sm:h-16 flex items-center gap-2 sm:gap-4 overflow-visible">
          <Link to="/" className="flex items-center gap-2 group shrink-0 min-w-fit">
            <div className="w-8 h-8 rounded-lg bg-plasma-500/20 border border-plasma-500/40 flex items-center justify-center group-hover:shadow-glow transition-all">
              <Crosshair size={18} className="text-plasma-400" />
            </div>
            <span className="font-display font-bold text-base sm:text-lg tracking-wider text-hull-100 hidden sm:block whitespace-nowrap">
              SWG:L <span className="text-plasma-400">TOOLS</span>
            </span>
            <span className="font-display font-bold text-base tracking-wider text-plasma-400 sm:hidden whitespace-nowrap">
              SWG:L
            </span>
          </Link>

          <div className="hidden lg:block relative shrink-0">
            <button
              type="button"
              onClick={() => setModeOpen((open) => !open)}
              className="inline-flex items-center gap-2 rounded-xl border border-hull-400/50 bg-hull-800/80 px-3 py-2 text-sm text-hull-100 hover:border-plasma-400/50 hover:text-plasma-300 transition-colors"
            >
              <currentMode.icon size={15} className="text-plasma-400" />
              <span className="font-display tracking-wide whitespace-nowrap">{currentMode.label}</span>
              <ChevronDown size={15} className={`transition-transform ${modeOpen ? 'rotate-180' : ''}`} />
            </button>

            {modeOpen && (
              <div className="absolute top-12 left-0 w-72 rounded-2xl border border-hull-400/50 bg-hull-900/95 shadow-2xl p-2">
                {FEATURE_MODES.map((mode) => (
                  <Link
                    key={mode.key}
                    to={mode.to}
                    className={`flex items-start gap-3 rounded-xl px-3 py-3 transition-colors ${
                      section === mode.key ? 'bg-plasma-500/10 border border-plasma-400/30' : 'hover:bg-hull-800/80 border border-transparent'
                    }`}
                  >
                    <div className="mt-0.5 w-8 h-8 rounded-lg bg-hull-800 border border-hull-500/40 flex items-center justify-center shrink-0">
                      <mode.icon size={16} className="text-plasma-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-hull-50">{mode.label}</div>
                      <div className="text-xs text-hull-300">{mode.sublabel}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {section !== 'home' ? (
            <div className="hidden lg:flex items-center gap-1 flex-1 min-w-0 overflow-hidden">
              <div className="w-px h-6 bg-hull-500/40 mx-1 shrink-0" />

              {visibleItems.length ? (
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
              ) : (
                <div className="flex items-center gap-2 text-sm text-hull-300 font-display tracking-wide min-w-0">
                  <ChevronRight size={14} className="text-plasma-400 shrink-0" />
                  <span className="truncate">{sectionLabel}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="hidden lg:flex items-center gap-2 text-sm text-hull-300 font-display tracking-wide flex-1 min-w-0">
              <ChevronRight size={14} className="text-plasma-400 shrink-0" />
              <span className="truncate">Choose a feature from the menu to get started.</span>
            </div>
          )}

          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            {user ? (
              <div className="hidden lg:flex items-center gap-2 shrink-0 relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((open) => !open)}
                  className="inline-flex items-center gap-2 rounded-xl border border-hull-400/50 bg-hull-800/80 px-3 py-2 text-sm text-hull-100 hover:border-plasma-400/50 hover:text-plasma-300 transition-colors max-w-[220px]"
                >
                  <UserCircle size={16} className="text-plasma-400 shrink-0" />
                  <span className="truncate font-display tracking-wide">{user.display_name || user.username}</span>
                  <ChevronDown size={15} className={`transition-transform shrink-0 ${userMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 top-12 w-80 rounded-2xl border border-hull-400/50 bg-hull-900/95 shadow-2xl p-3 space-y-3">
                    <div className="rounded-xl border border-hull-400/40 bg-hull-800/80 px-3 py-3">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-hull-300 font-display">Signed in as</div>
                      <div className="mt-1 text-sm text-hull-50 font-semibold truncate">{user.display_name || user.username}</div>
                    </div>

                    <div className="rounded-xl border border-hull-400/40 bg-hull-800/80 px-3 py-3">
                      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-hull-300 font-display mb-2">
                        <Palette size={14} className="text-plasma-400" />
                        Theme
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {themes.map((option) => (
                          <button
                            key={option.key}
                            type="button"
                            onClick={() => setTheme(option.key)}
                            className={`rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                              theme === option.key
                                ? 'border-plasma-400/60 bg-plasma-500/15 text-plasma-300'
                                : 'border-hull-400/40 bg-hull-700/80 text-hull-100 hover:border-hull-300/60 hover:bg-hull-700'
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                      <div className="mt-2 text-xs text-hull-300">Current: {currentThemeLabel}</div>
                    </div>

                    <div className="flex items-center gap-2">
                      {(user.role === 'admin' || user.is_admin) && (
                        <Link to="/admin" className="btn-ghost flex-1 text-laser-red">
                          <Shield size={15} /> Admin
                        </Link>
                      )}
                      <button
                        onClick={logout}
                        className="btn-ghost flex-1 text-hull-300 hover:text-hull-100"
                        title="Sign Out"
                      >
                        <LogOut size={15} /> Sign Out
                      </button>
                    </div>
                  </div>
                )}
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
          <div className="pt-16 px-3 pb-4 space-y-2 max-h-[100dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {FEATURE_MODES.map((mode) => (
              <Link
                key={mode.key}
                to={mode.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-base font-display tracking-wide transition-all ${
                  section === mode.key ? 'bg-hull-700 text-plasma-400 shadow-glow' : 'text-hull-200 hover:bg-hull-700'
                }`}
              >
                <mode.icon size={18} />
                <div className="min-w-0">
                  <div>{mode.label}</div>
                  <div className="text-xs text-hull-300 truncate">{mode.sublabel}</div>
                </div>
              </Link>
            ))}

            {section !== 'home' && <div className="section-divider" />}

            {visibleItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-base font-display tracking-wide transition-all ${
                  isActive(location.pathname, item.to)
                    ? 'bg-hull-700 text-plasma-400 shadow-glow'
                    : 'text-hull-200 hover:bg-hull-700'
                }`}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            ))}

            {!visibleItems.length && sectionLabel && section !== 'home' && (
              <div className="px-3 py-2 text-sm text-hull-200 font-display">{sectionLabel}</div>
            )}

            <div className="section-divider" />

            <div className="rounded-xl border border-hull-400/40 bg-hull-800/80 px-3 py-3 space-y-3">
              <div className="flex items-center gap-2 text-sm font-display text-hull-100">
                <Palette size={16} className="text-plasma-400 shrink-0" />
                <span>Theme</span>
                <span className="ml-auto text-xs text-hull-300">{currentThemeLabel}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {themes.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setTheme(option.key)}
                    className={`rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                      theme === option.key
                        ? 'border-plasma-400/60 bg-plasma-500/15 text-plasma-300'
                        : 'border-hull-400/40 bg-hull-700/80 text-hull-100 hover:border-hull-300/60 hover:bg-hull-700'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="section-divider" />

            {user ? (
              <>
                <div className="px-3 py-2 text-sm text-hull-200 font-display">
                  Signed in as <span className="text-hull-100 font-semibold">{user.display_name || user.username}</span>
                </div>

                {(user.role === 'admin' || user.is_admin) && (
                  <Link
                    to="/admin"
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-base font-display text-laser-red hover:bg-hull-700"
                  >
                    <Shield size={18} /> Admin Panel
                  </Link>
                )}

                <button
                  onClick={logout}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-base font-display text-laser-red hover:bg-hull-700 w-full"
                >
                  <LogOut size={18} /> Sign Out
                </button>
              </>
            ) : (
              <Link
                to="/auth"
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-base font-display text-plasma-400 hover:bg-hull-700"
              >
                <User size={18} /> Sign In / Register
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}
