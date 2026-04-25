from flask import Flask, request, send_from_directory
from flask_socketio import SocketIO, join_room, emit
import room_manager
from ot_engine import transform_against_history, apply_op
import os

app = Flask(__name__)
app.config["SECRET_KEY"] = "collab-secret"
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="eventlet")

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

    join_room(room_id)
    room_manager.add_user(room_id, sid, username)
    room = room_manager.get_room(room_id)

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
    for room_id, room in room_manager.rooms.items():
        if sid in room["users"]:
            username = room["users"][sid]
            room_manager.remove_user(room_id, sid)
            emit("user_left", {
                "username": username,
                "users": room_manager.get_users(room_id)
            }, to=room_id)
            break

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
        room["content"] = apply_op(room["content"], transformed_op)
        room["history"].append(transformed_op)
        room["revision"] += 1

    emit("ack", {"revision": room["revision"]})

    emit("operation", {
        "op": transformed_op,
        "revision": room["revision"]
    }, to=room_id, include_self=False)

@socketio.on("cursor")
def on_cursor(data):
    room_id = data["room_id"]
    room = room_manager.get_room(room_id)
    if not room:
        return
    username = room["users"].get(request.sid, "?")
    emit("cursor", {
        "username": username,
        "line": data["line"],
        "ch": data["ch"]
    }, to=room_id, include_self=False)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 7860))
    socketio.run(app, host="0.0.0.0", port=port, debug=False)