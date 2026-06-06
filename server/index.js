require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// ─── Config ──────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const MAX_PAYLOAD_MB = parseInt(process.env.MAX_PAYLOAD_MB || '8', 10);
const BCRYPT_ROUNDS = 10;
const JWT_EXPIRY = '30d';

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is required. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

// ─── Express setup ───────────────────────────────────────────────────
const app = express();
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: `${MAX_PAYLOAD_MB}mb` }));

// ─── MongoDB connection ──────────────────────────────────────────────
let db;
const client = new MongoClient(MONGODB_URI, {
  maxPoolSize: 5,       // Free tier friendly
  minPoolSize: 1,
  maxIdleTimeMS: 30000,
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,
});

async function connectDB() {
  try {
    await client.connect();
    db = client.db('noteapp');

    // Create indexes (idempotent)
    await db.collection('users').createIndex({ emailHash: 1 }, { unique: true });
    await db.collection('sync_data').createIndex({ userId: 1 }, { unique: true });

    console.log('✅ Connected to MongoDB Atlas');
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────

function hashEmail(email) {
  return crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
}

function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

// ─── Auth Middleware ─────────────────────────────────────────────────

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ─── Auth Routes ─────────────────────────────────────────────────────

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const emailH = hashEmail(email);

    // Check if user already exists
    const existing = await db.collection('users').findOne({ emailHash: emailH });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    // Hash password for auth (NOT the encryption key — that stays client-side)
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const result = await db.collection('users').insertOne({
      emailHash: emailH,
      passwordHash,
      createdAt: new Date().toISOString(),
    });

    const token = generateToken(result.insertedId.toString());

    res.status(201).json({
      message: 'Account created successfully',
      token,
      userId: result.insertedId.toString(),
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const emailH = hashEmail(email);
    const user = await db.collection('users').findOne({ emailHash: emailH });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken(user._id.toString());

    res.json({
      message: 'Login successful',
      token,
      userId: user._id.toString(),
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ─── Sync Routes ─────────────────────────────────────────────────────

// POST /api/sync/push — upload encrypted data blob
app.post('/api/sync/push', authMiddleware, async (req, res) => {
  try {
    const { data, checksum } = req.body;

    if (!data || !checksum) {
      return res.status(400).json({ error: 'Data and checksum are required' });
    }

    const sizeBytes = Buffer.byteLength(data, 'utf8');

    // Size check (free tier guard)
    const maxBytes = MAX_PAYLOAD_MB * 1024 * 1024;
    if (sizeBytes > maxBytes) {
      return res.status(413).json({
        error: `Data exceeds ${MAX_PAYLOAD_MB}MB limit`,
        sizeBytes,
        maxBytes,
      });
    }

    const now = new Date().toISOString();

    await db.collection('sync_data').updateOne(
      { userId: req.userId },
      {
        $set: {
          data,
          checksum,
          updatedAt: now,
          sizeBytes,
        },
        $setOnInsert: {
          userId: req.userId,
          createdAt: now,
        },
      },
      { upsert: true }
    );

    res.json({
      message: 'Sync successful',
      updatedAt: now,
      sizeBytes,
    });
  } catch (err) {
    console.error('Push error:', err);
    res.status(500).json({ error: 'Sync push failed' });
  }
});

// POST /api/sync/pull — download encrypted data blob
app.post('/api/sync/pull', authMiddleware, async (req, res) => {
  try {
    const syncDoc = await db.collection('sync_data').findOne({ userId: req.userId });

    if (!syncDoc) {
      return res.status(404).json({ error: 'No cloud data found' });
    }

    res.json({
      data: syncDoc.data,
      checksum: syncDoc.checksum,
      updatedAt: syncDoc.updatedAt,
      sizeBytes: syncDoc.sizeBytes,
    });
  } catch (err) {
    console.error('Pull error:', err);
    res.status(500).json({ error: 'Sync pull failed' });
  }
});

// GET /api/sync/status — check if cloud data exists
app.get('/api/sync/status', authMiddleware, async (req, res) => {
  try {
    const syncDoc = await db.collection('sync_data').findOne(
      { userId: req.userId },
      { projection: { data: 0 } } // Don't return the blob — just metadata
    );

    if (!syncDoc) {
      return res.json({ exists: false });
    }

    res.json({
      exists: true,
      updatedAt: syncDoc.updatedAt,
      sizeBytes: syncDoc.sizeBytes,
    });
  } catch (err) {
    console.error('Status error:', err);
    res.status(500).json({ error: 'Status check failed' });
  }
});

// DELETE /api/sync/delete — delete cloud data
app.delete('/api/sync/delete', authMiddleware, async (req, res) => {
  try {
    await db.collection('sync_data').deleteOne({ userId: req.userId });

    res.json({ message: 'Cloud data deleted successfully' });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Delete failed' });
  }
});

// ─── Health check ────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Start server ────────────────────────────────────────────────────

connectDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Note App Sync Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  await client.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await client.close();
  process.exit(0);
});
