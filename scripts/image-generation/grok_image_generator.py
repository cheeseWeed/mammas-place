#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')
"""
Mamma's Place — Grok Image Generator
=====================================
Generates cute 3D emoji/toy style product images using Grok's free web image generator.
A fun project with kids! No API keys, no paid accounts needed.

SETUP (run once):
  pip install playwright
  playwright install chromium

RUN:
  python grok_image_generator.py

HOW IT WORKS:
  1. Reads products.txt as the work queue (product_id|description, one per line)
  2. Lines starting with # are comments/skipped
  3. Lines starting with DONE: have already been completed — skipped automatically
  4. When an image is saved successfully, the line is updated to DONE: in products.txt
  5. Opens a real browser to grok.com, pauses for manual login if needed
  6. Saves session so future runs start already logged in
  7. Saves images to public/images/{product_id}.png
  8. Stops cleanly if Grok rate-limits us, resume tomorrow — it picks up where it left off

PRODUCTS.TXT FORMAT:
  # This is a comment — ignored
  pony-001|Rainbow Sparkle Pony with rainbow mane and glitter hooves
  DONE: pony-002|Princess Starlight Pony with golden crown   ← already done, skipped
  # unicorn-001|skip this one for now — commented out

UPDATING SELECTORS (if Grok's UI changes):
  - Open https://grok.com in Chrome, press F12 → DevTools
  - Ctrl+Shift+C to pick an element, click:
      * The chat input box  → update selectors in find_input()
      * The send button     → update selectors in find_send_button()
      * A generated image   → update SELECTOR_IMAGE_CANDIDATES list
  - Look for: id, data-testid, aria-label, class names

STYLE PROMPT:
  Edit STYLE_PROMPT below to change the art style for all images.
  [PRODUCT] is replaced with the description from products.txt.
"""

import asyncio
import json
import os
import re
import random
import time
from pathlib import Path
from playwright.async_api import async_playwright

# ─────────────────────────────────────────────
# CONFIGURATION — edit these as needed
# ─────────────────────────────────────────────

# Work queue — one product per line, marked DONE: when complete
PRODUCTS_FILE = "products.txt"

# Where to save generated images
OUTPUT_DIR = "public/images"

# Session file — keeps you logged in between runs
SESSION_FILE = "grok_session.json"

# Grok URL — the existing conversation that already has the style reference images
# (horse, pig, frog etc.) so Grok knows exactly what style to match
GROK_URL = "https://grok.com/c/579d59e4-6a72-459c-8e50-6271876e4d6a"

# How long to wait for an image to appear (seconds)
IMAGE_TIMEOUT = 120

# Random delay between products (seconds) — mimics human behaviour
DELAY_MIN = 20
DELAY_MAX = 45

# ─────────────────────────────────────────────
# SELECTORS — update these if Grok's UI changes
# ─────────────────────────────────────────────

# Generated image selectors — tried in order, first visible match wins
SELECTOR_IMAGE_CANDIDATES = [
    'img[alt="Generated image"]',          # /imagine page grid
    'li img[alt="Generated image"]',       # /imagine page list item
    'div[data-testid*="message"]:last-child img',
    'div[role="img"]',
    '.grok-image img',
    'div[class*="response"] img',
    'div[class*="message"]:last-child img',
    'img[alt*="generated"]',
    'img[alt*="image"]',
    'div[class*="conversation"] img:last-of-type',
]

# Words that mean we've hit a rate limit
RATE_LIMIT_PHRASES = [
    "limit", "daily", "wait", "reached your", "subscribers only",
    "try again later", "rate limit", "upgrade", "free tier", "quota"
]

# ─────────────────────────────────────────────
# STYLE PROMPT TEMPLATE
# [PRODUCT] is replaced with the product description
# ─────────────────────────────────────────────

STYLE_PROMPT = """Use the exact same style as the images earlier in this conversation. Create a [PRODUCT]. Product centered, white background. Do not add horns, wings, or features that aren't part of the product description."""


# ─────────────────────────────────────────────
# PRODUCTS.TXT HELPERS
# ─────────────────────────────────────────────

def load_products():
    """
    Read products.txt and return the full lines list plus pending items.
    Returns: (all_lines, pending_list)
      all_lines   — every raw line in the file (for rewriting with DONE: markers)
      pending_list — list of (line_index, product_id, description) not yet done
    """
    if not os.path.exists(PRODUCTS_FILE):
        print(f"ERROR: {PRODUCTS_FILE} not found!")
        return [], []

    with open(PRODUCTS_FILE, "r", encoding="utf-8") as f:
        all_lines = f.readlines()

    pending = []
    done_count = 0
    for i, line in enumerate(all_lines):
        stripped = line.strip()
        # Skip blank lines and comments
        if not stripped or stripped.startswith("#"):
            continue
        # Skip already-done lines
        if stripped.startswith("DONE:"):
            done_count += 1
            continue
        # Parse product_id|description
        parts = stripped.split("|", 1)
        if len(parts) == 2:
            product_id = parts[0].strip()
            description = parts[1].strip()
            pending.append((i, product_id, description))
        else:
            print(f"  Skipping malformed line {i+1}: {stripped}")

    total = done_count + len(pending)
    print(f"Products: {done_count} done, {len(pending)} remaining (total {total})")
    return all_lines, pending


def mark_done(all_lines, line_index, product_id, description):
    """
    Rewrite the line at line_index with a DONE: prefix and save products.txt.
    This gives a clear visual record of what's been completed.
    """
    all_lines[line_index] = f"DONE: {product_id}|{description}\n"
    with open(PRODUCTS_FILE, "w", encoding="utf-8") as f:
        f.writelines(all_lines)


# ─────────────────────────────────────────────
# BROWSER HELPERS
# ─────────────────────────────────────────────

def sanitize_filename(name):
    """Turn a product id into a safe filename."""
    return re.sub(r'[^a-zA-Z0-9_\-]', '-', name).lower()


def build_prompt(description):
    """Replace [PRODUCT] in the style prompt with the actual product description."""
    return STYLE_PROMPT.replace("[PRODUCT]", description)


def update_product_image_url(product_id, image_url):
    """Update the imageUrl for a product in products.json."""
    try:
        with open("data/products.json", encoding="utf-8") as f:
            products = json.load(f)
        for p in products:
            if p.get("id") == product_id:
                p["imageUrl"] = image_url
                break
        with open("data/products.json", "w", encoding="utf-8") as f:
            json.dump(products, f, indent=2, ensure_ascii=False)
        print(f"  Updated products.json imageUrl -> {image_url}")
    except Exception as e:
        print(f"  Warning: could not update products.json: {e}")


def check_rate_limited(text):
    """Return True if the response text looks like a rate limit message."""
    text_lower = text.lower()
    return any(phrase in text_lower for phrase in RATE_LIMIT_PHRASES)


async def save_session(context, path):
    """Save browser cookies/storage so we stay logged in next run."""
    storage = await context.storage_state()
    with open(path, "w") as f:
        json.dump(storage, f)
    print(f"  Session saved to {path}")


async def find_input(page):
    """Find the chat input box — tries multiple selectors."""
    for selector in [
        'div.tiptap.ProseMirror',
        'div[contenteditable="true"]',
        '[placeholder="Ask Grok"]',
        'textarea',
        '[data-testid*="input"]',
        '[placeholder*="Ask"]',
        '[aria-label*="message"]',
        '[aria-label*="chat"]',
    ]:
        try:
            el = page.locator(selector).first
            if await el.is_visible(timeout=8000):
                return el
        except Exception:
            continue
    return None


async def find_send_button(page):
    """Find the send/submit button — tries multiple selectors."""
    for selector in [
        'button[aria-label*="Send"]',
        'button[type="submit"]',
        '[data-testid*="send"]',
    ]:
        try:
            el = page.locator(selector).first
            if await el.is_visible(timeout=2000):
                return el
        except Exception:
            continue
    return None


async def count_images(page):
    """Count currently visible generated images on the page."""
    try:
        return await page.locator('img[alt="Generated image"]').count()
    except Exception:
        return 0




async def wait_for_image(page, images_before=0, timeout_seconds=IMAGE_TIMEOUT):
    """
    Wait for a NEW generated image to appear (more than images_before).
    Returns the image element, "RATE_LIMITED", or None if timed out.
    """
    print(f"  Waiting up to {timeout_seconds}s for image...")
    deadline = time.time() + timeout_seconds

    while time.time() < deadline:
        # Check for rate limiting — only look at the last message, not whole page
        try:
            last_msgs = page.locator('div[class*="message"], div[class*="response"]')
            count = await last_msgs.count()
            if count > 0:
                last_text = await last_msgs.nth(count - 1).inner_text(timeout=1000)
                if check_rate_limited(last_text):
                    return "RATE_LIMITED"
        except Exception:
            pass

        # Check if a new image appeared
        try:
            images = page.locator('img[alt="Generated image"]')
            count = await images.count()
            if count > images_before:
                img = images.nth(count - 1)  # newest = last
                if await img.is_visible(timeout=1000):
                    print(f"  Found image ({count} total)")
                    return img
        except Exception:
            pass

        # Fallback: try other selectors
        for selector in SELECTOR_IMAGE_CANDIDATES[2:]:  # skip the /imagine ones already tried
            try:
                imgs = page.locator(selector)
                c = await imgs.count()
                if c > 0:
                    img = imgs.nth(c - 1)
                    if await img.is_visible(timeout=1000):
                        print(f"  Found image using fallback: {selector}")
                        return img
            except Exception:
                continue

        await asyncio.sleep(3)

    print("  Timed out waiting for image")
    return None


async def save_image(page, img_element, output_path):
    """Download the image src directly rather than screenshotting."""
    try:
        # Get the src URL of the image element
        src = await img_element.get_attribute("src")
        if not src:
            raise Exception("No src attribute on image")

        # Download it via fetch in the browser context
        image_data = await page.evaluate("""async (url) => {
            const resp = await fetch(url);
            const buffer = await resp.arrayBuffer();
            const bytes = new Uint8Array(buffer);
            let binary = '';
            for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
            return btoa(binary);
        }""", src)

        import base64
        with open(output_path, "wb") as f:
            f.write(base64.b64decode(image_data))
        size = os.path.getsize(output_path)
        print(f"  Saved: {output_path} ({size:,} bytes)")
        return size > 1000  # reject tiny/empty files
    except Exception as e:
        print(f"  Download failed ({e}), trying screenshot fallback...")
        try:
            # Wait for image to fully load before screenshotting
            await page.wait_for_function(
                "(el) => el.complete && el.naturalWidth > 0",
                arg=img_element,
                timeout=10000
            )
            await img_element.screenshot(path=output_path)
            size = os.path.getsize(output_path)
            print(f"  Saved via screenshot: {output_path} ({size:,} bytes)")
            return size > 1000
        except Exception as e2:
            print(f"  Screenshot also failed: {e2}")
            return False


# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────

async def main():
    Path(OUTPUT_DIR).mkdir(parents=True, exist_ok=True)

    # Load work queue
    all_lines, pending = load_products()
    if not pending:
        print("Nothing to do — all products are marked DONE: in products.txt!")
        print("To redo a product: remove the 'DONE: ' prefix from its line.")
        return

    print(f"\nWill generate images for {len(pending)} products")

    async with async_playwright() as p:
        # ── Connect to the already-open MCP Playwright browser (port 9223) ──
        print(f"\nConnecting to existing browser on port 9223...")
        try:
            browser = await p.chromium.connect_over_cdp("http://localhost:9223")
            context = browser.contexts[0]
            pages = context.pages
            page = next((pg for pg in pages if "grok.com" in pg.url), pages[0])
            print(f"  Connected to: {page.url}")
            if GROK_URL not in page.url:
                await page.goto(GROK_URL, wait_until="domcontentloaded", timeout=30000)
                await asyncio.sleep(3)
        except Exception as e:
            print(f"  Could not connect to port 9223: {e}")
            print(f"  Falling back to launching new browser with saved session...")
            state_file = os.path.abspath("grok_session_data/state.json")
            browser = await p.chromium.launch(headless=False, args=["--start-maximized"])
            if os.path.exists(state_file):
                context = await browser.new_context(storage_state=state_file, no_viewport=True)
            else:
                context = await browser.new_context(no_viewport=True)
            pages = context.pages
            page = pages[0] if pages else await context.new_page()
            await page.goto(GROK_URL, wait_until="domcontentloaded", timeout=30000)
            await asyncio.sleep(4)

        # Verify we're logged in
        try:
            await page.wait_for_selector('div.tiptap.ProseMirror', timeout=10000)
            print("  Logged in — continuing!")
        except Exception:
            print("  ERROR: Could not find chat input. Are you logged in to Grok?")
            return

        print(f"\nStarting generation - {len(pending)} to go")
        print("-" * 60)

        for i, (line_index, product_id, description) in enumerate(pending):
            print(f"\n[{i+1}/{len(pending)}] {product_id}")
            print(f"  {description}")

            filename = sanitize_filename(product_id) + ".png"
            output_path = os.path.join(OUTPUT_DIR, filename)

            # Already exists on disk — mark done and skip
            if os.path.exists(output_path):
                print(f"  Image already exists — marking done")
                mark_done(all_lines, line_index, product_id, description)
                continue

            # Type and send the prompt
            input_el = await find_input(page)
            if not input_el:
                print("  ERROR: Can't find the chat input box!")
                print("  Check find_input() selectors — see UPDATING SELECTORS in the header.")
                break

            # Count images before sending so we can detect the new one
            images_before = await count_images(page)

            prompt = build_prompt(description)
            await input_el.click()
            # Clear existing content (contenteditable div — fill() doesn't work)
            await page.keyboard.press("Control+a")
            await page.keyboard.press("Delete")
            await asyncio.sleep(0.3)
            # Type the prompt via keyboard so contenteditable div receives it
            await page.keyboard.type(prompt, delay=5)
            await asyncio.sleep(1)

            # Send button appears after typing — wait briefly for it
            await asyncio.sleep(0.5)
            send_btn = await find_send_button(page)
            if send_btn:
                await send_btn.click()
            else:
                await page.keyboard.press("Enter")

            print("  Prompt sent...")
            await asyncio.sleep(2)

            # Wait for the new image
            result = await wait_for_image(page, images_before=images_before)

            if result == "RATE_LIMITED":
                print("\n" + "="*60)
                print("  RATE LIMITED — Grok says we've hit the daily limit.")
                print("  Run again tomorrow — products.txt shows where we stopped.")
                print("="*60)
                break

            elif result is None:
                print(f"  No image appeared — skipping (not marking done so we retry next run)")

            else:
                success = await save_image(page, result, output_path)
                if success:
                    mark_done(all_lines, line_index, product_id, description)
                    print(f"  Marked DONE in products.txt")
                    update_product_image_url(product_id, f"/images/{sanitize_filename(product_id)}.png")

            # Human-like delay before next product
            if i < len(pending) - 1:
                delay = random.randint(DELAY_MIN, DELAY_MAX)
                # Occasionally type something tiny then clear it
                if random.random() < 0.25:
                    try:
                        tiny = await find_input(page)
                        if tiny:
                            await tiny.fill(".")
                            await asyncio.sleep(0.8)
                            await tiny.fill("")
                    except Exception:
                        pass
                print(f"  Waiting {delay}s...")
                await asyncio.sleep(delay)

        # Only close if we launched our own browser (not CDP-connected)
        try:
            if hasattr(browser, '_impl_obj') and browser._impl_obj._is_remote:
                pass  # don't close CDP-connected browser
            else:
                await context.close()
                await browser.close()
        except Exception:
            pass

    # Count how many are done now
    done = sum(1 for l in all_lines if l.strip().startswith("DONE:"))
    total = sum(1 for l in all_lines if l.strip() and not l.strip().startswith("#"))
    print(f"\n{'='*60}")
    print(f"  Finished! {done}/{total} products done.")
    print(f"  Images saved to: {OUTPUT_DIR}/")
    print(f"  Check products.txt to see what's done and what's left.")
    print(f"{'='*60}")


if __name__ == "__main__":
    asyncio.run(main())
