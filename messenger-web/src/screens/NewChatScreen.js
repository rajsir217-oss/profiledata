import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function NewChatScreen({ onBack, onChatOpen }) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backButton}>← Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Chat</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.text}>New Chat Screen</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  backButton: { fontSize: 16, color: '#6C3FA0', marginRight: 12 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  text: { fontSize: 18, color: '#666' },
});
