"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Download, Database, FileText, AlertCircle, CheckCircle, Loader2, ExternalLink } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';

interface DatabaseBackupDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

const DatabaseBackupDialog: React.FC<DatabaseBackupDialogProps> = ({ isOpen, onOpenChange }) => {
  const [isDownloading, setIsDownloading] = useState<string | null>(null);

  const backupFiles = [
    {
      name: 'README.md',
      description: 'Complete overview and quick start guide for database migration',
      icon: <FileText className="h-5 w-5" />,
      url: 'https://raw.githubusercontent.com/dyad-sh/spartan/main/database-backup/README.md',
      localPath: '/database-backup/README.md',
      size: '~15 KB',
      type: 'documentation',
    },
    {
      name: 'QUICK_REFERENCE.md',
      description: 'Command cheat sheet for quick migration execution',
      icon: <Database className="h-5 w-5" />,
      url: 'https://raw.githubusercontent.com/dyad-sh/spartan/main/database-backup/QUICK_REFERENCE.md',
      localPath: '/database-backup/QUICK_REFERENCE.md',
      size: '~8 KB',
      type: 'documentation',
    },
    {
      name: 'migration_checklist.md',
      description: 'Detailed step-by-step migration guide with checkboxes',
      icon: <FileText className="h-5 w-5" />,
      url: 'https://raw.githubusercontent.com/dyad-sh/spartan/main/database-backup/migration_checklist.md',
      localPath: '/database-backup/migration_checklist.md',
      size: '~45 KB',
      type: 'documentation',
    },
    {
      name: 'troubleshooting.md',
      description: 'Common issues and solutions for database migration',
      icon: <AlertCircle className="h-5 w-5" />,
      url: 'https://raw.githubusercontent.com/dyad-sh/spartan/main/database-backup/troubleshooting.md',
      localPath: '/database-backup/troubleshooting.md',
      size: '~35 KB',
      type: 'documentation',
    },
    {
      name: 'INDEX.md',
      description: 'Overview of entire database backup system',
      icon: <FileText className="h-5 w-5" />,
      url: 'https://raw.githubusercontent.com/dyad-sh/spartan/main/database-backup/INDEX.md',
      localPath: '/database-backup/INDEX.md',
      size: '~12 KB',
      type: 'documentation',
    },
    {
      name: 'export_schema_policies.sql',
      description: 'SQL script to export database schema and RLS policies',
      icon: <Database className="h-5 w-5" />,
      url: 'https://raw.githubusercontent.com/dyad-sh/spartan/main/database-backup/export_schema_policies.sql',
      localPath: '/database-backup/export_schema_policies.sql',
      size: '~12 KB',
      type: 'sql',
    },
    {
      name: 'export_users_auth.sql',
      description: 'SQL script to export users and authentication data',
      icon: <Database className="h-5 w-5" />,
      url: 'https://raw.githubusercontent.com/dyad-sh/spartan/main/database-backup/export_users_auth.sql',
      localPath: '/database-backup/export_users_auth.sql',
      size: '~10 KB',
      type: 'sql',
    },
    {
      name: 'export_application_data.sql',
      description: 'SQL script to export all application data',
      icon: <Database className="h-5 w-5" />,
      url: 'https://raw.githubusercontent.com/dyad-sh/spartan/main/database-backup/export_application_data.sql',
      localPath: '/database-backup/export_application_data.sql',
      size: '~18 KB',
      type: 'sql',
    },
    {
      name: 'post_migration_fixes.sql',
      description: 'SQL script for post-migration validation and fixes',
      icon: <Database className="h-5 w-5" />,
      url: 'https://raw.githubusercontent.com/dyad-sh/spartan/main/database-backup/post_migration_fixes.sql',
      localPath: '/database-backup/post_migration_fixes.sql',
      size: '~22 KB',
      type: 'sql',
    },
    {
      name: 'migrate-database.ps1',
      description: 'PowerShell automation script for complete migration',
      icon: <Database className="h-5 w-5" />,
      url: 'https://raw.githubusercontent.com/dyad-sh/spartan/main/database-backup/migrate-database.ps1',
      localPath: '/database-backup/migrate-database.ps1',
      size: '~25 KB',
      type: 'script',
    },
    {
      name: 'migrate.bat',
      description: 'Batch file with interactive menu for Windows users',
      icon: <Database className="h-5 w-5" />,
      url: 'https://raw.githubusercontent.com/dyad-sh/spartan/main/database-backup/migrate.bat',
      localPath: '/database-backup/migrate.bat',
      size: '~15 KB',
      type: 'script',
    },
  ];

  const handleDownload = async (file: typeof backupFiles[0]) => {
    setIsDownloading(file.name);
    try {
      // Try local first, then fallback to GitHub
      let response = await fetch(file.localPath).catch(() => null);
      
      if (!response || !response.ok) {
        response = await fetch(file.url);
      }
      
      if (!response?.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      showSuccess(`Downloaded ${file.name}`);
    } catch (error) {
      showError(`Failed to download ${file.name}`);
    } finally {
      setIsDownloading(null);
    }
  };

  const handleDownloadAll = async () => {
    setIsDownloading('all');
    try {
      showSuccess('Preparing download package...');
      
      // Download each file sequentially with delay
      for (let i = 0; i < backupFiles.length; i++) {
        const file = backupFiles[i];
        try {
          let response = await fetch(file.localPath).catch(() => null);
          
          if (!response || !response.ok) {
            response = await fetch(file.url);
          }
          
          if (response?.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = file.name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            
            // Add delay between downloads
            if (i < backupFiles.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 300));
            }
          }
        } catch (err) {
          console.log(`Skipped ${file.name}, continuing...`);
        }
      }
      
      showSuccess('Download package complete!');
    } catch (error) {
      showError('Failed to download all files');
    } finally {
      setIsDownloading(null);
    }
  };

  const documentationFiles = backupFiles.filter(f => f.type === 'documentation');
  const sqlFiles = backupFiles.filter(f => f.type === 'sql');
  const scriptFiles = backupFiles.filter(f => f.type === 'script');

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Database Backup & Migration System
          </DialogTitle>
          <DialogDescription>
            Download all files needed to backup and migrate your Supabase database to another instance with zero reconfiguration
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info Card */}
          <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <CardContent className="p-4 flex gap-3">
              <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900 dark:text-blue-100">
                <p className="font-semibold mb-1">✓ Complete Migration Solution</p>
                <p>All files to export schema, policies, users, authentication, and data. Everything migrates—no reconfiguration needed!</p>
              </div>
            </CardContent>
          </Card>

          {/* Quick Access Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button
              onClick={handleDownloadAll}
              disabled={isDownloading !== null}
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              {isDownloading === 'all' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Downloading...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Download All (11 files)
                </>
              )}
            </Button>
            <Button
              onClick={() => window.open('https://github.com/dyad-sh/spartan/tree/main/database-backup', '_blank')}
              variant="outline"
              className="gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              View on GitHub
            </Button>
          </div>

          {/* Documentation Files */}
          <div>
            <h3 className="font-semibold text-sm mb-2 text-foreground">📚 Documentation Files</h3>
            <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
              {documentationFiles.map((file, index) => (
                <Card key={index} className="hover:bg-accent transition-colors">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="text-primary mt-0.5 flex-shrink-0">
                          {file.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm break-words">{file.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{file.description}</p>
                        </div>
                      </div>
                      <Button
                        onClick={() => handleDownload(file)}
                        disabled={isDownloading !== null}
                        size="sm"
                        variant="outline"
                        className="flex-shrink-0"
                      >
                        {isDownloading === file.name ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* SQL Scripts */}
          <div>
            <h3 className="font-semibold text-sm mb-2 text-foreground">🗄️ SQL Export Scripts</h3>
            <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
              {sqlFiles.map((file, index) => (
                <Card key={index} className="hover:bg-accent transition-colors">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="text-primary mt-0.5 flex-shrink-0">
                          {file.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm break-words">{file.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{file.description}</p>
                        </div>
                      </div>
                      <Button
                        onClick={() => handleDownload(file)}
                        disabled={isDownloading !== null}
                        size="sm"
                        variant="outline"
                        className="flex-shrink-0"
                      >
                        {isDownloading === file.name ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Automation Scripts */}
          <div>
            <h3 className="font-semibold text-sm mb-2 text-foreground">⚙️ Automation Scripts</h3>
            <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
              {scriptFiles.map((file, index) => (
                <Card key={index} className="hover:bg-accent transition-colors">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="text-primary mt-0.5 flex-shrink-0">
                          {file.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm break-words">{file.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{file.description}</p>
                        </div>
                      </div>
                      <Button
                        onClick={() => handleDownload(file)}
                        disabled={isDownloading !== null}
                        size="sm"
                        variant="outline"
                        className="flex-shrink-0"
                      >
                        {isDownloading === file.name ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Quick Steps */}
          <Card className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Quick Start (4 Steps)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex gap-3">
                <span className="font-bold text-amber-700 dark:text-amber-300 flex-shrink-0">1.</span>
                <span>Download all files or start with README.md</span>
              </div>
              <div className="flex gap-3">
                <span className="font-bold text-amber-700 dark:text-amber-300 flex-shrink-0">2.</span>
                <span>Export your current database using the SQL scripts</span>
              </div>
              <div className="flex gap-3">
                <span className="font-bold text-amber-700 dark:text-amber-300 flex-shrink-0">3.</span>
                <span>Create a new Supabase project</span>
              </div>
              <div className="flex gap-3">
                <span className="font-bold text-amber-700 dark:text-amber-300 flex-shrink-0">4.</span>
                <span>Import data and run post-migration fixes</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Close
          </Button>
          <Button onClick={handleDownloadAll} disabled={isDownloading !== null} className="flex-1 gap-2">
            {isDownloading === 'all' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Download All Files
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DatabaseBackupDialog;
