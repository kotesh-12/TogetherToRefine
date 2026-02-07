const net = require('net');

const client = new net.Socket();
const port = 3306;
const host = '127.0.0.1';

console.log(`Checking connection to MySQL on ${host}:${port}...`);

client.connect(port, host, function () {
    console.log('✅ Connected to MySQL Port 3306!');
    console.log('   The MySQL Service is RUNNING.');
    client.destroy();
});

client.on('error', function (err) {
    console.error('❌ Connection Failed:', err.message);
    if (err.code === 'ECONNREFUSED') {
        console.error('   The MySQL Service is NOT running or firewalled.');
        console.error('   Try starting "MySQL80" in task manager or reboot.');
    }
});

client.on('close', function () {
    console.log('Connection closed');
});
