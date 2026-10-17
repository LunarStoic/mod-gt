use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc;

use crate::bot::{Socks5Config};
use crate::bot_store::{SavedBot, SavedProxy};
use crate::bot_state::{BotCommand, BotState, BotStatus, CmdSender};
use crate::events::{WsEvent, WsTx};
use crate::items::ItemsDat;

pub struct BotEntry {
    pub username:         String,
    pub stop_flag:        Arc<AtomicBool>,
    pub state:            Arc<RwLock<BotState>>,
    pub cmd_tx:           CmdSender,
    /// Key in the bot store when this bot is persisted across restarts.
    pub persist_key:      Option<String>,
}

pub struct BotManager {
    next_id:   u32,
    pub bots:  HashMap<u32, BotEntry>,
    pub items_dat: Arc<ItemsDat>,
    pub ws_tx: WsTx,
}

#[derive(serde::Serialize)]
pub struct BotInfo {
    pub id:       u32,
    pub username: String,
    pub status:  String,
    pub world:   String,
    pub pos_x:   f32,
    pub pos_y:   f32,
    pub gems:    i32,
    pub ping_ms: u32,
}

impl BotManager {
    pub fn new(ws_tx: WsTx) -> Self {
        Self { next_id: 0, bots: HashMap::new(), items_dat: Arc::new(ItemsDat::load()), ws_tx }
    }

    pub fn spawn(&mut self, username: String, password: String, proxy: Option<Socks5Config>) -> u32 {
        let id = self.next_id;
        self.next_id += 1;

        let stop_flag   = Arc::new(AtomicBool::new(false));
        let stop_clone  = stop_flag.clone();
        let uname       = username.clone();
        let pass        = password.clone();

        let state = Arc::new(RwLock::new(BotState {
            status: BotStatus::Connecting,
            ..Default::default()
        }));
        let state_clone = state.clone();

        let (cmd_tx, cmd_rx) = mpsc::channel::<BotCommand>();

        let items_dat = self.items_dat.clone();
        let ws_tx_clone = self.ws_tx.clone();

        std::thread::spawn(move || {
            match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                let mut bot = crate::bot::Bot::new(&uname, &pass, proxy, state_clone, cmd_rx, items_dat, id, Some(ws_tx_clone));
                bot.run(stop_clone);
            })) {
                Ok(_)  => println!("[Bot:{id}] Stopped."),
                Err(_) => println!("[Bot:{id}] Crashed."),
            }
        });

        self.bots.insert(id, BotEntry { username: username.clone(), stop_flag, state, cmd_tx, persist_key: None });
        let _ = self.ws_tx.send(WsEvent::BotAdded { bot_id: id, username });
        id
    }

    /// Spawns an ltoken bot and remembers it so it is restored after a restart.
    pub fn spawn_ltoken(&mut self, ltoken_str: String, proxy: Option<Socks5Config>) -> u32 {
        let key = uuid::Uuid::new_v4().to_string();
        crate::bot_store::upsert(SavedBot {
            key: key.clone(),
            ltoken: ltoken_str.clone(),
            proxy: proxy.as_ref().map(SavedProxy::from_config),
        });
        self.spawn_ltoken_with_key(ltoken_str, proxy, key)
    }

    /// Re-creates the bots saved by a previous run (called once at startup).
    pub fn restore_saved(&mut self) {
        let saved = crate::bot_store::load();
        if !saved.is_empty() {
            println!("[BotStore] restoring {} saved bot(s)", saved.len());
        }
        for bot in saved {
            let proxy = bot.proxy.as_ref().and_then(SavedProxy::to_config);
            self.spawn_ltoken_with_key(bot.ltoken, proxy, bot.key);
        }
    }

    fn spawn_ltoken_with_key(
        &mut self,
        ltoken_str: String,
        proxy: Option<Socks5Config>,
        key: String,
    ) -> u32 {
        let id = self.next_id;
        self.next_id += 1;

        let stop_flag  = Arc::new(AtomicBool::new(false));
        let stop_clone = stop_flag.clone();

        let state = Arc::new(RwLock::new(BotState {
            status: BotStatus::Connecting,
            ..Default::default()
        }));
        let state_clone = state.clone();

        let (cmd_tx, cmd_rx) = mpsc::channel::<BotCommand>();

        let items_dat = self.items_dat.clone();
        let ws_tx_clone = self.ws_tx.clone();

        let bot_key = key.clone();
        std::thread::spawn(move || {
            match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                let mut bot = crate::bot::Bot::new_ltoken(&ltoken_str, proxy, state_clone, cmd_rx, items_dat, id, Some(ws_tx_clone), Some(bot_key));
                bot.run(stop_clone);
            })) {
                Ok(_)  => println!("[Bot:{id}] Stopped."),
                Err(_) => println!("[Bot:{id}] Crashed."),
            }
        });

        self.bots.insert(id, BotEntry { username: String::new(), stop_flag, state, cmd_tx, persist_key: Some(key) });
        let _ = self.ws_tx.send(WsEvent::BotAdded { bot_id: id, username: String::new() });
        id
    }

    pub fn stop(&mut self, id: u32) -> bool {
        if let Some(entry) = self.bots.remove(&id) {
            entry.stop_flag.store(true, Ordering::Relaxed);
            if let Some(key) = &entry.persist_key {
                crate::bot_store::remove(key);
            }
            let _ = self.ws_tx.send(WsEvent::BotRemoved { bot_id: id });
            true
        } else {
            false
        }
    }

    pub fn list(&self) -> Vec<BotInfo> {
        self.bots.iter().map(|(id, e)| {
            let s = e.state.read().unwrap();
            BotInfo {
                id:       *id,
                username: e.username.clone(),
                status:  s.status.to_string(),
                world:   s.world_name.clone(),
                pos_x:   s.pos_x,
                pos_y:   s.pos_y,
                gems:    s.gems,
                ping_ms: s.ping_ms,
            }
        }).collect()
    }

    pub fn get_state(&self, id: u32) -> Option<BotState> {
        self.bots.get(&id).map(|e| e.state.read().unwrap().clone())
    }

    pub fn send_cmd(&self, id: u32, cmd: BotCommand) -> bool {
        self.bots.get(&id).map(|e| e.cmd_tx.send(cmd).is_ok()).unwrap_or(false)
    }

    pub fn run_script(&self, id: u32, content: String) -> bool {
        self.send_cmd(id, BotCommand::RunScript { content })
    }

    pub fn find_by_name(&self, name: &str) -> Option<(Arc<RwLock<BotState>>, CmdSender)> {
        self.bots.values()
            .find(|e| e.username.eq_ignore_ascii_case(name))
            .map(|e| (e.state.clone(), e.cmd_tx.clone()))
    }

    pub fn stop_by_name(&mut self, name: &str) -> bool {
        if let Some(id) = self.bots.iter()
            .find(|(_, e)| e.username.eq_ignore_ascii_case(name))
            .map(|(id, _)| *id)
        {
            self.stop(id)
        } else {
            false
        }
    }
}
