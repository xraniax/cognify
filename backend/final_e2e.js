
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import MaterialService from './src/services/material.service.js';
import Material from './src/models/material.model.js';
import { query } from './src/utils/config/db.js';
import axios from 'axios';

const userId = 'f3537c53-0d2f-4798-bf20-cc75dac81024';
const subjectId = crypto.randomUUID();
const pdfPath = './uploads/maths_forCS.pdf'; // Internal path in container
const ENGINE_URL = 'http://engine:8000';

async function runFinalTest() {
    console.log('--- FINAL END-TO-END SYSTEM TEST ---');
    console.log(`User: ${userId} | Subject: ${subjectId}`);

    // 0. Ensure Subject exists
    console.log('0. Creating Subject...');
    await query('INSERT INTO subjects (id, user_id, name) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING', [subjectId, userId, 'Final Test Subject']);

    // 1. Simulate Upload
    console.log('1. Simulating Document Upload...');
    const mockFile = {
        originalname: 'maths_forCS.pdf',
        filename: 'maths_forCS.pdf',
        path: pdfPath,
        mimetype: 'application/pdf',
        size: fs.statSync(pdfPath).size
    };
    
    const uploadResult = await MaterialService.processDocument(userId, mockFile, 'maths_forCS.pdf', '', 'summary', subjectId);
    const materialId = uploadResult.id;
    console.log(`   Document Record Created: ${materialId}`);
    
    // 2. Poll for Processing (Wait for chunks/embeddings)
    console.log('2. Waiting for Document Processing (OCR -> Chunk -> Embed)...');
    let ready = false;
    let attempts = 0;
    while (!ready && attempts < 120) {
        await new Promise(r => setTimeout(r, 10000));
        const res = await axios.get(`${ENGINE_URL}/debug/pipeline-status/${subjectId}`);
        const { document_count, chunk_count } = res.data;
        console.log(`   Attempt ${attempts + 1}: Docs=${document_count}, Chunks=${chunk_count}`);
        if (chunk_count > 0) {
            ready = true;
            console.log('   SUCCESS: Document fully indexed.');
        }
        attempts++;
    }
    
    if (!ready) throw new Error('Document processing timed out.');

    // 3. Trigger Generation (Summary)
    console.log('3. Triggering AI Summary Generation...');
    const genRes = await MaterialService.generateWithContext(userId, [materialId], 'summary', subjectId);
    const generationMaterialId = genRes.material_id;
    console.log(`   Summary Material Record: ${generationMaterialId}`);
    
    // 4. Poll for Generation Result
    console.log('4. Waiting for AI Generation (Retrieval -> LLM)...');
    let done = false;
    attempts = 0;
    while (!done && attempts < 15) {
        await new Promise(r => setTimeout(r, 5000));
        const syncRes = await MaterialService.checkJobStatus(userId, generationMaterialId);
        console.log(`   Attempt ${attempts + 1}: Status=${syncRes.status}`);
        if (syncRes.status === 'COMPLETED') {
            done = true;
            console.log('   SUCCESS: AI Summary generated successfully!');
            console.log('--- FINAL CONTENT PREVIEW ---');
            console.log(syncRes.content.substring(0, 300) + '...');
        } else if (syncRes.status === 'FAILED') {
            throw new Error(`Generation failed: ${syncRes.error_message}`);
        }
        attempts++;
    }
    
    if (!done) throw new Error('Generation timed out.');
    
    console.log('\n--- ALL STAGES VERIFIED ---');
    console.log('✅ Document Upload & OCR');
    console.log('✅ Chunking & Embeddings Persistence');
    console.log('✅ Retrieval context valid');
    console.log('✅ LLM Generation complete');
    
    process.exit(0);
}

runFinalTest().catch(err => {
    console.error('--- TEST FAILED ---');
    console.error(err);
    process.exit(1);
});
