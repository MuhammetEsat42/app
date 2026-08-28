"""Mongo connection + Redis client, shared across routers."""
import os
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import redis.asyncio as aioredis

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

_mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(_mongo_url)
db = client[os.environ["DB_NAME"]]

redis_client = aioredis.from_url(os.environ["REDIS_URL"], decode_responses=True)

# Collections
users = db.users
api_keys = db.api_keys
commands = db.commands
projects = db.projects
prompt_history = db.prompt_history
audit_logs = db.audit_logs
sessions = db.sessions
bridge_state = db.bridge_state
payment_transactions = db.payment_transactions
team_invites = db.team_invites


async def ensure_indexes():
    await users.create_index("email", unique=True)
    await users.create_index("fingerprint")
    await users.create_index("signup_ip")
    await api_keys.create_index("user_id")
    await commands.create_index([("user_id", 1), ("status", 1)])
    await prompt_history.create_index([("user_id", 1), ("created_at", -1)])
    await audit_logs.create_index([("user_id", 1), ("created_at", -1)])
    await team_invites.create_index([("owner_id", 1), ("email", 1)], unique=True)
    await payment_transactions.create_index("session_id", unique=True)
