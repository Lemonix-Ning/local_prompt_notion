use std::fs;
use std::path::Path;
use std::sync::Mutex;

use tauri::Manager;
use tauri::{menu::{Menu, MenuItem}, tray::{TrayIconBuilder, TrayIconEvent}};
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

struct BackendProcess(Mutex<Option<CommandChild>>);

struct CloseBehaviorState(Mutex<String>);

// "minimize" => hide to tray
// "exit" => exit app
fn normalize_close_behavior(value: &str) -> String {
    match value {
        "exit" => "exit".to_string(),
        _ => "minimize".to_string(),
    }
}

fn terminate_backend(app: &tauri::AppHandle) {
    if let Some(state) = app.try_state::<BackendProcess>() {
        if let Ok(mut guard) = state.0.lock() {
            if let Some(child) = guard.take() {
                println!("Terminating backend process...");
                // 尝试正常终止
                if let Err(e) = child.kill() {
                    eprintln!("Failed to kill backend process: {}", e);
                } else {
                    println!("Backend process terminated");
                }
            }
        }
    }
    
    // 🔥 后台异步清理进程，避免阻塞主线程和黑窗闪烁
    #[cfg(target_os = "windows")]
    {
        std::thread::spawn(|| {
            use std::process::Command;
            
            // 等待一小段时间，让主窗口先关闭
            std::thread::sleep(std::time::Duration::from_millis(100));
            
            // 静默终止 server.exe（不显示窗口）
            let _ = Command::new("taskkill")
                .args(&["/F", "/IM", "server.exe"])
                .creation_flags(0x08000000) // CREATE_NO_WINDOW
                .output();
            
            // 🔥 终止 Node.js 进程（通过端口 3002 识别）
            if let Ok(output) = Command::new("netstat")
                .args(&["-ano"])
                .creation_flags(0x08000000) // CREATE_NO_WINDOW
                .output()
            {
                if let Ok(output_str) = String::from_utf8(output.stdout) {
                    for line in output_str.lines() {
                        if line.contains(":3002") && line.contains("LISTENING") {
                            if let Some(pid_str) = line.split_whitespace().last() {
                                if let Ok(pid) = pid_str.parse::<u32>() {
                                    println!("Killing process on port 3002, PID: {}", pid);
                                    let _ = Command::new("taskkill")
                                        .args(&["/F", "/PID", &pid.to_string()])
                                        .creation_flags(0x08000000) // CREATE_NO_WINDOW
                                        .output();
                                }
                            }
                        }
                    }
                }
            }
        });
    }
}

// 🔥 退出应用命令
#[tauri::command]
fn exit_app(app: tauri::AppHandle) {
    println!("User requested exit from frontend");
    terminate_backend(&app);
    app.exit(0);
}

#[tauri::command]
fn set_close_behavior(app: tauri::AppHandle, behavior: String) {
    let normalized = normalize_close_behavior(&behavior);
    if let Some(state) = app.try_state::<CloseBehaviorState>() {
        if let Ok(mut guard) = state.0.lock() {
            *guard = normalized;
        }
    } else {
        app.manage(CloseBehaviorState(Mutex::new(normalized)));
    }
}

#[tauri::command]
fn get_close_behavior(app: tauri::AppHandle) -> String {
    if let Some(state) = app.try_state::<CloseBehaviorState>() {
        if let Ok(guard) = state.0.lock() {
            return normalize_close_behavior(&guard);
        }
    }
    "minimize".to_string()
}

// 🔥 启动后端服务器命令（用于延迟启动）
#[tauri::command]
async fn start_backend_if_needed(app: tauri::AppHandle) -> Result<String, String> {
    // 检查后端是否已经运行
    if let Some(state) = app.try_state::<BackendProcess>() {
        if let Ok(guard) = state.0.lock() {
            if guard.is_some() {
                return Ok("Backend already running".to_string());
            }
        }
    }

    // 🚀 优化：减少日志输出
    // 获取 vault 路径
    let vault_root = app
        .path()
        .executable_dir()
        .unwrap_or_else(|_| std::path::PathBuf::from("."))
        .join("vault");

    let sidecar_result = app.shell().sidecar("server");

    match sidecar_result {
        Ok(command) => {
            let spawn_result = command
                .env("PORT", "3002")
                .env("VAULT_PATH", vault_root.to_string_lossy().to_string())
                .spawn();

            match spawn_result {
                Ok((_rx, child)) => {
                    // 更新后端进程状态
                    if let Some(state) = app.try_state::<BackendProcess>() {
                        if let Ok(mut guard) = state.0.lock() {
                            *guard = Some(child);
                        }
                    }
                    println!("✓ Backend started (deferred)");
                    Ok("Backend started successfully".to_string())
                }
                Err(err) => {
                    eprintln!("✗ Failed to start backend: {}", err);
                    Err(format!("Failed to spawn backend: {}", err))
                }
            }
        }
        Err(err) => {
            eprintln!("✗ Failed to create sidecar: {}", err);
            Err(format!("Failed to create sidecar command: {}", err))
        }
    }
}

fn copy_dir_all(src: impl AsRef<Path>, dst: impl AsRef<Path>) -> std::io::Result<()> {
    fs::create_dir_all(&dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        if ty.is_dir() {
            copy_dir_all(entry.path(), dst.as_ref().join(entry.file_name()))?;
        } else {
            fs::copy(entry.path(), dst.as_ref().join(entry.file_name()))?;
        }
    }
    Ok(())
}

fn ensure_vault_data(vault_path: &Path, app: &tauri::AppHandle) -> std::io::Result<()> {
    // 如果 vault 目录不存在或为空，复制示例数据
    if !vault_path.exists() || vault_path.read_dir()?.next().is_none() {
        // 尝试从打包的资源中复制示例数据
        let sample_vault = if let Ok(resource_dir) = app.path().resource_dir() {
            let resource_sample = resource_dir.join("sample-vault");
            if resource_sample.exists() {
                resource_sample
            } else {
                // 尝试可执行文件旁边的路径
                app.path().executable_dir().unwrap_or_default().join("sample-vault")
            }
        } else {
            // 尝试可执行文件旁边的路径
            app.path().executable_dir().unwrap_or_default().join("sample-vault")
        };
        
        if sample_vault.exists() {
            println!("Copying sample vault from: {:?} to {:?}", sample_vault, vault_path);
            copy_dir_all(sample_vault, vault_path)?;
            return Ok(());
        }
        
        // 如果找不到示例数据，创建基本结构
        println!("Creating basic vault structure at: {:?}", vault_path);
        fs::create_dir_all(vault_path.join("Coding"))?;
        fs::create_dir_all(vault_path.join("Business"))?;
        fs::create_dir_all(vault_path.join("Creative Writing"))?;
        fs::create_dir_all(vault_path.join("trash"))?;
    }
    Ok(())
}

// 🔥 快速检查是否有 interval 任务（轻量级扫描）
fn has_interval_tasks(vault_path: &Path) -> bool {
    // 递归扫描 vault 目录，查找包含 interval 字段的 meta.json
    fn scan_dir(dir: &Path) -> bool {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                
                // 跳过特殊目录
                if let Some(name) = path.file_name() {
                    let name_str = name.to_string_lossy();
                    if name_str.starts_with('.') || name_str == "trash" || name_str == "assets" {
                        continue;
                    }
                }
                
                if path.is_dir() {
                    // 检查是否是提示词目录（包含 meta.json）
                    let meta_path = path.join("meta.json");
                    if meta_path.exists() {
                        // 读取 meta.json 并检查是否有 interval 字段
                        if let Ok(content) = fs::read_to_string(&meta_path) {
                            // 简单的字符串检查，避免完整 JSON 解析
                            if content.contains("\"interval\"") && content.contains("\"minutes\"") {
                                return true;
                            }
                        }
                    } else {
                        // 递归扫描子目录
                        if scan_dir(&path) {
                            return true;
                        }
                    }
                }
            }
        }
        false
    }
    
    scan_dir(vault_path)
}

// 🔥 立即启动后端服务器
fn start_backend_immediately(app: &tauri::AppHandle, vault_root: &Path) {
    use tauri::Manager;
    
    // 🚀 优化：减少日志输出，加快启动速度
    let sidecar_result = app.shell().sidecar("server");
    
    match sidecar_result {
        Ok(command) => {
            let spawn_result = command
                .env("PORT", "3002")
                .env("VAULT_PATH", vault_root.to_string_lossy().to_string())
                .spawn();

            match spawn_result {
                Ok((_rx, child)) => {
                    // 尝试更新已存在的状态，或者创建新状态
                    if let Some(state) = app.try_state::<BackendProcess>() {
                        if let Ok(mut guard) = state.0.lock() {
                            *guard = Some(child);
                        }
                    } else {
                        app.manage(BackendProcess(Mutex::new(Some(child))));
                    }
                    println!("✓ Backend started on port 3002");
                }
                Err(err) => {
                    eprintln!("✗ Failed to start backend: {}", err);
                }
            }
        }
        Err(err) => {
            eprintln!("✗ Failed to create sidecar: {}", err);
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  // 检查是否是开机自启动
  let args: Vec<String> = std::env::args().collect();
  let is_autostart = args.iter().any(|arg| arg == "--autostart" || arg == "--hidden");
  
  let app = tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    // 🔥 单实例插件：如果已有实例运行，激活已有窗口而不是启动新实例
    .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
      println!("Another instance tried to start, focusing existing window...");
      // 激活已有窗口
      if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
      }
    }))
    // 🔥 通知插件：支持系统级任务提醒
    .plugin(tauri_plugin_notification::init())
    .invoke_handler(tauri::generate_handler![exit_app, start_backend_if_needed, set_close_behavior, get_close_behavior])
    .setup(move |app| {
      // 🚀 优化：减少启动日志，加快启动速度
      #[cfg(desktop)]
      {
        use tauri_plugin_autostart::MacosLauncher;
        
        // 初始化自启动插件，直接传入参数
        let _ = app
          .handle()
          .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent, 
            Some(vec!["--autostart"])
          ));
      }

      // Portable default: vault next to the executable (e.g. on a USB drive).
      let vault_root = app
        .path()
        .executable_dir()
        .unwrap_or_else(|_| std::path::PathBuf::from("."))
        .join("vault");

      // 默认关闭行为：最小化到托盘
      app.manage(CloseBehaviorState(Mutex::new("minimize".to_string())));

      if let Err(err) = std::fs::create_dir_all(&vault_root) {
        eprintln!("Failed to create vault directory: {}", err);
      }

      if let Err(err) = ensure_vault_data(&vault_root, app.handle()) {
        eprintln!("Failed to ensure vault seed data: {}", err);
      }

      // 🔥 智能启动策略：检查是否有 interval 任务
      let has_tasks = has_interval_tasks(&vault_root);

      // 🔥 根据情况决定后端启动策略
      if !is_autostart {
        // 正常启动：立即启动后端
        start_backend_immediately(app.handle(), &vault_root);
      } else if has_tasks {
        // 🚀 优化：自启动 + 有任务：延迟 15 秒后启动后端（从 30 秒减少到 15 秒）
        let app_handle = app.handle().clone();
        let vault_root_clone = vault_root.clone();
        std::thread::spawn(move || {
          std::thread::sleep(std::time::Duration::from_secs(15));
          start_backend_immediately(&app_handle, &vault_root_clone);
        });
        // 初始化空的后端进程状态
        app.manage(BackendProcess(Mutex::new(None)));
      } else {
        // 自启动 + 无任务：不启动后端
        // 初始化空的后端进程状态
        app.manage(BackendProcess(Mutex::new(None)));
      }

      // 创建系统托盘菜单
      let show_item = MenuItem::with_id(app, "show", "显示窗口", true, None::<&str>)?;
      let quit_item = MenuItem::with_id(app, "quit", "退出程序", true, None::<&str>)?;
      let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

      // 创建系统托盘图标
      let _tray = TrayIconBuilder::with_id("main-tray")
        .tooltip("Lumina")
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .on_menu_event(|app, event| {
          match event.id.as_ref() {
            "show" => {
              // 🔥 显示窗口前先确保后端已启动
              let app_clone = app.clone();
              tauri::async_runtime::spawn(async move {
                if let Err(e) = start_backend_if_needed(app_clone.clone()).await {
                  eprintln!("Failed to start backend: {}", e);
                }
              });
              
              if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
              }
            }
            "quit" => {
              println!("User requested quit from tray menu");
              terminate_backend(app);
              app.exit(0);
            }
            _ => {}
          }
        })
        .on_tray_icon_event(|tray, event| {
          if let TrayIconEvent::Click { button: tauri::tray::MouseButton::Left, .. } = event {
            let app = tray.app_handle();
            
            // 🔥 显示窗口前先确保后端已启动
            let app_clone = app.clone();
            tauri::async_runtime::spawn(async move {
              if let Err(e) = start_backend_if_needed(app_clone.clone()).await {
                eprintln!("Failed to start backend: {}", e);
              }
            });
            
            if let Some(window) = app.get_webview_window("main") {
              let _ = window.show();
              let _ = window.set_focus();
            }
          }
        })
        .build(app)?;

      // 🔥 只在开机自启动时隐藏窗口
      if is_autostart {
        if let Some(window) = app.get_webview_window("main") {
          let _ = window.hide();
        }
        
        // 发送系统通知
        use tauri_plugin_notification::NotificationExt;
        let _ = app.notification()
          .builder()
          .title("Lumina 已启动")
          .body("应用已在后台运行，点击托盘图标打开")
          .show();
      }

      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while building tauri application");

  app.run(|app_handle, event| {
    match event {
      // 🔥 移除窗口关闭拦截，让前端的 handleClose 处理关闭逻辑
      // 如果用户直接点击窗口的 X 按钮（非自定义标题栏），则隐藏窗口
      tauri::RunEvent::WindowEvent { label, event: win_event, .. } => {
        if label == "main" {
          if let tauri::WindowEvent::CloseRequested { api, .. } = win_event {
            api.prevent_close();

            let behavior = if let Some(state) = app_handle.try_state::<CloseBehaviorState>() {
              state.0.lock().ok().map(|g| normalize_close_behavior(&g)).unwrap_or_else(|| "minimize".to_string())
            } else {
              "minimize".to_string()
            };

            if behavior == "exit" {
              println!("Close requested: exit");
              terminate_backend(&app_handle);
              app_handle.exit(0);
              return;
            }

            if let Some(window) = app_handle.get_webview_window("main") {
              let _ = window.hide();
            }
          }
        }
      }
      tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit => {
        println!("Application is closing, terminating backend server...");
        terminate_backend(&app_handle);
      }
      _ => {}
    }
  });
}
