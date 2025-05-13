import React from 'react';
import { Modal, View, Text, Button, ScrollView, StyleSheet } from 'react-native';

export default function DebugConsole({ logs, visible, onClose }) {
  return (
    <Modal visible={visible} transparent={true} animationType="slide">
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Debug Console</Text>
          <ScrollView style={styles.logContainer}>
            {logs.map((log, idx) => (
              <Text key={idx} style={styles.logText}>{log}</Text>
            ))}
          </ScrollView>
          <Button title="Cerrar" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', padding: 20, borderRadius: 10, width: '80%', maxHeight: '80%' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  logContainer: { maxHeight: 300, marginBottom: 10 },
  logText: { fontSize: 12, color: '#333' },
});
