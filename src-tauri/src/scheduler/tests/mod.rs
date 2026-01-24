use chrono::{DateTime, Utc};
use proptest::prelude::*;

proptest! {
    #[test]
    fn timestamp_serialization_round_trip(timestamp in 0i64..=4102444800i64) {
        let dt = DateTime::<Utc>::from_timestamp(timestamp, 0).unwrap();
        let encoded = dt.to_rfc3339();
        let decoded = DateTime::parse_from_rfc3339(&encoded).unwrap().with_timezone(&Utc);
        prop_assert_eq!(decoded.timestamp(), dt.timestamp());
    }
}
