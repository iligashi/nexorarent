import { createHash, randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { getConnection, query } from '../db/pool.js';

const refreshLifetimeMs = 7 * 24 * 60 * 60 * 1000;

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function createToken(userId) {
  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + refreshLifetimeMs);
  const token = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: '7d',
    jwtid: sessionId,
  });
  return { sessionId, token, expiresAt };
}

async function insertSession(conn, userId) {
  const session = createToken(userId);
  await conn.execute(
    'INSERT INTO refresh_token_sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)',
    [session.sessionId, userId, hashToken(session.token), session.expiresAt]
  );
  return session;
}

export async function issueRefreshToken(userId) {
  const conn = await getConnection();
  try {
    const session = await insertSession(conn, userId);
    return session.token;
  } finally {
    conn.release();
  }
}

export async function rotateRefreshToken(token, decoded) {
  const conn = await getConnection();
  let transactionStarted = false;
  try {
    await conn.beginTransaction();
    transactionStarted = true;
    const [updated] = await conn.execute(
      `UPDATE refresh_token_sessions
       SET revoked_at = CURRENT_TIMESTAMP
       WHERE id = ? AND token_hash = ? AND revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP`,
      [decoded.jti, hashToken(token)]
    );
    if (updated.affectedRows !== 1) {
      await conn.rollback();
      transactionStarted = false;
      return null;
    }

    const [users] = await conn.execute(
      'SELECT id, email, first_name, last_name, phone, role FROM users WHERE id = ?',
      [decoded.userId]
    );
    if (!users.length) {
      await conn.rollback();
      transactionStarted = false;
      return null;
    }

    const nextSession = await insertSession(conn, users[0].id);
    await conn.execute(
      'UPDATE refresh_token_sessions SET replaced_by_session_id = ? WHERE id = ?',
      [nextSession.sessionId, decoded.jti]
    );
    await conn.commit();
    transactionStarted = false;
    return { user: users[0], refreshToken: nextSession.token };
  } catch (error) {
    if (transactionStarted) {
      try {
        await conn.rollback();
      } catch (rollbackError) {
        error.rollbackError = rollbackError;
      }
    }
    throw error;
  } finally {
    conn.release();
  }
}

export async function revokeRefreshToken(token) {
  await query(
    'UPDATE refresh_token_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = $1 AND revoked_at IS NULL',
    [hashToken(token)]
  );
}

export async function revokeUserRefreshSessions(userId) {
  await query(
    'UPDATE refresh_token_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND revoked_at IS NULL',
    [userId]
  );
}
