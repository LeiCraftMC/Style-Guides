import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { API } from "../src/api";
import { ConfigHandler } from "../src/utils/config";
import { DB } from "../src/db";
import { makeAPIRequest } from "./helpers/make-api-request";
import { HealthModel } from "../src/api/versions/v1/routes/health/model";
import { AuthModel } from "../src/api/versions/v1/routes/auth/model";

describe("API v1", () => {
	beforeAll(async () => {
		await ConfigHandler.loadConfig();
		DB.init(":memory:", true);
		await API.init(0);
	});

	afterAll(async () => {
		await API.stop();
		DB.close();
	});

	test("GET /health returns ok", async () => {
		const { body, data } = await makeAPIRequest(API.app, "/health");
		expect(body.success).toBe(true);
		expect(body.code).toBe(200);
		expect(data).toEqual({ status: "ok", uptime: expect.any(Number) });
	});

	test("GET /v1/health returns healthy", async () => {
		const { body, data } = await makeAPIRequest(API.app, "/v1/health", {
			expectedBodySchema: HealthModel.Response,
		});
		expect(body.success).toBe(true);
		expect(body.code).toBe(200);
		expect(data.status).toBe("ok");
	});

	test("POST /v1/auth/login succeeds", async () => {
		const { body, data } = await makeAPIRequest(API.app, "/v1/auth/login", {
			method: "POST",
			body: { username: "admin", password: "admin" },
			expectedBodySchema: AuthModel.Login.Response,
		});
		expect(body.success).toBe(true);
		expect(body.code).toBe(200);
		expect(data.token).toBe("dummy-token");
	});

	test("POST /v1/auth/login fails with bad credentials", async () => {
		const { body } = await makeAPIRequest(API.app, "/v1/auth/login", {
			method: "POST",
			body: { username: "admin", password: "wrong" },
		},
		401);
		expect(body.success).toBe(false);
		expect(body.code).toBe(401);
	});
});
