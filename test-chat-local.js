import axios from 'axios';

console.log("Testing Backend Chat Endpoint...");

async function test() {
    try {
        const res = await axios.post('http://localhost:5000/api/chat', {
            message: "Hello, are you working?",
            history: []
        });
        console.log("✅ SUCCESS! AI Replied:");
        console.log("---------------------------------------------------");
        console.log(res.data.text);
        console.log("---------------------------------------------------");
    } catch (e) {
        console.error("❌ FAILURE:");
        if (e.code === 'ECONNREFUSED') {
            console.error("Connection Refused. Server is NOT running on port 5000.");
        } else {
            console.error("Error Message:", e.message);
            if (e.response) {
                console.error("Server Response Status:", e.response.status);
                console.error("Server Response Data:", JSON.stringify(e.response.data, null, 2));
            }
        }
    }
}

test();
