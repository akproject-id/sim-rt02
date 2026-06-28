# 🏘️ SIM-RT.02 — Sistem Informasi Warga RT.02

Sistem informasi kependudukan digital untuk lingkungan RT.02. Mendigitalisasi pengelolaan data warga yang sebelumnya manual, dengan fitur Smart Search, mutasi warga, pengkinian data mandiri, dan export laporan.

## ✨ Fitur Utama

| Fitur | Deskripsi |
|-------|-----------|
| 📊 **Dashboard** | Statistik real-time: total KK, jiwa, rumah terisi/kosong, warga baru |
| 🔍 **Smart Search** | Cari berdasarkan alamat (A12/22), nama, NIK, atau No HP |
| 🏠 **Master Data** | CRUD Rumah, Kepala Keluarga, dan Anggota Keluarga |
| 📤 **Mutasi Warga** | Soft-delete untuk pindah/meninggal/keluar dengan arsip historis |
| 🔗 **Pengkinian Data** | Generate link token → warga update data via HP → admin approve/reject |
| 📥 **Export Laporan** | Excel (.xlsx) dan PDF (dengan kop surat RT) |

## 🛠️ Tech Stack

- **Backend**: Node.js + Express.js
- **Database**: SQLite (better-sqlite3)
- **Frontend**: Vanilla HTML/CSS/JS (SPA)
- **Design**: Glassmorphism dark theme + Inter font
- **Export**: ExcelJS + PDFKit

## 🚀 Cara Menjalankan

### Prerequisites
- [Node.js](https://nodejs.org/) v18 atau lebih baru

### Instalasi

```bash
# Clone repository
git clone https://github.com/USERNAME/sim-rt02.git
cd sim-rt02

# Install dependencies
npm install

# Jalankan server
npm start
```

### Akses Aplikasi

| Halaman | URL | Credential |
|---------|-----|------------|
| Login Admin | http://localhost:3000 | `admin` / `admin123` |
| Dashboard | http://localhost:3000/admin/dashboard | setelah login |
| Form Warga | http://localhost:3000/update/{token} | via link dari admin |

## 📁 Struktur Proyek

```
sim-rt02/
├── server.js              # Entry point
├── database/
│   ├── schema.sql         # DDL 7 tabel
│   ├── db.js              # Koneksi SQLite
│   └── seed.js            # Data contoh
├── routes/                # API endpoints
├── middleware/             # Auth session & token
├── utils/                 # Smart search, PDF, dll
├── public/                # Frontend (HTML/CSS/JS)
└── uploads/               # Scan KTP & KK
```

## 📊 Database Schema

```
RUMAH (1) ──► KEPALA_KELUARGA (N) ──► WARGA (N)
                                        ├── MUTASI (N)
                                        └── UPDATE_REQUEST (N)
```

- **rumah**: blok + nomor_rumah (kolom terpisah)
- **kepala_keluarga**: nomor_kk, nama, status, foto KK
- **warga**: NIK, nama, TTL, pekerjaan, no HP, dll
- **mutasi**: riwayat masuk/pindah/meninggal/keluar
- **update_request**: pengajuan update + approval admin
- **token_link**: link pengkinian data (72 jam, 1x pakai)
- **admin**: akun pengurus RT

## 🔍 Smart Search

Pencarian otomatis mendeteksi jenis input:

| Input | Terdeteksi Sebagai | Query |
|-------|-------------------|-------|
| `A12/22` | Alamat | blok=A12, nomor=22 |
| `A12 No 22` | Alamat | blok=A12, nomor=22 |
| `3201xxxxxxxxxxxx` | NIK (16 digit) | nik=... |
| `081234567890` | No HP | no_hp LIKE ... |
| `Ahmad` | Nama | nama LIKE %Ahmad% |

## ⚙️ Konfigurasi (.env)

```env
PORT=3000
SESSION_SECRET=ganti-dengan-random-string
TOKEN_EXPIRY_HOURS=72
BASE_URL=http://localhost:3000
```

## 📋 Roadmap

- [x] **Fase 1**: Database, CRUD, Smart Search, Mutasi, Pengkinian Data, Export
- [ ] **Fase 2**: Iuran/Keuangan, Surat-menyurat, Siskamling

## 📄 Lisensi

Dibuat untuk keperluan internal RT.02.
