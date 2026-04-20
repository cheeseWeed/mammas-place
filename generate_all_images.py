#!/usr/bin/env python3
"""
Generate unique cover images for ALL products using Pollinations.ai (free, no auth).
Skips Bedtime Explorers audiobook series.
Skips products that already have a .png image in public/images/.
Updates products.json with the new image paths.

Usage:
  python generate_all_images.py                  # run all
  python generate_all_images.py 1 3              # chunk 1 of 3
  python generate_all_images.py 2 3              # chunk 2 of 3
  python generate_all_images.py 3 3              # chunk 3 of 3
  python generate_all_images.py --update-json    # just update products.json from existing PNGs
"""
import json
import os
import subprocess
import time
import urllib.parse
import random
import sys

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

PRODUCTS_FILE = "data/products.json"
OUTPUT_DIR = "public/images"
BASE_URL = "https://image.pollinations.ai/prompt"
WIDTH = 512
HEIGHT = 512
DELAY = 60


def needs_new_image(product):
    # Skip all audiobook/podcast series
    if product.get("isAudiobook"):
        return False
    if product.get("series") == "Bedtime Explorers":
        return False
    # If a PNG already exists on disk, skip
    png_path = os.path.join(OUTPUT_DIR, f"{product['id']}.png")
    if os.path.exists(png_path) and os.path.getsize(png_path) > 5000:
        return False
    return True


def build_prompt(product):
    name = product["name"]
    desc = product.get("shortDescription", product.get("description", "")[:100])
    category = product.get("category", "")

    style = "cute 3D cartoon toy style, product centered, white background, no text"

    if category == "audiobooks" or product.get("isAudiobook"):
        series = product.get("series", "")
        if "study guide" in name.lower() or "sg-" in product["id"]:
            style = "cute 3D cartoon style, kids study guide cover, peaceful and reverent, white background, no text"
        elif series:
            style = f"cute 3D cartoon style, kids {series} audiobook cover, white background, no text"
    elif category == "classic-cars":
        style = "photorealistic, classic car, studio shot, white background, no text"
    elif category == "services":
        style = "cute 3D cartoon style, professional service illustration, white background, no text"
    elif category == "restaurant":
        style = "appetizing food photography style, plated dish, white background, no text"
    elif category == "sports":
        style = "cute 3D cartoon toy style, sports equipment, white background, no text"
    elif category == "exercise":
        style = "cute 3D cartoon toy style, gym equipment, white background, no text"
    elif category == "automotive":
        style = "cute 3D cartoon toy style, car part, white background, no text"
    elif category == "grocery":
        style = "cute 3D cartoon toy style, grocery product, white background, no text"
    elif category == "lawn-garden":
        style = "cute 3D cartoon toy style, lawn and garden product, white background, no text"
    elif category == "home-decor":
        style = "cute 3D cartoon toy style, home decor item, white background, no text"

    return f"{name} - {desc}, {style}"


def download_image(prompt, output_path):
    encoded = urllib.parse.quote(prompt)
    seed = random.randint(1, 999999)
    url = f"{BASE_URL}/{encoded}?width={WIDTH}&height={HEIGHT}&nologo=true&seed={seed}"
    for attempt in range(3):
        try:
            result = subprocess.run(
                ["curl", "-L", "-o", output_path, url, "--max-time", "60", "-s", "-w", "%{http_code}"],
                capture_output=True, text=True, timeout=75
            )
            http_code = result.stdout.strip()
            if os.path.exists(output_path):
                size = os.path.getsize(output_path)
                if size > 5000 and http_code == "200":
                    return True
                elif http_code == "429":
                    wait = 60 * (attempt + 1)
                    print(f"    Rate limited (429), waiting {wait}s...", flush=True)
                    os.remove(output_path)
                    time.sleep(wait)
                    continue
                else:
                    print(f"    Bad response (HTTP {http_code}, {size} bytes)", flush=True)
                    os.remove(output_path)
            else:
                if http_code == "429":
                    wait = 60 * (attempt + 1)
                    print(f"    Rate limited (429), waiting {wait}s...", flush=True)
                    time.sleep(wait)
                    continue
                print(f"    No file created (HTTP {http_code})", flush=True)
        except subprocess.TimeoutExpired:
            print(f"    Timeout", flush=True)
            if os.path.exists(output_path):
                os.remove(output_path)
        except Exception as e:
            print(f"    Error: {e}", flush=True)
        break
    return False


def update_json_only():
    """Update products.json imageUrl for any product that has a PNG on disk."""
    with open(PRODUCTS_FILE, encoding="utf-8") as f:
        products = json.load(f)
    updated = 0
    for p in products:
        if p.get("series") == "Bedtime Explorers":
            continue
        pid = p["id"]
        png_path = os.path.join(OUTPUT_DIR, f"{pid}.png")
        if os.path.exists(png_path) and os.path.getsize(png_path) > 5000:
            new_url = f"/images/{pid}.png"
            if p.get("imageUrl") != new_url:
                p["imageUrl"] = new_url
                p["images"] = [new_url]
                updated += 1
    with open(PRODUCTS_FILE, "w", encoding="utf-8") as f:
        json.dump(products, f, indent=2, ensure_ascii=False)
    print(f"Updated {updated} product image URLs in products.json", flush=True)


def main():
    # Parse chunk args
    chunk = None
    total_chunks = None
    if len(sys.argv) == 2 and sys.argv[1] == "--update-json":
        update_json_only()
        return
    if len(sys.argv) == 3:
        chunk = int(sys.argv[1])
        total_chunks = int(sys.argv[2])

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with open(PRODUCTS_FILE, encoding="utf-8") as f:
        products = json.load(f)

    targets = [p for p in products if needs_new_image(p)]

    # Split into chunks if requested
    if chunk and total_chunks:
        chunk_size = len(targets) // total_chunks
        start = (chunk - 1) * chunk_size
        end = start + chunk_size if chunk < total_chunks else len(targets)
        targets = targets[start:end]
        print(f"Chunk {chunk}/{total_chunks}: products {start+1}-{end}", flush=True)

    print(f"Found {len(targets)} products to generate", flush=True)
    print("=" * 60, flush=True)

    generated = 0
    failed = 0

    for i, product in enumerate(targets):
        pid = product["id"]
        filename = f"{pid}.png"
        output_path = os.path.join(OUTPUT_DIR, filename)

        print(f"[{i+1}/{len(targets)}] {pid} — {product['name']}", flush=True)
        prompt = build_prompt(product)

        if download_image(prompt, output_path):
            generated += 1
            print(f"    Saved: {filename} ({os.path.getsize(output_path):,} bytes)", flush=True)
        else:
            failed += 1
            print(f"    FAILED", flush=True)

        if i < len(targets) - 1:
            time.sleep(DELAY)

    print(f"\n{'=' * 60}", flush=True)
    print(f"Done! Generated: {generated}, Failed: {failed}, Total: {len(targets)}", flush=True)

    # If running solo (no chunks), update JSON directly
    if not chunk:
        update_json_only()
    else:
        print(f"Run 'python generate_all_images.py --update-json' after all chunks finish", flush=True)


if __name__ == "__main__":
    main()
