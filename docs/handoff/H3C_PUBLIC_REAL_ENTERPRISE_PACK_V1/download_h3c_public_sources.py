#!/usr/bin/env python3
import argparse, hashlib, json, mimetypes, re, time
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

UA = "Mozilla/5.0 (compatible; V43-RealFactSourceFoundation/1.0)"
ALLOWED = {"h3c.com","www.h3c.com","wwwsg.h3c.com"}

def sha256_bytes(b):
    return hashlib.sha256(b).hexdigest()

def safe_name(s):
    s = re.sub(r'[\\/:*?"<>|]+', "_", s)
    return re.sub(r"\s+", "_", s).strip("._")[:120]

def allowed(url):
    host = (urlparse(url).hostname or "").lower()
    return host in ALLOWED or host.endswith(".h3c.com")

def ext_from(content_type, url):
    path = urlparse(url).path.lower()
    if path.endswith(".pdf"): return ".pdf"
    if "pdf" in (content_type or "").lower(): return ".pdf"
    if "html" in (content_type or "").lower(): return ".html"
    ext = Path(path).suffix
    return ext if 1 <= len(ext) <= 8 else ".bin"

def fetch(session, url, timeout=45):
    r = session.get(url, timeout=timeout, allow_redirects=True)
    r.raise_for_status()
    return r

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifest", required=True)
    ap.add_argument("--output", required=True)
    args = ap.parse_args()

    manifest = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    out = Path(args.output)
    raw = out/"raw"
    raw.mkdir(parents=True, exist_ok=True)

    sess = requests.Session()
    sess.headers.update({"User-Agent": UA})

    report = []
    pdf_seen = {}
    for src in manifest["sources"]:
        row = dict(src)
        row.update({"status":"PENDING","attachments":[]})
        try:
            r = fetch(sess, src["url"])
            body = r.content
            ctype = r.headers.get("content-type","")
            ext = ext_from(ctype, r.url)
            fname = f'{src["id"]}_{safe_name(src["title"])}{ext}'
            p = raw/fname
            p.write_bytes(body)
            row.update({
                "status":"DOWNLOADED",
                "final_resolved_url":r.url,
                "http_status":r.status_code,
                "content_type":ctype,
                "byte_size":len(body),
                "sha256":sha256_bytes(body),
                "local_path":str(p),
                "etag":r.headers.get("etag"),
                "last_modified":r.headers.get("last-modified"),
                "retrieved_at_epoch":time.time(),
            })

            # For HTML landing pages, discover same-domain PDF links and download them.
            if ext == ".html":
                soup = BeautifulSoup(body, "html.parser")
                links = []
                for a in soup.find_all("a", href=True):
                    u = urljoin(r.url, a["href"])
                    if allowed(u) and ".pdf" in urlparse(u).path.lower():
                        links.append(u)
                for idx,u in enumerate(dict.fromkeys(links), start=1):
                    try:
                        rr = fetch(sess,u)
                        bb = rr.content
                        h = sha256_bytes(bb)
                        if h in pdf_seen:
                            row["attachments"].append({
                                "url":u,"status":"DUPLICATE_SHA256",
                                "sha256":h,"duplicate_of":pdf_seen[h]
                            })
                            continue
                        apath = raw/f'{src["id"]}_attachment_{idx:02d}.pdf'
                        apath.write_bytes(bb)
                        pdf_seen[h]=str(apath)
                        row["attachments"].append({
                            "url":u,
                            "final_resolved_url":rr.url,
                            "status":"DOWNLOADED",
                            "sha256":h,
                            "byte_size":len(bb),
                            "content_type":rr.headers.get("content-type",""),
                            "local_path":str(apath),
                        })
                    except Exception as e:
                        row["attachments"].append({"url":u,"status":"FAILED","error":repr(e)})
        except Exception as e:
            row.update({"status":"FAILED","error":repr(e)})
        report.append(row)

    (out/"download_report.json").write_text(
        json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8"
    )

    # Build authority snapshot over successful raw artifacts.
    artifacts=[]
    for p in sorted(raw.glob("*")):
        if not p.is_file(): continue
        b=p.read_bytes()
        artifacts.append({
            "local_path":str(p),
            "byte_size":len(b),
            "sha256":sha256_bytes(b)
        })
    snap={
        "pack_id":manifest["pack_id"],
        "enterprise_id":manifest["enterprise_id"],
        "source_role":"REAL_PUBLIC_FIRST_PARTY",
        "artifact_count":len(artifacts),
        "artifacts":artifacts
    }
    (out/"source_authority_snapshot.json").write_text(
        json.dumps(snap,ensure_ascii=False,indent=2),encoding="utf-8"
    )

    failed=[r["id"] for r in report if r["status"]!="DOWNLOADED"]
    print(json.dumps({
        "sources":len(report),
        "downloaded":len(report)-len(failed),
        "failed":failed,
        "artifacts":len(artifacts)
    },ensure_ascii=False,indent=2))

if __name__ == "__main__":
    main()
