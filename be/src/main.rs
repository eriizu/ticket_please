use tracing::{error, info, trace};
mod db;
mod web_server;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv()?;
    setup_tracing();

    let pool = setup_sqlx().await?;
    info!("databse connected");
    let repo = db::Repository::new(pool);
    repo.mig().await.unwrap();
    web_server::start(std::sync::Arc::new(repo)).await?;
    Ok(())
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
        .without_time()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .finish();
    tracing::subscriber::set_global_default(subscriber).expect("setting default subscriber failed");
}
