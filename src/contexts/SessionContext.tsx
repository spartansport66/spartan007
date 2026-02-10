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
  userType: 'admin' | 'sales_person' | 'gate_keeper' | 'inventory_manager' | 'manager' | 'super_admin' | null;
  mustResetPassword: boolean; // Added mustResetPassword
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userType, setUserType] = useState<'admin' | 'sales_person' | 'gate_keeper' | 'inventory_manager' | 'manager' | 'super_admin' | null>(null);
  const [mustResetPassword, setMustResetPassword] = useState(false); // Initialize mustResetPassword

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
            .select('is_admin, user_type, must_reset_password') // Fetch must_reset_password
            .eq('id', initialSession.user.id)
            .single();
            
          if (!error && profile) {
            console.log('Profile data:', profile);
            setIsAdmin(profile.is_admin === true);
            setUserType(profile.user_type as 'admin' | 'sales_person' | 'gate_keeper' | 'inventory_manager' | 'manager' | 'super_admin' || 'sales_person');
            setMustResetPassword(profile.must_reset_password === true); // Set mustResetPassword
            console.log('isAdmin set to:', profile.is_admin === true);
            console.log('userType set to:', profile.user_type || 'sales_person');
            console.log('mustResetPassword set to:', profile.must_reset_password === true);
          } else {
            console.log('Error fetching profile or no profile found:', error);
            setIsAdmin(false);
            setUserType('sales_person');
            setMustResetPassword(false);
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
      console.log('Auth state changed:', _event);
      setSession(session);
      setUser(session?.user || null);
      
      if (session?.user?.id) {
        // Fetch user profile
        supabase
          .from('profiles')
          .select('is_admin, user_type, must_reset_password') // Fetch must_reset_password
          .eq('id', session.user.id)
          .single()
          .then(({ data: profile, error }) => {
            if (!error && profile) {
              console.log('Profile updated:', profile);
              setIsAdmin(profile.is_admin === true);
              setUserType(profile.user_type as 'admin' | 'sales_person' | 'gate_keeper' | 'inventory_manager' | 'manager' | 'super_admin' || 'sales_person');
              setMustResetPassword(profile.must_reset_password === true); // Set mustResetPassword
              console.log('isAdmin updated to:', profile.is_admin === true);
              console.log('userType updated to:', profile.user_type || 'sales_person');
              console.log('mustResetPassword updated to:', profile.must_reset_password === true);
            } else {
              console.log('Error fetching updated profile or no profile found:', error);
              setIsAdmin(false);
              setUserType('sales_person');
              setMustResetPassword(false);
            }
          });
      } else {
        setIsAdmin(false);
        setUserType(null);
        setMustResetPassword(false);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  return (
    <SessionContext.Provider value={{ session, user, loading, isAdmin, userType, mustResetPassword }}>
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