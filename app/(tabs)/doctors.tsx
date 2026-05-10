import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Modal, ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { useFocusEffect } from 'expo-router';

type Doctor = {
  id: string;
  full_name: string;
  specialty: string;
  rating: number;
  reviews: number;
  experience: string;
  image_url: string;
  is_sponsored: boolean;
  clinic_address: string;
};

// Generate next 14 days
const generateDates = () => {
  const dates = [];
  const today = new Date();
  for (let i = 1; i <= 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    // Skip Sundays
    if (d.getDay() !== 0) {
      dates.push(d);
    }
  }
  return dates;
};

const TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '14:00', '14:30', '15:00', '15:30', '16:00',
  '16:30', '17:00', '17:30',
];

const DAY_NAMES_SHORT = ['Կիdelays', 'Երdelay', 'Երdelays', 'Չdelays', 'Հdelays', 'Ուdelays', 'Շdelays'];
const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export default function DoctorsScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);

  // Calendar modal state
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const availableDates = generateDates();

  useFocusEffect(
    useCallback(() => {
      fetchDoctors();
    }, [])
  );

  const fetchDoctors = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'doctor')
        .eq('is_approved', true);
      if (error) throw error;
      setDoctors(data || []);
    } catch (e: any) {
      console.error('Error fetching doctors:', e);
    } finally {
      setLoading(false);
    }
  };

  const sortedDoctors = [...doctors]
    .filter(d => {
      const name = (d.full_name || '').toLowerCase();
      const spec = (d.specialty || '').toLowerCase();
      const q = searchQuery.toLowerCase();
      return name.includes(q) || spec.includes(q);
    })
    .sort((a, b) => {
      if (a.is_sponsored && !b.is_sponsored) return -1;
      if (!a.is_sponsored && b.is_sponsored) return 1;
      return (b.rating || 0) - (a.rating || 0);
    });

  const openCalendar = (doctor: Doctor) => {
    setSelectedDoctor(doctor);
    setSelectedDate(null);
    setSelectedTime(null);
    setShowCalendar(true);
  };

  const confirmBooking = async () => {
    if (!selectedDoctor || !selectedDate || !selectedTime) {
      Alert.alert('', 'Please select date and time');
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'Please log in');
        return;
      }

      // Combine date + time
      const [hours, minutes] = selectedTime.split(':').map(Number);
      const appointmentDate = new Date(selectedDate);
      appointmentDate.setHours(hours, minutes, 0, 0);

      const { error } = await supabase.from('appointments').insert({
        patient_id: user.id,
        doctor_id: selectedDoctor.id,
        doctor_name: selectedDoctor.full_name,
        appointment_date: appointmentDate.toISOString(),
        notes: `${selectedDoctor.specialty || 'Doctor'} - ${selectedDoctor.full_name}`,
      });

      if (error) throw error;

      setShowCalendar(false);
      Alert.alert(
        'Booked!',
        `${selectedDoctor.full_name}\n${selectedDate.toLocaleDateString()} ${selectedTime}\n${selectedDoctor.clinic_address || ''}`,
        [{ text: 'OK' }]
      );
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDateLabel = (date: Date) => {
    const day = date.getDate();
    const month = MONTH_NAMES[date.getMonth()];
    const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
    return { day: day.toString(), weekday, month };
  };

  const renderDoctor = ({ item }: { item: Doctor }) => (
    <View style={[styles.card, item.is_sponsored && styles.sponsoredCard]}>
      {item.is_sponsored && (
        <View style={styles.sponsoredBadge}>
          <Ionicons name="star" size={12} color="#FFF" />
          <Text style={styles.sponsoredText}>Premium</Text>
        </View>
      )}
      <View style={styles.cardContent}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Ionicons name="person" size={30} color="#CBD5E1" />
          </View>
        )}
        <View style={styles.infoContainer}>
          <Text style={styles.name}>{item.full_name}</Text>
          <Text style={styles.specialty}>{item.specialty || 'General'}</Text>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Ionicons name="star" size={15} color="#FFD700" />
              <Text style={styles.statText}>{item.rating || '5.0'} ({item.reviews || 0})</Text>
            </View>
            {item.experience && (
              <View style={styles.stat}>
                <Ionicons name="briefcase-outline" size={15} color="#6B7A82" />
                <Text style={styles.statText}>{item.experience}</Text>
              </View>
            )}
          </View>
          {item.clinic_address && (
            <View style={styles.stat}>
              <Ionicons name="location-outline" size={14} color="#6B7A82" />
              <Text style={[styles.statText, { fontSize: 12 }]}>{item.clinic_address}</Text>
            </View>
          )}
        </View>
      </View>

      <TouchableOpacity
        style={[styles.bookButton, item.is_sponsored && styles.bookButtonSponsored]}
        onPress={() => openCalendar(item)}
      >
        <Ionicons name="calendar-outline" size={18} color={item.is_sponsored ? '#FFF' : '#1A2E35'} style={{ marginRight: 8 }} />
        <Text style={[styles.bookButtonText, item.is_sponsored && styles.bookButtonTextSponsored]}>
          Book Appointment
        </Text>
      </TouchableOpacity>
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
        <Text style={styles.headerTitle}>Doctors</Text>
        <Text style={styles.headerSubtitle}>Find the best specialists</Text>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {sortedDoctors.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="medical-outline" size={60} color="#CBD5E1" />
          <Text style={styles.emptyText}>No doctors yet</Text>
        </View>
      ) : (
        <FlatList
          data={sortedDoctors}
          keyExtractor={(item) => item.id}
          renderItem={renderDoctor}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* ===== CALENDAR MODAL ===== */}
      <Modal visible={showCalendar} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Select Date & Time</Text>
                {selectedDoctor && (
                  <Text style={styles.modalSubtitle}>{selectedDoctor.full_name}</Text>
                )}
              </View>
              <TouchableOpacity onPress={() => setShowCalendar(false)}>
                <Ionicons name="close-circle" size={32} color="#CBD5E1" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Date picker - horizontal scroll */}
              <Text style={styles.sectionLabel}>Choose a date:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateScroll}>
                {availableDates.map((date, idx) => {
                  const label = formatDateLabel(date);
                  const isSelected = selectedDate?.toDateString() === date.toDateString();
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.dateChip, isSelected && styles.dateChipSelected]}
                      onPress={() => setSelectedDate(date)}
                    >
                      <Text style={[styles.dateWeekday, isSelected && styles.dateTextSelected]}>{label.weekday}</Text>
                      <Text style={[styles.dateDay, isSelected && styles.dateTextSelected]}>{label.day}</Text>
                      <Text style={[styles.dateMonth, isSelected && styles.dateTextSelected]}>{label.month}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Time slots */}
              {selectedDate && (
                <>
                  <Text style={styles.sectionLabel}>Choose time:</Text>
                  <View style={styles.timeGrid}>
                    {TIME_SLOTS.map((time) => {
                      const isSelected = selectedTime === time;
                      return (
                        <TouchableOpacity
                          key={time}
                          style={[styles.timeChip, isSelected && styles.timeChipSelected]}
                          onPress={() => setSelectedTime(time)}
                        >
                          <Text style={[styles.timeText, isSelected && styles.timeTextSelected]}>{time}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              {/* Summary + Confirm */}
              {selectedDate && selectedTime && (
                <View style={styles.summaryBox}>
                  <View style={styles.summaryRow}>
                    <Ionicons name="calendar" size={18} color="#00C4B4" />
                    <Text style={styles.summaryText}>
                      {selectedDate.toLocaleDateString()} at {selectedTime}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.confirmButton}
                    onPress={confirmBooking}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <Text style={styles.confirmButtonText}>Confirm Booking</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FA' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: '#fff', paddingTop: 60, paddingBottom: 20,
    paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#E0E8F0',
  },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#1A2E35' },
  headerSubtitle: { fontSize: 15, color: '#6B7A82', marginTop: 4 },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F4F7FA',
    borderRadius: 12, marginTop: 16, paddingHorizontal: 15, borderWidth: 1, borderColor: '#E0E8F0',
  },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, height: 45, fontSize: 16, color: '#1A2E35' },
  listContent: { padding: 20 },
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05, shadowRadius: 10, elevation: 3,
  },
  sponsoredCard: { borderWidth: 2, borderColor: '#00C4B4', backgroundColor: '#FAFFFF' },
  sponsoredBadge: {
    position: 'absolute', top: -12, right: 20, backgroundColor: '#00C4B4',
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12,
    paddingVertical: 4, borderRadius: 12, zIndex: 10,
  },
  sponsoredText: { color: '#FFF', fontSize: 12, fontWeight: '700', marginLeft: 4 },
  cardContent: { flexDirection: 'row', marginBottom: 15 },
  avatar: { width: 70, height: 70, borderRadius: 35, marginRight: 15 },
  avatarPlaceholder: { backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  infoContainer: { flex: 1, justifyContent: 'center', gap: 4 },
  name: { fontSize: 17, fontWeight: '700', color: '#1A2E35' },
  specialty: { fontSize: 14, color: '#00C4B4', fontWeight: '600' },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 13, color: '#6B7A82' },
  bookButton: {
    backgroundColor: '#F4F7FA', paddingVertical: 13, borderRadius: 12,
    alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
    borderWidth: 1, borderColor: '#E0E8F0',
  },
  bookButtonSponsored: {
    backgroundColor: '#00C4B4', borderColor: '#00C4B4',
    shadowColor: '#00C4B4', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 3,
  },
  bookButtonText: { color: '#1A2E35', fontWeight: '600', fontSize: 15 },
  bookButtonTextSponsored: { color: '#FFF' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 60 },
  emptyText: { fontSize: 16, color: '#94A3B8', marginTop: 16, fontWeight: '600' },

  // === Modal styles ===
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#1A2E35' },
  modalSubtitle: { fontSize: 14, color: '#00C4B4', fontWeight: '600', marginTop: 4 },

  sectionLabel: { fontSize: 15, fontWeight: '700', color: '#1A2E35', marginBottom: 12, marginTop: 8 },

  dateScroll: { marginBottom: 20 },
  dateChip: {
    width: 68, height: 84, borderRadius: 16, backgroundColor: '#F4F7FA',
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
    borderWidth: 1.5, borderColor: '#E0E8F0',
  },
  dateChipSelected: { backgroundColor: '#00C4B4', borderColor: '#00C4B4' },
  dateWeekday: { fontSize: 12, color: '#6B7A82', fontWeight: '600' },
  dateDay: { fontSize: 22, fontWeight: '800', color: '#1A2E35', marginVertical: 2 },
  dateMonth: { fontSize: 11, color: '#6B7A82' },
  dateTextSelected: { color: '#FFF' },

  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  timeChip: {
    paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12,
    backgroundColor: '#F4F7FA', borderWidth: 1, borderColor: '#E0E8F0',
  },
  timeChipSelected: { backgroundColor: '#00C4B4', borderColor: '#00C4B4' },
  timeText: { fontSize: 15, fontWeight: '600', color: '#1A2E35' },
  timeTextSelected: { color: '#FFF' },

  summaryBox: {
    backgroundColor: '#F0FDFB', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#00C4B4', marginTop: 8,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  summaryText: { fontSize: 16, fontWeight: '600', color: '#1A2E35' },
  confirmButton: {
    backgroundColor: '#00C4B4', paddingVertical: 16, borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#00C4B4', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  confirmButtonText: { color: '#FFF', fontSize: 17, fontWeight: '700' },
});
