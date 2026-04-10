"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import ProjectSetupDashboard from '@/components/ProjectSetupDashboard';

const ProjectSetupWizard = () => {
  const navigate = useNavigate();
  const [isProjectSetupDashboardOpen, setIsProjectSetupDashboardOpen] = useState(true);

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Project Setup Wizard</h1>
            <p className="text-muted-foreground mt-2">Create a complete copy of your project with automatic setup across Supabase, GitHub, and Vercel</p>
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

        {/* Project Setup Dashboard - Always Open on this Page */}
        <ProjectSetupDashboard 
          isOpen={isProjectSetupDashboardOpen} 
          onOpenChange={setIsProjectSetupDashboardOpen}
        />

        {/* If dialog is closed, show a message */}
        {!isProjectSetupDashboardOpen && (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">Project setup wizard has been closed</p>
            <Button 
              onClick={() => setIsProjectSetupDashboardOpen(true)}
              variant="default"
            >
              Open Wizard Again
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectSetupWizard;
