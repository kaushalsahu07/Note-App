# Note-App

A modern, dark-themed notes & to-do app built with **Expo** (React Native) and **Expo Router**.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Expo](https://expo.dev) (SDK 51+) |
| Navigation | [Expo Router](https://expo.github.io/router/) (file-based) |
| Animations | [React Native Reanimated](https://docs.swmansion.com/react-native-reanimated/) |
| Icons | [@expo/vector-icons](https://icons.expo.fyi/) (Ionicons) |
| Storage | AsyncStorage via `utils/storage.ts` |
| Language | TypeScript |

---

## Project Structure

```
Note-App/
├── app/                        # All screens (Expo Router file-based routing)
│   ├── _layout.tsx             # Root Stack navigator — registers every screen
│   ├── index.tsx               # Home screen: notes grid + search + FAB
│   ├── select-type.tsx         # Modal: choose Note or To-Do before creating
│   ├── new.tsx                 # Modal: create a new text Note
│   ├── new-todo.tsx            # Modal: create a new To-Do list
│   ├── note/
│   │   └── [id].tsx            # View/edit a text Note (supports password lock)
│   └── edit/
│       └── todo/
│           └── [id].tsx        # Edit an existing To-Do list
│
├── components/                 # Reusable UI components
│   ├── NoteCard.tsx            # Card shown in the notes grid (note + todo variants)
│   ├── TodoList.tsx            # Interactive task-list editor (used in new-todo & edit)
│   ├── SearchBar.tsx           # Animated search input
│   ├── Settings.tsx            # Settings sheet (backup, restore, export, password mgr)
│   ├── PasswordManager.tsx     # Full password-manager feature inside Settings
│   ├── AccessPasswordDialog.tsx  # Dialog: enter password to unlock a protected note
│   └── PasswordProtectionDialog.tsx  # Dialog: set/remove password on a note
│
├── constants/
│   └── Colors.ts               # Design tokens: dark palette, note color arrays
│
├── utils/
│   ├── storage.ts              # AsyncStorage CRUD for notes (Note & TodoItem types)
│   ├── backupRestore.ts        # Export / import notes as JSON file
│   ├── exportNotes.ts          # Export individual notes as plain text
│   └── passwordUtils.ts        # Simple password hash helper
│
├── assets/                     # Static assets (app icon etc.)
├── app.json                    # Expo app config
├── tsconfig.json
└── package.json
```

---

## Screen Flow

```
index (Home)
  └─► select-type  (modal – pick type)
        ├─► new          (modal – write a note)
        └─► new-todo     (modal – build a task list)

index
  └─► note/[id]          (modal – view/edit note, password protected)
  └─► edit/todo/[id]     (modal – edit task list)
```

---

## Getting Started

```bash
npm install
npx expo start --clear
```

Scan the QR code with **Expo Go** on your device, or press `a` for Android emulator / `i` for iOS simulator.

---

## Design System

All colors live in `constants/Colors.ts`.  
Key tokens:

| Token | Purpose |
|---|---|
| `Colors.dark.background` | Main screen background |
| `Colors.dark.surfaceSolid` | Cards, modals, bottom bars |
| `Colors.dark.accent` | Primary brand color (indigo) |
| `Colors.dark.accentSecondary` | Secondary accent (emerald, for todos) |
| `Colors.dark.text` | Primary text |
| `Colors.dark.icon` | Muted / secondary text |
| `Colors.dark.border` | Subtle dividers |
| `NOTE_COLORS[]` | Background tints for note cards |
| `NOTE_ACCENT_COLORS[]` | Vivid accent colors matching each card |
