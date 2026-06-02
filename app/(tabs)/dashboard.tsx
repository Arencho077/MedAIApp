import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Alert, Platform } from 'react-native';

import { supabase } from '../../services/supabase';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { sendPushNotification } from '../../services/push';

type Appointment = {
  id: string;
  appointment_date: string;
  notes: string;
  status: string;
  doctor_name: string | null;
  patient_id: string | null;
  doctor_id: string | null;
};

export default function DashboardScreen() {
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<'patient' | 'doctor' | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [userName, setUserName] = useState('');

  useFocusEffect(
    useCallback(() => {
      fetchDashboardData();
    }, [])
  );

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get or create profile
      let { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError || !profileData) {
        const meta = user.user_metadata || {};
        const userRole = meta.role || 'patient';
        const uName = meta.full_name || user.email || 'User';

        await supabase.from('profiles').insert({
          id: user.id,
          role: userRole,
          full_name: uName,
        });

        setRole(userRole as 'patient' | 'doctor');
        setUserName(uName);

        // Fetch appointments based on role from metadata
        await fetchAppointments(user.id, userRole);
      } else {
        setRole(profileData.role);
        setUserName(profileData.full_name);
        await fetchAppointments(user.id, profileData.role);
      }
    } catch (error: any) {
      console.error('Dashboard error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAppointments = async (userId: string, userRole: string) => {
    if (userRole === 'doctor') {
      // Doctor sees only THEIR appointments (where they are the doctor)
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('doctor_id', userId)
        .order('created_at', { ascending: false });

      if (!error) setAppointments(data || []);
    } else {
      // Patient sees only THEIR appointments
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('patient_id', userId)
        .order('created_at', { ascending: false });

      if (!error) setAppointments(data || []);
    }
  };

  const handleUpdateStatus = async (appointmentId: string, newStatus: string) => {
    try {
      // 🔒 SECURITY FIX: Verify the doctor owns this appointment before updating
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      // First verify this appointment belongs to the current doctor
      const appointment = appointments.find(a => a.id === appointmentId);
      if (!appointment || appointment.doctor_id !== user.id) {
        throw new Error('Unauthorized: You can only modify your own appointments');
      }

      const { error } = await supabase
        .from('appointments')
        .update({ status: newStatus })
        .eq('id', appointmentId)
        .eq('doctor_id', user.id); // 🔒 Additional safety check in query

      if (error) throw error;

      // Refresh data
      setAppointments(prev =>
        prev.map(a => a.id === appointmentId ? { ...a, status: newStatus } : a)
      );

      // Send notification to patient
      if (appointment.patient_id) {
        const title = newStatus === 'confirmed' ? '✅ Ամրագրումը հաստատվել է' : '❌ Ամրագրումը մերժվել է';
        const body = `Բժիշկը ${newStatus === 'confirmed' ? 'հաստատել' : 'մերժել'} է Ձեր ամրագրումը ${formatDate(appointment.appointment_date)}-ի համար:`;
        await sendPushNotification(appointment.patient_id, title, body);
      }

      if (Platform.OS === 'web') {
        window.alert(newStatus === 'confirmed' ? 'Appointment confirmed!' : 'Appointment cancelled.');
      } else {
        Alert.alert('Done', newStatus === 'confirmed' ? 'Appointment confirmed!' : 'Appointment cancelled.');
      }
    } catch (e: any) {
      if (Platform.OS === 'web') {
        window.alert(`Error: ${e.message}`);
      } else {
        Alert.alert('Error', e.message);
      }
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderAppointment = ({ item }: { item: Appointment }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Ionicons name="calendar" size={20} color="#00C4B4" />
        <Text style={styles.date}>{formatDate(item.appointment_date)}</Text>
      </View>
      <Text style={styles.notes}>{item.notes || 'No notes'}</Text>
      {role === 'doctor' && item.doctor_name && (
        <Text style={styles.patientInfo}>Patient appointment</Text>
      )}
      <View style={styles.statusRow}>
        <View style={[styles.statusBadge, 
          item.status === 'pending' ? styles.statusPending : 
          item.status === 'confirmed' ? styles.statusConfirmed :
          styles.statusCancelled
        ]}>
          <Text style={[styles.statusText,
            item.status === 'pending' ? styles.statusTextPending :
            item.status === 'confirmed' ? styles.statusTextConfirmed :
            styles.statusTextCancelled
          ]}>
            {item.status === 'pending' ? 'Pending' : 
             item.status === 'confirmed' ? 'Confirmed' : 'Cancelled'}
          </Text>
        </View>

        {/* Doctor can confirm or cancel pending appointments */}
        {role === 'doctor' && item.status === 'pending' && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.confirmBtn}
              onPress={() => handleUpdateStatus(item.id, 'confirmed')}
            >
              <Ionicons name="checkmark-circle" size={22} color="#00C4B4" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => handleUpdateStatus(item.id, 'cancelled')}
            >
              <Ionicons name="close-circle" size={22} color="#FF3B30" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#00C4B4" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>Hello, {userName}</Text>
          <Text style={styles.roleText}>
            {role === 'doctor' ? 'Doctor Dashboard' : 'Patient Profile'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {role === 'doctor' && (
            <TouchableOpacity style={styles.editBtn} onPress={() => router.push('/edit-profile')}>
              <Ionicons name="create-outline" size={22} color="#00C4B4" />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.logoutBtn} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={24} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.sectionTitle}>
        {role === 'doctor' ? 'Patient Appointments' : 'My Appointments'}
      </Text>

      {appointments.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-clear-outline" size={60} color="#CBD5E1" />
          <Text style={styles.emptyText}>No appointments yet</Text>
          {role === 'patient' && (
            <Text style={styles.emptySubtext}>Go to Doctors tab to book one!</Text>
          )}
          {role === 'doctor' && (
            <Text style={styles.emptySubtext}>Patients will appear here after booking</Text>
          )}
        </View>
      ) : (
        <FlatList
          data={appointments}
          keyExtractor={(item) => item.id}
          renderItem={renderAppointment}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FA' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: '#fff', paddingTop: 60, paddingBottom: 20,
    paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#E0E8F0',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'
  },
  greeting: { fontSize: 24, fontWeight: '800', color: '#1A2E35' },
  roleText: { fontSize: 14, color: '#6B7A82', marginTop: 4 },
  logoutBtn: { padding: 8, backgroundColor: '#FFF0F0', borderRadius: 8 },
  editBtn: { padding: 8, backgroundColor: '#E6FCFA', borderRadius: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1A2E35', marginHorizontal: 20, marginTop: 24, marginBottom: 16 },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05, shadowRadius: 10, elevation: 3,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  date: { fontSize: 15, fontWeight: '600', color: '#1A2E35', marginLeft: 8 },
  notes: { fontSize: 15, color: '#475569', lineHeight: 22, marginBottom: 8 },
  patientInfo: { fontSize: 13, color: '#6B7A82', marginBottom: 12 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  statusPending: { backgroundColor: '#FFF7E6' },
  statusConfirmed: { backgroundColor: '#E6FCFA' },
  statusCancelled: { backgroundColor: '#FFF0F0' },
  statusText: { fontSize: 13, fontWeight: '600' },
  statusTextPending: { color: '#F59E0B' },
  statusTextConfirmed: { color: '#00C4B4' },
  statusTextCancelled: { color: '#FF3B30' },
  actionButtons: { flexDirection: 'row', gap: 12 },
  confirmBtn: { padding: 6 },
  cancelBtn: { padding: 6 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 60 },
  emptyText: { fontSize: 16, color: '#94A3B8', marginTop: 16, fontWeight: '600' },
  emptySubtext: { fontSize: 13, color: '#CBD5E1', marginTop: 6 }
});
