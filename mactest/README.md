# MacTest BLE Desktop App

Esta aplicación de escritorio está construida con **Electron**, **React** y **react-native-web** para escanear, conectar y recibir datos crudos de dispositivos Bluetooth Low Energy (BLE) en macOS.

---

## 🚀 Requisitos previos

- Node.js >= 18.x
- npm >= 9.x
- macOS (para acceso a Bluetooth y compatibilidad total con Electron)

---

## 📦 Instalación de dependencias

1. Clona el repositorio y entra en la carpeta del proyecto:
   ```sh
   git clone <URL_DEL_REPO>
   cd mactest
   ```

2. Instala las dependencias:
   ```sh
   npm install
   ```

---

## 🖥️ Ejecución de la app de escritorio

Lanza la aplicación con Electron:

```sh
npm run electron
```

Esto abrirá la app de escritorio lista para escanear dispositivos BLE.

---

## 📚 Estructura del proyecto

```
mactest/
├── components/
│   └── DebugConsole.js         # Componente para la consola de debug
├── helpers/
│   └── logger.js               # Helper para logs
├── renderer.js                 # Punto de entrada React/Electron
├── main.js                     # Proceso principal de Electron
├── index.html                  # HTML base para Electron
├── package.json                # Configuración y scripts
├── README.md                   # Este archivo
└── ...                         # Otros archivos y carpetas
```

---

## 🛠️ Funcionalidades principales

- **Escaneo BLE:** Busca todos los dispositivos BLE cercanos.
- **Conexión:** Permite conectar a cualquier dispositivo encontrado.
- **Suscripción a característica:** Puedes ingresar el UUID de la característica para recibir datos crudos.
- **Debug Console:** Visualiza todos los logs y datos crudos recibidos en una consola accesible desde la interfaz.

---

## ⚡ Notas importantes

- El escaneo y conexión BLE solo funcionarán en macOS.
- Si necesitas cambiar el UUID de la característica, puedes hacerlo desde la interfaz.
- Si tienes problemas con permisos de Bluetooth, revisa la configuración de privacidad de macOS.
- Si usas TypeScript, asegúrate de tener los tipos instalados (`@types/react`, `@types/react-dom`).

---

## 👨‍💻 Desarrollo y contribución

- Puedes crear nuevos componentes en `components/` y helpers en `helpers/`.
- Si necesitas agregar lógica adicional, sigue la estructura modular del proyecto.

---

## 🧑‍💻 Contacto

Para dudas técnicas, contacta a [Tu Nombre o Equipo].
