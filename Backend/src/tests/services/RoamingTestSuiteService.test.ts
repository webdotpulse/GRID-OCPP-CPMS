import { jest } from "@jest/globals";

const mockAxios = jest.fn() as any;

jest.unstable_mockModule("axios", () => ({
  default: mockAxios,
}));

jest.unstable_mockModule("../../config/database.js", () => ({
  prisma: {
    chargingStation: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    oicpEndpoint: {
      findFirst: jest.fn(),
    },
    roamingPartner: {
      findFirst: jest.fn(),
    },
    transaction: {
      findFirst: jest.fn(),
    },
  },
}));

jest.unstable_mockModule("../../config/redis.js", () => ({
  redisPublisher: { publish: jest.fn().mockResolvedValue(1 as never) },
  redisSubscriber: { subscribe: jest.fn(), on: jest.fn() },
  redisClient: { get: jest.fn().mockResolvedValue(null as never), set: jest.fn() },
}));

describe("RoamingTestSuiteService - OCPI 2.2.1 & OICP 2.3 Dual-Role Test Engine", () => {
  let RoamingTestSuiteService: any;

  beforeAll(async () => {
    const mod = await import("../../services/RoamingTestSuiteService.js");
    RoamingTestSuiteService = mod.RoamingTestSuiteService;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    RoamingTestSuiteService.clearMockEvents();
  });

  describe("getCatalog", () => {
    it("should return predefined test cases and scenarios with descriptions", () => {
      const catalog = RoamingTestSuiteService.getCatalog();
      expect(catalog).toHaveProperty("scenarios");
      expect(catalog).toHaveProperty("testCases");
      expect(catalog.scenarios.length).toBeGreaterThanOrEqual(4);
      expect(catalog.testCases.length).toBeGreaterThanOrEqual(8);

      const fullCycle = catalog.scenarios.find((s: any) => s.id === "ocpi_full_cycle");
      expect(fullCycle).toBeDefined();
      expect(fullCycle.steps).toBe(7);
      expect(fullCycle.protocol).toBe("OCPI_2_2_1");
    });
  });

  describe("Mock Event Buffer", () => {
    it("should record, retrieve, and clear mock eMSP events", () => {
      expect(RoamingTestSuiteService.getMockEvents()).toHaveLength(0);

      RoamingTestSuiteService.recordMockEvent("AUTHORIZE_REQUEST", { token_uid: "CARD-123" });
      RoamingTestSuiteService.recordMockEvent("CDR_DISPATCH", { cdr_id: "CDR-999" });

      const events = RoamingTestSuiteService.getMockEvents();
      expect(events).toHaveLength(2);
      expect(events[0].type).toBe("CDR_DISPATCH");
      expect(events[1].type).toBe("AUTHORIZE_REQUEST");

      RoamingTestSuiteService.clearMockEvents();
      expect(RoamingTestSuiteService.getMockEvents()).toHaveLength(0);
    });
  });

  describe("runTestCase - Role: Test as eMSP (Evaluating CPO)", () => {
    it("should pass ocpi_emsp_get_locations when CPO returns valid envelope", async () => {
      mockAxios.mockResolvedValueOnce({
        status: 200,
        statusText: "OK",
        data: {
          data: [{ id: "LOC-1", name: "Station Alpha", evses: [] }],
          status_code: 1000,
          status_message: "Success",
          timestamp: new Date().toISOString(),
        },
      });

      const result = await RoamingTestSuiteService.runTestCase("ocpi_emsp_get_locations", {
        url: "http://test-cpo/ocpi/locations",
        token: "TEST_TOKEN",
      });

      expect(result.testId).toBe("ocpi_emsp_get_locations");
      expect(result.role).toBe("TEST_AS_EMSP");
      expect(result.passed).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.assertions.every((a: any) => a.passed)).toBe(true);
    });

    it("should fail assertions if CPO returns 500 error", async () => {
      mockAxios.mockResolvedValueOnce({
        status: 500,
        statusText: "Internal Server Error",
        data: { status_code: 3000, status_message: "Database failure" },
      });

      const result = await RoamingTestSuiteService.runTestCase("ocpi_emsp_get_locations", {
        url: "http://test-cpo/ocpi/locations",
      });

      expect(result.passed).toBe(false);
      expect(result.statusCode).toBe(500);
      const httpStatusAssertion = result.assertions.find((a: any) => a.name.includes("200 OK"));
      expect(httpStatusAssertion?.passed).toBe(false);
    });

    it("should pass ocpi_emsp_authorize_token when CPO validates token", async () => {
      mockAxios.mockResolvedValueOnce({
        status: 200,
        statusText: "OK",
        data: {
          data: {
            allowed: true,
            result: "ALLOWED",
            token: { uid: "TAG-123", valid: true },
          },
          status_code: 1000,
        },
      });

      const result = await RoamingTestSuiteService.runTestCase("ocpi_emsp_authorize_token", {
        tokenUid: "TAG-123",
      });

      expect(result.passed).toBe(true);
      expect(result.statusCode).toBe(200);
    });

    it("should pass ocpi_emsp_remote_start when CPO returns ACCEPTED", async () => {
      mockAxios.mockResolvedValueOnce({
        status: 200,
        statusText: "OK",
        data: {
          data: { result: "ACCEPTED" },
          status_code: 1000,
        },
      });

      const result = await RoamingTestSuiteService.runTestCase("ocpi_emsp_remote_start", {
        tokenUid: "TAG-123",
        locationId: "LOC-1",
      });

      expect(result.passed).toBe(true);
      expect(result.response.body.data.result).toBe("ACCEPTED");
    });
  });

  describe("runTestCase - Role: Test as CPO (Evaluating eMSP)", () => {
    it("should pass ocpi_cpo_authorize_token when eMSP responds with ALLOWED", async () => {
      mockAxios.mockResolvedValueOnce({
        status: 200,
        statusText: "OK",
        data: {
          result: "ALLOWED",
          allowed: true,
          authorization_reference: "AUTH_TEST_1",
        },
      });

      const result = await RoamingTestSuiteService.runTestCase("ocpi_cpo_authorize_token", {
        url: "http://test-emsp/authorize",
        tokenUid: "TEST_USER_TAG",
      });

      expect(result.testId).toBe("ocpi_cpo_authorize_token");
      expect(result.role).toBe("TEST_AS_CPO");
      expect(result.passed).toBe(true);
      expect(result.statusCode).toBe(200);
    });

    it("should pass ocpi_cpo_dispatch_cdr when eMSP acknowledges CDR receipt", async () => {
      mockAxios.mockResolvedValueOnce({
        status: 201,
        statusText: "Created",
        data: {
          status_code: 1000,
          status_message: "CDR Accepted",
          data: { cdr_id: "CDR-1", status: "ACCEPTED" },
        },
      });

      const result = await RoamingTestSuiteService.runTestCase("ocpi_cpo_dispatch_cdr", {
        url: "http://test-emsp/cdrs",
      });

      expect(result.passed).toBe(true);
      expect(result.statusCode).toBe(201);
    });
  });

  describe("runScenario - Automated Scenarios", () => {
    it("should execute ocpi_catalog_discovery scenario sequentially and summarize results", async () => {
      // Mock locations call
      mockAxios.mockResolvedValueOnce({
        status: 200,
        data: { data: [{ id: "1" }], status_code: 1000 },
      });
      // Mock tariffs call
      mockAxios.mockResolvedValueOnce({
        status: 200,
        data: { data: [{ id: "1", elements: [] }], status_code: 1000 },
      });
      // Mock sessions call
      mockAxios.mockResolvedValueOnce({
        status: 200,
        data: { data: [], status_code: 1000 },
      });

      const scenario = await RoamingTestSuiteService.runScenario("ocpi_catalog_discovery");
      expect(scenario.scenarioId).toBe("ocpi_catalog_discovery");
      expect(scenario.totalTests).toBe(3);
      expect(scenario.passedTests).toBe(3);
      expect(scenario.failedTests).toBe(0);
      expect(scenario.passed).toBe(true);
      expect(scenario.results).toHaveLength(3);
    });

    it("should execute ocpi_full_cycle scenario sequentially with 7 steps and pass all assertions", async () => {
      // 1. Locations
      mockAxios.mockResolvedValueOnce({
        status: 200,
        data: { data: [{ id: "LOC-1" }], status_code: 1000 },
      });
      // 2. Tariffs
      mockAxios.mockResolvedValueOnce({
        status: 200,
        data: { data: [{ id: "TAR-1", elements: [] }], status_code: 1000 },
      });
      // 3. Authorize Token
      mockAxios.mockResolvedValueOnce({
        status: 200,
        data: { data: { result: "ALLOWED", allowed: true, token: { uid: "TAG-1" } }, status_code: 1000 },
      });
      // 4. Remote Start
      mockAxios.mockResolvedValueOnce({
        status: 200,
        data: { data: { result: "ACCEPTED" }, status_code: 1000 },
      });
      // 5. Sessions
      mockAxios.mockResolvedValueOnce({
        status: 200,
        data: { data: [{ id: "SESS-1" }], status_code: 1000 },
      });
      // 6. Remote Stop
      mockAxios.mockResolvedValueOnce({
        status: 200,
        data: { data: { result: "ACCEPTED" }, status_code: 1000 },
      });
      // 7. CDRs
      mockAxios.mockResolvedValueOnce({
        status: 200,
        data: { data: [{ id: "CDR-1" }], status_code: 1000 },
      });

      const scenario = await RoamingTestSuiteService.runScenario("ocpi_full_cycle");
      expect(scenario.scenarioId).toBe("ocpi_full_cycle");
      expect(scenario.totalTests).toBe(7);
      expect(scenario.passedTests).toBe(7);
      expect(scenario.failedTests).toBe(0);
      expect(scenario.passed).toBe(true);
      expect(scenario.results).toHaveLength(7);

      // Verify each test passed
      for (const res of scenario.results) {
        expect(res.passed).toBe(true);
        expect(res.statusCode).toBe(200);
      }
    });
  });
});
