import { useMemo, useState, useEffect, useRef } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
// SOLO importa react-native-ble-plx si NO es web
const isWeb = Platform.OS === 'web';
import type {
  BleManager as BleManagerType,
  Device as DeviceType,
  State as StateType,
  BleError as BleErrorType,
  Characteristic as CharacteristicType,
  ConnectionPriority as ConnectionPriorityType,
} from 'react-native-ble-plx';
let BleManager: typeof BleManagerType;
let State: typeof StateType;
let BleError: typeof BleErrorType;
let Characteristic: typeof CharacteristicType;
let ConnectionPriority: typeof ConnectionPriorityType;
if (!isWeb) {
  const blePlx = require('react-native-ble-plx');
  BleManager = blePlx.BleManager;
  State = blePlx.State;
  BleError = blePlx.BleError;
  Characteristic = blePlx.Characteristic;
  ConnectionPriority = blePlx.ConnectionPriority;
}
import * as ExpoDevice from 'expo-device';
import { Buffer } from 'buffer';

const HEART_RATE_SERVICE_UUID = '0000180d-0000-1000-8000-00805f9b34fb';
const HEART_RATE_CHARACTERISTIC_UUID = '00002a37-0000-1000-8000-00805f9b34fb';

export interface RawDataLog {
  timestamp: string;
  deviceId: string;
  serviceUUID: string;
  characteristicUUID: string;
  data: string;
}

type OnRawDataUpdateCallback = (log: RawDataLog) => void;

interface BluetoothLowEnergyApi {
  requestPermissions(): Promise<boolean>;
  scanForPeripherals(): void;
  stopScan(): void;
  connectToDevice(device: any): Promise<void>;
  disconnectFromDevice(): void;
  allDevices: any[];
  connectedDevice: any | null;
  heartRate: number | null;
  statusMessage: string;
  isScanning: boolean;
  setOnRawDataUpdateCallback: (callback: OnRawDataUpdateCallback) => void;
}

export default function useBLE(): BluetoothLowEnergyApi {
  // Usamos 'any' para Device y Subscription para evitar errores de tipo en web
  const bleManager = useMemo(() => (!isWeb ? new BleManager() : null), []);
  const [allDevices, setAllDevices] = useState<any[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<any | null>(null);
  const [heartRate, setHeartRate] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('Inicializando...');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [charSubscriptions, setCharSubscriptions] = useState<any[]>([]);
  const onRawDataUpdateRef = useRef<OnRawDataUpdateCallback | null>(null);

  const setOnRawDataUpdateCallback = (callback: OnRawDataUpdateCallback) => {
    onRawDataUpdateRef.current = callback;
  };

  const requestPermissions = async (): Promise<boolean> => {
    setStatusMessage('Solicitando permisos...');
    if (Platform.OS === 'android') {
      const apiLevel = Platform.Version ?? 0;
      let grantedStatus;
      if (apiLevel < 31) {
        grantedStatus = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Permiso de Ubicación',
            message: 'Requerido para escanear dispositivos Bluetooth LE',
            buttonPositive: 'OK',
          }
        );
        const result = grantedStatus === PermissionsAndroid.RESULTS.GRANTED;
        setStatusMessage(result ? 'Permiso de ubicación concedido' : 'Permiso de ubicación denegado');
        return result;
      } else {
        const permissions = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);
        const allGranted =
          permissions[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED &&
          permissions[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED &&
          permissions[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED;
        setStatusMessage(allGranted ? 'Permisos BLE concedidos' : 'Algunos permisos BLE fueron denegados');
        return allGranted;
      }
    } else {
      setStatusMessage('Permisos concedidos (iOS/macOS)');
      return true;
    }
  };

  const isDuplicateDevice = (devices: any[], nextDevice: any) =>
    devices.findIndex((device) => device.id === nextDevice.id) > -1;

  const scanForPeripherals = () => {
    if (isWeb || !bleManager) return;
    setStatusMessage('Escaneando dispositivos BLE...');
    setIsScanning(true);
    bleManager.startDeviceScan(null, { allowDuplicates: false }, (error: any, device: any) => {
      if (error) {
        setStatusMessage(`Error en escaneo: ${error.message}`);
        setIsScanning(false);
        return;
      }
      if (device && device.name) {
        setAllDevices((prevState) => {
          if (!isDuplicateDevice(prevState, device)) {
            return [...prevState, device];
          }
          return prevState;
        });
      }
    });
  };

  const stopScan = () => {
    if (isWeb || !bleManager) return;
    setStatusMessage('Escaneo detenido.');
    setIsScanning(false);
    bleManager.stopDeviceScan();
  };

  const connectToDevice = async (device: any) => {
    if (isWeb || !bleManager) return;
    try {
      setStatusMessage(`Conectando a ${device.name || device.id}...`);
      if (isScanning) {
        bleManager.stopDeviceScan();
        setIsScanning(false);
      }
      const connectionOptions: any = {
        requestMTU: 247,
        refreshGatt: 'OnConnected',
        timeout: 15000,
        connectionPriority: ConnectionPriority ? ConnectionPriority.High : undefined,
      };
      const connected = await bleManager.connectToDevice(device.id, connectionOptions);
      setConnectedDevice(connected);
      setStatusMessage(`Conectado a ${connected.name || connected.id}`);
      await connected.discoverAllServicesAndCharacteristics();
      setStatusMessage('Servicios y características descubiertos.');
      subscribeToAllNotifiableCharacteristics(connected);
    } catch (e: any) {
      setStatusMessage(`Error al conectar: ${e.message}`);
      setConnectedDevice(null);
    }
  };

  const disconnectFromDevice = async () => {
    if (isWeb || !bleManager) return;
    if (connectedDevice) {
      setStatusMessage(`Desconectando de ${connectedDevice.name || connectedDevice.id}...`);
      for (const sub of charSubscriptions) {
        sub.remove();
      }
      setCharSubscriptions([]);
      try {
        await bleManager.cancelDeviceConnection(connectedDevice.id);
        setStatusMessage('Dispositivo desconectado.');
      } catch (e: any) {
        setStatusMessage(`Error al desconectar: ${e.message}`);
      } finally {
        setConnectedDevice(null);
        setHeartRate(null);
        setAllDevices([]);
      }
    } else {
      setStatusMessage('Ningún dispositivo conectado para desconectar.');
    }
  };

  const onCharacteristicUpdate = (
    error: any,
    characteristic: any,
    device: any
  ) => {
    if (error) return;
    if (!characteristic?.value) return;
    const rawValueBase64 = characteristic.value;
    const rawDataHex = Buffer.from(rawValueBase64, 'base64').toString('hex');
    if (onRawDataUpdateRef.current) {
      onRawDataUpdateRef.current({
        timestamp: new Date().toLocaleTimeString(),
        deviceId: device.id,
        serviceUUID: characteristic.serviceUUID,
        characteristicUUID: characteristic.uuid,
        data: rawDataHex,
      });
    }
  };

  const subscribeToAllNotifiableCharacteristics = async (device: any) => {
    if (isWeb || !device) return;
    setStatusMessage('Suscribiéndose a características notificables...');
    const services = await device.services();
    const newSubscriptions: any[] = [];
    for (const service of services) {
      const characteristics = await service.characteristics();
      for (const char of characteristics) {
        if (char.isNotifiable || char.isIndicatable) {
          try {
            const transactionId = `monitor_${device.id}_${char.uuid}`;
            const subscription = char.monitor((error: any, updatedChar: any) => {
              onCharacteristicUpdate(error, updatedChar, device);
            }, transactionId);
            newSubscriptions.push(subscription);
          } catch (monitorError) {
            setStatusMessage(`Error al suscribir a ${char.uuid}`);
          }
        }
      }
    }
    if (newSubscriptions.length > 0) {
      setCharSubscriptions((prevSubs) => [...prevSubs, ...newSubscriptions]);
      setStatusMessage(`Suscrito a ${newSubscriptions.length} características.`);
    } else {
      setStatusMessage('No se encontraron características notificables.');
    }
  };

  useEffect(() => {
    if (isWeb || !bleManager) return;
    const initializeBLE = async () => {
      const currentState = await bleManager.state();
      setStatusMessage(`Estado BLE: ${currentState}`);
      if (State && currentState === State.PoweredOff) {
        setStatusMessage('Bluetooth está apagado. Por favor, enciéndelo.');
      } else if (State && currentState === State.PoweredOn) {
        setStatusMessage('Bluetooth encendido y listo.');
      }
    };
    initializeBLE();
    const subscription = bleManager.onStateChange((state: any) => {
      if (State && state === State.PoweredOff) {
        setStatusMessage('Bluetooth está apagado. Por favor, enciéndelo.');
        setAllDevices([]);
        setConnectedDevice(null);
        setHeartRate(null);
      } else if (State && state === State.PoweredOn) {
        setStatusMessage('Bluetooth encendido y listo.');
      }
    });
    return () => {
      subscription.remove();
    };
  }, [bleManager]);

  if (isWeb) {
    return {
      requestPermissions: async () => false,
      scanForPeripherals: () => {},
      stopScan: () => {},
      connectToDevice: async () => {},
      disconnectFromDevice: () => {},
      allDevices: [],
      connectedDevice: null,
      heartRate: null,
      statusMessage: 'BLE no soportado en web',
      isScanning: false,
      setOnRawDataUpdateCallback: () => {},
    };
  }

  return {
    requestPermissions,
    scanForPeripherals,
    stopScan,
    connectToDevice,
    disconnectFromDevice,
    allDevices,
    connectedDevice,
    heartRate,
    statusMessage,
    isScanning,
    setOnRawDataUpdateCallback,
  };
} 