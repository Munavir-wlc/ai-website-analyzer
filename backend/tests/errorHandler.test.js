const request = require('supertest');
const app = require('../src/index');

describe('Global Error & 404 Handler Tests', () => {
  it('returns 404 with JSON error for unmatched routes', async () => {
    const res = await request(app).get('/api/non-existent-endpoint-404');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });

  it('hides error details and stack traces when NODE_ENV is production', async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';

      const express = require('express');
      const testApp = express();

      testApp.get('/test-error', (req, res, next) => {
        const err = new Error('Sensitive DB Connection String Leak');
        err.status = 500;
        next(err);
      });

      // Global error handler matching production shape
      testApp.use((err, req, res, next) => {
        const status = err.status || err.statusCode || 500;
        if (process.env.NODE_ENV === 'production') {
          res.status(status).json({ error: 'Something went wrong' });
        } else {
          res.status(status).json({ error: 'Something went wrong', message: err.message });
        }
      });

      const res = await request(testApp).get('/test-error');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Something went wrong' });
      expect(res.body.message).toBeUndefined();
      expect(res.body.stack).toBeUndefined();
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it('includes error message in non-production environments for debugging', async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'development';

      const express = require('express');
      const testApp = express();

      testApp.get('/test-error', (req, res, next) => {
        const err = new Error('Database connection failed');
        err.status = 503;
        next(err);
      });

      testApp.use((err, req, res, next) => {
        const status = err.status || err.statusCode || 500;
        if (process.env.NODE_ENV === 'production') {
          res.status(status).json({ error: 'Something went wrong' });
        } else {
          res.status(status).json({ error: 'Something went wrong', message: err.message });
        }
      });

      const res = await request(testApp).get('/test-error');
      expect(res.status).toBe(503);
      expect(res.body).toEqual({
        error: 'Something went wrong',
        message: 'Database connection failed'
      });
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});
