# Append LinkedIn profile findings. One JSON object per line:
# {"v":3,"n":3,"name":"Femi Aluko","role":"Co-founder and CEO","url":"https://www.linkedin.com/in/femialuko/"}
# A name that matches an existing contact gets the URL attached; a new name is added as a contact
# whose source is the profile itself.
import json, sys
with open("linkedin.jsonl", "a") as f:
    for line in sys.stdin:
        if line.strip():
            f.write(json.dumps(json.loads(line), ensure_ascii=False) + "\n")
print(sum(1 for _ in open("linkedin.jsonl")), "profiles")
