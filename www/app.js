import { LocalNotifications } from '@capacitor/local-notifications';

async function ensureNotificationPermission(){
  try {
    let perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') perm = await LocalNotifications.requestPermissions();
    if (perm.display === 'granted') {
      await LocalNotifications.createChannel({
        id: 'alarm-channel',
        name: 'Будильники',
        description: 'Сигналы будильников DeskPilot',
        importance: 5,
        visibility: 1,
        vibration: true,
        sound: 'beep.wav'
      });
    }
    return perm.display === 'granted';
  } catch (e) { console.error(e); return false; }
}

async function rescheduleNativeAlarms(){
  try {
    const pending = await LocalNotifications.getPending();
    const ours = pending.notifications.filter(n => n.extra && n.extra.type === 'deskpilot-alarm');
    if (ours.length) await LocalNotifications.cancel({ notifications: ours });
    const list = alarms.filter(a => a.on).map((a, i) => {
      const [h, m] = a.time.split(':').map(Number);
      return {
        id: 10000 + i,
        title: '⏰ Будильник',
        body: a.label || 'Пора вставать',
        schedule: { on: { hour: h, minute: m }, repeats: true, allowWhileIdle: true },
        channelId: 'alarm-channel',
        sound: 'beep.wav',
        iconColor: '#5b6cff',
        extra: { type: 'deskpilot-alarm' }
      };
    });
    if (list.length) await LocalNotifications.schedule({ notifications: list });
  } catch (e) { console.error(e); }
}

const notifyBtn = document.getElementById('notifyBtn');
async function refreshNotifyBtn(){
  try {
    const p = await LocalNotifications.checkPermissions();
    const ok = p.display === 'granted';
    notifyBtn.textContent = ok ? '🔔' : '🔕';
    notifyBtn.title = ok ? 'Будильники активны' : 'Разрешить будильники';
  } catch { notifyBtn.textContent = '🔕'; }
}
notifyBtn.onclick = async () => {
  const ok = await ensureNotificationPermission();
  await refreshNotifyBtn();
  if (ok) rescheduleNativeAlarms();
  else alert('Разрешение на уведомления не выдано — будильники не сработают.');
};
refreshNotifyBtn();

const clockEl = document.getElementById('clock');
setInterval(() => {
  clockEl.textContent = new Date().toLocaleTimeString('ru-RU', {hour:'2-digit',minute:'2-digit',second:'2-digit'});
}, 1000);

const themeBtn = document.getElementById('themeBtn');
if (localStorage.getItem('dp_theme') === 'dark') { document.body.classList.add('dark'); themeBtn.textContent = '☀️'; }
themeBtn.onclick = () => {
  document.body.classList.toggle('dark');
  const dark = document.body.classList.contains('dark');
  themeBtn.textContent = dark ? '☀️' : '🌙';
  localStorage.setItem('dp_theme', dark ? 'dark' : 'light');
};

const SHIFTS = {
  work:{label:'Рабочий день',short:'День',color:'#5b6cff',hours:8},
  off:{label:'Выходной',short:'Вых',color:'#9aa4b8',hours:0},
  duty:{label:'Суточное дежурство',short:'Сутки',color:'#f59e0b',hours:24},
  trip:{label:'Командировка',short:'Коман',color:'#a855f7',hours:8},
  vacation:{label:'Отпуск',short:'Отп',color:'#22c55e',hours:0},
  sick:{label:'Больничный',short:'Бол',color:'#ef4444',hours:0},
  dayoff:{label:'Отгул',short:'Отг',color:'#14b8a6',hours:0},
  remote:{label:'Удалёнка',short:'Удал',color:'#06b6d4',hours:8}
};

let notes = JSON.parse(localStorage.getItem('dp_notes') || '[]');
const notesEl = document.getElementById('notes');
const esc = s => s.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function renderNotes(){
  if (!notes.length){ notesEl.innerHTML = '<div class="empty">Пока пусто ✍️</div>'; return; }
  notesEl.innerHTML = notes.map((n,i)=>`<li class="note"><div><div class="note-text">${esc(n.text)}</div><div class="note-date">${n.date}</div></div><button class="del" data-i="${i}">✕</button></li>`).join('');
  notesEl.querySelectorAll('.del').forEach(b => b.onclick = () => { notes.splice(+b.dataset.i,1); saveNotes(); });
}
function saveNotes(){ localStorage.setItem('dp_notes', JSON.stringify(notes)); renderNotes(); }
document.getElementById('quickForm').onsubmit = e => {
  e.preventDefault();
  const inp = document.getElementById('quickInput');
  const t = inp.value.trim(); if (!t) return;
  notes.unshift({ text:t, date:new Date().toLocaleString('ru-RU',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) });
  inp.value=''; saveNotes();
};
renderNotes();

let alarms = JSON.parse(localStorage.getItem('dp_alarms') || '[]');
const alarmsEl = document.getElementById('alarms');
function renderAlarms(){
  if (!alarms.length){ alarmsEl.innerHTML = '<div class="empty">Будильников нет</div>'; return; }
  alarmsEl.innerHTML = alarms.map((a,i)=>`
    <li class="alarm ${a.on?'':'off'}">
      <div><div class="alarm-time">${a.time}</div><div class="alarm-label">${esc(a.label||'Будильник')}</div></div>
      <div style="display:flex;gap:4px">
        <button class="del" data-toggle="${i}">${a.on?'🔔':'🔕'}</button>
        <button class="del" data-del="${i}">✕</button>
      </div>
    </li>`).join('');
  alarmsEl.querySelectorAll('[data-toggle]').forEach(b=>b.onclick=()=>{alarms[+b.dataset.toggle].on=!alarms[+b.dataset.toggle].on;saveAlarms();});
  alarmsEl.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{alarms.splice(+b.dataset.del,1);saveAlarms();});
}
async function saveAlarms(){
  localStorage.setItem('dp_alarms', JSON.stringify(alarms));
  renderAlarms();
  await rescheduleNativeAlarms();
}
document.getElementById('alarmForm').onsubmit = async e => {
  e.preventDefault();
  const time = document.getElementById('alarmTime').value;
  const label = document.getElementById('alarmLabel').value.trim();
  if (!time) return;
  const ok = await ensureNotificationPermission();
  if (!ok) { alert('Разрешите уведомления, иначе будильник не сработает'); return; }
  alarms.push({ time, label, on:true });
  document.getElementById('alarmLabel').value='';
  await saveAlarms();
};
renderAlarms();

const TOTAL = 25*60; let left = TOTAL, timerId = null;
const txt = document.getElementById('timerText');
const prog = document.getElementById('progress');
const fmt = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
function paint(){ txt.textContent = fmt(left); prog.style.strokeDashoffset = 471*(1-left/TOTAL); }
function tick(){ left--; if (left<=0){ clearInterval(timerId); timerId=null; alert('Фокус-сессия завершена!'); left=TOTAL; document.getElementById('startBtn').textContent='Старт'; } paint(); }
document.getElementById('startBtn').onclick = () => {
  if (timerId){ clearInterval(timerId); timerId=null; document.getElementById('startBtn').textContent='Старт'; }
  else { timerId=setInterval(tick,1000); document.getElementById('startBtn').textContent='Пауза'; }
};
document.getElementById('resetBtn').onclick = () => { clearInterval(timerId); timerId=null; left=TOTAL; document.getElementById('startBtn').textContent='Старт'; paint(); };
paint();

const schedKey = 'dp_schedule';
let schedule = JSON.parse(localStorage.getItem(schedKey) || '{}');
let viewDate = new Date(); viewDate.setDate(1);
const daysEl = document.getElementById('days');
const monthEl = document.getElementById('schedMonth');
const legendEl = document.getElementById('legend');
const hoursSummaryEl = document.getElementById('hoursSummary');
const menu = document.getElementById('shiftMenu');
const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const WEEKDAYS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
const iso = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

function renderSchedule(){
  const y = viewDate.getFullYear(), m = viewDate.getMonth();
  monthEl.textContent = `${MONTHS[m]} ${y}`;
  daysEl.innerHTML = '';
  const first = new Date(y,m,1);
  const startIdx = (first.getDay()+6)%7;
  const daysInMonth = new Date(y,m+1,0).getDate();
  const prevMonthDays = new Date(y,m,0).getDate();
  for (let i=0;i<startIdx;i++){ const c=document.createElement('div'); c.className='day other'; c.textContent=prevMonthDays-startIdx+i+1; daysEl.appendChild(c); }
  const today = iso(new Date());
  for (let d=1; d<=daysInMonth; d++){
    const key = iso(new Date(y,m,d));
    const type = schedule[key];
    const c = document.createElement('div');
    c.className = 'day' + (key===today?' today':'');
    if (type){ c.style.background = SHIFTS[type].color+'22'; c.style.borderColor = SHIFTS[type].color; c.style.color = SHIFTS[type].color; }
    c.innerHTML = `<span>${d}</span>${type?`<span class="tag">${SHIFTS[type].short}</span>`:''}`;
    c.onclick = e => openMenu(e,key);
    daysEl.appendChild(c);
  }
  const counts = {}; let totalHours = 0;
  for (let d=1; d<=daysInMonth; d++){ const t=schedule[iso(new Date(y,m,d))]; if (t){counts[t]=(counts[t]||0)+1;totalHours+=SHIFTS[t].hours;} }
  legendEl.innerHTML = Object.entries(SHIFTS).map(([k,v])=>`<div class="legend-item"><span class="dot" style="background:${v.color}"></span>${v.label}: <b>${counts[k]||0}</b></div>`).join('');
  const worked = (counts.work||0)+(counts.remote||0)+(counts.trip||0)+(counts.duty||0);
  hoursSummaryEl.innerHTML = `<div>Отработано: <b>${worked} дн.</b></div><div>Часов: <b>${totalHours} ч</b></div><div>Суточных: <b>${counts.duty||0}</b></div>`;
}
function openMenu(e,key){
  menu.innerHTML = Object.entries(SHIFTS).map(([k,v])=>`<div class="shift-opt" data-type="${k}"><span class="dot" style="background:${v.color}"></span>${v.label}<span style="margin-left:auto;color:var(--muted);font-weight:600">${v.hours} ч</span></div>`).join('') + `<div class="shift-opt" data-type="" style="color:#ff5b6e">✕ Очистить</div>`;
  menu.querySelectorAll('.shift-opt').forEach(opt=>opt.onclick=()=>{const t=opt.dataset.type;if(t)schedule[key]=t;else delete schedule[key];localStorage.setItem(schedKey,JSON.stringify(schedule));menu.classList.remove('open');renderSchedule();});
  const rect = e.currentTarget.getBoundingClientRect();
  let x=rect.left+window.scrollX, y=rect.bottom+window.scrollY+6;
  menu.classList.add('open');
  const mw=menu.offsetWidth, mh=menu.offsetHeight;
  if (x+mw>window.innerWidth-12) x=window.innerWidth-mw-12+window.scrollX;
  if (y+mh>window.innerHeight+window.scrollY) y=rect.top+window.scrollY-mh-6;
  menu.style.left=x+'px'; menu.style.top=y+'px';
}
document.addEventListener('click',e=>{if(!menu.contains(e.target)&&!e.target.closest('.day'))menu.classList.remove('open');});
document.getElementById('prevMonth').onclick=()=>{viewDate.setMonth(viewDate.getMonth()-1);renderSchedule();};
document.getElementById('nextMonth').onclick=()=>{viewDate.setMonth(viewDate.getMonth()+1);renderSchedule();};

function buildTemplate(template,y,m,startIso){
  const daysInMonth = new Date(y,m+1,0).getDate();
  const map = {}; const start = startIso?new Date(startIso+'T00:00:00'):new Date(y,m,1);
  const diff = (a,b)=>Math.round((a-b)/86400000);
  for (let d=1; d<=daysInMonth; d++){
    const date = new Date(y,m,d), dow = (date.getDay()+6)%7; let t=null;
    if (template==='5_2') t=dow<5?'work':'off';
    else if (template==='weekend') t=dow>=5?'off':'work';
    else if (template==='2_2'){const ph=((diff(date,start)%4)+4)%4; t=ph<2?'work':'off';}
    else if (template==='1_3'){const ph=((diff(date,start)%4)+4)%4; t=ph===0?'duty':'off';}
    if (t) map[iso(date)]=t;
  }
  return map;
}
document.getElementById('applyTemplate').onclick = () => {
  const t = document.getElementById('templateSelect').value;
  const s = document.getElementById('templateStart').value;
  const map = buildTemplate(t, viewDate.getFullYear(), viewDate.getMonth(), s);
  let n=0; Object.entries(map).forEach(([k,v])=>{if(!schedule[k]){schedule[k]=v;n++;}});
  localStorage.setItem(schedKey, JSON.stringify(schedule)); renderSchedule(); alert(`Заполнено ${n} дней.`);
};
document.getElementById('clearMonth').onclick = () => {
  const y=viewDate.getFullYear(), m=viewDate.getMonth();
  const pref = `${y}-${String(m+1).padStart(2,'0')}-`;
  const keys = Object.keys(schedule).filter(k=>k.startsWith(pref));
  if (!keys.length) return alert('Нет отметок в этом месяце.');
  if (!confirm(`Удалить отметки за ${MONTHS[m]} ${y}?`)) return;
  keys.forEach(k=>delete schedule[k]); localStorage.setItem(schedKey,JSON.stringify(schedule)); renderSchedule();
};

document.getElementById('exportCsv').onclick = () => {
  const y=viewDate.getFullYear(), m=viewDate.getMonth();
  const daysInMonth = new Date(y,m+1,0).getDate();
  const rows = [['Дата','День','Тип смены','Часы']];
  for (let d=1; d<=daysInMonth; d++){
    const date = new Date(y,m,d), key = iso(date), t = schedule[key];
    rows.push([key, WEEKDAYS[(date.getDay()+6)%7], t?SHIFTS[t].label:'', t?SHIFTS[t].hours:0]);
  }
  const csv = '\uFEFF' + rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(';')).join('\r\n');
  const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `график-${MONTHS[m]}-${y}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
};
const importInput = document.getElementById('importCsvInput');
document.getElementById('importCsvBtn').onclick = () => importInput.click();
importInput.onchange = async () => {
  const file = importInput.files[0]; if (!file) return;
  const text = await file.text();
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim());
  const splitRow = line => (line.includes(';') ? line.split(';') : line.split(',')).map(s => s.replace(/^"|"$/g,'').trim());
  const labelToKey = {};
  Object.entries(SHIFTS).forEach(([k,v]) => { labelToKey[v.label.toLowerCase()] = k; labelToKey[v.short.toLowerCase()] = k; });
  let n = 0;
  lines.forEach(line => {
    const c = splitRow(line);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(c[0])) return;
    const t = labelToKey[(c[2]||'').toLowerCase()];
    if (t){ schedule[c[0]] = t; n++; } else delete schedule[c[0]];
  });
  localStorage.setItem(schedKey, JSON.stringify(schedule)); renderSchedule();
  alert(`Импортировано ${n} дней.`); importInput.value = '';
};

renderSchedule();