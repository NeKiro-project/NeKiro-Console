import React, { useState, useEffect } from 'react';
import { PlayCircle, AlertTriangle, Cpu, Terminal, CheckCircle2, RotateCw, Play, Trash2, Code, Zap, FileWarning, HelpCircle } from 'lucide-react';
import { Installation, LogChunk } from '../types';

interface InvocationsTabProps {
  installations: Installation[];
}

export default function InvocationsTab({ installations }: InvocationsTabProps) {
  // Select state
  const activeInstallations = installations.filter(i => i.state === 'ENABLED');
  const [selectedInstId, setSelectedInstId] = useState<string>(activeInstallations[0]?.id || installations[0]?.id || '');
  const [selectedCapability, setSelectedCapability] = useState('analyze_telemetry_stream');
  
  // Input parameters
  const [metricType, setMetricType] = useState('cpu_utilization');
  const [startTime, setStartTime] = useState('now-1h');
  const [endTime, setEndTime] = useState('now');
  const [includeAnomalies, setIncludeAnomalies] = useState(true);

  // Tab and execution modes
  const [inputTab, setInputTab] = useState<'form' | 'json'>('form');
  const [mode, setMode] = useState<'NORMAL' | 'STREAMING'>('STREAMING');

  // Logs stream states
  const [isExecuting, setIsExecuting] = useState(false);
  const [streamInterrupted, setStreamInterrupted] = useState(false);
  const [logs, setLogs] = useState<LogChunk[]>([
    {
      timestamp: '14:02:01.042',
      type: 'info',
      message: 'Gateway accepted request',
      details: 'req_id: 8f9a2b1c-4d5e-6f7a-8b9c-0d1e2f3a4b5c'
    },
    {
      timestamp: '14:02:01.105',
      type: 'stream',
      message: 'Connecting to Agent router...'
    },
    {
      timestamp: '14:02:01.320',
      type: 'chunk',
      message: 'Chunk 1 received',
      chunkData: JSON.stringify({ "status": "analyzing", "progress": 0.45, "current_series": "cpu_utilization_node_A" }, null, 2)
    },
    {
      timestamp: '14:02:01.850',
      type: 'error',
      message: 'Failed to parse telemetry schema for \'node_A\'.',
      details: 'ValueError: Missing required dimension \'cluster_id\' in time series block.'
    }
  ]);

  // Set initial selected id when installations change
  useEffect(() => {
    if (!selectedInstId && installations.length > 0) {
      setSelectedInstId(activeInstallations[0]?.id || installations[0]?.id || '');
    }
  }, [installations]);

  // JSON representation of form parameters
  const getRawJson = () => {
    return JSON.stringify({
      installation_id: selectedInstId,
      capability: selectedCapability,
      query_parameters: {
        metric_type: metricType,
        start_time: startTime,
        end_time: endTime
      },
      settings: {
        include_anomalies: includeAnomalies,
        execution_mode: mode.toLowerCase()
      }
    }, null, 2);
  };

  // Run dynamic simulated trigger
  const handleInvoke = () => {
    if (isExecuting) return;
    
    setIsExecuting(true);
    setStreamInterrupted(false);
    setLogs([]); // clear logs

    const selectedInstName = installations.find(i => i.id === selectedInstId)?.agentName || 'Selected_Agent';

    let currentLogs: LogChunk[] = [];
    const addLogWithDelay = (log: LogChunk, delay: number, onComplete?: () => void) => {
      setTimeout(() => {
        currentLogs = [...currentLogs, log];
        setLogs(currentLogs);
        if (onComplete) onComplete();
      }, delay);
    };

    // 1. Gateway accept
    addLogWithDelay({
      timestamp: new Date().toLocaleTimeString(),
      type: 'info',
      message: 'Gateway accepted request',
      details: `req_id: ${Math.random().toString(36).substring(2, 10)}-${Math.random().toString(36).substring(2, 6)}-4d5e-8b9c-mock-session`
    }, 400);

    // 2. Connector trigger
    addLogWithDelay({
      timestamp: new Date().toLocaleTimeString(),
      type: 'stream',
      message: `Connecting to Agent router instance: ${selectedInstName}...`
    }, 1000);

    // 3. Validation success
    addLogWithDelay({
      timestamp: new Date().toLocaleTimeString(),
      type: 'success',
      message: `I/O Schema successfully validated against capabilities spec. Routing target: ${selectedCapability}`
    }, 1800);

    // 4. Data stream chunk or custom trigger based on user inputs
    if (metricType.toLowerCase().includes('error') || metricType.toLowerCase().includes('err')) {
      // Stream error pipeline
      addLogWithDelay({
        timestamp: new Date().toLocaleTimeString(),
        type: 'chunk',
        message: 'Chunk 1 - Parsing Buffer',
        chunkData: JSON.stringify({ status: "initializing", progress: 0.1, target: selectedCapability, metric: metricType }, null, 2)
      }, 2600);

      setTimeout(() => {
        setStreamInterrupted(true);
      }, 3300);

      addLogWithDelay({
        timestamp: new Date().toLocaleTimeString(),
        type: 'error',
        message: `Failed to compile stream metrics for '${selectedInstName}'.`,
        details: 'ValueError: Missing required dimensions in telemetry schema mapping block. Verify telemetry structure.'
      }, 3400, () => setIsExecuting(false));

    } else {
      // Successful dynamic run
      addLogWithDelay({
        timestamp: new Date().toLocaleTimeString(),
        type: 'chunk',
        message: 'Chunk 1 received',
        chunkData: JSON.stringify({ 
          status: "analyzing", 
          progress: 0.5, 
          current_series: `${metricType}_node_01`,
          time_frame: `${startTime} to ${endTime}`
        }, null, 2)
      }, 2500);

      addLogWithDelay({
        timestamp: new Date().toLocaleTimeString(),
        type: 'chunk',
        message: 'Chunk 2 received (Aggregation complete)',
        chunkData: JSON.stringify({ 
          status: "completed", 
          progress: 1.0, 
          points_processed: Math.floor(Math.random() * 4000) + 1200, 
          anomalies_found: includeAnomalies ? Math.floor(Math.random() * 3) : 0 
        }, null, 2)
      }, 3800);

      addLogWithDelay({
        timestamp: new Date().toLocaleTimeString(),
        type: 'success',
        message: 'Execution stream gracefully closed. Stream status: 200 OK.'
      }, 4400, () => setIsExecuting(false));
    }
  };

  const handleReset = () => {
    setMetricType('cpu_utilization');
    setStartTime('now-1h');
    setEndTime('now');
    setIncludeAnomalies(true);
    setLogs([]);
    setStreamInterrupted(false);
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-48px)] bg-brand-bg select-none">
      {/* Tab Header Area */}
      <div className="px-6 py-4 border-b border-brand-outline-variant flex-shrink-0 bg-brand-container">
        <div className="flex justify-between items-end">
          <div>
            <h2 className="font-headline-lg text-base font-bold text-brand-on-surface flex items-center gap-2">
              <PlayCircle size={18} className="text-brand-primary" />
              Invocation Workbench
            </h2>
            <p className="font-mono-label text-[10px] text-brand-error mt-1 flex items-center gap-1 uppercase font-semibold">
              <AlertTriangle size={12} className="text-brand-error animate-pulse" />
              Results are transient and not persisted to ledger block
            </p>
          </div>
          
          <div className="flex gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="font-label-caps text-[9px] text-brand-on-surface-variant uppercase tracking-wider">
                INSTALLATION CONTAINER
              </label>
              <select 
                value={selectedInstId}
                onChange={(e) => setSelectedInstId(e.target.value)}
                className="bg-brand-lowest border border-brand-outline-variant rounded focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none text-brand-on-surface text-xs h-8 px-2.5 w-52 font-mono-code cursor-pointer"
              >
                {installations.map(inst => (
                  <option key={inst.id} value={inst.id} className="bg-brand-lowest">
                    {inst.agentName} ({inst.state})
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex flex-col gap-1.5">
              <label className="font-label-caps text-[9px] text-brand-on-surface-variant uppercase tracking-wider">
                CAPABILITY TASK
              </label>
              <select 
                value={selectedCapability}
                onChange={(e) => setSelectedCapability(e.target.value)}
                className="bg-brand-lowest border border-brand-outline-variant rounded focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none text-brand-on-surface text-xs h-8 px-2.5 w-52 font-mono-code cursor-pointer"
              >
                <option value="analyze_telemetry_stream">analyze_telemetry_stream</option>
                <option value="generate_config">generate_config</option>
                <option value="validate_vector_batch">validate_vector_batch</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Workbench Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Pane: Input Parameters */}
        <div className="flex-1 flex flex-col border-r border-brand-outline-variant bg-brand-surface min-w-[420px]">
          {/* Tab Selection */}
          <div className="flex border-b border-brand-outline-variant bg-brand-lowest h-10 items-center px-4 justify-between flex-shrink-0">
            <div className="flex gap-5 h-full">
              <button 
                onClick={() => setInputTab('form')}
                className={`font-mono-label text-xs h-full flex items-center px-2 border-b-2 transition-all cursor-pointer ${
                  inputTab === 'form' 
                    ? 'text-brand-primary border-brand-primary font-bold' 
                    : 'text-brand-on-surface-variant border-transparent hover:text-brand-on-surface'
                }`}
              >
                Dynamic Form
              </button>
              <button 
                onClick={() => setInputTab('json')}
                className={`font-mono-label text-xs h-full flex items-center px-2 border-b-2 transition-all cursor-pointer ${
                  inputTab === 'json' 
                    ? 'text-brand-primary border-brand-primary font-bold' 
                    : 'text-brand-on-surface-variant border-transparent hover:text-brand-on-surface'
                }`}
              >
                Raw JSON
              </button>
            </div>

            {/* Streaming toggle selector */}
            <div className="flex items-center gap-1.5 bg-brand-container rounded p-0.5">
              <button 
                onClick={() => setMode('NORMAL')}
                className={`font-label-caps text-[9px] px-2.5 py-1 rounded transition-colors cursor-pointer ${
                  mode === 'NORMAL' 
                    ? 'bg-brand-secondary-container text-brand-on-surface font-semibold' 
                    : 'text-brand-on-surface-variant hover:text-brand-on-surface'
                }`}
              >
                NORMAL
              </button>
              <button 
                onClick={() => setMode('STREAMING')}
                className={`font-label-caps text-[9px] px-2.5 py-1 rounded transition-colors cursor-pointer ${
                  mode === 'STREAMING' 
                    ? 'bg-brand-secondary-container text-brand-on-surface font-semibold' 
                    : 'text-brand-on-surface-variant hover:text-brand-on-surface'
                }`}
              >
                STREAMING
              </button>
            </div>
          </div>

          {/* Tab content area */}
          <div className="flex-1 overflow-y-auto p-6">
            {inputTab === 'form' ? (
              <form className="flex flex-col gap-6" onSubmit={(e) => e.preventDefault()}>
                {/* Object Input Form */}
                <div className="border border-brand-outline-variant rounded bg-brand-lowest p-4 space-y-4">
                  <h3 className="font-mono-code text-[12px] text-brand-on-surface mb-2 flex items-center gap-2 font-bold">
                    <span className="text-brand-secondary">{`{ }`}</span> query_parameters
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="font-label-caps text-[9px] text-brand-on-surface-variant uppercase tracking-wider flex justify-between items-center">
                        <span>METRIC_TYPE <span className="text-brand-error">*</span></span>
                        <span className="text-[8px] font-mono-code text-brand-outline-variant lowercase">Try &quot;error&quot; to test failure states</span>
                      </label>
                      <input 
                        type="text" 
                        value={metricType}
                        onChange={(e) => setMetricType(e.target.value)}
                        className="bg-transparent border border-brand-outline-variant rounded focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none transition-colors duration-200 text-brand-on-surface w-full h-8 px-2.5 font-mono-code text-xs"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="font-label-caps text-[9px] text-brand-on-surface-variant uppercase tracking-wider">
                          START_TIME
                        </label>
                        <input 
                          type="text" 
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                          className="bg-transparent border border-brand-outline-variant rounded focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none transition-colors duration-200 text-brand-on-surface w-full h-8 px-2.5 font-mono-code text-xs"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="font-label-caps text-[9px] text-brand-on-surface-variant uppercase tracking-wider">
                          END_TIME
                        </label>
                        <input 
                          type="text" 
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                          className="bg-transparent border border-brand-outline-variant rounded focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none transition-colors duration-200 text-brand-on-surface w-full h-8 px-2.5 font-mono-code text-xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Boolean Input Form */}
                <div className="flex items-center justify-between border border-brand-outline-variant rounded bg-brand-lowest p-4">
                  <div>
                    <h3 className="font-mono-code text-xs text-brand-on-surface font-semibold">include_anomalies</h3>
                    <p className="font-body-sm text-[11px] text-brand-on-surface-variant mt-0.5 max-w-[240px]">
                      Run secondary ML anomaly detection filter model on aggregated telemetry blocks.
                    </p>
                  </div>
                  {/* Toggle Swtich */}
                  <button
                    type="button"
                    onClick={() => setIncludeAnomalies(!includeAnomalies)}
                    className={`w-10 h-5 rounded-full relative border transition-colors cursor-pointer ${
                      includeAnomalies 
                        ? 'bg-brand-primary/20 border-brand-primary' 
                        : 'bg-brand-outline-variant/20 border-brand-outline-variant'
                    }`}
                  >
                    <span className={`w-3 h-3 rounded-full absolute top-0.5 transition-all ${
                      includeAnomalies 
                        ? 'bg-brand-primary right-1' 
                        : 'bg-brand-outline-variant left-1'
                    }`} />
                  </button>
                </div>
              </form>
            ) : (
              // Raw JSON input
              <div className="h-full flex flex-col gap-3">
                <div className="bg-brand-lowest border border-brand-outline-variant rounded flex-1 flex flex-col">
                  <div className="flex justify-between items-center bg-brand-container p-2 border-b border-brand-outline-variant">
                    <span className="font-mono-label text-[10px] text-brand-on-surface-variant">payload.json</span>
                  </div>
                  <textarea
                    readOnly
                    value={getRawJson()}
                    className="w-full bg-transparent border-none text-brand-primary font-mono-code text-xs p-4 focus:ring-0 resize-none h-96 leading-relaxed outline-none"
                  />
                </div>
                <p className="text-[10px] text-brand-on-surface-variant/70 font-mono-label leading-relaxed">
                  JSON structure is dynamically synthesized based on parameters configured in the Dynamic Form module. Modify form fields to update schema properties.
                </p>
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="p-4 border-t border-brand-outline-variant bg-brand-container/40 flex justify-end gap-3 flex-shrink-0">
            <button 
              onClick={handleReset}
              className="h-8 px-4 rounded border border-brand-outline-variant text-brand-on-surface font-body-sm text-xs hover:bg-brand-container transition-all cursor-pointer"
            >
              Reset
            </button>
            <button 
              onClick={handleInvoke}
              disabled={isExecuting}
              className={`h-8 px-6 rounded text-xs font-semibold flex items-center gap-1.5 transition-all shadow-[0_0_12px_rgba(173,198,255,0.15)] cursor-pointer ${
                isExecuting 
                  ? 'bg-brand-container text-brand-on-surface-variant cursor-not-allowed border border-brand-outline-variant' 
                  : 'bg-brand-primary text-brand-on-primary hover:bg-brand-primary/95'
              }`}
            >
              {isExecuting ? (
                <>
                  <RotateCw size={13} className="animate-spin text-brand-primary" />
                  <span>Executing Pipeline...</span>
                </>
              ) : (
                <>
                  <Play size={12} className="fill-current" />
                  <span>Invoke Task</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Pane: Execution Output stream */}
        <div className="flex-1 flex flex-col bg-brand-lowest">
          <div className="flex border-b border-brand-outline-variant bg-brand-lowest h-10 items-center px-4 justify-between flex-shrink-0">
            <span className="font-mono-label text-[10px] text-brand-on-surface-variant">
              Execution Trace Stream
            </span>
            <div className="flex items-center gap-2">
              {isExecuting ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                  <span className="font-mono-label text-[10px] text-green-400 uppercase tracking-wider font-semibold">Streaming Active</span>
                </>
              ) : streamInterrupted ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-brand-error animate-ping"></span>
                  <span className="font-mono-label text-[10px] text-brand-error uppercase tracking-wider font-semibold">Stream Interrupted</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-brand-outline-variant"></span>
                  <span className="font-mono-label text-[10px] text-brand-on-surface-variant uppercase tracking-wider">Ready / Idle</span>
                </>
              )}
            </div>
          </div>

          {/* Logs View Container */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 font-mono-code text-[12px]">
            {logs.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-brand-on-surface-variant">
                <Terminal size={24} className="mb-2 text-brand-outline-variant/50 animate-pulse" />
                <p className="font-mono-label text-[11px]">No active trace. Click &quot;Invoke Task&quot; above to trigger dynamic telemetry pipeline execution.</p>
              </div>
            ) : (
              logs.map((log, index) => {
                if (log.type === 'error') {
                  // Styled Agent Business Error State
                  return (
                    <div key={index} className="flex items-start gap-3 mt-2">
                      <div className="mt-0.5 flex items-center justify-center w-4 h-4 rounded-full border border-brand-error-container bg-brand-error-container/20 text-brand-error">
                        <FileWarning size={10} className="text-brand-error" />
                      </div>
                      <div className="flex-1 border border-brand-error-container bg-brand-container rounded p-3 relative overflow-hidden">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-error-container"></div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-label-caps text-[9px] text-brand-error bg-brand-error/10 px-2 py-0.5 rounded tracking-wider font-bold">
                            AGENT BUSINESS ERROR
                          </span>
                        </div>
                        <p className="text-brand-on-surface text-[12px] font-semibold">{log.message}</p>
                        {log.details && (
                          <pre className="text-brand-error text-[10px] mt-2 p-2 bg-brand-lowest rounded overflow-x-auto leading-relaxed border border-brand-error/20">
                            {log.details}
                          </pre>
                        )}
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={index} className="flex items-start gap-3 text-brand-on-surface-variant">
                    <span className="mt-0.5 text-brand-outline-variant">
                      {log.type === 'info' && <CheckCircle2 size={13} className="text-brand-tertiary" />}
                      {log.type === 'success' && <CheckCircle2 size={13} className="text-green-500" />}
                      {log.type === 'stream' && <Zap size={13} className="text-brand-primary animate-pulse" />}
                      {log.type === 'chunk' && <Code size={13} className="text-brand-secondary" />}
                    </span>

                    <div className="flex-1">
                      <div className="text-brand-on-surface text-[12px]">
                        <span className="text-brand-tertiary/70 mr-2 font-semibold">[{log.timestamp}]</span>
                        <span>{log.message}</span>
                      </div>

                      {log.details && !log.chunkData && (
                        <div className="text-[10px] text-brand-outline font-mono-code mt-1 pl-4 border-l border-brand-outline-variant">
                          {log.details}
                        </div>
                      )}

                      {log.chunkData && (
                        <div className="mt-2 bg-brand-container border border-brand-outline-variant rounded p-2.5 max-w-full">
                          <div className="text-brand-tertiary mb-1 text-[10px] border-b border-brand-outline-variant/50 pb-1 font-mono-label font-bold flex justify-between">
                            <span>{log.message}</span>
                            <span className="text-brand-on-surface-variant font-normal">JSON Schema Frame</span>
                          </div>
                          <pre className="text-brand-secondary text-[11px] overflow-x-auto leading-relaxed">
                            {log.chunkData}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
