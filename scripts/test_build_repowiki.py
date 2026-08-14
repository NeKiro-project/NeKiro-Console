from __future__ import annotations

import unittest
from pathlib import Path

from scripts import build_repowiki


class OutputPathTests(unittest.TestCase):
    def test_accepts_only_the_generated_repowiki_directory(self) -> None:
        self.assertEqual(
            build_repowiki.validated_output_path(Path(".repowiki-site")),
            build_repowiki.DEFAULT_OUTPUT.resolve(),
        )

    def test_rejects_repository_and_source_directories(self) -> None:
        for output in (Path("."), Path("src"), Path("repowiki"), Path("..")):
            with self.subTest(output=output):
                with self.assertRaisesRegex(ValueError, "generated RepoWiki directory"):
                    build_repowiki.validated_output_path(output)


class LinkRewriteTests(unittest.TestCase):
    def test_keeps_source_line_links_on_github(self) -> None:
        rewritten = build_repowiki.rewrite_links(
            ".qoder/repowiki/zh/content/guide.md",
            "console-docs/content/guide.md",
            "[README lines](file://README.md#L1-L40)",
            {"README.md": "console-docs/readme-page.md"},
        )
        self.assertEqual(
            rewritten,
            "[README lines](https://github.com/NeKiro-project/NeKiro-Console/blob/main/README.md#L1-L40)",
        )

    def test_keeps_document_links_inside_the_generated_site(self) -> None:
        rewritten = build_repowiki.rewrite_links(
            ".qoder/repowiki/zh/content/guide.md",
            "console-docs/content/guide.md",
            "[README](file://README.md)",
            {"README.md": "console-docs/readme-page.md"},
        )
        self.assertEqual(rewritten, "[README](../readme-page.md)")


if __name__ == "__main__":
    unittest.main()
