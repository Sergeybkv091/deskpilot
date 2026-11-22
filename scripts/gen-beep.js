/* Генерирует android/app/src/main/res/raw/beep.wav и www/beep.wav
   Тон 880 Гц, 3 импульса по 0.6 сек, паузы 0.3 сек. Моно, 44.1 кГц, 16 бит. */
const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 44100;
const FREQ = 880;
const PULSES = [
  { dur: 0.6, pause: 0.3 },
  { dur: 0.6, pause: 0.3 },
  { dur: 0.6, pause: 0.0 }
];

const samples = [];
const TWO_PI = Math.PI * 2;

for (const p of PULSES) {
  const n = Math.floor(p.dur * SAMPLE_RATE);
  for (let i = 0; i < n; i++) {
    // огибающая для мягкого старта/конца
    const env = Math.min(1, i / 400) * Math.min(1, (n - i) / 400);
    samples.push(Math.round(Math.sin((TWO_PI * FREQ * i) / SAMPLE_RATE) * 0.35 * env * 32767));
  }
  const pn = Math.floor(p.pause * SAMPLE_RATE);
  for (let i = 0; i < pn; i++) samples.push(0);
}

// WAV-заголовок
const dataSize = samples.length * 2;
const buffer = Buffer.alloc(44 + dataSize);
buffer.write('RIFF', 0);
buffer.writeUInt32LE(36 + dataSize, 4);
buffer.write('WAVE', 8);
buffer.write('fmt ', 12);
buffer.writeUInt32LE(16, 16);           // размер fmt
buffer.writeUInt16LE(1, 20);            // PCM
buffer.writeUInt16LE(1, 22);            // моно
buffer.writeUInt32LE(SAMPLE_RATE, 24);  // частота
buffer.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
buffer.writeUInt16LE(2, 32);            // block align
buffer.writeUInt16LE(16, 34);           // bits
buffer.write('data', 36);
buffer.writeUInt32LE(dataSize, 40);
for (let i = 0; i < samples.length; i++) buffer.writeInt16LE(samples[i], 44 + i * 2);

const targets = [
  'android/app/src/main/res/raw/beep.wav',
  'www/beep.wav'
];
for (const t of targets) {
  const dir = path.dirname(t);
  if (!fs.existsSync(dir) && !t.startsWith('android')) continue;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(t, buffer);
  console.log('✓', t);
}