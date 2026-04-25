import database

# In-memory cache for active rooms
# Format: { room_id: { content, revision, history, users } }
active_rooms = {}
active_users = {}

def create_room(room_id):
    database.create_room(room_id)
    active_rooms[room_id] = {
        "content": "",
        "revision": 0,
        "history": [],
    }
    active_users[room_id] = {}

def get_room(room_id):
    # Return from memory if available
    if room_id in active_rooms:
        return active_rooms[room_id]
    # Otherwise load from Supabase
    room = database.get_room(room_id)
    if room:
        active_rooms[room_id] = room
        active_users[room_id] = {}
    return room

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
    # Update memory immediately
    if room_id in active_rooms:
        active_rooms[room_id]["content"] = content
        active_rooms[room_id]["revision"] = revision
        active_rooms[room_id]["history"] = history
    # Save to Supabase every 10 revisions to avoid slowdown
    if revision % 10 == 0:
        database.update_room(room_id, content, revision, history)

def save_room_now(room_id):
    # Force save to Supabase immediately
    if room_id in active_rooms:
        room = active_rooms[room_id]
        database.update_room(
            room_id,
            room["content"],
            room["revision"],
            room["history"]
        )

def find_user_room(sid):
    for room_id, users in active_users.items():
        if sid in users:
            return room_id, users[sid]
    return None, None