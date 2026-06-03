import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';

import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

const mockUsersService: jest.Mocked<Pick<UsersService, 'findByEmail' | 'create'>> = {
  findByEmail: jest.fn(),
  create: jest.fn(),
};

const mockJwtService: jest.Mocked<Pick<JwtService, 'sign'>> = {
  sign: jest.fn().mockReturnValue('signed-token'),
};

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    authService = module.get(AuthService);
    jest.clearAllMocks();
    mockJwtService.sign.mockReturnValue('signed-token');
  });

  describe('register', () => {
    it('throws ConflictException when email is already taken', async () => {
      mockUsersService.findByEmail.mockResolvedValue({
        id: 'existing-id',
        email: 'test@example.com',
        passwordHash: 'hash',
        name: 'Existing',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        authService.register({ email: 'test@example.com', name: 'Test', password: 'password123' }),
      ).rejects.toThrow(ConflictException);

      expect(mockUsersService.create).not.toHaveBeenCalled();
    });

    it('hashes the password and creates the user', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);
      mockUsersService.create.mockResolvedValue({
        id: 'new-id',
        email: 'new@example.com',
        passwordHash: 'hashed',
        name: 'New User',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await authService.register({ email: 'new@example.com', name: 'New User', password: 'password123' });

      const createCall = mockUsersService.create.mock.calls[0]?.[0];
      expect(createCall?.email).toBe('new@example.com');
      expect(createCall?.name).toBe('New User');
      expect(createCall?.passwordHash).not.toBe('password123');
      expect(await bcrypt.compare('password123', createCall?.passwordHash ?? '')).toBe(true);
    });

    it('returns an accessToken after successful registration', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);
      mockUsersService.create.mockResolvedValue({
        id: 'new-id',
        email: 'new@example.com',
        passwordHash: 'hashed',
        name: 'New User',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await authService.register({
        email: 'new@example.com',
        name: 'New User',
        password: 'password123',
      });

      expect(result).toEqual({ accessToken: 'signed-token' });
      expect(mockJwtService.sign).toHaveBeenCalledWith({ sub: 'new-id', email: 'new@example.com' });
    });
  });

  describe('login', () => {
    it('throws UnauthorizedException when user is not found', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);

      await expect(
        authService.login({ email: 'ghost@example.com', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when password is incorrect', async () => {
      const hash = await bcrypt.hash('correctpassword', 10);
      mockUsersService.findByEmail.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        passwordHash: hash,
        name: 'Test',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        authService.login({ email: 'test@example.com', password: 'wrongpassword' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('returns an accessToken on valid credentials', async () => {
      const hash = await bcrypt.hash('password123', 10);
      mockUsersService.findByEmail.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        passwordHash: hash,
        name: 'Test',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await authService.login({ email: 'test@example.com', password: 'password123' });

      expect(result).toEqual({ accessToken: 'signed-token' });
      expect(mockJwtService.sign).toHaveBeenCalledWith({ sub: 'user-id', email: 'test@example.com' });
    });
  });
});
