use serde::{Deserialize, Serialize};
use std::path::Path;
use walkdir::WalkDir;

const MAX_FILE_SIZE: u64 = 500 * 1024; // 500KB

const SKIP_DIRS: &[&str] = &[
    "node_modules",
    ".git",
    "dist",
    "build",
    "target",
    "__pycache__",
    ".next",
    ".nuxt",
    "coverage",
    ".cache",
    "venv",
    ".venv",
    "vendor",
    ".idea",
    ".vscode",
];

const SKIP_EXTENSIONS: &[&str] = &[
    "exe", "dll", "so", "dylib", "png", "jpg", "jpeg", "ico", "gif", "svg", "lock", "map", "woff",
    "woff2", "ttf", "eot", "otf", "mp3", "mp4", "avi", "mov", "webm", "ogg", "wav", "pdf", "zip",
    "tar", "gz", "bz2", "xz", "7z", "rar", "wasm", "bin", "dat",
];

const CONFIG_FILES: &[&str] = &[
    "package.json",
    "Cargo.toml",
    "Cargo.lock",
    "pyproject.toml",
    "tsconfig.json",
    "vite.config.ts",
    "vite.config.js",
    "webpack.config.js",
    "next.config.js",
    "Makefile",
    "Dockerfile",
    "docker-compose.yml",
    ".env.example",
    "README.md",
    "LICENSE",
];

const ENTRY_PATTERNS: &[&str] = &[
    "main.rs",
    "main.ts",
    "main.tsx",
    "main.js",
    "main.jsx",
    "main.py",
    "App.tsx",
    "App.ts",
    "App.jsx",
    "App.js",
    "index.ts",
    "index.tsx",
    "index.js",
    "index.jsx",
    "index.html",
    "lib.rs",
    "mod.rs",
];

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectFile {
    pub path: String,
    pub relative_path: String,
    pub size: u64,
    pub extension: String,
    pub skipped: bool,
    pub skip_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult {
    pub total_files: usize,
    pub included_files: Vec<ProjectFile>,
    pub skipped_files: Vec<ProjectFile>,
    pub estimated_tokens: usize,
}

/// Determine the priority sort key for a file.
/// Lower number = higher priority.
fn file_priority(relative: &str, file_name: &str) -> u8 {
    // Config files (highest priority)
    if CONFIG_FILES.iter().any(|cf| file_name == *cf) {
        return 0;
    }
    // Entry files
    if ENTRY_PATTERNS.iter().any(|ep| file_name == *ep) {
        return 1;
    }
    // Source files under src/
    if relative.starts_with("src") && !relative.contains("node_modules") {
        return 2;
    }
    // Other source code files (in any directory, based on extension)
    let source_exts = [
        "rs", "ts", "tsx", "js", "jsx", "py", "go", "java", "c", "cpp", "h", "hpp", "cs", "rb",
        "php", "swift", "kt", "scala", "r", "sh", "bash", "ps1", "sql", "graphql", "proto", "yaml",
        "yml", "toml", "json", "xml", "css", "scss", "less", "html", "md", "mdx",
    ];
    let ext = Path::new(file_name)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");
    if source_exts.contains(&ext) {
        return 3;
    }
    // Everything else
    4
}

/// Check whether a directory name should be skipped.
fn is_skip_dir(dir_name: &str) -> bool {
    SKIP_DIRS.contains(&dir_name) || dir_name.starts_with('.')
}

/// Check whether a file extension should be skipped.
fn is_skip_extension(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|ext| SKIP_EXTENSIONS.contains(&ext.to_lowercase().as_str()))
        .unwrap_or(false)
}

/// Scan a project directory and return a ScanResult.
pub fn scan_project(root: &Path) -> ScanResult {
    let mut included_files: Vec<ProjectFile> = Vec::new();
    let mut skipped_files: Vec<ProjectFile> = Vec::new();
    let mut total_files: usize = 0;

    let root_canonical = root.canonicalize().unwrap_or_else(|_| root.to_path_buf());

    for entry in WalkDir::new(root)
        .follow_links(false)
        .into_iter()
        .filter_entry(|e| {
            // Skip hidden directories and known skip dirs
            if e.file_type().is_dir() {
                let name = e.file_name().to_str().unwrap_or("");
                return !is_skip_dir(name);
            }
            true
        })
    {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };

        // Only process files (not directories)
        if !entry.file_type().is_file() {
            continue;
        }

        total_files += 1;
        let full_path = entry.path().to_path_buf();

        // Build relative path
        let relative_path = full_path
            .strip_prefix(&root_canonical)
            .unwrap_or(&full_path)
            .to_string_lossy()
            .replace('\\', "/");

        let extension = full_path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_string();

        let size = match std::fs::metadata(&full_path) {
            Ok(m) => m.len(),
            Err(_) => continue,
        };

        let full_path_str = full_path.to_string_lossy().to_string();

        let pf = ProjectFile {
            path: full_path_str.clone(),
            relative_path: relative_path.clone(),
            size,
            extension: extension.clone(),
            skipped: false,
            skip_reason: None,
        };

        // Check skip conditions
        let mut skip_reason: Option<String> = None;

        if is_skip_extension(&full_path) {
            skip_reason = Some(format!("Skipped extension: .{}", extension));
        } else if size > MAX_FILE_SIZE {
            skip_reason = Some(format!(
                "File too large: {} bytes (limit: {})",
                size, MAX_FILE_SIZE
            ));
        }

        if let Some(reason) = skip_reason {
            let mut skipped = pf;
            skipped.skipped = true;
            skipped.skip_reason = Some(reason);
            skipped_files.push(skipped);
        } else {
            included_files.push(pf);
        }
    }

    // Sort included files by priority
    included_files.sort_by_key(|f| {
        let rel = &f.relative_path;
        let name = Path::new(&f.path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("");
        file_priority(rel, name)
    });

    let estimated_tokens = included_files
        .iter()
        .map(|f| f.size as usize)
        .sum::<usize>()
        / 3;

    ScanResult {
        total_files,
        included_files,
        skipped_files,
        estimated_tokens,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::io::Write;

    #[test]
    fn test_scan_empty_dir() {
        let dir = std::env::temp_dir().join("test_scan_empty");
        let _ = fs::create_dir_all(&dir);
        let result = scan_project(&dir);
        assert_eq!(result.total_files, 0);
        assert_eq!(result.included_files.len(), 0);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_scan_skips_node_modules() {
        let dir = std::env::temp_dir().join("test_scan_node_modules");
        let _ = fs::create_dir_all(&dir);
        let nm = dir.join("node_modules").join("some-lib");
        let _ = fs::create_dir_all(&nm);
        let mut f = fs::File::create(nm.join("index.js")).unwrap();
        f.write_all(b"console.log('hello');").unwrap();
        let result = scan_project(&dir);
        assert_eq!(result.total_files, 0);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_scan_includes_source() {
        let dir = std::env::temp_dir().join("test_scan_source");
        let _ = fs::create_dir_all(&dir.join("src"));
        let mut f = fs::File::create(dir.join("src").join("main.rs")).unwrap();
        f.write_all(b"fn main() {}").unwrap();
        let result = scan_project(&dir);
        assert_eq!(result.included_files.len(), 1);
        assert_eq!(result.estimated_tokens, 11 / 3);
        let _ = fs::remove_dir_all(&dir);
    }
}
