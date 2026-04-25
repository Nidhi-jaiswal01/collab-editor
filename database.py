import sqlite3
import json
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'collab.db')

def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_conn()
    conn.execute('''
        CREATE TABLE IF NOT EXISTS rooms (
            room_id TEXT PRIMARY KEY,
            content TEXT DEFAULT '',
            revision INTEGER DEFAULT 0,
            history TEXT DEFAULT '[]',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

def room_exists(room_id):
    conn = get_conn()
    row = conn.execute(
        'SELECT room_id FROM rooms WHERE room_id = ?', (room_id,)
    ).fetchone()
    conn.close()
    return row is not None

def create_room(room_id):
    conn = get_conn()
    conn.execute(
        'INSERT OR IGNORE INTO rooms (room_id) VALUES (?)', (room_id,)
    )
    conn.commit()
    conn.close()

def get_room(room_id):
    conn = get_conn()
    row = conn.execute(
        'SELECT * FROM rooms WHERE room_id = ?', (room_id,)
    ).fetchone()
    conn.close()
    if row:
        return {
            'room_id': row['room_id'],
            'content': row['content'],
            'revision': row['revision'],
            'history': json.loads(row['history']),
        }
    return None

def update_room(room_id, content, revision, history):
    conn = get_conn()
    conn.execute('''
        UPDATE rooms
        SET content = ?, revision = ?, history = ?, last_active = CURRENT_TIMESTAMP
        WHERE room_id = ?
    ''', (content, revision, json.dumps(history), room_id))
    conn.commit()
    conn.close()

def touch_room(room_id):
    conn = get_conn()
    conn.execute(
        'UPDATE rooms SET last_active = CURRENT_TIMESTAMP WHERE room_id = ?',
        (room_id,)
    )
    conn.commit()
    conn.close()