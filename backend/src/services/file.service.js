import { query } from '../utils/config/db.js';
import DriveService from './drive.service.js';

class FileService {
    static async getFile(documentId) {
        const result = await query(
            `SELECT f.path, f.mime_type, f.original_name, f.user_id, f.drive_file_id
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
                if (record.drive_file_id) {
                    if (!DriveService.isInitialized) {
                        throw new Error('Drive integration not initialized');
                    }
                    return await DriveService.getFileStream(record.drive_file_id);
                }
                return null;
            }
        };
    }
}

export default FileService;
