import request from 'supertest';
import { jest } from '@jest/globals';

// --- Mocks ---
const mockUserMethods = {
    findByEmail: jest.fn(),
    create: jest.fn(),
};

jest.unstable_mockModule('../../models/user.model.js', () => ({
    default: mockUserMethods,
}));

// --- Imports after mocks ---
const { default: app } = await import('../../app.js');
const User = (await import('../../models/user.model.js')).default;

describe('Registration Integration Tests', () => {
    const mockUserData = {
        email: 'newuser@example.com',
        password: 'StrongPassword123!',
        name: 'New User',
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /auth/register', () => {
        it('should successfully register a new user with valid data', async () => {
            User.findByEmail.mockResolvedValue(null);
            User.create.mockResolvedValue({
                id: '123',
                ...mockUserData,
            });

            const res = await request(app)
                .post('/api/auth/register')
                .send(mockUserData);

            expect(res.status).toBe(201);
            expect(res.body.status).toBe('success');
            expect(User.create).toHaveBeenCalled();
        });

        it('should fail if email is already registered', async () => {
            User.findByEmail.mockResolvedValue({ id: 'existing' });

            const res = await request(app)
                .post('/api/auth/register')
                .send(mockUserData);

            expect(res.status).toBe(400);
            expect(res.body.message).toBe('Email already registered');
        });

        it('should fail if password does not meet security requirements', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    ...mockUserData,
                    password: 'weak',
                });

            expect(res.status).toBe(400);
            expect(res.body.errors.password).toContain('at least 8 characters');
        });

        it('should fail if email format is invalid', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    ...mockUserData,
                    email: 'not-an-email',
                });

            expect(res.status).toBe(400);
            expect(res.body.errors.email).toContain('Invalid email');
        });
    });
});
