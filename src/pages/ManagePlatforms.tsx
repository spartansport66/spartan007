"use client";
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { ArrowLeft } from 'lucide-react';
import PlatformManager from '@/components/PlatformManager';

const ManagePlatforms = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <div className="w-full max-w-2xl">
        <Button 
          variant="outline" 
          onClick={() => navigate('/admin-dashboard')} 
          className="mb-6 flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Admin Dashboard
        </Button>
        
        <PlatformManager />
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default ManagePlatforms;