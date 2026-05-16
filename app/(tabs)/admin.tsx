import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, Image, Linking, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { useFocusEffect, Redirect } from 'expo-router';

type DoctorProfile = {
  id: string;
  full_name: string;
  specialty: string;
  is_approved: boolean;
  birth_year: string | null;
  social_link: string | null;
  diploma_url: string | null;
  image_url: string | null;
  experience: string | null;
};

export default function AdminScreen() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingDoctors, setPendingDoctors] = useState<DoctorProfile[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      checkAdminAndLoad();
    }, [])
  );

  const checkAdminAndLoad = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.email === 'sargsyanaren218@gmail.com') {
        setIsAdmin(true);
        await loadPendingDoctors();
      } else {
        setIsAdmin(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadPendingDoctors = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, specialty, is_approved, birth_year, social_link, diploma_url, image_url, experience')
      .eq('role', 'doctor')
      .eq('is_approved', false);

    if (!error && data) {
      setPendingDoctors(data);
    }
  };

  const handleApprove = async (id: string) => {
    setProcessingId(id);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_approved: true })
        .eq('id', id);

      if (error) throw error;
      
      Alert.alert('Успех', 'Врач одобрен и теперь виден пациентам!');
      await loadPendingDoctors();
    } catch (e: any) {
      Alert.alert('Ошибка RLS', 'Нет прав на редактирование профилей. См. инструкцию в чате.');
      console.error(e);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    setProcessingId(id);
    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      Alert.alert('Отклонен', 'Профиль врача удален.');
      await loadPendingDoctors();
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    } finally {
      setProcessingId(null);
    }
  };

  const openLink = (url: string) => {
    if (!url.startsWith('http')) {
      Linking.openURL(`https://${url}`).catch(() => Alert.alert('Ошибка', 'Неверная ссылка'));
    } else {
      Linking.openURL(url).catch(() => Alert.alert('Ошибка', 'Не удалось открыть ссылку'));
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#00C4B4" /></View>;
  }

  if (!isAdmin) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Админ-Панель</Text>
        <Text style={styles.headerSubtitle}>Досье ожидающих врачей</Text>
      </View>

      {pendingDoctors.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="checkmark-done-circle-outline" size={60} color="#CBD5E1" />
          <Text style={styles.emptyText}>Все врачи проверены</Text>
        </View>
      ) : (
        <FlatList
          data={pendingDoctors}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20 }}
          renderItem={({ item }) => {
            const isExpanded = expandedId === item.id;
            return (
              <View style={styles.card}>
                <TouchableOpacity 
                  style={styles.cardHeader} 
                  onPress={() => setExpandedId(isExpanded ? null : item.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.headerLeft}>
                    {item.image_url ? (
                      <Image source={{ uri: item.image_url }} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatar, styles.avatarPlaceholder]}>
                        <Ionicons name="person" size={20} color="#CBD5E1" />
                      </View>
                    )}
                    <View>
                      <Text style={styles.name}>{item.full_name || 'Без имени'}</Text>
                      <Text style={styles.specialty}>{item.specialty || 'Специальность не указана'}</Text>
                    </View>
                  </View>
                  <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={24} color="#6B7A82" />
                </TouchableOpacity>

                {/* DOSSIER CONTENT */}
                {isExpanded && (
                  <View style={styles.dossierContent}>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Год рождения:</Text>
                      <Text style={styles.infoValue}>{item.birth_year || 'Не указан'}</Text>
                    </View>
                    
                    {item.experience && (
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Опыт:</Text>
                        <Text style={styles.infoValue}>{item.experience}</Text>
                      </View>
                    )}

                    {item.social_link && (
                      <TouchableOpacity style={styles.socialBtn} onPress={() => openLink(item.social_link!)}>
                        <Ionicons name="link-outline" size={18} color="#007AFF" />
                        <Text style={styles.socialText}>Открыть профиль соцсети</Text>
                      </TouchableOpacity>
                    )}

                    <Text style={styles.diplomaLabel}>Скан/Фото диплома:</Text>
                    {item.diploma_url ? (
                      <Image source={{ uri: item.diploma_url }} style={styles.diplomaImage} resizeMode="contain" />
                    ) : (
                      <View style={styles.noDiploma}>
                        <Text style={{ color: '#94A3B8' }}>Диплом не загружен</Text>
                      </View>
                    )}

                    {/* ACTIONS */}
                    <View style={styles.actionRow}>
                      <TouchableOpacity 
                        style={[styles.actionBtn, styles.rejectBtn]} 
                        onPress={() => handleReject(item.id)}
                        disabled={processingId === item.id}
                      >
                        <Ionicons name="close" size={20} color="#FF3B30" />
                        <Text style={styles.rejectText}>Отклонить</Text>
                      </TouchableOpacity>

                      <TouchableOpacity 
                        style={[styles.actionBtn, styles.approveBtn]} 
                        onPress={() => handleApprove(item.id)}
                        disabled={processingId === item.id}
                      >
                        {processingId === item.id ? (
                          <ActivityIndicator color="#FFF" />
                        ) : (
                          <>
                            <Ionicons name="checkmark" size={20} color="#FFF" />
                            <Text style={styles.approveText}>Одобрить врача</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FA' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { fontSize: 20, fontWeight: '700', color: '#1A2E35', marginTop: 16 },
  errorSubtext: { fontSize: 14, color: '#6B7A82', textAlign: 'center', marginTop: 8 },
  header: {
    backgroundColor: '#fff', paddingTop: 60, paddingBottom: 20,
    paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#E0E8F0',
  },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#1A2E35' },
  headerSubtitle: { fontSize: 14, color: '#6B7A82', marginTop: 4 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#94A3B8', marginTop: 16, fontWeight: '600' },
  
  card: {
    backgroundColor: '#FFF', borderRadius: 16, marginBottom: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, backgroundColor: '#FFF'
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarPlaceholder: { backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  name: { fontSize: 16, fontWeight: '700', color: '#1A2E35', marginBottom: 2 },
  specialty: { fontSize: 13, color: '#00C4B4', fontWeight: '600' },
  
  dossierContent: { padding: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9', backgroundColor: '#FAFAFA' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  infoLabel: { fontSize: 14, color: '#6B7A82', fontWeight: '500' },
  infoValue: { fontSize: 14, color: '#1A2E35', fontWeight: '700' },
  
  socialBtn: { 
    flexDirection: 'row', alignItems: 'center', gap: 6, 
    backgroundColor: '#E5F1FF', padding: 10, borderRadius: 8, marginBottom: 16, alignSelf: 'flex-start'
  },
  socialText: { color: '#007AFF', fontWeight: '600', fontSize: 13 },
  
  diplomaLabel: { fontSize: 14, color: '#1A2E35', fontWeight: '700', marginBottom: 8 },
  diplomaImage: { width: '100%', height: 200, backgroundColor: '#E2E8F0', borderRadius: 12, marginBottom: 20 },
  noDiploma: { 
    width: '100%', height: 100, backgroundColor: '#F1F5F9', borderRadius: 12, 
    justifyContent: 'center', alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#CBD5E1', borderStyle: 'dashed'
  },

  actionRow: { flexDirection: 'row', gap: 12 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, gap: 6 },
  rejectBtn: { backgroundColor: '#FFF0F0', borderWidth: 1, borderColor: '#FF3B30' },
  rejectText: { color: '#FF3B30', fontWeight: '700', fontSize: 15 },
  approveBtn: { backgroundColor: '#00C4B4' },
  approveText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
});
