#!/usr/bin/env python3
"""
Build the spelling word bank for the Spelling Bee section.
Output: data/spelling/words.json
"""

import json
import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "spelling" / "words.json"

# Vowels for simple heuristics
VOWELS = set("aeiouy")


def syllable_count(word: str) -> int:
    """Cheap heuristic syllable counter — good enough for a kids' app."""
    w = word.lower().strip()
    if not w:
        return 1
    # Handle single letters / digraphs
    if len(w) <= 2:
        return 1
    count = 0
    prev_was_vowel = False
    for ch in w:
        is_vowel = ch in VOWELS
        if is_vowel and not prev_was_vowel:
            count += 1
        prev_was_vowel = is_vowel
    # silent e
    if w.endswith("e") and count > 1 and not w.endswith("le"):
        count -= 1
    if w.endswith("le") and len(w) > 2 and w[-3] not in VOWELS:
        count += 0  # already counted
    return max(1, count)


def entry(word, level, patterns, sentence, audio_spelling=None, homophones=None, syllables=None):
    e = {
        "word": word,
        "level": level,
        "patterns": patterns,
        "syllables": syllables if syllables is not None else syllable_count(word),
        "sentence": sentence,
    }
    if audio_spelling:
        e["audioSpelling"] = audio_spelling
    if homophones:
        e["homophones"] = homophones
        if "homophone" not in patterns:
            e["patterns"] = patterns + ["homophone"]
    else:
        e["homophones"] = []
    return e


# ============================================================
# LEVEL 0 — Letters & Sounds
# ============================================================
def level0():
    items = []
    letters = "abcdefghijklmnopqrstuvwxyz"
    letter_sentences = {
        "a": "A is for apple.",
        "b": "B is for ball.",
        "c": "C is for cat.",
        "d": "D is for dog.",
        "e": "E is for egg.",
        "f": "F is for fish.",
        "g": "G is for goat.",
        "h": "H is for hat.",
        "i": "I is for ice.",
        "j": "J is for jam.",
        "k": "K is for kite.",
        "l": "L is for leaf.",
        "m": "M is for moon.",
        "n": "N is for nest.",
        "o": "O is for ox.",
        "p": "P is for pig.",
        "q": "Q is for queen.",
        "r": "R is for rain.",
        "s": "S is for sun.",
        "t": "T is for top.",
        "u": "U is for up.",
        "v": "V is for van.",
        "w": "W is for web.",
        "x": "X is for box.",
        "y": "Y is for yes.",
        "z": "Z is for zoo.",
    }
    for L in letters:
        items.append({
            "word": L,
            "level": 0,
            "patterns": ["letter"],
            "syllables": 1,
            "sentence": letter_sentences[L],
            "audioSpelling": L,
            "homophones": [],
        })

    phonemes = [
        ("sh", "Shh! The shop is closed.", "digraph-sh"),
        ("ch", "Chips are crunchy."), # tag will be set below
        ("th", "Think before you speak."),
        ("ph", "A phone can ring loud."),
        ("ng", "Sing a long song."),
        ("ck", "Pick a duck from the pond."),
        ("ll", "Tell a tall tale."),
        ("ee", "Bees love trees."),
        ("oo", "The moon is round."),
        ("ai", "Rain falls on the trail."),
        ("ay", "Play all day."),
        ("oa", "A goat ate the oats."),
        ("ow", "A cow says wow."),
        ("ou", "Shout out loud."),
        ("oy", "The boy has a toy."),
        ("ie", "A pie is in the sky."),
        ("igh", "The light is bright."),
        ("ar", "A star is far."),
        ("or", "Open the corn jar."),
        ("er", "Her sister is older."),
    ]
    sentence_map = {
        "sh": "Shh! The shop is closed.",
        "ch": "Chips are crunchy.",
        "th": "Think before you speak.",
        "ph": "A phone can ring loud.",
        "ng": "Sing a long song.",
        "ck": "Pick a duck from the pond.",
        "ll": "Tell a tall tale.",
        "ee": "Bees love trees.",
        "oo": "The moon is round.",
        "ai": "Rain falls on the trail.",
        "ay": "Play all day.",
        "oa": "A goat ate the oats.",
        "ow": "A cow says wow.",
        "ou": "Shout out loud.",
        "oy": "The boy has a toy.",
        "ie": "A pie is in the sky.",
        "igh": "The light is bright.",
        "ar": "A star is far.",
        "or": "Open the corn jar.",
        "er": "Her sister is older.",
    }
    digraph_set = {"sh", "ch", "th", "ph", "wh"}
    for ph in sentence_map:
        tags = ["phoneme"]
        if ph in digraph_set:
            tags.append(f"digraph-{ph}")
        else:
            tags.append("phoneme-blend")
        items.append({
            "word": ph,
            "level": 0,
            "patterns": tags,
            "syllables": 1,
            "sentence": sentence_map[ph],
            "audioSpelling": "-".join(list(ph)),
            "homophones": [],
        })
    return items


# ============================================================
# LEVEL 1 — CVC words
# ============================================================
def level1():
    cvc = [
        # a
        ("cat", "The cat sat on the mat."),
        ("bat", "A bat flew at night."),
        ("hat", "Put on your red hat."),
        ("mat", "Wipe your feet on the mat."),
        ("rat", "A rat ran past the box."),
        ("sat", "I sat in the chair."),
        ("fat", "The fat pig oinked."),
        ("pat", "Pat the puppy gently."),
        ("can", "I can run fast."),
        ("man", "The man waved hello."),
        ("pan", "Eggs cook in the pan."),
        ("ran", "She ran to school."),
        ("fan", "The fan keeps us cool."),
        ("tan", "His shoes are tan."),
        ("van", "We rode in the van."),
        ("ban", "We ban candy at lunch."),
        ("bag", "Pack your school bag."),
        ("tag", "Let's play tag at recess."),
        ("rag", "Wipe the spill with a rag."),
        ("wag", "Dogs wag their tails."),
        ("nag", "Please don't nag me."),
        ("dad", "My dad makes pancakes."),
        ("had", "I had a fun day."),
        ("mad", "Don't be mad at me."),
        ("sad", "The puppy looks sad."),
        ("pad", "Write on the pad."),
        ("jam", "I like jam on toast."),
        ("ham", "We had ham for lunch."),
        ("yam", "A yam is like a sweet potato."),
        ("cap", "Wear your cap outside."),
        ("map", "The map shows the way."),
        ("nap", "Take a quick nap."),
        ("tap", "Tap the drum lightly."),
        ("lap", "The cat sat on my lap."),
        ("zap", "The bug zapper went zap."),
        # e
        ("bed", "Climb into your bed."),
        ("red", "The apple is red."),
        ("led", "She led the way."),
        ("fed", "I fed the fish."),
        ("wed", "The two will wed soon."),
        ("get", "Get your shoes on."),
        ("let", "Let me try please."),
        ("met", "We met at the park."),
        ("net", "Catch a fish with a net."),
        ("pet", "My pet is a hamster."),
        ("set", "Set the table now."),
        ("vet", "The vet helps sick pets."),
        ("wet", "The grass is wet."),
        ("yet", "Are we there yet?"),
        ("hen", "The hen lays eggs."),
        ("men", "Two men carried boxes."),
        ("pen", "Write with a pen."),
        ("ten", "Count to ten."),
        ("den", "The fox went to its den."),
        ("beg", "The dog will beg for food."),
        ("leg", "I hurt my leg."),
        ("egg", "Crack the egg in the bowl."),
        ("peg", "Hang the coat on the peg."),
        # i
        ("big", "The dog is big."),
        ("dig", "Dogs dig holes."),
        ("fig", "A fig is a sweet fruit."),
        ("pig", "The pig rolls in mud."),
        ("wig", "She wore a curly wig."),
        ("did", "Did you eat lunch?"),
        ("hid", "I hid behind the tree."),
        ("kid", "Every kid likes recess."),
        ("lid", "Put the lid on tight."),
        ("rid", "We got rid of old toys."),
        ("bin", "Toss the trash in the bin."),
        ("fin", "A fish has a fin."),
        ("pin", "Don't step on a pin."),
        ("tin", "The tin can is shiny."),
        ("win", "We hope to win the game."),
        ("sit", "Sit down please."),
        ("hit", "Hit the ball hard."),
        ("bit", "I took a bit of bread."),
        ("fit", "These shoes fit well."),
        ("pit", "Spit out the cherry pit."),
        ("kit", "Open the art kit."),
        ("lit", "She lit the candle."),
        # o
        ("dog", "My dog likes walks."),
        ("log", "Sit on the log."),
        ("fog", "Drive slow in the fog."),
        ("hog", "A hog is a big pig."),
        ("jog", "Let's jog to the park."),
        ("hop", "Bunnies hop along."),
        ("mop", "Mop up the spill."),
        ("pop", "The balloon will pop."),
        ("top", "Spin the top fast."),
        ("cop", "The cop helps people."),
        ("box", "Pack the box up."),
        ("fox", "A red fox ran by."),
        ("ox", "An ox is strong."),
        ("got", "I got a new bike."),
        ("hot", "The soup is hot."),
        ("lot", "There is a lot of snow."),
        ("not", "Do not touch that."),
        ("pot", "Stir the pot slowly."),
        ("dot", "Draw a small dot."),
        # u
        ("bug", "A bug is on the leaf."),
        ("hug", "Give grandma a hug."),
        ("jug", "Pour milk from the jug."),
        ("mug", "Drink from your mug."),
        ("rug", "Sit on the soft rug."),
        ("tug", "Tug on the rope."),
        ("bun", "Eat the warm bun."),
        ("fun", "We had so much fun."),
        ("run", "Run to the swings."),
        ("sun", "The sun is bright."),
        ("nun", "A nun walked by."),
        ("cup", "Fill the cup with water."),
        ("pup", "The pup is fluffy."),
        ("up", "Look up at the sky."),
        ("but", "I like cake but not pie."),
        ("cut", "Don't cut the rope."),
        ("hut", "The hut had a small door."),
        ("nut", "A nut fell from the tree."),
        ("rut", "The wheel got stuck in a rut."),
        ("bud", "A new bud is on the rose."),
        ("mud", "Don't step in the mud."),
        ("gum", "Chew the gum."),
        ("hum", "Hum a little song."),
        ("yum", "Yum, this cake is good!"),
    ]
    return [entry(w, 1, ["cvc", "short-vowel"], s) for w, s in cvc]


# ============================================================
# LEVEL 2 — Word Families
# ============================================================
def level2():
    families = {
        "at": ["chat", "flat", "scat", "spat", "brat", "slat", "splat", "stat"],
        "an": ["plan", "scan", "span", "than", "clan", "bran", "flan"],
        "it": ["knit", "quit", "slit", "spit", "grit", "flit", "skit", "twit"],
        "et": ["jet", "fret", "stet", "whet", "bet", "debt"],
        "un": ["spun", "stun", "shun", "begun"],
        "in": ["chin", "shin", "skin", "spin", "grin", "thin", "twin"],
        "ot": ["blot", "clot", "knot", "plot", "shot", "slot", "spot", "trot"],
        "op": ["chop", "drop", "flop", "plop", "shop", "stop", "prop", "crop"],
        "ig": ["twig", "swig", "sprig", "trig"],
        "ack": ["back", "pack", "rack", "sack", "tack", "black", "crack", "shack", "snack", "stack", "track", "quack"],
        "ick": ["kick", "lick", "pick", "sick", "tick", "brick", "click", "stick", "thick", "trick", "chick"],
        "ock": ["lock", "rock", "sock", "block", "clock", "flock", "knock", "shock", "stock"],
        "uck": ["buck", "duck", "luck", "muck", "puck", "suck", "tuck", "cluck", "pluck", "stuck", "truck"],
        "ake": ["bake", "cake", "lake", "make", "rake", "take", "wake", "brake", "flake", "shake", "snake", "stake"],
        "ame": ["came", "dame", "fame", "game", "lame", "name", "same", "tame", "blame", "flame", "frame", "shame"],
        "ate": ["date", "fate", "gate", "hate", "late", "mate", "rate", "crate", "plate", "skate", "slate", "state"],
        "ine": ["dine", "fine", "line", "mine", "nine", "pine", "vine", "wine", "shine", "spine", "swine", "whine"],
        "ide": ["hide", "ride", "side", "tide", "wide", "bride", "glide", "pride", "slide", "stride"],
        "old": ["bold", "cold", "fold", "gold", "hold", "mold", "sold", "told", "scold"],
    }
    out = []
    for rime, words in families.items():
        for w in words:
            tags = [f"family-{rime}"]
            if len(w) == 3:
                tags.append("cvc")
                tags.append("short-vowel")
            if rime in ("ake", "ame", "ate", "ine", "ide", "old"):
                tags.append("silent-e" if rime != "old" else "long-vowel")
                if "long-vowel" not in tags:
                    tags.append("long-vowel")
            # detect blends
            blends = {"br", "cr", "dr", "fl", "fr", "gl", "gr", "pl", "pr",
                      "sc", "sk", "sl", "sm", "sn", "sp", "st", "sw", "tr", "tw"}
            if len(w) >= 2 and w[:2] in blends:
                tags.append(f"blend-{w[:2]}")
            digraphs = {"sh", "ch", "th", "wh", "ph"}
            if len(w) >= 2 and w[:2] in digraphs:
                tags.append(f"digraph-{w[:2]}")
            sentence = f"The {w} is fun to say." if rime not in ("at", "an", "it") else f"I see a {w} today."
            # quick custom sentences for common ones
            custom = {
                "snack": "I eat a small snack.",
                "stack": "Stack the blocks up high.",
                "truck": "The big truck drove by.",
                "duck": "A duck swam in the pond.",
                "cake": "Mom made a birthday cake.",
                "snake": "A snake slid in the grass.",
                "lake": "We swam in the lake.",
                "name": "Write your name here.",
                "game": "We played a fun game.",
                "plate": "Set the plate on the table.",
                "gate": "Open the front gate.",
                "skate": "I can skate on ice.",
                "ride": "Let's ride our bikes.",
                "slide": "Go down the slide.",
                "hide": "Let's hide and seek.",
                "gold": "The crown is made of gold.",
                "cold": "The water is very cold.",
                "hold": "Hold my hand please.",
                "stop": "Stop at the red light.",
                "shop": "We shop for food.",
                "drop": "Don't drop the egg.",
                "chick": "The chick is yellow.",
                "stick": "Pick up the stick.",
                "brick": "The wall is made of brick.",
                "block": "Build with a block.",
                "clock": "Look at the clock.",
                "rock": "I found a smooth rock.",
                "fish": "A fish swims by.",
                "knock": "Knock on the door.",
                "twin": "She has a twin sister.",
                "spin": "Spin the wheel fast.",
                "thin": "The book is thin.",
                "chin": "Wipe your chin.",
                "plan": "We have a plan.",
                "than": "Apples are sweeter than lemons.",
                "spot": "I found a sunny spot.",
                "shot": "The doctor gave a shot.",
                "knot": "Tie a tight knot.",
                "quit": "Don't quit the game.",
                "knit": "Grandma loves to knit.",
                "lake": "Geese swim on the lake.",
            }
            if w in custom:
                sentence = custom[w]
            out.append(entry(w, 2, tags, sentence))
    return out


# ============================================================
# LEVEL 3 — Sight Words
# ============================================================
def level3():
    sight = [
        # Dolch pre-primer + primer + Fry sample
        "a", "and", "away", "big", "blue", "can", "come", "down", "find", "for",
        "funny", "go", "help", "here", "i", "in", "is", "it", "jump", "little",
        "look", "make", "me", "my", "not", "one", "play", "red", "run", "said",
        "see", "the", "three", "to", "two", "up", "we", "where", "yellow", "you",
        "all", "am", "are", "at", "ate", "be", "black", "brown", "but", "came",
        "did", "do", "eat", "four", "get", "good", "have", "he", "into", "like",
        "must", "new", "no", "now", "on", "our", "out", "please", "pretty", "ran",
        "ride", "saw", "say", "she", "so", "soon", "that", "there", "they", "this",
        "too", "under", "want", "was", "well", "went", "what", "white", "who", "will",
        "with", "yes", "after", "again", "an", "any", "as", "ask", "by", "could",
        "every", "fly", "from", "give", "going", "had", "has", "her", "him", "his",
        "how", "just", "know", "let", "live", "may", "of", "old", "once", "open",
        "over", "put", "round", "some", "stop", "take", "thank", "them", "then", "think",
        "walk", "were", "when", "always", "around", "because", "been", "before", "best", "both",
        "buy", "call", "cold", "does", "don't", "fast", "first", "five", "found", "gave",
        "goes", "green", "its", "made", "many", "off", "or", "pull", "read", "right",
        "sing", "sit", "sleep", "tell", "their", "these", "those", "upon", "us", "use",
        "very", "wash", "which", "why", "wish", "work", "would", "write", "your", "people",
    ]
    out = []
    seen = set()
    sentence_map = {
        "the": "The dog ran fast.",
        "and": "I have a cat and a dog.",
        "was": "It was a sunny day.",
        "said": "She said hello to me.",
        "here": "Come here please.",
        "this": "This is my book.",
        "that": "That tree is tall.",
        "what": "What time is it?",
        "when": "When can we go?",
        "where": "Where is my hat?",
        "why": "Why is the sky blue?",
        "who": "Who is at the door?",
        "my": "My shoes are new.",
        "we": "We are friends.",
        "he": "He is my brother.",
        "she": "She is my sister.",
        "they": "They are at the park.",
        "are": "We are ready.",
        "you": "You are kind.",
        "your": "Take your jacket.",
        "can": "I can read books.",
        "come": "Come with me.",
        "do": "Do your homework.",
        "go": "Go to bed now.",
        "has": "She has a pet bird.",
        "have": "I have a new toy.",
        "like": "I like apples.",
        "look": "Look at the moon.",
        "make": "Make a wish.",
        "me": "Help me please.",
        "not": "I am not tired.",
        "on": "The book is on the desk.",
        "one": "I have one cookie.",
        "see": "I see a rainbow.",
        "to": "We go to school.",
        "will": "I will help you.",
        "with": "Play with me.",
    }
    for w in sight:
        if w in seen:
            continue
        seen.add(w)
        sentence = sentence_map.get(w, f"I see the word {w} often.")
        homophones_map = {
            "to": ["too", "two"],
            "too": ["to", "two"],
            "two": ["to", "too"],
            "their": ["there", "they're"],
            "there": ["their", "they're"],
            "for": ["four"],
            "four": ["for"],
            "by": ["buy"],
            "buy": ["by"],
            "no": ["know"],
            "know": ["no"],
            "see": ["sea"],
            "your": ["you're"],
            "would": ["wood"],
            "right": ["write"],
            "write": ["right"],
            "ate": ["eight"],
            "be": ["bee"],
            "blue": ["blew"],
            "red": ["read"],
            "made": ["maid"],
        }
        homophones = homophones_map.get(w)
        out.append(entry(w, 3, ["sight-word"], sentence, homophones=homophones))
    return out


# ============================================================
# LEVEL 4 — Simple Spelling (blends/digraphs, simple long-vowel)
# ============================================================
def level4():
    words = [
        # blends
        ("brave", "blend-br,long-vowel,silent-e"),
        ("bread", "blend-br"),
        ("brick", "blend-br"),
        ("bring", "blend-br"),
        ("brown", "blend-br"),
        ("brush", "blend-br"),
        ("clap", "blend-cl"),
        ("clean", "blend-cl,long-vowel"),
        ("climb", "blend-cl"),
        ("close", "blend-cl,silent-e"),
        ("cloud", "blend-cl"),
        ("clown", "blend-cl"),
        ("crab", "blend-cr"),
        ("crack", "blend-cr"),
        ("crawl", "blend-cr"),
        ("cream", "blend-cr,long-vowel"),
        ("cross", "blend-cr,double-letter"),
        ("crown", "blend-cr"),
        ("crumb", "blend-cr"),
        ("drag", "blend-dr"),
        ("draw", "blend-dr"),
        ("dream", "blend-dr,long-vowel"),
        ("dress", "blend-dr,double-letter"),
        ("drink", "blend-dr"),
        ("drive", "blend-dr,silent-e,long-vowel"),
        ("drum", "blend-dr"),
        ("flag", "blend-fl"),
        ("flash", "blend-fl,digraph-sh"),
        ("flat", "blend-fl,cvc"),
        ("float", "blend-fl,long-vowel"),
        ("floor", "blend-fl,double-letter"),
        ("flour", "blend-fl"),
        ("flower", "blend-fl"),
        ("fly", "blend-fl"),
        ("frame", "blend-fr,silent-e,long-vowel"),
        ("free", "blend-fr,double-letter,long-vowel"),
        ("fresh", "blend-fr,digraph-sh"),
        ("friend", "blend-fr"),
        ("frog", "blend-fr"),
        ("front", "blend-fr"),
        ("fruit", "blend-fr"),
        ("glad", "blend-gl"),
        ("glass", "blend-gl,double-letter"),
        ("globe", "blend-gl,silent-e,long-vowel"),
        ("glove", "blend-gl,silent-e"),
        ("glow", "blend-gl"),
        ("grab", "blend-gr"),
        ("grade", "blend-gr,silent-e,long-vowel"),
        ("grass", "blend-gr,double-letter"),
        ("great", "blend-gr,long-vowel"),
        ("green", "blend-gr,double-letter,long-vowel"),
        ("grin", "blend-gr"),
        ("grow", "blend-gr"),
        ("place", "blend-pl,silent-e"),
        ("plane", "blend-pl,silent-e,long-vowel"),
        ("plant", "blend-pl"),
        ("plate", "blend-pl,silent-e,long-vowel"),
        ("play", "blend-pl"),
        ("plum", "blend-pl"),
        ("plus", "blend-pl"),
        ("price", "blend-pr,silent-e"),
        ("pride", "blend-pr,silent-e,long-vowel"),
        ("print", "blend-pr"),
        ("prize", "blend-pr,silent-e"),
        ("scale", "blend-sc,silent-e,long-vowel"),
        ("scare", "blend-sc,silent-e"),
        ("scarf", "blend-sc"),
        ("school", "blend-sc"),
        ("score", "blend-sc,silent-e"),
        ("skate", "blend-sk,silent-e,long-vowel"),
        ("ski", "blend-sk"),
        ("skin", "blend-sk"),
        ("skip", "blend-sk"),
        ("sky", "blend-sk"),
        ("sleep", "blend-sl,double-letter,long-vowel"),
        ("slide", "blend-sl,silent-e,long-vowel"),
        ("slime", "blend-sl,silent-e,long-vowel"),
        ("slow", "blend-sl"),
        ("small", "blend-sm,double-letter"),
        ("smart", "blend-sm"),
        ("smell", "blend-sm,double-letter"),
        ("smile", "blend-sm,silent-e,long-vowel"),
        ("smoke", "blend-sm,silent-e,long-vowel"),
        ("snack", "blend-sn"),
        ("snail", "blend-sn,long-vowel"),
        ("snake", "blend-sn,silent-e,long-vowel"),
        ("snore", "blend-sn,silent-e"),
        ("snow", "blend-sn"),
        ("space", "blend-sp,silent-e"),
        ("spell", "blend-sp,double-letter"),
        ("spend", "blend-sp"),
        ("spider", "blend-sp"),
        ("spoon", "blend-sp"),
        ("sport", "blend-sp"),
        ("stage", "blend-st,silent-e,long-vowel"),
        ("stamp", "blend-st"),
        ("star", "blend-st"),
        ("stay", "blend-st"),
        ("stick", "blend-st"),
        ("stone", "blend-st,silent-e,long-vowel"),
        ("store", "blend-st,silent-e"),
        ("storm", "blend-st"),
        ("story", "blend-st"),
        ("street", "blend-st,double-letter,long-vowel"),
        ("strong", "blend-st"),
        ("study", "blend-st"),
        ("sweep", "blend-sw,double-letter,long-vowel"),
        ("sweet", "blend-sw,double-letter,long-vowel"),
        ("swim", "blend-sw"),
        ("swing", "blend-sw"),
        ("trade", "blend-tr,silent-e,long-vowel"),
        ("train", "blend-tr,long-vowel"),
        ("trash", "blend-tr,digraph-sh"),
        ("tree", "blend-tr,double-letter,long-vowel"),
        ("truck", "blend-tr"),
        ("trumpet", "blend-tr"),
        ("trust", "blend-tr"),
        ("twin", "blend-tw"),
        ("twirl", "blend-tw"),
        ("twist", "blend-tw"),
        # digraphs
        ("ship", "digraph-sh"),
        ("shop", "digraph-sh"),
        ("shoe", "digraph-sh"),
        ("shore", "digraph-sh,silent-e"),
        ("short", "digraph-sh"),
        ("shout", "digraph-sh"),
        ("show", "digraph-sh"),
        ("shut", "digraph-sh"),
        ("dish", "digraph-sh"),
        ("fish", "digraph-sh"),
        ("wish", "digraph-sh"),
        ("wash", "digraph-sh"),
        ("brush", "blend-br,digraph-sh"),
        ("chair", "digraph-ch"),
        ("chat", "digraph-ch"),
        ("cheek", "digraph-ch,double-letter,long-vowel"),
        ("cheese", "digraph-ch,double-letter,silent-e"),
        ("cherry", "digraph-ch,double-letter"),
        ("chest", "digraph-ch"),
        ("chick", "digraph-ch"),
        ("child", "digraph-ch"),
        ("chin", "digraph-ch"),
        ("chop", "digraph-ch"),
        ("church", "digraph-ch"),
        ("lunch", "digraph-ch"),
        ("much", "digraph-ch"),
        ("such", "digraph-ch"),
        ("teach", "digraph-ch,long-vowel"),
        ("thank", "digraph-th"),
        ("that", "digraph-th"),
        ("them", "digraph-th"),
        ("then", "digraph-th"),
        ("there", "digraph-th,silent-e"),
        ("thick", "digraph-th"),
        ("thing", "digraph-th"),
        ("think", "digraph-th"),
        ("three", "digraph-th,double-letter,long-vowel"),
        ("throw", "digraph-th"),
        ("thumb", "digraph-th"),
        ("teeth", "digraph-th,double-letter,long-vowel"),
        ("tooth", "digraph-th"),
        ("bath", "digraph-th"),
        ("path", "digraph-th"),
        ("whale", "digraph-wh,silent-e,long-vowel"),
        ("wheat", "digraph-wh,long-vowel"),
        ("wheel", "digraph-wh,double-letter,long-vowel"),
        ("when", "digraph-wh"),
        ("which", "digraph-wh,digraph-ch"),
        ("while", "digraph-wh,silent-e"),
        ("whip", "digraph-wh"),
        ("whisper", "digraph-wh"),
        ("phone", "digraph-ph,silent-e,long-vowel"),
        ("photo", "digraph-ph"),
        ("phrase", "digraph-ph,silent-e,long-vowel"),
        # long-vowel simple
        ("beach", "long-vowel,digraph-ch"),
        ("beat", "long-vowel"),
        ("bee", "double-letter,long-vowel"),
        ("boat", "long-vowel"),
        ("broom", "blend-br,double-letter"),
        ("coat", "long-vowel"),
        ("coast", "long-vowel"),
        ("cool", "double-letter"),
        ("crow", "blend-cr"),
        ("deep", "double-letter,long-vowel"),
        ("draw", "blend-dr"),
        ("each", "long-vowel,digraph-ch"),
        ("feel", "double-letter,long-vowel"),
        ("feet", "double-letter,long-vowel"),
        ("food", "double-letter"),
        ("goat", "long-vowel"),
        ("goal", "long-vowel"),
        ("good", "double-letter"),
        ("grain", "blend-gr,long-vowel"),
        ("hair", "long-vowel"),
        ("hay", "long-vowel"),
        ("heat", "long-vowel"),
        ("hook", "double-letter"),
        ("keep", "double-letter,long-vowel"),
        ("key", "long-vowel"),
        ("knee", "double-letter,long-vowel"),
        ("leaf", "long-vowel"),
        ("loop", "double-letter"),
        ("mail", "long-vowel"),
        ("main", "long-vowel"),
        ("meal", "long-vowel"),
        ("meat", "long-vowel"),
        ("moon", "double-letter"),
        ("nail", "long-vowel"),
        ("need", "double-letter,long-vowel"),
        ("nest", "short-vowel"),
        ("noon", "double-letter"),
        ("oat", "long-vowel"),
        ("paint", "long-vowel"),
        ("pail", "long-vowel"),
        ("peach", "long-vowel,digraph-ch"),
        ("queen", "double-letter,long-vowel"),
        ("rain", "long-vowel"),
        ("read", "long-vowel"),
        ("road", "long-vowel"),
        ("roast", "long-vowel"),
        ("roof", "double-letter"),
        ("room", "double-letter"),
        ("sail", "long-vowel"),
        ("say", "long-vowel"),
        ("sea", "long-vowel"),
        ("seal", "long-vowel"),
        ("seed", "double-letter,long-vowel"),
        ("seek", "double-letter,long-vowel"),
        ("seem", "double-letter,long-vowel"),
        ("show", "digraph-sh"),
        ("slow", "blend-sl"),
        ("snow", "blend-sn"),
        ("soap", "long-vowel"),
        ("soup", "long-vowel"),
        ("speak", "blend-sp,long-vowel"),
        ("spoon", "blend-sp,double-letter"),
        ("tail", "long-vowel"),
        ("team", "long-vowel"),
        ("toad", "long-vowel"),
        ("toast", "long-vowel"),
        ("tool", "double-letter"),
        ("tray", "blend-tr"),
        ("tree", "blend-tr,double-letter,long-vowel"),
        ("week", "double-letter,long-vowel"),
        ("weed", "double-letter,long-vowel"),
        ("wood", "double-letter"),
        ("yawn", "long-vowel"),
        ("year", "long-vowel"),
        ("zoo", "double-letter"),
    ]
    out = []
    seen = set()
    for w, tag_str in words:
        if w in seen:
            continue
        seen.add(w)
        tags = tag_str.split(",")
        sentence_map = {
            "beach": "We played at the beach.",
            "bread": "Spread butter on the bread.",
            "chair": "Sit in the chair.",
            "cheese": "I love cheese on pizza.",
            "flag": "Wave the flag high.",
            "train": "The train is fast.",
            "snow": "Snow falls in winter.",
            "queen": "The queen wore a crown.",
            "broom": "Sweep with the broom.",
            "fresh": "Eat fresh fruit daily.",
            "smile": "Smile for the camera.",
            "snake": "The snake hid in grass.",
            "phone": "The phone rang loudly.",
            "wheel": "Spin the wheel hard.",
            "whale": "A whale swam by the boat.",
            "throw": "Throw the ball high.",
            "three": "I have three pencils.",
            "teeth": "Brush your teeth.",
            "shoe": "Tie your shoe tight.",
            "fish": "A fish swam by.",
            "moon": "The moon shines bright.",
            "spoon": "Eat soup with a spoon.",
            "tree": "Climb the tall tree.",
            "truck": "The truck is loud.",
        }
        sentence = sentence_map.get(w, f"I learned the word {w}.")
        out.append(entry(w, 4, tags, sentence))
    return out


# ============================================================
# LEVEL 5 — Intermediate (double letters, silent e, simple suffixes)
# ============================================================
def level5():
    words = [
        ("rabbit", "double-letter"),
        ("hopping", "double-letter,suffix-ing"),
        ("running", "double-letter,suffix-ing"),
        ("sitting", "double-letter,suffix-ing"),
        ("bicycle", "compound"),
        ("suppose", "double-letter,silent-e"),
        ("gentle", "silent-e"),
        ("kitchen", "digraph-ch"),
        ("butter", "double-letter"),
        ("garden", ""),
        ("special", "suffix-tion"),
        ("listen", ""),
        ("kitten", "double-letter"),
        ("puppy", "double-letter"),
        ("happy", "double-letter"),
        ("yellow", "double-letter"),
        ("hello", "double-letter"),
        ("pillow", "double-letter"),
        ("better", "double-letter"),
        ("letter", "double-letter"),
        ("ladder", "double-letter"),
        ("hammer", "double-letter"),
        ("dinner", "double-letter"),
        ("muffin", "double-letter"),
        ("apple", "double-letter,silent-e"),
        ("middle", "double-letter,silent-e"),
        ("little", "double-letter,silent-e"),
        ("bottle", "double-letter,silent-e"),
        ("puzzle", "double-letter,silent-e"),
        ("giggle", "double-letter,silent-e"),
        ("wiggle", "double-letter,silent-e"),
        ("paddle", "double-letter,silent-e"),
        ("saddle", "double-letter,silent-e"),
        ("ribbon", "double-letter"),
        ("button", "double-letter"),
        ("cotton", "double-letter"),
        ("mitten", "double-letter"),
        ("written", "double-letter"),
        ("hidden", "double-letter"),
        ("sudden", "double-letter"),
        ("summer", "double-letter"),
        ("winter", ""),
        ("spring", "blend-sp"),
        ("autumn", ""),
        ("monkey", ""),
        ("turkey", ""),
        ("donkey", ""),
        ("bake", "silent-e,long-vowel"),
        ("cake", "silent-e,long-vowel"),
        ("lake", "silent-e,long-vowel"),
        ("make", "silent-e,long-vowel"),
        ("rake", "silent-e,long-vowel"),
        ("take", "silent-e,long-vowel"),
        ("wake", "silent-e,long-vowel"),
        ("name", "silent-e,long-vowel"),
        ("game", "silent-e,long-vowel"),
        ("frame", "silent-e,long-vowel"),
        ("flame", "silent-e,long-vowel"),
        ("home", "silent-e,long-vowel"),
        ("hope", "silent-e,long-vowel"),
        ("note", "silent-e,long-vowel"),
        ("rope", "silent-e,long-vowel"),
        ("rose", "silent-e,long-vowel"),
        ("bone", "silent-e,long-vowel"),
        ("stone", "silent-e,long-vowel"),
        ("tube", "silent-e,long-vowel"),
        ("tune", "silent-e,long-vowel"),
        ("cube", "silent-e,long-vowel"),
        ("rude", "silent-e,long-vowel"),
        ("rule", "silent-e,long-vowel"),
        ("bite", "silent-e,long-vowel"),
        ("kite", "silent-e,long-vowel"),
        ("hike", "silent-e,long-vowel"),
        ("bike", "silent-e,long-vowel"),
        ("mile", "silent-e,long-vowel"),
        ("nice", "silent-e,long-vowel"),
        ("mice", "silent-e,irregular-plural"),
        ("rice", "silent-e,long-vowel"),
        ("dice", "silent-e,long-vowel"),
        ("face", "silent-e"),
        ("race", "silent-e"),
        ("page", "silent-e"),
        ("cage", "silent-e"),
        ("rage", "silent-e"),
        ("safe", "silent-e"),
        ("wife", "silent-e"),
        ("life", "silent-e"),
        ("knife", "silent-e"),
        ("dance", "silent-e"),
        ("chance", "silent-e,digraph-ch"),
        ("ice", "silent-e"),
        ("baby", ""),
        ("body", ""),
        ("city", ""),
        ("happy", "double-letter"),
        ("lucky", ""),
        ("funny", "double-letter"),
        ("sunny", "double-letter"),
        ("bunny", "double-letter"),
        ("daddy", "double-letter"),
        ("mommy", "double-letter"),
        ("buddy", "double-letter"),
        ("teddy", "double-letter"),
        ("candy", ""),
        ("dirty", ""),
        ("party", ""),
        ("story", ""),
        ("twenty", ""),
        ("plenty", ""),
        ("sorry", "double-letter"),
        ("merry", "double-letter"),
        ("hurry", "double-letter"),
        ("carry", "double-letter"),
        ("worry", "double-letter"),
        ("fairy", ""),
        ("daisy", ""),
        ("crazy", ""),
        ("lazy", ""),
        ("dizzy", "double-letter"),
        ("fuzzy", "double-letter"),
        ("buzzy", "double-letter"),
        ("baker", ""),
        ("paper", ""),
        ("water", ""),
        ("table", "silent-e"),
        ("eagle", "silent-e"),
        ("uncle", "silent-e"),
        ("angle", "silent-e"),
        ("circle", "silent-e"),
        ("purple", "silent-e"),
        ("simple", "silent-e"),
        ("temple", "silent-e"),
        ("sample", "silent-e"),
        ("ample", "silent-e"),
        ("maple", "silent-e"),
        ("noodle", "silent-e,double-letter"),
        ("doodle", "silent-e,double-letter"),
        ("poodle", "silent-e,double-letter"),
        ("baking", "silent-e,suffix-ing"),
        ("biking", "silent-e,suffix-ing"),
        ("hiking", "silent-e,suffix-ing"),
        ("hoping", "silent-e,suffix-ing"),
        ("riding", "silent-e,suffix-ing"),
        ("skating", "silent-e,suffix-ing"),
        ("eating", "suffix-ing"),
        ("playing", "suffix-ing"),
        ("reading", "suffix-ing"),
        ("singing", "suffix-ing"),
        ("walking", "suffix-ing"),
        ("waiting", "suffix-ing"),
        ("looking", "suffix-ing"),
        ("talking", "suffix-ing"),
        ("doing", "suffix-ing"),
        ("going", "suffix-ing"),
        ("flying", "suffix-ing"),
        ("crying", "suffix-ing"),
        ("trying", "suffix-ing"),
        ("baked", "silent-e,suffix-ed"),
        ("biked", "silent-e,suffix-ed"),
        ("hiked", "silent-e,suffix-ed"),
        ("hoped", "silent-e,suffix-ed"),
        ("liked", "silent-e,suffix-ed"),
        ("smiled", "silent-e,suffix-ed"),
        ("played", "suffix-ed"),
        ("looked", "suffix-ed"),
        ("walked", "suffix-ed"),
        ("talked", "suffix-ed"),
        ("painted", "suffix-ed"),
        ("waited", "suffix-ed"),
        ("ended", "suffix-ed"),
        ("planted", "suffix-ed"),
        ("jumped", "suffix-ed"),
        ("stopped", "suffix-ed,double-letter"),
        ("hopped", "suffix-ed,double-letter"),
        ("dropped", "suffix-ed,double-letter"),
        ("clapped", "suffix-ed,double-letter"),
        ("animal", ""),
        ("apple", "double-letter,silent-e"),
        ("around", ""),
        ("bottom", "double-letter"),
        ("brother", ""),
        ("color", ""),
        ("dollar", "double-letter"),
        ("during", ""),
        ("either", ""),
        ("father", ""),
        ("favorite", "silent-e"),
        ("flower", ""),
        ("follow", "double-letter"),
        ("forest", ""),
        ("forget", ""),
        ("forty", ""),
        ("found", ""),
        ("fourth", "digraph-th"),
        ("friend", ""),
        ("future", "silent-e"),
        ("gather", ""),
        ("grand", ""),
        ("guess", "double-letter"),
        ("happen", "double-letter"),
        ("hardly", "suffix-ly"),
        ("heavy", ""),
        ("hobby", "double-letter"),
        ("honey", ""),
        ("hundred", ""),
        ("hungry", ""),
        ("ideal", ""),
        ("inside", "silent-e"),
        ("instead", ""),
        ("island", ""),
        ("kindly", "suffix-ly"),
        ("language", "silent-e"),
        ("laughter", ""),
        ("library", ""),
        ("magic", ""),
        ("market", ""),
        ("matter", "double-letter"),
        ("meaning", "suffix-ing"),
        ("middle", "double-letter,silent-e"),
        ("million", "double-letter"),
        ("minute", "silent-e"),
        ("mister", ""),
        ("model", ""),
        ("morning", "suffix-ing"),
        ("mother", ""),
        ("mountain", ""),
        ("nature", "silent-e"),
        ("neighbor", ""),
        ("nothing", "suffix-ing"),
        ("number", ""),
        ("office", "silent-e,double-letter"),
        ("outside", "silent-e"),
        ("painter", ""),
        ("parent", ""),
        ("pencil", ""),
        ("perhaps", ""),
        ("picture", "silent-e"),
        ("planet", ""),
        ("pocket", ""),
        ("pretty", "double-letter"),
        ("problem", ""),
        ("question", "suffix-tion"),
        ("quickly", "suffix-ly"),
        ("quiet", ""),
        ("rainbow", "compound"),
        ("reason", ""),
        ("river", ""),
        ("rocket", ""),
        ("safety", ""),
        ("second", ""),
        ("seven", ""),
        ("simple", "silent-e"),
        ("sister", ""),
        ("slowly", "suffix-ly"),
        ("smaller", ""),
        ("someone", "compound,silent-e"),
        ("something", "compound"),
        ("sometimes", "compound"),
        ("spelling", "blend-sp,double-letter,suffix-ing"),
        ("squirrel", "double-letter"),
        ("station", "suffix-tion"),
        ("strange", "blend-st,silent-e"),
        ("student", ""),
        ("subject", ""),
        ("sudden", "double-letter"),
        ("suddenly", "double-letter,suffix-ly"),
        ("summer", "double-letter"),
        ("supper", "double-letter"),
        ("surprise", "silent-e"),
        ("teacher", ""),
        ("thunder", ""),
        ("tiger", ""),
        ("together", ""),
        ("tomorrow", "double-letter"),
        ("traffic", "double-letter"),
        ("travel", ""),
        ("trouble", "silent-e"),
        ("under", ""),
        ("unless", "prefix-un,double-letter"),
        ("until", "prefix-un"),
        ("village", "silent-e"),
        ("visit", ""),
        ("voice", "silent-e"),
        ("window", ""),
        ("without", "compound"),
        ("woman", ""),
        ("women", "irregular-plural"),
        ("yellow", "double-letter"),
    ]
    out = []
    seen = set()
    for w, tag_str in words:
        if w in seen:
            continue
        seen.add(w)
        tags = [t for t in tag_str.split(",") if t]
        if not tags:
            tags = ["intermediate"]
        sentence_map = {
            "rabbit": "The rabbit hops fast.",
            "bicycle": "I rode my bicycle home.",
            "kitchen": "Mom cooks in the kitchen.",
            "garden": "We plant seeds in the garden.",
            "listen": "Listen to the music.",
            "special": "Today is a special day.",
            "butter": "Spread butter on toast.",
            "rainbow": "I saw a bright rainbow.",
            "surprise": "What a fun surprise!",
            "teacher": "My teacher is kind.",
            "library": "We read at the library.",
            "tomorrow": "Tomorrow is Saturday.",
            "favorite": "Blue is my favorite color.",
            "spelling": "I love spelling new words.",
        }
        sentence = sentence_map.get(w, f"The word {w} is fun to spell.")
        out.append(entry(w, 5, tags, sentence))
    return out


# ============================================================
# LEVEL 6 — Advanced (tricky common-but-misspelled)
# ============================================================
def level6():
    words = [
        "rhythm", "conscience", "separate", "necessary", "occurred", "beautiful",
        "definitely", "weird", "receive", "believe", "achieve", "ancient",
        "accommodate", "acknowledge", "acquire", "across", "address", "advice",
        "amateur", "apparent", "appearance", "argument", "atheist", "awkward",
        "basically", "beginning", "behaviour", "calendar", "category", "ceiling",
        "cemetery", "changeable", "chief", "collectible", "column", "committed",
        "completely", "concede", "consensus", "controversy", "convenient", "courteous",
        "criticize", "deceive", "deficit", "describe", "desperate", "discipline",
        "drunkenness", "embarrass", "equipment", "exhilarate", "existence", "experience",
        "explanation", "fascinating", "fiery", "foreign", "foreseeable", "forty",
        "fulfill", "gauge", "genealogy", "generally", "government", "grateful",
        "guarantee", "guidance", "harass", "height", "hierarchy", "humorous",
        "hygiene", "hypocrisy", "ignorance", "imitate", "immediate", "incidentally",
        "independent", "indispensable", "inoculate", "intelligence", "jealous",
        "judgment", "knowledge", "leisure", "liaison", "library", "license",
        "lightning", "maintenance", "maneuver", "medieval", "memento", "millennium",
        "miniature", "minuscule", "mischievous", "misspell", "mortgage", "neighbor",
        "noticeable", "occasion", "occurrence", "official", "originally", "outrageous",
        "parallel", "paralyze", "particular", "pastime", "perceive", "perform",
        "permanent", "personnel", "persuade", "playwright", "possess", "possession",
        "precede", "preference", "prejudice", "prevalent", "principal", "principle",
        "privilege", "pronunciation", "publicly", "questionnaire", "recommend",
        "referred", "reference", "relevant", "relieve", "religious", "remembrance",
        "reservoir", "restaurant", "rhyme", "schedule", "scissors", "secretary",
        "siege", "similar", "sincerely", "skillful", "sophomore", "souvenir",
        "specifically", "successful", "supersede", "surprise", "thorough", "threshold",
        "tomorrow", "twelfth", "tyranny", "underrate", "until", "vacuum",
        "various", "vegetable", "vicious", "view", "village", "warrant",
        "weather", "Wednesday", "welcome", "whether", "whisper", "whole",
        "yacht", "absence", "accept", "access", "accident", "accidentally",
        "accuse", "active", "actually", "afraid", "afternoon", "against",
        "agree", "ahead", "airplane", "allowed", "almost", "alone",
        "along", "already", "although", "altogether", "amount", "angry",
        "answer", "anybody", "anyone", "anything", "anywhere", "appear",
        "appreciate", "April", "arrive", "asleep", "August", "author",
        "autumn", "awful", "balance", "balloon", "banana", "basket",
        "battle", "beauty", "become", "behavior", "behind", "below",
        "beside", "between", "biscuit", "blanket", "borrow", "bother",
        "bought", "bridge", "bright", "broken", "brought", "building",
        "business", "captain", "careful", "carrot", "castle", "ceiling",
        "central", "century", "certain", "channel", "chapter", "charge",
        "chimney",
    ]
    out = []
    seen = set()
    sentence_map = {
        "rhythm": "Dance to the rhythm of the music.",
        "conscience": "Let your conscience be your guide.",
        "separate": "Please separate the colors.",
        "necessary": "Sleep is necessary for health.",
        "occurred": "The storm occurred last night.",
        "beautiful": "What a beautiful sunset.",
        "definitely": "I will definitely come over.",
        "weird": "That was a weird dream.",
        "receive": "I will receive a letter today.",
        "believe": "I believe you can do it.",
    }
    for w in words:
        wl = w.lower()
        if wl in seen:
            continue
        seen.add(wl)
        tags = ["advanced"]
        if "ie" in w or "ei" in w:
            tags.append("tricky-ie-ei")
        if w.endswith("tion") or w.endswith("sion"):
            tags.append("suffix-tion" if w.endswith("tion") else "suffix-sion")
        if any(w[i] == w[i+1] for i in range(len(w)-1) if w[i].isalpha()):
            tags.append("double-letter")
        sentence = sentence_map.get(wl, f"The word {wl} is tricky to spell.")
        out.append(entry(w, 6, tags, sentence))
    return out


# ============================================================
# LEVEL 7 — Rules & Patterns (prefixes / suffixes)
# ============================================================
def level7():
    items = []
    seen = set()

    def add(w, tags, sentence=None):
        if w.lower() in seen:
            return
        seen.add(w.lower())
        s = sentence or f"The word {w} follows a pattern."
        items.append(entry(w, 7, tags, s))

    # prefix-un
    for w in ["unhappy", "unkind", "unfair", "unsafe", "unlock", "unzip", "untie", "unwrap",
              "unable", "undo", "unread", "unused", "unfit", "unclear", "unseen", "unsure",
              "unwell", "unwise", "unpack", "unplug"]:
        add(w, ["prefix-un"])
    # prefix-re
    for w in ["redo", "rewrite", "reread", "rerun", "repaint", "replay", "rewind", "rebuild",
              "reuse", "reheat", "reload", "remake", "rename", "renew", "repay", "reset",
              "review", "revisit", "return", "react"]:
        add(w, ["prefix-re"])
    # prefix-pre
    for w in ["preschool", "preheat", "preview", "pretest", "prepay", "preplan", "preorder",
              "prewash", "prefix", "preteen", "predict", "prepare", "preset"]:
        add(w, ["prefix-pre"])
    # prefix-dis
    for w in ["disagree", "disappear", "disarm", "discharge", "disconnect", "discover",
              "dishonest", "dislike", "disobey", "disorder", "displease", "disprove",
              "distrust", "discount"]:
        add(w, ["prefix-dis"])
    # prefix-mis
    for w in ["misbehave", "miscount", "misjudge", "mislead", "misplace", "misread",
              "misspell", "mistake", "mistreat", "mistrust", "misuse", "misfit"]:
        add(w, ["prefix-mis"])
    # prefix-in (meaning not)
    for w in ["incorrect", "inactive", "indirect", "invisible", "informal", "independent",
              "inexpensive", "incomplete", "inability"]:
        add(w, ["prefix-in"])
    # prefix-sub
    for w in ["submarine", "subway", "subset", "subtitle", "subtotal", "subzero",
              "subdivide", "subgroup"]:
        add(w, ["prefix-sub"])
    # suffix-ful
    for w in ["helpful", "careful", "joyful", "playful", "thankful", "useful", "wonderful",
              "beautiful", "colorful", "fearful", "hopeful", "painful", "peaceful",
              "powerful", "respectful", "successful", "truthful", "watchful", "cheerful",
              "graceful"]:
        add(w, ["suffix-ful"])
    # suffix-less
    for w in ["careless", "fearless", "harmless", "helpless", "homeless", "hopeless",
              "endless", "useless", "restless", "speechless", "thoughtless", "wireless",
              "powerless", "painless"]:
        add(w, ["suffix-less"])
    # suffix-ness
    for w in ["kindness", "sadness", "happiness", "darkness", "goodness", "illness",
              "softness", "weakness", "thickness", "loudness", "brightness", "fairness",
              "fitness", "freshness"]:
        add(w, ["suffix-ness"])
    # suffix-ly
    for w in ["quickly", "slowly", "softly", "loudly", "gladly", "kindly", "really",
              "nicely", "badly", "sadly", "happily", "easily", "friendly", "lonely",
              "lovely", "monthly", "weekly", "yearly", "daily"]:
        add(w, ["suffix-ly"])
    # suffix-ing
    for w in ["jumping", "running", "swimming", "shopping", "stopping", "winning",
              "sitting", "getting", "putting", "cutting", "begging", "digging",
              "writing", "making", "taking", "driving", "smiling", "shining",
              "having", "giving"]:
        tags = ["suffix-ing"]
        if any(w[i] == w[i+1] for i in range(len(w)-1)):
            tags.append("double-letter")
        add(w, tags)
    # suffix-ed
    for w in ["jumped", "helped", "asked", "talked", "rained", "snowed", "danced",
              "called", "kicked", "looked", "filled", "yelled", "wished", "fixed",
              "raced", "smiled", "shined", "saved", "moved", "lived"]:
        add(w, ["suffix-ed"])
    # suffix-tion
    for w in ["action", "nation", "station", "motion", "lotion", "section", "mention",
              "vacation", "addition", "education", "direction", "attention", "invention",
              "celebration", "tradition", "condition", "production", "selection",
              "collection", "question", "reaction"]:
        add(w, ["suffix-tion"])
    # suffix-sion
    for w in ["mission", "session", "passion", "decision", "vision", "television",
              "permission", "explosion", "discussion", "confusion", "division",
              "expression", "expansion"]:
        add(w, ["suffix-sion"])
    # suffix-able
    for w in ["readable", "lovable", "doable", "likable", "movable", "usable",
              "washable", "breakable", "reachable", "teachable", "drinkable",
              "comfortable", "enjoyable", "valuable", "reliable"]:
        add(w, ["suffix-able"])
    # y -> i + es / ed
    for w in ["cried", "tried", "fried", "dried", "spied", "tied", "lied",
              "flies", "tries", "cries", "dries", "spies", "ponies", "stories",
              "babies", "puppies", "candies", "berries", "cherries", "families",
              "biggest", "happiest", "easiest", "prettiest", "funniest"]:
        tags = ["suffix-ed"] if w.endswith("ied") else ["suffix-es"] if w.endswith("ies") else ["suffix-est"]
        add(w, tags)
    # compound
    for w in ["sunshine", "moonlight", "rainbow", "snowman", "playground", "backpack",
              "cupcake", "popcorn", "doorbell", "homework", "weekend", "afternoon",
              "anyone", "anything", "everyone", "everything", "myself", "yourself",
              "himself", "herself", "without", "within", "into", "upon"]:
        add(w, ["compound"])

    return items


# ============================================================
# BUILD & WRITE
# ============================================================
def main():
    all_words = []
    all_words += level0()
    all_words += level1()
    all_words += level2()
    all_words += level3()
    all_words += level4()
    all_words += level5()
    all_words += level6()
    all_words += level7()

    # Deduplicate within level (keep first occurrence)
    seen = set()
    deduped = []
    for w in all_words:
        key = (w["word"].lower(), w["level"])
        if key in seen:
            continue
        seen.add(key)
        deduped.append(w)

    # Sort by level then alphabetical
    deduped.sort(key=lambda x: (x["level"], x["word"].lower()))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(deduped, f, indent=2, ensure_ascii=False)

    # Stats
    by_level = {}
    for w in deduped:
        by_level[w["level"]] = by_level.get(w["level"], 0) + 1
    print(f"Wrote {len(deduped)} words to {OUT}")
    print("By level:", dict(sorted(by_level.items())))


if __name__ == "__main__":
    main()
