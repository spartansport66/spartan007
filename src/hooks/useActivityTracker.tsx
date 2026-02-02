"use client";

import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';

const ACTIVITY_UPDATE_INTERVAL = 300000; // 5 minutes in milliseconds

export function useActivityTracker() {
  const { user, session } = useSession();
  const intervalRef = useRef<number | null>(null);

  const updateActivity = async (userId: string) => {
    try {
      // Use upsert to create or update the last_active_at timestamp
      const { error } = await supabase
        .from('user_activity_logs')
        .upsert(
          { user_id: userId, last_active_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        );

      if (error) {
        console.warn('Failed to update activity log:', error.message);
      }
    } catch (e) {
      console.error('Error updating activity log:', e);
    }
  };

  useEffect(() => {
    if (user && session) {
      // Initial update
      updateActivity(user.id);

      // Set up interval for periodic updates
      intervalRef.current = window.setInterval(() => {
        updateActivity(user.id);
      }, ACTIVITY_UPDATE_INTERVAL);
    } else {
      // Clear interval if user logs out
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    // Cleanup on unmount
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, [user, session]);
}