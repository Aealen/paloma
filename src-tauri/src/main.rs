// Paloma · 细节 01：只做一颗活着的球。
// 窗口尺寸/透明/置顶全部在 tauri.conf.json 声明，Rust 侧零业务。
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
