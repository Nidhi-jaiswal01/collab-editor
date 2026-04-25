from flask import Flask, request, send_from_directory
from flask_socketio import SocketIO, join_room, emit
import room_manager
import database
from ot_engine import transform_against_history, apply_op
import os
import threading
import time

app = Flask(__name__)
app.config["SECRET_KEY"] = "collab-secret"
socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode="eventlet",
    ping_timeout=60,
    ping_interval=25
)

# Initialize database on startup
database.init_db()

dist_dir = os.path.join(os.path.dirname(__file__), 'dist')

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_react(path):
    if path and os.path.exists(os.path.join(dist_dir, path)):
        return send_from_directory(dist_dir, path)
    return send_from_directory(dist_dir, 'index.html')

@socketio.on("join")
def on_join(data):
    room_id = data["room_id"]
    username = data["username"]
    sid = request.sid

    if not room_manager.get_room(room_id):
        room_manager.create_room(room_id)
    else:
        # Room exists in DB, just make sure active_users has it
        if room_id not in room_manager.active_users:
            room_manager.active_users[room_id] = {}

    join_room(room_id)
    room_manager.add_user(room_id, sid, username)
    room = room_manager.get_room(room_id)
    database.touch_room(room_id)

    emit("init", {
        "content": room["content"],
        "revision": room["revision"],
        "users": room_manager.get_users(room_id)
    })

    emit("user_joined", {
        "username": username,
        "users": room_manager.get_users(room_id)
    }, to=room_id, include_self=False)

@socketio.on("disconnect")
def on_disconnect():
    sid = request.sid
    room_id, username = room_manager.find_user_room(sid)
    if room_id:
        room_manager.remove_user(room_id, sid)
        # If no users left, save to Supabase immediately
        if len(room_manager.get_users(room_id)) == 0:
            room_manager.save_room_now(room_id)
        emit("user_left", {
            "username": username,
            "users": room_manager.get_users(room_id)
        }, to=room_id)

@socketio.on("operation")
def on_operation(data):
    room_id = data["room_id"]
    room = room_manager.get_room(room_id)
    if not room:
        return

    op = data["op"]
    client_revision = data["revision"]

    transformed_op = transform_against_history(
        op, room["history"], client_revision
    )

    if transformed_op:
        new_content = apply_op(room["content"], transformed_op)
        new_revision = room["revision"] + 1
        new_history = room["history"] + [transformed_op]

        # Save to SQLite
        room_manager.update_room_content(
            room_id, new_content, new_revision, new_history
        )
        database.touch_room(room_id)

    updated_room = room_manager.get_room(room_id)

    emit("ack", {"revision": updated_room["revision"]})
    emit("operation", {
        "op": transformed_op,
        "revision": updated_room["revision"]
    }, to=room_id, include_self=False)

@socketio.on("cursor")
def on_cursor(data):
    room_id = data["room_id"]
    room = room_manager.get_room(room_id)
    if not room:
        return
    username = room_manager.active_users.get(room_id, {}).get(request.sid, "?")
    emit("cursor", {
        "username": username,
        "line": data["line"],
        "ch": data["ch"]
    }, to=room_id, include_self=False)

def cleanup_expired_rooms():
    while True:
        time.sleep(3600)  # wait 1 hour
        print("Running room cleanup...")
        database.delete_expired_rooms()

# Start cleanup thread in background
cleanup_thread = threading.Thread(target=cleanup_expired_rooms, daemon=True)
cleanup_thread.start()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 7860))
    socketio.run(app, host="0.0.0.0", port=port, debug=False)