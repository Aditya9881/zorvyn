import dotenv from 'dotenv';
dotenv.config();

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  db: {
    path: process.env.DB_PATH || './data/zorvyn.db',
  },

  jwt: {
    accessTokenSecret: process.env.ACCESS_TOKEN_SECRET || 'dev-access-secret',
    refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET || 'dev-refresh-secret',
    accessTokenExpiry: process.env.ACCESS_TOKEN_EXPIRY || '15m',
    refreshTokenExpiry: process.env.REFRESH_TOKEN_EXPIRY || '7d',
  },

  bcrypt: {
    saltRounds: 12,
  },
};

export default config;
