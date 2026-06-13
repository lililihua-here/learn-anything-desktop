pub mod bridge;
pub mod persistence;
pub mod protocol;
pub mod transport;
pub mod types;

use tokio::sync::broadcast;
use types::StreamEvent;

const BROADCAST_CAPACITY: usize = 256;

pub fn create_channel() -> (
    broadcast::Sender<StreamEvent>,
    broadcast::Receiver<StreamEvent>,
) {
    broadcast::channel(BROADCAST_CAPACITY)
}
