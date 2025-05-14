import React, { useMemo, useState, useEffect } from "react";
import { PermissionsAndroid, Platform } from "react-native";
import {
  BleManager,
  Device,
  State,
  Subscription,
  BleErrorCode,
  BleError,
  Characteristic,
  ConnectionPriority,
  Service,
} from "react-native-ble-plx";
import * as ExpoDevice from "expo-device";
import { Buffer } from "buffer"; // Asegúrate de tener 'buffer' instalado

// UUIDs estándar para Heart Rate Service
const HEART_RATE_SERVICE_UUID = "0000180d-0000-1000-8000-00805f9b34fb";
const HEART_RATE_CHARACTERISTIC_UUID = "00002a37-0000-1000-8000-00805f9b34fb";

export interface RawDataLog {
  timestamp: string;
  deviceId: string;
  serviceUUID: string;
  characteristicUUID: string;
  data: string; // Hex string
}

type OnRawDataUpdateCallback = (log: RawDataLog) => void;

interface BluetoothLowEnergyApi {
  requestPermissions(): Promise<boolean>;
  scanForPeripherals(): void;
  stopScan(): void;
  connectToDevice(device: Device): Promise<void>;
  disconnectFromDevice(): void;
  allDevices: Device[];
  connectedDevice: Device | null;
  heartRate: number | null;
  statusMessage: string;
  isScanning: boolean;
  setOnRawDataUpdateCallback: (callback: OnRawDataUpdateCallback) => void;
}

export default function useBLE(): BluetoothLowEnergyApi {
  const bleManager = useMemo(() => new BleManager(), []);
  const [allDevices, setAllDevices] = useState<Device[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [heartRate, setHeartRate] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("Inicializando...");
  const [isScanning, setIsScanning] = useState<boolean>(false);

  const [charSubscriptions, setCharSubscriptions] = useState<Subscription[]>([]);

  let onRawDataUpdateRef: React.MutableRefObject<OnRawDataUpdateCallback | null> = React.useRef(null);

  const setOnRawDataUpdateCallback = (callback: OnRawDataUpdateCallback) => {
    onRawDataUpdateRef.current = callback;
  };

  const requestPermissions = async (): Promise<boolean> => {
    setStatusMessage("Solicitando permisos...");
    if (Platform.OS !== "android") {
      setStatusMessage("Permisos concedidos (no es Android)");
      return true;
    }

    const apiLevel = ExpoDevice.platformApiLevel ?? 0;
    let grantedStatus;

    if (apiLevel < 31) { // Android 11 (API 30) e inferiores
      grantedStatus = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: "Permiso de Ubicación",
          message: "Requerido para escanear dispositivos Bluetooth LE",
          buttonPositive: "OK",
        }
      );
      const result = grantedStatus === PermissionsAndroid.RESULTS.GRANTED;
      setStatusMessage(result ? "Permiso de ubicación concedido" : "Permiso de ubicación denegado");
      return result;
    } else { // Android 12 (API 31) y superiores
      const permissions = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, // Aunque ACCESS_FINE_LOCATION puede no ser estrictamente necesario para algunas operaciones en API 31+, es buena práctica incluirlo.
      ]);

      const allGranted =
        permissions[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED &&
        permissions[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED &&
        permissions[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED;

      setStatusMessage(allGranted ? "Permisos BLE concedidos" : "Algunos permisos BLE fueron denegados");
      return allGranted;
    }
  };

  const isDuplicateDevice = (devices: Device[], nextDevice: Device) =>
    devices.findIndex((device) => device.id === nextDevice.id) > -1;

  const scanForPeripherals = () => {
    setStatusMessage("Escaneando dispositivos BLE...");
    setIsScanning(true);
    bleManager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
          if (error) {
        console.error("Error en escaneo:", error);
        setStatusMessage(`Error en escaneo: ${error.message}`);
        setIsScanning(false);
        if (error.errorCode === BleErrorCode.BluetoothUnauthorized) {
            setStatusMessage("Error: Permisos Bluetooth no autorizados. Por favor, verifica los permisos.");
        }
            return;
          }
      if (device && device.name) { // Filtramos por dispositivos con nombre para simplificar
        setAllDevices((prevState) => {
          if (!isDuplicateDevice(prevState, device)) {
            console.log("Dispositivo encontrado:", device.name, device.id);
            return [...prevState, device];
          }
          return prevState;
        });
          }
        });
  };

  const stopScan = () => {
    setStatusMessage("Escaneo detenido.");
    setIsScanning(false);
          bleManager.stopDeviceScan();
  }

  const connectToDevice = async (device: Device) => {
    try {
      setStatusMessage(`Conectando a ${device.name || device.id}...`);
      if (isScanning) {
        bleManager.stopDeviceScan();
        setIsScanning(false);
        console.log("Escaneo detenido antes de conectar.");
      }
      console.log("Deteniendo escaneo antes de conectar.");

      const connectionOptions: any = {
        requestMTU: 247,
        refreshGatt: "OnConnected",
        timeout: 15000,
        connectionPriority: ConnectionPriority.High,
      };

      const connected = await bleManager.connectToDevice(device.id, connectionOptions);
      setConnectedDevice(connected);
      setStatusMessage(`Conectado a ${connected.name || connected.id}`);
      console.log("Dispositivo conectado:", connected.name, connected.id);

      await connected.discoverAllServicesAndCharacteristics();
      console.log("Servicios y características descubiertos.");
      setStatusMessage("Servicios y características descubiertos.");

      subscribeToAllNotifiableCharacteristics(connected);
    } catch (e: any) {
      console.error(`Error al conectar con ${device.name || device.id}:`, e);
      setStatusMessage(`Error al conectar: ${e.message}`);
      setConnectedDevice(null); // Asegurarse de limpiar el dispositivo conectado en caso de error
    }
  };

  const disconnectFromDevice = async () => {
    if (connectedDevice) {
      setStatusMessage(`Desconectando de ${connectedDevice.name || connectedDevice.id}...`);
      console.log("Desconectando del dispositivo:", connectedDevice.id);
      
      for (const sub of charSubscriptions) {
        sub.remove();
      }
      setCharSubscriptions([]);
      console.log("Todas las suscripciones a características eliminadas.");

      try {
        await bleManager.cancelDeviceConnection(connectedDevice.id);
        setStatusMessage("Dispositivo desconectado.");
        console.log("Dispositivo desconectado.");
      } catch (e: any) {
        console.error("Error al desconectar:", e);
        setStatusMessage(`Error al desconectar: ${e.message}`);
      } finally {
        setConnectedDevice(null);
        setHeartRate(null);
        setAllDevices([]); // Opcional: limpiar lista de dispositivos escaneados
      }
    } else {
      setStatusMessage("Ningún dispositivo conectado para desconectar.");
    }
  };

  const onCharacteristicUpdate = (
    error: BleError | null,
    characteristic: Characteristic | null,
    device: Device
  ) => {
          if (error) {
      console.warn(`Error al recibir datos de ${characteristic?.uuid || 'desconocida'}:`, error);
      if (error.errorCode === BleErrorCode.DeviceDisconnected) {
        // Si un error de característica indica desconexión, manejarlo.
        // Esto podría ser redundante si ya tienes un listener global de desconexión.
        // disconnectFromDevice(); 
      }
      return;
    }

    if (!characteristic?.value) {
      console.warn(`Característica ${characteristic?.uuid} recibida sin valor.`);
      return;
    }

    const rawValueBase64 = characteristic.value;
    const rawDataHex = Buffer.from(rawValueBase64, "base64").toString("hex");
    
    console.log(
      `Datos de ${characteristic.uuid} (Servicio: ${characteristic.serviceUUID}) (Dispositivo: ${device.id}): ${rawDataHex}`
    );

    if (onRawDataUpdateRef.current) {
      onRawDataUpdateRef.current({
        timestamp: new Date().toLocaleTimeString(),
        deviceId: device.id,
        serviceUUID: characteristic.serviceUUID,
        characteristicUUID: characteristic.uuid,
        data: rawDataHex,
      });
    }

    if (characteristic.uuid === HEART_RATE_CHARACTERISTIC_UUID) {
        const rawData = Buffer.from(characteristic.value, "base64");
        let hrValue = 0;
        const flags = rawData[0];
        const isUINT16Format = (flags & 0x01) !== 0;

        if (isUINT16Format) {
          if (rawData.length >= 3) hrValue = rawData.readUInt16LE(1);
        } else {
          if (rawData.length >= 2) hrValue = rawData[1];
        }
        if (hrValue > 0) setHeartRate(hrValue);
    }
  };

  const subscribeToAllNotifiableCharacteristics = async (device: Device) => {
    if (!device) {
      console.warn("No hay dispositivo conectado para suscribirse a características.");
      setStatusMessage("No hay dispositivo conectado.");
            return;
          }
  
    setStatusMessage("Suscribiéndose a características notificables...");
    console.log(`Buscando características notificables para ${device.id}`);
  
    const services = await device.services();
    const newSubscriptions: Subscription[] = [];
  
    for (const service of services) {
      const characteristics = await service.characteristics();
      for (const char of characteristics) {
        if (char.isNotifiable || char.isIndicatable) {
          console.log(
            `Suscribiendo a: UUID=${char.uuid}, Servicio=${service.uuid}, Notificable=${char.isNotifiable}, Indicable=${char.isIndicatable}`
          );
          try {
            const transactionId = `monitor_${device.id}_${char.uuid}`;
            const subscription = char.monitor((error, updatedChar) => {
              onCharacteristicUpdate(error, updatedChar, device);
            }, transactionId);
            newSubscriptions.push(subscription);
            console.log(`Suscrito a ${char.uuid}`);
          } catch (monitorError) {
            console.error(`Error al suscribir a ${char.uuid}:`, monitorError);
            setStatusMessage(`Error al suscribir a ${char.uuid}`);
          }
        }
      }
    }
  
    if (newSubscriptions.length > 0) {
      setCharSubscriptions(prevSubs => [...prevSubs, ...newSubscriptions]);
      setStatusMessage(`Suscrito a ${newSubscriptions.length} características.`);
    } else {
      setStatusMessage("No se encontraron características notificables.");
      console.log("No se encontraron características notificables.");
    }
  };

  useEffect(() => {
    const initializeBLE = async () => {
      const currentState = await bleManager.state();
      console.log(`Estado BLE inicial: ${currentState}`);
      setStatusMessage(`Estado BLE: ${currentState}`);
      if (currentState === State.PoweredOff) {
        setStatusMessage("Bluetooth está apagado. Por favor, enciéndelo.");
      } else if (currentState === State.PoweredOn) {
        setStatusMessage("Bluetooth encendido y listo.");
          }
    };

    initializeBLE();

    const subscription = bleManager.onStateChange((state) => {
      const newStatus = `Estado BLE: ${state}`;
      console.log(newStatus); // Log para depuración
      // Actualizar statusMessage solo para PoweredOff/On para no sobreescribir mensajes importantes
      if (state === State.PoweredOff) {
        setStatusMessage("Bluetooth está apagado. Por favor, enciéndelo.");
        setAllDevices([]);
        setConnectedDevice(null);
        setHeartRate(null);
      } else if (state === State.PoweredOn) {
        setStatusMessage("Bluetooth encendido y listo.");
      }
    });

    return () => {
      subscription.remove();
      console.log("Suscripción a estado de BLEManager eliminada.");
    };
  }, [bleManager]);


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
