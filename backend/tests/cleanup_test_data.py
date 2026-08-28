"""One-off cleanup of QA-created data (test_* users, TEST_* keys/projects)."""
import asyncio
import os
import sys

sys.path.insert(0, "/app/backend")
from database import users, api_keys, projects, commands, prompt_history, audit_logs, sessions  # noqa: E402


async def main():
    test_users = await users.find({"email": {"$regex": "^test_"}}, {"_id": 0, "id": 1, "email": 1}).to_list(500)
    ids = [u["id"] for u in test_users]
    print("test users:", len(ids))
    for col, name in ((api_keys, "api_keys"), (projects, "projects"), (commands, "commands"),
                      (prompt_history, "prompt_history"), (audit_logs, "audit_logs"), (sessions, "sessions")):
        r = await col.delete_many({"user_id": {"$in": ids}})
        print(f"  {name}: {r.deleted_count}")
    r = await users.delete_many({"id": {"$in": ids}})
    print("users deleted:", r.deleted_count)
    r = await api_keys.delete_many({"name": {"$regex": "^TEST_"}})
    print("TEST_ keys deleted:", r.deleted_count)
    r = await projects.delete_many({"name": {"$regex": "^TEST_"}})
    print("TEST_ projects deleted:", r.deleted_count)


asyncio.run(main())
