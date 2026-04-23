import axios from 'axios';

const ENGINE_URL = process.env.ENGINE_URL || 'http://engine:8000';

export const engineClient = axios.create({
    baseURL: ENGINE_URL,
    timeout: 60000,
});

export default engineClient;