const dns = require('dns');

// Test 1: default lookup
dns.lookup('db.atrhxldfitfpticzpphi.supabase.co', { all: true }, (err, addrs) => {
    console.log('dns.lookup (all):', err ? err.message : addrs);
});

// Test 2: resolve4
dns.resolve4('db.atrhxldfitfpticzpphi.supabase.co', (err, addrs) => {
    console.log('dns.resolve4:', err ? err.message : addrs);
});

// Test 3: resolve6
dns.resolve6('db.atrhxldfitfpticzpphi.supabase.co', (err, addrs) => {
    console.log('dns.resolve6:', err ? err.message : addrs);
});
