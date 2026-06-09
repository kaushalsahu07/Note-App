# Note-App

A modern, light & dark-themed notes & to-do app built with **Expo** (React Native) and **Expo Router**.

---

## Core Features

- **🌓 Dynamic Theming**: Toggle between Dark and Light modes with a premium glassmorphic interface.
- **📝 Versatile Notes**: Create text notes with custom background colors and quick-edit support.
- **✅ Interactive To-Dos**: Efficient task management with a dedicated list editor and progress tracking.
- **📦 Archive**: Declutter your workspace by archiving notes you don't need right now. Archived notes are preserved separately and can be restored anytime — from the home screen (multi-select) or within a note's detail view.
- **🔐 Privacy & Security**: 
  - **Offline-First**: All your notes and data are stored locally on your device by default. 
  - **☁️ Optional Cloud Sync**: Self-hostable cloud sync server. Your data is encrypted *before* leaving your device (E2EE), ensuring complete privacy even when synced. Archived notes are included in cloud sync.
  - **🛡️ End-to-End Encryption (E2EE)**: Optional AES-256 encryption at rest — all notes, to-do lists, and saved passwords are encrypted with a master passphrase that only you know.
  - **Note Locking**: Secure individual sensitive notes with individual password protection.
  - **Password Manager**: An integrated, secure tool for managing your credentials locally.
- **🔍 Quick Navigation**: Animated search bar for real-time filtering of your content.
- **⚡ High Performance**: Smooth 60 FPS transitions and micro-animations powered by Reanimated.
- **☁️ Backup & Restore**: Export backups as **plain text** or **encrypted** files. Import either format seamlessly — encrypted backups are auto-detected and decrypted with your passphrase.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Expo](https://expo.dev) (SDK 51+) |
| Navigation | [Expo Router](https://expo.github.io/router/) (file-based) |
| Animations | [React Native Reanimated](https://docs.swmansion.com/react-native-reanimated/) |
| Icons | [@expo/vector-icons](https://icons.expo.fyi/) (Ionicons) |
| Storage | AsyncStorage via `utils/storage.ts` |
| Encryption | AES-256 CTR + HMAC-SHA-256 via `expo-crypto` (`utils/encryption.ts`) |
| Language | TypeScript & Node.js |
| Sync Server | Express.js, MongoDB |


---

## Getting Started

### 📱 Running the App

```bash
npm install
npx expo start --clear
```
> Note: Change the `projectId` & `owner` in `app.json`.

Scan the QR code with **Expo Go** on your device, or press `a` for Android emulator / `i` for iOS simulator.

### ☁️ Running the Sync Server (Optional)

If you want to use the Cloud Sync feature:

```bash
cd server
npm install
# Create a .env file based on .env.example and configure your MongoDB URI
npm start
```
> Note: Update the `DEFAULT_API_URL` in `utils/syncConfig.ts` to point to your server (e.g., your computer's IP address or a deployed URL).

---


## Contact
For any inquiries, reach out at [kaushalsahu.me@gmailcom](mailto:kaushalsahu.me@gmailcom).<br>
GitHub: [@kaushalsahu07](https://github.com/kaushalsahu07).<br>
Linkedin: [@kaushalsahu07](https://www.linkedin.com/in/kaushalsahu07).<br>
Instagram: [@cd.kaushal](https://www.instagram.com/cd.kaushal?igsh=cTVram1ia3Vvamxz).<br>
Portfolio: [kaushalsahu.tech ](https://kaushalsahu.tech/)<br>
X (Tweeter): [@kaushalsahu_07](https://x.com/kaushalsahu_07?t=7nk-jApWrJkgW6YwklJZWQ&s=09).

## Screenshots

<p align="center">
  <img src="https://github.com/user-attachments/assets/6a60952b-4ee2-4d2b-9b15-e58d8d819ee3" width="200" />
  <img src="https://github.com/user-attachments/assets/c6773ad6-6d2d-4184-8aa5-cdc51120e0f5" width="200" />
  <img src="https://github.com/user-attachments/assets/06d87df2-fde4-4139-87fc-db81db20ce57" width="210" />
  <img src="https://github.com/user-attachments/assets/dbf9c9f0-2dd9-4ac7-a136-e22f74c85128" width="200" />
  
</p>

<br> Created with ❤️ by Kaushal Sahu
