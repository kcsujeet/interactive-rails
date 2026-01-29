/**
 * User Repository
 * Handles all database operations for users
 */

import type { User } from '../types';
import { NotFoundError, ConflictError } from '../errors';

export interface CreateUserData {
  email: string;
  username: string;
  passwordHash: string;
}

export class UserRepository {
  constructor(private db: D1Database) {}

  async findById(id: string): Promise<User | null> {
    return this.db
      .prepare('SELECT * FROM users WHERE id = ?')
      .bind(id)
      .first<User>();
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.db
      .prepare('SELECT * FROM users WHERE email = ?')
      .bind(email)
      .first<User>();
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.db
      .prepare('SELECT * FROM users WHERE username = ?')
      .bind(username)
      .first<User>();
  }

  async findByEmailOrUsername(email: string, username: string): Promise<User | null> {
    return this.db
      .prepare('SELECT * FROM users WHERE email = ? OR username = ?')
      .bind(email, username)
      .first<User>();
  }

  async create(data: CreateUserData): Promise<User> {
    const id = crypto.randomUUID();

    // Check for existing user
    const existing = await this.findByEmailOrUsername(data.email, data.username);
    if (existing) {
      throw new ConflictError('Email or username already taken');
    }

    await this.db
      .prepare(
        'INSERT INTO users (id, email, username, password_hash) VALUES (?, ?, ?, ?)'
      )
      .bind(id, data.email, data.username, data.passwordHash)
      .run();

    const user = await this.findById(id);
    if (!user) {
      throw new Error('Failed to create user');
    }

    return user;
  }

  async getByIdOrThrow(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundError('User');
    }
    return user;
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.db
      .prepare('UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(id)
      .run();
  }
}
