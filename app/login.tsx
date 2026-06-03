import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Image,
  TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '../services/supabase';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';

type Mode = 'role' | 'login' | 'register';

export default function LoginScreen() {
  const [role, setRole] = useState<'patient' | 'doctor' | null>(null);
  const [mode, setMode] = useState<Mode>('role');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  
  // Doctor strict registration fields
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [birthDateInput, setBirthDateInput] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [socialLink, setSocialLink] = useState('');
  const [diplomaUrl, setDiplomaUrl] = useState('');
  
  const [loading, setLoading] = useState(false);

  const showAlert = (title: string, message: string, onPress?: () => void) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
      if (onPress) onPress();
    } else {
      Alert.alert(title, message, onPress ? [{ text: 'OK', onPress }] : undefined);
    }
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    // On Android, always close the picker after interaction
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    // Only update date if user selected (not dismissed)
    if (event.type !== 'dismissed' && selectedDate) {
      setBirthDate(selectedDate);
      setBirthDateInput(selectedDate.toISOString().split('T')[0]);
    }
  };

  const formatDate = (date: Date) => {
    return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
  };

  const parseBirthDateInput = (value: string) => {
    const trimmed = value.trim();
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const localMatch = trimmed.match(/^(\d{2})[/.](\d{2})[/.](\d{4})$/);

    const year = isoMatch?.[1] ?? localMatch?.[3];
    const month = isoMatch?.[2] ?? localMatch?.[2];
    const day = isoMatch?.[3] ?? localMatch?.[1];

    if (!year || !month || !day) return null;

    const parsedDate = new Date(Number(year), Number(month) - 1, Number(day));
    if (
      parsedDate.getFullYear() !== Number(year) ||
      parsedDate.getMonth() !== Number(month) - 1 ||
      parsedDate.getDate() !== Number(day)
    ) {
      return null;
    }

    return parsedDate;
  };

  const pickDiploma = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      showAlert('Թույլտվություն', 'Դիպլոմը ներբեռնելու համար անհրաժեշտ է թույլտվություն։');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0].uri) {
      setDiplomaUrl(result.assets[0].uri);
    }
  };

  const handleRegister = async () => {
    if (!email.trim() || !password || !fullName.trim()) {
      showAlert('Սխալ', 'Խնդրում ենք լրացնել բոլոր դաշտերը');
      return;
    }

    // 🔒 SECURITY: Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      showAlert('Սխալ', 'Անվավեր email հասցե');
      return;
    }

    // 🔒 SECURITY: Validate password strength (min 8 chars)
    if (password.length < 8) {
      showAlert('Սխալ', 'Գաղտնաբառը պետք է լինի առնվազն 8 նիշ');
      return;
    }

    const parsedBirthDate = Platform.OS === 'web' ? parseBirthDateInput(birthDateInput) : birthDate;

    if (role === 'doctor') {
      const missingFields = [];
      if (!parsedBirthDate) missingFields.push('birth date');
      if (!socialLink.trim()) missingFields.push('social link');
      if (!diplomaUrl) missingFields.push('diploma image');

      if (missingFields.length > 0) {
        showAlert(
          'Missing doctor info',
          `Missing: ${missingFields.join(', ')}.\n\nAccepted date formats: YYYY-MM-DD, DD/MM/YYYY, DD.MM.YYYY.`
        );
        return;
      }

      if (!parsedBirthDate || !socialLink.trim() || !diplomaUrl) {
        showAlert('Սխալ', 'Բժիշկները պետք է լրացնեն բոլոր տվյալները (ծննդյան ամսաթիվ, սոցցանցի հղում և դիպլոմի նկար) մոդերացիա անցնելու համար։');
        return;
      }
    }

    setLoading(true);
    try {
      const formattedDate = parsedBirthDate ? formatDate(parsedBirthDate) : '';
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(), // 🔒 Normalize email
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            role,
            birth_year: formattedDate,
            social_link: socialLink.trim(),
            // diploma_url is set after upload
          }
        }
      });
      if (error) throw error;
      if (data.user) {
        const identities = (data.user as any).identities;
        if (Array.isArray(identities) && identities.length === 0) {
          showAlert('Account already exists', 'This email is already registered. Please log in or reset your password.');
          setMode('login');
          return;
        }

        if (!data.session) {
          showAlert('Registration created', 'Please confirm your email, then log in to complete your profile.');
          setMode('login');
          return;
        }

        let finalDiplomaUrl = diplomaUrl;

        // Upload diploma to storage if it's a local file
        if (role === 'doctor' && diplomaUrl && !diplomaUrl.startsWith('http')) {
          const response = await fetch(diplomaUrl);
          const blob = await response.blob();

          // 🔒 SECURITY: Validate file type
          const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
          if (!validTypes.includes(blob.type)) {
            throw new Error('Invalid file type. Only images and PDFs are allowed.');
          }

          // 🔒 SECURITY: Validate file size (max 10MB for diploma)
          const maxSize = 10 * 1024 * 1024;
          if (blob.size > maxSize) {
            throw new Error('File too large. Maximum size is 10MB.');
          }

          const fileExt = diplomaUrl.split('.').pop() || 'jpg';
          const fileName = `${data.user.id}/diploma-${Date.now()}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from('diplomas')
            .upload(fileName, blob, {
              contentType: blob.type,
              upsert: false
            });

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage.from('diplomas').getPublicUrl(fileName);
          finalDiplomaUrl = publicUrl;

          // Update user metadata with the final URL
          await supabase.auth.updateUser({ data: { diploma_url: finalDiplomaUrl } });
        }

        // ✅ Profile is auto-created by database trigger (handle_new_user)
        // No need for manual INSERT - the trigger handles it automatically

        if (role === 'doctor') {
          await supabase.auth.signOut();
          showAlert('Պատրաստ է! ✅', 'Ձեր հաշիվը ստեղծվել է և ուղարկվել է ստուգման: Դուք կստանաք հասանելիություն հաստատումից հետո:', () => {
            setMode('login');
          });
        } else {
          showAlert('Հաջողություն! ✅', 'Ձեր հաշիվը ստեղծվել է: Մուտք գործեք:', () => {
            setMode('login');
          });
        }
      }
    } catch (e: any) {
      const errorMessage = e.message === 'Failed to fetch'
        ? 'Կապի խնդիր: Ստուգեք Ձեր ինտերնետ կապը:'
        : (e.message || 'Ինչ-որ սխալ տեղի ունեցավ');
      showAlert('Սխալ', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      showAlert('Սխալ', 'Մուտքագրեք Email և գաղտնաբառ');
      return;
    }

    // 🔒 SECURITY: Normalize email
    const normalizedEmail = email.trim().toLowerCase();

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password
      });
      if (error) throw error;

      if (data.user) {
        let { data: existingProfile } = await supabase
          .from('profiles')
          .select('id, role')
          .eq('id', data.user.id)
          .single();

        if (!existingProfile) {
          // Profile doesn't exist yet — create it using metadata
          const meta = data.user.user_metadata;
          const profileRole = meta?.role || role || 'patient';
          await supabase.from('profiles').insert({
            id: data.user.id,
            role: profileRole,
            full_name: meta?.full_name || 'Օգտատեր',
            birth_year: meta?.birth_year || null,
            social_link: meta?.social_link || null,
            diploma_url: meta?.diploma_url || null,
          });
          // Re-fetch to get the newly created profile
          const { data: newProfile } = await supabase
            .from('profiles')
            .select('id, role')
            .eq('id', data.user.id)
            .single();
          existingProfile = newProfile;
        }

        // 🔒 ROLE VALIDATION: Check selected role matches actual DB role
        if (existingProfile && role && existingProfile.role !== role) {
          await supabase.auth.signOut();
          const selectedRoleLabel = role === 'doctor' ? 'Բժիշկ' : 'Պացիենտ';
          const actualRoleLabel = existingProfile.role === 'doctor' ? 'Բժիշկ' : 'Պացիենտ';
          showAlert(
            'Սխալ դեր ⚠️',
            `Այս հաշիվը գրանցված է որպես «${actualRoleLabel}»։\nԴուք ընտրել եք «${selectedRoleLabel}»։\n\nԽնդրում ենք վերադառնալ և ընտրել ճիշտ կարգավիճակը։`
          );
          return;
        }
      }

      router.replace('/(tabs)');
    } catch (e: any) {
      // 🔒 SECURITY: Don't leak information about whether user exists
      const errorMessage = e.message === 'Invalid login credentials'
        ? 'Սխալ Email կամ գաղտնաբառ'
        : e.message;
      showAlert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'role') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.logoContainer}>
            <Ionicons name="medical" size={60} color="#00C4B4" />
          </View>
          <Text style={styles.title}>Բարի գալուստ{'\n'}MedAIArmenia</Text>
          <Text style={styles.subtitle}>Ընտրեք ձեր կարգավիճակը</Text>

          <View style={styles.roleContainer}>
            <TouchableOpacity style={styles.roleCard} onPress={() => { setRole('patient'); setMode('login'); }}>
              <Ionicons name="person-circle-outline" size={44} color="#1A2E35" />
              <Text style={styles.roleTitle}>Պացիենտ</Text>
              <Text style={styles.roleDesc}>Ստանալ խորհրդատվություն{'\n'}և գտնել բժիշկ</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.roleCard, styles.doctorCard]} onPress={() => { setRole('doctor'); setMode('login'); }}>
              <Ionicons name="medkit-outline" size={44} color="#00C4B4" />
              <Text style={styles.roleTitle}>Բժիշկ</Text>
              <Text style={styles.roleDesc}>Կառավարել ամրագրումները{'\n'}և պացիենտներին</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.backButton} onPress={() => setMode('role')}>
            <Ionicons name="arrow-back" size={24} color="#1A2E35" />
          </TouchableOpacity>

          <View style={styles.logoContainer}>
            <Ionicons name="medical" size={50} color="#00C4B4" />
          </View>

          <Text style={styles.title}>
            {mode === 'login' ? 'Մուտք գործել' : 'Ստեղծել հաշիվ'}
          </Text>
          <Text style={styles.subtitle}>
            {role === 'patient' ? '👤 Պացիենտ' : '🩺 Բժիշկ'}
            {mode === 'register' && role === 'doctor' && '\n(Պահանջվում է վերիֆիկացիա)'}
          </Text>

          <View style={styles.formContainer}>
            {mode === 'register' && (
              <View style={styles.inputWrapper}>
                <Ionicons name="person-outline" size={20} color="#999" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Անուն Ազգանուն"
                  placeholderTextColor="#999"
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                  maxLength={100}
                />
              </View>
            )}

            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={20} color="#999" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email հասցե"
                placeholderTextColor="#999"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                maxLength={150}
              />
            </View>

            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color="#999" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Գաղտնաբառ"
                placeholderTextColor="#999"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                maxLength={64}
              />
            </View>

            {mode === 'register' && role === 'doctor' && (
              <View style={styles.doctorFieldsContainer}>
                <Text style={styles.sectionHeader}>Մոդերացիայի տվյալներ</Text>
                
                {Platform.OS === 'web' ? (
                  <View style={styles.inputWrapper}>
                    <Ionicons name="calendar-outline" size={20} color="#999" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={birthDateInput}
                      onChangeText={(text) => {
                        const trimmed = text.trim();
                        setBirthDateInput(text);
                        setBirthDate(trimmed ? parseBirthDateInput(trimmed) : null);
                      }}
                      placeholder="Ընտրեք ծննդյան ամսաթիվը"
                      placeholderTextColor="#999"
                      keyboardType="numbers-and-punctuation"
                      maxLength={10}
                    />
                  </View>
                ) : (
                  <>
                    <TouchableOpacity 
                      style={styles.inputWrapper} 
                      onPress={() => setShowDatePicker(true)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="calendar-outline" size={20} color="#999" style={styles.inputIcon} />
                      <Text style={[styles.input, { lineHeight: 52, color: birthDate ? '#1A2E35' : '#999' }]}>
                        {birthDate ? formatDate(birthDate) : 'Ընտրեք ծննդյան ամսաթիվը'}
                      </Text>
                    </TouchableOpacity>

                    {showDatePicker && (
                      <View style={styles.datePickerContainer}>
                        <DateTimePicker
                          value={birthDate || new Date(1990, 0, 1)}
                          mode="date"
                          display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
                          onChange={onDateChange}
                          maximumDate={new Date()}
                          themeVariant="light" // Fix for white-on-white text in iOS dark mode
                          textColor="#1A2E35"
                        />
                        {Platform.OS === 'ios' && (
                          <TouchableOpacity onPress={() => setShowDatePicker(false)} style={styles.iosDoneButton}>
                            <Text style={styles.iosDoneText}>Հաստատել (Պահպանել)</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </>
                )}

                <View style={styles.inputWrapper}>
                  <Ionicons name="logo-instagram" size={20} color="#999" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Սոցցանցի հղում (Instagram/FB)"
                    placeholderTextColor="#999"
                    value={socialLink}
                    onChangeText={setSocialLink}
                    autoCapitalize="none"
                    maxLength={200}
                  />
                </View>

                <TouchableOpacity style={styles.diplomaUploadBtn} onPress={pickDiploma}>
                  {diplomaUrl ? (
                    <View style={styles.diplomaSuccess}>
                      <Ionicons name="checkmark-circle" size={24} color="#00C4B4" />
                      <Text style={styles.diplomaSuccessText}>Դիպլոմը ներբեռնված է</Text>
                    </View>
                  ) : (
                    <>
                      <Ionicons name="document-text-outline" size={24} color="#1A2E35" />
                      <Text style={styles.diplomaUploadText}>Ներբեռնել դիպլոմի նկարը *</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={styles.mainButton}
              onPress={mode === 'login' ? handleLogin : handleRegister}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#FFF" />
                : <Text style={styles.mainButtonText}>
                    {mode === 'login' ? 'Մուտք' : 'Գրանցվել'}
                  </Text>
              }
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchButton}
              onPress={() => setMode(mode === 'login' ? 'register' : 'login')}
            >
              <Text style={styles.switchText}>
                {mode === 'login'
                  ? 'Հաշիվ չունե՞ք → Գրանցվել'
                  : 'Արդեն հաշիվ ունե՞ք → Մուտք գործել'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FA' },
  content: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  backButton: { position: 'absolute', top: 20, left: 24, zIndex: 10, padding: 8 },
  logoContainer: { alignItems: 'center', marginBottom: 20 },
  title: {
    fontSize: 28, fontWeight: '800', color: '#1A2E35',
    textAlign: 'center', marginBottom: 8, lineHeight: 36,
  },
  subtitle: { fontSize: 16, color: '#6B7A82', textAlign: 'center', marginBottom: 36 },
  roleContainer: { gap: 16 },
  roleCard: {
    backgroundColor: '#FFF', padding: 28, borderRadius: 20,
    alignItems: 'center', borderWidth: 1.5, borderColor: '#E0E8F0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06, shadowRadius: 12, elevation: 4,
  },
  doctorCard: { borderColor: '#00C4B4' },
  roleTitle: { fontSize: 20, fontWeight: '700', color: '#1A2E35', marginTop: 12, marginBottom: 6 },
  roleDesc: { fontSize: 14, color: '#6B7A82', textAlign: 'center', lineHeight: 20 },
  formContainer: { gap: 14, marginTop: 10 },
  
  doctorFieldsContainer: {
    backgroundColor: '#FFF', padding: 16, borderRadius: 16, gap: 12,
    borderWidth: 1, borderColor: '#00C4B4', marginTop: 8, marginBottom: 8
  },
  sectionHeader: { fontSize: 14, fontWeight: '700', color: '#00C4B4', marginBottom: 4 },
  
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF', borderRadius: 14, paddingHorizontal: 16,
    borderWidth: 1, borderColor: '#E0E8F0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, height: 52, fontSize: 16, color: '#1A2E35' },
  
  datePickerContainer: { backgroundColor: '#F8FAFC', borderRadius: 14, marginTop: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#E0E8F0' },
  iosDoneButton: { alignItems: 'center', padding: 14, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#E0E8F0' },
  iosDoneText: { color: '#00C4B4', fontWeight: '800', fontSize: 16 },

  diplomaUploadBtn: {
    backgroundColor: '#F4F7FA', paddingVertical: 14, borderRadius: 12,
    alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: '#CBD5E1', borderStyle: 'dashed'
  },
  diplomaUploadText: { color: '#1A2E35', fontWeight: '600', fontSize: 14 },
  diplomaSuccess: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  diplomaSuccessText: { color: '#00C4B4', fontWeight: '700', fontSize: 14 },

  mainButton: {
    backgroundColor: '#00C4B4', paddingVertical: 16, borderRadius: 14,
    alignItems: 'center', marginTop: 6,
    shadowColor: '#00C4B4', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  mainButtonText: { color: '#FFF', fontSize: 17, fontWeight: '700' },
  switchButton: { alignItems: 'center', paddingVertical: 8 },
  switchText: { color: '#00C4B4', fontSize: 15, fontWeight: '500' },
});
