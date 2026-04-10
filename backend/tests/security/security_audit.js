import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';

async function register(name, email, password) {
    await axios.post(`${API_BASE}/auth/register`, { name, email, password });
    const res = await axios.post(`${API_BASE}/auth/login`, { email, password });
    return res.data.data.token;
}

async function runSecurityAudit() {
    console.log('--- 🕵️‍♂️ Starting Cognify Security Audit ---');

    try {
        // 1. Setup Users
        console.log('\n[1. Setup] Creating User A and User B...');
        const tokenA = await register('User A', `a_${Date.now()}@example.com`, 'Pass123!');
        const tokenB = await register('User B', `b_${Date.now()}@example.com`, 'Pass123!');
        const headA = { headers: { Authorization: `Bearer ${tokenA}` } };
        const headB = { headers: { Authorization: `Bearer ${tokenB}` } };

        // 2. IDOR TESTING
        console.log('\n[2. IDOR Testing]');
        
        // User A creates a subject
        const subRes = await axios.post(`${API_BASE}/subjects`, { name: 'A Secret Subject' }, headA);
        const subjId = subRes.data.data.id;
        console.log(`User A created subject: ${subjId}`);

        // User B attempts to access User A's subject
        console.log('Case: User B attempts to GET User A\'s subject');
        try {
            await axios.get(`${API_BASE}/subjects/${subjId}`, headB);
            console.log('❌ VULNERABILITY: User B successfully accessed User A\'s subject!');
        } catch (e) {
            console.log(`✅ Access Rejected: ${e.response?.status} (${e.response?.data?.message})`);
        }

        // User B attempts to DELETE User A's subject
        console.log('Case: User B attempts to DELETE User A\'s subject');
        try {
            await axios.delete(`${API_BASE}/subjects/${subjId}`, headB);
            console.log('❌ VULNERABILITY: User B successfully deleted User A\'s subject!');
        } catch (e) {
            console.log(`✅ Delete Rejected: ${e.response?.status} (${e.response?.data?.message})`);
        }

        // 3. UNAUTHORIZED ACCESS
        console.log('\n[3. Unauthorized Access]');
        
        console.log('Case: Fetch history with no token');
        try {
            await axios.get(`${API_BASE}/materials/history`);
            console.log('❌ VULNERABILITY: Accessed history without token!');
        } catch (e) {
            console.log(`✅ Access Rejected: ${e.response?.status}`);
        }

        console.log('Case: Fetch history with invalid token');
        try {
            await axios.get(`${API_BASE}/materials/history`, { headers: { Authorization: 'Bearer invalid.token.here' } });
            console.log('❌ VULNERABILITY: Accessed history with invalid token!');
        } catch (e) {
            console.log(`✅ Access Rejected: ${e.response?.status}`);
        }

        // 4. SQL INJECTION ATTEMPTS
        console.log('\n[4. SQL Injection]');
        
        console.log('Case: SQL Injection in Subject Name');
        try {
            const malRes = await axios.post(`${API_BASE}/subjects`, { 
                name: "Subject' OR '1'='1" 
            }, headA);
            console.log(`✅ Sanitized input created: "${malRes.data.data.name}"`);
        } catch (e) {
            console.log(`ℹ️ Request failed (expected if filtered): ${e.response?.status}`);
        }

        console.log('\n--- 🏁 Security Audit Complete ---');

    } catch (error) {
        console.error('\n❌ Audit execution failed!');
        console.error('Error Details:', error.response?.data || error.message);
        process.exit(1);
    }
}

runSecurityAudit();
