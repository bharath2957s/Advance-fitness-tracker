/*
  AI Workout Pro & Fitness App Backend
  =====================================
  Combines user auth, profile, metrics, diet entries, and workout sessions

  Dependencies:
    - express
    - mysql2
    - dotenv
    - cors
    - body-parser
    - bcrypt

  Run:
    $ npm install express mysql2 dotenv cors body-parser bcrypt
    $ node server.js
*/

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Bcrypt settings
const SALT_ROUNDS = 10;

// MySQL connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'bharath16',
  database: process.env.DB_NAME || 'fitness_app',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Helper: query
async function query(sql, params) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

// Ensure workouts table exists
async function initWorkoutsTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS workouts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT,
      reps INT NOT NULL,
      calories INT NOT NULL,
      avg_rep_time FLOAT NOT NULL,
      session_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `;
  await query(sql);
}

// Initialize DB (workouts table)
initWorkoutsTable().catch(err => console.error('Error initializing workouts:', err));

// === User Registration ===
app.post('/register', async (req, res) => {
  const { username, email, phone, password } = req.body;
  try {
    const existing = await query(
      'SELECT id FROM users WHERE email = ? OR username = ?',
      [email, username]
    );
    if (existing.length) return res.json({ error: 'User already exists' });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const result = await query(
      'INSERT INTO users (username, email, phone, password) VALUES (?, ?, ?, ?)',
      [username, email, phone, hashedPassword]
    );
    res.json({ message: 'Registration successful', userId: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// === User Login ===
app.post('/login', async (req, res) => {
  const { login, password } = req.body;
  try {
    const rows = await query(
      'SELECT id, password FROM users WHERE username = ? OR email = ? OR phone = ?',
      [login, login, login]
    );
    if (!rows.length) {
      return res.json({ error: 'Invalid credentials' });
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.json({ error: 'Invalid credentials' });
    }

    res.json({ message: 'Login successful', userId: user.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// === Profile Save/Update ===
app.post('/profile', async (req, res) => {
  const { userId, gender, age, weight, height } = req.body;
  try {
    const existing = await query(
      'SELECT id FROM profiles WHERE user_id = ?',
      [userId]
    );
    if (existing.length) {
      await query(
        'UPDATE profiles SET gender=?, age=?, weight=?, height=? WHERE user_id=?',
        [gender, age, weight, height, userId]
      );
    } else {
      await query(
        'INSERT INTO profiles (user_id, gender, age, weight, height) VALUES (?, ?, ?, ?, ?)',
        [userId, gender, age, weight, height]
      );
    }
    res.json({ message: 'Profile saved' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// === Get Profile ===
app.get('/profile/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const rows = await query(
      'SELECT gender, age, weight, height FROM profiles WHERE user_id = ?',
      [userId]
    );
    res.json(rows[0] || {});
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// === Metrics Logging ===
app.post('/logMetrics', async (req, res) => {
  const { userId, activity, meter, calories, duration } = req.body;
  try {
    const result = await query(
      'INSERT INTO metrics (user_id, activity, meter, calories, duration) VALUES (?, ?, ?, ?, ?)',
      [userId, activity, meter, calories, duration]
    );
    res.json({ message: 'Metrics logged', metricId: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// === Get Metrics ===
app.get('/metrics/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const rows = await query(
      'SELECT * FROM metrics WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// === Delete Metric ===
app.delete('/metrics/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await query('DELETE FROM metrics WHERE id = ?', [id]);
    res.json({ message: 'Metric deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// === Diet Entries ===
app.post('/diet', async (req, res) => {
  const { userId, meal, name, caloriesPer100g, weightConsumed, weightUnit } = req.body;
  try {
    const result = await query(
      'INSERT INTO diet_entries (user_id, meal, name, calories_per_100g, weight_consumed, weight_unit) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, meal, name, caloriesPer100g, weightConsumed, weightUnit]
    );
    res.json({ message: 'Diet entry added', entryId: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/diet/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const rows = await query(
      'SELECT * FROM diet_entries WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.delete('/diet/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await query('DELETE FROM diet_entries WHERE id = ?', [id]);
    res.json({ message: 'Diet entry deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// === Workout Sessions ===
app.post('/workouts', async (req, res) => {
  const { userId, reps, calories, avgRepTime } = req.body;
  try {
    const result = await query(
      'INSERT INTO workouts (user_id, reps, calories, avg_rep_time) VALUES (?, ?, ?, ?)',
      [userId, reps, calories, avgRepTime]
    );
    res.json({ id: result.insertId, userId, reps, calories, avgRepTime });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/workouts/recent', async (req, res) => {
  const limit = parseInt(req.query.limit) || 5;
  const { userId } = req.query;
  try {
    const rows = await query(
      `SELECT id, user_id AS userId, reps, calories, avg_rep_time AS avgRepTime, session_time AS time
       FROM workouts
       WHERE user_id = ?
       ORDER BY session_time DESC
       LIMIT ?`,
      [userId, limit]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
