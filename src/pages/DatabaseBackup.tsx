"use client";

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { ArrowLeft, Database, Download, Loader2, CheckCircle, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useSession } from '@/contexts/SessionContext';
import { generateFullBackup, downloadBackupFile } from '@/utils/backup';
import { showSuccess, showError } from '@/utils/toast';
import { Progress } from '@/components/ui/progress';

const DatabaseBackup = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: sessionLoading } = useSession();
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTable, setCurrentTable] = useState("");

  const handleDownloadBackup = async () => {
    setIsGenerating(true);
    setProgress(0);
    try {
      const backupData = await generateFullBackup((table, index, total) => {
        setCurrentTable(table);
        setProgress(Math.round(((index + 1) / total) * 100));
      });

      downloadBackupFile(backupData);
      showSuccess("Database backup generated and download started.");
    } catch (error: any) {
      console.error("Backup generation failed:", error);
      showError(`Failed to generate backup: ${error.message}`);
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
      <div className="w-full max-w-3xl">
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
                  Export all application data to a secure JSON file for offline storage.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-green-600" />
                  Security & Privacy
                </h3>
                <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
                  <li>The backup includes all dealers, products, orders, and financial records.</li>
                  <li>Data is processed locally in your browser and downloaded directly.</li>
                  <li>Store the downloaded file in a secure, encrypted location.</li>
                  <li>Backups do not include user passwords (managed by Supabase Auth).</li>
                </ul>
              </div>
              <div className="bg-muted/30 p-6 rounded-xl border flex flex-col items-center justify-center text-center">
                <Download className="h-12 w-12 text-primary mb-4" />
                <h4 className="font-bold mb-2">Full System Snapshot</h4>
                <p className="text-xs text-muted-foreground mb-6">
                  Generates a comprehensive JSON file containing data from all 35+ system tables.
                </p>
                <Button 
                  onClick={handleDownloadBackup} 
                  disabled={isGenerating}
                  className="w-full py-6 text-lg"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-5 w-5" />
                      Download Backup
                    </>
                  )}
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
                <p className="text-sm font-medium">Backup successfully generated and downloaded.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-8 p-4 border rounded-lg bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-900/50">
          <h4 className="text-sm font-bold text-yellow-800 dark:text-yellow-500 flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4" />
            Important Note
          </h4>
          <p className="text-xs text-yellow-700 dark:text-yellow-600 leading-relaxed">
            This feature is intended for data portability and manual archiving. To restore data from a backup file, please contact technical support or use the Supabase SQL Editor to import the JSON data.
          </p>
        </div>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default DatabaseBackup;