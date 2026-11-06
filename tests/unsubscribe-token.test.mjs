import test from "node:test";
import assert from "node:assert/strict";
import { isValidUnsubscribeToken, resolveUnsubscribeToken } from "../lib/email/unsubscribe-token.js";

const token = "123e4567-e89b-12d3-a456-426614174000";

test("reads the token from the URL used by RFC 8058 one-click POST", () => {
  assert.equal(resolveUnsubscribeToken(`https://sendvoria.example/api/unsubscribe?token=${token}`, "ignored"), token);
});

test("falls back to the token in the browser confirmation form", () => {
  assert.equal(resolveUnsubscribeToken("https://sendvoria.example/api/unsubscribe", token), token);
});

test("trims form tokens", () => {
  assert.equal(resolveUnsubscribeToken("https://sendvoria.example/api/unsubscribe", ` ${token} `), token);
});

test("validates UUID-shaped unsubscribe tokens", () => {
  assert.equal(isValidUnsubscribeToken(token), true);
  assert.equal(isValidUnsubscribeToken("not-a-token"), false);
  assert.equal(isValidUnsubscribeToken(""), false);
});
