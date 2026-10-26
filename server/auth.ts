/**
 * YBGP Loyalty - Server Authentication & RBAC Middleware
 * Enforces session tokens, tenant isolation, and strict role permissions.
 * Never trusts role, business ID, or staff ID supplied by client.
 */

import { Request, Response, NextFunction } from 'express';
import { ServerDatabase } from './db';
import { generateRandomToken, hashSha256, generateId, verifyPassword } from './security';
import { User, UserRole } from '../src/types';

export interface AuthenticatedRequest extends Request {
  user?: User;
  sessionId?: string;
  businessId?: string;
  customerSession?: {
    customerId: string;
    businessId: string;
  };
}

export class AuthService {
  private db: ServerDatabase;

  constructor(db: ServerDatabase) {
    this.db = db;
  }

  /**
   * Authenticate user with verified email and password hash
   * Computationally expensive scrypt verification, constant-time comparison
   */
  public authenticateWithPassword(
    email: string,
    password: string,
    ipAddress?: string,
    userAgent?: string
  ): { token: string; expiresAt: string; user: User } {
    if (!email || !password) {
      throw new Error('Email and password are required.');
    }

    const row = this.db.queryOne<{
      id: string;
      name: string;
      email: string;
      phone: string;
      role: UserRole;
      businessId: string | null;
      passwordHash: string | null;
      passwordSalt: string | null;
      accountStatus: string;
    }>(
      `SELECT id, name, email, phone, role, business_id as businessId,
              password_hash as passwordHash, password_salt as passwordSalt,
              account_status as accountStatus
       FROM users
       WHERE lower(email) = lower(?);`,
      [email.trim()]
    );

    if (!row) {
      throw new Error('Invalid email or password.');
    }

    if (row.accountStatus && row.accountStatus !== 'active') {
      throw new Error('Account is suspended or deactivated. Contact platform support.');
    }

    if (!row.passwordHash || !row.passwordSalt) {
      throw new Error('Account password credentials not configured. Please contact administrator.');
    }

    const isValid = verifyPassword(password, row.passwordSalt, row.passwordHash);
    if (!isValid) {
      throw new Error('Invalid email or password.');
    }

    // If user belongs to a business, check that the business is not suspended
    if (row.businessId && row.role !== 'platform_admin') {
      const biz = this.db.queryOne<{ status: string }>('SELECT status FROM businesses WHERE id = ?;', [row.businessId]);
      if (biz && biz.status === 'suspended') {
        throw new Error('This business account is currently suspended. Please contact YBGP billing support.');
      }
    }

    return this.createSession(row.id, ipAddress, userAgent);
  }

  /**
   * Create authenticated session for merchant/admin user
   */
  public createSession(userId: string, ipAddress?: string, userAgent?: string): { token: string; expiresAt: string; user: User } {
    const user = this.db.queryOne<User & { accountStatus?: string }>(
      'SELECT id, name, email, phone, role, business_id as businessId, account_status as accountStatus, created_at as createdAt FROM users WHERE id = ?;',
      [userId]
    );
    if (!user) {
      throw new Error('User not found.');
    }

    if (user.accountStatus && user.accountStatus !== 'active') {
      throw new Error('User account is not active.');
    }

    const rawToken = generateRandomToken(32);
    const tokenHash = hashSha256(rawToken);
    const sessionId = generateId('sess');
    // Session expires in 7 days
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    this.db.execute(
      `INSERT INTO sessions (id, token_hash, user_id, business_id, role, ip_address, user_agent, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [sessionId, tokenHash, user.id, user.businessId || null, user.role, ipAddress || null, userAgent || null, expiresAt]
    );

    return {
      token: rawToken,
      expiresAt,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        businessId: user.businessId,
        createdAt: user.createdAt,
      },
    };
  }

  /**
   * Revoke single session by ID
   */
  public revokeSession(sessionId: string): void {
    this.db.execute('DELETE FROM sessions WHERE id = ?;', [sessionId]);
  }

  /**
   * Revoke all sessions for a user
   */
  public revokeAllUserSessions(userId: string): void {
    this.db.execute('DELETE FROM sessions WHERE user_id = ?;', [userId]);
  }

  /**
   * Validate session token from Authorization: Bearer <token>
   */
  public validateSession(rawToken: string): { user: User; businessId?: string; sessionId: string } | null {
    if (!rawToken) return null;
    const tokenHash = hashSha256(rawToken);

    const row = this.db.queryOne<{
      sessionId: string;
      userId: string;
      name: string;
      email: string;
      phone: string;
      role: UserRole;
      businessId: string;
      expiresAt: string;
      accountStatus: string;
    }>(
      `SELECT s.id as sessionId, s.business_id as businessId, s.expires_at as expiresAt,
              u.id as userId, u.name, u.email, u.phone, u.role, u.account_status as accountStatus
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.token_hash = ? AND s.expires_at > CURRENT_TIMESTAMP;`,
      [tokenHash]
    );

    if (!row) return null;

    if (row.accountStatus && row.accountStatus !== 'active') {
      return null;
    }

    const user: User = {
      id: row.userId,
      name: row.name,
      email: row.email,
      phone: row.phone,
      role: row.role,
      businessId: row.businessId,
      createdAt: '',
    };

    return { user, businessId: row.businessId, sessionId: row.sessionId };
  }

  /**
   * Create secure session for customer after OTP verification
   */
  public createCustomerSession(customerId: string, businessId: string): { sessionToken: string; expiresAt: string } {
    const rawToken = generateRandomToken(32);
    const tokenHash = hashSha256(rawToken);
    const sessionId = generateId('csess');
    // Customer pass access session valid for 30 days
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    this.db.execute(
      `INSERT INTO customer_sessions (id, session_token_hash, customer_id, business_id, expires_at)
       VALUES (?, ?, ?, ?, ?);`,
      [sessionId, tokenHash, customerId, businessId, expiresAt]
    );

    return { sessionToken: rawToken, expiresAt };
  }

  /**
   * Validate customer session token
   */
  public validateCustomerSession(rawToken: string): { customerId: string; businessId: string } | null {
    if (!rawToken) return null;
    const tokenHash = hashSha256(rawToken);

    const row = this.db.queryOne<{
      customerId: string;
      businessId: string;
    }>(
      `SELECT customer_id as customerId, business_id as businessId
       FROM customer_sessions
       WHERE session_token_hash = ? AND expires_at > CURRENT_TIMESTAMP;`,
      [tokenHash]
    );

    return row || null;
  }
}

/**
 * Express Middleware: Require Authenticated Merchant or Admin
 * In production mode: STRICTLY enforces Bearer session tokens.
 * In development/test mode: Demo headers are ignored unless explicitly permitted in dev.
 */
export function requireAuth(authService: AuthService) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // In production mode, reject immediately with 401. Never trust x-ybgp-user-id in production!
      if (process.env.NODE_ENV === 'production') {
        res.status(401).json({ error: 'Unauthorized: Valid authentication session token required.' });
        return;
      }

      // In development mode only, check if dev bypass is explicitly allowed
      const demoUserId = req.headers['x-ybgp-user-id'] as string;
      if (process.env.ALLOW_DEV_AUTH_BYPASS === 'true' && demoUserId) {
        const user = authService['db'].queryOne<User>(
          'SELECT id, name, email, phone, role, business_id as businessId, created_at as createdAt FROM users WHERE id = ?;',
          [demoUserId]
        );
        if (user) {
          req.user = user;
          req.businessId = user.businessId;
          return next();
        }
      }

      res.status(401).json({ error: 'Unauthorized: Authentication required.' });
      return;
    }

    const token = authHeader.slice(7).trim();
    const session = authService.validateSession(token);
    if (!session) {
      res.status(401).json({ error: 'Unauthorized: Invalid or expired session.' });
      return;
    }

    req.user = session.user;
    req.businessId = session.businessId;
    req.sessionId = session.sessionId;
    next();
  };
}

/**
 * Express Middleware: Require specific user role
 */
export function requireRole(allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized: Login required.' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: `Permission denied: ${req.user.role} role is not authorized for this operation. Required: ${allowedRoles.join(' or ')}.`
      });
      return;
    }

    next();
  };
}

/**
 * Express Middleware: Require tenant isolation (Merchant belongs to the specified business)
 */
export function requireTenant(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized.' });
    return;
  }

  // Super admin can access any tenant
  if (req.user.role === 'platform_admin') {
    return next();
  }

  const requestedBusinessId = req.params.businessId || req.body.businessId || req.query.businessId;
  if (requestedBusinessId && req.user.businessId !== requestedBusinessId) {
    res.status(403).json({
      error: 'Security violation: Cross-tenant access denied. You are not authorized for this business.'
    });
    return;
  }

  next();
}
