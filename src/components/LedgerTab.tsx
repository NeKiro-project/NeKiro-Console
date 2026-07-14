import React, { useState } from 'react';
import { BookOpen, Search, Filter, Download, ArrowRight, ChevronDown, ChevronRight, Compass, RefreshCw, Database, GitBranch, UploadCloud, Cpu, Link2Off, AlertTriangle, Maximize2 } from 'lucide-react';
import { TRACE_HISTORIES, TraceHistory } from '../data';
import { TraceNode, LedgerEvent } from '../types';

export default function LedgerTab() {
  const [selectedTraceId, setSelectedTraceId] = useState<string>('trace-1');
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    'r1': true,
    'n1': true,
    'n2': true,
    'r2': true,
    't2': true
  });

  const activeTrace = TRACE_HISTORIES.find(t => t.id === selectedTraceId) || TRACE_HISTORIES[0];

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const getIcon = (name: string, status?: string) => {
    const isError = status === 'ERROR' || status === 'TIMEOUT';
    if (isError) return <Link2Off size={14} className="text-brand-error" />;

    const lower = name.toLowerCase();
    if (lower.includes('entrypoint')) return <Compass size={14} className="text-brand-primary" />;
    if (lower.includes('verify') || lower.includes('auth')) return <RefreshCw size={14} className="text-brand-tertiary" />;
    if (lower.includes('db') || lower.includes('query')) return <Database size={14} className="text-brand-on-surface-variant" />;
    if (lower.includes('spawn') || lower.includes('processor')) return <GitBranch size={14} className="text-brand-primary" />;
    if (lower.includes('fetch') || lower.includes('s3')) return <UploadCloud size={14} className="text-brand-secondary" />;
    return <Cpu size={14} className="text-brand-secondary" />;
  };

  // Helper to render hierarchical tree nodes recursively
  const renderTreeNode = (node: TraceNode, isLast: boolean = false, depth: number = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes[node.id] !== false;
    const statusColor = node.status === 'TIMEOUT' || node.status === 'ERROR' 
      ? 'text-brand-error bg-brand-error-container/10 border-brand-error/20' 
      : 'hover:bg-brand-container/50';

    return (
      <div key={node.id} className="relative font-mono-code text-[12.5px] mt-1 select-none">
        {/* Node label box */}
        <div 
          onClick={() => hasChildren && toggleNode(node.id)}
          className={`flex items-center py-1 px-2 rounded cursor-pointer transition-all relative ${statusColor}`}
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
        >
          {/* Guide Line Indicators */}
          {depth > 0 && (
            <span 
              className="absolute h-px bg-brand-outline-variant/50" 
              style={{ 
                left: `${(depth - 1) * 20 + 16}px`, 
                width: '12px',
                top: '50%'
              }} 
            />
          )}

          {/* Collapse/Expand chevron */}
          {hasChildren ? (
            <span className="text-brand-on-surface-variant mr-1">
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
          ) : (
            <span className="w-3.5 h-3.5 mr-1" />
          )}

          {/* Custom Node Icons */}
          <span className="mr-2">
            {getIcon(node.name, node.status)}
          </span>

          {/* Node name & duration labels */}
          <span className={`font-semibold mr-3 ${node.status === 'TIMEOUT' ? 'text-brand-error font-bold' : 'text-brand-on-surface'}`}>
            {node.name}
          </span>

          {node.duration && (
            <span className={`text-[10.5px] px-1.5 py-0.2 rounded font-mono-label ${
              node.status === 'TIMEOUT' ? 'text-brand-error bg-brand-error-container/20 font-semibold' : 'text-brand-on-surface-variant/70'
            }`}>
              [{node.duration}]
            </span>
          )}
        </div>

        {/* Children node list */}
        {hasChildren && isExpanded && (
          <div className="relative mt-0.5">
            {/* Parent-to-child vertical trace guide connector line */}
            <div 
              className="absolute bg-brand-outline-variant/30" 
              style={{ 
                left: `${depth * 20 + 16}px`, 
                top: '12px', 
                bottom: '12px', 
                width: '1px' 
              }} 
            />
            {node.children!.map((child, idx) => 
              renderTreeNode(child, idx === node.children!.length - 1, depth + 1)
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-48px)] bg-brand-bg select-none">
      {/* Observability Toolbar */}
      <div className="flex items-center justify-between px-6 py-2 border-b border-brand-outline-variant/40 bg-brand-container/40">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400"></span>
            <span className="font-label-caps text-[10px] text-brand-on-surface-variant font-semibold">
              Ledger Connected
            </span>
          </div>
          <div className="h-4 w-px bg-brand-outline-variant/30" />
          <span className="font-mono-code text-[11px] text-brand-on-surface-variant font-medium">
            Stream Status: active
          </span>
          <div className="h-4 w-px bg-brand-outline-variant/30" />
          
          {/* Active Trace Switcher selector dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono-label text-brand-on-surface-variant">ACTIVE TRACE:</span>
            <select
              value={selectedTraceId}
              onChange={(e) => setSelectedTraceId(e.target.value)}
              className="bg-brand-lowest border border-brand-outline-variant rounded text-brand-on-surface font-mono-code text-[10.5px] px-2 py-0.5 outline-none cursor-pointer focus:border-brand-primary"
            >
              {TRACE_HISTORIES.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.duration})</option>
              ))}
            </select>
          </div>
        </div>

        {/* Toolbar operations */}
        <div className="flex gap-2">
          <button 
            onClick={() => alert("Custom Filters panel opened.")}
            className="h-7 px-3 border border-brand-outline-variant/60 rounded flex items-center gap-1 text-brand-on-surface-variant hover:text-brand-on-surface hover:bg-brand-high transition-colors text-[10.5px] font-mono-label cursor-pointer"
          >
            <Filter size={11} />
            <span>Filters</span>
          </button>
          <button 
            onClick={() => alert(`Exporting log trace: ${activeTrace.rootId}.csv`)}
            className="h-7 px-3 border border-brand-outline-variant/60 rounded flex items-center gap-1 text-brand-on-surface-variant hover:text-brand-on-surface hover:bg-brand-high transition-colors text-[10.5px] font-mono-label cursor-pointer"
          >
            <Download size={11} />
            <span>Export Logs</span>
          </button>
        </div>
      </div>

      {/* Main content Area Split */}
      <div className="flex-1 flex overflow-hidden">
        {/* Trace View (Left Fluid Container) */}
        <div className="flex-1 bg-brand-bg p-6 overflow-y-auto">
          <div className="mb-4 flex items-center justify-between border-b border-brand-outline-variant/30 pb-3">
            <h2 className="font-headline-md text-sm text-brand-on-surface font-bold">
              Execution Trace Tree
            </h2>
            <span className="font-mono-code text-brand-on-surface-variant text-[11px] bg-brand-lowest px-2 py-0.5 border border-brand-outline-variant/50 rounded">
              root_id: {activeTrace.rootId}
            </span>
          </div>

          {/* Trace Tree Hierarchy */}
          <div className="bg-brand-lowest p-4 border border-brand-outline-variant rounded min-h-[300px]">
            {renderTreeNode(activeTrace.rootNode)}
          </div>
        </div>

        {/* Event Timeline Ledger (Right Inspector Sidebar) */}
        <div className="w-96 bg-brand-low border-l border-brand-outline-variant flex flex-col flex-shrink-0">
          <div className="px-4 py-3 border-b border-brand-outline-variant/40 bg-brand-container/40 flex items-center justify-between">
            <span className="font-label-caps text-[10px] text-brand-on-surface-variant tracking-wider font-bold">
              Event Ledger Timeline
            </span>
            <button 
              onClick={() => alert("Timeline expanded to full view.")}
              className="text-brand-on-surface-variant hover:text-brand-on-surface p-1 rounded hover:bg-brand-high"
            >
              <Maximize2 size={12} />
            </button>
          </div>

          {/* Timeline list container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-5 relative">
            {/* Vertical timeline guide bar connector */}
            <div className="absolute left-6 top-6 bottom-6 w-px bg-brand-outline-variant/30" />

            {activeTrace.events.map((ev, index) => {
              const isLast = index === activeTrace.events.length - 1;
              const hasBadge = !!ev.badgeText;
              const isError = ev.badgeType === 'error' || !!ev.errorBox;
              const isSuccess = ev.badgeType === 'success';

              let dotColor = 'bg-brand-outline';
              if (isError) dotColor = 'bg-brand-error shadow-[0_0_8px_rgba(255,180,171,0.5)]';
              else if (isSuccess) dotColor = 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]';
              else if (ev.title.includes('Auth')) dotColor = 'bg-brand-primary shadow-[0_0_8px_rgba(173,198,255,0.4)]';

              return (
                <div key={ev.id} className="flex gap-4 relative z-10">
                  {/* Timeline Dot Indicator */}
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div className={`w-2 h-2 rounded-full mt-1.5 ${dotColor}`} />
                  </div>

                  <div className="pb-1 w-full min-w-0">
                    <div className="flex items-baseline gap-2 mb-1 justify-between flex-wrap">
                      <span className="font-mono-code text-[10px] text-brand-on-surface-variant font-bold">
                        {ev.time}
                      </span>
                      {hasBadge && (
                        <span className={`font-mono-code text-[9px] border px-1 rounded-sm uppercase tracking-wide ${
                          isError 
                            ? 'text-brand-error border-brand-error/30 bg-brand-error-container/5' 
                            : 'text-brand-primary border-brand-primary/30 bg-brand-primary-container/5'
                        }`}>
                          {ev.badgeText}
                        </span>
                      )}
                    </div>

                    <h4 className={`text-xs font-bold leading-normal ${isError ? 'text-brand-error' : 'text-brand-on-surface'}`}>
                      {ev.title}
                    </h4>

                    {ev.subtitle && (
                      <p className="text-[10.5px] text-brand-on-surface-variant/80 mt-0.5 leading-normal">
                        {ev.subtitle}
                      </p>
                    )}

                    {/* Metadata properties details */}
                    {ev.details && ev.details.length > 0 && (
                      <div className="mt-1.5 flex flex-col gap-1">
                        {ev.details.map((det, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 text-[10.5px] font-mono-code text-brand-on-surface-variant">
                            <span className="text-[12px] text-brand-outline-variant">↳</span>
                            <span className="text-brand-outline/80">{det.label}:</span>
                            <span className="text-brand-secondary bg-brand-lowest px-1 py-0.2 rounded border border-brand-outline-variant/30 font-semibold">{det.value}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Custom Error container layout box */}
                    {ev.errorBox && (
                      <div className="mt-2.5 border border-brand-error/25 bg-brand-error-container/5 rounded p-2.5 font-mono-code text-[10.5px] leading-relaxed">
                        <div className="font-label-caps text-[8.5px] text-brand-error uppercase font-bold mb-1 tracking-wider">
                          {ev.errorBox.title}
                        </div>
                        <p className="text-brand-on-surface-variant mb-2 font-body-sm leading-normal">
                          {ev.errorBox.text}
                        </p>
                        <pre className="p-1.5 bg-brand-lowest text-brand-error rounded border border-brand-error/15 whitespace-pre-wrap truncate text-[10px]">
                          {ev.errorBox.code}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
