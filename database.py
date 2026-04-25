import os
from supabase import create_client
from dotenv import load_dotenv
import json

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")
supabase = create_client(url, key)

def init_db():
    pass

def room_exists(room_id):
    result = supabase.table("rooms").select("room_id").eq("room_id", room_id).execute()
    return len(result.data) > 0

def create_room(room_id):
    supabase.table("rooms").upsert({
        "room_id": room_id,
        "content": "",
        "revision": 0,
        "history": []
    }).execute()

def get_room(room_id):
    try:
        result = supabase.table("rooms").select("*").eq("room_id", room_id).execute()
        if result.data:
            row = result.data[0]
            return {
                "room_id": row["room_id"],
                "content": row["content"],
                "revision": row["revision"],
                "history": row["history"] if isinstance(row["history"], list) else json.loads(row["history"])
            }
        return None
    except Exception as e:
        print("get_room error:", e)
        return None

def update_room(room_id, content, revision, history):
    supabase.table("rooms").update({
        "content": content,
        "revision": revision,
        "history": history,
        "last_active": "now()"
    }).eq("room_id", room_id).execute()

def touch_room(room_id):
    supabase.table("rooms").update({
        "last_active": "now()"
    }).eq("room_id", room_id).execute()