from flask import Flask, request
from flask_socketio import SocketIO, join_room, leave_room, emit
import room_manager

app = Flask(__name__)
app.config["SECRET_KEY"] = "collab-secret"
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="eventlet")

@app.route("/")
def index():
    return app.send_static_file("index.html")

@app.route("/room/<room_id>")
def editor(room_id):
    return app.send_static_file("editor.html")

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

    room["content"] = data["content"]
    room["revision"] += 1

    emit("operation", {
        "op": data["op"],
        "revision": room["revision"]
    }, to=room_id, include_self=False)

if __name__ == "__main__":
    socketio.run(app, debug=True, port=5000)