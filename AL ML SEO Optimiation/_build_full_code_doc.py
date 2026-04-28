from __future__ import annotations

from pathlib import Path
from typing import Iterable


ROOT = Path(r"d:\New Forecasting\AL ML SEO Optimiation").resolve()
REPO = ROOT / "swyftbooking"


INCLUDE_TOP_LEVEL = [
    REPO / "README.md",
    REPO / "package.json",
    REPO / "docker-compose.yml",
    REPO / ".env.example",
]

INCLUDE_DIRS = [
    REPO / "apps",
    REPO / "services",
    REPO / "packages",
    REPO / "scripts",
]

# keep it "every code" but avoid dependencies/build outputs
EXCLUDE_DIR_NAMES = {
    "node_modules",
    ".next",
    ".git",
    "dist",
    "build",
    "coverage",
}

INCLUDE_EXTS = {
    ".js",
    ".mjs",
    ".cjs",
    ".ts",
    ".tsx",
    ".jsx",
    ".json",
    ".yml",
    ".yaml",
    ".css",
    ".md",
    ".env",
    ".example",
    ".txt",
}

INCLUDE_FILENAMES = {
    "Dockerfile",
    ".eslintrc.json",
    "next.config.mjs",
}


def iter_files() -> list[Path]:
    files: list[Path] = []

    for p in INCLUDE_TOP_LEVEL:
        if p.exists() and p.is_file():
            files.append(p)

    for d in INCLUDE_DIRS:
        if not d.exists():
            continue
        for p in d.rglob("*"):
            if not p.is_file():
                continue
            # exclude dirs by name anywhere in path
            if any(part in EXCLUDE_DIR_NAMES for part in p.parts):
                continue
            if p.name in INCLUDE_FILENAMES:
                files.append(p)
                continue
            if p.suffix.lower() in INCLUDE_EXTS:
                files.append(p)

    # de-dup + stable sort
    uniq = {f.resolve() for f in files}
    return sorted(uniq, key=lambda x: str(x).lower())


def read_text_lossy(path: Path) -> str:
    # Some files may contain odd bytes; keep conversion robust.
    return path.read_text(encoding="utf-8", errors="replace")


def fence_lang(path: Path) -> str:
    s = path.suffix.lower()
    return {
        ".js": "javascript",
        ".mjs": "javascript",
        ".cjs": "javascript",
        ".ts": "typescript",
        ".tsx": "tsx",
        ".jsx": "jsx",
        ".json": "json",
        ".yml": "yaml",
        ".yaml": "yaml",
        ".css": "css",
        ".md": "markdown",
        ".txt": "",
        ".env": "",
        ".example": "",
    }.get(s, "")


def build_full_markdown(out_path: Path) -> None:
    base_md = (ROOT / "code AI ML SEO.md").read_text(encoding="utf-8")

    files = iter_files()

    parts: list[str] = []
    parts.append(base_md.rstrip())
    parts.append("\n\n---\n\n## Appendix A) Full code listing (every file)\n")
    parts.append(
        "This appendix contains the full contents of each **source/config** file in the implementation.\n"
        "Excluded on purpose: `node_modules/`, `.next/`, build outputs.\n"
    )

    for p in files:
        rel = p.relative_to(REPO) if REPO in p.parents else p.relative_to(ROOT)
        parts.append(f"\n\n### File: `{rel.as_posix()}`\n")
        text = read_text_lossy(p).rstrip()
        lang = fence_lang(p)
        parts.append(f"```{lang}".rstrip())
        parts.append(text if text else "")
        parts.append("```")

    out_path.write_text("\n".join(parts) + "\n", encoding="utf-8")


if __name__ == "__main__":
    out_md = ROOT / "code AI ML SEO FULL.md"
    build_full_markdown(out_md)
    print(f"WROTE {out_md}")

