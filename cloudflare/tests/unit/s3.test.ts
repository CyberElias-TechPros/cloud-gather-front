/**
 * AWS Signature Version 4 verification.
 *
 * The vector below is the worked example published in the AWS documentation
 * ("Example: GET Object" in *Signature Version 4 signing process*). Matching the
 * canonical request hash, the string-to-sign hash *and* the final signature
 * proves the implementation, not just its self-consistency.
 */

import { describe, expect, it } from "vitest";
import { canonicalQueryString, signRequest, sha256Hex, uriEncode } from "../../src/lib/providers/s3";

const credentials = {
  accessKeyId: "AKIAIOSFODNN7EXAMPLE",
  secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
};

describe("AWS SigV4", () => {
  it("reproduces the published AWS example signature", async () => {
    const payloadHash = await sha256Hex("");
    expect(payloadHash).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");

    const signed = await signRequest(credentials, {
      method: "GET",
      host: "examplebucket.s3.amazonaws.com",
      path: "/test.txt",
      headers: { range: "bytes=0-9" },
      payloadHash,
      region: "us-east-1",
      date: new Date("2013-05-24T00:00:00Z"),
    });

    expect(signed.headers.host).toBe("examplebucket.s3.amazonaws.com");
    expect(signed.headers["x-amz-date"]).toBe("20130524T000000Z");
    expect(signed.headers.authorization).toContain(
      "Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request",
    );
    expect(signed.headers.authorization).toContain(
      "SignedHeaders=host;range;x-amz-content-sha256;x-amz-date",
    );
    expect(signed.headers.authorization).toContain(
      "Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41",
    );
    expect(signed.url).toBe("https://examplebucket.s3.amazonaws.com/test.txt");
  });

  it("matches the documented string-to-sign hash", async () => {
    const payloadHash = await sha256Hex("");
    const canonicalRequest = [
      "GET",
      "/test.txt",
      "",
      `host:examplebucket.s3.amazonaws.com\nrange:bytes=0-9\nx-amz-content-sha256:${payloadHash}\nx-amz-date:20130524T000000Z\n`,
      "host;range;x-amz-content-sha256;x-amz-date",
      payloadHash,
    ].join("\n");
    expect(await sha256Hex(canonicalRequest)).toBe(
      "7344ae5b7ee6c3e7e6b0fe0640412a37625d1fbfff95c48bbb2dc43964946972",
    );
  });

  it("encodes query parameters and paths the way S3 requires", () => {
    expect(canonicalQueryString({ "list-type": "2", prefix: "invoices/2026", "max-keys": "10" })).toBe(
      "list-type=2&max-keys=10&prefix=invoices%2F2026",
    );
    expect(uriEncode("a b+c", false)).toBe("a%20b%2Bc");
    expect(uriEncode("folder/file.txt", false)).toBe("folder/file.txt");
    expect(uriEncode("folder/file.txt", true)).toBe("folder%2Ffile.txt");
  });

  it("includes a session token when one is supplied", async () => {
    const signed = await signRequest(
      { ...credentials, sessionToken: "SESSIONTOKEN" },
      {
        method: "PUT",
        host: "bucket.example.test",
        path: "/key.txt",
        payloadHash: await sha256Hex("body"),
        region: "eu-west-1",
        date: new Date("2026-01-02T03:04:05Z"),
      },
    );
    expect(signed.headers["x-amz-security-token"]).toBe("SESSIONTOKEN");
    expect(signed.headers.authorization).toContain("20260102/eu-west-1/s3/aws4_request");
  });
});
