import database

# In-memory store for active users only
# Format: { room_id: { sid: username } }
active_users = {}

def create_room(room_id):
    database.create_room(room_id)
    if room_id not in active_users:
        active_users[room_id] = {}

def get_room(room_id):
    return database.get_room(room_id)

def add_user(room_id, sid, username):
    if room_id not in active_users:
        active_users[room_id] = {}
    active_users[room_id][sid] = username

def remove_user(room_id, sid):
    if room_id in active_users:
        active_users[room_id].pop(sid, None)

def get_users(room_id):
    return list(active_users.get(room_id, {}).values())

def update_room_content(room_id, content, revision, history):
    database.update_room(room_id, content, revision, history)

def find_user_room(sid):
    for room_id, users in active_users.items():
        if sid in users:
            return room_id, users[sid]
    return None, None