import React, { useState, useRef } from 'react';
import { Upload, AlertCircle, CheckCircle2, AlertTriangle, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { exportSupabaseData, createSchemaInDestination, importSupabaseData } from '@/utils/supabaseMigration';
import { AutoCreateSchema } from './AutoCreateSchema';

interface UploadStep {
  id: number;
  title: string;
  description: string;
  completed: boolean;
}

interface TableData {
  tableName: string;
  columns: any[];
  data: any[];
}

export function UploadToNewSupabase() {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [uploadedData, setUploadedData] = useState<TableData[] | null>(null);
  const [destProjectId, setDestProjectId] = useState('');
  const [destApiKey, setDestApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const steps: UploadStep[] = [
    { id: 1, title: 'Upload Export', description: 'Select your Supabase export file', completed: uploadedData !== null },
    { id: 2, title: 'Create Schema', description: 'Generate and execute table creation', completed: false },
    { id: 3, title: 'Upload Data', description: 'Import data to destination', completed: false },
  ];

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    addLog(`Reading file: ${file.name}`);
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        let data: TableData[] = [];

        if (file.name.endsWith('.json')) {
          data = JSON.parse(content);
          addLog(`✓ Loaded ${data.length} tables from JSON`);
        } else if (file.name.endsWith('.sql')) {
          // Parse SQL export - this is a simplified parser
          data = parseSQLExport(content);
          addLog(`✓ Parsed ${data.length} tables from SQL`);
        }

        setUploadedData(data);
        setCurrentStep(2);
      } catch (error: any) {
        addLog(`❌ Error parsing file: ${error.message}`);
      }
    };

    reader.readAsText(file);
  };

  const parseSQLExport = (sql: string): TableData[] => {
    // Simplified SQL parser - extracts INSERT statements
    const tables: { [key: string]: TableData } = {};
    const insertRegex = /INSERT INTO "([^"]+)" \(([^)]+)\) VALUES (.*?)(?=INSERT|$)/gs;
    
    let match;
    while ((match = insertRegex.exec(sql)) !== null) {
      const tableName = match[1];
      const columnStr = match[2];
      const valuesStr = match[3];

      if (!tables[tableName]) {
        tables[tableName] = {
          tableName,
          columns: columnStr.split(',').map(c => ({
            column_name: c.trim().replace(/"/g, ''),
            data_type: 'text',
            is_nullable: true,
            column_default: null,
          })),
          data: [],
        };
      }

      // Parse VALUES - this is very simplified
      // In production, you'd want a proper SQL parser
    }

    return Object.values(tables);
  };

  const handleSchemaCreation = async () => {
    if (!uploadedData) {
      addLog('❌ No data uploaded');
      return;
    }

    if (!destProjectId || !destApiKey) {
      addLog('❌ Please enter destination credentials');
      return;
    }

    setIsProcessing(true);
    addLog('Starting schema creation...');

    try {
      const result = await createSchemaInDestination(destProjectId, destApiKey, uploadedData);
      addLog(`Schema verification: ${result.success} ready, ${result.failed} issues`);
      
      if (result.failed === 0) {
        addLog('✓ All tables created successfully!');
        setCurrentStep(3);
      }
    } catch (error: any) {
      addLog(`❌ Schema creation failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDataUpload = async () => {
    if (!uploadedData) {
      addLog('❌ No data to upload');
      return;
    }

    if (!destProjectId || !destApiKey) {
      addLog('❌ Please enter destination credentials');
      return;
    }

    setIsProcessing(true);
    addLog('Starting data import...');

    try {
      const result = await importSupabaseData(destProjectId, destApiKey, uploadedData);
      addLog(`Upload complete: ${result.success} successful, ${result.failed} failed`);
      
      if (result.failed === 0) {
        addLog('✓ All data imported successfully!');
      }
    } catch (error: any) {
      addLog(`❌ Data upload failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Supabase Migration Tool</h1>
        <p className="text-gray-600 mt-2">Automated schema creation and data migration</p>
      </div>

      {/* Warning Banner */}
      <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex gap-3">
        <AlertTriangle size={20} className="text-yellow-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-yellow-800">
          <p className="font-medium">3-Stage Workflow</p>
          <ol className="list-decimal list-inside mt-1 text-xs space-y-1">
            <li>Upload export file from source Supabase</li>
            <li>Auto-generate and execute schema creation</li>
            <li>Import data to destination</li>
          </ol>
        </div>
      </div>

      {/* Steps Progress */}
      <div className="mb-8">
        <div className="flex items-center gap-2">
          {steps.map((step, idx) => (
            <React.Fragment key={step.id}>
              <button
                onClick={() => setCurrentStep(step.id)}
                className={`flex-1 p-3 rounded-lg font-medium transition-all ${
                  currentStep === step.id
                    ? 'bg-blue-600 text-white shadow-lg'
                    : step.completed
                    ? 'bg-green-100 text-green-900'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{step.title}</span>
                  {step.completed && <CheckCircle2 size={18} />}
                </div>
              </button>
              {idx < steps.length - 1 && <ChevronRight size={20} className="text-gray-400" />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Step 1: Upload Export */}
      {currentStep === 1 && (
        <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Step 1: Upload Export File</h2>

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <Upload size={40} className="mx-auto text-gray-400 mb-2" />
            <p className="text-gray-700 font-medium mb-4">
              Drop your Supabase export here or click to browse
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.sql"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Browse Files
            </button>
            <p className="text-xs text-gray-500 mt-4">
              Supported formats: JSON, SQL
            </p>
          </div>

          {uploadedData && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex gap-3">
              <CheckCircle2 size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-green-800">
                <p className="font-medium">File loaded successfully</p>
                <p className="text-xs mt-1">
                  {uploadedData.length} tables with {uploadedData.reduce((sum, t) => sum + t.data.length, 0)} total rows
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Create Schema */}
      {currentStep === 2 && uploadedData && (
        <div className="space-y-6">
          <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 space-y-4">
            <h2 className="text-xl font-semibold text-gray-900">Step 2: Create Schema in Destination</h2>

            {/* Destination Credentials */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Destination Project ID
                </label>
                <input
                  type="text"
                  value={destProjectId}
                  onChange={(e) => setDestProjectId(e.target.value)}
                  placeholder="e.g., mmuverimunvkrpoarwqz"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Destination API Key
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={destApiKey}
                    onChange={(e) => setDestApiKey(e.target.value)}
                    placeholder="Your Supabase API key"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-700"
                  >
                    {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Auto Schema Generator */}
            {destProjectId && destApiKey && (
              <AutoCreateSchema
                tableDataArray={uploadedData}
                destinationProjectId={destProjectId}
                destinationApiKey={destApiKey}
              />
            )}

            {!destProjectId || !destApiKey ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
                <AlertCircle size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium">Enter destination credentials first</p>
                  <p className="text-xs mt-1">Fill in your destination Supabase project ID and API key above</p>
                </div>
              </div>
            ) : (
              <button
                onClick={handleSchemaCreation}
                disabled={isProcessing}
                className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
              >
                {isProcessing ? 'Creating Schema...' : 'Verify & Create Schema'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Upload Data */}
      {currentStep === 3 && uploadedData && (
        <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Step 3: Upload Data</h2>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex gap-3">
            <CheckCircle2 size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-green-800">
              <p className="font-medium">Schema is ready</p>
              <p className="text-xs mt-1">
                Click below to import {uploadedData.reduce((sum, t) => sum + t.data.length, 0)} rows into {uploadedData.length} tables
              </p>
            </div>
          </div>

          <button
            onClick={handleDataUpload}
            disabled={isProcessing}
            className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
          >
            {isProcessing ? 'Uploading...' : 'Start Data Upload'}
          </button>

          {uploadProgress > 0 && (
            <div className="w-full bg-gray-200 rounded-lg overflow-hidden">
              <div
                style={{ width: `${uploadProgress}%` }}
                className="bg-blue-600 h-2 transition-all duration-300"
              ></div>
            </div>
          )}
        </div>
      )}

      {/* Logs Panel */}
      <div className="mt-8 border border-gray-300 rounded-lg overflow-hidden">
        <div className="bg-gray-100 px-4 py-2 border-b border-gray-300 flex justify-between items-center">
          <span className="font-medium text-gray-700">Operation Logs</span>
          <button
            onClick={() => setLogs([])}
            className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 hover:bg-gray-200 rounded"
          >
            Clear
          </button>
        </div>
        <div className="bg-gray-900 text-green-400 p-4 font-mono text-xs max-h-64 overflow-y-auto space-y-1">
          {logs.length === 0 ? (
            <p className="text-gray-500">Waiting for operations...</p>
          ) : (
            logs.map((log, idx) => (
              <div key={idx} className="whitespace-pre-wrap break-words">
                {log}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
