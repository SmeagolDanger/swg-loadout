import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../api';
import { Trophy, Medal, ChevronLeft, ChevronRight } from 'lucide-react';

const CATEGORY_ICONS = {
  exploration: '🌍', combat: '⚔️', loot: '💎', profession: '🔧',
  event: '🎉', badge: '🏅', space: '🚀', other: '📦',
};

export default function CollectionLeaderboard() {
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [category, setCategory] = useState(null);
  const [categories, setCategories] = useState([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const limit = 25;

  useEffect(() => {
    // Fetch categories from collections data
    api.getCollections().then(data => {
      const cats = [...new Set(data.map(g => g.category))].sort();
      setCategories(cats);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    loadLeaderboard();
  }, [category, offset]);

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      const data = await api.getLeaderboard({ limit, offset, category });
      setEntries(data.entries || []);
      setTotal(data.total || 0);
      setTotalItems(data.totalItems || 0);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const maxPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-laser-yellow/20 border border-laser-yellow/40 flex items-center justify-center">
          <Medal size={20} className="text-laser-yellow" />
        </div>
        <div>
          <h1 className="font-display font-bold text-xl tracking-wider text-hull-50">
            COLLECTION <span className="text-laser-yellow">LEADERBOARD</span>
          </h1>
          <p className="text-hull-300 text-xs font-mono">TOP COLLECTORS ACROSS THE GALAXY</p>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          className={`btn-ghost text-xs ${!category ? 'text-laser-yellow bg-hull-700' : ''}`}
          onClick={() => { setCategory(null); setOffset(0); }}
        >ALL</button>
        {categories.map(cat => (
          <button
            key={cat}
            className={`btn-ghost text-xs ${category === cat ? 'text-laser-yellow bg-hull-700' : ''}`}
            onClick={() => { setCategory(category === cat ? null : cat); setOffset(0); }}
          >
            {CATEGORY_ICONS[cat] || '📦'} {cat.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-plasma-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12 text-hull-300">No entries yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hull-500/50 text-hull-300 font-display text-xs tracking-wider">
                  <th className="text-left px-4 py-3 w-12">#</th>
                  <th className="text-left px-4 py-3">CHARACTER</th>
                  <th className="text-left px-4 py-3 hidden sm:table-cell">PROFESSION</th>
                  <th className="text-left px-4 py-3 hidden md:table-cell">GUILD</th>
                  <th className="text-left px-4 py-3 hidden md:table-cell">OWNER</th>
                  <th className="text-right px-4 py-3">COLLECTED</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => {
                  const rank = offset + i + 1;
                  const isTop3 = rank <= 3;
                  return (
                    <tr key={e.id}
                      className={`border-b border-hull-500/20 hover:bg-hull-600/20 transition-colors
                        ${isTop3 ? 'bg-laser-yellow/3' : ''}`}
                    >
                      <td className="px-4 py-3">
                        {rank === 1 ? <span className="text-lg">🥇</span> :
                         rank === 2 ? <span className="text-lg">🥈</span> :
                         rank === 3 ? <span className="text-lg">🥉</span> :
                         <span className="text-hull-300 font-mono">{rank}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className={`font-display font-semibold ${isTop3 ? 'text-laser-yellow' : 'text-hull-50'}`}>
                          {e.name}
                        </div>
                        <div className="text-xs text-hull-300 font-mono sm:hidden">
                          {e.profession} {e.guild ? `<${e.guild}>` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-hull-200 hidden sm:table-cell">{e.profession || '—'}</td>
                      <td className="px-4 py-3 text-laser-yellow text-xs hidden md:table-cell">
                        {e.guild ? `<${e.guild}>` : '—'}
                      </td>
                      <td className="px-4 py-3 text-hull-300 hidden md:table-cell">{e.owner}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-display font-bold text-plasma-400">{e.collected}</span>
                        {totalItems > 0 && !category && (
                          <span className="text-hull-400 text-xs ml-1">/ {totalItems}</span>
                        )}
                        {e.total_in_cat && (
                          <span className="text-hull-400 text-xs ml-1">/ {e.total_in_cat}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {maxPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-hull-500/30">
            <button className="btn-ghost text-xs" disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - limit))}>
              <ChevronLeft size={14} /> Previous
            </button>
            <span className="text-hull-300 text-xs font-mono">
              Page {currentPage} of {maxPages}
            </span>
            <button className="btn-ghost text-xs" disabled={currentPage >= maxPages}
              onClick={() => setOffset(offset + limit)}>
              Next <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
