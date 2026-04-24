from flask import Flask, request
from flask_socketio import SocketIO, join_room, leave_room, emit
import room_manager

app = Flask(__name__)
app.config["SECRET_KEY"] = "collab-secret"
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="eventlet")