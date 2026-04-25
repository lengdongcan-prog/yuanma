import sqlite3
import hashlib
from datetime import datetime

conn = sqlite3.connect('app.db')
cursor = conn.cursor()

cursor.execute('''
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_admin INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
''')

cursor.execute('''
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    platform TEXT,
    country TEXT,
    language TEXT,
    size TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_deleted INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id)
)
''')

cursor.execute('''
CREATE TABLE IF NOT EXISTS assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    project_id INTEGER,
    file_path TEXT NOT NULL,
    file_type TEXT,
    file_size INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (project_id) REFERENCES projects(id)
)
''')

cursor.execute('''
CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    project_id INTEGER,
    task_type TEXT,
    status TEXT DEFAULT 'pending',
    result TEXT,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (project_id) REFERENCES projects(id)
)
''')

cursor.execute('''
CREATE TABLE IF NOT EXISTS ai_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    model_id TEXT NOT NULL,
    api_key TEXT,
    api_base TEXT,
    model_type TEXT,
    status TEXT DEFAULT 'enabled',
    is_default INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
''')

cursor.execute('''
CREATE TABLE IF NOT EXISTS templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    platform TEXT,
    size TEXT,
    content TEXT,
    is_default INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
''')

admin_password = 'admin123'
salt = 'ai_generator_salt'
password_hash = hashlib.pbkdf2_hmac('sha256', admin_password.encode(), salt.encode(), 100000).hex()

cursor.execute('''
INSERT OR IGNORE INTO users (username, email, password_hash, is_admin, is_active)
VALUES (?, ?, ?, ?, ?)
''', ('admin', 'admin@example.com', password_hash, 1, 1))

conn.commit()
conn.close()

print('Database created successfully!')
print('Admin account:')
print('Username: admin')
print('Password: admin123')
