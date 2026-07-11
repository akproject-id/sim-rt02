/**
 * E2E Test: Verify SIM-RT.02 works with Supabase PostgreSQL
 * Tests: Login → Dashboard → Rumah → KK → Warga → Search
 */
const http = require('http');

const BASE = 'http://localhost:3000';
let sessionCookie = '';
let passed = 0;
let failed = 0;

function request(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(sessionCookie ? { 'Cookie': sessionCookie } : {})
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                // Capture session cookie
                const setCookie = res.headers['set-cookie'];
                if (setCookie) {
                    sessionCookie = setCookie.map(c => c.split(';')[0]).join('; ');
                }
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(data), raw: data });
                } catch {
                    resolve({ status: res.statusCode, body: null, raw: data });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

function test(name, condition) {
    if (condition) {
        console.log(`  ✅ ${name}`);
        passed++;
    } else {
        console.log(`  ❌ ${name}`);
        failed++;
    }
}

async function runTests() {
    console.log('\n🧪 SIM-RT.02 E2E Test — Supabase PostgreSQL\n');
    console.log('='.repeat(50));

    // 1. Login
    console.log('\n📌 1. Login');
    try {
        const login = await request('POST', '/api/auth/login', {
            username: 'admin',
            password: 'admin123'
        });
        test('Login returns 200', login.status === 200);
        test('Login returns success', login.body && login.body.message);
        test('Session cookie set', sessionCookie.length > 0);
    } catch (e) {
        test('Login request', false);
        console.log('    Error:', e.message);
    }

    // 2. Dashboard Stats
    console.log('\n📌 2. Dashboard Stats');
    try {
        const stats = await request('GET', '/api/dashboard/stats');
        test('Dashboard returns 200', stats.status === 200);
        test('Has totalKK', stats.body && typeof stats.body.totalKK === 'number');
        test('Has totalJiwa', stats.body && typeof stats.body.totalJiwa === 'number');
        test('Has totalRumah', stats.body && typeof stats.body.totalRumah === 'number');
        test('Has wargaPerBlok', stats.body && Array.isArray(stats.body.wargaPerBlok));
        test('Has recentWarga', stats.body && Array.isArray(stats.body.recentWarga));
        if (stats.body) {
            console.log(`    📊 KK: ${stats.body.totalKK}, Jiwa: ${stats.body.totalJiwa}, Rumah: ${stats.body.totalRumah}`);
        }
    } catch (e) {
        test('Dashboard request', false);
        console.log('    Error:', e.message);
    }

    // 3. List Rumah
    console.log('\n📌 3. List Rumah');
    try {
        const rumah = await request('GET', '/api/rumah');
        test('Rumah returns 200', rumah.status === 200);
        test('Returns array', Array.isArray(rumah.body));
        if (Array.isArray(rumah.body) && rumah.body.length > 0) {
            test('Rumah has blok field', 'blok' in rumah.body[0]);
            test('Rumah has nomor_rumah field', 'nomor_rumah' in rumah.body[0]);
            console.log(`    🏠 Total rumah: ${rumah.body.length}`);
        }
    } catch (e) {
        test('Rumah request', false);
        console.log('    Error:', e.message);
    }

    // 4. List KK
    console.log('\n📌 4. List Kepala Keluarga');
    try {
        const kk = await request('GET', '/api/kk');
        test('KK returns 200', kk.status === 200);
        const kkData = Array.isArray(kk.body) ? kk.body : (kk.body && kk.body.data ? kk.body.data : null);
        test('Returns data', kkData !== null);
        if (kkData && kkData.length > 0) {
            test('KK has nama_kepala', 'nama_kepala' in kkData[0]);
            console.log(`    👨‍👩‍👧‍👦 Total KK: ${kkData.length}`);
        }
    } catch (e) {
        test('KK request', false);
        console.log('    Error:', e.message);
    }

    // 5. List Warga
    console.log('\n📌 5. List Warga');
    try {
        const warga = await request('GET', '/api/warga');
        test('Warga returns 200', warga.status === 200);
        const wargaData = Array.isArray(warga.body) ? warga.body : (warga.body && warga.body.data ? warga.body.data : null);
        test('Returns data', wargaData !== null);
        if (wargaData && wargaData.length > 0) {
            test('Warga has nama_lengkap', 'nama_lengkap' in wargaData[0]);
            test('Warga has nik', 'nik' in wargaData[0]);
            console.log(`    👤 Total warga: ${wargaData.length}`);
        }
    } catch (e) {
        test('Warga request', false);
        console.log('    Error:', e.message);
    }

    // 6. Smart Search
    console.log('\n📌 6. Smart Search');
    try {
        const search = await request('GET', '/api/search?q=Ahmad');
        test('Search returns 200', search.status === 200);
        test('Search returns results', search.body && (Array.isArray(search.body) || search.body.results));
    } catch (e) {
        test('Search request', false);
        console.log('    Error:', e.message);
    }

    // 7. Update Requests
    console.log('\n📌 7. Update Requests');
    try {
        const updates = await request('GET', '/api/update-request');
        test('Update-request returns 200', updates.status === 200);
    } catch (e) {
        test('Update-request', false);
        console.log('    Error:', e.message);
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log(`\n📋 Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
    if (failed === 0) {
        console.log('🎉 All tests PASSED! Supabase connection is working correctly.\n');
    } else {
        console.log('⚠️  Some tests failed. Check the output above.\n');
    }

    process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
