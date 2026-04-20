#!/usr/bin/env python3
"""
Generate unique cover images for audiobook episodes using Pollinations.ai (free, no auth).
Skips Bedtime Explorers series. Skips products that already have a unique image (not audio-003).
Updates products.json with the new image paths.
"""
import json
import os
import time
import urllib.request
import urllib.parse
import sys

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

PRODUCTS_FILE = "data/products.json"
OUTPUT_DIR = "public/images"
BASE_URL = "https://image.pollinations.ai/prompt"
WIDTH = 512
HEIGHT = 512

SERIES_STYLE = {
    "Rock Hunters": "cute 3D cartoon style, kids adventure geology audiobook cover, rocks and gems theme, white background",
    "Explorer Radio": "cute 3D cartoon style, kids science radio show cover, exploration and discovery theme, white background",
    "Bedtime Travelers": "cute 3D cartoon style, kids bedtime history adventure audiobook cover, time travel theme, white background",
    "Scripture Study Companion": "cute 3D cartoon style, kids scripture study audiobook cover, peaceful and reverent, white background",
    "Bedtime Memories": "cute 3D cartoon style, kids cozy bedtime memories audiobook cover, warm and comforting, white background",
}

DEFAULT_STYLE = "cute 3D cartoon style, kids audiobook cover, white background"


def load_products():
    with open(PRODUCTS_FILE, encoding="utf-8") as f:
        return json.load(f)


def save_products(products):
    with open(PRODUCTS_FILE, "w", encoding="utf-8") as f:
        json.dump(products, f, indent=2, ensure_ascii=False)


def build_prompt(product):
    series = product.get("series", "")
    style = SERIES_STYLE.get(series, DEFAULT_STYLE)
    name = product["name"]
    desc = product.get("shortDescription", "")
    return f"{name} - {desc}, {style}"


def download_image(prompt, output_path, retries=2):
    encoded = urllib.parse.quote(prompt)
    url = f"{BASE_URL}/{encoded}?width={WIDTH}&height={HEIGHT}&nologo=true"
    for attempt in range(retries + 1):
        try:
            urllib.request.urlretrieve(url, output_path)
            size = os.path.getsize(output_path)
            if size > 5000:
                return True
            else:
                print(f"    Too small ({size} bytes), retrying...")
                os.remove(output_path)
        except Exception as e:
            print(f"    Error: {e}")
            if attempt < retries:
                time.sleep(3)
    return False


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    products = load_products()

    targets = [
        p for p in products
        if p.get("isAudiobook")
        and p.get("series") != "Bedtime Explorers"
        and p.get("imageUrl") in ("/images/audio-003.png", "/images/audio-003.svg")
    ]

    print(f"Found {len(targets)} audiobook products needing unique images")
    print("=" * 60)

    generated = 0
    skipped = 0

    for i, product in enumerate(targets):
        pid = product["id"]
        filename = f"{pid}.png"
        output_path = os.path.join(OUTPUT_DIR, filename)

        if os.path.exists(output_path):
            print(f"[{i+1}/{len(targets)}] {pid} — already exists, updating JSON only")
            product["imageUrl"] = f"/images/{filename}"
            product["images"] = [f"/images/{filename}"]
            skipped += 1
            continue

        print(f"[{i+1}/{len(targets)}] {pid} — {product['name']}")
        prompt = build_prompt(product)

        if download_image(prompt, output_path):
            product["imageUrl"] = f"/images/{filename}"
            product["images"] = [f"/images/{filename}"]
            generated += 1
            print(f"    Saved: {filename} ({os.path.getsize(output_path):,} bytes)")
        else:
            print(f"    FAILED — keeping default image")

        # Small delay to be polite
        if i < len(targets) - 1:
            time.sleep(1)

    save_products(products)
    print(f"\n{'=' * 60}")
    print(f"Done! Generated: {generated}, Already existed: {skipped}, Total: {len(targets)}")
    print(f"products.json updated with new image paths")


if __name__ == "__main__":
    main()
