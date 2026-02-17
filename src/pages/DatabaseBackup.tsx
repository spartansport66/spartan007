"use client";

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { ArrowLeft, Database, Download, Loader2, CheckCircle, AlertTriangle, ShieldCheck, FileCode } from 'lucide-react';
import { useSession } from '@/contexts/SessionContext';
import { generateFullBackup, downloadBackupFile, generateSqlDump, downloadSqlDumpFile } from '@/utils/backup';
import { showSuccess, showError } from '@/utils/toast';
import { Progress } from '@/components/ui/progress';

const DatabaseBackup = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: sessionLoading } = useSession();
  const [isGenerating, setIsGenerating] = useState(false);
  const [exportType, setExportType] = useState<'json' | 'sql' | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentTable, setCurrentTable] = useState("");

  const handleDownloadJson = async () => {
    setIsGenerating(true);
    setExportType('json');
    setProgress(0);
    try {
      const backupData = await generateFullBackup((table, index, total) => {
        setCurrentTable(table);
        setProgress(Math.round(((index + 1) / total) * 100));
      });

      downloadBackupFile(backupData);
      showSuccess("JSON backup generated and download started.");
    } catch (error: any) {
      console.error("Backup generation failed:", error);
      showError(`Failed to generate backup: ${error.message}`);
    } finally {
      setIsGenerating(false);
      setCurrentTable("");
    }
  };

  const handleDownloadSql = async () => {
    setIsGenerating(true);
    setExportType('sql');
    setProgress(0);
    try {
      const sqlDump = await generateSqlDump((table, index, total) => {
        setCurrentTable(table);
        setProgress(Math.round(((index + 1) / total) * 100));
      });

      downloadSqlDumpFile(sqlDump);
      showSuccess("SQL Dump generated and download started.");
    } catch (error: any) {
      console.error("SQL Dump generation failed:", error);
      showError(`Failed to generate SQL dump: ${error.message}`);
    } finally {
      setIsGenerating(false);
      setCurrentTable("");
    }
  };

  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
        <p className="text-muted-foreground mb-6">Only administrators can perform database backups.</p>
        <Button onClick={() => navigate('/dashboard')}>Return to Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <div className="w-full max-w-4xl">
        <Button 
          variant="outline" 
          onClick={() => navigate('/admin-dashboard')} 
          className="mb-6 flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Admin Dashboard
        </Button>

        <Card className="shadow-xl border-2 border-primary/10">
          <CardHeader className="bg-primary text-primary-foreground rounded-t-lg">
            <div className="flex items-center gap-3">
              <Database className="h-8 w-8" />
              <div>
                <CardTitle className="text-2xl">Database Backup Management</CardTitle>
                <CardDescription className="text-primary-foreground/80">
                  Export all application data and structure for offline storage or account migration.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* JSON Option */}
              <div className="bg-muted/30 p-6 rounded-xl border flex flex-col items-center justify-center text-center">
                <Download className="h-10 w-10 text-blue-600 mb-4" />
                <h4 className="font-bold mb-2">JSON Backup (Data Only)</h4>
                <p className="text-xs text-muted-foreground mb-6">
                  Best for viewing data in Excel or custom scripts. Includes all records from 35+ tables.
                </p>
                <Button 
                  variant="outline"
                  onClick={handleDownloadJson} 
                  disabled={isGenerating}
                  className="w-full"
                >
                  {isGenerating && exportType === 'json' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : 'Download JSON'}
                </Button>
              </div>

              {/* SQL Option */}
              <div className="bg-muted/30 p-6 rounded-xl border flex flex-col items-center justify-center text-center border-primary/20">
                <FileCode className="h-10 w-10 text-green-600 mb-4" />
                <h4 className="font-bold mb-2">SQL Dump (Schema + Data)</h4>
                <p className="text-xs text-muted-foreground mb-6">
                  Best for **Account Migration**. Includes table structures, policies, functions, and all data.
                </p>
                <Button 
                  onClick={handleDownloadSql} 
                  disabled={isGenerating}
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                >
                  {isGenerating && exportType === 'sql' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : 'Download SQL Dump'}
                </Button>
              </div>
            </div>

            {isGenerating && (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="flex justify-between text-sm font-medium">
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Processing: <span className="font-mono text-primary">{currentTable}</span>
                  </span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}

            {!isGenerating && progress === 100 && (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-3 text-green-800 dark:text-green-200">
                <CheckCircle className="h-5 w-5" />
                <p className="text-sm font-medium">
                  {exportType === 'sql' ? 'SQL Dump' : 'JSON Backup'} successfully generated and downloaded.
                </p>
              </div>
            )}

            <div className="space-y-4 pt-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-green-600" />
                How to use the SQL Dump
              </h3>
              <ol className="list-decimal pl-5 space-y-2 text-sm text-muted-foreground">
                <li>Create a brand new project in your new Supabase account.</li>
                <li>Open the **SQL Editor** in the new project dashboard.</li>
                <li>Open the downloaded `.sql` file in a text editor (like Notepad).</li>
                <li>Copy all the text and paste it into the Supabase SQL Editor.</li>
                <li>Click **Run**. Your entire database structure and data will be recreated!</li>
              </ol>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 p-4 border rounded-lg bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-900/50">
          <h4 className="text-sm font-bold text-yellow-800 dark:text-yellow-500 flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4" />
            Important Note
          </h4>
          <p className="text-xs text-yellow-700 dark:text-yellow-600 leading-relaxed">
            The SQL dump includes all public data and logic. However, it does **not** include the actual user accounts (emails/passwords) from Supabase Auth, as those are managed separately by Supabase. You will need to re-invite your users to the new account.
          </p>
        </div>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default DatabaseBackup;