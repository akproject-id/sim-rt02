/**
 * SIM-RT.02 - Main Application JavaScript
 * Single Page Application (SPA) logic for Admin Panel
 */

// ============ GLOBAL STATE ============
let currentPage = 'dashboard';
let adminInfo = null;
let blokList = [];

// ============ INITIALIZATION ============
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    loadBlokList();

    // Route from URL
    const path = window.location.pathname.replace('/admin/', '').replace('/admin', '');
    if (path && path !== '/') {
        navigateTo(path);
    } else {
        navigateTo('dashboard');
    }
});

async function checkAuth() {
    try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (data.authenticated) {
            adminInfo = data.admin;
            document.getElementById('adminName').textContent = data.admin.nama_lengkap;
            document.getElementById('adminAvatar').textContent = data.admin.nama_lengkap.charAt(0).toUpperCase();
        } else {
            window.location.href = '/login';
        }
    } catch {
        window.location.href = '/login';
    }
}

async function loadBlokList() {
    try {
        const res = await fetch('/api/rumah');
        const data = await res.json();
        if (data.blokList) blokList = data.blokList;
    } catch { /* ignore */ }
}

// ============ NAVIGATION ============
function navigateTo(page) {
    currentPage = page;
    window.history.pushState({}, '', `/admin/${page}`);

    // Update active nav
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const activeNav = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (activeNav) activeNav.classList.add('active');

    // Update title
    const titles = {
        dashboard: 'Dashboard', search: 'Pencarian Warga', rumah: 'Data Rumah',
        kk: 'Data Kepala Keluarga', warga: 'Data Warga',
        'generate-link': 'Generate Link Update', approval: 'Approval Pengkinian Data',
        export: 'Export Laporan'
    };
    document.getElementById('pageTitle').textContent = titles[page] || 'SIM-RT.02';

    // Close sidebar on mobile
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('mobileOverlay').classList.remove('active');

    // Load page content
    const loaders = {
        dashboard: loadDashboard, search: loadSearch, rumah: loadRumah,
        kk: loadKK, warga: loadWarga, 'generate-link': loadGenerateLink,
        approval: loadApproval, export: loadExport
    };

    const loader = loaders[page];
    if (loader) loader();
    else document.getElementById('pageContent').innerHTML = '<div class="empty-state"><p>Halaman tidak ditemukan.</p></div>';
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('mobileOverlay').classList.toggle('active');
}

// ============ TOAST ============
function showToast(msg, type = 'info') {
    const container = document.getElementById('toastContainer');
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type]}</span><span>${msg}</span><button class="toast-close" onclick="this.parentElement.remove()">✕</button>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
}

// ============ MODAL ============
function openModal(title, bodyHtml, footerHtml = '', large = false) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = bodyHtml;
    document.getElementById('modalFooter').innerHTML = footerHtml;
    document.getElementById('modalContent').className = large ? 'modal modal-lg' : 'modal';
    document.getElementById('modalOverlay').classList.add('active');
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
}

// ============ LOGOUT ============
async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
}

// ============ GLOBAL SEARCH ============
async function doGlobalSearch() {
    const q = document.getElementById('globalSearchInput').value.trim();
    if (!q) return;
    navigateTo('search');
    setTimeout(() => {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) { searchInput.value = q; performSearch(); }
    }, 100);
}

// ============ HELPER ============
function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function blokOptions(selected = '') {
    return `<option value="">Semua Blok</option>` +
        blokList.map(b => `<option value="${b}" ${b === selected ? 'selected' : ''}>${b}</option>`).join('');
}

// ============ PAGE: DASHBOARD ============
async function loadDashboard() {
    const el = document.getElementById('pageContent');
    el.innerHTML = '<div class="page-loading"><div class="loading-spinner" style="width:40px;height:40px;border-width:3px;"></div></div>';

    try {
        const res = await fetch('/api/dashboard/stats');
        const s = await res.json();

        // Update pending badge
        const badge = document.getElementById('pendingBadge');
        if (s.pendingUpdates > 0) {
            badge.textContent = s.pendingUpdates;
            badge.style.display = 'inline';
        } else {
            badge.style.display = 'none';
        }

        el.innerHTML = `
            <div class="stats-grid animate-fadeIn">
                <div class="stat-card">
                    <div class="stat-icon">👨‍👩‍👧‍👦</div>
                    <div class="stat-value">${s.totalKK}</div>
                    <div class="stat-label">Kepala Keluarga Aktif</div>
                    <div class="stat-sub">${s.totalJiwa} jiwa (${s.jiwaLaki} L / ${s.jiwaPerempuan} P)</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">🏠</div>
                    <div class="stat-value">${s.totalRumah}</div>
                    <div class="stat-label">Total Rumah</div>
                    <div class="stat-sub">${s.rumahTerisi} terisi · ${s.rumahKosong} kosong</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">🆕</div>
                    <div class="stat-value">${s.wargaBaru}</div>
                    <div class="stat-label">Warga Baru</div>
                    <div class="stat-sub">Dalam 30 hari terakhir</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">📝</div>
                    <div class="stat-value">${s.pendingUpdates}</div>
                    <div class="stat-label">Menunggu Approval</div>
                    <div class="stat-sub">${s.pendingUpdates > 0 ? '<a onclick="navigateTo(\'approval\')" style="cursor:pointer;">Lihat &rarr;</a>' : 'Tidak ada pengajuan'}</div>
                </div>
                <div class="stat-card" ${s.dataNotComplete > 0 ? 'style="cursor:pointer;" onclick="navigateTo(\'warga\')"' : ''}>
                    <div class="stat-icon">⚠️</div>
                    <div class="stat-value">${s.dataNotComplete}</div>
                    <div class="stat-label">Data Belum Lengkap</div>
                    <div class="stat-sub">${s.dataNotComplete > 0 ? 'Klik untuk filter' : 'Semua data lengkap ✓'}</div>
                </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;" class="animate-fadeIn">
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">📊 Warga per Blok</h3>
                    </div>
                    <div>
                        ${s.wargaPerBlok.map(b => `
                            <div style="display:flex;align-items:center;justify-content:space-between;padding:0.5rem 0;border-bottom:1px solid var(--border-light);">
                                <span class="fw-600">Blok ${b.blok}</span>
                                <div style="display:flex;align-items:center;gap:0.75rem;">
                                    <div style="width:120px;height:6px;background:var(--bg-tertiary);border-radius:3px;overflow:hidden;">
                                        <div style="width:${Math.min(100, (b.count / Math.max(...s.wargaPerBlok.map(x=>x.count))) * 100)}%;height:100%;background:linear-gradient(90deg,var(--primary),var(--accent));border-radius:3px;"></div>
                                    </div>
                                    <span class="text-sm fw-600">${b.count} jiwa</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">🕐 Warga Terbaru</h3>
                    </div>
                    <div>
                        ${s.recentWarga.length > 0 ? s.recentWarga.map(w => `
                            <div style="display:flex;align-items:center;justify-content:space-between;padding:0.5rem 0;border-bottom:1px solid var(--border-light);">
                                <div>
                                    <div class="fw-600 text-sm">${escapeHtml(w.nama_lengkap)}</div>
                                    <div class="text-xs text-muted">${w.blok}/${w.nomor_rumah}</div>
                                </div>
                                <span class="text-xs text-muted">${formatDate(w.created_at)}</span>
                            </div>
                        `).join('') : '<div class="empty-state"><p>Belum ada data</p></div>'}
                    </div>
                </div>
            </div>
        `;
    } catch (err) {
        el.innerHTML = '<div class="empty-state"><div class="empty-icon">❌</div><p>Gagal memuat dashboard.</p></div>';
    }
}

// ============ PAGE: SEARCH ============
async function loadSearch() {
    document.getElementById('pageContent').innerHTML = `
        <div class="card animate-fadeIn">
            <div class="card-header">
                <h3 class="card-title">🔍 Pencarian Pintar (Smart Search)</h3>
            </div>
            <div style="margin-bottom:1.5rem;">
                <div class="search-bar" style="width:100%;max-width:500px;">
                    <span class="search-icon">🔍</span>
                    <input type="text" id="searchInput" placeholder="Ketik: A12/22, nama, NIK 16 digit, atau No HP..." onkeydown="if(event.key==='Enter') performSearch()" autofocus>
                </div>
                <p class="text-xs text-muted" style="margin-top:0.5rem;">
                    Tips: Ketik alamat (A12/22), nama warga, NIK (16 digit), atau No HP (08xxx)
                </p>
            </div>
            <div id="searchResults"></div>
        </div>
    `;
}

async function performSearch() {
    const q = document.getElementById('searchInput').value.trim();
    const resultsEl = document.getElementById('searchResults');
    if (!q) { resultsEl.innerHTML = ''; return; }

    resultsEl.innerHTML = '<div class="page-loading"><div class="loading-spinner"></div></div>';

    try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();

        if (data.data.length === 0) {
            resultsEl.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><p>${data.message}</p></div>`;
            return;
        }

        resultsEl.innerHTML = `
            <p class="text-sm text-muted" style="margin-bottom:1rem;">${data.message}
                <span class="badge badge-info" style="margin-left:0.5rem;">Tipe: ${data.parsed.type}</span>
            </p>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Alamat</th><th>Nama</th><th>NIK</th><th>L/P</th>
                            <th>No HP</th><th>Pekerjaan</th><th>Hub. Keluarga</th><th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.data.map(w => `
                            <tr>
                                <td class="fw-600">${w.blok}/${w.nomor_rumah}</td>
                                <td>${escapeHtml(w.nama_lengkap)}</td>
                                <td class="text-xs">${w.nik || '-'}</td>
                                <td>${w.jenis_kelamin || '-'}</td>
                                <td>${w.no_hp || '-'}</td>
                                <td>${w.pekerjaan || '-'}</td>
                                <td>${w.hubungan_keluarga || '-'}</td>
                                <td><span class="badge ${w.warga_status === 'AKTIF' ? 'badge-success' : 'badge-danger'}">${w.warga_status}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch {
        resultsEl.innerHTML = '<div class="empty-state"><p>Gagal melakukan pencarian.</p></div>';
    }
}

// ============ PAGE: RUMAH ============
async function loadRumah() {
    const el = document.getElementById('pageContent');
    el.innerHTML = '<div class="page-loading"><div class="loading-spinner" style="width:40px;height:40px;border-width:3px;"></div></div>';

    try {
        const res = await fetch('/api/rumah');
        const data = await res.json();

        el.innerHTML = `
            <div class="card animate-fadeIn">
                <div class="toolbar">
                    <div class="toolbar-left">
                        <select class="filter-select" id="filterBlokRumah" onchange="loadRumah()">
                            ${blokOptions()}
                        </select>
                        <select class="filter-select" id="filterStatusRumah" onchange="loadRumah()">
                            <option value="">Semua Status</option>
                            <option value="TERISI">Terisi</option>
                            <option value="KOSONG">Kosong</option>
                        </select>
                    </div>
                    <div class="toolbar-right">
                        <button class="btn btn-primary btn-sm" onclick="showAddRumahModal()">+ Tambah Rumah</button>
                    </div>
                </div>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr><th>Blok</th><th>No Rumah</th><th>Status</th><th>Jumlah KK</th><th>Jumlah Warga</th><th>Catatan</th><th>Aksi</th></tr>
                        </thead>
                        <tbody>
                            ${data.data.length > 0 ? data.data.map(r => `
                                <tr>
                                    <td class="fw-700">${r.blok}</td>
                                    <td class="fw-600">${r.nomor_rumah}</td>
                                    <td><span class="badge ${r.status === 'TERISI' ? 'badge-success' : 'badge-warning'}">${r.status}</span></td>
                                    <td>${r.jumlah_kk}</td>
                                    <td>${r.jumlah_warga}</td>
                                    <td class="text-sm text-muted">${escapeHtml(r.catatan) || '-'}</td>
                                    <td>
                                        <div class="table-actions">
                                            <button class="btn btn-ghost btn-sm" onclick="showEditRumahModal(${r.id})">✏️</button>
                                            <button class="btn btn-ghost btn-sm" onclick="deleteRumah(${r.id})" ${r.jumlah_kk > 0 ? 'disabled title="Masih ada KK aktif"' : ''}>🗑️</button>
                                        </div>
                                    </td>
                                </tr>
                            `).join('') : '<tr><td colspan="7" class="text-center text-muted" style="padding:2rem;">Tidak ada data rumah.</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } catch {
        el.innerHTML = '<div class="empty-state"><p>Gagal memuat data rumah.</p></div>';
    }
}

function showAddRumahModal() {
    openModal('Tambah Rumah Baru', `
        <form id="addRumahForm">
            <div class="form-row">
                <div class="form-group">
                    <label>Blok *</label>
                    <input type="text" class="form-control" id="rumahBlok" placeholder="Contoh: A12" required>
                </div>
                <div class="form-group">
                    <label>Nomor Rumah *</label>
                    <input type="text" class="form-control" id="rumahNomor" placeholder="Contoh: 22" required>
                </div>
            </div>
            <div class="form-group">
                <label>Status</label>
                <select class="form-control" id="rumahStatus">
                    <option value="KOSONG">Kosong</option>
                    <option value="TERISI">Terisi</option>
                </select>
            </div>
            <div class="form-group">
                <label>Catatan</label>
                <input type="text" class="form-control" id="rumahCatatan" placeholder="Opsional">
            </div>
        </form>
    `, `<button class="btn btn-outline" onclick="closeModal()">Batal</button>
        <button class="btn btn-primary" onclick="saveRumah()">Simpan</button>`);
}

async function showEditRumahModal(id) {
    const res = await fetch(`/api/rumah/${id}`);
    const r = await res.json();

    openModal('Edit Rumah', `
        <form id="editRumahForm">
            <input type="hidden" id="editRumahId" value="${r.id}">
            <div class="form-row">
                <div class="form-group">
                    <label>Blok</label>
                    <input type="text" class="form-control" id="rumahBlok" value="${r.blok}" required>
                </div>
                <div class="form-group">
                    <label>Nomor Rumah</label>
                    <input type="text" class="form-control" id="rumahNomor" value="${r.nomor_rumah}" required>
                </div>
            </div>
            <div class="form-group">
                <label>Status</label>
                <select class="form-control" id="rumahStatus">
                    <option value="KOSONG" ${r.status === 'KOSONG' ? 'selected' : ''}>Kosong</option>
                    <option value="TERISI" ${r.status === 'TERISI' ? 'selected' : ''}>Terisi</option>
                </select>
            </div>
            <div class="form-group">
                <label>Catatan</label>
                <input type="text" class="form-control" id="rumahCatatan" value="${escapeHtml(r.catatan) || ''}">
            </div>
        </form>
    `, `<button class="btn btn-outline" onclick="closeModal()">Batal</button>
        <button class="btn btn-primary" onclick="saveRumah(${r.id})">Simpan</button>`);
}

async function saveRumah(id = null) {
    const body = {
        blok: document.getElementById('rumahBlok').value,
        nomor_rumah: document.getElementById('rumahNomor').value,
        status: document.getElementById('rumahStatus').value,
        catatan: document.getElementById('rumahCatatan').value
    };

    const url = id ? `/api/rumah/${id}` : '/api/rumah';
    const method = id ? 'PUT' : 'POST';

    try {
        const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const data = await res.json();
        if (res.ok) {
            showToast(data.message, 'success');
            closeModal();
            loadRumah();
            loadBlokList();
        } else {
            showToast(data.error, 'error');
        }
    } catch { showToast('Gagal menyimpan data.', 'error'); }
}

async function deleteRumah(id) {
    if (!confirm('Yakin ingin menghapus data rumah ini?')) return;
    try {
        const res = await fetch(`/api/rumah/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok) { showToast(data.message, 'success'); loadRumah(); }
        else showToast(data.error, 'error');
    } catch { showToast('Gagal menghapus.', 'error'); }
}

// ============ PAGE: KK ============
async function loadKK() {
    const el = document.getElementById('pageContent');
    el.innerHTML = '<div class="page-loading"><div class="loading-spinner" style="width:40px;height:40px;border-width:3px;"></div></div>';

    try {
        const res = await fetch('/api/kk');
        const data = await res.json();

        el.innerHTML = `
            <div class="card animate-fadeIn">
                <div class="toolbar">
                    <div class="toolbar-left">
                        <select class="filter-select" id="filterBlokKK" onchange="filterKK()">
                            ${blokOptions()}
                        </select>
                    </div>
                    <div class="toolbar-right">
                        <button class="btn btn-primary btn-sm" onclick="showAddKKModal()">+ Tambah KK</button>
                    </div>
                </div>
                <div class="table-container">
                    <table>
                        <thead><tr><th>Alamat</th><th>No KK</th><th>Nama Kepala</th><th>Jml Anggota</th><th>Status</th><th>Aksi</th></tr></thead>
                        <tbody id="kkTableBody">
                            ${renderKKRows(data.data)}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } catch { el.innerHTML = '<div class="empty-state"><p>Gagal memuat data KK.</p></div>'; }
}

function renderKKRows(rows) {
    if (!rows.length) return '<tr><td colspan="6" class="text-center text-muted" style="padding:2rem;">Tidak ada data.</td></tr>';
    return rows.map(kk => `
        <tr>
            <td class="fw-700">${kk.blok}/${kk.nomor_rumah}</td>
            <td class="text-sm">${kk.nomor_kk || '-'}</td>
            <td class="fw-600">${escapeHtml(kk.nama_kepala)}</td>
            <td>${kk.jumlah_anggota}</td>
            <td><span class="badge ${kk.status === 'AKTIF' ? 'badge-success' : 'badge-danger'}">${kk.status}</span></td>
            <td>
                <div class="table-actions">
                    <button class="btn btn-ghost btn-sm" onclick="showDetailKK(${kk.id})" title="Detail">👁️</button>
                    <button class="btn btn-ghost btn-sm" onclick="showEditKKModal(${kk.id})" title="Edit">✏️</button>
                </div>
            </td>
        </tr>
    `).join('');
}

async function filterKK() {
    const blok = document.getElementById('filterBlokKK').value;
    const res = await fetch(`/api/kk?blok=${blok}`);
    const data = await res.json();
    document.getElementById('kkTableBody').innerHTML = renderKKRows(data.data);
}

async function showDetailKK(id) {
    const res = await fetch(`/api/kk/${id}`);
    const kk = await res.json();

    openModal(`KK - ${kk.nama_kepala}`, `
        <div class="warga-info-card" style="margin-bottom:1rem;">
            <div class="info-row"><span class="info-label">Alamat</span><span class="info-value">${kk.blok}/${kk.nomor_rumah}</span></div>
            <div class="info-row"><span class="info-label">No KK</span><span class="info-value">${kk.nomor_kk || '-'}</span></div>
            <div class="info-row"><span class="info-label">Status</span><span class="info-value">${kk.status}</span></div>
        </div>
        <h4 style="margin-bottom:0.75rem;font-size:0.875rem;">Anggota Keluarga (${kk.anggota.length})</h4>
        <div class="table-container">
            <table>
                <thead><tr><th>Nama</th><th>NIK</th><th>L/P</th><th>Hub.</th><th>Status</th></tr></thead>
                <tbody>
                    ${kk.anggota.map(w => `
                        <tr>
                            <td class="fw-600">${escapeHtml(w.nama_lengkap)}</td>
                            <td class="text-xs">${w.nik || '-'}</td>
                            <td>${w.jenis_kelamin || '-'}</td>
                            <td>${w.hubungan_keluarga || '-'}</td>
                            <td><span class="badge ${w.status === 'AKTIF' ? 'badge-success' : 'badge-danger'}">${w.status}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `, '<button class="btn btn-outline" onclick="closeModal()">Tutup</button>', true);
}

async function showAddKKModal() {
    const rumahRes = await fetch('/api/rumah');
    const rumahData = await rumahRes.json();

    openModal('Tambah Kepala Keluarga', `
        <form id="addKKForm">
            <div class="form-group">
                <label>Rumah (Alamat) *</label>
                <select class="form-control" id="kkRumahId" required>
                    <option value="">-- Pilih Rumah --</option>
                    ${rumahData.data.map(r => `<option value="${r.id}">${r.blok}/${r.nomor_rumah} ${r.status === 'KOSONG' ? '(Kosong)' : ''}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Nomor KK</label>
                <input type="text" class="form-control" id="kkNomorKK" placeholder="16 digit" maxlength="16">
            </div>
            <div class="form-group">
                <label>Nama Kepala Keluarga *</label>
                <input type="text" class="form-control" id="kkNamaKepala" required>
            </div>
            <div class="form-group">
                <label>Catatan</label>
                <input type="text" class="form-control" id="kkCatatan">
            </div>
        </form>
    `, `<button class="btn btn-outline" onclick="closeModal()">Batal</button>
        <button class="btn btn-primary" onclick="saveKK()">Simpan</button>`);
}

async function showEditKKModal(id) {
    const res = await fetch(`/api/kk/${id}`);
    const kk = await res.json();
    const rumahRes = await fetch('/api/rumah');
    const rumahData = await rumahRes.json();

    openModal('Edit KK', `
        <form>
            <div class="form-group">
                <label>Rumah (Alamat)</label>
                <select class="form-control" id="kkRumahId">
                    ${rumahData.data.map(r => `<option value="${r.id}" ${r.id === kk.rumah_id ? 'selected' : ''}>${r.blok}/${r.nomor_rumah}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Nomor KK</label>
                <input type="text" class="form-control" id="kkNomorKK" value="${kk.nomor_kk || ''}" maxlength="16">
            </div>
            <div class="form-group">
                <label>Nama Kepala Keluarga</label>
                <input type="text" class="form-control" id="kkNamaKepala" value="${escapeHtml(kk.nama_kepala)}">
            </div>
            <div class="form-group">
                <label>Status</label>
                <select class="form-control" id="kkStatus">
                    <option value="AKTIF" ${kk.status==='AKTIF'?'selected':''}>Aktif</option>
                    <option value="TIDAK_AKTIF" ${kk.status==='TIDAK_AKTIF'?'selected':''}>Tidak Aktif</option>
                </select>
            </div>
            <div class="form-group">
                <label>Catatan</label>
                <input type="text" class="form-control" id="kkCatatan" value="${escapeHtml(kk.catatan) || ''}">
            </div>
        </form>
    `, `<button class="btn btn-outline" onclick="closeModal()">Batal</button>
        <button class="btn btn-primary" onclick="saveKK(${id})">Simpan</button>`);
}

async function saveKK(id = null) {
    const body = {
        rumah_id: document.getElementById('kkRumahId').value,
        nomor_kk: document.getElementById('kkNomorKK').value,
        nama_kepala: document.getElementById('kkNamaKepala').value,
        catatan: document.getElementById('kkCatatan').value
    };
    const statusEl = document.getElementById('kkStatus');
    if (statusEl) body.status = statusEl.value;

    const url = id ? `/api/kk/${id}` : '/api/kk';
    const method = id ? 'PUT' : 'POST';

    try {
        const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const data = await res.json();
        if (res.ok) { showToast(data.message, 'success'); closeModal(); loadKK(); }
        else showToast(data.error, 'error');
    } catch { showToast('Gagal menyimpan.', 'error'); }
}

// ============ PAGE: WARGA ============
async function loadWarga() {
    const el = document.getElementById('pageContent');
    el.innerHTML = '<div class="page-loading"><div class="loading-spinner" style="width:40px;height:40px;border-width:3px;"></div></div>';

    try {
        const res = await fetch('/api/warga?status=AKTIF');
        const data = await res.json();

        el.innerHTML = `
            <div class="card animate-fadeIn">
                <div class="toolbar">
                    <div class="toolbar-left">
                        <select class="filter-select" id="filterBlokWarga" onchange="filterWarga()">
                            ${blokOptions()}
                        </select>
                        <label style="font-size:0.8125rem;display:flex;align-items:center;gap:0.5rem;color:var(--text-secondary);cursor:pointer;">
                            <input type="checkbox" id="filterIncomplete" onchange="filterWarga()"> Belum Lengkap
                        </label>
                    </div>
                    <div class="toolbar-right">
                        <button class="btn btn-primary btn-sm" onclick="showAddWargaModal()">+ Tambah Warga</button>
                    </div>
                </div>
                <div class="table-container">
                    <table>
                        <thead><tr><th>Alamat</th><th>Nama</th><th>NIK</th><th>L/P</th><th>No HP</th><th>Hub.</th><th>Data</th><th>Aksi</th></tr></thead>
                        <tbody id="wargaTableBody">
                            ${renderWargaRows(data.data)}
                        </tbody>
                    </table>
                </div>
                ${data.pagination ? `<div class="text-sm text-muted text-center mt-1">Menampilkan ${data.data.length} dari ${data.pagination.total} warga</div>` : ''}
            </div>
        `;
    } catch { el.innerHTML = '<div class="empty-state"><p>Gagal memuat data warga.</p></div>'; }
}

function renderWargaRows(rows) {
    if (!rows.length) return '<tr><td colspan="8" class="text-center text-muted" style="padding:2rem;">Tidak ada data.</td></tr>';
    return rows.map(w => `
        <tr>
            <td class="fw-600">${w.blok}/${w.nomor_rumah}</td>
            <td class="fw-600">${escapeHtml(w.nama_lengkap)}</td>
            <td class="text-xs">${w.nik || '<span class="text-danger">-</span>'}</td>
            <td>${w.jenis_kelamin || '-'}</td>
            <td class="text-sm">${w.no_hp || '-'}</td>
            <td class="text-sm">${w.hubungan_keluarga || '-'}</td>
            <td>${w.is_data_lengkap ? '<span class="badge badge-success">✓</span>' : '<span class="badge badge-warning">!</span>'}</td>
            <td>
                <div class="table-actions">
                    <button class="btn btn-ghost btn-sm" onclick="showEditWargaModal(${w.id})" title="Edit">✏️</button>
                    <button class="btn btn-ghost btn-sm" onclick="showMutasiModal(${w.id}, '${escapeHtml(w.nama_lengkap)}')" title="Mutasi">📤</button>
                </div>
            </td>
        </tr>
    `).join('');
}

async function filterWarga() {
    const blok = document.getElementById('filterBlokWarga').value;
    const incomplete = document.getElementById('filterIncomplete').checked ? '1' : '';
    const res = await fetch(`/api/warga?status=AKTIF&blok=${blok}&incomplete=${incomplete}`);
    const data = await res.json();
    document.getElementById('wargaTableBody').innerHTML = renderWargaRows(data.data);
}

async function showAddWargaModal() {
    const kkRes = await fetch('/api/kk?status=AKTIF');
    const kkData = await kkRes.json();

    openModal('Tambah Warga Baru', renderWargaForm(null, kkData.data),
        `<button class="btn btn-outline" onclick="closeModal()">Batal</button>
         <button class="btn btn-primary" onclick="saveWarga()">Simpan</button>`, true);
}

async function showEditWargaModal(id) {
    const wRes = await fetch(`/api/warga/${id}`);
    const w = await wRes.json();
    const kkRes = await fetch('/api/kk?status=AKTIF');
    const kkData = await kkRes.json();

    openModal('Edit Data Warga', renderWargaForm(w, kkData.data),
        `<button class="btn btn-outline" onclick="closeModal()">Batal</button>
         <button class="btn btn-primary" onclick="saveWarga(${id})">Simpan</button>`, true);
}

function renderWargaForm(w, kkList) {
    const v = w || {};
    return `
        <form id="wargaForm">
            <div class="form-group">
                <label>Kepala Keluarga *</label>
                <select class="form-control" id="wargaKKId" required>
                    <option value="">-- Pilih KK --</option>
                    ${kkList.map(kk => `<option value="${kk.id}" ${v.kk_id == kk.id ? 'selected' : ''}>${kk.blok}/${kk.nomor_rumah} — ${escapeHtml(kk.nama_kepala)}</option>`).join('')}
                </select>
            </div>
            <div class="form-row">
                <div class="form-group"><label>NIK</label><input type="text" class="form-control" id="wargaNIK" value="${v.nik || ''}" maxlength="16" placeholder="16 digit"></div>
                <div class="form-group"><label>Nama Lengkap *</label><input type="text" class="form-control" id="wargaNama" value="${escapeHtml(v.nama_lengkap) || ''}" required></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Tempat Lahir</label><input type="text" class="form-control" id="wargaTempatLahir" value="${v.tempat_lahir || ''}"></div>
                <div class="form-group"><label>Tanggal Lahir</label><input type="date" class="form-control" id="wargaTanggalLahir" value="${v.tanggal_lahir || ''}"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Jenis Kelamin</label>
                    <select class="form-control" id="wargaJK"><option value="">--</option><option value="L" ${v.jenis_kelamin==='L'?'selected':''}>Laki-laki</option><option value="P" ${v.jenis_kelamin==='P'?'selected':''}>Perempuan</option></select>
                </div>
                <div class="form-group"><label>Agama</label>
                    <select class="form-control" id="wargaAgama"><option value="">--</option>${['Islam','Kristen','Katolik','Hindu','Buddha','Konghucu','Lainnya'].map(a=>`<option value="${a}" ${v.agama===a?'selected':''}>${a}</option>`).join('')}</select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Status Perkawinan</label>
                    <select class="form-control" id="wargaKawin"><option value="">--</option>${['Belum Kawin','Kawin','Cerai Hidup','Cerai Mati'].map(s=>`<option value="${s}" ${v.status_perkawinan===s?'selected':''}>${s}</option>`).join('')}</select>
                </div>
                <div class="form-group"><label>Hubungan Keluarga</label>
                    <select class="form-control" id="wargaHubungan"><option value="">--</option>${['Kepala Keluarga','Istri','Anak','Menantu','Cucu','Orang Tua','Mertua','Famili Lain','Lainnya'].map(h=>`<option value="${h}" ${v.hubungan_keluarga===h?'selected':''}>${h}</option>`).join('')}</select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Pendidikan</label><input type="text" class="form-control" id="wargaPendidikan" value="${v.pendidikan_terakhir || ''}" placeholder="SD/SMP/SMA/D3/S1/S2"></div>
                <div class="form-group"><label>Pekerjaan</label><input type="text" class="form-control" id="wargaPekerjaan" value="${v.pekerjaan || ''}"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>No HP</label><input type="tel" class="form-control" id="wargaHP" value="${v.no_hp || ''}" placeholder="08xxxxxxxxxx"></div>
                <div class="form-group"><label>Status Tinggal</label>
                    <select class="form-control" id="wargaTinggal"><option value="TETAP" ${v.status_tinggal==='TETAP'?'selected':''}>Tetap</option><option value="KONTRAK" ${v.status_tinggal==='KONTRAK'?'selected':''}>Kontrak</option><option value="KOST" ${v.status_tinggal==='KOST'?'selected':''}>Kost</option></select>
                </div>
            </div>
        </form>
    `;
}

async function saveWarga(id = null) {
    const body = {
        kk_id: document.getElementById('wargaKKId').value,
        nik: document.getElementById('wargaNIK').value,
        nama_lengkap: document.getElementById('wargaNama').value,
        tempat_lahir: document.getElementById('wargaTempatLahir').value,
        tanggal_lahir: document.getElementById('wargaTanggalLahir').value,
        jenis_kelamin: document.getElementById('wargaJK').value,
        agama: document.getElementById('wargaAgama').value,
        status_perkawinan: document.getElementById('wargaKawin').value,
        hubungan_keluarga: document.getElementById('wargaHubungan').value,
        pendidikan_terakhir: document.getElementById('wargaPendidikan').value,
        pekerjaan: document.getElementById('wargaPekerjaan').value,
        no_hp: document.getElementById('wargaHP').value,
        status_tinggal: document.getElementById('wargaTinggal').value,
    };

    const url = id ? `/api/warga/${id}` : '/api/warga';
    const method = id ? 'PUT' : 'POST';

    try {
        const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const data = await res.json();
        if (res.ok) { showToast(data.message, 'success'); closeModal(); loadWarga(); }
        else showToast(data.error, 'error');
    } catch { showToast('Gagal menyimpan.', 'error'); }
}

function showMutasiModal(id, nama) {
    openModal(`Mutasi — ${nama}`, `
        <form id="mutasiForm">
            <div class="form-group">
                <label>Jenis Mutasi *</label>
                <select class="form-control" id="mutasiJenis" required>
                    <option value="">-- Pilih --</option>
                    <option value="PINDAH">Pindah</option>
                    <option value="MENINGGAL">Meninggal</option>
                    <option value="KELUAR">Keluar</option>
                </select>
            </div>
            <div class="form-group">
                <label>Tanggal Mutasi *</label>
                <input type="date" class="form-control" id="mutasiTanggal" value="${new Date().toISOString().split('T')[0]}" required>
            </div>
            <div class="form-group">
                <label>Keterangan</label>
                <input type="text" class="form-control" id="mutasiKeterangan" placeholder="Contoh: Pindah ke Jakarta">
            </div>
        </form>
        <div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);border-radius:var(--radius-md);padding:0.75rem;margin-top:1rem;">
            <p class="text-sm" style="color:var(--danger-light);">⚠️ Data warga akan diubah statusnya menjadi <strong>Tidak Aktif</strong>. Data tidak dihapus permanen dan tetap tersimpan sebagai arsip.</p>
        </div>
    `, `<button class="btn btn-outline" onclick="closeModal()">Batal</button>
        <button class="btn btn-danger" onclick="processMutasi(${id})">Proses Mutasi</button>`);
}

async function processMutasi(id) {
    const body = {
        jenis_mutasi: document.getElementById('mutasiJenis').value,
        tanggal_mutasi: document.getElementById('mutasiTanggal').value,
        keterangan: document.getElementById('mutasiKeterangan').value
    };

    if (!body.jenis_mutasi || !body.tanggal_mutasi) {
        showToast('Jenis dan tanggal mutasi wajib diisi.', 'warning');
        return;
    }

    try {
        const res = await fetch(`/api/warga/${id}/mutasi`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const data = await res.json();
        if (res.ok) { showToast(data.message, 'success'); closeModal(); loadWarga(); }
        else showToast(data.error, 'error');
    } catch { showToast('Gagal memproses mutasi.', 'error'); }
}

// ============ PAGE: GENERATE LINK ============
async function loadGenerateLink() {
    const el = document.getElementById('pageContent');

    const kkRes = await fetch('/api/kk?status=AKTIF');
    const kkData = await kkRes.json();
    const tokenRes = await fetch('/api/token/list');
    const tokenData = await tokenRes.json();

    el.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;" class="animate-fadeIn">
            <div class="card">
                <div class="card-header"><h3 class="card-title">🔗 Generate Link Baru</h3></div>
                <div class="form-group">
                    <label>Pilih Kepala Keluarga</label>
                    <select class="form-control" id="linkKKId">
                        <option value="">-- Pilih KK --</option>
                        ${kkData.data.map(kk => `<option value="${kk.id}">${kk.blok}/${kk.nomor_rumah} — ${escapeHtml(kk.nama_kepala)}</option>`).join('')}
                    </select>
                </div>
                <button class="btn btn-primary btn-block" onclick="generateLink()">Generate Link</button>
                <div id="generatedLinkResult" style="margin-top:1rem;"></div>
            </div>
            <div class="card">
                <div class="card-header"><h3 class="card-title">📋 Riwayat Link</h3></div>
                <div style="max-height:500px;overflow-y:auto;">
                    ${tokenData.data.length > 0 ? tokenData.data.map(t => `
                        <div style="padding:0.75rem;border-bottom:1px solid var(--border-light);font-size:0.8125rem;">
                            <div class="d-flex justify-between items-center">
                                <span class="fw-600">${escapeHtml(t.nama_kepala)}</span>
                                <span class="badge ${t.is_active ? 'badge-success' : t.is_used ? 'badge-default' : 'badge-danger'}">
                                    ${t.is_active ? 'Aktif' : t.is_used ? 'Terpakai' : 'Expired'}
                                </span>
                            </div>
                            <div class="text-xs text-muted" style="margin-top:0.25rem;">${t.blok}/${t.nomor_rumah} · ${formatDateTime(t.created_at)}</div>
                        </div>
                    `).join('') : '<div class="empty-state"><p>Belum ada link.</p></div>'}
                </div>
            </div>
        </div>
    `;
}

async function generateLink() {
    const kkId = document.getElementById('linkKKId').value;
    if (!kkId) { showToast('Pilih KK terlebih dahulu.', 'warning'); return; }

    try {
        const res = await fetch('/api/token/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kk_id: kkId }) });
        const data = await res.json();

        if (res.ok) {
            document.getElementById('generatedLinkResult').innerHTML = `
                <div style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.2);border-radius:var(--radius-md);padding:1rem;">
                    <p class="text-sm fw-600" style="color:var(--success);margin-bottom:0.5rem;">✅ Link berhasil dibuat!</p>
                    <div class="form-group" style="margin-bottom:0.5rem;">
                        <label>URL Link</label>
                        <div class="copy-container">
                            <input type="text" class="form-control" value="${data.data.url}" id="linkUrl" readonly>
                            <button class="btn btn-outline btn-sm copy-btn" onclick="copyText('linkUrl')">📋 Copy</button>
                        </div>
                    </div>
                    <div class="form-group" style="margin-bottom:0.5rem;">
                        <label>Pesan WhatsApp</label>
                        <textarea class="form-control" id="waMsg" rows="5" readonly style="font-size:0.75rem;">${data.data.wa_message}</textarea>
                        <button class="btn btn-success btn-sm btn-block" style="margin-top:0.5rem;" onclick="copyText('waMsg')">📋 Copy Pesan WA</button>
                    </div>
                    <p class="text-xs text-muted">Berlaku hingga: ${formatDateTime(data.data.expired_at)}</p>
                </div>
            `;
            showToast(data.message, 'success');
        } else {
            showToast(data.error, 'error');
        }
    } catch { showToast('Gagal generate link.', 'error'); }
}

function copyText(inputId) {
    const el = document.getElementById(inputId);
    el.select();
    navigator.clipboard.writeText(el.value).then(() => showToast('Berhasil disalin!', 'success'));
}

// ============ PAGE: APPROVAL ============
async function loadApproval() {
    const el = document.getElementById('pageContent');
    el.innerHTML = '<div class="page-loading"><div class="loading-spinner" style="width:40px;height:40px;border-width:3px;"></div></div>';

    try {
        const res = await fetch('/api/update-request');
        const data = await res.json();

        const pending = data.data.filter(r => r.status === 'PENDING');
        const processed = data.data.filter(r => r.status !== 'PENDING');

        el.innerHTML = `
            <div class="animate-fadeIn">
                <div class="tab-nav">
                    <button class="tab-btn active" onclick="switchApprovalTab('pending', this)">Menunggu (${pending.length})</button>
                    <button class="tab-btn" onclick="switchApprovalTab('processed', this)">Selesai (${processed.length})</button>
                </div>

                <div id="approvalPending">
                    ${pending.length > 0 ? pending.map(r => renderApprovalCard(r)).join('') :
                    '<div class="empty-state"><div class="empty-icon">✅</div><p>Tidak ada pengajuan yang menunggu.</p></div>'}
                </div>

                <div id="approvalProcessed" style="display:none;">
                    ${processed.length > 0 ? processed.map(r => renderApprovalCard(r, true)).join('') :
                    '<div class="empty-state"><p>Belum ada riwayat.</p></div>'}
                </div>
            </div>
        `;
    } catch { el.innerHTML = '<div class="empty-state"><p>Gagal memuat data approval.</p></div>'; }
}

function switchApprovalTab(tab, btn) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('approvalPending').style.display = tab === 'pending' ? 'block' : 'none';
    document.getElementById('approvalProcessed').style.display = tab === 'processed' ? 'block' : 'none';
}

function renderApprovalCard(r, isProcessed = false) {
    const fields = ['nama_lengkap','tempat_lahir','tanggal_lahir','jenis_kelamin','agama','status_perkawinan','pendidikan_terakhir','pekerjaan','no_hp','hubungan_keluarga','status_tinggal'];
    const labels = { nama_lengkap:'Nama', tempat_lahir:'Tempat Lahir', tanggal_lahir:'Tgl Lahir', jenis_kelamin:'L/P', agama:'Agama', status_perkawinan:'Status Kawin', pendidikan_terakhir:'Pendidikan', pekerjaan:'Pekerjaan', no_hp:'No HP', hubungan_keluarga:'Hub. Keluarga', status_tinggal:'Status Tinggal' };

    const changedFields = fields.filter(f => {
        const oldVal = r.data_lama[f] || '';
        const newVal = r.data_baru[f] || '';
        return oldVal !== newVal;
    });

    return `
        <div class="card" style="margin-bottom:1rem;">
            <div class="d-flex justify-between items-center" style="margin-bottom:1rem;">
                <div>
                    <div class="fw-700">${escapeHtml(r.nama_lengkap)} <span class="text-sm text-muted">(${r.blok}/${r.nomor_rumah})</span></div>
                    <div class="text-xs text-muted">${formatDateTime(r.created_at)}</div>
                </div>
                <span class="badge ${r.status === 'PENDING' ? 'badge-warning' : r.status === 'APPROVED' ? 'badge-success' : 'badge-danger'}">${r.status}</span>
            </div>

            <div class="comparison-grid">
                <div class="comparison-col old">
                    <h4>📄 Data Lama</h4>
                    ${changedFields.map(f => `
                        <div class="compare-row ${r.data_lama[f] !== r.data_baru[f] ? 'changed' : ''}">
                            <span class="label">${labels[f]}</span>
                            <span class="value">${r.data_lama[f] || '-'}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="comparison-col new">
                    <h4>✨ Data Baru</h4>
                    ${changedFields.map(f => `
                        <div class="compare-row ${r.data_lama[f] !== r.data_baru[f] ? 'changed' : ''}">
                            <span class="label">${labels[f]}</span>
                            <span class="value">${r.data_baru[f] || '-'}</span>
                        </div>
                    `).join('')}
                </div>
            </div>

            ${!isProcessed ? `
                <div style="margin-top:1rem;display:flex;gap:0.75rem;align-items:end;">
                    <div style="flex:1;">
                        <label class="text-xs text-muted" style="display:block;margin-bottom:0.25rem;">Catatan (wajib untuk reject)</label>
                        <input type="text" class="form-control" id="approvalNote_${r.id}" placeholder="Catatan admin...">
                    </div>
                    <button class="btn btn-success btn-sm" onclick="approveRequest(${r.id})">✅ Approve</button>
                    <button class="btn btn-danger btn-sm" onclick="rejectRequest(${r.id})">❌ Reject</button>
                </div>
            ` : (r.catatan_admin ? `<div class="text-sm text-muted" style="margin-top:0.75rem;">💬 ${escapeHtml(r.catatan_admin)}</div>` : '')}
        </div>
    `;
}

async function approveRequest(id) {
    const catatan = document.getElementById(`approvalNote_${id}`).value;
    try {
        const res = await fetch(`/api/update-request/${id}/approve`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ catatan_admin: catatan }) });
        const data = await res.json();
        if (res.ok) { showToast(data.message, 'success'); loadApproval(); }
        else showToast(data.error, 'error');
    } catch { showToast('Gagal approve.', 'error'); }
}

async function rejectRequest(id) {
    const catatan = document.getElementById(`approvalNote_${id}`).value;
    if (!catatan) { showToast('Catatan wajib diisi untuk penolakan.', 'warning'); return; }
    try {
        const res = await fetch(`/api/update-request/${id}/reject`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ catatan_admin: catatan }) });
        const data = await res.json();
        if (res.ok) { showToast(data.message, 'success'); loadApproval(); }
        else showToast(data.error, 'error');
    } catch { showToast('Gagal reject.', 'error'); }
}

// ============ PAGE: EXPORT ============
function loadExport() {
    document.getElementById('pageContent').innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;" class="animate-fadeIn">
            <div class="card">
                <div class="card-header"><h3 class="card-title">📊 Export Excel (.xlsx)</h3></div>
                <p class="text-sm text-muted" style="margin-bottom:1rem;">
                    Tabel datar (flat table) yang menggabungkan data Rumah, KK, dan Anggota. File dapat dibuka di Microsoft Excel atau Google Sheets.
                </p>
                <div class="form-group">
                    <label>Filter Blok</label>
                    <select class="form-control" id="exportExcelBlok">
                        ${blokOptions()}
                    </select>
                </div>
                <div class="form-group">
                    <label>Filter Status</label>
                    <select class="form-control" id="exportExcelStatus">
                        <option value="">Semua</option>
                        <option value="AKTIF" selected>Aktif</option>
                        <option value="TIDAK_AKTIF">Tidak Aktif</option>
                    </select>
                </div>
                <button class="btn btn-success btn-block btn-lg" onclick="exportExcel()">
                    📥 Download Excel
                </button>
            </div>

            <div class="card">
                <div class="card-header"><h3 class="card-title">📄 Export PDF</h3></div>
                <p class="text-sm text-muted" style="margin-bottom:1rem;">
                    Rekapitulasi data dengan Kop Surat RT.02 otomatis. Cocok untuk arsip cetak dan laporan resmi.
                </p>
                <div class="form-group">
                    <label>Filter Blok</label>
                    <select class="form-control" id="exportPdfBlok">
                        ${blokOptions()}
                    </select>
                </div>
                <div class="form-group">
                    <label>Filter Status</label>
                    <select class="form-control" id="exportPdfStatus">
                        <option value="">Semua</option>
                        <option value="AKTIF" selected>Aktif</option>
                        <option value="TIDAK_AKTIF">Tidak Aktif</option>
                    </select>
                </div>
                <button class="btn btn-primary btn-block btn-lg" onclick="exportPdf()">
                    📥 Download PDF
                </button>
            </div>
        </div>
    `;
}

function exportExcel() {
    const blok = document.getElementById('exportExcelBlok').value;
    const status = document.getElementById('exportExcelStatus').value;
    const params = new URLSearchParams();
    if (blok) params.append('blok', blok);
    if (status) params.append('status', status);
    window.open(`/api/export/excel?${params.toString()}`, '_blank');
    showToast('Download Excel dimulai...', 'success');
}

function exportPdf() {
    const blok = document.getElementById('exportPdfBlok').value;
    const status = document.getElementById('exportPdfStatus').value;
    const params = new URLSearchParams();
    if (blok) params.append('blok', blok);
    if (status) params.append('status', status);
    window.open(`/api/export/pdf?${params.toString()}`, '_blank');
    showToast('Download PDF dimulai...', 'success');
}

// ============ BROWSER HISTORY ============
window.addEventListener('popstate', () => {
    const path = window.location.pathname.replace('/admin/', '').replace('/admin', '');
    if (path && path !== '/') navigateTo(path);
});
