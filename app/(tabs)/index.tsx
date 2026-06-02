import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { sendMessageToAI } from '../../services/gemini';

export default function ChatScreen() {
  const [messages, setMessages] = useState<{ id: string; text: string; sender: 'user' | 'ai' }[]>([
    { id: '1', text: 'Բարև Ձեզ: Ես MedAIArmenia վիրտուալ օգնականն եմ: Ինչպե՞ս կարող եմ օգնել ձեզ այսօր:', sender: 'ai' }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const sendMessage = async () => {
    if (inputText.trim() === '') return;

    const userMsg = inputText.trim();

    // 🔒 SECURITY: Limit message length to prevent abuse
    if (userMsg.length > 1000) {
      return; // Silently reject overly long messages
    }

    const newMessages = [...messages, { id: Date.now().toString(), text: userMsg, sender: 'user' as const }];
    setMessages(newMessages);
    setInputText('');
    setIsLoading(true);

    const aiResponseText = await sendMessageToAI(userMsg);

    setMessages([...newMessages, { id: (Date.now() + 1).toString(), text: aiResponseText, sender: 'ai' }]);
    setIsLoading(false);
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Ionicons name="medical" size={28} color="#00C4B4" />
          <Text style={styles.headerTitle}>MedAI Assistant</Text>
        </View>
        <Text style={styles.headerSubtitle}>24/7 Բժշկական Խորհրդատվություն</Text>
      </View>

      <ScrollView 
        ref={scrollViewRef}
        style={styles.chatContainer}
        contentContainerStyle={styles.chatContent}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        <View style={styles.disclaimerContainer}>
          <Ionicons name="warning-outline" size={16} color="#856404" />
          <Text style={styles.disclaimerText}>
            Ուշադրություն: Արհեստական բանականության խորհուրդները չեն կարող փոխարինել իրական բժշկի այցին:
          </Text>
        </View>

        {messages.map((msg) => (
          <View key={msg.id} style={[styles.messageBubble, msg.sender === 'user' ? styles.userBubble : styles.aiBubble]}>
            <Text style={[styles.messageText, msg.sender === 'user' ? styles.userText : styles.aiText]}>{msg.text}</Text>
          </View>
        ))}

        {isLoading && (
          <View style={[styles.messageBubble, styles.aiBubble, styles.loadingBubble]}>
            <ActivityIndicator size="small" color="#00C4B4" />
          </View>
        )}
      </ScrollView>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Նկարագրեք ձեր գանգատները..."
          placeholderTextColor="#999"
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity style={styles.sendButton} onPress={sendMessage} disabled={isLoading || inputText.trim() === ''}>
          <Ionicons name="send" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F7FA',
  },
  header: {
    backgroundColor: '#fff',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E8F0',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A2E35',
    marginLeft: 10,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6B7A82',
  },
  chatContainer: {
    flex: 1,
  },
  chatContent: {
    padding: 20,
    paddingBottom: 40,
  },
  disclaimerContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFF3CD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    alignItems: 'center',
  },
  disclaimerText: {
    color: '#856404',
    fontSize: 12,
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
  messageBubble: {
    maxWidth: '85%',
    padding: 15,
    borderRadius: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#00C4B4',
    borderBottomRightRadius: 5,
  },
  aiBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 5,
  },
  loadingBubble: {
    padding: 15,
    width: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userText: {
    color: '#FFFFFF',
  },
  aiText: {
    color: '#2D3748',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 15,
    paddingBottom: Platform.OS === 'ios' ? 30 : 15,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E8F0',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: '#F4F7FA',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 16,
    maxHeight: 100,
    minHeight: 45,
    color: '#1A2E35',
  },
  sendButton: {
    backgroundColor: '#00C4B4',
    width: 45,
    height: 45,
    borderRadius: 22.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
    shadowColor: '#00C4B4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
});
