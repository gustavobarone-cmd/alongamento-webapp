#!/usr/bin/env python3
"""
fill_youtube_ids.py
Preenche video.youtubeId automaticamente no stretches_bank_v1.json usando YouTube Data API v3.

Uso:
  pip install requests
  python tools/fill_youtube_ids.py --api_key SUA_CHAVE

Saídas:
  - stretches_bank_v1.json (atualizado)
  - youtube_links.csv (mapeamento para revisão)
"""
import argparse, csv, json, time
import requests

API = "https://www.googleapis.com/youtube/v3/search"

def pick_query(item):
  v = item.get("video") or {}
  q = (v.get("searchQuery") or "").strip()
  if not q:
    q = ((item.get("name_en") or item.get("name_pt") or item.get("id") or "") + " stretch").strip()
  return q

def get_items(bank):
  if isinstance(bank, dict) and "items" in bank:
    return bank["items"], True
  if isinstance(bank, list):
    return bank, False
  raise ValueError("Formato inválido de JSON")

def search_one(api_key, q, license_filter):
  params = {
    "part": "snippet",
    "type": "video",
    "maxResults": 1,
    "order": "relevance",
    "q": q,
    "safeSearch": "strict",
    "videoEmbeddable": "true",
    "videoSyndicated": "true",
    "key": api_key,
  }
  if license_filter == "cc":
    params["videoLicense"] = "creativeCommon"
  r = requests.get(API, params=params, timeout=30)
  r.raise_for_status()
  data = r.json()
  items = data.get("items") or []
  if not items:
    return None
  vid = (items[0].get("id") or {}).get("videoId")
  snip = items[0].get("snippet") or {}
  return vid, snip.get("title",""), snip.get("channelTitle","")

def main():
  ap = argparse.ArgumentParser()
  ap.add_argument("--api_key", required=True)
  ap.add_argument("--input", default="stretches_bank_v1.json")
  ap.add_argument("--output", default="stretches_bank_v1.json")
  ap.add_argument("--csv", default="youtube_links.csv")
  ap.add_argument("--license", choices=["any","cc"], default="any")
  ap.add_argument("--sleep", type=float, default=0.25)
  args = ap.parse_args()

  with open(args.input, "r", encoding="utf-8") as f:
    bank = json.load(f)

  items, wrapped = get_items(bank)
  rows = []
  filled = 0

  for it in items:
    it.setdefault("video", {"provider":"youtube"})
    if it["video"].get("youtubeId"):
      continue
    q = pick_query(it)
    try:
      res = search_one(args.api_key, q, args.license)
      if res:
        vid, title, channel = res
        it["video"]["provider"] = "youtube"
        it["video"]["youtubeId"] = vid
        rows.append([it.get("id",""), it.get("name_en",""), it.get("phase",""), vid, q, title, channel])
        filled += 1
      else:
        rows.append([it.get("id",""), it.get("name_en",""), it.get("phase",""), "", q, "", ""])
    except Exception as e:
      rows.append([it.get("id",""), it.get("name_en",""), it.get("phase",""), "", q, "ERROR", str(e)])
    time.sleep(args.sleep)

  if wrapped:
    bank["items"] = items
    bank["count"] = len(items)
    out = bank
  else:
    out = items

  with open(args.output, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=2)

  with open(args.csv, "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["id","name_en","phase","youtubeId","query","video_title","channel"])
    w.writerows(rows)

  print(f"OK: preenchidos {filled}. CSV: {args.csv}. JSON: {args.output}")

if __name__ == "__main__":
  main()
