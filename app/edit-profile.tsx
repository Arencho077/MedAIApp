import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

export default function EditProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [experience, setExperience] = useState('');
  const [clinicAddress, setClinicAddress] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [role, setRole] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (data) {
        setFullName(data.full_name || '');
        setSpecialty(data.specialty || '');
        setExperience(data.experience || '');
        setClinicAddress(data.clinic_address || '');
        setImageUrl(data.image_url || '');
        setRole(data.role || '');
      }
    } catch (e) {
      console.error('Load profile error:', e);
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      if (Platform.OS === 'web') {
        window.alert('Permission needed: You need to allow access to your photos to upload an avatar.');
      } else {
        Alert.alert('Permission needed', 'You need to allow access to your photos to upload an avatar.');
      }
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8, // Better quality since we are uploading a file now
    });

    if (!result.canceled && result.assets[0].uri) {
      setImageUrl(result.assets[0].uri); // Update state with local URI for preview
    }
  };

  const saveProfile = async () => {
    if (!fullName.trim()) {
      if (Platform.OS === 'web') {
        window.alert('Error: Name is required');
      } else {
        Alert.alert('Error', 'Name is required');
      }
      return;
    }


    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      let finalImageUrl = imageUrl;

      // If imageUrl is a local file (not starting with http), upload it to Storage
      if (imageUrl && !imageUrl.startsWith('http') && !imageUrl.startsWith('data:')) {
        const response = await fetch(imageUrl);
        const blob = await response.blob();

        // 🔒 SECURITY: Validate file type
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!validTypes.includes(blob.type)) {
          throw new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.');
        }

        // 🔒 SECURITY: Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (blob.size > maxSize) {
          throw new Error('File too large. Maximum size is 5MB.');
        }

        const fileExt = imageUrl.split('.').pop() || 'jpg';
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, blob, {
            contentType: blob.type,
            upsert: false // 🔒 Prevent accidental overwrites
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
        finalImageUrl = publicUrl;
      }

      // 🔒 SECURITY FIX: Add .eq('id', user.id) to prevent updating other users' profiles
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          specialty: specialty.trim(),
          experience: experience.trim(),
          clinic_address: clinicAddress.trim(),
          image_url: finalImageUrl,
        })
        .eq('id', user.id); // 🔒 Critical: Only update own profile

      if (error) throw error;

      if (Platform.OS === 'web') {
        window.alert('Your profile has been updated');
        router.back();
      } else {
        Alert.alert('Saved!', 'Your profile has been updated', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      }
    } catch (e: any) {
      if (Platform.OS === 'web') {
        window.alert(`Error: ${e.message}`);
      } else {
        Alert.alert('Error', e.message);
      }
    } finally {
      setSaving(false);
    }

  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#00C4B4" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#1A2E35" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Avatar Section - NOW CLICKABLE! */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={pickImage} style={styles.avatarPreview} activeOpacity={0.7}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.realAvatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="camera" size={40} color="#CBD5E1" />
              </View>
            )}
            <View style={styles.editBadge}>
              <Ionicons name="pencil" size={14} color="#FFF" />
            </View>
          </TouchableOpacity>
          <Text style={styles.roleBadge}>
            {role === 'doctor' ? 'Doctor' : 'Patient'}
          </Text>
        </View>

        {/* Form fields */}
        <View style={styles.form}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Full Name *</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="person-outline" size={20} color="#6B7A82" />
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Your full name"
                placeholderTextColor="#CBD5E1"
                maxLength={100}
              />
            </View>
          </View>

          {role === 'doctor' && (
            <>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Specialty</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="medkit-outline" size={20} color="#6B7A82" />
                  <TextInput
                    style={styles.input}
                    value={specialty}
                    onChangeText={setSpecialty}
                    placeholder="e.g. Cardiologist, Pediatrician"
                    placeholderTextColor="#CBD5E1"
                    maxLength={100}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Experience</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="briefcase-outline" size={20} color="#6B7A82" />
                  <TextInput
                    style={styles.input}
                    value={experience}
                    onChangeText={setExperience}
                    placeholder="e.g. 10 years"
                    placeholderTextColor="#CBD5E1"
                    maxLength={50}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Clinic Address</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="location-outline" size={20} color="#6B7A82" />
                  <TextInput
                    style={styles.input}
                    value={clinicAddress}
                    onChangeText={setClinicAddress}
                    placeholder="e.g. Yerevan, Abovyan 12"
                    placeholderTextColor="#CBD5E1"
                    maxLength={200}
                  />
                </View>
              </View>
            </>
          )}
        </View>

        {/* Save button */}
        <TouchableOpacity style={styles.saveButton} onPress={saveProfile} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={22} color="#FFF" style={{ marginRight: 8 }} />
              <Text style={styles.saveButtonText}>Save Profile</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FA' },
  content: { paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFF', paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: '#E0E8F0',
  },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1A2E35' },
  
  // Avatar Styles
  avatarSection: { alignItems: 'center', paddingVertical: 24 },
  avatarPreview: { marginBottom: 12, position: 'relative' },
  realAvatar: { width: 100, height: 100, borderRadius: 50 },
  avatarPlaceholder: { 
    width: 100, height: 100, borderRadius: 50, 
    backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#E0E8F0', borderStyle: 'dashed'
  },
  editBadge: {
    position: 'absolute', bottom: 0, right: 0,
    backgroundColor: '#00C4B4', width: 32, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: '#F4F7FA'
  },

  roleBadge: {
    fontSize: 13, fontWeight: '700', color: '#00C4B4',
    backgroundColor: '#E6FCFA', paddingHorizontal: 16, paddingVertical: 6,
    borderRadius: 20, overflow: 'hidden',
  },
  form: { paddingHorizontal: 20, gap: 16 },
  fieldGroup: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginLeft: 4 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF',
    borderRadius: 14, paddingHorizontal: 16, borderWidth: 1, borderColor: '#E0E8F0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 2, gap: 10,
  },
  input: { flex: 1, height: 50, fontSize: 16, color: '#1A2E35' },
  saveButton: {
    backgroundColor: '#00C4B4', marginHorizontal: 20, marginTop: 32,
    paddingVertical: 16, borderRadius: 14, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#00C4B4', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  saveButtonText: { color: '#FFF', fontSize: 17, fontWeight: '700' },
});
