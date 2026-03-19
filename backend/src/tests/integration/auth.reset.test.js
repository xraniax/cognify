import request from 'supertest';
import { jest } from '@jest/globals';

// --- Mocks ---
const mockUserMethods = {
    findByEmail: jest.fn(),
    createResetToken: jest.fn(),
    findByResetToken: jest.fn(),
    updatePassword: jest.fn(),
    clearResetToken: jest.fn(),
};

jest.unstable_mockModule('../../models/user.model.js', () => ({
    default: mockUserMethods,
}));

const mockSendEmail = jest.fn();
jest.unstable_mockModule('../../utils/services/email.service.js', () => ({
    sendEmail: mockSendEmail,
    default: mockSendEmail,
}));

// --- Imports after mocks ---
const { default: app } = await import('../../app.js');
const User = (await import('../../models/user.model.js')).default;
const { sendEmail } = await import('../../utils/services/email.service.js');

describe('Password Reset Integration Tests', () => {
    const mockEmail = 'test@example.com';
    const mockToken = 'valid-token';
    const mockUser = { id: 1, email: mockEmail };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /auth/forgot-password', () => {
        it('should return 200 and generic message even if user not found', async () => {
            User.findByEmail.mockResolvedValue(null);

            const res = await request(app)
                .post('/api/auth/forgot-password')
                .send({ email: 'nonexistent@example.com' });

            expect(res.status).toBe(200);
            expect(res.body.message).toContain('If an account exists');
            expect(User.createResetToken).not.toHaveBeenCalled();
        });

        it('should generate token and send email if user exists', async () => {
            User.findByEmail.mockResolvedValue(mockUser);
            User.createResetToken.mockResolvedValue(mockToken);
            sendEmail.mockResolvedValue(true);

            const res = await request(app)
                .post('/api/auth/forgot-password')
                .send({ email: mockEmail });

            expect(res.status).toBe(200);
            expect(User.createResetToken).toHaveBeenCalledWith(mockUser.id);
            expect(sendEmail).toHaveBeenCalled();
        });
    });

    describe('GET /auth/reset-password/:token', () => {
        it('should return 200 if token is valid', async () => {
            User.findByResetToken.mockResolvedValue(mockUser);

            const res = await request(app)
                .get(`/api/auth/reset-password/${mockToken}`);

            expect(res.status).toBe(200);
            expect(res.body.valid).toBe(true);
        });

        it('should return 400 if token is invalid or expired', async () => {
            User.findByResetToken.mockResolvedValue(null);

            const res = await request(app)
                .get(`/api/auth/reset-password/invalid-token`);

            expect(res.status).toBe(400);
            expect(res.body.valid).toBe(false);
        });
    });

    describe('POST /auth/reset-password', () => {
        it('should reset password with valid token and strong password', async () => {
            User.findByResetToken.mockResolvedValue(mockUser);
            User.updatePassword.mockResolvedValue(true);

            const res = await request(app)
                .post('/api/auth/reset-password')
                .send({
                    token: mockToken,
                    password: 'StrongPassword123!',
                });

            expect(res.status).toBe(200);
            expect(User.updatePassword).toHaveBeenCalledWith(mockUser.id, 'StrongPassword123!');
        });

        it('should fail if password is too weak', async () => {
            const res = await request(app)
                .post('/api/auth/reset-password')
                .send({
                    token: mockToken,
                    password: 'weak',
                });

            expect(res.status).toBe(400);
            expect(User.updatePassword).not.toHaveBeenCalled();
        });

        it('should fail if token is invalid', async () => {
            User.findByResetToken.mockResolvedValue(null);

            const res = await request(app)
                .post('/api/auth/reset-password')
                .send({
                    token: 'invalid',
                    password: 'StrongPassword123!',
                });

            expect(res.status).toBe(400);
            expect(res.body.message).toContain('invalid or has expired');
        });
    });
});
