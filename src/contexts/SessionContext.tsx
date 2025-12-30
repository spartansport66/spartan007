"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { showLoading, dismissToast, showError } from '@/utils/toast';

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
  const navigate = useNavigate();

  const fetchUserProfile = async (userId: string) => {
    console.log('SessionContext: Attempting to fetch user profile for ID:', userId);
    const { data, error } = await supabase
      .from('profiles')
      .select('is_admin, user_type')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('SessionContext: Error fetching user profile:', error.message);
      showError(`Failed to load user profile: ${error.message}`);
      setIsAdmin(false);
      setUserType(null);
    } else {
      console.log('SessionContext: User profile fetched successfully:', data);
      setIsAdmin(data?.is_admin || false);
      setUserType(data?.user_type || 'sales_person');
    }
  };

  useEffect(() => {
    let toastId: string | undefined;
    console.log('SessionContext: useEffect for auth state change listener mounted.');

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, currentSession: Session | null) => {
        console.log('SessionContext: Auth event received:', event, 'Session:', currentSession);
        try {
          switch (event) {
            case 'SIGNED_IN':
              setSession(currentSession);
              setUser(currentSession?.user || null);
              if (currentSession?.user) {
                await fetchUserProfile(currentSession.user.id);
              }
              if (toastId) dismissToast(toastId);
              break;
            case 'SIGNED_OUT':
              setSession(null);
              setUser(null);
              setIsAdmin(false);
              setUserType(null);
              if (toastId) dismissToast(toastId);
              navigate('/login');
              break;
            case 'INITIAL_SESSION':
              setSession(currentSession);
              setUser(currentSession?.user || null);
              if (currentSession?.user) {
                await fetchUserProfile(currentSession.user.id);
              }
              break;
            case 'USER_UPDATED':
              setUser(currentSession?.user || null);
              if (currentSession?.user) {
                await fetchUserProfile(currentSession.user.id);
              }
              break;
            case 'PASSWORD_RECOVERY':
              showLoading('Password recovery initiated. Check your email.');
              break;
            case 'TOKEN_REFRESHED':
              break;
            default:
              console.warn('SessionContext: Unhandled auth event:', event);
          }
        } catch (error: any) {
          console.error('SessionContext: Error in onAuthStateChange handler:', error);
          showError(`Authentication error: ${error.message}`);
        } finally {
          console.log('SessionContext: onAuthStateChange handler finished. Setting loading to false.');
          setLoading(false); // Ensure loading is always set to false after any auth event
        }
      }
    );

    // Initial session check
    console.log('SessionContext: Performing initial getSession check.');
    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      console.log('SessionContext: Initial getSession result:', initialSession);
      setSession(initialSession);
      setUser(initialSession?.user || null);
      if (initialSession?.user) {
        await fetchUserProfile(initialSession.user.id);
      }
    }).catch(error => {
      console.error('SessionContext: Error during initial getSession promise:', error);
      showError(`Failed to load session: ${error.message}`);
    }).finally(() => {
      console.log('SessionContext: Initial getSession promise finished. Setting loading to false.');
      setLoading(false); // Ensure loading is set to false after initial session check completes, regardless of success or failure
    });

    return () => {
      console.log('SessionContext: Cleaning up auth state change listener.');
      authListener.subscription.unsubscribe();
      if (toastId) dismissToast(toastId);
    };
  }, [navigate]);

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