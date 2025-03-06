import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { createBackup, restoreFromBackup } from '../utils/backupRestore';
import PasswordManager from './PasswordManager';

export default function Settings({ onClose }: { onClose: () => void }) {

  const handleBackup = async () => {
    try {
      await createBackup();
      Alert.alert('Success', 'Backup created successfully');
    } catch (error) {
      console.error('Error creating backup:', error);
      Alert.alert('Error', 'Failed to create backup');
    }
  };

  const handleRestore = async () => {
    try {
      await restoreFromBackup();
      Alert.alert('Success', 'Data restored successfully');
    } catch (error) {
      console.error('Error restoring data:', error);
      Alert.alert('Error', 'Failed to restore data');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Security</Text>
         <PasswordManager />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Backup & Restore</Text>
        <TouchableOpacity style={styles.button} onPress={handleBackup}>
          <Ionicons name="cloud-upload" size={24}color="#007AFF"></Ionicons>
          <Text style={styles.buttonText}>Create Backup</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={handleRestore}>
          <Ionicons name="cloud-download" size={24}color="#007AFF"></Ionicons>
          <Text style={styles.buttonText}>Restore Data</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <Text style={styles.versionText}>
          Version {Constants.expoConfig?.version || '1.0.0'}
        </Text>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1c1c1e',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2c2c2e',
  },
  closeButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 16,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2c2c2e',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginBottom: 16,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2c2c2c',
    padding: 16,
    borderRadius: 8,
    marginBottom: 15,
    gap: 10,
},
buttonText: {
    color: '#fff',
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '500',
  },
  versionText: {
    color: '#666',
    fontSize: 14,
  },
});