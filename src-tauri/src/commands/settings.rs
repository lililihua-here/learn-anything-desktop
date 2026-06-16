use crate::providers;
use crate::AppState;
use tauri::State;

const KEYRING_SERVICE: &str = "learn-anything-tool-desktop";
const SUPPORTED_PROVIDERS: [&str; 4] = ["anthropic", "openai", "deepseek", "qwen"];

fn provider_env_name(provider: &str) -> Result<&'static str, String> {
    match provider {
        "anthropic" => Ok("ANTHROPIC_API_KEY"),
        "openai" => Ok("OPENAI_API_KEY"),
        "deepseek" => Ok("DEEPSEEK_API_KEY"),
        "qwen" => Ok("QWEN_API_KEY"),
        _ => Err(format!("Unsupported provider: {}", provider)),
    }
}

fn credential_target_name(provider: &str) -> Result<String, String> {
    provider_env_name(provider)?;
    Ok(format!("{}/{}", KEYRING_SERVICE, provider))
}

#[cfg(target_os = "windows")]
mod secure_store {
    use std::ffi::c_void;
    use std::io;
    use std::os::windows::ffi::OsStrExt;
    use std::ptr::null_mut;

    const CRED_TYPE_GENERIC: u32 = 1;
    const CRED_PERSIST_LOCAL_MACHINE: u32 = 2;
    const ERROR_NOT_FOUND: i32 = 1168;

    #[repr(C)]
    struct FileTime {
        dw_low_date_time: u32,
        dw_high_date_time: u32,
    }

    #[repr(C)]
    struct CredentialAttributeW {
        keyword: *mut u16,
        flags: u32,
        value_size: u32,
        value: *mut u8,
    }

    #[repr(C)]
    struct CredentialW {
        flags: u32,
        type_: u32,
        target_name: *mut u16,
        comment: *mut u16,
        last_written: FileTime,
        credential_blob_size: u32,
        credential_blob: *mut u8,
        persist: u32,
        attribute_count: u32,
        attributes: *mut CredentialAttributeW,
        target_alias: *mut u16,
        user_name: *mut u16,
    }

    #[link(name = "Advapi32")]
    extern "system" {
        fn CredWriteW(credential: *const CredentialW, flags: u32) -> i32;
        fn CredReadW(
            target_name: *const u16,
            type_: u32,
            flags: u32,
            credential: *mut *mut CredentialW,
        ) -> i32;
        fn CredDeleteW(target_name: *const u16, type_: u32, flags: u32) -> i32;
        fn CredFree(buffer: *mut c_void);
    }

    fn to_utf16(value: &str) -> Vec<u16> {
        std::ffi::OsStr::new(value)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect()
    }

    pub fn set_secret(target: &str, username: &str, secret: &str) -> Result<(), String> {
        let mut target_wide = to_utf16(target);
        let mut username_wide = to_utf16(username);
        let mut blob = secret.as_bytes().to_vec();

        let credential = CredentialW {
            flags: 0,
            type_: CRED_TYPE_GENERIC,
            target_name: target_wide.as_mut_ptr(),
            comment: null_mut(),
            last_written: FileTime {
                dw_low_date_time: 0,
                dw_high_date_time: 0,
            },
            credential_blob_size: blob.len() as u32,
            credential_blob: if blob.is_empty() {
                null_mut()
            } else {
                blob.as_mut_ptr()
            },
            persist: CRED_PERSIST_LOCAL_MACHINE,
            attribute_count: 0,
            attributes: null_mut(),
            target_alias: null_mut(),
            user_name: username_wide.as_mut_ptr(),
        };

        let ok = unsafe { CredWriteW(&credential, 0) };
        if ok == 0 {
            return Err(format!(
                "Failed to store API key securely: {}",
                io::Error::last_os_error()
            ));
        }
        Ok(())
    }

    pub fn get_secret(target: &str) -> Result<String, String> {
        let target_wide = to_utf16(target);
        let mut credential_ptr: *mut CredentialW = null_mut();

        let ok = unsafe {
            CredReadW(
                target_wide.as_ptr(),
                CRED_TYPE_GENERIC,
                0,
                &mut credential_ptr,
            )
        };
        if ok == 0 {
            let err = io::Error::last_os_error();
            if err.raw_os_error() == Some(ERROR_NOT_FOUND) {
                return Err("Credential not found".to_string());
            }
            return Err(format!("Failed to read API key securely: {}", err));
        }

        let result = unsafe {
            let credential = &*credential_ptr;
            let bytes =
                if credential.credential_blob.is_null() || credential.credential_blob_size == 0 {
                    &[][..]
                } else {
                    std::slice::from_raw_parts(
                        credential.credential_blob,
                        credential.credential_blob_size as usize,
                    )
                };
            String::from_utf8(bytes.to_vec())
                .map_err(|e| format!("Stored API key is not valid UTF-8: {}", e))
        };

        unsafe {
            CredFree(credential_ptr.cast::<c_void>());
        }

        result
    }

    pub fn delete_secret(target: &str) -> Result<(), String> {
        let target_wide = to_utf16(target);
        let ok = unsafe { CredDeleteW(target_wide.as_ptr(), CRED_TYPE_GENERIC, 0) };
        if ok == 0 {
            let err = io::Error::last_os_error();
            if err.raw_os_error() == Some(ERROR_NOT_FOUND) {
                return Ok(());
            }
            return Err(format!("Failed to delete API key securely: {}", err));
        }
        Ok(())
    }
}

#[cfg(not(target_os = "windows"))]
mod secure_store {
    pub fn set_secret(_target: &str, _username: &str, _secret: &str) -> Result<(), String> {
        Err("Secure credential storage is only implemented for Windows builds".to_string())
    }

    pub fn get_secret(_target: &str) -> Result<String, String> {
        Err("Secure credential storage is only implemented for Windows builds".to_string())
    }

    pub fn delete_secret(_target: &str) -> Result<(), String> {
        Err("Secure credential storage is only implemented for Windows builds".to_string())
    }
}

pub fn get_api_key_for_provider(provider: &str) -> Result<String, String> {
    let env_name = provider_env_name(provider)?;

    if let Ok(existing) = std::env::var(env_name) {
        if !existing.trim().is_empty() {
            return Ok(existing);
        }
    }

    let target = credential_target_name(provider)?;
    let key = secure_store::get_secret(&target)
        .map_err(|_| format!("API key not configured for provider: {}", provider))?;

    if key.trim().is_empty() {
        return Err(format!("API key not configured for provider: {}", provider));
    }

    std::env::set_var(env_name, &key);
    Ok(key)
}

#[tauri::command]
pub async fn store_api_key(
    _state: State<'_, AppState>,
    provider: String,
    key: String,
) -> Result<(), String> {
    if key.trim().is_empty() {
        return Err("API key cannot be empty".to_string());
    }

    let target = credential_target_name(&provider)?;
    secure_store::set_secret(&target, &provider, &key)?;

    let env_name = provider_env_name(&provider)?;
    std::env::set_var(env_name, &key);

    Ok(())
}

#[tauri::command]
pub async fn get_api_keys(_state: State<'_, AppState>) -> Result<Vec<serde_json::Value>, String> {
    let mut result = Vec::new();

    for provider in SUPPORTED_PROVIDERS {
        let configured = credential_target_name(provider)
            .ok()
            .and_then(|target| secure_store::get_secret(&target).ok())
            .map(|key| !key.trim().is_empty())
            .unwrap_or(false);

        result.push(serde_json::json!({
            "provider": provider,
            "configured": configured
        }));
    }

    Ok(result)
}

#[tauri::command]
pub async fn delete_api_key(_state: State<'_, AppState>, provider: String) -> Result<(), String> {
    let target = credential_target_name(&provider)?;
    secure_store::delete_secret(&target)?;

    let env_name = provider_env_name(&provider)?;
    std::env::remove_var(env_name);

    Ok(())
}

#[tauri::command]
pub async fn validate_api_key(provider: String, key: String) -> Result<bool, String> {
    let adapter = providers::create_provider_adapter(&provider)?;
    adapter.validate_api_key(&key).await
}

#[tauri::command]
pub async fn save_settings(
    state: State<'_, AppState>,
    key: String,
    value: String,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| format!("Lock error: {}", e))?;
    crate::db::queries::save_setting(&db.query_conn, &key, &value)
        .map_err(|e| format!("DB error: {}", e))
}

#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> Result<Vec<serde_json::Value>, String> {
    let db = state.db.lock().map_err(|e| format!("Lock error: {}", e))?;
    let mut result = Vec::new();

    for key in ["model", "theme", "provider", "locale", "last_export_at"] {
        if let Ok(Some(val)) = crate::db::queries::get_setting(&db.query_conn, key) {
            result.push(serde_json::json!({ "key": key, "value": val }));
        }
    }

    Ok(result)
}
