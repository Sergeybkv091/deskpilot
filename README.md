# DeskPilot

Офисный пульт: заметки, будильники, график смен, помодоро.

## Быстрый старт (без Android Studio)

1. Загрузите проект в GitHub Public.
2. Вкладка **Actions** → **Build DeskPilot APK** → **Run workflow**.
3. Через 5–10 минут скачайте `deskpilot-debug-apk` из **Artifacts**.
4. Установите APK на телефон.

## Локальная сборка

```bash
npm install
npm run gen:beep
npx cap add android
npm run gen:assets
npx cap sync android
npm run patch
npm run build:debug