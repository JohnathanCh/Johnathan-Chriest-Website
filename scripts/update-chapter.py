#!/usr/bin/env python3
"""Regenerate the readable chapter from the supplied PDF without rewriting prose.
Requires Poppler's pdftotext (already installed on the author's Mac).
"""
from pathlib import Path
import hashlib, json, re, shutil, subprocess, sys

ROOT = Path(__file__).resolve().parents[1]
CHAPTER = ROOT / 'writing/the-visitor/chapter-one'
PDF = CHAPTER / 'assets/chapter-one.pdf'

def regenerate():
    executable = shutil.which('pdftotext')
    if not executable:
        raise SystemExit('Install Poppler (pdftotext) before updating the readable chapter.')
    raw = subprocess.run([executable, '-layout', str(PDF), '-'], check=True, capture_output=True, text=True).stdout
    pages = raw.split('\f')
    cleaned = []
    printed_heading = None
    for number, page in enumerate(pages, 1):
        lines = page.splitlines()
        while lines and not lines[-1].strip(): lines.pop()
        if lines and lines[-1].strip() == str(number): lines.pop()
        while lines and not lines[0].strip(): lines.pop(0)
        if number == 1 and lines and re.fullmatch(r'Chapter\s+\S+', lines[0].strip(), re.I):
            printed_heading = lines.pop(0).strip()
        cleaned.append('\n'.join(lines).strip('\n'))
    text = '\n'.join(cleaned).strip()
    blocks = []
    for segment in re.split(r'(?:\n[ \t]*\n)+|(?<=❖)\n|\n(?= *❖)', text):
        if not segment.strip(): continue
        if segment.strip() == '❖':
            blocks.append({'type':'break'})
        else:
            value = ' '.join(line.strip() for line in segment.splitlines())
            item = {'type':'paragraph', 'text':value}
            if len(segment) - len(segment.lstrip(' ')) >= 8: item['indented'] = True
            blocks.append(item)
    paragraphs = [b['text'] for b in blocks if b['type'] == 'paragraph']
    normal = lambda s: re.sub(r'\s+', ' ', s).strip()
    if normal(' '.join(paragraphs)) != normal(text.replace('❖', '')):
        raise SystemExit('Text verification failed; source PDF was left untouched.')
    digest = hashlib.sha256(PDF.read_bytes()).hexdigest()
    data = {'title':'Waking Up', 'chapter':1, 'source':'chapter-one.pdf', 'sourceSha256':digest,
            'printedHeading':printed_heading, 'blocks':blocks, 'paragraphs':paragraphs}
    target = CHAPTER / 'assets/chapter.json'
    target.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    index = CHAPTER / 'index.html'
    html = re.sub(r'chapter-one\.pdf(?:\?v=[A-Za-z0-9-]+)?', 'chapter-one.pdf?v='+digest[:12], index.read_text())
    index.write_text(html)
    print(f'Updated {len(paragraphs)} paragraphs and {sum(b["type"] == "break" for b in blocks)} source separators.')
    print('PDF preserved. SHA-256: '+digest)
    if printed_heading and printed_heading != 'Chapter One':
        print('Note: the PDF prints "'+printed_heading+'"; the website still labels this entry Chapter One.')

if __name__ == '__main__': regenerate()
