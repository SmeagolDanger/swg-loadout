import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive, Bookmark, BookmarkPlus, ChevronDown, ChevronRight, Database,
  Download, File, FileSearch, FileText, Folder, FolderOpen, GitCompare,
  Layers, Pause, Play, RotateCcw, Save, Search,
  Upload, Volume2, VolumeX, X, Zap,
} from 'lucide-react';
import {
  buildFileTree, computeDiff, crc32, crc32Lower,
  extractTREFile, extractTREFileLazy, formatHex, formatSize, getFileExt, getFileIcon,
  hasMatchingFiles, mergeRecords, parseDatatable, parseIFF, parseMesh, parsePAL,
  parseSTF, parseTRE, parseTRELazy, parseWorldSnapshot, scanDirectory,
  searchRepository, tryDecodeAudio, writeIFF,
} from '../utils/swgFiles';
import {
  FORM_DESCRIPTIONS, autoDetectFields, formatFieldValue, getChunkTemplate,
  parseChunkWithTemplate, parseTemplateParams,
} from '../utils/swgStructTemplates';

/* ═══════════════════════════════════════════════════════════
   Small reusable pieces
   ═══════════════════════════════════════════════════════════ */
function Pill({ children, className = '' }) {
  return <span className={`text-[9px] px-1.5 py-0.5 rounded font-display tracking-wide uppercase ${className}`}>{children}</span>;
}

/* ═══════════════════════════════════════════════════════════
   FILE TREE
   ═══════════════════════════════════════════════════════════ */
function DirNode({ dirName, node, depth, onFileClick, searchTerm, bookmarks, onBookmark }) {
  const [expanded, setExpanded] = useState(depth < 1);
  const open = expanded || !!searchTerm;
  return (
    <div>
      <button onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-1.5 px-2 py-px text-xs text-hull-100 hover:bg-hull-700/50 transition-colors"
        style={{ paddingLeft: depth * 14 + 8 }}>
        {open ? <ChevronDown size={10} className="text-hull-400 shrink-0" /> : <ChevronRight size={10} className="text-hull-400 shrink-0" />}
        {open ? <FolderOpen size={12} className="text-laser-yellow shrink-0" /> : <Folder size={12} className="text-laser-yellow shrink-0" />}
        <span className="flex-1 text-left truncate">{dirName}</span>
        <span className="text-[10px] text-hull-400 tabular-nums">{node.fileCount}</span>
      </button>
      {open && <TreeNode node={node} depth={depth + 1} onFileClick={onFileClick} searchTerm={searchTerm} bookmarks={bookmarks} onBookmark={onBookmark} />}
    </div>
  );
}

function TreeNode({ node, depth = 0, onFileClick, searchTerm, bookmarks, onBookmark }) {
  const dirs = Object.keys(node.children).sort();
  const files = (node.files || []).sort((a, b) => a.shortName.localeCompare(b.shortName));
  const filteredDirs = searchTerm ? dirs.filter(d => hasMatchingFiles(node.children[d], searchTerm)) : dirs;
  const filteredFiles = searchTerm ? files.filter(f => f.shortName.toLowerCase().includes(searchTerm.toLowerCase())) : files;
  if (!filteredDirs.length && !filteredFiles.length) return null;

  return (
    <div>
      {filteredDirs.map(d => (
        <DirNode key={d} dirName={d} node={node.children[d]} depth={depth} onFileClick={onFileClick} searchTerm={searchTerm} bookmarks={bookmarks} onBookmark={onBookmark} />
      ))}
      {filteredFiles.map(f => {
        const isBookmarked = bookmarks?.has(f.name);
        return (
          <div key={f.name} className="flex items-center group" style={{ paddingLeft: depth * 14 + 22 }}>
            <button onClick={() => onFileClick(f)}
              className="flex-1 flex items-center gap-1.5 px-1 py-px text-xs text-hull-200 hover:bg-hull-700/50 hover:text-hull-50 transition-colors truncate">
              <span className="shrink-0 text-[11px]">{getFileIcon(f.shortName)}</span>
              <span className="flex-1 text-left truncate">{f.shortName}</span>
              {f.sourceTRE && <span className="text-[9px] text-hull-400 bg-hull-700/60 px-1 rounded max-w-[60px] truncate hidden group-hover:inline" title={f.sourceTRE}>{f.sourceTRE}</span>}
              <span className="text-[10px] text-hull-400 tabular-nums">{formatSize(f.uncompLen)}</span>
            </button>
            {onBookmark && (
              <button onClick={() => onBookmark(f.name)} className={`px-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${isBookmarked ? '!opacity-100' : ''}`}>
                {isBookmarked ? <Bookmark size={10} className="text-plasma-400 fill-plasma-400" /> : <BookmarkPlus size={10} className="text-hull-500 hover:text-plasma-400" />}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   REPOSITORY FOLDER TREE (left pane)
   ═══════════════════════════════════════════════════════════ */
function FolderTreeNode({ name, node, depth = 0, selectedPath, currentPath, onSelect }) {
  const [expanded, setExpanded] = useState(false);
  const isSelected = selectedPath === currentPath;
  const dirs = Object.keys(node.children).sort();
  return (
    <div>
      <div className={`flex items-center pr-1 border-l-2 transition-colors ${isSelected ? 'bg-plasma-500/15 border-plasma-400' : 'border-transparent hover:bg-hull-700/40'}`}
        style={{ paddingLeft: depth * 12 + 2 }}>
        <button className="p-0.5 shrink-0 text-hull-500 hover:text-hull-200" onClick={() => setExpanded(e => !e)}>
          {dirs.length > 0 ? (expanded ? <ChevronDown size={9} /> : <ChevronRight size={9} />) : <span className="w-2.5 inline-block" />}
        </button>
        <button className={`flex-1 flex items-center gap-1 py-0.5 text-left truncate text-[11px] ${isSelected ? 'text-plasma-300' : 'text-hull-200'}`}
          onClick={() => onSelect(currentPath, node)}>
          {isSelected ? <FolderOpen size={11} className="text-laser-yellow shrink-0" /> : <Folder size={11} className="text-laser-yellow shrink-0" />}
          <span className="truncate">{name}</span>
        </button>
        <span className="text-[9px] text-hull-600 tabular-nums ml-1 shrink-0">{node.fileCount}</span>
      </div>
      {expanded && dirs.map(d => (
        <FolderTreeNode key={d} name={d} node={node.children[d]} depth={depth + 1}
          selectedPath={selectedPath} currentPath={currentPath + '/' + d} onSelect={onSelect} />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   FILE LIST PANEL (center pane)
   ═══════════════════════════════════════════════════════════ */
function FileListPanel({ node, onFileClick, treArchives, selectedFile, onSelectFile }) {
  const [filter, setFilter] = useState('');
  const files = useMemo(() => {
    if (!node) return [];
    let f = node.files || [];
    if (filter) f = f.filter(file => file.shortName.toLowerCase().includes(filter.toLowerCase()));
    return [...f].sort((a, b) => a.shortName.localeCompare(b.shortName));
  }, [node, filter]);

  const versions = useMemo(() => {
    if (!selectedFile) return [];
    return treArchives.filter(t => t.records).flatMap(t => t.records.filter(r => r.name === selectedFile.name));
  }, [selectedFile, treArchives]);

  if (!node) {
    return <div className="flex-1 flex items-center justify-center text-hull-500 text-[11px]">Select a directory</div>;
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Column headers */}
      <div className="flex items-center border-b border-hull-600/40 shrink-0 bg-hull-800/60 text-[10px] font-display tracking-wide text-hull-500 uppercase px-2 py-0.5 gap-0">
        <span className="flex-1">Filename</span>
        <span className="w-14 text-right shrink-0">Comp</span>
        <span className="w-16 text-right shrink-0">Uncomp</span>
        <span className="w-24 pl-2 shrink-0">Source</span>
      </div>
      {/* File list */}
      <div className="flex-1 overflow-auto min-h-0">
        {files.length === 0 && <div className="py-8 text-center text-hull-500 text-[11px]">No files in this folder</div>}
        {files.map(f => {
          const isSel = selectedFile?.name === f.name;
          return (
            <div key={f.name}
              className={`flex items-center text-[11px] cursor-pointer transition-colors border-l-2 px-2 py-px ${isSel ? 'bg-shield-blue/20 border-shield-blue text-hull-50' : 'border-transparent text-hull-200 hover:bg-hull-700/40'}`}
              onClick={() => onSelectFile(f)}
              onDoubleClick={() => onFileClick(f)}>
              <span className="flex-1 flex items-center gap-1.5 truncate min-w-0">
                <span className="shrink-0">{getFileIcon(f.shortName)}</span>
                <span className="truncate font-mono">{f.shortName}</span>
              </span>
              <span className="w-14 text-right text-hull-500 tabular-nums font-mono text-[10px] shrink-0">{formatSize(f.compLen || f.uncompLen)}</span>
              <span className="w-16 text-right text-hull-400 tabular-nums font-mono text-[10px] shrink-0">{formatSize(f.uncompLen)}</span>
              <span className="w-24 pl-2 text-hull-500 text-[10px] truncate shrink-0">{(f.sourceTRE || '').replace('.tre', '')}</span>
            </div>
          );
        })}
      </div>
      {/* Version history */}
      {selectedFile && (
        <div className="border-t border-hull-600/40 shrink-0 max-h-28 overflow-auto">
          <div className="px-2 py-0.5 text-[10px] font-display uppercase tracking-wider text-hull-400 bg-hull-800/60 sticky top-0 flex items-center justify-between">
            <span>Version history · {versions.length} TRE{versions.length !== 1 ? 's' : ''}</span>
            <button onClick={() => onFileClick(selectedFile)} className="px-1.5 py-0.5 rounded bg-plasma-500/20 text-plasma-400 hover:bg-plasma-500/30 text-[10px] font-display tracking-wide">Open</button>
          </div>
          {versions.map((v, i) => (
            <div key={i} className="flex items-center text-[10px] px-2 py-px text-hull-300 hover:bg-hull-700/30 font-mono gap-1">
              <span className="flex-1 truncate text-hull-200">{v.sourceTRE}</span>
              <span className="text-hull-500 tabular-nums w-14 text-right shrink-0">{formatSize(v.compLen)}</span>
              <span className="text-hull-400 tabular-nums w-16 text-right shrink-0">{formatSize(v.uncompLen)}</span>
              <span className="text-hull-600 w-20 text-right shrink-0">0x{(v.checksum >>> 0).toString(16).toUpperCase().padStart(8, '0')}</span>
            </div>
          ))}
        </div>
      )}
      {/* Filter bar */}
      <div className="px-2 py-1 border-t border-hull-600/40 shrink-0 bg-hull-800/40">
        <div className="relative">
          <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-hull-500" />
          <input type="text" value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter…"
            className="w-full pl-5 pr-2 py-0.5 bg-hull-900 border border-hull-600/50 text-hull-100 text-[11px] rounded font-mono placeholder:text-hull-500 focus:outline-none focus:border-plasma-500/50" />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   IFF TREE VIEW
   ═══════════════════════════════════════════════════════════ */
function IFFTreeView({ node, depth = 0, selectedNode, onSelectNode, path = '' }) {
  const [expanded, setExpanded] = useState(depth < 3);
  const isForm = node.tag === 'FORM' || node.tag === 'ROOT';
  const nodeId = path + '/' + node.tag + (node.type || '') + '_' + (node.offset || 0);
  const isSelected = selectedNode === nodeId;
  const desc = isForm && node.type ? FORM_DESCRIPTIONS[node.type.trim()] : null;

  return (
    <div>
      <button onClick={() => { if (isForm) setExpanded(e => !e); onSelectNode(nodeId, node); }}
        className={`w-full flex items-center gap-1.5 px-2 py-0.5 text-xs transition-colors ${isSelected ? 'bg-plasma-500/15 border-l-2 border-plasma-400' : 'border-l-2 border-transparent hover:bg-hull-700/50'}`}
        style={{ paddingLeft: depth * 16 + 8 }}>
        {isForm ? (expanded ? <ChevronDown size={10} className="text-hull-400 shrink-0" /> : <ChevronRight size={10} className="text-hull-400 shrink-0" />) : <span className="w-2.5" />}
        <span className={`font-mono font-semibold text-[11px] ${isForm ? 'text-laser-green' : 'text-shield-blue'}`}>{node.tag}</span>
        {node.type && <span className="font-mono font-bold text-[11px] text-plasma-400">{node.type.trim()}</span>}
        {desc && <span className="text-hull-500 text-[9px] truncate max-w-[120px]">{desc}</span>}
        {node.data && <span className="text-hull-400 text-[10px]">[{node.data.length}B]</span>}
        {isForm && node.children && <span className="text-hull-400 text-[10px]">({node.children.length})</span>}
      </button>
      {isForm && expanded && node.children?.map((child, i) => (
        <IFFTreeView key={i} node={child} depth={depth + 1} selectedNode={selectedNode} onSelectNode={onSelectNode} path={nodeId} />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   HEX VIEWER
   ═══════════════════════════════════════════════════════════ */
function HexViewer({ data }) {
  const lines = useMemo(() => formatHex(data, 4096), [data]);
  return (
    <div className="font-mono text-xs leading-relaxed">
      <div className="grid grid-cols-[70px_1fr_130px] px-3 py-1.5 border-b border-hull-600/40 text-[10px] font-semibold text-hull-400 uppercase tracking-wider sticky top-0 bg-hull-800 z-10">
        <span>Offset</span><span>Hex</span><span>ASCII</span>
      </div>
      {lines.map((line, i) => (
        <div key={i} className={`grid grid-cols-[70px_1fr_130px] px-3 py-px ${i % 2 ? 'bg-hull-800/30' : ''}`}>
          <span className="text-hull-400">{line.offset}</span>
          <span className="text-hull-100 tracking-wide">{line.hex}</span>
          <span className="text-plasma-300/70">{line.ascii}</span>
        </div>
      ))}
      {data.length > 4096 && <div className="px-3 py-2 text-hull-400 italic text-[11px]">Showing first 4,096 of {data.length.toLocaleString()} bytes…</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   STRUCT EDITOR — template-based field display for IFF chunks
   ═══════════════════════════════════════════════════════════ */
function StructEditor({ node, parentFormType, ancestorPath }) {
  if (!node || !node.data) return null;

  const parsed = useMemo(() => {
    // Check for XXXX chunks (template parameters)
    if (node.tag === 'XXXX' || node.tag.match(/^[0-9]{4}$/)) {
      const params = parseTemplateParams(node.data);
      if (params.length > 0) return { mode: 'params', params };
    }
    // Try template match
    const template = getChunkTemplate(node.tag, parentFormType, ancestorPath || '');
    if (template) {
      const result = parseChunkWithTemplate(node.data, template);
      if (result) return { mode: 'template', ...result };
    }
    // Auto-detect
    const autoFields = autoDetectFields(node.data);
    if (autoFields.length > 0) return { mode: 'auto', fields: autoFields };
    return null;
  }, [node, parentFormType, ancestorPath]);

  if (!parsed) return null;

  if (parsed.mode === 'params') {
    return (
      <div className="border-b border-hull-600/30">
        <div className="px-3 py-1.5 text-[10px] font-display uppercase tracking-wider text-plasma-400 border-b border-hull-700/30 bg-hull-800/40">
          Template Parameters ({parsed.params.length})
        </div>
        {parsed.params.map((p, i) => (
          <div key={i} className="flex items-center gap-2 px-3 py-1 text-xs border-b border-hull-700/20 hover:bg-hull-700/30">
            <span className="text-hull-500 w-6 text-right tabular-nums text-[10px]">{p.index}</span>
            <Pill className={p.loaded ? 'bg-laser-green/20 text-laser-green' : 'bg-hull-700 text-hull-400'}>{p.type}</Pill>
            <span className={`font-mono flex-1 ${p.loaded ? 'text-hull-100' : 'text-hull-500'}`}>
              {p.loaded ? (typeof p.value === 'object' ? JSON.stringify(p.value) : String(p.value)) : '(not loaded)'}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="border-b border-hull-600/30">
      <div className="px-3 py-1.5 text-[10px] font-display uppercase tracking-wider text-plasma-400 border-b border-hull-700/30 bg-hull-800/40 flex items-center gap-2">
        {parsed.templateName && <span>{parsed.templateName}</span>}
        <Pill className="bg-hull-700 text-hull-300">{parsed.mode}</Pill>
      </div>
      {parsed.fields.map((f, i) => (
        <div key={i} className="flex items-center gap-2 px-3 py-1 text-xs border-b border-hull-700/20 hover:bg-hull-700/30">
          <span className="text-hull-300 min-w-[120px] text-[11px]">{f.name}</span>
          <span className="font-mono text-hull-100 flex-1 break-all">
            {f.type === 'color_argb' || f.type === 'color_rgba'
              ? <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded border border-hull-600" style={{ backgroundColor: `rgb(${f.value?.r},${f.value?.g},${f.value?.b})` }} />{formatFieldValue(f)}</span>
              : formatFieldValue(f)}
          </span>
          {f.error && <span className="text-laser-red text-[10px]">{f.error}</span>}
        </div>
      ))}
      {parsed.remainingBytes > 0 && <div className="px-3 py-1 text-[10px] text-hull-500 italic">{parsed.remainingBytes} bytes remaining</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   DATATABLE EDITOR
   ═══════════════════════════════════════════════════════════ */
function DatatableEditor({ datatable }) {
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState(1);
  const [filter, setFilter] = useState('');
  const sortedRows = useMemo(() => {
    let rows = [...datatable.rows];
    if (filter) rows = rows.filter(row => row.some(cell => String(cell).toLowerCase().includes(filter.toLowerCase())));
    if (sortCol !== null) rows.sort((a, b) => {
      const va = a[sortCol], vb = b[sortCol];
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * sortDir;
      return String(va).localeCompare(String(vb)) * sortDir;
    });
    return rows;
  }, [datatable.rows, sortCol, sortDir, filter]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-3 py-2 border-b border-hull-600/40 bg-hull-800/80 shrink-0">
        <Database size={14} className="text-plasma-400" />
        <span className="text-[11px] font-display uppercase tracking-[0.15em] text-plasma-400 font-semibold">Datatable</span>
        <span className="text-[11px] text-hull-300">{datatable.columns.length} cols × {datatable.rows.length} rows</span>
        <div className="ml-auto relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-hull-400" />
          <input type="text" value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter…"
            className="pl-6 pr-2 py-1 bg-hull-900 border border-hull-600/50 text-hull-100 text-xs rounded font-mono w-44 placeholder:text-hull-500 focus:outline-none focus:border-plasma-500/50" />
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs border-collapse">
          <thead><tr className="sticky top-0 z-10 bg-hull-700/90">
            <th className="px-2.5 py-1.5 text-left text-[10px] text-hull-400 font-display tracking-wider border-b-2 border-hull-600/60">#</th>
            {datatable.columns.map((col, i) => (
              <th key={i} onClick={() => { if (sortCol === i) setSortDir(d => d * -1); else { setSortCol(i); setSortDir(1); } }}
                className={`px-2.5 py-1.5 text-left font-display tracking-wide cursor-pointer whitespace-nowrap border-b-2 transition-colors ${sortCol === i ? 'text-plasma-400 border-plasma-500/60' : 'text-hull-100 border-hull-600/60 hover:text-plasma-300'}`}>
                {col}{datatable.colTypes[i] && <span className="text-hull-400 font-normal ml-1 text-[10px]">[{datatable.colTypes[i]}]</span>}
                {sortCol === i && <span className="ml-1">{sortDir === 1 ? '▲' : '▼'}</span>}
              </th>
            ))}
          </tr></thead>
          <tbody>{sortedRows.map((row, ri) => (
            <tr key={ri} className="hover:bg-hull-700/40"><td className="px-2.5 py-1 text-hull-500 text-[10px] border-b border-hull-700/30">{ri}</td>
              {row.map((cell, ci) => (
                <td key={ci} className={`px-2.5 py-1 border-b border-hull-700/30 max-w-[280px] truncate font-mono ${typeof cell === 'number' ? 'text-shield-blue' : typeof cell === 'boolean' ? (cell ? 'text-laser-green' : 'text-laser-red') : 'text-hull-100'}`}>
                  {typeof cell === 'boolean' ? (cell ? 'true' : 'false') : typeof cell === 'number' ? cell.toLocaleString() : String(cell)}
                </td>))}
            </tr>))}
          </tbody>
        </table>
        {!sortedRows.length && <div className="py-8 text-center text-hull-400 text-sm">{filter ? 'No matching rows' : 'No data rows found'}</div>}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   STF EDITOR
   ═══════════════════════════════════════════════════════════ */
function STFEditor({ stfData }) {
  const [filter, setFilter] = useState('');
  const filtered = useMemo(() => {
    if (!filter) return stfData.entries;
    return stfData.entries.filter(e => String(e.id).includes(filter) || e.value.toLowerCase().includes(filter.toLowerCase()));
  }, [stfData, filter]);
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-3 py-2 border-b border-hull-600/40 bg-hull-800/80 shrink-0">
        <FileText size={14} className="text-laser-green" />
        <span className="text-[11px] font-display uppercase tracking-[0.15em] text-laser-green font-semibold">String Table</span>
        <span className="text-[11px] text-hull-300">{stfData.entries.length} strings</span>
        <div className="ml-auto relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-hull-400" />
          <input type="text" value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search…"
            className="pl-6 pr-2 py-1 bg-hull-900 border border-hull-600/50 text-hull-100 text-xs rounded font-mono w-44 placeholder:text-hull-500 focus:outline-none focus:border-plasma-500/50" />
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {filtered.map((entry, i) => (
          <div key={i} className="grid grid-cols-[52px_1fr] border-b border-hull-700/20 px-3 py-1 text-xs hover:bg-hull-700/30">
            <span className="text-shield-blue font-mono tabular-nums">{entry.id}</span>
            <span className="text-hull-100">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PAL EDITOR — visual color palette grid
   ═══════════════════════════════════════════════════════════ */
function PALEditor({ palData }) {
  const [selected, setSelected] = useState(null);
  if (!palData?.colors?.length) return <div className="p-6 text-hull-400 text-center">No palette data found</div>;
  const c = palData.colors;
  const gridCols = c.length <= 16 ? c.length : Math.min(16, Math.ceil(Math.sqrt(c.length)));
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-3 py-2 border-b border-hull-600/40 bg-hull-800/80 shrink-0">
        <span className="text-lg">🎨</span>
        <span className="text-[11px] font-display uppercase tracking-[0.15em] text-plasma-400 font-semibold">Palette Editor</span>
        <span className="text-[11px] text-hull-300">{c.length} colors</span>
        {selected !== null && (
          <span className="ml-auto text-xs text-hull-200 font-mono">
            #{selected}: rgba({c[selected].r}, {c[selected].g}, {c[selected].b}, {c[selected].a})
          </span>
        )}
      </div>
      <div className="flex-1 overflow-auto p-4">
        <div className="inline-grid gap-0.5" style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }}>
          {c.map((color, i) => (
            <button key={i} onClick={() => setSelected(i)}
              className={`w-6 h-6 rounded-sm border transition-transform hover:scale-125 hover:z-10 ${selected === i ? 'border-plasma-400 ring-1 ring-plasma-400 scale-125 z-10' : 'border-hull-600/50'}`}
              style={{ backgroundColor: `rgb(${color.r},${color.g},${color.b})` }}
              title={`#${i}: R${color.r} G${color.g} B${color.b} A${color.a}`} />
          ))}
        </div>
        {selected !== null && (
          <div className="mt-4 p-3 rounded-xl border border-hull-600/40 bg-hull-800/60 inline-flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg border border-hull-600" style={{ backgroundColor: `rgb(${c[selected].r},${c[selected].g},${c[selected].b})` }} />
            <div className="text-xs space-y-1 font-mono">
              <div className="text-hull-300">Index: <span className="text-hull-100">{selected}</span></div>
              <div className="text-hull-300">RGB: <span className="text-hull-100">{c[selected].r}, {c[selected].g}, {c[selected].b}</span></div>
              <div className="text-hull-300">Alpha: <span className="text-hull-100">{c[selected].a}</span></div>
              <div className="text-hull-300">Hex: <span className="text-hull-100">#{c[selected].r.toString(16).padStart(2,'0')}{c[selected].g.toString(16).padStart(2,'0')}{c[selected].b.toString(16).padStart(2,'0')}</span></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SND EDITOR — audio playback
   ═══════════════════════════════════════════════════════════ */
function SNDEditor({ data }) {
  const [playing, setPlaying] = useState(false);
  const [url, setUrl] = useState(null);
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = tryDecodeAudio(data);
    if (audio.blob) {
      const u = URL.createObjectURL(audio.blob);
      setUrl(u);
      return () => URL.revokeObjectURL(u);
    }
  }, [data]);

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play().then(() => setPlaying(true)).catch(() => {}); }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-3 py-2 border-b border-hull-600/40 bg-hull-800/80 shrink-0">
        <Volume2 size={14} className="text-laser-orange" />
        <span className="text-[11px] font-display uppercase tracking-[0.15em] text-laser-orange font-semibold">Sound Player</span>
        <span className="text-[11px] text-hull-300">{formatSize(data.length)}</span>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
        {url ? (
          <>
            <audio ref={audioRef} src={url} onEnded={() => setPlaying(false)} onError={() => setPlaying(false)} />
            <button onClick={toggle}
              className="w-16 h-16 rounded-full border-2 border-plasma-400 flex items-center justify-center hover:bg-plasma-500/20 transition-colors">
              {playing ? <Pause size={24} className="text-plasma-400" /> : <Play size={24} className="text-plasma-400 ml-1" />}
            </button>
            <div className="text-hull-300 text-xs">Click to {playing ? 'pause' : 'play'}</div>
          </>
        ) : (
          <div className="text-hull-400 text-sm flex items-center gap-2"><VolumeX size={18} /> Unsupported audio format</div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   WS VIEWER — 2D world snapshot map
   ═══════════════════════════════════════════════════════════ */
function WSViewer({ wsData }) {
  const canvasRef = useRef(null);
  const [selected, setSelected] = useState(null);
  const [zoom, setZoom] = useState(1);
  const objects = wsData?.objects || [];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !objects.length) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.fillStyle = '#0a0c10';
    ctx.fillRect(0, 0, w, h);

    // Calculate bounds
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const o of objects) { minX = Math.min(minX, o.x); maxX = Math.max(maxX, o.x); minZ = Math.min(minZ, o.z); maxZ = Math.max(maxZ, o.z); }
    const rangeX = (maxX - minX) || 1, rangeZ = (maxZ - minZ) || 1;
    const margin = 20;
    const scaleX = (w - margin * 2) / rangeX * zoom;
    const scaleZ = (h - margin * 2) / rangeZ * zoom;
    const scale = Math.min(scaleX, scaleZ);

    // Draw grid
    ctx.strokeStyle = '#1c2333';
    ctx.lineWidth = 0.5;
    const gridStep = Math.pow(10, Math.floor(Math.log10(rangeX / 5)));
    for (let gx = Math.floor(minX / gridStep) * gridStep; gx <= maxX; gx += gridStep) {
      const sx = margin + (gx - minX) * scale;
      ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, h); ctx.stroke();
    }
    for (let gz = Math.floor(minZ / gridStep) * gridStep; gz <= maxZ; gz += gridStep) {
      const sy = margin + (gz - minZ) * scale;
      ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(w, sy); ctx.stroke();
    }

    // Draw objects
    for (let i = 0; i < objects.length; i++) {
      const o = objects[i];
      const sx = margin + (o.x - minX) * scale;
      const sy = margin + (o.z - minZ) * scale;
      const isSel = selected === i;
      ctx.fillStyle = isSel ? '#00d4ff' : (o.templateName.includes('building') ? '#ffa500' : '#3fb950');
      ctx.beginPath();
      ctx.arc(sx, sy, isSel ? 4 : 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw origin crosshair
    const ox = margin + (0 - minX) * scale;
    const oz = margin + (0 - minZ) * scale;
    if (ox > 0 && ox < w && oz > 0 && oz < h) {
      ctx.strokeStyle = '#ff333444';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(ox - 8, oz); ctx.lineTo(ox + 8, oz); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ox, oz - 8); ctx.lineTo(ox, oz + 8); ctx.stroke();
    }
  }, [objects, selected, zoom]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-3 py-2 border-b border-hull-600/40 bg-hull-800/80 shrink-0">
        <span className="text-lg">🌐</span>
        <span className="text-[11px] font-display uppercase tracking-[0.15em] text-plasma-400 font-semibold">World Snapshot</span>
        <span className="text-[11px] text-hull-300">{objects.length} objects</span>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} className="text-hull-300 hover:text-hull-100 text-xs px-1">−</button>
          <span className="text-[10px] text-hull-400 tabular-nums">{zoom.toFixed(1)}x</span>
          <button onClick={() => setZoom(z => Math.min(4, z + 0.25))} className="text-hull-300 hover:text-hull-100 text-xs px-1">+</button>
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <canvas ref={canvasRef} width={600} height={600} className="bg-hull-950 shrink-0" />
        <div className="flex-1 overflow-auto border-l border-hull-600/40 min-w-[200px]">
          <div className="px-2 py-1 text-[10px] text-hull-400 font-display uppercase tracking-wider border-b border-hull-700/30 sticky top-0 bg-hull-800">Objects</div>
          {objects.map((o, i) => (
            <button key={i} onClick={() => setSelected(i)}
              className={`w-full text-left px-2 py-0.5 text-xs hover:bg-hull-700/40 ${selected === i ? 'bg-plasma-500/15 text-plasma-400' : 'text-hull-200'}`}>
              <div className="truncate">{o.templateName || '(unnamed)'}</div>
              <div className="text-[10px] text-hull-400 tabular-nums">{o.x.toFixed(1)}, {o.y.toFixed(1)}, {o.z.toFixed(1)}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   3D MESH PREVIEW (Canvas 2D wireframe — no Three.js dependency)
   ═══════════════════════════════════════════════════════════ */
function MeshPreview({ meshData }) {
  const canvasRef = useRef(null);
  const [rotX, setRotX] = useState(-0.4);
  const [rotY, setRotY] = useState(0.6);
  const [wireframe, setWireframe] = useState(true);
  const dragRef = useRef(null);

  const { positions, indices } = meshData;
  const vertCount = positions.length / 3;
  const triCount = indices.length / 3;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !positions.length) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.fillStyle = '#080a10';
    ctx.fillRect(0, 0, w, h);

    // Calculate bounding box for centering
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < positions.length; i += 3) {
      minX = Math.min(minX, positions[i]); maxX = Math.max(maxX, positions[i]);
      minY = Math.min(minY, positions[i+1]); maxY = Math.max(maxY, positions[i+1]);
      minZ = Math.min(minZ, positions[i+2]); maxZ = Math.max(maxZ, positions[i+2]);
    }
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, cz = (minZ + maxZ) / 2;
    const maxRange = Math.max(maxX - minX, maxY - minY, maxZ - minZ) || 1;
    const scale = (Math.min(w, h) * 0.4) / maxRange;

    // Rotation
    const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
    const cosY = Math.cos(rotY), sinY = Math.sin(rotY);

    function project(x, y, z) {
      x -= cx; y -= cy; z -= cz;
      const x1 = x * cosY - z * sinY;
      const z1 = x * sinY + z * cosY;
      const y1 = y * cosX - z1 * sinX;
      const z2 = y * sinX + z1 * cosX;
      const depth = 3 + z2 / maxRange;
      const sx = w / 2 + x1 * scale;
      const sy = h / 2 - y1 * scale;
      return { sx, sy, depth };
    }

    // Draw triangles
    if (wireframe) {
      ctx.strokeStyle = 'rgba(0, 212, 255, 0.35)';
      ctx.lineWidth = 0.5;
      for (let i = 0; i < indices.length; i += 3) {
        const i0 = indices[i] * 3, i1 = indices[i+1] * 3, i2 = indices[i+2] * 3;
        if (i0 + 2 >= positions.length || i1 + 2 >= positions.length || i2 + 2 >= positions.length) continue;
        const p0 = project(positions[i0], positions[i0+1], positions[i0+2]);
        const p1 = project(positions[i1], positions[i1+1], positions[i1+2]);
        const p2 = project(positions[i2], positions[i2+1], positions[i2+2]);
        ctx.beginPath();
        ctx.moveTo(p0.sx, p0.sy);
        ctx.lineTo(p1.sx, p1.sy);
        ctx.lineTo(p2.sx, p2.sy);
        ctx.closePath();
        ctx.stroke();
      }
    } else {
      // Solid shading
      const tris = [];
      for (let i = 0; i < indices.length; i += 3) {
        const i0 = indices[i] * 3, i1 = indices[i+1] * 3, i2 = indices[i+2] * 3;
        if (i0 + 2 >= positions.length || i1 + 2 >= positions.length || i2 + 2 >= positions.length) continue;
        const p0 = project(positions[i0], positions[i0+1], positions[i0+2]);
        const p1 = project(positions[i1], positions[i1+1], positions[i1+2]);
        const p2 = project(positions[i2], positions[i2+1], positions[i2+2]);
        const avgDepth = (p0.depth + p1.depth + p2.depth) / 3;
        tris.push({ p0, p1, p2, depth: avgDepth });
      }
      tris.sort((a, b) => a.depth - b.depth);
      for (const { p0, p1, p2, depth } of tris) {
        const brightness = Math.min(1, Math.max(0.2, depth / 4));
        const c = Math.round(brightness * 80);
        ctx.fillStyle = `rgb(${c}, ${c + 30}, ${c + 60})`;
        ctx.beginPath();
        ctx.moveTo(p0.sx, p0.sy); ctx.lineTo(p1.sx, p1.sy); ctx.lineTo(p2.sx, p2.sy);
        ctx.closePath(); ctx.fill();
      }
    }

    // Draw axes
    const axisLen = maxRange * 0.3;
    const ox = project(0, 0, 0);
    for (const [ax, color] of [[project(axisLen, 0, 0), '#ff3344'], [project(0, axisLen, 0), '#33ff44'], [project(0, 0, axisLen), '#3388ff']]) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(ox.sx, ox.sy); ctx.lineTo(ax.sx, ax.sy); ctx.stroke();
    }
  }, [positions, indices, rotX, rotY, wireframe]);

  const onMouseDown = (e) => { dragRef.current = { x: e.clientX, y: e.clientY, rx: rotX, ry: rotY }; };
  const onMouseMove = (e) => {
    if (!dragRef.current) return;
    setRotY(dragRef.current.ry + (e.clientX - dragRef.current.x) * 0.01);
    setRotX(dragRef.current.rx + (e.clientY - dragRef.current.y) * 0.01);
  };
  const onMouseUp = () => { dragRef.current = null; };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-3 py-2 border-b border-hull-600/40 bg-hull-800/80 shrink-0">
        <span className="text-lg">🔷</span>
        <span className="text-[11px] font-display uppercase tracking-[0.15em] text-plasma-400 font-semibold">3D Preview</span>
        <span className="text-[11px] text-hull-300">{vertCount.toLocaleString()} verts · {triCount.toLocaleString()} tris</span>
        <button onClick={() => setWireframe(w => !w)} className="ml-auto text-[11px] text-hull-300 hover:text-hull-100 font-display tracking-wide">
          {wireframe ? 'Solid' : 'Wireframe'}
        </button>
        <button onClick={() => { setRotX(-0.4); setRotY(0.6); }} className="text-hull-400 hover:text-hull-100"><RotateCcw size={12} /></button>
      </div>
      <div className="flex-1 flex items-center justify-center bg-hull-950 cursor-grab active:cursor-grabbing"
        onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>
        <canvas ref={canvasRef} width={700} height={600} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   CRC TOOL
   ═══════════════════════════════════════════════════════════ */
function CRCTool() {
  const [input, setInput] = useState('');
  const result = useMemo(() => {
    if (!input) return null;
    return { crc: crc32(input), crcLower: crc32Lower(input) };
  }, [input]);
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2 text-[11px] font-display uppercase tracking-wider text-plasma-400 font-semibold">
        <Zap size={14} /> CRC Calculator
      </div>
      <input type="text" value={input} onChange={e => setInput(e.target.value)} placeholder="Enter string to hash…"
        className="w-full max-w-md px-3 py-2 bg-hull-900 border border-hull-600/50 text-hull-100 text-sm rounded font-mono placeholder:text-hull-500 focus:outline-none focus:border-plasma-500/50" />
      {result && (
        <div className="space-y-1 text-xs font-mono">
          <div className="text-hull-300">CRC32: <span className="text-hull-100">0x{(result.crc >>> 0).toString(16).padStart(8, '0')}</span> <span className="text-hull-400">({result.crc >>> 0})</span></div>
          <div className="text-hull-300">CRC32 (lowered): <span className="text-hull-100">0x{(result.crcLower >>> 0).toString(16).padStart(8, '0')}</span></div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   CONTENT SEARCH — search across entire repository
   ═══════════════════════════════════════════════════════════ */
function ContentSearchPanel({ treArchives, treBuffers, onOpenResult }) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('filename');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(0);
  const abortRef = useRef(null);

  const doSearch = async () => {
    if (!query.trim()) return;
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setSearching(true); setResults([]); setSearched(0);
    try {
      const { results: r, searched: s } = await searchRepository(
        treArchives, treBuffers, query.trim(), mode,
        (count) => setSearched(count), controller.signal
      );
      setResults(r);
      setSearched(s);
    } catch {}
    setSearching(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-hull-600/40 bg-hull-800/80 space-y-2 shrink-0">
        <div className="flex items-center gap-2">
          <FileSearch size={14} className="text-plasma-400" />
          <span className="text-[11px] font-display uppercase tracking-[0.15em] text-plasma-400 font-semibold">Content Search</span>
        </div>
        <div className="flex gap-1.5">
          <input type="text" value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doSearch()}
            placeholder="Search query…"
            className="flex-1 px-2 py-1.5 bg-hull-900 border border-hull-600/50 text-hull-100 text-xs rounded font-mono placeholder:text-hull-500 focus:outline-none focus:border-plasma-500/50" />
          <button onClick={doSearch} disabled={searching}
            className="px-3 py-1 text-xs font-display rounded border border-plasma-500/40 text-plasma-400 hover:bg-plasma-500/10 disabled:opacity-50">
            {searching ? 'Searching…' : 'Search'}
          </button>
        </div>
        <div className="flex gap-1">
          {[['filename', 'Filename'], ['content_text', 'Text Content'], ['content_hex', 'Hex Pattern'], ['crc', 'CRC']].map(([m, label]) => (
            <button key={m} onClick={() => setMode(m)}
              className={`px-2 py-0.5 text-[10px] rounded font-display tracking-wide ${mode === m ? 'bg-plasma-500/20 text-plasma-400' : 'text-hull-400 hover:text-hull-200'}`}>
              {label}
            </button>
          ))}
        </div>
        {(searching || results.length > 0) && (
          <div className="text-[10px] text-hull-400">
            {searching ? `Searched ${searched.toLocaleString()} files…` : `${results.length} results (${searched.toLocaleString()} files searched)`}
          </div>
        )}
      </div>
      <div className="flex-1 overflow-auto">
        {results.map((r, i) => (
          <button key={i} onClick={() => onOpenResult(r)}
            className="w-full text-left px-3 py-1 text-xs hover:bg-hull-700/40 border-b border-hull-700/20 flex items-center gap-2 text-hull-200">
            <span className="text-[11px]">{getFileIcon(r.name)}</span>
            <span className="flex-1 truncate">{r.name}</span>
            <span className="text-[9px] text-hull-400 bg-hull-700/60 px-1 rounded">{r.sourceTRE}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   DIFF VIEWER — side-by-side comparison
   ═══════════════════════════════════════════════════════════ */
function DiffViewer({ tabs, onSelectTabs }) {
  const [tabA, setTabA] = useState(null);
  const [tabB, setTabB] = useState(null);

  const diff = useMemo(() => {
    if (!tabA || !tabB) return null;
    const dataA = tabs.find(t => t.id === tabA)?.data;
    const dataB = tabs.find(t => t.id === tabB)?.data;
    if (!dataA || !dataB) return null;
    return computeDiff(dataA, dataB);
  }, [tabA, tabB, tabs]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-hull-600/40 bg-hull-800/80 space-y-2 shrink-0">
        <div className="flex items-center gap-2">
          <GitCompare size={14} className="text-laser-yellow" />
          <span className="text-[11px] font-display uppercase tracking-[0.15em] text-laser-yellow font-semibold">File Diff</span>
        </div>
        <div className="flex gap-2 text-xs">
          <select value={tabA || ''} onChange={e => setTabA(e.target.value || null)}
            className="flex-1 px-2 py-1 bg-hull-900 border border-hull-600/50 text-hull-100 rounded text-xs font-mono">
            <option value="">Select file A…</option>
            {tabs.map(t => <option key={t.id} value={t.id}>{t.name.split('/').pop()}</option>)}
          </select>
          <select value={tabB || ''} onChange={e => setTabB(e.target.value || null)}
            className="flex-1 px-2 py-1 bg-hull-900 border border-hull-600/50 text-hull-100 rounded text-xs font-mono">
            <option value="">Select file B…</option>
            {tabs.map(t => <option key={t.id} value={t.id}>{t.name.split('/').pop()}</option>)}
          </select>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {diff ? (
          diff.identical ? (
            <div className="p-6 text-center text-laser-green text-sm">Files are identical ({formatSize(diff.sizeA)})</div>
          ) : (
            <div className="text-xs font-mono">
              <div className="px-3 py-1.5 bg-hull-800/60 border-b border-hull-600/40 text-hull-300 sticky top-0 z-10">
                {diff.diffs.length.toLocaleString()} differences · A: {formatSize(diff.sizeA)} · B: {formatSize(diff.sizeB)}
              </div>
              {diff.diffs.slice(0, 500).map((d, i) => (
                <div key={i} className="grid grid-cols-[70px_60px_60px] px-3 py-px border-b border-hull-700/15 hover:bg-hull-700/30">
                  <span className="text-hull-400">{d.offset.toString(16).padStart(8, '0')}</span>
                  <span className={d.a >= 0 ? 'text-laser-red' : 'text-hull-600'}>{d.a >= 0 ? d.a.toString(16).padStart(2, '0') : '--'}</span>
                  <span className={d.b >= 0 ? 'text-laser-green' : 'text-hull-600'}>{d.b >= 0 ? d.b.toString(16).padStart(2, '0') : '--'}</span>
                </div>
              ))}
              {diff.diffs.length > 500 && <div className="px-3 py-2 text-hull-400 italic">Showing first 500 of {diff.diffs.length.toLocaleString()} differences…</div>}
            </div>
          )
        ) : (
          <div className="p-6 text-center text-hull-500 text-sm">Select two open files to compare</div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN SIE EDITOR
   ═══════════════════════════════════════════════════════════ */
export default function SIEEditor() {
  const [treArchives, setTreArchives] = useState([]);
  const [treHandles, setTreHandles] = useState({});
  const [treBuffers, setTreBuffers] = useState({});
  const [fileTree, setFileTree] = useState(null);
  const [totalFiles, setTotalFiles] = useState(0);
  const [openTabs, setOpenTabs] = useState([]);
  const [activeTab, setActiveTab] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [loadingSub, setLoadingSub] = useState('');
  const [loadingProgress, setLoadingProgress] = useState(null);
  const [selectedIFFNode, setSelectedIFFNode] = useState(null);
  const [selectedIFFNodeData, setSelectedIFFNodeData] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusMsg, setStatusMsg] = useState('Ready');
  const [sidebarView, setSidebarView] = useState('files');
  const [cfgLoaded, setCfgLoaded] = useState(false);
  const [lazyMode, setLazyMode] = useState(false);
  const [bookmarks, setBookmarks] = useState(new Set());
  const [recentFiles, setRecentFiles] = useState([]);
  const [rightPanel, setRightPanel] = useState(null); // 'crc' | 'search' | 'diff'
  const [selectedFolderPath, setSelectedFolderPath] = useState(null);
  const [selectedFolderNode, setSelectedFolderNode] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  const activeTabData = openTabs.find(t => t.id === activeTab);

  const toggleBookmark = useCallback((name) => {
    setBookmarks(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }, []);

  const addRecent = useCallback((name) => {
    setRecentFiles(prev => {
      const next = prev.filter(n => n !== name);
      next.unshift(name);
      return next.slice(0, 20);
    });
  }, []);

  const handleSelectFolder = useCallback((path, node) => {
    setSelectedFolderPath(path);
    setSelectedFolderNode(node);
    setSelectedFile(null);
  }, []);

  /* ── Open directory (lazy mode) ── */
  const handleOpenDirectory = useCallback(async () => {
    if (!('showDirectoryPicker' in window)) { alert('Use Chrome, Edge, or Opera for directory support.'); return; }
    try {
      const dirHandle = await window.showDirectoryPicker({ mode: 'read' });
      setLoading(true); setLoadingProgress(0); setLoadingMsg('Scanning SWG directory…'); setLoadingSub('');

      const { orderedHandles, cfgFound, treCount } = await scanDirectory(dirHandle, msg => setLoadingSub(msg));
      if (!treCount) { setLoading(false); setStatusMsg('No .TRE files found'); return; }

      setCfgLoaded(cfgFound);
      setLoadingMsg('Loading ' + treCount + ' TRE archives…');

      const archives = [], handles = {}, allRecordSets = [];
      for (let i = 0; i < orderedHandles.length; i++) {
        const h = orderedHandles[i];
        setLoadingSub('Parsing ' + h.name + ' (' + (i + 1) + '/' + treCount + ')');
        setLoadingProgress(i / treCount);
        try {
          const tre = await parseTRELazy(h.handle, h.name);
          archives.push({ name: h.name, numFiles: tre.numFiles, version: tre.version, fileSize: tre.fileSize, records: tre.records });
          handles[h.name] = tre.fileHandle;
          allRecordSets.push(tre.records);
        } catch (e) { console.warn('Failed: ' + h.name, e); }
      }

      setLoadingSub('Building unified file tree…'); setLoadingProgress(0.95);
      const merged = mergeRecords(allRecordSets);
      const tree = buildFileTree(merged);

      setTreArchives(archives); setTreHandles(handles); setTreBuffers({});
      setFileTree(tree); setTotalFiles(merged.length); setLazyMode(true);
      const firstDir = Object.keys(tree.children)[0];
      if (firstDir) { setSelectedFolderPath(firstDir); setSelectedFolderNode(tree.children[firstDir]); setSelectedFile(null); }
      setStatusMsg(archives.length + ' TREs · ' + merged.length.toLocaleString() + ' files (lazy)' + (cfgFound ? ' · config detected' : ''));
      setLoading(false); setLoadingProgress(null);
    } catch (e) {
      if (e.name !== 'AbortError') { setStatusMsg('Error: ' + e.message); console.error(e); }
      setLoading(false); setLoadingProgress(null);
    }
  }, []);

  /* ── Open single file ── */
  const handleOpenFile = useCallback(async (file) => {
    setLoading(true); setLoadingMsg('Reading ' + file.name + '…'); setLoadingProgress(null); setLoadingSub('');
    try {
      const buffer = await file.arrayBuffer();
      const ext = getFileExt(file.name);
      if (ext === 'tre') {
        const tre = await parseTRE(buffer, file.name);
        setTreArchives([{ name: file.name, numFiles: tre.numFiles, version: tre.version, records: tre.records }]);
        setTreBuffers({ [file.name]: buffer }); setTreHandles({}); setLazyMode(false);
        const tree = buildFileTree(tre.records);
        setFileTree(tree); setTotalFiles(tre.numFiles);
        const firstDir = Object.keys(tree.children)[0];
        if (firstDir) { setSelectedFolderPath(firstDir); setSelectedFolderNode(tree.children[firstDir]); setSelectedFile(null); }
        setStatusMsg(file.name + ': ' + tre.numFiles.toLocaleString() + ' files');
      } else {
        openFileTab(file.name, new Uint8Array(buffer), ext);
      }
    } catch (e) { setStatusMsg('Error: ' + e.message); }
    setLoading(false); setLoadingProgress(null);
  }, []);

  /* ── Open file as tab ── */
  const openFileTab = useCallback((name, data, ext) => {
    const id = name + '_' + Date.now();
    let parsed = null, type = 'hex';

    // IFF detection
    if (ext === 'iff' || ext === 'msh' || ext === 'sat' || ext === 'apt' || ext === 'cdf' || ext === 'prt' || ext === 'sht' || ext === 'lod' || ext === 'mgn' || ext === 'trn' || ext === 'ws' || ext === 'pal' || ext === 'cef' ||
        (data.length >= 4 && String.fromCharCode(data[0], data[1], data[2], data[3]) === 'FORM')) {
      try {
        const iff = parseIFF(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
        parsed = { iff };
        type = 'iff';

        // Datatable
        if (iff.type?.startsWith('DT')) {
          const dt = parseDatatable(iff);
          if (dt?.columns?.length) { parsed.datatable = dt; type = 'datatable'; }
        }
        // Palette
        if (iff.type?.trim() === 'PAL' || ext === 'pal') {
          const pal = parsePAL(iff);
          if (pal?.colors?.length) { parsed.palette = pal; type = 'palette'; }
        }
        // Mesh
        if (iff.type?.trim() === 'MESH' || ext === 'msh') {
          const mesh = parseMesh(iff);
          if (mesh.positions.length > 0) { parsed.mesh = mesh; type = 'mesh'; }
        }
        // World Snapshot
        if (iff.type?.trim() === 'WSNP' || ext === 'ws') {
          const ws = parseWorldSnapshot(iff);
          if (ws.objects.length > 0) { parsed.ws = ws; type = 'ws'; }
        }
      } catch (e) { console.warn('IFF parse failed:', e); }
    }

    // STF
    if (ext === 'stf') {
      try {
        const stf = parseSTF(data);
        if (stf?.entries?.length) { parsed = { stf }; type = 'stf'; }
      } catch {}
    }

    // Audio
    if (ext === 'wav' || ext === 'mp3' || ext === 'snd') {
      type = 'audio';
    }

    setOpenTabs(tabs => [...tabs, { id, name, data, ext, parsed, type }]);
    setActiveTab(id);
    addRecent(name);
    setStatusMsg('Opened ' + name + ' (' + formatSize(data.length) + ') · ' + type);
  }, [addRecent]);

  /* ── Extract from TRE (lazy or buffered) ── */
  const handleTREFileClick = useCallback(async (record) => {
    setLoading(true); setLoadingMsg('Extracting ' + record.shortName + '…'); setLoadingProgress(null); setLoadingSub(record.sourceTRE || '');
    try {
      let data;
      if (lazyMode && treHandles[record.sourceTRE]) {
        data = await extractTREFileLazy(treHandles[record.sourceTRE], record);
      } else {
        const buf = treBuffers[record.sourceTRE] || (treArchives.length === 1 && treArchives[0].records ? null : null);
        if (!buf) { setStatusMsg('Source TRE not found: ' + record.sourceTRE); setLoading(false); return; }
        data = await extractTREFile(buf, record);
      }
      openFileTab(record.name, data, getFileExt(record.shortName));
    } catch (e) { setStatusMsg('Extract error: ' + e.message); console.error(e); }
    setLoading(false);
  }, [treHandles, treBuffers, treArchives, lazyMode, openFileTab]);

  const closeTab = useCallback((id) => {
    setOpenTabs(tabs => {
      const next = tabs.filter(t => t.id !== id);
      if (activeTab === id) setActiveTab(next.length ? next[next.length - 1].id : null);
      return next;
    });
  }, [activeTab]);

  const handleExport = useCallback(() => {
    if (!activeTabData) return;
    const blob = new Blob([activeTabData.data], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = activeTabData.name.split('/').pop(); a.click();
    URL.revokeObjectURL(url);
    setStatusMsg('Exported ' + activeTabData.name);
  }, [activeTabData]);

  const handleSaveIFF = useCallback(() => {
    if (!activeTabData?.parsed?.iff) return;
    try {
      const data = writeIFF(activeTabData.parsed.iff);
      const blob = new Blob([data], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = activeTabData.name.split('/').pop(); a.click();
      URL.revokeObjectURL(url);
      setStatusMsg('Saved IFF: ' + activeTabData.name);
    } catch (e) { setStatusMsg('Save error: ' + e.message); }
  }, [activeTabData]);

  /* ── Content search result handler ── */
  const handleSearchResult = useCallback(async (result) => {
    if (result.record) {
      await handleTREFileClick({ ...result.record, shortName: result.name.split('/').pop() });
    }
  }, [handleTREFileClick]);

  /* ── Render editor ── */
  const renderEditor = () => {
    if (!activeTabData) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-5 p-10">
          <div className="text-4xl font-display font-bold text-plasma-400 tracking-[0.2em]">SIE</div>
          <p className="text-hull-300 text-xs font-display tracking-[0.2em] uppercase">SWG Interchange Editor</p>
          <button onClick={handleOpenDirectory}
            className="mt-4 px-8 py-3 rounded-lg text-sm font-display font-bold tracking-wider uppercase bg-gradient-to-r from-plasma-500 to-plasma-400 text-hull-900 shadow-plasma hover:shadow-glow transition-shadow">
            <FolderOpen size={16} className="inline mr-2 -mt-0.5" /> Open SWG Directory
          </button>
          <p className="text-hull-400 text-[11px]">
            {'showDirectoryPicker' in window ? 'Select your SWG install — all TREs load automatically (lazy mode, low memory)' : 'Use Chrome/Edge/Opera'}
          </p>
          <div className="flex items-center gap-4 w-80 my-2">
            <div className="flex-1 h-px bg-hull-600/40" />
            <span className="text-[10px] text-hull-400 font-display tracking-widest uppercase">or open file</span>
            <div className="flex-1 h-px bg-hull-600/40" />
          </div>
          <div className="grid grid-cols-4 gap-2.5 max-w-md w-full">
            {[{ label: '.TRE', icon: Archive, accept: '.tre' }, { label: '.IFF', icon: Layers, accept: '.iff' }, { label: '.STF', icon: FileText, accept: '.stf' }, { label: 'Any', icon: File, accept: '' }].map((item, i) => (
              <label key={i} className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-hull-600/40 bg-hull-800/60 cursor-pointer hover:border-plasma-500/40 hover:bg-hull-700/60 transition-colors">
                <item.icon size={18} className="text-hull-300" />
                <span className="text-xs font-display font-semibold text-hull-100">{item.label}</span>
                <input type="file" accept={item.accept} className="hidden" onChange={e => e.target.files[0] && handleOpenFile(e.target.files[0])} />
              </label>
            ))}
          </div>
          <div className="mt-4 p-3 rounded-xl border border-hull-600/30 bg-hull-800/40 max-w-md w-full text-[11px] text-hull-300 leading-relaxed">
            <span className="text-plasma-400 font-semibold">Features: </span>
            Struct templates with auto-GUI, datatable editor, string table editor, palette editor, audio player,
            world snapshot 2D map, 3D mesh wireframe preview, CRC calculator, content search across all TREs,
            file diff tool, bookmarks, lazy loading for low memory.
          </div>
        </div>
      );
    }

    const { type, parsed, data } = activeTabData;
    if (type === 'datatable' && parsed?.datatable) return <DatatableEditor datatable={parsed.datatable} />;
    if (type === 'stf' && parsed?.stf) return <STFEditor stfData={parsed.stf} />;
    if (type === 'palette' && parsed?.palette) return <PALEditor palData={parsed.palette} />;
    if (type === 'mesh' && parsed?.mesh) return <MeshPreview meshData={parsed.mesh} />;
    if (type === 'ws' && parsed?.ws) return <WSViewer wsData={parsed.ws} />;
    if (type === 'audio') return <SNDEditor data={data} />;

    if ((type === 'iff' || parsed?.iff) && parsed?.iff) {
      const iffNode = parsed.iff;
      // Build ancestor path for struct templates
      let parentFormType = iffNode.type || '';

      return (
        <div className="flex h-full">
          <div className="w-72 border-r border-hull-600/40 overflow-auto shrink-0">
            <div className="px-3 py-1.5 border-b border-hull-600/40 text-[10px] font-display uppercase tracking-[0.15em] text-hull-400 font-semibold bg-hull-800/80 flex items-center gap-2">
              IFF Structure
              {iffNode.type && <Pill className="bg-plasma-500/15 text-plasma-400">{iffNode.type.trim()}</Pill>}
              {FORM_DESCRIPTIONS[iffNode.type?.trim()] && <span className="text-hull-500 text-[9px]">{FORM_DESCRIPTIONS[iffNode.type?.trim()]}</span>}
            </div>
            <IFFTreeView node={iffNode} selectedNode={selectedIFFNode}
              onSelectNode={(id, node) => { setSelectedIFFNode(id); setSelectedIFFNodeData(node); }} />
          </div>
          <div className="flex-1 overflow-auto">
            {selectedIFFNodeData?.data ? (
              <div>
                <div className="flex items-center gap-4 px-3 py-2 border-b border-hull-600/40 bg-hull-800/80">
                  <span className="font-mono font-bold text-xs text-shield-blue">{selectedIFFNodeData.tag}</span>
                  <span className="text-[11px] text-hull-400">{selectedIFFNodeData.data.length} bytes</span>
                  <span className="text-[11px] text-hull-400">0x{(selectedIFFNodeData.offset || 0).toString(16)}</span>
                </div>
                <StructEditor node={selectedIFFNodeData} parentFormType={parentFormType} />
                <HexViewer data={selectedIFFNodeData.data} />
              </div>
            ) : selectedIFFNodeData?.tag === 'FORM' ? (
              <div className="p-4 space-y-2">
                <div className="text-sm font-display text-plasma-400 font-semibold">
                  FORM {selectedIFFNodeData.type?.trim()}
                  {FORM_DESCRIPTIONS[selectedIFFNodeData.type?.trim()] && <span className="text-hull-300 font-normal ml-2">— {FORM_DESCRIPTIONS[selectedIFFNodeData.type?.trim()]}</span>}
                </div>
                <div className="text-xs text-hull-400">{selectedIFFNodeData.children?.length || 0} children · {selectedIFFNodeData.size} bytes total</div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-hull-500 text-sm gap-2">
                <Layers size={28} className="opacity-30" /> Select a chunk to inspect
              </div>
            )}
          </div>
        </div>
      );
    }

    return <HexViewer data={data} />;
  };

  return (
    <div className="flex flex-col bg-hull-900 text-hull-100 font-mono text-[13px]" style={{ height: 'calc(100vh - 4rem)' }}>
      {/* Loading */}
      {loading && (
        <div className="fixed inset-0 z-50 bg-hull-950/80 flex flex-col items-center justify-center gap-4">
          <div className="w-10 h-10 border-2 border-hull-600 border-t-plasma-400 rounded-full animate-spin" />
          <p className="text-plasma-400 font-display font-semibold text-sm tracking-wider">{loadingMsg}</p>
          {loadingSub && <p className="text-hull-300 text-xs">{loadingSub}</p>}
          {loadingProgress != null && (
            <div className="w-72 flex flex-col items-center gap-1.5">
              <div className="w-full h-1 bg-hull-700 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-plasma-500 to-plasma-300 rounded-full transition-all duration-300" style={{ width: (loadingProgress * 100) + '%' }} />
              </div>
              <span className="text-hull-400 text-[11px] tabular-nums">{Math.round(loadingProgress * 100)}%</span>
            </div>
          )}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-hull-600/40 bg-hull-800/60 shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-display font-bold tracking-[0.15em] text-plasma-400">SIE</span>
          <span className="text-[10px] font-display tracking-[0.1em] text-hull-400 uppercase hidden sm:inline">Interchange Editor</span>
          {treArchives.length > 0 && (
            <span className="ml-2 text-[11px] text-hull-300 font-mono">
              {treArchives.length} TREs · {totalFiles.toLocaleString()} files
              {lazyMode && <Pill className="bg-laser-green/20 text-laser-green ml-1">lazy</Pill>}
              {cfgLoaded && <span className="text-laser-green ml-1" title="Config detected">●</span>}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setRightPanel(r => r === 'search' ? null : 'search')} title="Content Search"
            className={`p-1.5 rounded transition-colors ${rightPanel === 'search' ? 'bg-plasma-500/20 text-plasma-400' : 'text-hull-400 hover:text-hull-200'}`}>
            <FileSearch size={14} />
          </button>
          <button onClick={() => setRightPanel(r => r === 'diff' ? null : 'diff')} title="Diff Tool"
            className={`p-1.5 rounded transition-colors ${rightPanel === 'diff' ? 'bg-plasma-500/20 text-plasma-400' : 'text-hull-400 hover:text-hull-200'}`}>
            <GitCompare size={14} />
          </button>
          <button onClick={() => setRightPanel(r => r === 'crc' ? null : 'crc')} title="CRC Calculator"
            className={`p-1.5 rounded transition-colors ${rightPanel === 'crc' ? 'bg-plasma-500/20 text-plasma-400' : 'text-hull-400 hover:text-hull-200'}`}>
            <Zap size={14} />
          </button>
          <div className="w-px h-5 bg-hull-600/40 mx-1" />
          <button onClick={handleOpenDirectory} className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded border border-hull-600/50 text-hull-200 hover:bg-hull-700/50 hover:text-hull-50 transition-colors font-display tracking-wide">
            <FolderOpen size={12} /> Directory
          </button>
          <label className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded border border-plasma-500/40 text-plasma-400 hover:bg-plasma-500/10 transition-colors cursor-pointer font-display tracking-wide">
            <Upload size={12} /> File
            <input type="file" className="hidden" onChange={e => e.target.files[0] && handleOpenFile(e.target.files[0])} />
          </label>
          {activeTabData && (
            <>
              <button onClick={handleExport} className="flex items-center gap-1 px-2 py-1 text-[11px] rounded border border-hull-600/50 text-hull-200 hover:bg-hull-700/50 transition-colors font-display">
                <Download size={11} /> Export
              </button>
              {activeTabData.parsed?.iff && (
                <button onClick={handleSaveIFF} className="flex items-center gap-1 px-2 py-1 text-[11px] rounded border border-laser-green/40 text-laser-green hover:bg-laser-green/10 transition-colors font-display">
                  <Save size={11} /> Save IFF
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Folder tree (left) */}
        {fileTree && (
          <div className="w-56 border-r border-hull-600/40 bg-hull-800/40 flex flex-col shrink-0">
            <div className="px-3 py-1 text-[10px] font-display uppercase tracking-[0.15em] text-hull-400 border-b border-hull-600/40 shrink-0 flex items-center justify-between">
              <span>Directories</span>
              <span className="text-hull-600">{Object.keys(fileTree.children).length}</span>
            </div>
            <div className="flex-1 overflow-auto py-0.5">
              {Object.keys(fileTree.children).sort().map(d => (
                <FolderTreeNode key={d} name={d} node={fileTree.children[d]} depth={0}
                  selectedPath={selectedFolderPath} currentPath={d} onSelect={handleSelectFolder} />
              ))}
            </div>
          </div>
        )}

        {/* File list (center) */}
        {fileTree && (
          <div className="w-80 border-r border-hull-600/40 bg-hull-800/20 flex flex-col shrink-0 overflow-hidden">
            <FileListPanel node={selectedFolderNode} onFileClick={handleTREFileClick}
              treArchives={treArchives} selectedFile={selectedFile} onSelectFile={setSelectedFile} />
          </div>
        )}

        {/* Editor */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {openTabs.length > 0 && (
            <div className="flex border-b border-hull-600/40 bg-hull-800/40 overflow-x-auto shrink-0">
              {openTabs.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border-r border-hull-600/30 whitespace-nowrap shrink-0 ${tab.id === activeTab ? 'text-plasma-400 bg-hull-900 border-b-2 border-b-plasma-500' : 'text-hull-300 hover:bg-hull-700/40 border-b-2 border-b-transparent'}`}>
                  <span className="text-[10px]">{getFileIcon(tab.name)}</span>
                  {tab.name.split('/').pop()}
                  <span onClick={e => { e.stopPropagation(); closeTab(tab.id); }} className="opacity-40 hover:opacity-100 ml-0.5"><X size={11} /></span>
                </button>
              ))}
            </div>
          )}
          <div className="flex-1 overflow-auto">{renderEditor()}</div>
        </div>

        {/* Right panel */}
        {rightPanel && (
          <div className="w-80 min-w-[280px] border-l border-hull-600/40 flex flex-col bg-hull-800/40 shrink-0">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-hull-600/40 shrink-0">
              <span className="text-[10px] font-display uppercase tracking-wider text-hull-400">
                {rightPanel === 'crc' && 'CRC Calculator'}
                {rightPanel === 'search' && 'Content Search'}
                {rightPanel === 'diff' && 'File Diff'}
              </span>
              <button onClick={() => setRightPanel(null)} className="text-hull-500 hover:text-hull-100"><X size={12} /></button>
            </div>
            <div className="flex-1 overflow-auto">
              {rightPanel === 'crc' && <CRCTool />}
              {rightPanel === 'search' && <ContentSearchPanel treArchives={treArchives} treBuffers={treBuffers} onOpenResult={handleSearchResult} />}
              {rightPanel === 'diff' && <DiffViewer tabs={openTabs} />}
            </div>
          </div>
        )}
      </div>

      {/* Status */}
      <div className="flex items-center justify-between px-3 py-0.5 border-t border-hull-600/40 bg-hull-800/40 text-[10px] text-hull-400 shrink-0 font-mono">
        <span className="truncate">{statusMsg}</span>
        <div className="flex gap-4 shrink-0">
          {activeTabData && (<><span>{activeTabData.type.toUpperCase()}</span><span>{formatSize(activeTabData.data.length)}</span></>)}
          {activeTabData?.parsed?.iff?.type && <span>IFF: {activeTabData.parsed.iff.type.trim()}</span>}
        </div>
      </div>
    </div>
  );
}
