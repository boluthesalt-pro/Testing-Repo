# Usage: python3 add.py <<'J' ... J   (one JSON object per line)
# Fields: v (vertical number), n (row), contacts [[name, role, source_url]], email, email_src, domain, note, status
import json, sys
path = "results.jsonl"
with open(path, "a") as f:
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        rec = json.loads(line)
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")
print(sum(1 for _ in open(path)), "records")
