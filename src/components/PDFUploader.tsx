"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, FileText, Upload } from 'lucide-react';

interface PDFUploaderProps {
  platformName: string;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  loading: boolean;
  colorClass: string;
  hoverColorClass: string;
}

const PDFUploader: React.FC<PDFUploaderProps> = ({ platformName, onFileUpload, loading, colorClass, hoverColorClass }) => {
  return (
    <Card className="border-2 border-primary/20 shadow-xl">
      <CardHeader className={`${colorClass} text-white rounded-t-lg`}>
        <div className="flex items-center gap-3">
          <FileText className="h-8 w-8" />
          <div>
            <CardTitle className="text-2xl">{platformName} Order Data Extractor</CardTitle>
            <CardDescription className="text-white/80">
              Upload {platformName} Shipping Labels (PDF) to automatically extract order details.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-8">
        <div className="flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/20 rounded-xl p-12 bg-muted/5 hover:bg-muted/10 transition-colors">
          <Upload className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Select {platformName} Label PDF</h3>
          <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
            The system processes the file locally in your browser.
          </p>
          <div className="relative">
            <input
              type="file"
              accept=".pdf"
              onChange={onFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={loading}
            />
            <Button disabled={loading} className={`${colorClass} ${hoverColorClass} min-w-[200px]`}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {loading ? 'Processing PDF...' : 'Upload & Extract'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PDFUploader;