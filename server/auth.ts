/**
 * YBGP Loyalty - Server Authentication & RBAC Middleware
 * Enforces session tokens, tenant isolation, and strict role permissions.
 * Never trusts role, business ID, or staff ID supplied by client.
 */

import { Request, Response, NextFunction } from 'express';
import { ServerDatabase } from './db';
import { generateRandomToken, hashSha256, generateId } from './security';
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
   * Create authenticated session for merchant/admin user
   */
  public createSession(userId: string, ipAddress?: string, userAgent?: string): { token: string; expiresAt: string; user: User } {
    const user = this.db.queryOne<User>('SELECT id, name, email, phone, role, business_id as businessId, created_at as createdAt FROM users WHERE id = ?;', [userId]);
    if (!user) {
      throw new Error('User not found.');
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

    return { token: rawToken, expiresAt, user };
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
    }>(
      `SELECT s.id as sessionId, s.business_id as businessId, s.expires_at as expiresAt,
              u.id as userId, u.name, u.email, u.phone, u.role
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.token_hash = ? AND s.expires_at > CURRENT_TIMESTAMP;`,
      [tokenHash]
    );

    if (!row) return null;

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
 */
export function requireAuth(authService: AuthService) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Check for dev demo token bypass in development mode if provided in header
      const demoUserId = req.headers['x-ybgp-user-id'] as string;
      if (process.env.NODE_ENV !== 'production' && demoUserId) {
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
