/* Добавляет в AndroidManifest.xml разрешения и receiver для восстановления будильников.
   Идемпотентен: повторный запуск не дублирует элементы. */
const fs = require('fs');
const path = require('path');

const file = path.join('android', 'app', 'src', 'main', 'AndroidManifest.xml');
if (!fs.existsSync(file)) {
  console.error('AndroidManifest.xml не найден. Сначала выполните `npx cap add android`.');
  process.exit(1);
}

let xml = fs.readFileSync(file, 'utf8');

const PERMS = [
  'POST_NOTIFICATIONS',
  'SCHEDULE_EXACT_ALARM',
  'USE_EXACT_ALARM',
  'VIBRATE',
  'WAKE_LOCK',
  'RECEIVE_BOOT_COMPLETED'
];

// Вставляем разрешения после открывающего <manifest ...>
for (const p of PERMS) {
  const line = `<uses-permission android:name="android.permission.${p}"/>`;
  if (!xml.includes(line)) {
    xml = xml.replace(/<manifest([^>]*)>/, `<manifest$1>\n    ${line}`);
  }
}

// Receiver для восстановления будильников после перезагрузки
const receiver =
`        <receiver android:exported="false" android:name="com.capacitorjs.plugins.localnotifications.LocalNotificationRestoreReceiver">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED"/>
            </intent-filter>
        </receiver>`;

if (!xml.includes('LocalNotificationRestoreReceiver')) {
  xml = xml.replace(/<\/application>/, `${receiver}\n    </application>`);
}

fs.writeFileSync(file, xml);
console.log('✓ AndroidManifest.xml обновлён');