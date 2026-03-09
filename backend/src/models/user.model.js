import { query } from '../config/db.js';
import bcrypt from 'bcrypt';

// Cost factor for bcrypt key derivation. Higher = slower brute force.
// 12 rounds is a good balance of security and performance.
const BCRYPT_ROUNDS = 12;

class User {
    /**
     * Create a new user with a securely hashed password (bcrypt, salt auto-generated).
     */
    static async create(email, password, name, role = 'user') {
        const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
        const result = await query(
            'INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, $4) RETURNING id, email, name, role, created_at',
            [email, hashedPassword, name, role]
        );
        return result.rows[0];
    }

    /**
     * Find user by email for authentication
     */
    static async findByEmail(email) {
        const result = await query('SELECT * FROM users WHERE email = $1', [email]);
        return result.rows[0];
    }

    /**
     * Find user by ID for session/profile
     */
    static async findById(id) {
        const result = await query(
            'SELECT id, email, name, role, created_at FROM users WHERE id = $1',
            [id]
        );
        return result.rows[0];
    }

    /**
     * Compare provided password with stored hash
     */
    static async comparePassword(password, hashedPassword) {
        return bcrypt.compare(password, hashedPassword);
    }
}

export default User;
