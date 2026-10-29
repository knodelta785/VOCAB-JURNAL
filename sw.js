const CACHE = 'vj-shell-v1';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
const MSGS = [
  (m) => ['Waktunya baca', 'Lanjutkan ' + m.book + ', chapter ' + m.ch + '. Sepuluh menit saja sudah cukup.'],
  (m) => ['Streak ' + m.streak + ' hari', 'Jangan putus hari ini. Satu sesi latihan singkat sudah menjaganya.'],
  (m) => ['Kata-katamu menunggu', m.due + ' kata di ' + m.book + ' belum di luar kepala. Yuk kuasai beberapa.'],
  (m) => ['Satu halaman hari ini', 'Buka bukumu, cari satu frasa baru, simpan ke jurnal.'],
  (m) => ['Sedikit demi sedikit', 'Setiap kata yang naik level membuatmu lebih dekat ke akhir buku.'],
  (m) => ['Chapter ' + m.ch + ' menunggu', 'Baca satu bagian, lalu uji dirimu dengan 10 soal.'],
];

function dkey(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE && k !== 'vj-meta').map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network first so updates arrive, cache as the offline fallback.
self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith(
    fetch(r).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(r, copy));
      return res;
    }).catch(() => caches.match(r).then((m) => m || caches.match('index.html')))
  );
});

async function dailyReminder() {
  const metaUrl = new URL('vj-meta.json', self.registration.scope).href;
  const c = await caches.open('vj-meta');
  const res = await c.match(metaUrl);
  if (!res) return;
  const m = await res.json();
  if (!m.remind) return;
  const now = new Date();
  const [h, mi] = String(m.time || '19:00').split(':').map(Number);
  const due = new Date();
  due.setHours(h || 0, mi || 0, 0, 0);
  const t = dkey(now);
  if (now < due || m.lastActive === t || m.lastNotified === t) return;
  const [title, body] = MSGS[now.getDate() % MSGS.length](m);
  await self.registration.showNotification(title, { body, icon: 'icon-192.png', badge: 'icon-192.png', tag: 'vj-daily' });
  m.lastNotified = t;
  await c.put(metaUrl, new Response(JSON.stringify(m)));
}

self.addEventListener('periodicsync', (e) => {
  if (e.tag === 'vj-daily') e.waitUntil(dailyReminder());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
      if (cs.length) return cs[0].focus();
      return self.clients.openWindow('./');
    })
  );
});
