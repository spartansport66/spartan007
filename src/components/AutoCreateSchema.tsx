import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Copy, Download, Book, Zap } from 'lucide-react';
import { generateCreateTableSQL } from '@/utils/supabaseMigration';

interface TableData {
  tableName: string;
  columns: any[];
  data: any[];
}

interface AutoCreateSchemaProps {
  tableDataArray: TableData[];
  destinationProjectId: string;
  destinationApiKey: string;
  onSchemaCreated?: () => void;
}

export function AutoCreateSchema({
  tableDataArray,
  destinationProjectId,
  destinationApiKey,
  onSchemaCreated,
}: AutoCreateSchemaProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [sqlCode, setSqlCode] = useState<string>('');
  const [showSql, setShowSql] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [manualInstructions, setManualInstructions] = useState(false);

  const generateSQL = () => {
    setIsGenerating(true);
    try {
      const sql = generateCreateTableSQL(tableDataArray);
      setSqlCode(sql);
      setShowSql(true);
    } catch (error: any) {
      console.error('Error generating SQL:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(sqlCode);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const downloadSQL = () => {
    const element = document.createElement('a');
    const file = new Blob([sqlCode], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `create_schema_${destinationProjectId}_${new Date().toISOString().split('T')[0]}.sql`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const openInSupabase = () => {
    // Construct Supabase SQL Editor URL
    const supabaseUrl = `https://app.supabase.com/project/${destinationProjectId}/sql/new`;
    window.open(supabaseUrl, '_blank');
  };

  return (
    <div className="w-full space-y-4">
      {/* Main Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Generate SQL Button */}
        <button
          onClick={generateSQL}
          disabled={isGenerating || tableDataArray.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
        >
          <Zap size={18} />
          {isGenerating ? 'Generating...' : 'Generate Schema SQL'}
        </button>

        {/* Manual Instructions Button */}
        <button
          onClick={() => setManualInstructions(!manualInstructions)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
        >
          <Book size={18} />
          Manual Instructions
        </button>
      </div>

      {/* Manual Instructions Panel */}
      {manualInstructions && (
        <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded">
          <h3 className="font-semibold text-purple-900 mb-3">Quick Setup Guide</h3>
          <ol className="space-y-2 text-sm text-purple-800 list-decimal list-inside">
            <li>Click "Generate Schema SQL" to create table definitions</li>
            <li>Click "Copy SQL" or "Download SQL"</li>
            <li>Open Supabase SQL Editor or paste into destination database</li>
            <li>Execute the SQL to create all tables</li>
            <li>Return to upload and proceed with data migration</li>
          </ol>
        </div>
      )}

      {/* SQL Display Panel */}
      {showSql && (
        <div className="space-y-3">
          {/* Info Banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-3">
            <AlertCircle size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-700">
              <p className="font-medium">Schema SQL Generated</p>
              <p className="text-xs mt-1">
                Copy this SQL and execute it in your NEW Supabase SQL Editor to automatically create all {tableDataArray.length} tables.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={copyToClipboard}
              className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium transition-colors"
            >
              <Copy size={16} />
              {copySuccess ? 'Copied!' : 'Copy SQL'}
            </button>

            <button
              onClick={downloadSQL}
              className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm font-medium transition-colors"
            >
              <Download size={16} />
              Download SQL
            </button>

            <button
              onClick={openInSupabase}
              className="flex items-center gap-2 px-3 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded text-sm font-medium transition-colors"
            >
              <CheckCircle2 size={16} />
              Open Supabase Editor
            </button>
          </div>

          {/* SQL Code Display */}
          <div className="bg-gray-900 text-gray-100 rounded-lg overflow-hidden border border-gray-700">
            {/* Header */}
            <div className="bg-gray-800 px-4 py-2 flex justify-between items-center border-b border-gray-700">
              <span className="text-xs font-mono text-gray-400">SQL Schema - {tableDataArray.length} tables</span>
              <span className="text-xs text-gray-500">{sqlCode.split('\n').length} lines</span>
            </div>

            {/* Code Content */}
            <pre className="px-4 py-3 overflow-x-auto text-xs font-mono whitespace-pre-wrap break-words max-h-96">
              <code>{sqlCode}</code>
            </pre>
          </div>

          {/* Copy Instructions */}
          <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded border border-gray-200">
            <p className="font-medium mb-1">Next Steps:</p>
            <ol className="list-decimal list-inside space-y-1 text-gray-700">
              <li>Click <strong>Copy SQL</strong> to copy all CREATE TABLE statements</li>
              <li>Click <strong>Open Supabase Editor</strong> to open your destination project</li>
              <li>Paste the SQL into a new query and execute it</li>
              <li>Return here and proceed with data upload</li>
            </ol>
          </div>
        </div>
      )}

      {/* Summary Info */}
      {!showSql && tableDataArray.length > 0 && (
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-sm text-gray-700">
          <p>
            <strong>{tableDataArray.length} tables</strong> ready to be created in destination database
          </p>
          <p className="text-xs text-gray-600 mt-1">
            Click "Generate Schema SQL" to create the table creation statements
          </p>
        </div>
      )}
    </div>
  );
}
