"use client";

import React, { createContext, useContext, useEffect, useState, useRef } from 'react'; // Added useRef
import { Session, User, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';

interface SessionContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  userType: string | null;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  console.log('SessionContextProvider: Component rendering.');
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userType, setUserType] = useState<string | null>(null);

  // Use refs to store previous user/session IDs to prevent unnecessary state updates
  const prevUserIdRef = useRef<string | undefined>(undefined);
  const prevSessionIdRef = useRef<string | undefined>(undefined);

  const updateSessionAndProfileStates = async (currentSession: Session | null) => {
    console.log('SessionContext: updateSessionAndProfileStates started.');

    const newUserId = currentSession?.user?.id;
    const newSessionId = currentSession?.access_token; // Using access_token as a session identifier

    // Only update session/user if their IDs have actually changed
    if (newSessionId !== prevSessionIdRef.current) {
      setSession(currentSession);
      prevSessionIdRef.current = newSessionId;
      console.log('SessionContext: Session updated.');
    }

    if (newUserId !== prevUserIdRef.current) {
      setUser(currentSession?.user || null);
      prevUserIdRef.current = newUserId;
      console.log('SessionContext: User updated.');

      // Reset profile states before fetching new ones
      let newIsAdmin = false;
      let newUserType: string | null = null;

      if (currentSession?.user) {
        console.log('SessionContext: Attempting to fetch user profile for ID:', currentSession.user.id);
        const { data, error } = await supabase
          .from('profiles')
          .select('is_admin, user_type')
          .eq('id', currentSession.user.id)
          .single();

        if (error) {
          console.error('SessionContext: Error fetching user profile:', error.message);
          showError(`Failed to load user profile: ${error.message}`);
        } else {
          console.log('SessionContext: User profile fetched successfully:', data);
          newIsAdmin = data?.is_admin || false;
          newUserType = data?.user_type || 'sales_person';
        }
      }

      // Only update state if values are actually different to prevent unnecessary re-renders
      if (newIsAdmin !== isAdmin) {
        setIsAdmin(newIsAdmin);
        console.log('SessionContext: isAdmin updated to', newIsAdmin);
      }
      if (newUserType !== userType) {
        setUserType(newUserType);
        console.log('SessionContext: userType updated to', newUserType);
      }
    } else {
      console.log('SessionContext: User ID and Session ID are unchanged. Skipping profile fetch and state updates.');
    }
    console.log('SessionContext: updateSessionAndProfileStates completed.');
  };

  useEffect(() => {
    console.log('SessionContextProvider: useEffect for auth state change listener mounted.');

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, currentSession: Session | null) => {
        console.log('SessionContext: Auth event received:', event, 'Session:', currentSession);
        try {
          if (event === 'SIGNED_OUT') {
            setSession(null);
            setUser(null);
            setIsAdmin(false);
            setUserType(null);
            prevUserIdRef.current = undefined; // Clear refs on sign out
            prevSessionIdRef.current = undefined;
            setLoading(false);
            console.log('SessionContext: SIGNED_OUT event processed. Loading set to false.');
          } else {
            await updateSessionAndProfileStates(currentSession);
            setLoading(false);
            console.log('SessionContext: Auth event processed. Loading set to false.');
          }
        } catch (error: any) {
          console.error('SessionContext: Error in onAuthStateChange handler:', error);
          showError(`Authentication error: ${error.message}`);
          setLoading(false);
        }
      }
    );

    console.log('SessionContext: Performing initial getSession check.');
    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      console.log('SessionContext: Initial getSession result:', initialSession);
      await updateSessionAndProfileStates(initialSession);
      setLoading(false);
      console.log('SessionContext: Initial getSession completed. Loading set to false.');
    }).catch(error => {
      console.error('SessionContext: Error during initial getSession promise:', error);
      showError(`Failed to load session: ${error.message}`);
      setLoading(false);
    });

    return () => {
      console.log('SessionContext: Cleaning up auth state change listener.');
      authListener.subscription.unsubscribe();
    };
  }, []);

  return (
    <SessionContext.Provider value={{ session, user, loading, isAdmin, userType }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionContextProvider');
  }
  return context;
};