import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect, useState, useRef } from 'react';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '../services/supabase';
import { Session } from '@supabase/supabase-js';
import { registerForPushNotificationsAsync } from '../services/push';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  const [session, setSession] = useState<Session | null>(null);
  const [isReady, setIsReady] = useState(false);
  const signingOut = useRef(false); // Flag to prevent race condition

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (s) {
        // Check if this is an unapproved doctor BEFORE setting session
        checkDoctorAccess(s).then(allowed => {
          if (allowed) {
            setSession(s);
            registerForPushNotificationsAsync();
          } else {
            // Don't set session — doctor is not approved
            setSession(null);
          }
          setIsReady(true);
        });
      } else {
        setSession(null);
        setIsReady(true);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      // If we're actively signing out, ignore the event
      if (signingOut.current) return;

      if (s) {
        checkDoctorAccess(s).then(allowed => {
          if (allowed) {
            setSession(s);
            registerForPushNotificationsAsync();
          } else {
            setSession(null);
          }
        });
      } else {
        setSession(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkDoctorAccess = async (s: Session): Promise<boolean> => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, is_approved')
        .eq('id', s.user.id)
        .single();

      if (profile && profile.role === 'doctor' && !profile.is_approved) {
        // Unapproved doctor — sign them out
        signingOut.current = true;
        await supabase.auth.signOut();
        signingOut.current = false;
        return false;
      }
      return true;
    } catch {
      return true; // No profile yet, allow
    }
  };

  useEffect(() => {
    if (!isReady || !navigationState?.key) return;

    const isLoginScreen = segments[0] === 'login';

    if (!session && !isLoginScreen) {
      router.replace('/login');
    } else if (session && isLoginScreen) {
      router.replace('/(tabs)');
    }
  }, [session, segments, isReady, navigationState?.key]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="login" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="edit-profile" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
