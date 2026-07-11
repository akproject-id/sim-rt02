// Quick connectivity test to Supabase
const net = require('net');
const dns = require('dns').promises;

const HOST = 'aws-1-ap-southeast-2.pooler.supabase.com';
const PORT = 6543;

async function test() {
    // 1. DNS Test
    console.log(`\n🔍 Testing DNS for ${HOST}...`);
    try {
        const { address } = await dns.lookup(HOST);
        console.log(`✅ DNS OK: ${address}`);
    } catch (e) {
        console.log(`❌ DNS failed: ${e.message}`);
    }

    // 2. TCP Connection Test - Port 6543 (transaction mode)
    console.log(`\n🔌 Testing TCP to ${HOST}:6543...`);
    await tcpTest(HOST, 6543);

    // 3. TCP Connection Test - Port 5432 (session mode)
    console.log(`\n🔌 Testing TCP to ${HOST}:5432...`);
    await tcpTest(HOST, 5432);

    // 4. Test direct database host
    console.log(`\n🔌 Testing TCP to db.atrhxldfitfpticzpphi.supabase.co:5432...`);
    await tcpTest('db.atrhxldfitfpticzpphi.supabase.co', 5432);
}

function tcpTest(host, port) {
    return new Promise(resolve => {
        const socket = new net.Socket();
        socket.setTimeout(10000);

        socket.on('connect', () => {
            console.log(`✅ TCP OK: ${host}:${port} reachable`);
            socket.destroy();
            resolve(true);
        });
        socket.on('timeout', () => {
            console.log(`❌ TCP TIMEOUT: ${host}:${port} (10s)`);
            socket.destroy();
            resolve(false);
        });
        socket.on('error', (err) => {
            console.log(`❌ TCP ERROR: ${host}:${port} - ${err.message}`);
            socket.destroy();
            resolve(false);
        });

        socket.connect(port, host);
    });
}

test().then(() => {
    console.log('\n✅ Test complete');
    process.exit(0);
});
