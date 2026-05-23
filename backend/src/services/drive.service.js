import fs from 'fs';
import { google } from 'googleapis';

class DriveService {
    constructor() {
        this.drive = null;
        this.isInitialized = false;

        try {
            if (process.env.GOOGLE_DRIVE_CREDENTIALS) {
                const credentials = JSON.parse(process.env.GOOGLE_DRIVE_CREDENTIALS);
                const auth = new google.auth.GoogleAuth({
                    credentials,
                    scopes: ['https://www.googleapis.com/auth/drive'],
                });
                this.drive = google.drive({ version: 'v3', auth });
                this.isInitialized = true;
            } else {
                console.warn('[DriveService] GOOGLE_DRIVE_CREDENTIALS not found. Google Drive integration is disabled. Proceeding with local fallback.');
            }
        } catch (error) {
            console.error('[DriveService] Failed to initialize Google Drive client:', error);
        }
    }

    async uploadFile(filePath, mimeType, originalName) {
        if (!this.isInitialized) {
            console.warn('[DriveService] Drive not initialized, skipping upload.');
            return null;
        }

        try {
            const fileMetadata = {
                name: originalName,
            };
            const media = {
                mimeType: mimeType,
                body: fs.createReadStream(filePath),
            };

            const response = await this.drive.files.create({
                requestBody: fileMetadata,
                media: media,
                fields: 'id',
                supportsAllDrives: true,
            });

            return response.data.id;
        } catch (error) {
            console.error('[DriveService] Error uploading file to Google Drive:', error);
            throw error;
        }
    }

    async getFileStream(fileId) {
        if (!this.isInitialized) {
            throw new Error('Drive client not initialized');
        }

        try {
            const response = await this.drive.files.get(
                { fileId: fileId, alt: 'media', supportsAllDrives: true },
                { responseType: 'stream' }
            );
            return response.data;
        } catch (error) {
            console.error(`[DriveService] Error getting file stream for ${fileId}:`, error);
            throw error;
        }
    }
    
    async deleteFile(fileId) {
        if (!this.isInitialized) return;
        try {
            await this.drive.files.delete({ fileId, supportsAllDrives: true });
        } catch (error) {
             console.error(`[DriveService] Error deleting file ${fileId}:`, error);
        }
    }
}

export default new DriveService();
