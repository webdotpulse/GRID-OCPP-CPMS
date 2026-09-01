import { prisma } from "../config/database.js";
import { logger } from "./logger.js";

/**
 * Creates the "Super Extreme Advanced & Extended Profile"
 * This profile contains an exhaustive list of standard OCPP 1.6 configuration keys
 * designed to force the charger to report every possible metric during a transaction,
 * ensuring high-resolution data for power, energy, voltage, current, and SoC.
 */
export async function createSuperExtremeAdvancedProfile() {
  const profileName = "Super Extreme Advanced & Extended Profile";

  const items = [
    // MeterValues configuration: Request an exhaustive list of measurands
    { key: "MeterValuesSampledData", value: "Energy.Active.Import.Register,Power.Active.Import,SoC,Current.Import,Current.Offered,Voltage,Frequency,Temperature" },
    { key: "MeterValueSampleInterval", value: "30" }, // Send meter values every 30 seconds

    // Clock-aligned data
    { key: "ClockAlignedDataInterval", value: "900" }, // 15 minutes aligned
    { key: "MeterValuesAlignedData", value: "Energy.Active.Import.Register,Power.Active.Import,SoC,Current.Import,Voltage" },

    // Stop Transaction configuration
    { key: "StopTxnSampledData", value: "Energy.Active.Import.Register,Power.Active.Import,SoC,Current.Import,Voltage" },

    // Connectivity & Reliability
    { key: "WebSocketPingInterval", value: "60" },
    { key: "TransactionMessageAttempts", value: "5" },
    { key: "TransactionMessageRetryInterval", value: "30" },

    // Features
    { key: "AuthorizeRemoteTxRequests", value: "true" },
    { key: "LocalAuthListEnabled", value: "true" },
    { key: "SendLocalListMaxLength", value: "100" }
  ];

  try {
    const profile = await prisma.configurationProfile.upsert({
      where: { name: profileName },
      update: {
        description: "An extreme, highly-detailed profile for maximum data resolution",
        items: {
          deleteMany: {},
          create: items,
        }
      },
      create: {
        name: profileName,
        description: "An extreme, highly-detailed profile for maximum data resolution",
        items: {
          create: items,
        }
      },
      include: { items: true }
    });

    logger.info(`Successfully created/updated standard advanced profile: ${profile.id}`);
    return profile;
  } catch (error) {
    logger.error("Failed to create super extreme advanced profile", error);
    throw error;
  }
}

/**
 * Helper to create a specific Configuration Profile based on an ongoing charging transaction.
 * If a transaction is ongoing but missing specific data (e.g., Power or SoC), this helper
 * creates a targeted configuration profile meant to be applied to the charger to fix the data feed.
 */
export async function createProfileBasedOnTransaction(transactionId: number) {
  try {
    // 1. Fetch the transaction
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { charger: true }
    });

    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    // 2. Analyze the transaction's missing data points
    const missingMeasurands: string[] = ["Energy.Active.Import.Register"]; // Always require energy

    if (transaction.currentPower === null || transaction.currentPower === 0) {
      missingMeasurands.push("Power.Active.Import");
    }
    if (transaction.soc === null) {
      missingMeasurands.push("SoC");
    }
    if (transaction.voltage === null) {
      missingMeasurands.push("Voltage");
    }
    if (transaction.current === null) {
      missingMeasurands.push("Current.Import");
    }

    // 3. Create a profile tailored for this transaction's charger
    const profileName = `Txn-${transactionId} Recovery Profile (${transaction.charger.serial_number || transaction.charger_id})`;

    const items = [
      { key: "MeterValuesSampledData", value: missingMeasurands.join(",") },
      { key: "MeterValueSampleInterval", value: "15" }, // Very fast interval to catch up on data
      { key: "StopTxnSampledData", value: missingMeasurands.join(",") }
    ];

    const profile = await prisma.configurationProfile.upsert({
      where: { name: profileName },
      update: {
        items: {
          deleteMany: {},
          create: items,
        }
      },
      create: {
        name: profileName,
        description: `Auto-generated profile to recover missing metrics for ongoing transaction ${transaction.transactionId}`,
        items: {
          create: items,
        }
      },
      include: { items: true }
    });

    logger.info(`Created transaction-based profile ${profileName} with measurands: ${missingMeasurands.join(",")}`);
    return profile;
  } catch (error) {
    logger.error(`Failed to create profile based on transaction ${transactionId}`, error);
    throw error;
  }
}

export * from "./benelux-charger-profiles.js";
