#!/usr/bin/env python3
"""Build the bilingual MkDocs tree from Console-owned RepoWiki documents."""

from __future__ import annotations

import argparse
import posixpath
import re
import shutil
import sys
import urllib.parse
from pathlib import Path
from typing import NoReturn


REPO_ROOT = Path(__file__).resolve().parents[1]
WIKI_ROOT = REPO_ROOT / "repowiki"
QODER_ROOT = REPO_ROOT / ".qoder" / "repowiki"
DEFAULT_OUTPUT = REPO_ROOT / ".repowiki-site"
SOURCE_URL_PREFIX = "https://github.com/NeKiro-project/NeKiro-Console/blob/main/"
MARKDOWN_LINK = re.compile(r"(?<!!)(\[[^\]]+\])\(([^)]+)\)")


def fail(message: str) -> NoReturn:
    raise ValueError(message)


def source_url(source: str) -> str:
    return SOURCE_URL_PREFIX + urllib.parse.quote(source, safe="/")


def documents() -> list[tuple[str, str]]:
    result: list[tuple[str, str]] = [("README.md", "console-docs/readme-page.md")]
    roots = (
        (QODER_ROOT / "zh" / "content", "content"),
        (QODER_ROOT / "knowledge" / "zh", "knowledge"),
    )
    for root, target_prefix in roots:
        if not root.is_dir():
            fail(f"missing Console RepoWiki source directory: {root}")
        for path in sorted(root.rglob("*.md")):
            source = path.relative_to(REPO_ROOT).as_posix()
            relative = path.relative_to(root).as_posix()
            target = (Path("console-docs") / target_prefix / relative).as_posix()
            result.append((source, target))
    return result


def rewrite_links(
    source: str,
    target: str,
    text: str,
    source_map: dict[str, str],
) -> str:
    source_posix = source.replace("\\", "/")

    def replace(match: re.Match[str]) -> str:
        destination = match.group(2).strip()
        if destination.startswith(("http://", "https://", "mailto:", "#", "<")):
            return match.group(0)
        parts = destination.split(None, 1)
        link_target = parts[0]
        suffix = f" {parts[1]}" if len(parts) == 2 else ""
        fragment = ""
        if "#" in link_target:
            link_target, raw_fragment = link_target.split("#", 1)
            fragment = f"#{raw_fragment}"
        is_file_uri = link_target.startswith("file://")
        if is_file_uri:
            link_target = link_target.removeprefix("file://")
        elif not link_target.endswith(".md"):
            return match.group(0)
        if is_file_uri:
            resolved = posixpath.normpath(link_target.lstrip("/"))
        else:
            resolved = posixpath.normpath(
                posixpath.join(posixpath.dirname(source_posix), link_target)
            )
        if resolved in source_map:
            mirrored = source_map[resolved]
            relative = posixpath.relpath(mirrored, posixpath.dirname(target))
            link = urllib.parse.quote(relative, safe="/")
        else:
            link = source_url(resolved)
        return f"{match.group(1)}({link}{fragment}{suffix})"

    return MARKDOWN_LINK.sub(replace, text)


def source_page(
    source: str,
    target: str,
    language: str,
    source_map: dict[str, str],
) -> str:
    if language == "zh":
        note = (
            '<div class="source-note">Canonical source：'
            f'<a href="{source_url(source)}"><code>{source}</code></a>。'
            "本页保留 Console canonical 文档，中文内容来自仓库的 RepoWiki 源文件。</div>"
        )
    else:
        note = (
            '<div class="source-note">Canonical source: '
            f'<a href="{source_url(source)}"><code>{source}</code></a>. '
            "This page is rendered from the Console-owned RepoWiki document during the MkDocs build.</div>"
        )
    text = (REPO_ROOT / source).read_text(encoding="utf-8")
    return f"{note}\n\n{rewrite_links(source, target, text, source_map)}"


def source_index(language: str, entries: list[tuple[str, str]]) -> str:
    if language == "zh":
        lines = [
            "# Console 源文档",
            "",
            "以下页面从 Console 仓库的 README 和 `.qoder/repowiki` canonical 文档生成。",
            "详细页面保留仓库当前的中文内容；中央入口提供 English/中文站点切换。",
            "",
        ]
    else:
        lines = [
            "# Console source documentation",
            "",
            "These pages are rendered from the Console README and the committed `.qoder/repowiki` documents.",
            "The source repository remains canonical; edit those documents rather than the generated tree.",
            "",
        ]
    for source, target in entries:
        link = posixpath.relpath(target, "console-docs")
        lines.append(f"- [{source}]({urllib.parse.quote(link, safe='/')})")
    return "\n".join(lines) + "\n"


def copy_tracked_wiki(output: Path) -> None:
    for path in WIKI_ROOT.rglob("*"):
        if path.is_dir():
            continue
        relative = path.relative_to(WIKI_ROOT)
        if relative.parts[0] == "zh":
            continue
        if relative.parts[0] == "assets":
            destination = output / relative
        elif path.suffix == ".md":
            destination = output / "en" / relative
        else:
            fail(f"unsupported tracked RepoWiki file: {relative}")
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, destination)
    for path in (WIKI_ROOT / "zh").rglob("*"):
        if path.is_dir():
            continue
        relative = path.relative_to(WIKI_ROOT)
        destination = output / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, destination)


def validate(entries: list[tuple[str, str]]) -> None:
    for relative in ("index.md", "zh/index.md", "assets/stylesheets/extra.css"):
        if not (WIKI_ROOT / relative).is_file():
            fail(f"missing RepoWiki input: repowiki/{relative}")
    source_map = dict(entries)
    for source, _ in entries:
        path = REPO_ROOT / source
        if not path.is_file():
            fail(f"missing source document: {source}")
        rewrite_links(source, source_map[source], path.read_text(encoding="utf-8"), source_map)
    if len(entries) < 2:
        fail("Console RepoWiki source set is unexpectedly empty")
    for path in WIKI_ROOT.rglob("*.md"):
        text = path.read_text(encoding="utf-8")
        if "{{" in text or "relative_url" in text:
            fail(f"Jekyll/Liquid link remains in RepoWiki source: {path.relative_to(REPO_ROOT)}")


def build(output: Path, entries: list[tuple[str, str]]) -> None:
    if output.exists():
        if output.is_dir():
            shutil.rmtree(output)
        else:
            output.unlink()
    output.mkdir(parents=True, exist_ok=True)
    copy_tracked_wiki(output)
    source_map = dict(entries)
    for language in ("en", "zh"):
        generated_root = output / language / "console-docs"
        generated_root.mkdir(parents=True, exist_ok=True)
        (generated_root / "index.md").write_text(
            source_index(language, entries), encoding="utf-8"
        )
        for source, target in entries:
            destination = output / language / target
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_text(
                source_page(source, target, language, source_map), encoding="utf-8"
            )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--check", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        entries = documents()
        validate(entries)
        if args.check:
            print(f"RepoWiki check passed: {len(entries)} Console documents, 2 locales")
        else:
            output = args.output if args.output.is_absolute() else REPO_ROOT / args.output
            build(output, entries)
            print(f"MkDocs source generated: {output}")
    except ValueError as error:
        print(f"RepoWiki build failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
