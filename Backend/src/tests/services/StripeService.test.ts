import { StripeService } from "../../services/StripeService.js";

describe("StripeService", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("detects configuration when environment variable is present", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_mock_1234567890";
    const isConfigured = await StripeService.isConfigured(null);
    expect(isConfigured).toBe(true);
  });

  it("throws error when attempting to get client without secret key", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    await expect(StripeService.getClient(9999)).rejects.toThrow("Stripe configuration is not set up");
  });

  it("returns initialized Stripe instance with valid key", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_valid_mock_key";
    const client = await StripeService.getClient(null);
    expect(client).toBeDefined();
    expect(client.checkout).toBeDefined();
    expect(client.paymentIntents).toBeDefined();
    expect(client.refunds).toBeDefined();
  });
});
