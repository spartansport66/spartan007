"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import DatabaseBackupDialog from '@/components/DatabaseBackupDialog';

const DatabaseMigration = () => {
  const navigate = useNavigate();
  const [isDatabaseBackupDialogOpen, setIsDatabaseBackupDialogOpen] = useState(true);

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Database Backup & Migration</h1>
            <p className="text-muted-foreground mt-2">Export and backup your database, or restore from an existing backup</p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => navigate('/admin-dashboard')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>

        {/* Database Backup Dialog - Always Open on this Page */}
        <DatabaseBackupDialog 
          isOpen={isDatabaseBackupDialogOpen} 
          onOpenChange={setIsDatabaseBackupDialogOpen}
        />

        {/* If dialog is closed, show a message */}
        {!isDatabaseBackupDialogOpen && (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">Database backup dialog has been closed</p>
            <Button 
              onClick={() => setIsDatabaseBackupDialogOpen(true)}
              variant="default"
            >
              Open Dialog Again
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DatabaseMigration;
