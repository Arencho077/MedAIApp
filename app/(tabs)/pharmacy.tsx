import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
  TextInput, Linking, Alert, ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

type PharmacyItem = {
  id: string;
  name: string;
  type: string;
  price: number;
  oldPrice?: number;
  imageUrl: string;
  partnerPharmacy: string;
  promoCode: string;
  description: string;
};

type Partner = {
  name: string;
  logo: string;
  discount: string;
  color: string;
  url: string;
};

const PARTNERS: Partner[] = [
  {
    name: 'Alfa-Pharm',
    logo: 'medical',
    discount: '-15%',
    color: '#00C4B4',
    url: 'https://alfapharm.am',
  },
  {
    name: 'Natali Pharm',
    logo: 'heart',
    discount: 'Free Delivery',
    color: '#FF6B6B',
    url: 'https://natalipharm.am',
  },
  {
    name: 'Gedeon Richter',
    logo: 'flask',
    discount: '-10%',
    color: '#6C5CE7',
    url: 'https://gedeonrichter.am',
  },
];

const PHARMACY_DATA: PharmacyItem[] = [
  {
    id: '1',
    name: 'Vitamin D3 5000 IU',
    type: 'Vitamins',
    price: 3500,
    oldPrice: 4200,
    imageUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?q=80&w=300&auto=format&fit=crop',
    partnerPharmacy: 'Alfa-Pharm',
    promoCode: 'MEDAI-15',
    description: 'Supports immune system and bone health',
  },
  {
    id: '2',
    name: 'Paracetamol 500mg',
    type: 'Pain Relief',
    price: 500,
    imageUrl: 'https://images.unsplash.com/photo-1550572017-edb7dfd0d625?q=80&w=300&auto=format&fit=crop',
    partnerPharmacy: 'Natali Pharm',
    promoCode: 'MEDAI-FREE',
    description: 'Effective pain relief and fever reducer',
  },
  {
    id: '3',
    name: 'Omega 3 Fish Oil',
    type: 'Supplements',
    price: 6800,
    oldPrice: 8000,
    imageUrl: 'https://images.unsplash.com/photo-1628771065518-0d82f1938462?q=80&w=300&auto=format&fit=crop',
    partnerPharmacy: 'Gedeon Richter',
    promoCode: 'MEDAI-10',
    description: 'Heart and brain health support',
  },
  {
    id: '4',
    name: 'Vitamin C 1000mg',
    type: 'Vitamins',
    price: 2800,
    oldPrice: 3500,
    imageUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?q=80&w=300&auto=format&fit=crop',
    partnerPharmacy: 'Alfa-Pharm',
    promoCode: 'MEDAI-15',
    description: 'Boosts immunity and antioxidant protection',
  },
];

export default function PharmacyScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const filteredItems = PHARMACY_DATA.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const copyPromoCode = async (code: string) => {
    try {
      await Clipboard.setStringAsync(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      Alert.alert('Promo Code', code);
    }
  };

  const openPartnerSite = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  const renderPartnerBanner = ({ item }: { item: Partner }) => (
    <TouchableOpacity
      style={[styles.partnerCard, { borderColor: item.color }]}
      onPress={() => openPartnerSite(item.url)}
      activeOpacity={0.8}
    >
      <View style={[styles.partnerIconBg, { backgroundColor: item.color + '20' }]}>
        <Ionicons name={item.logo as any} size={28} color={item.color} />
      </View>
      <Text style={styles.partnerName}>{item.name}</Text>
      <View style={[styles.discountBadge, { backgroundColor: item.color }]}>
        <Text style={styles.discountText}>{item.discount}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderItem = ({ item }: { item: PharmacyItem }) => {
    const isCopied = copiedCode === item.promoCode;

    return (
      <View style={styles.card}>
        <Image source={{ uri: item.imageUrl }} style={styles.image} />
        <View style={styles.pharmacyBadge}>
          <Text style={styles.pharmacyBadgeText}>{item.partnerPharmacy}</Text>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.itemType}>{item.type}</Text>
          <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.itemDesc} numberOfLines={2}>{item.description}</Text>

          <View style={styles.priceRow}>
            <Text style={styles.price}>{item.price.toLocaleString()} AMD</Text>
            {item.oldPrice && (
              <Text style={styles.oldPrice}>{item.oldPrice.toLocaleString()} AMD</Text>
            )}
            {item.oldPrice && (
              <View style={styles.saveBadge}>
                <Text style={styles.saveText}>
                  -{Math.round(((item.oldPrice - item.price) / item.oldPrice) * 100)}%
                </Text>
              </View>
            )}
          </View>

          {/* Promo code with copy */}
          <TouchableOpacity
            style={[styles.promoBox, isCopied && styles.promoBoxCopied]}
            onPress={() => copyPromoCode(item.promoCode)}
            activeOpacity={0.7}
          >
            <View style={styles.promoLeft}>
              <Ionicons name={isCopied ? 'checkmark-circle' : 'pricetag-outline'} size={16} color={isCopied ? '#00C4B4' : '#6B7A82'} />
              <Text style={styles.promoLabel}>{isCopied ? 'Copied!' : 'Promo:'}</Text>
            </View>
            <Text style={[styles.promoCode, isCopied && { color: '#00C4B4' }]}>{item.promoCode}</Text>
            <Ionicons name={isCopied ? 'checkmark' : 'copy-outline'} size={18} color={isCopied ? '#00C4B4' : '#1A2E35'} />
          </TouchableOpacity>

          {/* Order button */}
          <TouchableOpacity
            style={styles.orderButton}
            onPress={() => {
              copyPromoCode(item.promoCode);
              Alert.alert(
                'Order',
                `Promo code "${item.promoCode}" copied!\n\nVisit ${item.partnerPharmacy} to complete your order with discount.`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Open Site', onPress: () => openPartnerSite('https://google.com') },
                ]
              );
            }}
          >
            <Ionicons name="cart" size={18} color="#FFF" />
            <Text style={styles.orderButtonText}>Order with Discount</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Pharmacy</Text>
        <Text style={styles.headerSubtitle}>Order from our partners with exclusive discounts</Text>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search medicine..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Partner banners - horizontal scroll */}
        <Text style={styles.sectionTitle}>Our Partners</Text>
        <FlatList
          data={PARTNERS}
          renderItem={renderPartnerBanner}
          keyExtractor={item => item.name}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.partnerList}
        />

        {/* Product list */}
        <Text style={styles.sectionTitle}>Recommended Products</Text>
        {filteredItems.map(item => (
          <View key={item.id} style={{ paddingHorizontal: 20 }}>
            {renderItem({ item })}
          </View>
        ))}
        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FA' },
  header: {
    backgroundColor: '#fff', paddingTop: 60, paddingBottom: 20,
    paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#E0E8F0',
  },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#1A2E35' },
  headerSubtitle: { fontSize: 14, color: '#6B7A82', marginTop: 4 },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F4F7FA',
    borderRadius: 12, marginTop: 16, paddingHorizontal: 15, borderWidth: 1, borderColor: '#E0E8F0',
  },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, height: 45, fontSize: 16, color: '#1A2E35' },

  sectionTitle: {
    fontSize: 18, fontWeight: '700', color: '#1A2E35',
    marginHorizontal: 20, marginTop: 24, marginBottom: 12,
  },

  // Partners
  partnerList: { paddingLeft: 20, paddingRight: 10 },
  partnerCard: {
    width: 130, backgroundColor: '#FFF', borderRadius: 16,
    padding: 16, marginRight: 12, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#E0E8F0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  partnerIconBg: {
    width: 50, height: 50, borderRadius: 25,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  partnerName: { fontSize: 12, fontWeight: '700', color: '#1A2E35', textAlign: 'center', marginBottom: 8 },
  discountBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  discountText: { color: '#FFF', fontSize: 11, fontWeight: '700' },

  // Product cards
  card: {
    backgroundColor: '#FFF', borderRadius: 16, marginBottom: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06, shadowRadius: 12, elevation: 3,
  },
  image: { width: '100%', height: 160, resizeMode: 'cover' },
  pharmacyBadge: {
    position: 'absolute', top: 12, left: 12,
    backgroundColor: 'rgba(0,196,180,0.9)', paddingHorizontal: 10,
    paddingVertical: 5, borderRadius: 8,
  },
  pharmacyBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  cardBody: { padding: 16 },
  itemType: { fontSize: 12, color: '#6B7A82', fontWeight: '600', marginBottom: 4 },
  itemName: { fontSize: 18, fontWeight: '700', color: '#1A2E35', marginBottom: 4 },
  itemDesc: { fontSize: 13, color: '#94A3B8', lineHeight: 18, marginBottom: 12 },
  priceRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 8 },
  price: { fontSize: 20, fontWeight: '800', color: '#00C4B4' },
  oldPrice: { fontSize: 14, color: '#CBD5E1', textDecorationLine: 'line-through' },
  saveBadge: { backgroundColor: '#FF6B6B', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  saveText: { color: '#FFF', fontSize: 11, fontWeight: '700' },

  promoBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#E0E8F0', borderStyle: 'dashed', marginBottom: 12,
  },
  promoBoxCopied: { borderColor: '#00C4B4', backgroundColor: '#F0FDFB' },
  promoLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  promoLabel: { fontSize: 12, color: '#6B7A82', fontWeight: '500' },
  promoCode: { fontSize: 16, fontWeight: '800', color: '#1A2E35', letterSpacing: 1 },

  orderButton: {
    backgroundColor: '#1A2E35', flexDirection: 'row', paddingVertical: 14,
    borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  orderButtonText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
});
