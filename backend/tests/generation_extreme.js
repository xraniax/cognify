import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';
let authToken = '';
const testEmail = `extreme_${Date.now()}@example.com`;
const password = 'Password123!';
let subjectId = '';
let materialId = '';

async function setup() {
    console.log('[Setup] Registering and creating test subject...');
    const regRes = await axios.post(`${API_BASE}/auth/register`, {
        name: 'Extreme Tester',
        email: testEmail,
        password: password
    });
    const loginRes = await axios.post(`${API_BASE}/auth/login`, {
        email: testEmail,
        password: password
    });
    authToken = loginRes.data.data.token;
    
    const subRes = await axios.post(`${API_BASE}/subjects`, {
        name: 'Stress Test Subject',
        description: 'Testing limits of generation'
    }, { headers: { Authorization: `Bearer ${authToken}` } });
    subjectId = subRes.data.data.id;

    // Upload a base document
    const upRes = await axios.post(`${API_BASE}/materials/upload`, {
        title: 'Core Context',
        content: 'Artificial Intelligence is a field of computer science. It focuses on creating systems that can perform tasks typically requiring human intelligence. This includes learning, reasoning, and problem-solving.',
        type: 'upload',
        subjectId: subjectId
    }, { headers: { Authorization: `Bearer ${authToken}` } });
    materialId = upRes.data.data.id;
    console.log(`[Setup] Done. Subject: ${subjectId}, Material: ${materialId}`);
}

async function testGenerationBurst() {
    console.log('\n[Case] Generation Burst (5 simultaneous requests)');
    const headers = { Authorization: `Bearer ${authToken}` };
    const promises = [];
    for (let i = 0; i < 5; i++) {
        promises.push(axios.post(`${API_BASE}/materials/generate-combined`, {
            materialIds: [materialId],
            taskType: 'flashcards',
            genOptions: { count: 5 }
        }, { headers }));
    }

    const results = await Promise.allSettled(promises);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    console.log(`Burst results: ${successful} Successful, ${failed} Failed`);
    
    if (failed > 0) {
        console.warn('One or more burst requests failed. Check if engine is bottlenecked.');
        results.filter(r => r.status === 'rejected').forEach(r => console.error('Error:', r.reason?.response?.data || r.reason?.message));
    }
}

async function testInvalidOptions() {
    console.log('\n[Case] Invalid Generation Options');
    const headers = { Authorization: `Bearer ${authToken}` };
    
    // Negative count
    try {
        await axios.post(`${API_BASE}/materials/generate-combined`, {
            materialIds: [materialId],
            taskType: 'quiz',
            genOptions: { count: -1 }
        }, { headers });
        console.log('❌ Error: Expected failure for negative count');
    } catch (e) {
        console.log(`✅ Correctly rejected negative count: ${e.response?.status} (${e.response?.data?.message || e.response?.data?.errors?.['genOptions.count']})`);
    }

    // Huge count
    try {
        await axios.post(`${API_BASE}/materials/generate-combined`, {
            materialIds: [materialId],
            taskType: 'flashcards',
            genOptions: { count: 1000 }
        }, { headers });
        console.log('❌ Error: Expected failure for count=1000');
    } catch (e) {
        console.log(`✅ Correctly rejected oversized count: ${e.response?.status} (${e.response?.data?.message || e.response?.data?.errors?.['genOptions.count']})`);
    }
}

async function testOversizedContent() {
    console.log('\n[Case] Oversized Content Generation');
    const headers = { Authorization: `Bearer ${authToken}` };
    const hugeContent = 'This is a test word. '.repeat(5000); // ~50,000 characters
    
    const upRes = await axios.post(`${API_BASE}/materials/upload`, {
        title: 'Huge Doc',
        content: hugeContent,
        type: 'upload',
        subjectId: subjectId
    }, { headers });
    const hugeMatId = upRes.data.data.id;

    const genRes = await axios.post(`${API_BASE}/materials/generate-combined`, {
        materialIds: [hugeMatId],
        taskType: 'quiz'
    }, { headers });
    console.log(`✅ Triggered generation for huge doc (Job: ${genRes.data.data.job_id})`);
}

async function run() {
    try {
        await setup();
        await testGenerationBurst();
        await testInvalidOptions();
        await testOversizedContent();
        console.log('\n--- 🏁 Backend Extreme Tests Complete ---');
    } catch (error) {
        console.error('Test Suite Failed:', error.response?.data || error.message);
        process.exit(1);
    }
}

run();
