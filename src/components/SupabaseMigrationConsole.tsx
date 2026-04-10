import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Copy, Eye, EyeOff } from 'lucide-react';

// Default credentials - prefilled for quick testing
const DEFAULT_CREDENTIALS = {
  sourceProjectId: 'hxftiocfihhdutciaisl',
  sourceApiKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4ZnRpb2NmaWhoZHV0Y2lhaXNsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzAwMzkwMiwiZXhwIjoyMDgyNTc5OTAyfQ.cQ2MpQaKSRn_V9lmNv_vvUujMaxJoVHhUZ3gCxzdbhI',
  sourceDbPassword: 'Waheguru@1313@',
  targetProjectId: 'mmuverimunvkrpoarwqz',
  targetApiKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tdXZlcmltdW52a3Jwb2Fyd3F6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDk1MTUzNywiZXhwIjoyMDkwNTI3NTM3fQ.lQWyfie0zoGIcmdTb92aesnhuuAnTaAEMsODxXCvgNQ',
  targetDbPassword: 'Waheguru@1313@'
};

interface MigrationStep {
  name: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  details?: string;
  error?: string;
}

interface MigrationResult {
  timestamp: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  steps: MigrationStep[];
  errors: string[];
  summary?: string;
}

export function SupabaseMigrationConsole() {
  const [sourceProjectId, setSourceProjectId] = useState(DEFAULT_CREDENTIALS.sourceProjectId);
  const [sourceApiKey, setSourceApiKey] = useState(DEFAULT_CREDENTIALS.sourceApiKey);
  const [sourceDbPassword, setSourceDbPassword] = useState(DEFAULT_CREDENTIALS.sourceDbPassword);
  const [targetProjectId, setTargetProjectId] = useState(DEFAULT_CREDENTIALS.targetProjectId);
  const [targetApiKey, setTargetApiKey] = useState(DEFAULT_CREDENTIALS.targetApiKey);
  const [targetDbPassword, setTargetDbPassword] = useState(DEFAULT_CREDENTIALS.targetDbPassword);
  
  const [showSourceKey, setShowSourceKey] = useState(false);
  const [showSourceDbPassword, setShowSourceDbPassword] = useState(false);
  const [showTargetKey, setShowTargetKey] = useState(false);
  const [showDbPassword, setShowDbPassword] = useState(false);
  
  const [includeUsers, setIncludeUsers] = useState(true);
  const [includeStorage, setIncludeStorage] = useState(true);
  const [includeFunctions, setIncludeFunctions] = useState(true);
  
  const [migrating, setMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [useDirectDb, setUseDirectDb] = useState(true);  // Toggle between REST API and direct DB - DEFAULT: DIRECT DB (with RLS)
  const logsEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const validateInputs = (): boolean => {
    if (!sourceProjectId.trim()) {
      addLog('❌ Error: Source project ID is required');
      return false;
    }
    if (!sourceApiKey.trim()) {
      addLog('❌ Error: Source API key is required');
      return false;
    }
    if (!targetProjectId.trim()) {
      addLog('❌ Error: Target project ID is required');
      return false;
    }
    if (!targetApiKey.trim()) {
      addLog('❌ Error: Target API key is required');
      return false;
    }
    return true;
  };

  const startMigration = async () => {
    if (!validateInputs()) return;
    
    // If using direct DB, make sure password is provided
    if (useDirectDb && !targetDbPassword.trim()) {
      addLog('❌ Error: Database password is required for automatic migration');
      return;
    }

    setMigrating(true);
    setLogs([]);
    setMigrationResult(null);

    try {
      addLog('🚀 Starting Supabase auto-migration...');
      addLog(`📋 Configuration:`);
      addLog(`  Source: ${sourceProjectId}`);
      addLog(`  Target: ${targetProjectId}`);
      addLog(`  Mode: ${useDirectDb ? '🚀 Fully Automatic (Direct DB)' : 'REST API'}`);
      addLog(`  Include Users: ${includeUsers}`);
      addLog(`  Include Storage: ${includeStorage}`);
      addLog(`  Include Functions: ${includeFunctions}`);
      addLog('');

      // Choose endpoint based on mode
      const endpoint = useDirectDb && targetDbPassword.trim() 
        ? 'http://localhost:3002/api/migration/auto-migrate-direct'
        : 'http://localhost:3002/api/migration/auto-migrate';

      const requestBody: any = {
        sourceProjectId: sourceProjectId.trim(),
        sourceApiKey: sourceApiKey.trim(),
        targetProjectId: targetProjectId.trim(),
        targetApiKey: targetApiKey.trim(),
      };

      // Add passwords if using direct DB mode
      if (useDirectDb && targetDbPassword.trim()) {
        requestBody.targetDbPassword = targetDbPassword.trim();
        // Only include source password if provided (optional for RLS transfer)
        if (sourceDbPassword.trim()) {
          requestBody.sourceDbPassword = sourceDbPassword.trim();
        }
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      addLog(`✅ Migration started: ${data.migrationId}`);
      addLog(`⏱️ Estimated duration: ${data.estimatedDuration}`);
      addLog('');
      addLog('📊 Migration Progress:');

      // Poll for status
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await fetch(`http://localhost:3002/api/migration/status`);
          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            const result = statusData.migration;

            if (result) {
              // Show new steps
              result.steps.forEach((step: MigrationStep) => {
                const icon = step.status === 'completed' ? '✅' : step.status === 'failed' ? '❌' : '⏳';
                addLog(`${icon} ${step.name}: ${step.details || ''}`);
              });

              // Show errors
              if (result.errors && result.errors.length > 0) {
                result.errors.forEach((error: string) => {
                  addLog(`⚠️  Error: ${error}`);
                });
              }
              
              // Show summary/SQL statements if available
              if (result.summary) {
                addLog('');
                addLog('📝 Additional Information:');
                result.summary.split('\n').forEach((line: string) => {
                  if (line.trim()) {
                    addLog(line);
                  }
                });
              }

              // Check if done
              if (result.status === 'completed' || result.status === 'failed') {
                clearInterval(pollInterval);
                setMigrationResult(result);
                setMigrating(false);

                if (result.status === 'completed') {
                  addLog('');
                  addLog('🎉 Migration completed successfully!');
                  addLog('✅ All data has been migrated to the target project');
                } else {
                  addLog('');
                  addLog('❌ Migration failed. Check errors above.');
                }
              }
            }
          }
        } catch (err) {
          console.error('Status check error:', err);
        }
      }, 2000);

      // Stop polling after 30 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        if (migrating) {
          addLog('⏱️ Migration timeout (30 min reached)');
          setMigrating(false);
        }
      }, 30 * 60 * 1000);
    } catch (error) {
      addLog(`❌ Migration failed: ${error instanceof Error ? error.message : String(error)}`);
      setMigrating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    addLog('📋 Copied to clipboard!');
  };

  const resetForm = () => {
    setSourceProjectId('');
    setSourceApiKey('');
    setTargetProjectId('');
    setTargetApiKey('');
    setLogs([]);
    setMigrationResult(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-2xl">🚀</span>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Supabase Auto-Migration Console</h1>
              <p className="text-slate-400">API-based migration without passwords</p>
            </div>
          </div>
        </div>

        {/* Pre-filled Credentials Banner */}
        <div className="mb-6 bg-green-900 border border-green-700 rounded-lg p-4">
          <h3 className="text-green-100 font-bold mb-2">✅ All Credentials Pre-filled & Ready!</h3>
          <ul className="text-green-100 text-sm space-y-1">
            <li>✓ Source Project: hxftiocfihhdutciaisl</li>
            <li>✓ Source API Key: Loaded</li>
            <li>✓ Target Project: mmuverimunvkrpoarwqz</li>
            <li>✓ Target API Key: Loaded</li>
            <li>✓ Database Password (both): Waheguru@1313@</li>
            <li className="text-green-200 font-bold">→ Ready to start migration! 🚀</li>
          </ul>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Input Panel */}
          <div className="lg:col-span-1">
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <h2 className="text-xl font-bold text-white mb-4">🔑 Configuration</h2>

              {/* Source Project */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  Source Project ID
                </label>
                <input
                  type="text"
                  placeholder="e.g., abc123xyz"
                  value={sourceProjectId}
                  onChange={(e) => setSourceProjectId(e.target.value)}
                  disabled={migrating}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-500 disabled:opacity-50"
                />
              </div>

              {/* Source API Key */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  Source API Key
                </label>
                <div className="flex gap-2">
                  <input
                    type={showSourceKey ? 'text' : 'password'}
                    placeholder="sbp_..."
                    value={sourceApiKey}
                    onChange={(e) => setSourceApiKey(e.target.value)}
                    disabled={migrating}
                    className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-500 disabled:opacity-50"
                  />
                  <button
                    onClick={() => setShowSourceKey(!showSourceKey)}
                    disabled={migrating}
                    className="px-2 py-2 bg-slate-700 border border-slate-600 rounded text-slate-300 hover:text-white disabled:opacity-50"
                  >
                    {showSourceKey ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Source Database Password (Optional) */}
              {useDirectDb && (
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-slate-300 mb-2">
                    Source DB Password (for RLS policies)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type={showSourceDbPassword ? 'text' : 'password'}
                      placeholder="postgres password (optional - for RLS transfer)"
                      value={sourceDbPassword}
                      onChange={(e) => setSourceDbPassword(e.target.value)}
                      disabled={migrating}
                      className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-500 disabled:opacity-50"
                    />
                    <button
                      onClick={() => setShowSourceDbPassword(!showSourceDbPassword)}
                      disabled={migrating}
                      className="px-2 py-2 bg-slate-700 border border-slate-600 rounded text-slate-300 hover:text-white disabled:opacity-50"
                    >
                      {showSourceDbPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              )}

              {/* Target Project */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  Target Project ID
                </label>
                <input
                  type="text"
                  placeholder="e.g., xyz789abc"
                  value={targetProjectId}
                  onChange={(e) => setTargetProjectId(e.target.value)}
                  disabled={migrating}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-500 disabled:opacity-50"
                />
              </div>

              {/* Target API Key */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  Target API Key
                </label>
                <div className="flex gap-2">
                  <input
                    type={showTargetKey ? 'text' : 'password'}
                    placeholder="sbp_..."
                    value={targetApiKey}
                    onChange={(e) => setTargetApiKey(e.target.value)}
                    disabled={migrating}
                    className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-500 disabled:opacity-50"
                  />
                  <button
                    onClick={() => setShowTargetKey(!showTargetKey)}
                    disabled={migrating}
                    className="px-2 py-2 bg-slate-700 border border-slate-600 rounded text-slate-300 hover:text-white disabled:opacity-50"
                  >
                    {showTargetKey ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Database Password (Optional) */}
              <div className="mb-6">
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={useDirectDb}
                    onChange={(e) => setUseDirectDb(e.target.checked)}
                    disabled={migrating}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-semibold text-slate-300">🚀 Fully Automatic (Direct DB)</span>
                </label>
                {useDirectDb && (
                  <div className="flex gap-2">
                    <input
                      type={showDbPassword ? 'text' : 'password'}
                      placeholder="postgres password (from Supabase dashboard)"
                      value={targetDbPassword}
                      onChange={(e) => setTargetDbPassword(e.target.value)}
                      disabled={migrating}
                      className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-500 disabled:opacity-50"
                    />
                    <button
                      onClick={() => setShowDbPassword(!showDbPassword)}
                      disabled={migrating}
                      className="px-2 py-2 bg-slate-700 border border-slate-600 rounded text-slate-300 hover:text-white disabled:opacity-50"
                    >
                      {showDbPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                )}
              </div>

              {/* Options */}
              <div className="bg-slate-700 rounded p-4 mb-6">
                <h3 className="text-sm font-semibold text-white mb-3">📋 Options</h3>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeUsers}
                      onChange={(e) => setIncludeUsers(e.target.checked)}
                      disabled={migrating}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-slate-300">Include Users</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeStorage}
                      onChange={(e) => setIncludeStorage(e.target.checked)}
                      disabled={migrating}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-slate-300">Include Storage</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeFunctions}
                      onChange={(e) => setIncludeFunctions(e.target.checked)}
                      disabled={migrating}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-slate-300">Include Functions</span>
                  </label>
                </div>
              </div>

              {/* Help Text */}
              <div className="bg-blue-900 bg-opacity-30 border border-blue-600 rounded p-3 mb-6">
                <p className="text-xs text-blue-300">
                  💡 Get your API keys from Supabase Dashboard → Settings → API → Service Role Key
                </p>
                {useDirectDb && (
                  <p className="text-xs text-blue-300 mt-2">
                    🔐 Database password: Dashboard → Settings → Database → Connection string (postgres user password)
                  </p>
                )}
              </div>

              {/* Buttons */}
              <div className="space-y-2">
                <button
                  onClick={startMigration}
                  disabled={migrating}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:opacity-50 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition"
                >
                  {migrating ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Migrating...
                    </>
                  ) : (
                    <>
                      🚀 Start Migration
                    </>
                  )}
                </button>
                <button
                  onClick={resetForm}
                  disabled={migrating}
                  className="w-full py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-300 font-semibold rounded-lg transition"
                >
                  🔄 Reset
                </button>
              </div>
            </div>
          </div>

          {/* Console Panel */}
          <div className="lg:col-span-2">
            <div className="bg-slate-800 rounded-lg border border-slate-700 flex flex-col h-full">
              {/* Console Header */}
              <div className="bg-slate-900 px-6 py-3 flex items-center justify-between border-b border-slate-700 rounded-t-lg">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <h2 className="text-lg font-bold text-white">Console Output</h2>
                </div>
                <div className="text-sm text-slate-400">
                  {logs.length} lines
                </div>
              </div>

              {/* Console Output */}
              <div className="flex-1 p-6 overflow-y-auto font-mono text-sm bg-slate-900 min-h-96">
                {logs.length === 0 ? (
                  <div className="text-slate-500 text-center py-20">
                    <p className="text-lg mb-2">Welcome to Supabase Auto-Migration Console</p>
                    <p className="text-sm">Enter your credentials and click "Start Migration"</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {logs.map((log, index) => (
                      <div
                        key={index}
                        className={
                          log.includes('❌')
                            ? 'text-red-400'
                            : log.includes('✅')
                            ? 'text-green-400'
                            : log.includes('⚠️')
                            ? 'text-yellow-400'
                            : log.includes('🎉')
                            ? 'text-cyan-400'
                            : 'text-slate-300'
                        }
                      >
                        {log}
                      </div>
                    ))}
                    <div ref={logsEndRef} />
                  </div>
                )}
              </div>

              {/* Console Footer */}
              <div className="bg-slate-700 px-6 py-3 border-t border-slate-600 rounded-b-lg flex items-center justify-between">
                <div className="text-xs text-slate-400">
                  {migrating && (
                    <span className="flex items-center gap-2">
                      <Loader2 size={14} className="animate-spin" />
                      Migration in progress...
                    </span>
                  )}
                  {!migrating && migrationResult && (
                    <span
                      className={
                        migrationResult.status === 'completed'
                          ? 'flex items-center gap-2 text-green-400'
                          : 'flex items-center gap-2 text-red-400'
                      }
                    >
                      {migrationResult.status === 'completed' ? (
                        <>
                          <CheckCircle2 size={14} />
                          Migration completed
                        </>
                      ) : (
                        <>
                          <AlertCircle size={14} />
                          Migration failed
                        </>
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Results Panel */}
        {migrationResult && (
          <div className="mt-6 bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h2 className="text-xl font-bold text-white mb-4">📊 Migration Results</h2>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              <div className="bg-slate-700 rounded p-4">
                <p className="text-slate-400 text-sm">Total Steps</p>
                <p className="text-2xl font-bold text-white">{migrationResult.steps.length}</p>
              </div>
              <div className="bg-slate-700 rounded p-4">
                <p className="text-slate-400 text-sm">Pending</p>
                <p className="text-2xl font-bold text-slate-300">
                  {migrationResult.steps.filter((s) => s.status === 'pending').length}
                </p>
              </div>
              <div className="bg-slate-700 rounded p-4">
                <p className="text-slate-400 text-sm">In Progress</p>
                <p className="text-2xl font-bold text-blue-400">
                  {migrationResult.steps.filter((s) => s.status === 'in-progress').length}
                </p>
              </div>
              <div className="bg-slate-700 rounded p-4">
                <p className="text-slate-400 text-sm">Completed</p>
                <p className="text-2xl font-bold text-green-400">
                  {migrationResult.steps.filter((s) => s.status === 'completed').length}
                </p>
              </div>
              <div className="bg-slate-700 rounded p-4">
                <p className="text-slate-400 text-sm">Failed</p>
                <p className="text-2xl font-bold text-red-400">
                  {migrationResult.steps.filter((s) => s.status === 'failed').length}
                </p>
              </div>
              <div className="bg-slate-700 rounded p-4">
                <p className="text-slate-400 text-sm">Status</p>
                <p className={`text-2xl font-bold ${migrationResult.status === 'completed' ? 'text-green-400' : 'text-red-400'}`}>
                  {migrationResult.status.toUpperCase()}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SupabaseMigrationConsole;
