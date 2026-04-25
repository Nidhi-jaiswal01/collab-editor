import database

# Color palette for users
COLORS = [
    "#7C3AED", # purple
    "#DB2777", # pink
    "#D97706", # amber
    "#059669", # green
    "#2563EB", # blue
    "#DC2626", # red
    "#0891B2", # cyan
    "#EA580C", # orange
]

active_rooms = {}
active_users = {}
# Format: { room_id: { sid: { username, color } } }

def create_room(room_id):
    database.create_room(room_id)
    active_rooms[room_id] = {
        "content": "",
        "revision": 0,
        "history": [],
    }
    active_users[room_id] = {}

def get_room(room_id):
    if room_id in active_rooms:
        return active_rooms[room_id]
    room = database.get_room(room_id)
    if room:
        active_rooms[room_id] = room
        active_users[room_id] = {}
    return room

def add_user(room_id, sid, username):
    if room_id not in active_users:
        active_users[room_id] = {}
    # Assign color based on how many users are in the room
    color_index = len(active_users[room_id]) % len(COLORS)
    active_users[room_id][sid] = {
        "username": username,
        "color": COLORS[color_index]
    }

def remove_user(room_id, sid):
    if room_id in active_users:
        active_users[room_id].pop(sid, None)

def get_users(room_id):
    return [
        {"username": u["username"], "color": u["color"]}
        for u in active_users.get(room_id, {}).values()
    ]

def get_user_color(room_id, sid):
    user = active_users.get(room_id, {}).get(sid)
    return user["color"] if user else "#7C3AED"

def update_room_content(room_id, content, revision, history):
    if room_id in active_rooms:
        active_rooms[room_id]["content"] = content
        active_rooms[room_id]["revision"] = revision
        active_rooms[room_id]["history"] = history
    if revision % 10 == 0:
        database.update_room(room_id, content, revision, history)

def save_room_now(room_id):
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
            return room_id, users[sid]["username"]
    return None, None