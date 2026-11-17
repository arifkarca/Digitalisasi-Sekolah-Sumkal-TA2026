// ==================== KONFIGURASI UTAMA (EDIT BAGIAN INI) ====================
const CONFIG = {
  // Password untuk membuka halaman depan dashboard
  PASSWORD: 'ODSLOLA2026',

  // Daftar 10 UID/UIW Regional Sumatera & Kalimantan (SUMKAL)
  SUMKAL_UIDS: [
    'UID Aceh',
    'UID Sumut',
    'UID Sumbar',
    'UID RKR',
    'UID S2JB',
    'UIW Babel',
    'UID Lampung',
    'UID Kalbar',
    'UID Kalselteng',
    'UID Kaltimra'
  ],

  // 1. Konfigurasi Google Sheets SEKOLAH VOKASI
  VOKASI: {
    spreadsheetId: '1WgHd9zG0FYvaKxRC2GrLLONx3z5RJ8xfNxEpywXMins',
    sheetName: 'SUMKAL' // Kosongkan untuk sheet pertama, atau isi nama tab misal 'Rekap'
  },

  // 2. Konfigurasi Google Sheets SEKOLAH TERPADU
  TERPADU: {
    spreadsheetId: '13ixWoCMBWe9Atzi6lqRaAK8Aw7J5B_SUClLfhW-mUIA',
    sheetName: 'SUMKAL' // Kosongkan untuk sheet pertama, atau isi nama tab
  },

  // 3. Konfigurasi Google Sheets SEKOLAH RAKYAT TAHAP 3 TAHUN 2026 (Sudah terisi otomatis!)
  RAKYAT: {
    spreadsheetId: '1pjbSQasuvpqMtsMdQVjBBafWtgDlpMohTt5yI-gtc34',
    sheetName: 'Rekap Nyala', // Menarik langsung dari tab master gabungan Rekap Nyala
    filterSumkalOnly: true    // Opsi A: hanya menyaring 10 UID Regional SUMKAL
  }
};

// ==================== STATE GLOBAL ====================
let activeProgram = 'VOKASI'; // 'VOKASI' | 'TERPADU' | 'RAKYAT'
const dataCache = { VOKASI: null, TERPADU: null, RAKYAT: null };
let allRows = [];
let filteredRows = [];
let map = null;
let markersLayer = null;
let chartUidInstance = null;
let chartKategoriInstance = null;

const UID_ORDER = [
  'UID Aceh', 'UID Sumut', 'UID Sumbar', 'UID RKR', 'UID S2JB',
  'UIW Babel', 'UID Lampung', 'UID Kalbar', 'UID Kalselteng', 'UID Kaltimra'
];

// ==================== LOGIN GATE ====================
(function initAuth() {
  const loginScreen = document.getElementById('loginScreen');
  const dashboardApp = document.getElementById('dashboardApp');
  const loginForm = document.getElementById('loginForm');
  const passwordInput = document.getElementById('passwordInput');
  const loginError = document.getElementById('loginError');

  if (sessionStorage.getItem('pln_sumkal_auth') === 'true') {
    loginScreen.classList.add('hidden');
    dashboardApp.classList.remove('hidden');
    bootDashboard();
  }

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (passwordInput.value === CONFIG.PASSWORD) {
      sessionStorage.setItem('pln_sumkal_auth', 'true');
      loginError.classList.add('hidden');
      loginScreen.classList.add('hidden');
      dashboardApp.classList.remove('hidden');
      bootDashboard();
    } else {
      loginError.classList.remove('hidden');
      passwordInput.focus();
    }
  });

  document.getElementById('btnLogout').addEventListener('click', () => {
    sessionStorage.removeItem('pln_sumkal_auth');
    location.reload();
  });
})();

// ==================== INISIALISASI PETA & EVENT ====================
function bootDashboard() {
  if (!map) {
    initMap();
    bindEvents();
  }
  switchProgram(activeProgram, false);
}

function initMap() {
  map = L.map('map').setView([-0.5, 108.5], 5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors | PT PLN (Persero)'
  }).addTo(map);
  markersLayer = L.layerGroup().addTo(map);
}

function bindEvents() {
  ['filterUid', 'filterProv', 'filterKategori', 'filterNyala'].forEach((id) => {
    document.getElementById(id).addEventListener('change', applyFilters);
  });
  document.getElementById('filterSearch').addEventListener('input', applyFilters);

  document.getElementById('btnReset').addEventListener('click', () => {
    document.getElementById('filterUid').value = 'ALL';
    document.getElementById('filterProv').value = 'ALL';
    document.getElementById('filterKategori').value = 'ALL';
    document.getElementById('filterNyala').value = 'ALL';
    document.getElementById('filterSearch').value = '';
    applyFilters();
  });

  document.getElementById('btnRefresh').addEventListener('click', () => {
    dataCache[activeProgram] = null;
    loadProgramData(activeProgram, true);
  });

  document.getElementById('btnExportCsv').addEventListener('click', exportFilteredCsv);
}

// ==================== SWITCH TAB PROGRAM ====================
window.switchProgram = function(program, forceReload = false) {
  activeProgram = program;

  const btnVokasi = document.getElementById('tabVokasi');
  const btnTerpadu = document.getElementById('tabTerpadu');
  const btnRakyat = document.getElementById('tabRakyat');
  const headerTitle = document.getElementById('headerTitle');
  const labelFilterKategori = document.getElementById('labelFilterKategori');
  const chartKatTitle = document.getElementById('chartKatTitle');
  const chartKatSub = document.getElementById('chartKatSub');
  const tableTitle = document.getElementById('tableTitle');

  [btnVokasi, btnTerpadu, btnRakyat].forEach((b) => {
    b.className = 'px-3 py-1.5 rounded-lg text-xs font-bold transition tab-btn-inactive';
  });

  if (program === 'VOKASI') {
    btnVokasi.className = 'px-3 py-1.5 rounded-lg text-xs font-bold transition tab-btn-active';
    headerTitle.textContent = 'Monitoring Kelistrikan Sekolah Vokasi 2026';
    labelFilterKategori.textContent = 'Kategori Sekolah';
    chartKatTitle.textContent = 'Komposisi Kategori Sekolah';
    chartKatSub.textContent = 'Distribusi lokasi berdasarkan klasifikasi sekolah';
    tableTitle.textContent = 'Rincian Data Sekolah Vokasi per Lokasi';
  } else if (program === 'TERPADU') {
    btnTerpadu.className = 'px-3 py-1.5 rounded-lg text-xs font-bold transition tab-btn-active';
    headerTitle.textContent = 'Monitoring Kelistrikan Sekolah Terpadu 2026';
    labelFilterKategori.textContent = 'Kategori Sekolah';
    chartKatTitle.textContent = 'Komposisi Kategori / Status';
    chartKatSub.textContent = 'Distribusi lokasi Sekolah Terpadu';
    tableTitle.textContent = 'Rincian Data Sekolah Terpadu per Lokasi';
  } else {
    btnRakyat.className = 'px-3 py-1.5 rounded-lg text-xs font-bold transition tab-btn-active';
    headerTitle.textContent = 'Monitoring Kelistrikan Sekolah Rakyat Tahap 3 Tahun 2026';
    labelFilterKategori.textContent = 'Kategori / Kondisi Lahan';
    chartKatTitle.textContent = 'Komposisi Kategori / Kondisi Lokasi';
    chartKatSub.textContent = 'Distribusi lokasi Sekolah Rakyat SUMKAL';
    tableTitle.textContent = 'Rincian Data Sekolah Rakyat Tahap 3 SUMKAL per Lokasi';
  }

  document.getElementById('filterUid').value = 'ALL';
  document.getElementById('filterProv').value = 'ALL';
  document.getElementById('filterKategori').value = 'ALL';
  document.getElementById('filterNyala').value = 'ALL';
  document.getElementById('filterSearch').value = '';

  loadProgramData(program, forceReload);
};

// ==================== FETCH GOOGLE SHEETS (GVIZ JSONP) ====================
function fetchSheetViaJsonp(spreadsheetId, sheetName) {
  return new Promise((resolve, reject) => {
    const callbackName = 'gvizCb_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
    const script = document.createElement('script');
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Timeout mengambil data dari Google Sheets.'));
    }, 15000);

    function cleanup() {
      clearTimeout(timeout);
      delete window[callbackName];
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    window[callbackName] = function(response) {
      cleanup();
      if (!response || response.status === 'error') {
        reject(new Error((response && response.errors && response.errors[0]?.message) || 'Gagal membaca Google Sheets.'));
        return;
      }
      resolve(response.table);
    };

    const sheetParam = sheetName ? `&sheet=${encodeURIComponent(sheetName)}` : '';
    script.src = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json;responseHandler:${callbackName}${sheetParam}`;
    script.onerror = () => {
      cleanup();
      reject(new Error('Gagal terhubung ke Google Sheets. Pastikan akses sheet sudah "Anyone with the link - Viewer".'));
    };
    document.body.appendChild(script);
  });
}

function showBanner(type, htmlMsg) {
  const banner = document.getElementById('statusBanner');
  banner.classList.remove('hidden', 'bg-rose-50', 'border-rose-300', 'text-rose-800', 'bg-sky-50', 'border-sky-300', 'text-sky-800');
  if (type === 'error') {
    banner.classList.add('bg-rose-50', 'border-rose-300', 'text-rose-800');
  } else {
    banner.classList.add('bg-sky-50', 'border-sky-300', 'text-sky-800');
  }
  banner.innerHTML = htmlMsg;
}

function hideBanner() {
  document.getElementById('statusBanner').classList.add('hidden');
}

function normalizeUid(rawUid) {
  const u = String(rawUid || '').trim();
  if (!u) return '';
  const match = UID_ORDER.find((std) => std.toLowerCase() === u.toLowerCase());
  return match || u;
}

function isSumkalUid(uid) {
  const norm = normalizeUid(uid).toLowerCase();
  return CONFIG.SUMKAL_UIDS.some((s) => s.toLowerCase() === norm);
}

async function loadProgramData(program, forceReload = false) {
  const progCfg = CONFIG[program];
  const labelMap = {
    VOKASI: 'Sekolah Vokasi',
    TERPADU: 'Sekolah Terpadu',
    RAKYAT: 'Sekolah Rakyat Tahap 3'
  };
  const progLabel = labelMap[program] || program;

  if (!progCfg.spreadsheetId || progCfg.spreadsheetId.startsWith('TEMPEL_ID')) {
    allRows = [];
    populateFilterDropdowns();
    applyFilters();
    showBanner('info', `<strong>Konfigurasi Diperlukan (${progLabel}):</strong> Tempel ID Google Sheets <strong>${progLabel}</strong> Anda pada variabel <code>CONFIG.${program}.spreadsheetId</code> di file <code>app.js</code>.`);
    return;
  }

  if (!forceReload && dataCache[program]) {
    hideBanner();
    allRows = dataCache[program];
    populateFilterDropdowns();
    applyFilters();
    return;
  }

  try {
    document.getElementById('lastUpdated').textContent = `Memuat ${progLabel}...`;
    const table = await fetchSheetViaJsonp(progCfg.spreadsheetId, progCfg.sheetName);
    let parsed = parseGvizTable(table, program);

    // Filter khusus 10 UID SUMKAL jika diaktifkan (Opsi A untuk Sekolah Rakyat)
    if (progCfg.filterSumkalOnly) {
      parsed = parsed.filter((r) => isSumkalUid(r.uid));
    }

    dataCache[program] = parsed;
    allRows = parsed;
    hideBanner();
    populateFilterDropdowns();
    applyFilters();

    const now = new Date();
    document.getElementById('lastUpdated').textContent =
      `Update: ${now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB`;
  } catch (err) {
    allRows = [];
    populateFilterDropdowns();
    applyFilters();
    showBanner('error', `<strong>Gagal Memuat Data ${progLabel}:</strong> ${err.message}`);
  }
}

// ==================== PARSER FLEXIBLE UNTUK VOKASI, TERPADU & RAKYAT ====================
function parseGvizTable(table, program) {
  const cols = (table.cols || []).map((c) => (c.label || c.id || '').trim());
  const rawRows = table.rows || [];
  let headerRowIdx = -1;
  let headers = cols;

  // Jika label kolom kosong, deteksi baris header di dalam data
  const hasNamedLabels = cols.some((c) => /uid|sekolah|provinsi|kab|daya|alamat/i.test(c));
  if (!hasNamedLabels) {
    for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
      const vals = (rawRows[i].c || []).map((cell) => (cell && cell.v != null ? String(cell.v).trim() : ''));
      if (vals.some((v) => /uid|sekolah|provinsi|kab|alamat/i.test(v))) {
        headerRowIdx = i;
        headers = vals;
        break;
      }
    }
  }

  const findCol = (patterns) => {
    for (const p of patterns) {
      const idx = headers.findIndex((h) => p.test(h));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  // Mapping kolom cerdas untuk Vokasi, Terpadu, maupun Sekolah Rakyat (Rekap Nyala)
  const idxMap = {
    uid: findCol([/^uid$/i, /unit induk/i, /uid\/uiw/i]),
    prov: findCol([/^provinsi$/i, /^prov$/i]),
    kab: findCol([/kab\/kota/i, /kabupaten/i, /kota/i]),
    sekolah: findCol([/nama sekolah/i, /^sekolah$/i, /satuan pendidikan/i, /nama lokasi/i]),
    alamat: findCol([/^alamat$/i, /lokasi/i]),
    kategori: findCol([/^kategori$/i, /jenis/i, /jenjang/i]),
    kategoriNyala: findCol([/kategori nyala/i]),
    daya: findCol([/rencana daya/i, /daya \(va\)/i, /daya rencana/i, /^daya$/i]),
    realisasiDaya: findCol([/realisasi daya/i]),
    tarif: findCol([/^tarif$/i]),
    idpel: findCol([/idpel/i, /id pelanggan/i]),
    nyala: findCol([/^nyala$/i, /status nyala/i, /status kelistrikan/i, /status/i]),
    jtm: findCol([/^jtm/i]),
    jtr: findCol([/^jtr/i]),
    gardu: findCol([/^gardu/i]),
    sr: findCol([/^sr$/i]),
    rab: findCol([/^rab/i, /nilai rab/i]),
    bp: findCol([/^bp$/i, /biaya penyambungan/i]),
    ket: findCol([/keterangan/i, /kendala/i, /catatan/i]),
    foto: findCol([/foto/i, /eviden/i, /dokumentasi/i]),
    lat: findCol([/^lat/i, /lintang/i]),
    lng: findCol([/^long/i, /^lng/i, /bujur/i]),
    koordinat: findCol([/koordinat/i, /titik/i])
  };

  const parsed = [];
  for (let r = headerRowIdx + 1; r < rawRows.length; r++) {
    const cells = rawRows[r].c || [];
    const getVal = (idx) => {
      if (idx < 0 || !cells[idx]) return '';
      const cell = cells[idx];
      if (cell.v != null && cell.v !== '') return cell.v;
      if (cell.f != null) return cell.f;
      return '';
    };

    const uid = normalizeUid(getVal(idxMap.uid));
    const prov = String(getVal(idxMap.prov)).trim();
    const kab = String(getVal(idxMap.kab)).trim();
    const sekolahRaw = String(getVal(idxMap.sekolah)).trim();
    const alamat = String(getVal(idxMap.alamat)).trim();

    // Lewati baris kosong atau baris total
    if (!uid && !sekolahRaw && !prov && !kab) continue;
    if (/^total|^jumlah/i.test(uid) || /^total|^jumlah/i.test(sekolahRaw) || /^total|^jumlah/i.test(prov)) continue;

    // Untuk Sekolah Rakyat yang tidak punya kolom Nama Sekolah terpisah, gunakan label lokasi dari Kab/Kota & Alamat
    const sekolah = sekolahRaw || (kab ? `Sekolah Rakyat ${kab}` : alamat || 'Lokasi Sekolah Rakyat');

    // Parse koordinat
    let lat = parseFloat(String(getVal(idxMap.lat)).replace(',', '.'));
    let lng = parseFloat(String(getVal(idxMap.lng)).replace(',', '.'));
    if ((isNaN(lat) || isNaN(lng)) && idxMap.koordinat !== -1) {
      const kStr = String(getVal(idxMap.koordinat)).trim();
      const parts = kStr.split(/[,\s]+/).filter(Boolean);
      if (parts.length >= 2) {
        lat = parseFloat(parts[0]);
        lng = parseFloat(parts[1]);
      }
    }

    // Parse Daya (di Sekolah Rakyat kolom Rencana Daya dalam kVA; di Vokasi/Terpadu biasanya VA -> dikonversi otomatis jika >= 10000)
    const dayaRaw = parseNum(getVal(idxMap.daya));
    const realisasiRaw = parseNum(getVal(idxMap.realisasiDaya));
    let dayaKva = 0;
    if (program === 'RAKYAT') {
      dayaKva = dayaRaw > 10000 ? dayaRaw / 1000 : dayaRaw;
    } else {
      dayaKva = dayaRaw >= 1000 ? dayaRaw / 1000 : dayaRaw;
    }

    // Normalisasi Status Nyala
    const rawNyala = String(getVal(idxMap.nyala)).trim();
    const katNyala = String(getVal(idxMap.kategoriNyala)).trim();
    const statusNyala = normalizeStatusNyala(rawNyala, katNyala, realisasiRaw);

    // Normalisasi Kategori
    const rawKat = String(getVal(idxMap.kategori)).trim();
    const kategori = rawKat || katNyala || (program === 'RAKYAT' ? 'Sekolah Rakyat Tahap 3' : (program === 'TERPADU' ? 'Sekolah Terpadu' : 'Lainnya'));

    const fotoUrl = String(getVal(idxMap.foto)).trim();

    parsed.push({
      uid: uid || 'Lainnya',
      prov: prov || '-',
      kab: kab || '-',
      sekolah,
      alamat: alamat || '-',
      kategori,
      dayaKva,
      realisasiKva: realisasiRaw > 10000 ? realisasiRaw / 1000 : realisasiRaw,
      tarif: String(getVal(idxMap.tarif)).trim() || '-',
      idpel: String(getVal(idxMap.idpel)).trim() || '-',
      statusNyala,
      rawNyala: rawNyala || katNyala || (statusNyala === 'NYALA' ? 'Nyala' : 'Belum Nyala'),
      jtm: parseNum(getVal(idxMap.jtm)),
      jtr: parseNum(getVal(idxMap.jtr)),
      gardu: parseNum(getVal(idxMap.gardu)),
      sr: parseNum(getVal(idxMap.sr)),
      rab: parseNum(getVal(idxMap.rab)),
      bp: parseNum(getVal(idxMap.bp)),
      ket: String(getVal(idxMap.ket)).trim() || '-',
      fotoUrl: /^https?:\/\//i.test(fotoUrl) ? fotoUrl : '',
      lat: !isNaN(lat) && Math.abs(lat) <= 15 ? lat : null,
      lng: !isNaN(lng) && lng >= 90 && lng <= 145 ? lng : null
    });
  }
  return parsed;
}

function parseNum(val) {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  let s = String(val).replace(/[^0-9.,-]/g, '').trim();
  if (!s) return 0;
  // Format Indonesia/Inggris: jika ada koma dan titik, tentukan pemisah desimal
  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf('.') > s.lastIndexOf(',')) {
      s = s.replace(/,/g, '');
    } else {
      s = s.replace(/\./g, '').replace(',', '.');
    }
  } else if (s.includes(',')) {
    const parts = s.split(',');
    if (parts[parts.length - 1].length === 3) {
      s = s.replace(/,/g, '');
    } else {
      s = s.replace(',', '.');
    }
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function normalizeStatusNyala(raw, katNyala = '', realisasiDaya = 0) {
  const combined = `${raw} ${katNyala}`.toLowerCase().trim();
  if (realisasiDaya > 0) return 'NYALA';
  if (!combined) return 'BELUM';
  if (combined.includes('belum') || combined.includes('tidak') || combined.includes('proses') || combined.includes('lahan') || combined === '0' || combined === 'no') {
    return 'BELUM';
  }
  if (combined.includes('nyala') || combined.includes('sudah') || combined.includes('berlistrik') || combined.includes('aktif') || combined === 'ya' || combined === '1' || combined === 'ok') {
    return 'NYALA';
  }
  return 'BELUM';
}

// ==================== POPULATE FILTER DROPDOWNS ====================
function populateFilterDropdowns() {
  const uidSelect = document.getElementById('filterUid');
  const provSelect = document.getElementById('filterProv');
  const katSelect = document.getElementById('filterKategori');

  const uids = [...new Set(allRows.map((r) => r.uid))].sort((a, b) => {
    const ia = UID_ORDER.indexOf(a);
    const ib = UID_ORDER.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });
  const provs = [...new Set(allRows.map((r) => r.prov).filter((p) => p !== '-'))].sort();
  const kats = [...new Set(allRows.map((r) => r.kategori).filter(Boolean))].sort();

  uidSelect.innerHTML = `<option value="ALL">Semua UID SUMKAL (${uids.length} Unit)</option>` +
    uids.map((u) => `<option value="${escapeHtml(u)}">${escapeHtml(u)}</option>`).join('');

  provSelect.innerHTML = `<option value="ALL">Semua Provinsi (${provs.length})</option>` +
    provs.map((p) => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('');

  katSelect.innerHTML = `<option value="ALL">Semua Kategori (${kats.length})</option>` +
    kats.map((k) => `<option value="${escapeHtml(k)}">${escapeHtml(k)}</option>`).join('');
}

// ==================== FILTER & RENDER PIPELINE ====================
function applyFilters() {
  const fUid = document.getElementById('filterUid').value;
  const fProv = document.getElementById('filterProv').value;
  const fKat = document.getElementById('filterKategori').value;
  const fNyala = document.getElementById('filterNyala').value;
  const fSearch = document.getElementById('filterSearch').value.toLowerCase().trim();

  filteredRows = allRows.filter((r) => {
    if (fUid !== 'ALL' && r.uid !== fUid) return false;
    if (fProv !== 'ALL' && r.prov !== fProv) return false;
    if (fKat !== 'ALL' && r.kategori !== fKat) return false;
    if (fNyala !== 'ALL' && r.statusNyala !== fNyala) return false;
    if (fSearch) {
      const hay = `${r.sekolah} ${r.kab} ${r.prov} ${r.uid} ${r.alamat} ${r.ket}`.toLowerCase();
      if (!hay.includes(fSearch)) return false;
    }
    return true;
  });

  updateKpis();
  updateMap();
  updateCharts();
  updateTable();
}

function updateKpis() {
  const total = filteredRows.length;
  const nyalaCount = filteredRows.filter((r) => r.statusNyala === 'NYALA').length;
  const belumCount = total - nyalaCount;
  const pct = total > 0 ? ((nyalaCount / total) * 100).toFixed(1) : '0.0';
  const totalDayaKva = filteredRows.reduce((acc, r) => acc + r.dayaKva, 0);
  const totalRab = filteredRows.reduce((acc, r) => acc + r.rab, 0);

  const labelMap = { VOKASI: 'Sekolah Vokasi', TERPADU: 'Sekolah Terpadu', RAKYAT: 'Sekolah Rakyat' };
  document.getElementById('kpiTotalLabel').textContent = `Total ${labelMap[activeProgram]}`;
  document.getElementById('kpiTotal').textContent = total.toLocaleString('id-ID');
  document.getElementById('kpiNyala').textContent = nyalaCount.toLocaleString('id-ID');
  document.getElementById('kpiNyalaPct').textContent = `${pct}% dari total terfilter`;
  document.getElementById('kpiBelum').textContent = belumCount.toLocaleString('id-ID');
  document.getElementById('kpiDaya').innerHTML = `${totalDayaKva.toLocaleString('id-ID', { maximumFractionDigits: 1 })} <span class="text-xs font-bold">kVA</span>`;
  document.getElementById('kpiRab').textContent = formatRupiahShort(totalRab);
}

// ==================== MAP RENDER ====================
function getMarkerColor(r) {
  if (r.statusNyala === 'NYALA') return '#10b981';
  const k = `${r.ket} ${r.kategori} ${r.rawNyala}`.toLowerCase();
  if (k.includes('lahan') || k.includes('belum ada bangunan') || k.includes('pembebasan')) return '#ef4444';
  return '#f59e0b';
}

function updateMap() {
  markersLayer.clearLayers();
  const bounds = [];
  let validCoords = 0;

  filteredRows.forEach((r) => {
    if (r.lat != null && r.lng != null) {
      validCoords++;
      const isNyala = r.statusNyala === 'NYALA';
      const color = getMarkerColor(r);

      const marker = L.circleMarker([r.lat, r.lng], {
        radius: 7.5,
        fillColor: color,
        color: '#ffffff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.92
      });

      const fotoHtml = r.fotoUrl
        ? `<div class="mt-2 pt-2 border-t border-slate-200">
             <a href="${escapeHtml(r.fotoUrl)}" target="_blank" rel="noopener"
                class="inline-flex items-center gap-1 text-[11px] font-bold text-sky-700 hover:underline">
                Lihat Foto Eviden Lapangan &rarr;
             </a>
           </div>`
        : '';

      const popupHtml = `
        <div class="text-xs space-y-1.5 min-w-[235px] max-w-[290px]">
          <div class="flex items-center justify-between gap-2">
            <span class="font-bold text-sky-800 bg-sky-100 px-2 py-0.5 rounded">${escapeHtml(r.uid)}</span>
            <span class="font-bold px-2 py-0.5 rounded ${isNyala ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">
              ${isNyala ? 'Sudah Nyala' : 'Belum Nyala'}
            </span>
          </div>
          <p class="font-extrabold text-slate-900 text-sm leading-snug pt-0.5">${escapeHtml(r.sekolah)}</p>
          <p class="text-slate-600">${escapeHtml(r.kab)}, ${escapeHtml(r.prov)}</p>
          <p class="text-[11px] text-slate-500">${escapeHtml(r.alamat)}</p>
          <div class="border-t border-slate-200 pt-1.5 grid grid-cols-2 gap-1 text-[11px]">
            <div><span class="text-slate-400">Kategori:</span> <strong>${escapeHtml(r.kategori)}</strong></div>
            <div><span class="text-slate-400">Rencana Daya:</span> <strong>${r.dayaKva.toLocaleString('id-ID')} kVA</strong></div>
            <div><span class="text-slate-400">JTM / JTR:</span> <strong>${r.jtm} / ${r.jtr} kms</strong></div>
            <div><span class="text-slate-400">RAB:</span> <strong>${formatRupiahShort(r.rab)}</strong></div>
          </div>
          ${r.ket && r.ket !== '-' ? `<p class="text-[11px] text-slate-600 bg-slate-50 p-1.5 rounded border border-slate-200"><strong>Ket:</strong> ${escapeHtml(r.ket)}</p>` : ''}
          ${fotoHtml}
        </div>
      `;

      marker.bindPopup(popupHtml);
      markersLayer.addLayer(marker);
      bounds.push([r.lat, r.lng]);
    }
  });

  document.getElementById('mapNote').textContent =
    `Menampilkan ${validCoords} titik koordinat valid dari ${filteredRows.length} lokasi terfilter.`;

  if (bounds.length > 0) {
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 11 });
  } else {
    map.setView([-0.5, 108.5], 5);
  }
}

// ==================== CHARTS RENDER ====================
function updateCharts() {
  const uidMap = {};
  UID_ORDER.forEach((u) => { uidMap[u] = { nyala: 0, belum: 0 }; });

  filteredRows.forEach((r) => {
    if (!uidMap[r.uid]) uidMap[r.uid] = { nyala: 0, belum: 0 };
    if (r.statusNyala === 'NYALA') uidMap[r.uid].nyala++;
    else uidMap[r.uid].belum++;
  });

  const activeUids = Object.keys(uidMap).filter(
    (u) => UID_ORDER.includes(u) || uidMap[u].nyala + uidMap[u].belum > 0
  );

  const labels = activeUids.map((u) => u.replace(/^UI[DW]\s+/i, ''));
  const dataNyala = activeUids.map((u) => uidMap[u].nyala);
  const dataBelum = activeUids.map((u) => uidMap[u].belum);

  if (chartUidInstance) chartUidInstance.destroy();
  chartUidInstance = new Chart(document.getElementById('chartUid'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Sudah Nyala', data: dataNyala, backgroundColor: '#10b981', borderRadius: 4 },
        { label: 'Belum Nyala / Proses', data: dataBelum, backgroundColor: '#f59e0b', borderRadius: 4 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } } },
      scales: {
        x: { stacked: true, ticks: { font: { size: 10 } }, grid: { display: false } },
        y: { stacked: true, beginAtZero: true, ticks: { precision: 0, font: { size: 10 } } }
      }
    }
  });

  const katCounts = {};
  filteredRows.forEach((r) => {
    const k = r.kategori || 'Lainnya';
    katCounts[k] = (katCounts[k] || 0) + 1;
  });
  const katLabels = Object.keys(katCounts);
  const katValues = Object.values(katCounts);
  const palette = ['#0284c7', '#0ea5e9', '#10b981', '#f59e0b', '#6366f1', '#ec4899', '#8b5cf6', '#14b8a6'];

  if (chartKategoriInstance) chartKategoriInstance.destroy();
  chartKategoriInstance = new Chart(document.getElementById('chartKategori'), {
    type: 'doughnut',
    data: {
      labels: katLabels,
      datasets: [{
        data: katValues,
        backgroundColor: katLabels.map((_, i) => palette[i % palette.length]),
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '58%',
      plugins: {
        legend: { position: 'right', labels: { boxWidth: 11, font: { size: 11 } } }
      }
    }
  });
}

// ==================== TABLE RENDER (ADAPTIF PER TAB) ====================
function updateTable() {
  const thead = document.getElementById('tableHead');
  const tbody = document.getElementById('tableBody');
  document.getElementById('tableCount').textContent = `Menampilkan ${filteredRows.length} dari ${allRows.length} lokasi`;

  if (activeProgram === 'RAKYAT') {
    thead.innerHTML = `
      <tr>
        <th class="px-3 py-3 font-semibold">No</th>
        <th class="px-3 py-3 font-semibold">UID / UIW</th>
        <th class="px-3 py-3 font-semibold">Provinsi</th>
        <th class="px-3 py-3 font-semibold">Kab / Kota</th>
        <th class="px-3 py-3 font-semibold">Alamat Lokasi</th>
        <th class="px-3 py-3 font-semibold text-right">Rencana Daya (kVA)</th>
        <th class="px-3 py-3 font-semibold text-right">JTM (kms)</th>
        <th class="px-3 py-3 font-semibold text-right">JTR (kms)</th>
        <th class="px-3 py-3 font-semibold text-right">Gardu (kVA)</th>
        <th class="px-3 py-3 font-semibold text-right">RAB (Rp)</th>
        <th class="px-3 py-3 font-semibold text-right">BP (Rp)</th>
        <th class="px-3 py-3 font-semibold text-center">Status Nyala</th>
        <th class="px-3 py-3 font-semibold">Keterangan / Kendala</th>
        <th class="px-3 py-3 font-semibold text-center">Eviden</th>
      </tr>
    `;

    if (filteredRows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="14" class="px-4 py-8 text-center text-slate-400">Tidak ada data yang sesuai dengan filter.</td></tr>`;
      return;
    }

    tbody.innerHTML = filteredRows.map((r, idx) => {
      const isNyala = r.statusNyala === 'NYALA';
      return `
        <tr class="hover:bg-sky-50/60 transition">
          <td class="px-3 py-2.5 text-slate-500">${idx + 1}</td>
          <td class="px-3 py-2.5 font-semibold text-slate-800 whitespace-nowrap">${escapeHtml(r.uid)}</td>
          <td class="px-3 py-2.5 text-slate-700 whitespace-nowrap">${escapeHtml(r.prov)}</td>
          <td class="px-3 py-2.5 font-medium text-slate-800 whitespace-nowrap">${escapeHtml(r.kab)}</td>
          <td class="px-3 py-2.5 text-slate-600 max-w-[230px]">${escapeHtml(r.alamat)}</td>
          <td class="px-3 py-2.5 text-right font-semibold text-slate-800">${r.dayaKva ? r.dayaKva.toLocaleString('id-ID') : '-'}</td>
          <td class="px-3 py-2.5 text-right text-slate-600">${r.jtm ? r.jtm.toLocaleString('id-ID') : '-'}</td>
          <td class="px-3 py-2.5 text-right text-slate-600">${r.jtr ? r.jtr.toLocaleString('id-ID') : '-'}</td>
          <td class="px-3 py-2.5 text-right text-slate-600">${r.gardu ? r.gardu.toLocaleString('id-ID') : '-'}</td>
          <td class="px-3 py-2.5 text-right text-slate-700 whitespace-nowrap">${r.rab ? r.rab.toLocaleString('id-ID') : '-'}</td>
          <td class="px-3 py-2.5 text-right text-slate-700 whitespace-nowrap">${r.bp ? r.bp.toLocaleString('id-ID') : '-'}</td>
          <td class="px-3 py-2.5 text-center whitespace-nowrap">
            <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold ${isNyala ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">
              ${isNyala ? 'Sudah Nyala' : 'Belum Nyala'}
            </span>
          </td>
          <td class="px-3 py-2.5 text-slate-600 max-w-[240px]">${escapeHtml(r.ket)}</td>
          <td class="px-3 py-2.5 text-center whitespace-nowrap">
            ${r.fotoUrl ? `<a href="${escapeHtml(r.fotoUrl)}" target="_blank" rel="noopener" class="px-2 py-1 rounded bg-sky-100 text-sky-800 hover:bg-sky-200 font-semibold text-[11px]">Foto</a>` : '<span class="text-slate-300">-</span>'}
          </td>
        </tr>
      `;
    }).join('');
    return;
  }

  // Tabel default untuk Sekolah Vokasi & Sekolah Terpadu
  thead.innerHTML = `
    <tr>
      <th class="px-3 py-3 font-semibold">No</th>
      <th class="px-3 py-3 font-semibold">UID / UIW</th>
      <th class="px-3 py-3 font-semibold">Provinsi</th>
      <th class="px-3 py-3 font-semibold">Kab / Kota</th>
      <th class="px-3 py-3 font-semibold">Nama Sekolah</th>
      <th class="px-3 py-3 font-semibold">Kategori</th>
      <th class="px-3 py-3 font-semibold text-right">Daya (kVA)</th>
      <th class="px-3 py-3 font-semibold text-center">Status Nyala</th>
      <th class="px-3 py-3 font-semibold text-right">JTM (kms)</th>
      <th class="px-3 py-3 font-semibold text-right">JTR (kms)</th>
      <th class="px-3 py-3 font-semibold text-right">RAB (Rp)</th>
      <th class="px-3 py-3 font-semibold">Keterangan</th>
    </tr>
  `;

  if (filteredRows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="12" class="px-4 py-8 text-center text-slate-400">Tidak ada data yang sesuai dengan filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = filteredRows.map((r, idx) => {
    const isNyala = r.statusNyala === 'NYALA';
    return `
      <tr class="hover:bg-sky-50/60 transition">
        <td class="px-3 py-2.5 text-slate-500">${idx + 1}</td>
        <td class="px-3 py-2.5 font-semibold text-slate-800 whitespace-nowrap">${escapeHtml(r.uid)}</td>
        <td class="px-3 py-2.5 text-slate-700 whitespace-nowrap">${escapeHtml(r.prov)}</td>
        <td class="px-3 py-2.5 text-slate-700 whitespace-nowrap">${escapeHtml(r.kab)}</td>
        <td class="px-3 py-2.5 font-bold text-slate-900 min-w-[200px]">${escapeHtml(r.sekolah)}</td>
        <td class="px-3 py-2.5 text-slate-700 whitespace-nowrap">${escapeHtml(r.kategori)}</td>
        <td class="px-3 py-2.5 text-right font-semibold text-slate-800">${r.dayaKva.toLocaleString('id-ID')}</td>
        <td class="px-3 py-2.5 text-center whitespace-nowrap">
          <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold ${isNyala ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">
            ${isNyala ? 'Sudah Nyala' : 'Belum Nyala'}
          </span>
        </td>
        <td class="px-3 py-2.5 text-right text-slate-700">${r.jtm ? r.jtm.toLocaleString('id-ID') : '-'}</td>
        <td class="px-3 py-2.5 text-right text-slate-700">${r.jtr ? r.jtr.toLocaleString('id-ID') : '-'}</td>
        <td class="px-3 py-2.5 text-right text-slate-700 whitespace-nowrap">${r.rab ? r.rab.toLocaleString('id-ID') : '-'}</td>
        <td class="px-3 py-2.5 text-slate-600 max-w-[220px] truncate" title="${escapeHtml(r.ket)}">${escapeHtml(r.ket)}</td>
      </tr>
    `;
  }).join('');
}

// ==================== CSV EXPORT ====================
function exportFilteredCsv() {
  const headers = ['Program', 'UID', 'Provinsi', 'Kab_Kota', 'Nama_Lokasi', 'Alamat', 'Kategori', 'Rencana_Daya_kVA', 'Status_Nyala', 'JTM_kms', 'JTR_kms', 'Gardu_kVA', 'RAB_Rp', 'BP_Rp', 'Keterangan', 'Foto_URL', 'Lat', 'Long'];
  const csvLines = [headers.join(',')];

  filteredRows.forEach((r) => {
    const row = [
      activeProgram, r.uid, r.prov, r.kab, r.sekolah, r.alamat, r.kategori, r.dayaKva,
      r.statusNyala === 'NYALA' ? 'Sudah Nyala' : 'Belum Nyala',
      r.jtm, r.jtr, r.gardu, r.rab, r.bp, r.ket, r.fotoUrl, r.lat ?? '', r.lng ?? ''
    ].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`);
    csvLines.push(row.join(','));
  });

  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Monitoring_${activeProgram}_SUMKAL_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ==================== HELPERS ====================
function formatRupiahShort(num) {
  if (!num || num === 0) return 'Rp 0';
  if (num >= 1e9) return `Rp ${(num / 1e9).toFixed(2).replace('.', ',')} M`;
  if (num >= 1e6) return `Rp ${(num / 1e6).toFixed(1).replace('.', ',')} Jt`;
  return `Rp ${num.toLocaleString('id-ID')}`;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
