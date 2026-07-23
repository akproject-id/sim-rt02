-- ============================================================
-- SIM-RT.02: Database Schema (PostgreSQL / Supabase)
-- Sistem Informasi Warga RT.02 - Fase 1 MVP
-- ============================================================

-- Tabel Admin (Pengurus RT)
CREATE TABLE IF NOT EXISTS admin (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    nama_lengkap VARCHAR(100) NOT NULL,
    role VARCHAR(20) DEFAULT 'ADMIN',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabel Rumah
-- PENTING: Kolom blok dan nomor_rumah WAJIB terpisah
CREATE TABLE IF NOT EXISTS rumah (
    id SERIAL PRIMARY KEY,
    blok VARCHAR(10) NOT NULL,
    nomor_rumah VARCHAR(10) NOT NULL,
    status VARCHAR(10) DEFAULT 'KOSONG' CHECK(status IN ('TERISI', 'KOSONG')),
    catatan TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(blok, nomor_rumah)
);

-- Tabel Kepala Keluarga (KK)
CREATE TABLE IF NOT EXISTS kepala_keluarga (
    id SERIAL PRIMARY KEY,
    rumah_id INTEGER NOT NULL,
    nomor_kk VARCHAR(16) UNIQUE,
    nama_kepala VARCHAR(100) NOT NULL,
    status VARCHAR(15) DEFAULT 'AKTIF' CHECK(status IN ('AKTIF', 'TIDAK_AKTIF')),
    foto_kk_path VARCHAR(255),
    catatan TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (rumah_id) REFERENCES rumah(id) ON DELETE RESTRICT
);

-- Tabel Warga (Anggota Keluarga)
CREATE TABLE IF NOT EXISTS warga (
    id SERIAL PRIMARY KEY,
    kk_id INTEGER NOT NULL,
    nik VARCHAR(16) UNIQUE,
    nama_lengkap VARCHAR(100) NOT NULL,
    tempat_lahir VARCHAR(50),
    tanggal_lahir DATE,
    jenis_kelamin VARCHAR(1) CHECK(jenis_kelamin IN ('L', 'P')),
    agama VARCHAR(20) CHECK(agama IN ('Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Konghucu', 'Lainnya')),
    status_perkawinan VARCHAR(20) CHECK(status_perkawinan IN ('Belum Kawin', 'Kawin', 'Cerai Hidup', 'Cerai Mati')),
    pendidikan_terakhir VARCHAR(30),
    pekerjaan VARCHAR(50),
    no_hp VARCHAR(15),
    hubungan_keluarga VARCHAR(30) CHECK(hubungan_keluarga IN ('Kepala Keluarga', 'Istri', 'Anak', 'Menantu', 'Cucu', 'Orang Tua', 'Mertua', 'Famili Lain', 'Lainnya')),
    foto_ktp_path VARCHAR(255),
    status VARCHAR(15) DEFAULT 'AKTIF' CHECK(status IN ('AKTIF', 'TIDAK_AKTIF')),
    status_tinggal VARCHAR(10) DEFAULT 'TETAP' CHECK(status_tinggal IN ('TETAP', 'KONTRAK', 'KOST')),
    is_data_lengkap BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (kk_id) REFERENCES kepala_keluarga(id) ON DELETE RESTRICT
);

-- Tabel Mutasi (History Tracking)
CREATE TABLE IF NOT EXISTS mutasi (
    id SERIAL PRIMARY KEY,
    warga_id INTEGER NOT NULL,
    jenis_mutasi VARCHAR(15) NOT NULL CHECK(jenis_mutasi IN ('MASUK', 'PINDAH', 'MENINGGAL', 'KELUAR')),
    tanggal_mutasi DATE NOT NULL,
    keterangan TEXT,
    diinput_oleh VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (warga_id) REFERENCES warga(id) ON DELETE RESTRICT
);

-- Tabel Update Request (Pengkinian Data Mandiri)
-- warga_id nullable untuk support pengajuan anggota baru (NEW_MEMBER)
CREATE TABLE IF NOT EXISTS update_request (
    id SERIAL PRIMARY KEY,
    warga_id INTEGER,               -- NULL jika type = NEW_MEMBER
    data_lama TEXT NOT NULL,
    data_baru TEXT NOT NULL,
    status VARCHAR(10) DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED')),
    catatan_admin TEXT,
    reviewed_by INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    FOREIGN KEY (warga_id) REFERENCES warga(id) ON DELETE RESTRICT,
    FOREIGN KEY (reviewed_by) REFERENCES admin(id)
);

-- Tabel Token Link (Pengkinian Data Mandiri)
CREATE TABLE IF NOT EXISTS token_link (
    id SERIAL PRIMARY KEY,
    kk_id INTEGER NOT NULL,
    token VARCHAR(64) NOT NULL UNIQUE,
    expired_at TIMESTAMPTZ NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    generated_by INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (kk_id) REFERENCES kepala_keluarga(id) ON DELETE RESTRICT,
    FOREIGN KEY (generated_by) REFERENCES admin(id)
);

-- ============================================================
-- INDEXES untuk optimasi query
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_rumah_blok ON rumah(blok);
CREATE INDEX IF NOT EXISTS idx_rumah_blok_nomor ON rumah(blok, nomor_rumah);
CREATE INDEX IF NOT EXISTS idx_kk_rumah_id ON kepala_keluarga(rumah_id);
CREATE INDEX IF NOT EXISTS idx_kk_status ON kepala_keluarga(status);
CREATE INDEX IF NOT EXISTS idx_warga_kk_id ON warga(kk_id);
CREATE INDEX IF NOT EXISTS idx_warga_nik ON warga(nik);
CREATE INDEX IF NOT EXISTS idx_warga_nama ON warga(nama_lengkap);
CREATE INDEX IF NOT EXISTS idx_warga_status ON warga(status);
CREATE INDEX IF NOT EXISTS idx_warga_no_hp ON warga(no_hp);
CREATE INDEX IF NOT EXISTS idx_mutasi_warga_id ON mutasi(warga_id);
CREATE INDEX IF NOT EXISTS idx_update_request_status ON update_request(status);
CREATE INDEX IF NOT EXISTS idx_token_link_token ON token_link(token);
CREATE INDEX IF NOT EXISTS idx_token_link_kk_id ON token_link(kk_id);
