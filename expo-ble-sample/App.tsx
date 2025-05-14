import React, { useState, useEffect, useCallback } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  Button,
  FlatList,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  PermissionsAndroid, // Asegúrate que está si usas permisos directamente aquí (aunque useBLE lo maneja)
  Platform,
  Modal,
  ScrollView,
} from 'react-native';
import useBLE, { RawDataLog } from './useBLE'; // Asegúrate que la ruta es correcta e importa RawDataLog
import type { Device } from 'react-native-ble-plx';

// Quita LineChart si no lo usas o configúralo si es necesario
// import { LineChart } from 'react-native-chart-kit';

const App = () => {
  const {
    requestPermissions,
    scanForPeripherals,
    stopScan,
    allDevices,
    connectToDevice,
    connectedDevice,
    disconnectFromDevice,
    heartRate,
    statusMessage,
    isScanning,
    setOnRawDataUpdateCallback,
  } = useBLE();

  const [rawDataLogs, setRawDataLogs] = useState<RawDataLog[]>([]);
  const [showRawDataModal, setShowRawDataModal] = useState<boolean>(false);

  const handleRawDataUpdate = useCallback((log: RawDataLog) => {
    setRawDataLogs(prevLogs => [log, ...prevLogs.slice(0, 199)]);
  }, []);

  useEffect(() => {
    setOnRawDataUpdateCallback(handleRawDataUpdate);
    return () => {
    };
  }, [setOnRawDataUpdateCallback, handleRawDataUpdate]);

  const requestBlePermissions = async () => {
    const granted = await requestPermissions();
    if (granted) {
      console.log('Permisos BLE concedidos por el usuario');
    } else {
      console.log('Permisos BLE denegados por el usuario');
    }
  };

  useEffect(() => {
    requestBlePermissions();
  }, []);

  const handleScan = async () => {
    const permissionsGranted = await requestPermissions();
    if (!permissionsGranted) {
      alert('Los permisos de Bluetooth son necesarios para escanear dispositivos.');
      return;
    }
    setRawDataLogs([]);
    scanForPeripherals();
  };

  const stopScanInternal = () => {
    stopScan();
  };

  const handleConnect = async (device: Device) => {
    setRawDataLogs([]);
    await connectToDevice(device);
  };

  const handleDisconnect = async () => {
    await disconnectFromDevice();
    setRawDataLogs([]);
  };

  const renderDeviceItem = ({ item }: { item: Device }) => (
    <TouchableOpacity style={styles.deviceItem} onPress={() => handleConnect(item)} disabled={!!connectedDevice}>
      <Text style={styles.deviceText}>{item.name || 'Dispositivo Desconocido'}</Text>
      <Text style={styles.deviceId}>{item.id}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.statusContainer}>
        <Text style={styles.statusTextTitle}>Estado:</Text>
        <Text style={styles.statusText}>{statusMessage}</Text>
      </View>

      {connectedDevice ? (
        <View style={styles.deviceInfoContainer}>
          <Text style={styles.deviceInfoText}>Conectado a: {connectedDevice.name || connectedDevice.id}</Text>
          {heartRate !== null && (
            <Text style={styles.heartRateText}>Ritmo Cardíaco: {heartRate} BPM</Text>
          )}
          <Button title="Desconectar" onPress={handleDisconnect} color="#FF6347"/>
          <View style={{marginTop: 10}}>
            <Button title="Ver Datos Crudos" onPress={() => setShowRawDataModal(true)} />
          </View>
        </View>
      ) : (
        <View style={styles.scanControlsContainer}>
          {isScanning ? (
            <View style={styles.scanningContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.scanningText}>Escaneando...</Text>
              <Button title="Detener Escaneo" onPress={stopScanInternal} color="#FF6347" />
            </View>
          ) : (
            <Button title="Escanear Dispositivos BLE" onPress={handleScan} disabled={isScanning} />
          )}
      </View>
      )}

      {!connectedDevice && (
        <FlatList
          data={allDevices}
          keyExtractor={(item) => item.id}
          renderItem={renderDeviceItem}
          ListHeaderComponent={() => (
            allDevices.length > 0 ? <Text style={styles.listHeader}>Dispositivos Encontrados:</Text> : null
          )}
          ListEmptyComponent={() => (
            !isScanning && allDevices.length === 0 ? <Text style={styles.emptyListText}>Ningún dispositivo encontrado. Intenta escanear.</Text> : null
          )}
          style={styles.listContainer}
        />
      )}

      <Modal
        animationType="slide"
        transparent={true}
        visible={showRawDataModal}
        onRequestClose={() => {
          setShowRawDataModal(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>Log de Datos Crudos Recibidos</Text>
            <ScrollView style={styles.modalScrollView}>
              {rawDataLogs.length === 0 ? (
                <Text style={styles.modalText}>No se han recibido datos crudos aún.</Text>
              ) : (
                rawDataLogs.map((log, idx) => (
                  <View key={idx} style={styles.logEntry}>
                    <Text style={styles.logTimestamp}>[{log.timestamp}]</Text>
                    <Text style={styles.logDetails}>Dev: {log.deviceId.slice(0,10)}...</Text>
                    <Text style={styles.logDetails}>Svc: ...{log.serviceUUID.slice(-12)}</Text>
                    <Text style={styles.logDetails}>Char: ...{log.characteristicUUID.slice(-12)}</Text>
                    <Text style={styles.logData}>{log.data}</Text>
                  </View>
                ))
              )}
            </ScrollView>
            <Button title="Cerrar" onPress={() => setShowRawDataModal(false)} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F0F0',
  },
  statusContainer: {
    padding: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#DDDDDD',
    alignItems: 'center',
  },
  statusTextTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
  },
  statusText: {
    fontSize: 14,
    color: '#555555',
    marginTop: 4,
    textAlign: 'center',
  },
  deviceInfoContainer: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#E6F7FF',
    margin: 15,
    borderRadius: 8,
  },
  deviceInfoText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#00528C',
  },
  heartRateText: {
    fontSize: 22,
    color: '#007AFF',
    marginVertical: 15,
    fontWeight: 'bold',
  },
  scanControlsContainer: {
    padding: 15,
    alignItems: 'center',
  },
  scanningContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  scanningText: {
    fontSize: 16,
    marginTop: 10,
    marginBottom: 15,
    color: '#007AFF',
  },
  listContainer: {
    flex: 1,
    marginHorizontal: 15,
  },
  listHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    marginVertical: 10,
    color: '#333333',
  },
  deviceItem: {
    padding: 15,
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  deviceText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
  },
  deviceId: {
    fontSize: 12,
    color: '#777777',
    marginTop: 4,
  },
  emptyListText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: '#888888',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalView: {
    margin: 20,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 25,
    alignItems: 'stretch',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    marginBottom: 15,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalScrollView: {
    marginBottom: 15,
    maxHeight: Dimensions.get('window').height * 0.5,
  },
  modalText: {
    marginBottom: 15,
    textAlign: 'center',
  },
  logEntry: {
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 8,
  },
  logTimestamp: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  logDetails: {
    fontSize: 11,
    color: '#888',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  logData: {
    fontSize: 13,
    color: '#333',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    backgroundColor: '#f0f0f0',
    padding: 4,
    borderRadius: 3,
    marginTop: 4,
    flexWrap: 'wrap',
  },
});

export default App;