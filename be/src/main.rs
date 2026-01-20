use anyhow::Context as _;
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
        ensure_root_list_master(repo_clone).await;
    });
    web_server::start(repo).await?;
    Ok(())
}

async fn ensure_root_list_master(repo: std::sync::Arc<db::Repository>) {
    let root_list_master = repo.get_root_list_master().await.unwrap();
    if root_list_master.is_empty() {
        use crate::util::generate_secret;
        let secret = generate_secret().unwrap();
        warn!("no root list master exist, creating with secret {}", secret);
        repo.create_list_master(&secret, "root", None)
            .await
            .unwrap();
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
        Ok(sqlx::postgres::PgPoolOptions::new().connect_lazy(&url)?)
    } else {
        let options = sqlx::postgres::PgConnectOptions::new()
            .host(get_env_var("PGHOST")?.as_str())
            .port(get_env_var_parse("PGPORT")?)
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
