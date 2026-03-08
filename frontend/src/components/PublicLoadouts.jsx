import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { BookOpen, Copy, ExternalLink, Eye, Sparkles, User, Users } from 'lucide-react';

const CORE_LABELS = [
  ['reactor', 'Reactor'],
  ['engine', 'Engine'],
  ['booster', 'Booster'],
  ['shield', 'Shield'],
  ['front_armor', 'Front Armor'],
  ['rear_armor', 'Rear Armor'],
  ['capacitor', 'Capacitor'],
  ['cargo_hold', 'Cargo Hold'],
  ['droid_interface', 'Droid Interface'],
];

function splitTags(tagString) {
  return (tagString || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export default function PublicLoadouts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const initialTab = location.pathname.includes('/starters') ? 'starter' : 'community';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [community, setCommunity] = useState([]);
  const [starters, setStarters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    setActiveTab(location.pathname.includes('/starters') ? 'starter' : 'community');
  }, [location.pathname]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    Promise.all([api.getPublicLoadouts(), api.getStarterLoadouts()])
      .then(([communityBuilds, starterBuilds]) => {
        if (!mounted) return;
        setCommunity(communityBuilds);
        setStarters(starterBuilds);
      })
      .catch(console.error)
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const currentItems = activeTab === 'starter' ? starters : community;
  const currentMeta = useMemo(
    () =>
      activeTab === 'starter'
        ? {
            title: 'STARTER BUILDS',
            icon: Sparkles,
            accent: 'text-laser-yellow',
            emptyTitle: 'No starter builds published yet.',
            emptyBody: 'Publish a curated starter build from the admin tools to show it here.',
          }
        : {
            title: 'COMMUNITY BUILDS',
            icon: Users,
            accent: 'text-plasma-400',
            emptyTitle: 'No community builds shared yet.',
            emptyBody: 'Be the first to share a build with the community.',
          },
    [activeTab]
  );

  const handleCopy = async (loadout) => {
    if (!user) {
      alert('Sign in to copy loadouts.');
      return;
    }
    const suggestedName = activeTab === 'starter' ? `${loadout.name} (Starter Copy)` : `${loadout.name} (Copy)`;
    const name = prompt('Name for your copy:', suggestedName);
    if (!name) return;
    try {
      await api.duplicateLoadout(loadout.id, name);
      alert('Loadout copied to your collection.');
    } catch (error) {
      alert(error.message);
    }
  };

  const switchTab = (tab) => {
    setActiveTab(tab);
    navigate(tab === 'starter' ? '/tools/starters' : '/tools/community');
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-wider text-hull-100 flex items-center gap-2 mb-2">
            <currentMeta.icon size={24} className={currentMeta.accent} /> {currentMeta.title}
          </h1>
          <p className="text-hull-200 text-sm max-w-3xl">
            {activeTab === 'starter'
              ? 'Curated ship setups built for quick loading, teaching, and sensible starting points.'
              : 'Player-submitted builds you can inspect in the builder or copy into your own loadouts.'}
          </p>
        </div>

        <div className="inline-flex rounded-xl border border-hull-400/50 bg-hull-800/70 p-1 self-start md:self-auto">
          <button
            type="button"
            onClick={() => switchTab('community')}
            className={`px-4 py-2 rounded-lg text-sm font-display tracking-wide transition-colors ${
              activeTab === 'community' ? 'bg-plasma-500/15 text-plasma-300' : 'text-hull-200 hover:text-hull-50'
            }`}
          >
            <Users size={15} className="inline mr-2" /> Community
          </button>
          <button
            type="button"
            onClick={() => switchTab('starter')}
            className={`px-4 py-2 rounded-lg text-sm font-display tracking-wide transition-colors ${
              activeTab === 'starter' ? 'bg-laser-yellow/15 text-laser-yellow' : 'text-hull-200 hover:text-hull-50'
            }`}
          >
            <Sparkles size={15} className="inline mr-2" /> Starter
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-hull-200">Loading builds...</div>
      ) : currentItems.length === 0 ? (
        <div className="text-center py-16">
          <currentMeta.icon size={48} className="text-hull-500 mx-auto mb-4" />
          <p className="text-hull-200 text-lg">{currentMeta.emptyTitle}</p>
          <p className="text-hull-500 text-sm mt-1">{currentMeta.emptyBody}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {currentItems.map((loadout) => {
            const tags = splitTags(loadout.starter_tags);
            return (
              <div key={loadout.id} className="card overflow-hidden">
                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-display font-bold text-hull-100 text-lg">{loadout.name}</h3>
                        {loadout.is_featured && (
                          <span className="badge badge-admin">Featured</span>
                        )}
                        {loadout.is_starter && (
                          <span className="badge bg-laser-yellow/10 text-laser-yellow border-laser-yellow/30">
                            Starter
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-plasma-400 font-display">{loadout.chassis}</p>
                      {loadout.starter_description && (
                        <p className="text-sm text-hull-200 mt-2 max-w-2xl">{loadout.starter_description}</p>
                      )}
                    </div>
                    <div className="text-xs text-hull-200 font-display flex items-center gap-1 shrink-0">
                      <User size={12} /> {loadout.owner_name}
                    </div>
                  </div>

                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-hull-500/50 bg-hull-800/70 px-2.5 py-1 text-[11px] font-display tracking-wide text-hull-200"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1 text-xs text-hull-200">
                    {CORE_LABELS.map(([key, label]) => {
                      const value = loadout[key];
                      if (!value || value === 'None') return null;
                      return (
                        <span key={key}>
                          {label}: <span className="text-hull-100">{value}</span>
                        </span>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setExpanded(expanded === loadout.id ? null : loadout.id)}
                      className="btn-ghost text-xs flex items-center gap-1"
                    >
                      <Eye size={12} /> {expanded === loadout.id ? 'Less' : 'Details'}
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`/tools?loadout=${loadout.id}`)}
                      className="btn-ghost text-xs flex items-center gap-1"
                    >
                      <ExternalLink size={12} /> View in Builder
                    </button>
                    {user && (
                      <button
                        type="button"
                        onClick={() => handleCopy(loadout)}
                        className="btn-primary text-xs flex items-center gap-1"
                      >
                        <Copy size={12} /> Copy to My Loadouts
                      </button>
                    )}
                  </div>
                </div>

                {expanded === loadout.id && (
                  <div className="px-4 pb-4 border-t border-hull-500/30 pt-3 animate-slide-up">
                    <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-hull-200">
                      <span>
                        Mass: <span className="text-hull-100 font-mono">{loadout.mass}</span>
                      </span>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((slotNumber) => {
                        const value = loadout[`slot${slotNumber}`];
                        if (!value || value === 'None') return null;
                        return (
                          <span key={slotNumber}>
                            Slot {slotNumber}: <span className="text-hull-100">{value}</span>
                          </span>
                        );
                      })}
                      {loadout.ro_level !== 'None' && (
                        <span>
                          Reactor OL: <span className="text-laser-yellow font-mono">{loadout.ro_level}</span>
                        </span>
                      )}
                      {loadout.eo_level !== 'None' && (
                        <span>
                          Engine OL: <span className="text-laser-yellow font-mono">{loadout.eo_level}</span>
                        </span>
                      )}
                      {loadout.co_level !== 'None' && (
                        <span>
                          Cap OC: <span className="text-laser-yellow font-mono">{loadout.co_level}</span>
                        </span>
                      )}
                      {loadout.wo_level !== 'None' && (
                        <span>
                          Weapon OL: <span className="text-laser-yellow font-mono">{loadout.wo_level}</span>
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'starter' && (
        <div className="rounded-2xl border border-hull-400/40 bg-hull-800/50 px-4 py-4 text-sm text-hull-200 flex items-start gap-3">
          <BookOpen size={18} className="text-laser-yellow shrink-0 mt-0.5" />
          <span>
            Starter builds are curated templates. Load one into the main builder, adjust it for your parts,
            and save your own version separately.
          </span>
        </div>
      )}
    </div>
  );
}
