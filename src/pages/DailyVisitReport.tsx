"use client";
import React, { useState, useEffect, useCallback } from 'react';
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

const DAILY_VISIT_GOAL = 5;

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
  visitStatus: z.enum(VISIT_STATUS_OPTIONS as [string, ...string[]], { message: 'Please select a visit status.' }),
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
  const [loadingData, setLoadingData] = useState(true);
  const [visitsToday, setVisitsToday] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      setDealers(formattedDealers);

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
        throw new Error(`Visit record failed: ${insertError.message}`);
      }

      showSuccess(`Visit logged successfully for ${dealerName}!`);
      form.reset({ dealerId: '', visitStatus: 'Routine Visit', remarks: '', photoFile: undefined, nextVisitDate: '' });
      fetchInitialData(); // Refresh progress
    } catch (error: any) {
      console.error('Error logging visit:', error);
      showError(`Failed to log visit: ${error.message}`);
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
        <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading visit report...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <div className="w-full max-w-md sm:max-w-lg">
        <Button 
          variant="outline" 
          onClick={() => navigate('/dashboard')} 
          className="mb-6 flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
        
        <Card className="bg-card text-card-foreground shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-primary">Log Daily Dealer Visit</CardTitle>
            <CardDescription className="text-muted-foreground">
              Record your visit and capture a photo for verification.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-6 space-y-3 p-4 border rounded-lg bg-muted/50">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Target className="h-5 w-5 text-green-600" /> Daily Goal Progress
              </h3>
              <div className="flex justify-between items-center">
                <span className="font-medium">Visits Today: {visitsToday} / {DAILY_VISIT_GOAL}</span>
                {isGoalMet && <CheckCircle className="h-6 w-6 text-green-600" />}
              </div>
              <Progress value={progressPercentage} className="w-full" indicatorColor={isGoalMet ? "bg-green-600" : "bg-yellow-500"} />
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="dealerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Select Dealer</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} disabled={dealers.length === 0 || isSubmitting}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={dealers.length === 0 ? "No dealers assigned" : "Select a dealer"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {dealers.map((dealer) => (
                            <SelectItem key={dealer.id} value={dealer.id}>
                              {dealer.name}
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
                  name="visitStatus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Visit Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isSubmitting}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select visit status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {VISIT_STATUS_OPTIONS.map((status) => (
                            <SelectItem key={status} value={status}>
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
                  name="remarks"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Remarks (Required)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Any notes about the visit..." {...field} disabled={isSubmitting} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="nextVisitDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Next Follow-up Date (Required)</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} disabled={isSubmitting} />
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
                      <FormLabel className="flex items-center gap-2">
                        <Camera className="h-4 w-4" /> Dealer Photo (Required)
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...fieldProps}
                          type="file"
                          accept="image/*"
                          capture="environment" // Suggest using the rear camera on mobile
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            // Manually set the file object in the form state
                            onChange(file);
                          }}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <FormLabel>Visit Time</FormLabel>
                  <Input 
                    type="text" 
                    value={new Date().toLocaleString()} 
                    readOnly 
                    className="bg-muted" 
                  />
                  <p className="text-xs text-muted-foreground">Time is automatically recorded upon submission.</p>
                </div>
                
                <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={isSubmitting || !form.formState.isValid}>
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" /> Log Visit
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