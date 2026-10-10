"""Rebuild the Outbound Engine prospect sheets from sourced research only.

Inputs (all in this folder):
  prospects-original.json   the 500 rows extracted from the old prospects.pdf files
  results.jsonl             research records, one per line, keyed by vertical (v) and row (n)
  legacy/*.json             optional: the per-vertical JSON files from the earlier research run
                            (company, domain, contacts[name, role, email, source], general_emails,
                            email_format, note). Drop them in and re-run; they are merged by company name.

Outputs:
  ../<vertical>/prospects.pdf   landscape A4 sheet per vertical
  master-prospects.csv          every row, every contact, one line per contact
  lookup-needed.csv             named contacts that still need a verified personal email
  coverage.csv                  research status per vertical

Run: python3 build.py
"""
import csv
import glob
import json
import os
import re
from collections import Counter, OrderedDict
from urllib.parse import quote_plus, unquote, urlparse

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from xml.sax.saxutils import escape

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.dirname(HERE)
RED = colors.HexColor("#FF3838")
INK = colors.HexColor("#1A1A1A")
GREY = colors.HexColor("#6B6B6B")
RULE = colors.HexColor("#E6E6E6")

VERTICAL_NAMES = OrderedDict([
    ("01-fashion-streetwear", "Fashion & Streetwear"),
    ("02-beauty-personal-care", "Beauty & Personal Care"),
    ("03-food-beverage", "Food & Beverage"),
    ("04-real-estate-property", "Real Estate & Property"),
    ("05-hospitality-events", "Hospitality & Events"),
    ("06-tech-saas", "Tech & SaaS"),
    ("07-fintech-financial-services", "Fintech & Financial Services"),
    ("08-health-wellness", "Health & Wellness"),
    ("09-entertainment-media", "Entertainment & Media"),
    ("10-education-professional-development", "Education & Professional Development"),
])

STATUS_LABEL = {
    "unmatched": "Could not be matched to a real Nigerian business. Confirm before outreach.",
    "not_nigerian": "Not a Nigerian business.",
    "duplicate": "Duplicate.",
    "closed": "Business has closed.",
    "subsidiary": "Local arm of a global brand. Brand decisions sit abroad.",
    "government": "Government body. Work goes through procurement.",
    "unresearched": "Not yet researched.",
}

# Same company listed in more than one place: copy research from the first key to the second.
CROSS_DUPLICATES = [
    ((3, 3), (6, 8)),     # Chowdeck
    ((3, 47), (5, 13)),   # Shiro Lagos
    ((3, 20), (5, 46)),   # Terra Kulture
    ((2, 22), (8, 30)),   # Skin101
    ((5, 2), (5, 48)),    # Eko Convention Centre is part of Eko Hotels
    ((5, 2), (8, 26)),    # The Spa at Eko Hotels
    ((5, 8), (8, 29)),    # Wheatbaker Spa
    ((2, 7), (9, 26)),    # BellaNaija
    ((6, 9), (7, 5)),     # PiggyVest
    ((6, 10), (7, 11)),   # Cowrywise
    ((6, 16), (7, 12)),   # Risevest
    ((6, 17), (7, 13)),   # Bamboo
    ((6, 15), (7, 27)),   # Brass
    ((6, 20), (7, 29)),   # Anchor
    ((6, 46), (7, 26)),   # Earnipay
    ((6, 48), (10, 10)),  # AltSchool Africa
    ((6, 47), (10, 11)),  # Decagon
    ((7, 2), (7, 10)),    # TeamApt is Moniepoint
]

# Findings carried over from the earlier research run that are not yet in results.jsonl.
CARRIED_NOTES = {
    (6, 1): "Domain bumpa.shop returned a 404 in earlier research, so the real domain is unconfirmed.",
    (8, 9): "Earlier research could not match this to a real Nigerian business.",
    (8, 10): "Earlier research could not match this to a real Nigerian business.",
    (8, 11): "Earlier research could not match this to a real Nigerian business.",
    (8, 12): "Earlier research could not match this to a real Nigerian business.",
    (8, 14): "Earlier research could not match this to a real Nigerian business.",
    (8, 15): "Earlier research could not match this to a real Nigerian business.",
}
CARRIED_STATUS = {(8, 9): "unmatched", (8, 10): "unmatched", (8, 11): "unmatched",
                  (8, 12): "unmatched", (8, 14): "unmatched", (8, 15): "unmatched"}

# Names the old PDF garbled.
NAME_FIXES = {(10, 2): "The Bulb Africa"}


def norm(s):
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def load_results():
    recs = {}
    with open(os.path.join(HERE, "results.jsonl")) as f:
        for line in f:
            line = line.strip()
            if line:
                r = json.loads(line)
                recs[(r["v"], r["n"])] = r  # later lines win
    return recs


def load_legacy(rows_by_key):
    """Map legacy JSON records (earlier research run) onto rows by company name."""
    by_name = {}
    for key, row in rows_by_key.items():
        by_name.setdefault((key[0], norm(row["company"])), key)
    out = {}
    for path in sorted(glob.glob(os.path.join(HERE, "legacy", "*.json"))):
        m = re.match(r"(\d\d)", os.path.basename(path))
        if not m:
            continue
        v = int(m.group(1))
        data = json.load(open(path))
        if isinstance(data, dict):
            data = data.get("companies") or list(data.values())
        for item in data:
            key = by_name.get((v, norm(item.get("company"))))
            if not key:
                continue
            contacts = []
            for c in item.get("contacts") or []:
                if c.get("name") and c.get("source"):
                    contacts.append([c["name"], c.get("role", ""), c["source"]])
            general = item.get("general_emails") or []
            rec = {"v": v, "n": key[1], "contacts": contacts, "domain": item.get("domain") or "",
                   "note": item.get("note") or "", "email_format": item.get("email_format") or ""}
            if general:
                first = general[0]
                if isinstance(first, dict):
                    rec["email"], rec["email_src"] = first.get("email", ""), first.get("source", "")
                else:
                    rec["email"], rec["email_src"] = first, "Earlier research pass"
            out[key] = rec
    return out


def merge(primary, extra):
    """Combine two records for the same row; primary wins on conflicts, contacts are unioned."""
    if not extra:
        return primary
    if not primary:
        return extra
    merged = dict(extra)
    merged.update({k: v for k, v in primary.items() if v})
    seen, contacts = set(), []
    for c in (primary.get("contacts") or []) + (extra.get("contacts") or []):
        if norm(c[0]) not in seen:
            seen.add(norm(c[0]))
            contacts.append(c)
    merged["contacts"] = contacts
    notes = [x for x in (primary.get("note"), extra.get("note")) if x]
    merged["note"] = " ".join(dict.fromkeys(notes))
    return merged


def is_company_page(url):
    return "/company/" in url


def apply_linkedin(data):
    """Attach LinkedIn profile URLs from linkedin.jsonl to contacts, adding new contacts where needed."""
    path = os.path.join(HERE, "linkedin.jsonl")
    if not os.path.exists(path):
        return
    for line in open(path):
        if not line.strip():
            continue
        r = json.loads(line)
        key = (r["v"], r["n"])
        rec = data.get(key)
        if rec is None or rec.get("pending"):
            rec = data[key] = {"contacts": [], "note": (rec or {}).get("note", "")}
            rec.pop("pending", None)
        rec.setdefault("contacts", [])
        name = r["name"].replace(" (company page)", "").strip()
        if is_company_page(r["url"]):
            rec["company_li"] = r["url"]
            if r["role"].startswith("Company LinkedIn page"):
                continue  # a company page with no named person
        target = None
        for c in rec["contacts"]:
            a, b = norm(c[0]), norm(name)
            if a == b or a.startswith(b) or b.startswith(a) or norm(c[0].split(" (")[0]) == norm(name.split(" (")[0]):
                target = c
                break
        if target is None:
            target = [name, r["role"], r["url"]]
            rec["contacts"].append(target)
        while len(target) < 4:
            target.append("")
        target[3] = r["url"]


def best_li(c):
    return c[3] if len(c) > 3 else ""


def short_source(url):
    if not url.startswith("http"):
        return url
    host = urlparse(url).netloc
    return host[4:] if host.startswith("www.") else host


def linkedin_search(name, company):
    q = quote_plus(f"{name} {company}")
    return f"https://www.linkedin.com/search/results/people/?keywords={q}"


def build():
    raw = json.load(open(os.path.join(HERE, "prospects-original.json")))
    rows = {}
    for folder, items in raw.items():
        v = int(folder[:2])
        for r in items:
            n = int(r[0])
            rows[(v, n)] = {"folder": folder, "company": NAME_FIXES.get((v, n), r[1]),
                            "category": r[4], "what": r[5]}

    results = load_results()
    legacy = load_legacy(rows)
    data = {k: merge(results.get(k), legacy.get(k)) for k in rows}
    apply_linkedin(data)

    for src, dst in CROSS_DUPLICATES:
        s, d = data.get(src), data.get(dst)
        src_name = rows[src]["company"]
        if s and (not d or not d.get("contacts")):
            copy = dict(s)
            copy["note"] = (f"Same company as {src[0]:02d}/{src[1]} ({src_name}). Contact once. "
                            + ((d or {}).get("note") or "")).strip()
            copy["status"] = "duplicate"
            data[dst] = copy
        elif d is not None:
            d.setdefault("status", "duplicate")
            if "Same company" not in (d.get("note") or ""):
                d["note"] = (f"Same company as {src[0]:02d}/{src[1]} ({src_name}). " + (d.get("note") or "")).strip()
        elif not s:
            data[dst] = {"status": "duplicate", "contacts": [], "pending": True,
                         "note": f"Same company as {src[0]:02d}/{src[1]} ({src_name}). Contact once. Not yet researched."}

    for k, note in CARRIED_NOTES.items():
        rec = data.get(k) or {"contacts": [], "pending": k not in CARRIED_STATUS}
        if note not in (rec.get("note") or ""):
            rec["note"] = ((rec.get("note") or "") + " " + note).strip()
        if k in CARRIED_STATUS:
            rec["status"] = CARRIED_STATUS[k]
        data[k] = rec

    master, lookup, coverage = [], [], []
    for folder, title in VERTICAL_NAMES.items():
        v = int(folder[:2])
        keys = sorted(k for k in rows if k[0] == v)
        counts = Counter()
        table_rows = []
        for k in keys:
            row, rec = rows[k], data.get(k)
            status = (rec or {}).get("status") or ("researched" if rec else "unresearched")
            counts[status] += 1
            if (rec or {}).get("pending"):
                counts["unresearched"] += 1
            contacts = (rec or {}).get("contacts") or []
            if contacts:
                counts["with_named_contact"] += 1
            if any(best_li(c) and not is_company_page(best_li(c)) for c in contacts):
                counts["with_linkedin"] += 1
            email = (rec or {}).get("email") or ""
            if email:
                counts["with_verified_email"] += 1
            note = (rec or {}).get("note") or ""
            if status in STATUS_LABEL and STATUS_LABEL[status].split(".")[0] not in note:
                note = (STATUS_LABEL[status] + " " + note).strip()
            table_rows.append((k, row, rec or {}, status, contacts, email, note))

            for c in contacts or [["", "", "", ""]]:
                master.append({
                    "vertical": folder, "row": k[1], "company": row["company"],
                    "status": status, "decision_maker": c[0], "role": c[1], "source": c[2],
                    "linkedin_profile": best_li(c),
                    "company_linkedin": (rec or {}).get("company_li", ""),
                    "linkedin_search": linkedin_search(c[0], row["company"]) if c[0] else "",
                    "verified_general_email": email, "email_source": (rec or {}).get("email_src", ""),
                    "domain": (rec or {}).get("domain", ""),
                    "suggested_email_format_UNVERIFIED": (rec or {}).get("email_format", ""),
                    "note": note,
                })
                if c[0] and status not in ("duplicate", "unmatched", "not_nigerian", "closed"):
                    lookup.append({
                        "vertical": folder, "row": k[1], "company": row["company"],
                        "domain": (rec or {}).get("domain", ""), "name": c[0], "role": c[1],
                        "source": c[2], "linkedin_profile": best_li(c),
                        "linkedin_search": linkedin_search(c[0], row["company"]),
                        "priority": "low (global brand or government)" if status in ("subsidiary", "government") else "normal",
                    })

        coverage.append({"vertical": folder, "rows": len(keys),
                         "researched": len(keys) - counts["unresearched"],
                         "unresearched": counts["unresearched"],
                         "with_named_contact": counts["with_named_contact"],
                         "with_linkedin": counts["with_linkedin"],
                         "with_verified_email": counts["with_verified_email"],
                         "unmatched": counts["unmatched"], "not_nigerian": counts["not_nigerian"],
                         "duplicate": counts["duplicate"], "closed": counts["closed"],
                         "subsidiary": counts["subsidiary"], "government": counts["government"]})
        render_pdf(folder, title, table_rows, coverage[-1])

    write_csv("master-prospects.csv", master)
    write_csv("lookup-needed.csv", lookup)
    write_csv("coverage.csv", coverage)
    total = Counter()
    for c in coverage:
        for key, val in c.items():
            if isinstance(val, int):
                total[key] += val
    print(dict(total))


def write_csv(name, rows):
    if not rows:
        return
    with open(os.path.join(HERE, name), "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)


def render_pdf(folder, title, table_rows, cov):
    path = os.path.join(ENGINE, folder, "prospects.pdf")
    doc = SimpleDocTemplate(path, pagesize=landscape(A4), leftMargin=12 * mm, rightMargin=12 * mm,
                            topMargin=14 * mm, bottomMargin=14 * mm,
                            title=f"{title} Prospects", author="Visiominds")
    cell = ParagraphStyle("cell", fontName="Helvetica", fontSize=7, leading=8.6, textColor=INK)
    small = ParagraphStyle("small", parent=cell, fontSize=6.4, leading=7.8, textColor=GREY)
    bold = ParagraphStyle("bold", parent=cell, fontName="Helvetica-Bold")
    head = ParagraphStyle("head", parent=cell, fontName="Helvetica-Bold", textColor=colors.white)
    h1 = ParagraphStyle("h1", fontName="Helvetica-Bold", fontSize=16, leading=19, textColor=INK)
    sub = ParagraphStyle("sub", fontName="Helvetica", fontSize=8, leading=11, textColor=GREY)

    def p(text, style=cell):
        return Paragraph(text, style)

    data = [[p(h, head) for h in ("#", "Company", "Decision maker", "Role", "LinkedIn", "Source",
                                    "Verified email", "Note")]]
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), RED),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 3),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3),
    ]

    def li_cell(url, name, company):
        if url and is_company_page(url):
            return f'<a href="{escape(url)}" color="#FF3838">Company page</a>'
        if url:
            slug = re.sub(r"^https?://([a-z]{2,3}\.)?(www\.)?linkedin\.com/in/", "", unquote(url)).rstrip("/")
            slug = slug.encode("ascii", "ignore").decode().replace("--", "-")
            return f'<a href="{escape(url)}" color="#FF3838"><b>in/{escape(slug)}</b></a>'
        if name:
            return f'<a href="{escape(linkedin_search(name, company))}" color="#6B6B6B">Search</a>'
        return "&nbsp;"

    for k, row, rec, status, contacts, email, note in table_rows:
        if email:
            esrc = rec.get("email_src", "")
            email_cell = escape(email) + (f'<br/><font size="5.6" color="#6B6B6B">{escape(short_source(esrc))}</font>' if esrc else "")
        else:
            email_cell = "&nbsp;"
        company = f"<b>{escape(row['company'])}</b><br/><font color='#6B6B6B'>{escape(row['what'])}</font>"
        if rec.get("company_li"):
            company += f'<br/><a href="{escape(rec["company_li"])}" color="#FF3838">Company LinkedIn</a>'
        first = len(data)
        for i, c in enumerate(contacts or [["", "", "", ""]]):
            li = best_li(c)
            target = li or (linkedin_search(c[0], row["company"]) if c[0] else "")
            name = (f'<a href="{escape(target)}" color="#1A1A1A">{escape(c[0])}</a>' if c[0] else "&nbsp;")
            if c[2] and c[2] == li:
                src = "LinkedIn"
            elif c[2].startswith("http"):
                src = f'<a href="{escape(c[2])}" color="#FF3838">{escape(short_source(c[2]))}</a>'
            else:
                src = escape(c[2]) or "&nbsp;"
            lic = li_cell(li, c[0], row["company"])
            if i == 0:
                data.append([p(str(k[1])), p(company), p(name), p(escape(c[1]) or "&nbsp;"), p(lic), p(src),
                             p(email_cell), p(escape(note), small)])
            else:
                data.append(["", "", p(name), p(escape(c[1])), p(lic), p(src), "", ""])
        last = len(data) - 1
        if last > first:
            for col in (0, 1, 6, 7):
                style.append(("SPAN", (col, first), (col, last)))
        style.append(("LINEBELOW", (0, last), (-1, last), 0.4, RULE))
        if status in ("unmatched", "closed", "not_nigerian"):
            style.append(("BACKGROUND", (0, first), (-1, last), colors.HexColor("#FFF1F1")))
            style.append(("LINEBEFORE", (0, first), (0, last), 2, RED))
        elif status in ("duplicate", "unresearched") or rec.get("pending"):
            style.append(("BACKGROUND", (0, first), (-1, last), colors.HexColor("#F6F6F6")))

    widths = [7 * mm, 40 * mm, 31 * mm, 40 * mm, 40 * mm, 23 * mm, 30 * mm, 62 * mm]
    t = Table(data, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle(style))

    summary = (f"{cov['rows']} rows. {cov['researched']} researched, {cov['unresearched']} not yet researched. "
               f"{cov['with_named_contact']} have a named decision maker with a source, and "
               f"{cov['with_linkedin']} of those have a verified LinkedIn profile. "
               f"{cov['with_verified_email']} have a verified published email. "
               f"{cov['unmatched']} could not be matched to a real business, {cov['duplicate']} are duplicates, "
               f"{cov['not_nigerian']} are not Nigerian.")
    legend = ("Only sourced data is shown. Blank means unconfirmed. Red in/ links open the person's own LinkedIn "
              "profile; Search runs a LinkedIn people search where no profile was confirmed. "
              "Rows tinted red could not be matched, have closed, or are not Nigerian. Grey rows are duplicates "
              "or not yet researched. Personal emails are not listed because none were found in public sources.")

    def on_page(canvas, d):
        canvas.saveState()
        w, h = landscape(A4)
        canvas.setFillColor(RED)
        canvas.rect(0, h - 4 * mm, w, 4 * mm, stroke=0, fill=1)
        canvas.setFont("Helvetica-Bold", 7)
        canvas.setFillColor(INK)
        canvas.drawString(12 * mm, 7 * mm, "VISIOMINDS")
        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(GREY)
        canvas.drawRightString(w - 12 * mm, 7 * mm, f"{title}  |  Page {d.page}")
        canvas.restoreState()

    story = [p(f"{title} prospects", h1), Spacer(1, 2 * mm), p(summary, sub), p(legend, sub), Spacer(1, 4 * mm), t]
    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)


if __name__ == "__main__":
    build()
