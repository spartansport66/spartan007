"use client";
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { showSuccess, showError } from '@/utils/toast';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { ArrowLeft, Loader2, Camera, Upload, CheckCircle, Target } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from '@capacitor/camera';

const DAILY_VISIT_GOAL = 10;

interface Dealer {
  id: string;
  name: string;
}

const VISIT_STATUS_OPTIONS = ['Routine Visit', 'Payment Reminder Visit', 'New Order'];

// Define a custom schema for the file input
const fileSchema = z.instanceof(File, { message: 'A photo is required.' })
  .refine(file => file.size > 0, { message: 'File cannot be empty.' });

const formSchema = z.object({
  dealerId: z.string().uuid({ message: 'Please select a dealer.' }),
  visitStatus: z.enum(VISIT_STATUS_OPTIONS as [string, ...string[]], { message: 'Please select a status.' }),
  remarks: z.string().min(1, { message: 'Remarks are required.' }).max(500, { message: 'Remarks cannot exceed 500 characters.' }),
  photoFile: fileSchema, // Use the custom file schema
  nextVisitDate: z.string().min(1, { message: 'Next Follow-up Date is required.' }),
});

const getStartOfUTCDayISO = () => {
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  return now.toISOString();
};

// --- Image Compression Utility ---
const compressImage = (file: File, maxWidth: number = 800, quality: number = 0.7): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = height * (maxWidth / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error("Could not get canvas context."));
        }
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (!blob) {
            return reject(new Error("Canvas to Blob conversion failed."));
          }
          // Create a new File object from the compressed blob
          const compressedFile = new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          resolve(compressedFile);
        }, 'image/jpeg', quality);
      };
      img.onerror = (error) => reject(new Error("Error loading image for compression."));
    };
    reader.onerror = (error) => reject(new Error("Error reading file for compression."));
  });
};
// ---------------------------------

const DailyVisitReport: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: sessionLoading, isAdmin } = useSession();
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [dealerSearch, setDealerSearch] = useState('');
  const [loadingData, setLoadingData] = useState(true);
  const [visitsToday, setVisitsToday] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null); // New state for file name

  const filteredDealers = useMemo(() => {
    if (!dealerSearch) return dealers;
    const cleanedQuery = dealerSearch.trim().toLowerCase();
    return dealers.filter((dealer) => dealer.name.toLowerCase().includes(cleanedQuery));
  }, [dealerSearch, dealers]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      dealerId: '',
      visitStatus: 'Routine Visit',
      remarks: '',
      photoFile: undefined,
      nextVisitDate: '', // Default to empty string
    },
  });

  const fetchInitialData = useCallback(async () => {
    if (!user) return;
    setLoadingData(true);
    try {
      // 1. Fetch assigned dealers
      const { data: assignedDealersData, error: assignedDealersError } = await supabase
        .from('dealer_sales_persons')
        .select('dealers(id, name)')
        .eq('sales_person_id', user.id);

      if (assignedDealersError) throw assignedDealersError;
      
      const formattedDealers: Dealer[] = (assignedDealersData || []).map((item: any) => item.dealers);
      const sortedDealers = formattedDealers.sort((a, b) => a.name.localeCompare(b.name));
      setDealers(sortedDealers);

      // 2. Fetch today's visits count
      const startOfToday = getStartOfUTCDayISO();
      const { count, error: countError } = await supabase
        .from('sales_person_visits')
        .select('id', { count: 'exact', head: true })
        .eq('sales_person_id', user.id)
        .gte('visit_time', startOfToday);

      if (countError) throw countError;
      setVisitsToday(count || 0);

    } catch (error: any) {
      console.error('Error fetching initial data:', error.message);
      showError(`Failed to load data: ${error.message}`);
    } finally {
      setLoadingData(false);
    }
  }, [user]);

  const handleCameraCapture = async () => {
    try {
      const photo = await CapacitorCamera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
      });

      if (photo.webPath) {
        // Fetch the image blob from the web path
        const response = await fetch(photo.webPath);
        const blob = await response.blob();

        // Create a File object from the blob
        const timestamp = Date.now();
        const fileName = `camera_${timestamp}.jpg`;
        const file = new File([blob], fileName, { type: 'image/jpeg' });

        // Update form and state
        form.setValue('photoFile', file as any, { shouldValidate: true });
        setSelectedFileName(fileName);
        showSuccess('Photo captured successfully!');
      }
    } catch (error: any) {
      console.error('Camera error:', error);
      showError('Failed to capture photo. Please try again.');
    }
  };

  useEffect(() => {
    if (!sessionLoading) {
      if (!user) {
        navigate('/login');
      } else if (isAdmin) {
        showError('Access Denied: Admins do not log visits here.');
        navigate('/admin-dashboard');
      } else {
        fetchInitialData();
      }
    }
  }, [sessionLoading, user, isAdmin, navigate, fetchInitialData]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) {
      showError('User not authenticated.');
      return;
    }
    setIsSubmitting(true);

    try {
      const originalFile = values.photoFile as File;
      
      // --- STEP 1: Compress and Resize Image ---
      const compressedFile = await compressImage(originalFile, 800, 0.7);
      
      const dealerName = dealers.find(d => d.id === values.dealerId)?.name || 'unknown';
      const fileExt = compressedFile.name.split('.').pop() || 'jpg';
      // Use user ID as the first folder name for RLS
      const filePath = `${user.id}/${Date.now()}_${dealerName.replace(/\s/g, '_')}.${fileExt}`;

      // 2. Upload compressed photo to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('visit-photos')
        .upload(filePath, compressedFile, {
          cacheControl: '3600',
          upsert: false,
          contentType: 'image/jpeg', // Ensure correct content type for compressed file
        });

      if (uploadError) {
        throw new Error(`Photo upload failed: ${uploadError.message}`);
      }

      // 3. Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('visit-photos')
        .getPublicUrl(filePath);

      // 4. Insert visit record
      const { error: insertError } = await supabase
        .from('sales_person_visits')
        .insert({
          sales_person_id: user.id,
          dealer_id: values.dealerId,
          visit_time: new Date().toISOString(),
          photo_url: publicUrl,
          visit_status: values.visitStatus,
          remarks: values.remarks, // Remarks is now guaranteed to be a non-empty string
          next_visit_date: values.nextVisitDate,
        });

      if (insertError) {
        // Attempt to delete the uploaded file if DB insertion fails
        await supabase.storage.from('visit-photos').remove([filePath]);
        throw new Error(`Log record failed: ${insertError.message}`);
      }

      showSuccess(`Activity logged successfully for ${dealerName}!`);
      form.reset({ dealerId: '', visitStatus: 'Routine Visit', remarks: '', photoFile: undefined, nextVisitDate: '' });
      setSelectedFileName(null); // Clear file name state
      fetchInitialData(); // Refresh progress
    } catch (error: any) {
      console.error('Error logging activity:', error);
      showError(`Failed to log activity: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const progressPercentage = Math.min(100, (visitsToday / DAILY_VISIT_GOAL) * 100);
  const isGoalMet = visitsToday >= DAILY_VISIT_GOAL;

  if (sessionLoading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading report...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-1 sm:p-2 flex flex-col items-center overflow-y-auto">
      <div className="w-full max-w-md sm:max-w-lg">
        
        <Card className="bg-card text-card-foreground shadow-lg">
          <CardHeader className="p-1">
            <CardDescription className="text-muted-foreground text-xs">
              Record daily activity
            </CardDescription>
          </CardHeader>
          <CardContent className="p-1">
            <div className="mb-2 space-y-1 p-1 border rounded-lg bg-muted/50">
              <h3 className="text-xs font-semibold flex items-center gap-1">
                <Target className="h-2.5 w-2.5 text-green-600" /> Goal
              </h3>
              <div className="flex justify-between items-center text-xs">
                <span className="font-medium">Done: {visitsToday} / {DAILY_VISIT_GOAL}</span>
                {isGoalMet && <CheckCircle className="h-3 w-3 text-green-600" />}
              </div>
              <Progress value={progressPercentage} className="w-full h-1" indicatorColor={isGoalMet ? "bg-green-600" : "bg-yellow-500"} />
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-1">
                <FormField
                  control={form.control}
                  name="dealerId"
                  render={({ field }) => (
                    <FormItem>
                              <FormLabel className="text-xs">Dealer</FormLabel>
                      <Select value={field.value} onValueChange={(value) => { field.onChange(value); setDealerSearch(''); }} disabled={dealers.length === 0 || isSubmitting}>
                        <FormControl>
                          <SelectTrigger className="h-6 text-xs">
                            <SelectValue placeholder={dealers.length === 0 ? "No dealers" : "Search by name"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="text-xs">
                          <div className="px-2 py-2">
                            <Input
                              type="text"
                              placeholder="Search dealers..."
                              value={dealerSearch}
                              onChange={(e) => setDealerSearch(e.target.value)}
                              className="w-full text-xs"
                            />
                          </div>
                          <div className="border-t border-muted" />
                          {filteredDealers.length > 0 ? (
                            filteredDealers.map((dealer, index) => (
                              <SelectItem key={dealer.id} value={dealer.id} className="text-xs">
                                {index + 1}. {dealer.name}
                              </SelectItem>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-xs text-muted-foreground">No dealers found.</div>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-2 gap-2">
                  <FormField
                    control={form.control}
                    name="visitStatus"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isSubmitting}>
                          <FormControl>
                            <SelectTrigger className="h-6 text-xs">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="text-xs">
                            {VISIT_STATUS_OPTIONS.map((status) => (
                              <SelectItem key={status} value={status} className="text-xs">
                                {status}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="nextVisitDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Follow-up Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} disabled={isSubmitting} className="h-6 text-xs" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="remarks"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Notes</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Notes..." {...field} disabled={isSubmitting} className="text-xs h-12 resize-none" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="photoFile"
                  render={({ field: { value, onChange, ...fieldProps } }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1 text-xs">
                        <Camera className="h-2.5 w-2.5" /> Photo
                      </FormLabel>
                      <div className="flex gap-1">
                        <FormControl className="flex-1">
                          <Input
                            {...fieldProps}
                            type="file"
                            accept="image/*"
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (file) {
                                form.setValue('photoFile', file, { shouldValidate: true });
                                setSelectedFileName(file.name);
                              } else {
                                form.setValue('photoFile', null as any, { shouldValidate: true });
                                setSelectedFileName(null);
                              }
                            }}
                            disabled={isSubmitting}
                            className="text-xs h-6"
                          />
                        </FormControl>
                        <Button
                          type="button"
                          onClick={handleCameraCapture}
                          disabled={isSubmitting}
                          className="h-6 text-xs px-2 bg-blue-600 hover:bg-blue-700"
                        >
                          <Camera className="h-3 w-3" />
                        </Button>
                      </div>
                      {selectedFileName && (
                        <p className="text-xs text-muted-foreground mt-0.5">{selectedFileName}</p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-6 text-xs mt-3" disabled={isSubmitting || !form.formState.isValid}>
                  {isSubmitting ? (
                    <Loader2 className="mr-1 h-2.5 w-2.5 animate-spin" />
                  ) : (
                    <>
                      <Upload className="mr-1 h-2.5 w-2.5" /> Log
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default DailyVisitReport;