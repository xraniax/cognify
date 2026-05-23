import { query } from '../utils/config/db.js';
import DriveService from './drive.service.js';
import engineClient from './engine.client.js';

class FileService {
    static async getFile(documentId) {
        // Use m.user_id (authoritative ownership boundary) not f.user_id (denormalized copy).
        // The platform's ownership hierarchy is user → subject → material → file.
        // All other authorization checks in the platform use materials.user_id.
        const result = await query(
            `SELECT f.path, f.mime_type, f.original_name, m.user_id AS owner_id, f.drive_file_id
             FROM files f
             JOIN materials m ON f.material_id = m.id
             WHERE m.id = $1
               AND m.deleted_at IS NULL
             LIMIT 1`,
            [documentId]
        );

        const record = result.rows[0];
        if (!record) return null;

        return {
            ...record,
            getStream: async () => {
                if (!record.drive_file_id) return null;

                // Try backend Drive credentials first if configured
                if (DriveService.isInitialized) {
                    try {
                        return await DriveService.getFileStream(record.drive_file_id);
                    } catch (driveErr) {
                        // Backend service account may not have access to files uploaded by the
                        // engine's service account — fall through to engine proxy
                        console.warn(
                            `[FileService] Backend Drive failed for ${record.drive_file_id}, ` +
                            `falling back to engine proxy: ${driveErr.message}`
                        );
                    }
                }

                // Proxy through engine which holds the upload credentials
                const response = await engineClient.get(
                    `/drive/stream/${record.drive_file_id}`,
                    { responseType: 'stream', timeout: 60000 }
                );
                return response.data;
            }
        };
    }
}

export default FileService;
