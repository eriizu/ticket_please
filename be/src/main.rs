use tracing::{error, info, trace, warn};

mod db;
mod util;
mod web_server;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let dotenv_res = dotenvy::dotenv();
    setup_tracing();
    if let Err(e) = dotenv_res {
        warn!(".env: {e}");
    }

    let pool = setup_sqlx().await?;
    // info!("databse connected");
    let repo = std::sync::Arc::new(db::Repository::new(pool));
    let repo_clone = repo.clone();
    tokio::spawn(async move {
        if let Err(err) = repo_clone.mig().await {
            error!("migration: {err}");
        }
        ensure_default_list_master(repo_clone).await;
    });
    web_server::start(repo).await?;
    Ok(())
}

const DEFAULT_LIST_MASTER_NAME: &'static str = "DEFAULT_LIST_MASTER";

async fn ensure_default_list_master(repo: std::sync::Arc<db::Repository>) {
    let root_list_masters = repo.get_root_list_master().await.unwrap();
    let env_secret = std::env::var(DEFAULT_LIST_MASTER_NAME).ok();
    let default_list_master = root_list_masters.iter().find(|x| x.lm_name == "default");

    match (default_list_master, env_secret) {
        (Some(master), Some(secret)) if master.lm_secret == secret => {
            info!(
                "default list master exists and {DEFAULT_LIST_MASTER_NAME} env variable and database match."
            );
        }
        (Some(master), Some(secret)) => {
            info!(
                "default list master exists but {DEFAULT_LIST_MASTER_NAME} env variable differs, updating default master list with secret: {}",
                master.lm_secret
            );
            repo.edit_list_master(
                &master.lm_secret,
                crate::db::PartialListMaster {
                    lm_name: None,
                    lm_parent: None,
                    lm_secret: Some(secret.to_owned()),
                },
            )
            .await
            .unwrap();
        }
        (Some(master), None) => info!(
            "default list master exists with secret: {} (no {DEFAULT_LIST_MASTER_NAME} provided) ",
            master.lm_secret
        ),
        (None, Some(secret)) => {
            warn!(
                "default list master DOES NOT exist, creating with {DEFAULT_LIST_MASTER_NAME} secret: {}",
                secret
            );
            repo.create_list_master(&secret, "default", None)
                .await
                .unwrap();
        }
        (None, None) if root_list_masters.is_empty() => {
            use crate::util::generate_secret;
            let generated_secret = generate_secret().unwrap();
            warn!(
                "default list master DOES NOT exist, creating with generated secret (add {DEFAULT_LIST_MASTER_NAME}={} to your env)",
                &generated_secret
            );
            repo.create_list_master(&generated_secret, "default", None)
                .await
                .unwrap();
        }
        (None, None) => {
            warn!(
                "default list master DOES NOT exist, no {DEFAULT_LIST_MASTER_NAME} env variable provided, NOT ensuring list master presence in DB"
            )
        }
    }
}

fn get_env_var(name: &str) -> anyhow::Result<String> {
    std::env::var(name).map_err(|e| anyhow::anyhow!(format!("{}: {}", name, e)))
}

fn get_env_var_parse<T: std::str::FromStr>(name: &str) -> anyhow::Result<T> {
    get_env_var(name).and_then(|val| {
        val.parse()
            .map_err(|_| anyhow::anyhow!("{}: {}: failed parsing", name, val))
    })
}

async fn setup_sqlx() -> anyhow::Result<sqlx::PgPool> {
    if let Ok(url) = std::env::var("DATABASE_URL") {
        info!("connecting to db using DATABASE_URL={}", url);
        Ok(sqlx::postgres::PgPoolOptions::new().connect(&url).await?)
    } else {
        let options = sqlx::postgres::PgConnectOptions::new()
            .host(get_env_var("PGHOST")?.as_str())
            .port(get_env_var_parse("PGPORT").unwrap_or(5432 as u16))
            .username(get_env_var("PGUSER")?.as_str())
            .database(get_env_var("PGDB")?.as_str())
            .password(get_env_var("PGPASS")?.as_str());
        Ok(sqlx::postgres::PgPoolOptions::new()
            .connect_with(options)
            .await?)
    }
}

async fn try_sqlx_request<'a, E: sqlx::PgExecutor<'a>>(pool: E) -> anyhow::Result<()> {
    let row = sqlx::query!("SELECT (1) as patate;")
        .fetch_one(pool)
        .await?;
    if let Some(patate) = row.patate {
        trace!("testing postgres connexion OK");
        println!("{}", patate);
        Ok(())
    } else {
        error!("testing postgres connexion NOK");
        Err(anyhow::anyhow!("DB is not working"))
    }
}

fn setup_tracing() {
    let subscriber = tracing_subscriber::FmtSubscriber::builder()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .pretty()
        .finish();
    tracing::subscriber::set_global_default(subscriber).expect("setting default subscriber failed");
}
