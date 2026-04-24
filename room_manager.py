rooms = {}

def create_room(room_id):
    rooms[room_id] = {
        "content": "",
        "revision": 0,
        "history": [],
        "users": {}
    }

def get_room(room_id):
    return rooms.get(room_id)

def add_user(room_id, sid, username):
    rooms[room_id]["users"][sid] = username

def remove_user(room_id, sid):
    if room_id in rooms:
        rooms[room_id]["users"].pop(sid, None)

def get_users(room_id):
    return list(rooms[room_id]["users"].values())