/**
 * Swagger/OpenAPI Configuration
 *
 * Auto-generates API documentation from JSDoc annotations.
 * Served at GET /api-docs.
 */

import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Zorvyn Financial Dashboard API',
      version: '1.0.0',
      description:
        'High-integrity financial dashboard backend with Clean Architecture, ' +
        'RBAC, BIGINT currency storage, and dual-token JWT authentication.',
      contact: {
        name: 'Zorvyn Engineering',
      },
    },
    servers: [
      {
        url: '/api/v1',
        description: 'API v1',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Access token obtained from /auth/login or /auth/register',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            type: { type: 'string', example: 'https://api.zorvyn.com/errors/validation-error' },
            title: { type: 'string', example: 'Validation Error' },
            status: { type: 'integer', example: 400 },
            detail: { type: 'string', example: 'Email is required.' },
            instance: { type: 'string', example: '/api/v1/auth/register' },
          },
        },
        Transaction: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            userId: { type: 'integer', example: 1 },
            type: { type: 'string', enum: ['income', 'expense'] },
            category: { type: 'string', example: 'Groceries' },
            amount: { type: 'string', example: '150.75', description: 'Dollar string (not float)' },
            note: { type: 'string', example: 'Weekly groceries' },
            date: { type: 'string', format: 'date', example: '2026-04-01' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Summary: {
          type: 'object',
          properties: {
            totalIncome: { type: 'string', example: '3700.00' },
            totalExpense: { type: 'string', example: '1000.00' },
            netBalance: { type: 'string', example: '2700.00' },
            transactionCount: { type: 'integer', example: 6 },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            name: { type: 'string', example: 'Aditya Sonkar' },
            email: { type: 'string', example: 'aditya@zorvyn.com' },
            isActive: { type: 'boolean', example: true },
            roles: { type: 'array', items: { type: 'string' }, example: ['Viewer'] },
            permissions: { type: 'array', items: { type: 'string' }, example: ['read_transactions'] },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/presentation/routes/*.js'],
};

export const swaggerSpec = swaggerJsdoc(options);
