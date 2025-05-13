import React, { useState, useEffect, useRef } from 'react';
import { AppRegistry, View, Text, Button, FlatList, Modal, TextInput, StyleSheet, ScrollView } from 'react-native';
import { BleManager } from 'react-native-ble-plx';
import { createRoot } from 'react-dom/client';
import DebugConsole from './components/DebugConsole';
import { addLog } from './helpers/logger';

const manager = new BleManager();

function App() {
  const [devices, setDevices] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [connectedDevice, setConnectedDevice] = useState(null);
  const [logs, setLogs] = useState([]);
  const [showConsole, setShowConsole] = useState(false);
  const [characteristicUUID, setCharacteristicUUID] = useState('');
  const [dataReceived, setDataReceived] = useState([]);
  const subscriptionRef = useRef(null);

  useEffect(() => {
    return () => {
      manager.destroy();
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
      }
    };
  }, []);

  const scanDevices = () => {
    setDevices([]);
    setScanning(true);
    addLog(setLogs, 'Iniciando escaneo de dispositivos BLE...');
    manager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        addLog(setLogs, 'Error de escaneo: ' + error.message);
        setScanning(false);
        return;
      }
      if (device && !devices.find(d => d.id === device.id)) {
        setDevices(prev => [...prev, device]);
        addLog(setLogs, `Dispositivo encontrado: ${device.name || 'Sin nombre'} (${device.id})`);
      }
    });
    setTimeout(() => {
      manager.stopDeviceScan();
      setScanning(false);
      addLog(setLogs, 'Escaneo detenido.');
    }, 10000);
  };

  const connectToDevice = async (device) => {
    addLog(setLogs, `Conectando a ${device.name || 'Sin nombre'} (${device.id})...`);
    try {
      const connected = await manager.connectToDevice(device.id);
      setConnectedDevice(connected);
      addLog(setLogs, 'Conectado. Descubriendo servicios y características...');
      await connected.discoverAllServicesAndCharacteristics();
      addLog(setLogs, 'Servicios y características descubiertos.');
    } catch (e) {
      addLog(setLogs, 'Error al conectar: ' + e.message);
    }
  };

  const subscribeToCharacteristic = async () => {
    if (!connectedDevice || !characteristicUUID) {
      addLog(setLogs, 'Debes conectar un dispositivo y especificar el UUID de la característica.');
      return;
    }
    addLog(setLogs, `Suscribiéndose a la característica ${characteristicUUID}...`);
    try {
      const services = await connectedDevice.services();
      for (const service of services) {
        const characteristics = await service.characteristics();
        for (const char of characteristics) {
          if (char.uuid.toLowerCase() === characteristicUUID.toLowerCase()) {
            subscriptionRef.current = char.monitor((error, characteristic) => {
              if (error) {
                addLog(setLogs, 'Error al recibir datos: ' + error.message);
                return;
              }
              const raw = characteristic.value;
              addLog(setLogs, 'Dato crudo recibido: ' + raw);
              setDataReceived(prev => [...prev, raw]);
            });
            addLog(setLogs, 'Suscripción exitosa. Esperando datos...');
            return;
          }
        }
      }
      addLog(setLogs, 'Característica no encontrada.');
    } catch (e) {
      addLog(setLogs, 'Error al suscribirse: ' + e.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Escáner BLE para macOS </Text>
      <Button title={scanning ? 'Escaneando...' : 'Escanear dispositivos BLE'} onPress={scanDevices} disabled={scanning} />
      <FlatList
        data={devices}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.deviceItem}>
            <Text>{item.name || 'Sin nombre'} - {item.id}</Text>
            <Button title="Conectar" onPress={() => connectToDevice(item)} />
          </View>
        )}
      />
      {connectedDevice && (
        <View style={styles.section}>
          <Text style={styles.subtitle}>Dispositivo conectado: {connectedDevice.name || connectedDevice.id}</Text>
          <TextInput
            style={styles.input}
            placeholder="UUID de la característica"
            value={characteristicUUID}
            onChangeText={setCharacteristicUUID}
          />
          <Button title="Suscribirse a característica" onPress={subscribeToCharacteristic} />
        </View>
      )}
      <Button title="Mostrar Debug Console" onPress={() => setShowConsole(true)} />
      <DebugConsole logs={logs} visible={showConsole} onClose={() => setShowConsole(false)} />
      <View style={styles.section}>
        <Text style={styles.subtitle}>Datos crudos recibidos:</Text>
        <ScrollView style={styles.dataContainer}>
          {dataReceived.map((data, idx) => (
            <Text key={idx} style={styles.dataText}>{data}</Text>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 10 },
  subtitle: { fontSize: 16, fontWeight: 'bold', marginTop: 20 },
  deviceItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 5 },
  section: { marginTop: 20 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 5, padding: 8, marginVertical: 10 },
  modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', padding: 20, borderRadius: 10, width: '80%', maxHeight: '80%' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  logContainer: { maxHeight: 300, marginBottom: 10 },
  logText: { fontSize: 12, color: '#333' },
  dataContainer: { maxHeight: 150, marginTop: 10 },
  dataText: { fontSize: 12, color: '#007AFF' },
});

const root = createRoot(document.getElementById('root'));
root.render(<App />);
