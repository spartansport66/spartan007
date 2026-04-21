import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SubscriptionConfig {
  table: string;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  schema?: string;
  onData?: (payload: any) => void;
  onError?: (error: any) => void;
}

export const useSupabaseRealtimeSubscription = (
  configs: SubscriptionConfig[],
  dependencies: any[] = []
) => {
  useEffect(() => {
    const subscriptions: any[] = [];

    configs.forEach((config, index) => {
      const {
        table,
        event = '*',
        schema = 'public',
        onData,
        onError,
      } = config;

      try {
        const subscription = supabase
          .channel(`realtime-${table}-${index}`)
          .on(
            'postgres_changes',
            {
              event,
              schema,
              table,
            },
            (payload: any) => {
              console.log(`Realtime update on ${table}:`, payload);
              if (onData) {
                onData(payload);
              }
            }
          )
          .on('system', {}, (message: any) => {
            if (message.type === 'CHANNEL_ERROR' && onError) {
              onError(new Error(`Channel error: ${message.message}`));
            }
          })
          .subscribe((status: string) => {
            if (status === 'SUBSCRIBED') {
              console.log(`✅ Subscribed to ${table} updates`);
            } else if (status === 'CHANNEL_ERROR' && onError) {
              onError(new Error(`Failed to subscribe to ${table}`));
            }
          });

        subscriptions.push(subscription);
      } catch (error) {
        console.error(`Error setting up subscription for ${table}:`, error);
        if (onError) {
          onError(error);
        }
      }
    });

    return () => {
      subscriptions.forEach((sub) => {
        sub.unsubscribe();
      });
    };
  }, dependencies);
};
