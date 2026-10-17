//! Persists ltoken-based bots (the Google and Ltoken tabs) so they survive a restart.
//!
//! The file lives in `data/bots.json` next to `user.json` (the Docker volume).
//! It holds the latest `token|rid|mac|wk` string of each bot, which is equivalent to
//! an account login, so the file is created readable by the owner only (Unix).
//! Legacy bots are not stored because their password is deliberately never saved.

use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Mutex;

use crate::bot::Socks5Config;

/// Serializes read-modify-write cycles; bots refresh their token from separate threads.
static LOCK: Mutex<()> = Mutex::new(());

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SavedProxy {
    pub addr: String,
    pub username: Option<String>,
    pub password: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SavedBot {
    /// Stable id, independent of the per-run numeric bot id.
    pub key: String,
    /// Latest `token|rid|mac|wk`.
    pub ltoken: String,
    pub proxy: Option<SavedProxy>,
}

impl SavedProxy {
    pub fn from_config(cfg: &Socks5Config) -> Self {
        Self {
            addr: cfg.proxy_addr.to_string(),
            username: cfg.username.clone(),
            password: cfg.password.clone(),
        }
    }

    pub fn to_config(&self) -> Option<Socks5Config> {
        let proxy_addr: SocketAddr = self.addr.parse().ok()?;
        Some(Socks5Config {
            proxy_addr,
            username: self.username.clone(),
            password: self.password.clone(),
        })
    }
}

fn path() -> PathBuf {
    std::env::current_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("data")
        .join("bots.json")
}

fn read_all() -> Vec<SavedBot> {
    std::fs::read_to_string(path())
        .ok()
        .and_then(|data| serde_json::from_str(&data).ok())
        .unwrap_or_default()
}

fn write_all(bots: &[SavedBot]) {
    let result = (|| -> anyhow::Result<()> {
        let path = path();
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let tmp = path.with_extension("json.tmp");
        std::fs::write(&tmp, serde_json::to_string_pretty(bots)?)?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&tmp, std::fs::Permissions::from_mode(0o600))?;
        }
        std::fs::rename(&tmp, &path)?;
        Ok(())
    })();
    if let Err(e) = result {
        println!("[BotStore] failed to save bots: {e}");
    }
}

fn locked() -> std::sync::MutexGuard<'static, ()> {
    LOCK.lock().unwrap_or_else(|e| e.into_inner())
}

pub fn load() -> Vec<SavedBot> {
    let _guard = locked();
    read_all()
}

pub fn upsert(bot: SavedBot) {
    let _guard = locked();
    let mut bots = read_all();
    match bots.iter_mut().find(|b| b.key == bot.key) {
        Some(existing) => *existing = bot,
        None => bots.push(bot),
    }
    write_all(&bots);
}

/// Stores a refreshed token for an existing bot (no-op if the bot was removed).
pub fn update_token(key: &str, ltoken: String) {
    let _guard = locked();
    let mut bots = read_all();
    if let Some(bot) = bots.iter_mut().find(|b| b.key == key) {
        bot.ltoken = ltoken;
        write_all(&bots);
    }
}

pub fn remove(key: &str) {
    let _guard = locked();
    let mut bots = read_all();
    let before = bots.len();
    bots.retain(|b| b.key != key);
    if bots.len() != before {
        write_all(&bots);
    }
}
