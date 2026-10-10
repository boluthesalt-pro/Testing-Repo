# Append published company emails. One JSON object per line:
# {"v":5,"n":12,"email":"lagos@hardrock.com","src":"https://..."}
# Only addresses seen on a real web page (the company's site, a directory, or press) go in.
import json, sys
with open("emails.jsonl", "a") as f:
    for line in sys.stdin:
        if line.strip():
            f.write(json.dumps(json.loads(line), ensure_ascii=False) + "\n")
print(sum(1 for _ in open("emails.jsonl")), "emails")
