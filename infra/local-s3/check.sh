#!/bin/sh
# Runs inside the local S3 container. Never print credentials or disable TLS checks.
set -eu

: "${AWS_ACCESS_KEY_ID:?Missing local S3 access key}"
: "${AWS_SECRET_ACCESS_KEY:?Missing local S3 secret key}"
: "${S3_BUCKET:?Missing local S3 bucket name}"

endpoint="http://127.0.0.1:9000"
bucket_url="${endpoint}/${S3_BUCKET}"

signed_request() {
    curl --silent --show-error --fail --max-time 10 \
        --aws-sigv4 "aws:amz:us-east-1:s3" \
        --user "${AWS_ACCESS_KEY_ID}:${AWS_SECRET_ACCESS_KEY}" "$@"
}

# Check the S3 gateway and the authenticated bucket, including startup creation.
curl --silent --show-error --fail --max-time 5 "${endpoint}/healthz" >/dev/null
signed_request --max-time 5 --head "${bucket_url}" >/dev/null

if [ "${1:-smoke}" = "health" ]; then
    exit 0
fi

object_url="${bucket_url}/.phase0-check-$(date +%s)-$$"
cleanup() {
    signed_request --request DELETE "${object_url}" >/dev/null
}
trap cleanup 0
trap 'exit 1' HUP INT TERM

expected="Local S3 signed upload and download work."
signed_request --request PUT --data-binary "${expected}" "${object_url}" >/dev/null
actual="$(signed_request "${object_url}")"
if [ "${actual}" != "${expected}" ]; then
    echo "Local S3 returned different object contents." >&2
    exit 1
fi

anonymous_status="$(curl --silent --show-error --max-time 10 \
    --output /dev/null --write-out '%{http_code}' "${object_url}")"
if [ "${anonymous_status}" != "403" ]; then
    echo "Local S3 must reject anonymous reads with HTTP 403." >&2
    exit 1
fi

cleanup
trap - 0
deleted_status="$(curl --silent --show-error --max-time 10 \
    --aws-sigv4 "aws:amz:us-east-1:s3" \
    --user "${AWS_ACCESS_KEY_ID}:${AWS_SECRET_ACCESS_KEY}" \
    --output /dev/null --write-out '%{http_code}' "${object_url}")"
if [ "${deleted_status}" != "404" ]; then
    echo "Local S3 must return HTTP 404 after deleting the test object." >&2
    exit 1
fi

echo "Local S3 passed: authenticated bucket, upload, download, private reads, delete."
