use poem::{Endpoint, EndpointExt, IntoResponse as _, Middleware, Request, Response, Result};

fn compute_etag(content: &[u8]) -> String {
    use std::hash::{DefaultHasher, Hash as _, Hasher as _};
    let mut hasher = DefaultHasher::new();
    content.hash(&mut hasher);
    format!("\"{}\"", hasher.finish())
}

pub struct EtagMiddleware;

impl<E: Endpoint> Middleware<E> for EtagMiddleware {
    type Output = EtagMiddlewareImpl<E>;

    fn transform(&self, ep: E) -> Self::Output {
        EtagMiddlewareImpl { ep }
    }
}

#[derive(Clone)]
pub struct EtagMiddlewareImpl<E> {
    ep: E,
}

impl<E: Endpoint> Endpoint for EtagMiddlewareImpl<E> {
    type Output = Response;

    async fn call(&self, req: Request) -> Result<Self::Output> {
        let if_none_match = req
            .header(poem::http::header::IF_NONE_MATCH)
            .map(|s| s.to_string());
        let resp = self.ep.call(req).await?.into_response();
        let (parts, body) = resp.into_parts();
        let body_bytes = body.into_vec().await?;

        // Compute ETag
        let etag = compute_etag(&body_bytes);

        // Check If-None-Match
        if let Some(client_etag) = if_none_match {
            if client_etag == etag {
                return Ok(Response::builder()
                    .status(poem::http::StatusCode::NOT_MODIFIED)
                    .header(poem::http::header::ETAG, etag)
                    .finish());
            }
        }

        // Rebuild response with ETag header
        let mut resp = Response::from_parts(parts, body_bytes.into());
        resp.headers_mut()
            .insert(poem::http::header::ETAG, etag.parse().unwrap());
        return Ok(resp);
    }
}

#[cfg(test)]
mod t {
    use super::*;
    use poem::test::TestClient;
    // Use the `TokenMiddleware` middleware to convert the `index` endpoint.

    #[poem::handler]
    async fn hello() -> &'static str {
        "hello world"
    }

    #[tokio::test]
    async fn etag_middleware_adds_etag_header() {
        let ep = hello.with(EtagMiddleware);
        let client = TestClient::new(ep);

        let resp = client.get("/").send().await;
        resp.assert_status_is_ok();

        let etag = resp.0.headers().get(poem::http::header::ETAG);
        assert!(etag.is_some(), "Response should contain ETag header");

        let etag_value = etag.unwrap().to_str().unwrap();
        assert!(
            etag_value.starts_with('"') && etag_value.ends_with('"'),
            "ETag should be quoted"
        );
    }

    #[tokio::test]
    async fn etag_middleware_returns_304_when_etag_matches() {
        let ep = hello.with(EtagMiddleware);
        let client = TestClient::new(ep);

        // First request to get the ETag
        let resp = client.get("/").send().await;
        resp.assert_status_is_ok();
        let etag = resp
            .0
            .headers()
            .get(poem::http::header::ETAG)
            .unwrap()
            .to_str()
            .unwrap()
            .to_string();

        // Second request with If-None-Match header
        let resp = client
            .get("/")
            .header(poem::http::header::IF_NONE_MATCH, &etag)
            .send()
            .await;
        resp.assert_status(poem::http::StatusCode::NOT_MODIFIED);

        // 304 response should also include the ETag header
        let resp_etag = resp.0.headers().get(poem::http::header::ETAG);
        assert!(
            resp_etag.is_some(),
            "304 response should contain ETag header"
        );
        assert_eq!(resp_etag.unwrap().to_str().unwrap(), etag);
    }

    #[tokio::test]
    async fn etag_middleware_returns_200_when_etag_does_not_match() {
        let ep = hello.with(EtagMiddleware);
        let client = TestClient::new(ep);

        // Request with a non-matching If-None-Match header
        let resp = client
            .get("/")
            .header(poem::http::header::IF_NONE_MATCH, "\"wrong-etag\"")
            .send()
            .await;
        resp.assert_status_is_ok();
    }

    #[tokio::test]
    async fn etag_is_consistent_for_same_content() {
        let ep = hello.with(EtagMiddleware);
        let client = TestClient::new(ep);

        let resp1 = client.get("/").send().await;
        let etag1 = resp1
            .0
            .headers()
            .get(poem::http::header::ETAG)
            .unwrap()
            .to_str()
            .unwrap()
            .to_string();

        let resp2 = client.get("/").send().await;
        let etag2 = resp2
            .0
            .headers()
            .get(poem::http::header::ETAG)
            .unwrap()
            .to_str()
            .unwrap()
            .to_string();

        assert_eq!(etag1, etag2, "ETag should be consistent for same content");
    }
}
