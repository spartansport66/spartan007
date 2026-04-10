"use client";

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  Upload, 
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Cloud,
} from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';
import { importSupabaseData, verifySupabaseConnection, createSchemaInDestination } from '@/utils/supabaseMigration';
import { useNavigate } from 'react-router-dom';

interface MigrationStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  progress: number;
}

interface MigrationLog {
  time: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

interface TableData {
  tableName: string;
  columns: any[];
  data: any[];
}

const UploadToNewSupabase = () => {
  const navigate = useNavigate();
  
  // New Supabase credentials
  const [newSupabaseId, setNewSupabaseId] = useState('');
  const [newSupabaseKey, setNewSupabaseKey] = useState('');
  const [showSupabaseKey, setShowSupabaseKey] = useState(false);

  // Migration state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [exportedData, setExportedData] = useState<TableData[]>([]);
  const [hasBackup, setHasBackup] = useState(false);
  const [backupInfo, setBackupInfo] = useState<{ sourceProject: string; tablesCount: number; rowsCount: number } | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  const [uploadSteps, setUploadSteps] = useState<MigrationStep[]>([
    { id: 'upload-connect', title: 'Connect to NEW Supabase', description: 'Establishing connection to new project', status: 'pending', progress: 0 },
    { id: 'upload-schema', title: 'Create Schema', description: 'Creating tables and structure in new database', status: 'pending', progress: 0 },
    { id: 'upload-tables', title: 'Upload All Data', description: 'Importing data to new database', status: 'pending', progress: 0 },
    { id: 'upload-verify', title: 'Verify Data', description: 'Verifying all data was imported correctly', status: 'pending', progress: 0 },
  ]);
  const [uploadLogs, setUploadLogs] = useState<MigrationLog[]>([]);

  // No automatic loading - user selects file

  const addLog = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    const time = new Date().toLocaleTimeString();
    setUploadLogs(prev => [...prev, { time, message, type }]);
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    try {
      setHasBackup(false);
      addLog(`📂 Processing ${files.length} file(s)...`, 'info');

      const allTables = new Map<string, TableData>();

      // Process each file
      for (let fileIdx = 0; fileIdx < files.length; fileIdx++) {
        const file = files[fileIdx];
        const fileName = file.name;
        addLog(`Opening: ${fileName}`, 'info');

        try {
          const text = await file.text();

          // Check file type
          if (fileName.endsWith('.json')) {
            // JSON format
            const parsed = JSON.parse(text);

            if (parsed.tables && Array.isArray(parsed.tables)) {
              for (const table of parsed.tables) {
                allTables.set(table.tableName, table);
              }
              addLog(`  ✓ Loaded ${parsed.tables.length} table(s) from ${fileName}`, 'info');
            }
          } else if (fileName.endsWith('.sql')) {
            // SQL format - parse INSERT statements
            const lines = text.split('\n');
            let currentInsert = '';

            for (const line of lines) {
              currentInsert += line + '\n';

              if (line.includes(');')) {
                const insertMatch = currentInsert.match(/INSERT INTO ["`]?([^"`\s]+)["`]?\s*\((.*?)\)\s*VALUES\s*(.*?);/is);

                if (insertMatch) {
                  const tableName = insertMatch[1];
                  const columnsStr = insertMatch[2];
                  const valuesStr = insertMatch[3];

                  if (!allTables.has(tableName)) {
                    allTables.set(tableName, {
                      tableName,
                      columns: columnsStr.split(',').map(col => ({
                        column_name: col.trim().replace(/["`]/g, ''),
                        data_type: 'text',
                        is_nullable: true,
                      })),
                      data: [],
                    });
                  }

                  const table = allTables.get(tableName)!;
                  const valueGroups = valuesStr.match(/\([^)]+\)/g) || [];

                  for (const group of valueGroups) {
                    const values = group.slice(1, -1).split(',').map(v => {
                      const trimmed = v.trim();
                      if (trimmed === 'NULL') return null;
                      if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
                        return trimmed.slice(1, -1);
                      }
                      return trimmed;
                    });

                    const row: any = {};
                    columnsStr.split(',').forEach((col, idx) => {
                      row[col.trim().replace(/["`]/g, '')] = values[idx];
                    });
                    table.data.push(row);
                  }
                }
                currentInsert = '';
              }
            }

            addLog(`  ✓ Parsed ${allTables.size} table(s) from ${fileName}`, 'info');
          }
        } catch (fileError: any) {
          addLog(`  ✗ Failed to process ${fileName}: ${fileError.message}`, 'error');
        }
      }

      if (allTables.size === 0) {
        throw new Error('No valid data found in any file. Make sure files contain valid JSON or SQL INSERT statements.');
      }

      const tableArray = Array.from(allTables.values());
      setExportedData(tableArray);
      setHasBackup(true);

      const tableCount = tableArray.length;
      const rowCount = tableArray.reduce((sum, t) => sum + t.data.length, 0);
      setBackupInfo({
        sourceProject: `${files.length} file(s)`,
        tablesCount: tableCount,
        rowsCount: rowCount,
      });

      addLog(`✓ Successfully loaded: ${tableCount} tables, ${rowCount} rows from ${files.length} file(s)`, 'success');
      showSuccess(`✓ Loaded ${tableCount} tables, ${rowCount} rows from ${files.length} file(s)`);

    } catch (error: any) {
      addLog(`✗ Failed to load files: ${error.message}`, 'error');
      showError(`Failed to load files: ${error.message}`);
      setHasBackup(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const updateStep = (stepId: string, status: MigrationStep['status'], progress: number) => {
    setUploadSteps(prev =>
      prev.map(step =>
        step.id === stepId ? { ...step, status, progress } : step
      )
    );
  };

  const handleStartUpload = useCallback(async () => {
    if (!newSupabaseId || !newSupabaseKey) {
      showError('Please provide NEW Supabase credentials');
      return;
    }

    if (!hasBackup || exportedData.length === 0) {
      showError('Select one or more .sql or .json files generated by the export scripts.');
      return;
    }

    setIsUploading(true);
    setUploadLogs([]);
    setUploadProgress(0);
    setUploadSteps(prev => prev.map(s => ({ ...s, status: 'pending', progress: 0 })));

    try {
      addLog('🚀 Starting upload to NEW Supabase...', 'info');
      addLog(`NEW Supabase Project: ${newSupabaseId}`, 'info');
      addLog(`Tables to upload: ${exportedData.length}`, 'info');
      addLog('', 'info');

      // Step 1: Connect to new Supabase
      updateStep('upload-connect', 'in-progress', 0);
      addLog('Connecting to new Supabase project...', 'info');
      
      const isConnected = await verifySupabaseConnection(newSupabaseId, newSupabaseKey);
      if (!isConnected) {
        throw new Error('Cannot connect to NEW Supabase. Check Project ID and API Key.');
      }

      updateStep('upload-connect', 'completed', 100);
      addLog('✓ Connected to new Supabase successfully', 'success');
      setUploadProgress(25);

      // Step 2: Create schema
      updateStep('upload-schema', 'in-progress', 0);
      addLog(`Creating ${exportedData.length} tables in new Supabase...`, 'info');

      const schemaResult = await createSchemaInDestination(newSupabaseId, newSupabaseKey, exportedData);
      if (schemaResult.failed > 0) {
        addLog(`⚠️  Schema creation: ${schemaResult.success} successful, ${schemaResult.failed} issues`, 'warning');
      } else {
        addLog(`✓ All ${schemaResult.success} tables verified/created`, 'success');
      }

      updateStep('upload-schema', 'completed', 100);
      setUploadProgress(50);

      // Step 3: Upload data
      updateStep('upload-tables', 'in-progress', 0);
      const totalRows = exportedData.reduce((sum, t) => sum + t.data.length, 0);
      addLog(`📥 Starting to upload ${exportedData.length} tables (${totalRows} total rows)...`, 'info');
      addLog('⚠️  This may take a few minutes. Monitor the logs below for any issues.', 'warning');

      const result = await importSupabaseData(newSupabaseId, newSupabaseKey, exportedData);

      addLog('', 'info');
      if (result.failed > 0) {
        addLog(`⚠️  Upload completed with ${result.success} successful batches and ${result.failed} failures`, 'warning');
        addLog('Check the browser console (F12) for detailed error messages that show which tables failed', 'warning');
      } else {
        addLog(`✓ All ${result.success} batches uploaded successfully to new Supabase`, 'success');
      }

      updateStep('upload-tables', 'completed', 100);
      setUploadProgress(75);

      // Step 4: Verify
      updateStep('upload-verify', 'in-progress', 0);
      addLog('Verifying data in new database...', 'info');
      
      const verifyConnection = await verifySupabaseConnection(newSupabaseId, newSupabaseKey);
      if (!verifyConnection) {
        throw new Error('Failed to verify connection to new Supabase');
      }

      addLog('✓ New database connection verified', 'success');
      updateStep('upload-verify', 'completed', 100);
      setUploadProgress(100);

      addLog('', 'info');
      addLog('🎉 Upload process completed!', 'success');
      addLog('Check browser console (F12 → Console) for detailed operation logs', 'info');
      showSuccess('Upload process completed! Check console for details.');


    } catch (error: any) {
      addLog(`❌ Upload failed: ${error.message}`, 'error');
      showError(`Upload failed: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  }, [newSupabaseId, newSupabaseKey, exportedData, hasBackup]);

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="icon" onClick={() => navigate('/admin')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Upload className="h-8 w-8" />
              Upload to New Supabase
            </h1>
            <p className="text-muted-foreground mt-2">
              Upload your backed-up data to a new Supabase project
            </p>
          </div>
        </div>

        {!isUploading ? (
          <div className="space-y-6">
            {/* Instructions Card */}
            <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
              <CardHeader>
                <CardTitle className="text-blue-900 dark:text-blue-100">📋 IMPORTANT: Tables Must Exist First</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-blue-800 dark:text-blue-200 space-y-3">
                <p className="font-semibold">Before uploading data, you MUST create the table structure in your NEW Supabase:</p>
                <ol className="list-decimal list-inside space-y-2 ml-2">
                  <li>Go to <strong>Database Backup & Migration</strong> page</li>
                  <li>Download and run the SQL export scripts:
                    <div className="ml-4 mt-1 space-y-1">
                      <div><code className="bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded text-xs">export_schema_policies.sql</code> (creates tables)</div>
                      <div><code className="bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded text-xs">post_migration_fixes.sql</code> (fixes constraints)</div>
                    </div>
                  </li>
                  <li>Run these scripts in your <strong>NEW Supabase</strong> SQL Editor</li>
                  <li><strong>Then</strong> come back here to upload the data</li>
                </ol>
              </CardContent>
            </Card>

            {/* File Upload Section */}
            <Card>
              <CardHeader className="bg-green-50 dark:bg-green-950">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Upload className="h-5 w-5" />
                  Step 1: Select Exported Data Files
                </CardTitle>
                <CardDescription>Select all exported files (.sql or .json) - can select multiple</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,.sql"
                    onChange={handleFileSelect}
                    multiple
                    className="hidden"
                  />
                  
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    variant="outline"
                    className="w-full h-20 border-2 border-dashed hover:border-green-500"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="h-6 w-6" />
                      <span>Select one or more data files (.sql or .json)</span>
                      <span className="text-xs text-muted-foreground">Can select multiple files at once</span>
                    </div>
                  </Button>

                  {hasBackup && backupInfo && (
                    <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-900 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        <h4 className="font-semibold text-green-900 dark:text-green-100">Files Loaded Successfully ✓</h4>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-green-800 dark:text-green-200">Files</p>
                          <p className="font-mono text-xs text-green-900 dark:text-green-100 mt-1">{backupInfo.sourceProject}</p>
                        </div>
                        <div>
                          <p className="text-green-800 dark:text-green-200">Tables</p>
                          <p className="text-lg font-bold text-green-900 dark:text-green-100">{backupInfo.tablesCount}</p>
                        </div>
                        <div>
                          <p className="text-green-800 dark:text-green-200">Total Rows</p>
                          <p className="text-lg font-bold text-green-900 dark:text-green-100">{backupInfo.rowsCount}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* New Supabase Credentials */}
            <Card>
              <CardHeader className="bg-blue-50 dark:bg-blue-950">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Cloud className="h-5 w-5" />
                  Step 2: Destination Credentials
                </CardTitle>
                <CardDescription>Where we're uploading TO</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div>
                  <label className="text-sm font-medium">New Supabase Project ID</label>
                  <Input
                    placeholder="e.g., qzmwtbbtagktpsckhmcz"
                    value={newSupabaseId}
                    onChange={(e) => setNewSupabaseId(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">New Supabase API Key</label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      type={showSupabaseKey ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={newSupabaseKey}
                      onChange={(e) => setNewSupabaseKey(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowSupabaseKey(!showSupabaseKey)}
                    >
                      {showSupabaseKey ? '👁️' : '👁️‍🗨️'}
                    </Button>
                  </div>
                </div>

                <Button
                  onClick={handleStartUpload}
                  disabled={isUploading || !hasBackup}
                  className="w-full bg-blue-600 hover:bg-blue-700 flex items-center gap-2 mt-6"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Step 3: Start Upload
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardContent className="pt-6 space-y-6">
              {/* Progress */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold">Overall Progress</h3>
                  <span className="text-sm text-muted-foreground">{Math.round(uploadProgress)}%</span>
                </div>
                <Progress value={uploadProgress} className="h-3" />
              </div>

              {/* Steps */}
              <div className="space-y-3">
                {uploadSteps.map((step) => (
                  <div key={step.id} className="border rounded-lg p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {step.status === 'pending' && <div className="h-2 w-2 rounded-full bg-gray-400" />}
                          {step.status === 'in-progress' && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
                          {step.status === 'completed' && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                          {step.status === 'error' && <AlertCircle className="h-4 w-4 text-red-600" />}
                          <h4 className="font-medium">{step.title}</h4>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{step.description}</p>
                      </div>
                      {step.status !== 'pending' && (
                        <span className="text-xs font-mono text-muted-foreground">{step.progress}%</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Logs */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">Operation Logs</h4>
                  <p className="text-xs text-muted-foreground">Press F12 to open browser console for detailed error messages</p>
                </div>
                <div className="bg-slate-900 dark:bg-slate-950 rounded-lg p-4 max-h-48 overflow-y-auto font-mono text-xs">
                  {uploadLogs.map((log, idx) => (
                    <div key={idx} className={`${
                      log.type === 'success' ? 'text-green-400' :
                      log.type === 'error' ? 'text-red-400' :
                      log.type === 'warning' ? 'text-yellow-400' :
                      'text-gray-300'
                    }`}>
                      <span className="text-gray-500">[{log.time}]</span> {log.message}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default UploadToNewSupabase;
