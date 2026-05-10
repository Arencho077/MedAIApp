import { Tabs } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';

export default function TabLayout() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.email === 'sargsyanaren218@gmail.com') {
        setIsAdmin(true);
      }
    };
    checkAdmin();
  }, []);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#00C4B4',
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#E0E8F0',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Չատ',
          tabBarIcon: ({ color }) => <Ionicons name="chatbubbles-outline" size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="doctors"
        options={{
          title: 'Բժիշկներ',
          tabBarIcon: ({ color }) => <Ionicons name="medical-outline" size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="pharmacy"
        options={{
          title: 'Դեղատուն',
          tabBarIcon: ({ color }) => <Ionicons name="cart-outline" size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Կաբինետ',
          tabBarIcon: ({ color }) => <Ionicons name="person-outline" size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Admin',
          tabBarIcon: ({ color }) => <Ionicons name="shield-checkmark-outline" size={28} color={color} />,
          // Hides the tab completely from the bottom bar if not admin
          href: isAdmin ? '/admin' : null,
        }}
      />
    </Tabs>
  );
}
