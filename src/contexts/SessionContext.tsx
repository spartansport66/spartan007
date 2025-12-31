"use client";
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
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
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userType, setUserType] = useState<string | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        setSession(initialSession);
        setUser(initialSession?.user || null);
        
        if (initialSession?.user?.id) {
          // Fetch user profile
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('is_admin, user_type')
            .eq('id', initialSession.user.id)
            .single();
            
          if (!error && profile) {
            setIsAdmin(profile.is_admin || false);
            setUserType(profile.user_type || 'sales_person');
          }
        }
      } catch (error) {
        console.error('SessionContext: Error checking session:', error);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user || null);
      
      if (session?.user?.id) {
        // Fetch user profile
        supabase
          .from('profiles')
          .select('is_admin, user_type')
          .eq('id', session.user.id)
          .single()
          .then(({ data: profile, error }) => {
            if (!error && profile) {
              setIsAdmin(profile.is_admin || false);
              setUserType(profile.user_type || 'sales_person');
            } else {
              setIsAdmin(false);
              setUserType('sales_person');
            }
          });
      } else {
        setIsAdmin(false);
        setUserType(null);
      }
    });

    return () => {
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