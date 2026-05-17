import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#00C4B4',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return;
    }
    
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
      
    try {
      token = (
        await Notifications.getExpoPushTokenAsync({
          projectId,
        })
      ).data;
    } catch (e) {
      console.log("Could not get push token", e);
    }
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  if (token) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Save token to profile securely
      await supabase
        .from('profiles')
        .update({ push_token: token })
        .eq('id', user.id);
    }
  }

  return token;
}

// Helper to send push securely via our Edge Function
export const sendPushNotification = async (userId: string, title: string, body: string) => {
  try {
    await supabase.functions.invoke('send-notification', {
      body: { user_id: userId, title, body },
    });
  } catch (error) {
    console.error('Error sending notification via Edge Function', error);
  }
};
