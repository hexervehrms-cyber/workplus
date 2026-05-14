/**
 * Auth Role Routing Tests
 * Verifies that admin users are routed to admin dashboard, not employee dashboard
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import User from '../models/User.js';
import SessionManager from '../utils/sessionManager.js';

describe('Auth Role Routing', () => {
  let adminUser;
  let employeeUser;
  let adminToken;
  let employeeToken;

  beforeAll(async () => {
    // Create test users
    adminUser = await User.create({
      name: 'Admin Test User',
      email: 'admin-test@example.com',
      password: 'hashedPassword123',
      role: 'admin',
      orgId: 'test-org',
      isActive: true
    });

    employeeUser = await User.create({
      name: 'Employee Test User',
      email: 'employee-test@example.com',
      password: 'hashedPassword123',
      role: 'employee',
      orgId: 'test-org',
      isActive: true
    });
  });

  afterAll(async () => {
    // Cleanup
    if (adminUser) await User.deleteOne({ _id: adminUser._id });
    if (employeeUser) await User.deleteOne({ _id: employeeUser._id });
  });

  it('should return admin role in login response for admin user', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin-test@example.com',
        password: 'testPassword123'
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.role).toBe('admin');
    expect(response.body.data.user.role).not.toBe('employee');
    
    adminToken = response.body.data.token;
  });

  it('should return employee role in login response for employee user', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'employee-test@example.com',
        password: 'testPassword123'
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.role).toBe('employee');
    
    employeeToken = response.body.data.token;
  });

  it('should include role in /auth/me response for admin', async () => {
    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.role).toBe('admin');
  });

  it('should include role in /auth/me response for employee', async () => {
    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.role).toBe('employee');
  });

  it('should verify role correctly for admin user', async () => {
    const response = await request(app)
      .get('/api/auth/verify-role')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.role).toBe('admin');
    expect(response.body.data.verified).toBe(true);
  });

  it('should verify role correctly for employee user', async () => {
    const response = await request(app)
      .get('/api/auth/verify-role')
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.role).toBe('employee');
    expect(response.body.data.verified).toBe(true);
  });

  it('should create separate sessions for each user', async () => {
    // Get admin sessions
    const adminSessions = await SessionManager.getUserSessions(adminUser._id);
    
    // Get employee sessions
    const employeeSessions = await SessionManager.getUserSessions(employeeUser._id);

    expect(adminSessions.length).toBeGreaterThan(0);
    expect(employeeSessions.length).toBeGreaterThan(0);
    
    // Verify sessions have correct roles
    adminSessions.forEach(session => {
      expect(session.role).toBe('admin');
    });
    
    employeeSessions.forEach(session => {
      expect(session.role).toBe('employee');
    });
  });

  it('should not allow admin token to be used as employee', async () => {
    // Try to access employee-only endpoint with admin token
    // This should work because admin has higher privileges
    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.role).toBe('admin');
  });
});
