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
  const navigate = useNavigate(); // Keep navigate for potential future use, but not for initial redirects

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
      console.log('SessionContext: Profile fetch error. isAdmin:', false, 'userType:', null);
    } else {
      console.log('SessionContext: User profile fetched successfully:', data);
      setIsAdmin(data?.is_admin || false);
      setUserType(data?.user_type || 'sales_person');
      console.log('SessionContext: Profile updated. isAdmin:', (data?.is_admin || false), 'userType:', (data?.user_type || 'sales_person'));
    }
  };

  useEffect(() => {
    let toastId: string | undefined;
    console.log('SessionContextProvider: useEffect for auth state change listener mounted.');

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
              console.log('SessionContext: SIGNED_IN event processed. Setting loading to false.');
              break;
            case 'SIGNED_OUT':
              setSession(null);
              setUser(null);
              setIsAdmin(false);
              setUserType(null);
              if (toastId) dismissToast(toastId);
              console.log('SessionContext: SIGNED_OUT event processed. Setting loading to false.');
              // Removed navigate('/login') from here. Index.tsx will handle the redirect.
              break;
            case 'INITIAL_SESSION':
              setSession(currentSession);
              setUser(currentSession?.user || null);
              if (currentSession?.user) {
                await fetchUserProfile(currentSession.user.id);
              }
              console.log('SessionContext: INITIAL_SESSION event processed. Setting loading to false.');
              break;
            case 'USER_UPDATED':
              setUser(currentSession?.user || null);
              if (currentSession?.user) {
                await fetchUserProfile(currentSession.user.id);
              }
              console.log('SessionContext: USER_UPDATED event processed. Setting loading to false.');
              break;
            case 'PASSWORD_RECOVERY':
              showLoading('Password recovery initiated. Check your email.');
              console.log('SessionContext: PASSWORD_RECOVERY event processed. Setting loading to false.');
              break;
            case 'TOKEN_REFRESHED':
              console.log('SessionContext: TOKEN_REFRESHED event processed. Setting loading to false.');
              break;
            default:
              console.warn('SessionContext: Unhandled auth event:', event);
          }
        } catch (error: any) {
          console.error('SessionContext: Error in onAuthStateChange handler:', error);
          showError(`Authentication error: ${error.message}`);
        } finally {
          setLoading(false); // This is crucial.
          console.log('SessionContext: onAuthStateChange handler FINALLY block. Loading set to false.');
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
      setLoading(false); // This is also crucial.
      console.log('SessionContext: Initial getSession promise FINALLY block. Loading set to false.');
    });

    return () => {
      console.log('SessionContext: Cleaning up auth state change listener.');
      authListener.subscription.unsubscribe();
      if (toastId) dismissToast(toastId);
    };
  }, []); // Removed navigate from dependencies as it's no longer used for direct navigation here.

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