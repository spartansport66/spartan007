"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { Database, Settings, RefreshCw, ArrowRight, Upload, Cloud } from 'lucide-react';

const AdminUtils = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-2">Admin Utilities</h1>
          <p className="text-lg text-muted-foreground">Quick access to database and project management tools</p>
        </div>

        {/* Tools Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Database Migration Card */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Database className="h-8 w-8 text-blue-500" />
                  <div>
                    <CardTitle>Database Backup & Migration</CardTitle>
                    <CardDescription>Backup, export and restore your database</CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Export your database to create backups or migrate data to another system. You can also restore from existing backups.
              </p>
              <Button 
                onClick={() => navigate('/database-migration')}
                className="w-full"
              >
                <Database className="h-4 w-4 mr-2" />
                Open Database Migration Tool
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>

          {/* Project Setup Wizard Card */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Settings className="h-8 w-8 text-green-500" />
                  <div>
                    <CardTitle>Project Setup Wizard</CardTitle>
                    <CardDescription>Create a complete project copy with auto-setup</CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Automatically create a complete copy of your project across Supabase, GitHub, and Vercel with just a few credentials.
              </p>
              <Button 
                onClick={() => navigate('/project-setup-wizard')}
                className="w-full"
              >
                <Settings className="h-4 w-4 mr-2" />
                Open Project Setup Wizard
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>

          {/* Automatic Migration Card */}
          <Card className="hover:shadow-lg transition-shadow border-2 border-blue-500">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Cloud className="h-8 w-8 text-blue-600 animate-pulse" />
                  <div>
                    <CardTitle className="text-blue-600">⚡ FULLY AUTOMATIC Migration</CardTitle>
                    <CardDescription>One-click migration - no manual steps!</CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                <strong>NEW!</strong> Enter your credentials and everything happens automatically. Schema creation, data export, data import, and validation - all in one click!
              </p>
              <Button 
                onClick={() => navigate('/auto-migration')}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                <Cloud className="h-4 w-4 mr-2" />
                Start Automatic Migration
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>

          {/* Upload to New Supabase Card */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Upload className="h-8 w-8 text-purple-500" />
                  <div>
                    <CardTitle>Upload to New Supabase</CardTitle>
                    <CardDescription>Upload backed-up data to new project</CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                <strong>Requires table structure to exist in NEW Supabase first!</strong> Use the Schema export script from Database Backup & Migration to CREATE tables in your new project, then upload the data files here to populate them.
              </p>
              <Button 
                onClick={() => navigate('/upload-to-new-supabase')}
                className="w-full"
              >
                <Upload className="h-4 w-4 mr-2" />
                Open Upload Tool
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Direct Links Section */}
        <div className="mt-12 p-6 bg-muted rounded-lg">
          <h3 className="text-lg font-semibold mb-4">Direct Links</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Database Migration Link:</p>
              <code className="block text-sm bg-background p-3 rounded border">
                {window.location.origin}/database-migration
              </code>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Upload to New Supabase Link:</p>
              <code className="block text-sm bg-background p-3 rounded border">
                {window.location.origin}/upload-to-new-supabase
              </code>
            </div>
          </div>
        </div>

        {/* Back Button */}
        <div className="mt-8">
          <Button 
            variant="outline" 
            onClick={() => navigate('/admin-dashboard')}
          >
            Back to Admin Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AdminUtils;
