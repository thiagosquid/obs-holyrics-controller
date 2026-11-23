import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { PresenterPermission, PresenterSession } from './types';
import { DATA_DIR } from './config';

const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const DEFAULT_PERMISSIONS: PresenterPermission[] = ['view', 'next', 'previous'];

export class SessionManager {
  private sessions = new Map<string, PresenterSession>();

  constructor() {
    this.load();
  }

  private load() {
    if (!fs.existsSync(SESSIONS_FILE)) return;
    try {
      const raw = fs.readFileSync(SESSIONS_FILE, 'utf-8');
      const list: PresenterSession[] = JSON.parse(raw);
      for (const s of list) {
        this.sessions.set(s.token, s);
      }
    } catch {
      // ignore malformed file
    }
  }

  private save() {
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(Array.from(this.sessions.values()), null, 2));
  }

  createSession(name: string, permissions: PresenterPermission[] = DEFAULT_PERMISSIONS): PresenterSession {
    const id = crypto.randomUUID();
    const token = crypto.randomBytes(16).toString('hex');
    const session: PresenterSession = {
      id,
      token,
      name,
      permissions,
      createdAt: new Date().toISOString(),
      revoked: false,
      blocked: false,
    };
    this.sessions.set(token, session);
    this.save();
    return session;
  }

  getSession(token: string): PresenterSession | undefined {
    const s = this.sessions.get(token);
    if (!s || s.revoked) return undefined;
    return s;
  }

  revokeSession(id: string): boolean {
    for (const s of this.sessions.values()) {
      if (s.id === id) {
        s.revoked = true;
        this.save();
        return true;
      }
    }
    return false;
  }

  blockSession(id: string, blocked: boolean): boolean {
    for (const s of this.sessions.values()) {
      if (s.id === id) {
        s.blocked = blocked;
        this.save();
        return true;
      }
    }
    return false;
  }

  setPermissions(id: string, permissions: PresenterPermission[]): boolean {
    for (const s of this.sessions.values()) {
      if (s.id === id) {
        s.permissions = permissions;
        this.save();
        return true;
      }
    }
    return false;
  }

  listSessions(): PresenterSession[] {
    return Array.from(this.sessions.values());
  }

  can(session: PresenterSession, permission: PresenterPermission): boolean {
    if (session.blocked || session.revoked) return false;
    return session.permissions.includes('expanded') || session.permissions.includes(permission);
  }
}
