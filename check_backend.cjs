const fetch = require('node-fetch');

async function test() {
    try {
        const res = await fetch('http://localhost:5000/api/batch-register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ students: [{ name: 'Test', email: 'test@gmail.com' }] })
        });
        console.log(res.status, res.statusText);
        const text = await res.text();
        console.log('Response body:', text);
    } catch (e) {
        console.error(e);
    }
}

test();
