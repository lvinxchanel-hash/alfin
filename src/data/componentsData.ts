import { CameraPreset, ComponentLayerInfo, FocusTarget } from '../types/paSystem';

export const CAMERA_PRESETS: Record<FocusTarget, CameraPreset> = {
  overview: {
    target: 'overview',
    label: 'Tampilan Ruangan',
    subtitle: 'Ruang Operator & Ruang Aula',
    position: [0.4, 4.15, 7.35],
    lookAt: [0.1, 1.45, -0.1],
  },
  mic: {
    target: 'mic',
    label: 'Mikrofon Paging',
    subtitle: 'Bedah 7 Lapisan Dinamis',
    position: [-1.55, 1.62, 1.38],
    lookAt: [-2.85, 1.32, 0.45],
  },
  mixer: {
    target: 'mixer',
    label: 'Pre-Amp / Mixer',
    subtitle: 'Bedah 5 Blok Sirkuit',
    position: [-3.25, 1.85, 0.25],
    lookAt: [-4.4, 1.15, -1.25],
  },
  speaker: {
    target: 'speaker',
    label: 'Speaker Plafon 100V',
    subtitle: 'Bedah 6 Lapisan 100V Line',
    position: [1.35, 2.35, 2.15],
    lookAt: [2.8, 2.72, 0.0],
  },
};

export const COMPONENT_LAYERS: ComponentLayerInfo[] = [
  // 1. Paging Microphone Dinamis (7 Lapisan)
  {
    id: 'mic-1-grille',
    index: 1,
    component: 'mic',
    name: 'Grille Logam',
    shortLabel: '1. Grille Logam',
    description:
      'Anyaman baja tahan karat berlapis nikel yang melindungi kapsul dari benturan fisik sekaligus menyebar tekanan suara secara merata.',
    specs: 'Material: Baja Mesh Perforasi · Bukaan Akustik 68%',
    accentColor: '#38bdf8',
  },
  {
    id: 'mic-2-foam',
    index: 2,
    component: 'mic',
    name: 'Foam / Filter Akustik',
    shortLabel: '2. Foam Akustik',
    description:
      'Busa poliuretan sel terbuka yang meredam letupan udara (plosive) dari huruf konsonan P/B/T dan menyaring debu serta kelembapan.',
    specs: 'Densitas: 45 PPI Open-Cell · Redaman Pop: -12 dB',
    accentColor: '#94a3b8',
  },
  {
    id: 'mic-3-diaphragm',
    index: 3,
    component: 'mic',
    name: 'Diafragma Mylar',
    shortLabel: '3. Diafragma Mylar',
    description:
      'Membran polimer ultra-tipis yang bergetar maju-mundur secara mekanis mengikuti gelombang tekanan suara operator.',
    specs: 'Ketebalan: 12 µm Mylar · Resonansi: 80 Hz – 14 kHz',
    accentColor: '#22d3ee',
  },
  {
    id: 'mic-4-coil',
    index: 4,
    component: 'mic',
    name: 'Kumparan Suara / Voice Coil',
    shortLabel: '4. Voice Coil',
    description:
      'Lilitan kawat tembaga halus yang menempel pada diafragma. Saat bergerak di medan magnet, kumparan menghasilkan sinyal listrik induksi.',
    specs: 'Impedansi: 600 Ω Balanced · Kawat Tembaga Enameled',
    accentColor: '#f59e0b',
  },
  {
    id: 'mic-5-magnet',
    index: 5,
    component: 'mic',
    name: 'Magnet Permanen',
    shortLabel: '5. Magnet Permanen',
    description:
      'Inti magnet Neodymium berkekuatan fluks tinggi yang menciptakan medan magnet statis rapat di celah kumparan suara.',
    specs: 'Tipe: NdFeB N42 · Kerapatan Fluks: 1.25 Tesla',
    accentColor: '#f43f5e',
  },
  {
    id: 'mic-6-housing',
    index: 6,
    component: 'mic',
    name: 'Rumah Kapsul',
    shortLabel: '6. Rumah Kapsul',
    description:
      'Bodi aluminium die-cast dengan peredam kejut internal yang mengisolasi getaran meja dan membentuk ruang akustik belakang kapsul.',
    specs: 'Aluminium Anodized · Shock Mount Karet Isolasi',
    accentColor: '#64748b',
  },
  {
    id: 'mic-7-cable',
    index: 7,
    component: 'mic',
    name: 'Kabel Sinyal Lemah (mV)',
    shortLabel: '7. Kabel Sinyal mV',
    description:
      'Kabel seimbang (Balanced XLR) berpelindung tembaga anyaman untuk menyalurkan sinyal tegangan sangat rendah (1–15 mV) bebas derau ke mixer.',
    specs: 'Level Sinyal: ~2–15 mV RMS · Konektor XLR 3-Pin',
    accentColor: '#06b6d4',
  },

  // 2. Pre-Amplifier / Mixer (5 Blok Sirkuit & Kontrol)
  {
    id: 'mixer-1-gain',
    index: 1,
    component: 'mixer',
    name: 'Gain / Pre-Amp',
    shortLabel: '1. Gain / Pre-Amp',
    description:
      'Tahap penguat awal berderau rendah (Low-Noise Op-Amp) yang menaikkan sinyal mikroskopik mikrofon (mV) menjadi sinyal level kerja (+4 dBu).',
    specs: 'Penguatan: 0 – +50 dB · THD+N < 0.01%',
    accentColor: '#38bdf8',
  },
  {
    id: 'mixer-2-tone',
    index: 2,
    component: 'mixer',
    name: 'Tone Control (Bass & Treble)',
    shortLabel: '2. Tone Control',
    description:
      'Rangkaian filter Baxandall aktif untuk menyeimbangkan frekuensi rendah (Bass 180 Hz) dan kejernihan vokal tinggi (Treble 3.5 kHz).',
    specs: 'EQ Shelving: ±12 dB @ 180 Hz & 3.5 kHz',
    accentColor: '#818cf8',
  },
  {
    id: 'mixer-3-priority',
    index: 3,
    component: 'mixer',
    name: 'Sirkuit Priority Override',
    shortLabel: '3. Priority Override',
    description:
      'Sirkuit deteksi PTT dan relay elektromekanis yang otomatis mengecilkan (ducking) musik latar BGM sebesar -18 dB saat pengumuman aktif.',
    specs: 'Relay 24VDC · Redaman BGM Otomatis: -18 dB (< 25 ms)',
    accentColor: '#f59e0b',
  },
  {
    id: 'mixer-4-master',
    index: 4,
    component: 'mixer',
    name: 'Mixer / Volume',
    shortLabel: '4. Mixer / Volume',
    description:
      'Bus penjumlah sinyal (summing amplifier) yang menggabungkan jalur prioritas Paging dan BGM serta mengatur level keluaran utama.',
    specs: 'Arsitektur: Dual-Bus Summing · Headroom +20 dBu',
    accentColor: '#10b981',
  },
  {
    id: 'mixer-5-buffer',
    index: 5,
    component: 'mixer',
    name: 'Output Buffer (Line-Level & 100V)',
    shortLabel: '5. Output Buffer',
    description:
      'Tahap penyangga impedansi rendah dan penguat daya 100V Constant Voltage yang mampu mendorong kabel panjang ke seluruh zona aula.',
    specs: 'Tegangan Jalur: 100 Vrms · Proteksi Arus Lebih Aktif',
    accentColor: '#22d3ee',
  },

  // 3. Ceiling Speaker 100V Line (6 Lapisan)
  {
    id: 'spk-1-trafo',
    index: 1,
    component: 'speaker',
    name: 'Trafo Matching (3W / 6W / 10W)',
    shortLabel: '1. Trafo Matching',
    description:
      'Transformator penurun tegangan 100V Line menuju impedansi rendah speaker (8 Ω) dengan pemilih tap daya 3W, 6W, atau 10W sesuai kebutuhan ruangan.',
    specs: 'Input: 100 Vrms · Tap Daya: 3W / 6W / 10W',
    accentColor: '#f59e0b',
  },
  {
    id: 'spk-2-coil',
    index: 2,
    component: 'speaker',
    name: 'Kumparan Suara',
    shortLabel: '2. Kumparan Suara',
    description:
      'Silinder lilitan tembaga yang dialiri arus audio dari sekunder trafo, menghasilkan gaya Lorentz bolak-balik terhadap magnet permanen.',
    specs: 'Impedansi Driver: 8 Ω · Kapton Bobbin Tahan Panas',
    accentColor: '#fb923c',
  },
  {
    id: 'spk-3-magnet',
    index: 3,
    component: 'speaker',
    name: 'Magnet Permanen',
    shortLabel: '3. Magnet Permanen',
    description:
      'Cincin magnet ferit berenergi tinggi beserta pelat kutub baja untuk memusatkan medan magnet pada celah kumparan suara.',
    specs: 'Material: Ferit Y30 · Diameter Cincin 85 mm',
    accentColor: '#ef4444',
  },
  {
    id: 'spk-4-spider',
    index: 4,
    component: 'speaker',
    name: 'Suspensi / Spider',
    shortLabel: '4. Suspensi / Spider',
    description:
      'Cincin kain bergelombang elastis di dalam rangka keranjang yang menjaga kumparan tetap terpusat sempurna dan memulihkan posisi cone.',
    specs: 'Material: Katun Resinated · Linearitas Aksial Tinggi',
    accentColor: '#eab308',
  },
  {
    id: 'spk-5-cone',
    index: 5,
    component: 'speaker',
    name: 'Diafragma / Cone',
    shortLabel: '5. Diafragma / Cone',
    description:
      'Kerucut kertas serat akustik yang bergetar maju-mundur mendorong molekul udara di Ruang Aula menjadi gelombang suara yang terdengar.',
    specs: 'Diameter: 6.5 Inci Full-Range · Dispersi 120°',
    accentColor: '#38bdf8',
  },
  {
    id: 'spk-6-grille',
    index: 6,
    component: 'speaker',
    name: 'Grille Logam',
    shortLabel: '6. Grille Logam',
    description:
      'Penutup depan berlubang dengan cat powder-coat arsitektural yang menyatu rapi di plafon aula tanpa menghalangi radiasi frekuensi tinggi.',
    specs: 'Baja Galvanis Powder-Coat · Transparansi Akustik 72%',
    accentColor: '#cbd5e1',
  },
];

export function getLayersByComponent(component: Exclude<FocusTarget, 'overview'>) {
  return COMPONENT_LAYERS.filter((layer) => layer.component === component);
}
