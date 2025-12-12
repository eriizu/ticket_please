use base64::Engine as _;

fn main() {
    let mut buf = [0u8; 32];
    getrandom::fill(&mut buf).unwrap();
    let out = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(buf);
    println!("{}", out);
}
