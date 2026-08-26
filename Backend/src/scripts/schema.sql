-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "userType" TEXT NOT NULL DEFAULT 'private',
    "language" TEXT NOT NULL DEFAULT 'en',
    "companyName" TEXT,
    "companyId" INTEGER,
    "address" TEXT,
    "phone" TEXT,
    "taxNumber" TEXT,
    "resetToken" TEXT,
    "resetTokenExpiry" TIMESTAMP(3),
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorMethod" TEXT,
    "twoFactorSecret" TEXT,
    "twoFactorCode" TEXT,
    "twoFactorCodeExpiry" TIMESTAMP(3),
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MollieConfig" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER,
    "apiKey" TEXT NOT NULL,
    "profileId" TEXT,
    "testMode" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MollieConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChargingStation" (
    "id" SERIAL NOT NULL,
    "station_name" TEXT NOT NULL,
    "street_name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT,
    "postal_code" TEXT NOT NULL,
    "country" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "on_site_person_name" TEXT,
    "on_site_contact_details" TEXT,
    "emergency_contact" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "maxPower" DOUBLE PRECISION,
    "owner_id" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isGroundPlanEnabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ChargingStation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Charger" (
    "isHardwareAtRisk" BOOLEAN NOT NULL DEFAULT false,
    "consecutiveErrors" INTEGER NOT NULL DEFAULT 0,
    "charger_id" SERIAL NOT NULL,
    "model" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "serial_number" TEXT NOT NULL,
    "manufacturing_date" TIMESTAMP(3),
    "power_capacity" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'offline',
    "last_heartbeat" TIMESTAMP(3) NOT NULL DEFAULT '1970-01-01 00:00:00 +00:00',
    "firmware_version" TEXT NOT NULL,
    "service_contacts" TEXT NOT NULL,
    "thirdPartyBackendUrl" TEXT,
    "isPredictiveBalancingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "localSolarKwp" DOUBLE PRECISION,
    "owner_id" INTEGER NOT NULL,
    "charging_station_id" INTEGER NOT NULL,
    "requireAuth" BOOLEAN NOT NULL DEFAULT false,
    "authPassword" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "chargeGroupId" INTEGER,
    "quirkProfileId" INTEGER,

    CONSTRAINT "Charger_pkey" PRIMARY KEY ("charger_id")
);

-- CreateTable
CREATE TABLE "ChargerQuirkProfile" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rules" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChargerQuirkProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evse" (
    "id" SERIAL NOT NULL,
    "evse_id" INTEGER NOT NULL,
    "charger_id" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Evse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Connector" (
    "connector_id" SERIAL NOT NULL,
    "connector_name" TEXT NOT NULL DEFAULT 'Channel 1',
    "status" TEXT NOT NULL,
    "current_type" TEXT NOT NULL,
    "max_current" DOUBLE PRECISION,
    "max_power" DOUBLE PRECISION,
    "mac_address" TEXT,
    "format" TEXT NOT NULL DEFAULT 'SOCKET',
    "max_voltage" DOUBLE PRECISION NOT NULL DEFAULT 400,
    "phaseConnection" TEXT NOT NULL DEFAULT 'L1-L2-L3',
    "evse_id" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "parkingSpotId" INTEGER,

    CONSTRAINT "Connector_pkey" PRIMARY KEY ("connector_id")
);

-- CreateTable
CREATE TABLE "RfidUser" (
    "rfid_user_id" SERIAL NOT NULL,
    "rfid_tag" TEXT NOT NULL,
    "external_id" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "company_name" TEXT,
    "address" TEXT,
    "type" TEXT NOT NULL DEFAULT 'postpaid',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "owner_id" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RfidUser_pkey" PRIMARY KEY ("rfid_user_id")
);

-- CreateTable
CREATE TABLE "RfidSession" (
    "id" SERIAL NOT NULL,
    "transactionId" TEXT NOT NULL,
    "rfidUserId" INTEGER NOT NULL,
    "charger_id" INTEGER NOT NULL,
    "connectorName" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),
    "initialMeterValue" DOUBLE PRECISION,
    "finalMeterValue" DOUBLE PRECISION,
    "energyConsumed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currentPower" DOUBLE PRECISION DEFAULT 0,
    "soc" DOUBLE PRECISION,
    "current" DOUBLE PRECISION,
    "voltage" DOUBLE PRECISION,
    "tariffRate" DOUBLE PRECISION,
    "amountDue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'charging',
    "stopReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RfidSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" SERIAL NOT NULL,
    "transactionId" TEXT NOT NULL,
    "connectorName" TEXT NOT NULL,
    "charger_id" INTEGER NOT NULL,
    "rfidUserId" INTEGER,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),
    "initialMeterValue" DOUBLE PRECISION,
    "finalMeterValue" DOUBLE PRECISION,
    "energyConsumed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dischargeLimit" DOUBLE PRECISION,
    "currentDirection" TEXT NOT NULL DEFAULT 'Charging',
    "currentPower" DOUBLE PRECISION DEFAULT 0,
    "soc" DOUBLE PRECISION,
    "current" DOUBLE PRECISION,
    "voltage" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'initiated',
    "stopReason" TEXT,
    "idTag" TEXT,
    "totalCost" DOUBLE PRECISION,
    "invoiceId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OcppLog" (
    "id" SERIAL NOT NULL,
    "chargerId" INTEGER NOT NULL,
    "transactionId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "direction" TEXT NOT NULL,
    "message" TEXT NOT NULL,

    CONSTRAINT "OcppLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tariff" (
    "tariff_id" SERIAL NOT NULL,
    "tariff_name" TEXT NOT NULL,
    "charge" DOUBLE PRECISION NOT NULL,
    "electricity_rate" DOUBLE PRECISION NOT NULL,
    "tariffType" TEXT NOT NULL DEFAULT 'FIXED',
    "country" TEXT,
    "dynamicProvider" TEXT DEFAULT 'EnergyZero',
    "markupPerKwh" DOUBLE PRECISION,
    "taxPercentage" DOUBLE PRECISION,
    "fixedFeePerMonth" DOUBLE PRECISION,
    "time_fee" DOUBLE PRECISION DEFAULT 0,
    "idle_fee" DOUBLE PRECISION DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tariff_pkey" PRIMARY KEY ("tariff_id")
);

-- CreateTable
CREATE TABLE "EpexSpotPrice" (
    "id" SERIAL NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "country" TEXT NOT NULL,
    "pricePerMwh" DOUBLE PRECISION NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'EnergyZero',

    CONSTRAINT "EpexSpotPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentTransaction" (
    "id" SERIAL NOT NULL,
    "transactionId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "paymentIntentId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OcpiEndpoint" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '2.2.1',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OcpiEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChargeGroup" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "maxPower" DOUBLE PRECISION,
    "maxAmperage" DOUBLE PRECISION,
    "maxPhaseCurrent" DOUBLE PRECISION NOT NULL DEFAULT 80.0,
    "maxPhaseUnbalance" DOUBLE PRECISION NOT NULL DEFAULT 16.0,
    "phaseUnbalanceLimit" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChargeGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChargerConfiguration" (
    "id" SERIAL NOT NULL,
    "chargerId" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "readonly" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ChargerConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChargeGroupUser" (
    "chargeGroupId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "tariffId" INTEGER,

    CONSTRAINT "ChargeGroupUser_pkey" PRIMARY KEY ("chargeGroupId","userId")
);

-- CreateTable
CREATE TABLE "UnrecognizedConnection" (
    "id" SERIAL NOT NULL,
    "chargePointId" TEXT NOT NULL,
    "ipAddress" TEXT,
    "reason" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnrecognizedConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChargingProfile" (
    "id" SERIAL NOT NULL,
    "chargerId" INTEGER NOT NULL,
    "connectorId" INTEGER NOT NULL,
    "chargingProfileId" INTEGER NOT NULL,
    "transactionId" TEXT,
    "stackLevel" INTEGER NOT NULL,
    "chargingProfilePurpose" TEXT NOT NULL,
    "chargingProfileKind" TEXT NOT NULL,
    "recurrencyKind" TEXT,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "chargingSchedule" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChargingProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OicpEndpoint" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '2.3.0',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OicpEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfigurationProfile" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfigurationProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfigurationProfileItem" (
    "id" SERIAL NOT NULL,
    "profileId" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "ConfigurationProfileItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeterValue" (
    "id" SERIAL NOT NULL,
    "transactionId" TEXT NOT NULL,
    "chargerId" INTEGER NOT NULL,
    "connectorId" INTEGER,
    "energy" DOUBLE PRECISION,
    "power" DOUBLE PRECISION,
    "soc" DOUBLE PRECISION,
    "current" DOUBLE PRECISION,
    "voltage" DOUBLE PRECISION,
    "current_L1" DOUBLE PRECISION,
    "current_L2" DOUBLE PRECISION,
    "current_L3" DOUBLE PRECISION,
    "voltage_L1" DOUBLE PRECISION,
    "voltage_L2" DOUBLE PRECISION,
    "voltage_L3" DOUBLE PRECISION,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeterValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceComponent" (
    "id" SERIAL NOT NULL,
    "chargerId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "instance" TEXT,
    "evseId" INTEGER,
    "connectorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceVariable" (
    "id" SERIAL NOT NULL,
    "componentId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "instance" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceVariable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VariableAttribute" (
    "id" SERIAL NOT NULL,
    "variableId" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'Actual',
    "value" TEXT,
    "mutability" TEXT,
    "persistent" BOOLEAN NOT NULL DEFAULT false,
    "constant" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VariableAttribute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChargerAlert" (
    "id" SERIAL NOT NULL,
    "chargerId" INTEGER NOT NULL,
    "eventId" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "severity" INTEGER NOT NULL,
    "component" TEXT NOT NULL,
    "variable" TEXT NOT NULL,
    "actualValue" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChargerAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailConfig" (
    "id" SERIAL NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailTemplate" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ParkingSpot" (
    "id" SERIAL NOT NULL,
    "stationId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'spot',
    "fillColor" TEXT,
    "lineColor" TEXT,
    "lineWidth" DOUBLE PRECISION,
    "x" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "y" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "width" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "height" DOUBLE PRECISION NOT NULL DEFAULT 200,
    "rotation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParkingSpot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChargingSchedulePlan" (
    "id" SERIAL NOT NULL,
    "chargerId" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "predictedAmps" DOUBLE PRECISION NOT NULL,
    "solarForecast" DOUBLE PRECISION,
    "epexPrice" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChargingSchedulePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagnosticEvent" (
    "id" SERIAL NOT NULL,
    "chargerId" INTEGER NOT NULL,
    "connectorId" INTEGER,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "DiagnosticEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutoHealRule" (
    "id" SERIAL NOT NULL,
    "triggerType" TEXT NOT NULL,
    "triggerCondition" TEXT NOT NULL,
    "actionCommand" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutoHealRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleEnergyProfile" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "rfidUserId" INTEGER,
    "minSocThreshold" DOUBLE PRECISION NOT NULL DEFAULT 40.0,
    "batteryCapacity" DOUBLE PRECISION,

    CONSTRAINT "VehicleEnergyProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReimbursementContract" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "rfidUserId" INTEGER NOT NULL,
    "stationId" INTEGER NOT NULL,
    "tariffId" INTEGER NOT NULL,
    "iban" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReimbursementContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReimbursementLedger" (
    "id" SERIAL NOT NULL,
    "contractId" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "totalKwh" DOUBLE PRECISION NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "exportedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReimbursementLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleContractCertificate" (
    "id" SERIAL NOT NULL,
    "emaid" TEXT NOT NULL,
    "macAddress" TEXT,
    "contractCert" TEXT,
    "contractCertChain" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Valid',
    "expirationDate" TIMESTAMP(3) NOT NULL,
    "issuerNameHash" TEXT,
    "issuerKeyHash" TEXT,
    "serialNumber" TEXT,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rfidUserRfid_user_id" INTEGER,

    CONSTRAINT "VehicleContractCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstalledCertificate" (
    "id" SERIAL NOT NULL,
    "chargerId" INTEGER NOT NULL,
    "certificateType" TEXT NOT NULL,
    "certificateHashData" JSONB,
    "certificatePem" TEXT,
    "serialNumber" TEXT,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'Accepted',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstalledCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaCampaign" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "assetUrl" TEXT NOT NULL,
    "displayDuration" INTEGER NOT NULL DEFAULT 30,
    "targetModels" JSONB NOT NULL,
    "stationId" INTEGER,
    "chargeGroupId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoamingPartner" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'eMSP',
    "apiCredentials" TEXT,
    "wholesaleMarkup" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "clearingFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoamingPartner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoamingSession" (
    "id" SERIAL NOT NULL,
    "partnerId" INTEGER NOT NULL,
    "stationId" INTEGER NOT NULL,
    "transactionId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),
    "energyConsumed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "wholesaleCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "baseCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netMargin" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoamingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CDR" (
    "id" SERIAL NOT NULL,
    "cdrId" TEXT NOT NULL,
    "partnerId" INTEGER NOT NULL,
    "stationId" INTEGER NOT NULL,
    "transactionId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "totalEnergy" DOUBLE PRECISION NOT NULL,
    "totalTime" DOUBLE PRECISION NOT NULL,
    "totalCost" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CDR_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HardwareAtRiskSetting" (
    "id" SERIAL NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "offlineThresholdMinutes" INTEGER NOT NULL DEFAULT 60,
    "criticalErrorCodeLimit" INTEGER NOT NULL DEFAULT 5,
    "autoHealAttemptLimit" INTEGER NOT NULL DEFAULT 3,
    "notifyAdminEmail" BOOLEAN NOT NULL DEFAULT false,
    "adminEmailAddress" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HardwareAtRiskSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "action" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "targetId" TEXT,
    "payload" JSONB,
    "ip" TEXT NOT NULL DEFAULT '127.0.0.1',
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" SERIAL NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "companyId" INTEGER,
    "userId" INTEGER,
    "recipientName" TEXT,
    "recipientEmail" TEXT,
    "billingAddress" TEXT,
    "taxNumber" TEXT,
    "country" TEXT DEFAULT 'NL',
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "subtotal" DOUBLE PRECISION NOT NULL,
    "vatAmount" DOUBLE PRECISION NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "vatRate" DOUBLE PRECISION NOT NULL DEFAULT 21.0,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "status" TEXT NOT NULL DEFAULT 'issued',
    "pdfUrl" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceItem" (
    "id" SERIAL NOT NULL,
    "invoiceId" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "vatRate" DOUBLE PRECISION NOT NULL DEFAULT 21.0,
    "vatAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SepaMandate" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "companyId" INTEGER,
    "debtorName" TEXT NOT NULL,
    "iban" TEXT NOT NULL,
    "bic" TEXT,
    "mandateRef" TEXT NOT NULL,
    "signatureDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mandateType" TEXT NOT NULL DEFAULT 'CORE',
    "sequenceType" TEXT NOT NULL DEFAULT 'RCUR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SepaMandate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocalAuthList" (
    "id" SERIAL NOT NULL,
    "chargerId" INTEGER NOT NULL,
    "listVersion" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Synchronized',
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocalAuthList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocalAuthListEntry" (
    "id" SERIAL NOT NULL,
    "localAuthListId" INTEGER NOT NULL,
    "idTag" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Accepted',
    "parentIdTag" TEXT,
    "expiryDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocalAuthListEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" SERIAL NOT NULL,
    "reservationId" INTEGER NOT NULL,
    "chargerId" INTEGER NOT NULL,
    "connectorId" INTEGER NOT NULL,
    "idTag" TEXT NOT NULL,
    "parentIdTag" TEXT,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "userId" INTEGER,
    "rfidUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertificateRequest" (
    "id" SERIAL NOT NULL,
    "chargerId" INTEGER NOT NULL,
    "certificateType" TEXT NOT NULL,
    "csr" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "signedCertificate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CertificateRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ChargerToTariff" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_ChargerToTariff_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Company_name_key" ON "Company"("name");

-- CreateIndex
CREATE UNIQUE INDEX "MollieConfig_companyId_key" ON "MollieConfig"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Charger_name_key" ON "Charger"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Charger_serial_number_key" ON "Charger"("serial_number");

-- CreateIndex
CREATE UNIQUE INDEX "ChargerQuirkProfile_name_key" ON "ChargerQuirkProfile"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Evse_charger_id_evse_id_key" ON "Evse"("charger_id", "evse_id");

-- CreateIndex
CREATE UNIQUE INDEX "Connector_parkingSpotId_key" ON "Connector"("parkingSpotId");

-- CreateIndex
CREATE UNIQUE INDEX "RfidUser_rfid_tag_key" ON "RfidUser"("rfid_tag");

-- CreateIndex
CREATE UNIQUE INDEX "RfidSession_transactionId_key" ON "RfidSession"("transactionId");

-- CreateIndex
CREATE INDEX "Transaction_charger_id_idx" ON "Transaction"("charger_id");

-- CreateIndex
CREATE INDEX "Transaction_status_idx" ON "Transaction"("status");

-- CreateIndex
CREATE INDEX "Transaction_status_startTime_idx" ON "Transaction"("status", "startTime");

-- CreateIndex
CREATE INDEX "Transaction_invoiceId_idx" ON "Transaction"("invoiceId");

-- CreateIndex
CREATE INDEX "OcppLog_chargerId_idx" ON "OcppLog"("chargerId");

-- CreateIndex
CREATE INDEX "OcppLog_chargerId_timestamp_idx" ON "OcppLog"("chargerId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "Tariff_tariff_name_key" ON "Tariff"("tariff_name");

-- CreateIndex
CREATE UNIQUE INDEX "EpexSpotPrice_timestamp_country_provider_key" ON "EpexSpotPrice"("timestamp", "country", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentTransaction_transactionId_key" ON "PaymentTransaction"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "ChargerConfiguration_chargerId_key_key" ON "ChargerConfiguration"("chargerId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "ChargingProfile_chargerId_chargingProfileId_key" ON "ChargingProfile"("chargerId", "chargingProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "ConfigurationProfile_name_key" ON "ConfigurationProfile"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ConfigurationProfileItem_profileId_key_key" ON "ConfigurationProfileItem"("profileId", "key");

-- CreateIndex
CREATE INDEX "MeterValue_transactionId_idx" ON "MeterValue"("transactionId");

-- CreateIndex
CREATE INDEX "MeterValue_chargerId_idx" ON "MeterValue"("chargerId");

-- CreateIndex
CREATE INDEX "MeterValue_chargerId_timestamp_idx" ON "MeterValue"("chargerId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "VariableAttribute_variableId_type_key" ON "VariableAttribute"("variableId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "MailTemplate_type_language_key" ON "MailTemplate"("type", "language");

-- CreateIndex
CREATE INDEX "ParkingSpot_stationId_idx" ON "ParkingSpot"("stationId");

-- CreateIndex
CREATE INDEX "ChargingSchedulePlan_chargerId_timestamp_idx" ON "ChargingSchedulePlan"("chargerId", "timestamp");

-- CreateIndex
CREATE INDEX "DiagnosticEvent_chargerId_idx" ON "DiagnosticEvent"("chargerId");

-- CreateIndex
CREATE INDEX "DiagnosticEvent_timestamp_idx" ON "DiagnosticEvent"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleEnergyProfile_userId_key" ON "VehicleEnergyProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleEnergyProfile_rfidUserId_key" ON "VehicleEnergyProfile"("rfidUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ReimbursementContract_userId_rfidUserId_stationId_key" ON "ReimbursementContract"("userId", "rfidUserId", "stationId");

-- CreateIndex
CREATE UNIQUE INDEX "ReimbursementLedger_contractId_month_year_key" ON "ReimbursementLedger"("contractId", "month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleContractCertificate_emaid_key" ON "VehicleContractCertificate"("emaid");

-- CreateIndex
CREATE INDEX "VehicleContractCertificate_issuerNameHash_issuerKeyHash_ser_idx" ON "VehicleContractCertificate"("issuerNameHash", "issuerKeyHash", "serialNumber");

-- CreateIndex
CREATE INDEX "InstalledCertificate_chargerId_idx" ON "InstalledCertificate"("chargerId");

-- CreateIndex
CREATE UNIQUE INDEX "RoamingSession_transactionId_key" ON "RoamingSession"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "CDR_cdrId_key" ON "CDR"("cdrId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Invoice_userId_idx" ON "Invoice"("userId");

-- CreateIndex
CREATE INDEX "Invoice_companyId_idx" ON "Invoice"("companyId");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE INDEX "Invoice_createdAt_idx" ON "Invoice"("createdAt");

-- CreateIndex
CREATE INDEX "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "SepaMandate_mandateRef_key" ON "SepaMandate"("mandateRef");

-- CreateIndex
CREATE INDEX "SepaMandate_userId_idx" ON "SepaMandate"("userId");

-- CreateIndex
CREATE INDEX "SepaMandate_companyId_idx" ON "SepaMandate"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "LocalAuthList_chargerId_key" ON "LocalAuthList"("chargerId");

-- CreateIndex
CREATE INDEX "LocalAuthList_chargerId_idx" ON "LocalAuthList"("chargerId");

-- CreateIndex
CREATE INDEX "LocalAuthListEntry_localAuthListId_idx" ON "LocalAuthListEntry"("localAuthListId");

-- CreateIndex
CREATE INDEX "LocalAuthListEntry_idTag_idx" ON "LocalAuthListEntry"("idTag");

-- CreateIndex
CREATE UNIQUE INDEX "LocalAuthListEntry_localAuthListId_idTag_key" ON "LocalAuthListEntry"("localAuthListId", "idTag");

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_reservationId_key" ON "Reservation"("reservationId");

-- CreateIndex
CREATE INDEX "Reservation_chargerId_idx" ON "Reservation"("chargerId");

-- CreateIndex
CREATE INDEX "Reservation_status_idx" ON "Reservation"("status");

-- CreateIndex
CREATE INDEX "Reservation_expiryDate_idx" ON "Reservation"("expiryDate");

-- CreateIndex
CREATE INDEX "Reservation_idTag_idx" ON "Reservation"("idTag");

-- CreateIndex
CREATE INDEX "CertificateRequest_chargerId_idx" ON "CertificateRequest"("chargerId");

-- CreateIndex
CREATE INDEX "CertificateRequest_status_idx" ON "CertificateRequest"("status");

-- CreateIndex
CREATE INDEX "_ChargerToTariff_B_index" ON "_ChargerToTariff"("B");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MollieConfig" ADD CONSTRAINT "MollieConfig_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargingStation" ADD CONSTRAINT "ChargingStation_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Charger" ADD CONSTRAINT "Charger_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Charger" ADD CONSTRAINT "Charger_charging_station_id_fkey" FOREIGN KEY ("charging_station_id") REFERENCES "ChargingStation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Charger" ADD CONSTRAINT "Charger_chargeGroupId_fkey" FOREIGN KEY ("chargeGroupId") REFERENCES "ChargeGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Charger" ADD CONSTRAINT "Charger_quirkProfileId_fkey" FOREIGN KEY ("quirkProfileId") REFERENCES "ChargerQuirkProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evse" ADD CONSTRAINT "Evse_charger_id_fkey" FOREIGN KEY ("charger_id") REFERENCES "Charger"("charger_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Connector" ADD CONSTRAINT "Connector_evse_id_fkey" FOREIGN KEY ("evse_id") REFERENCES "Evse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Connector" ADD CONSTRAINT "Connector_parkingSpotId_fkey" FOREIGN KEY ("parkingSpotId") REFERENCES "ParkingSpot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfidUser" ADD CONSTRAINT "RfidUser_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfidSession" ADD CONSTRAINT "RfidSession_charger_id_fkey" FOREIGN KEY ("charger_id") REFERENCES "Charger"("charger_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfidSession" ADD CONSTRAINT "RfidSession_rfidUserId_fkey" FOREIGN KEY ("rfidUserId") REFERENCES "RfidUser"("rfid_user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_charger_id_fkey" FOREIGN KEY ("charger_id") REFERENCES "Charger"("charger_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_rfidUserId_fkey" FOREIGN KEY ("rfidUserId") REFERENCES "RfidUser"("rfid_user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OcppLog" ADD CONSTRAINT "OcppLog_chargerId_fkey" FOREIGN KEY ("chargerId") REFERENCES "Charger"("charger_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargerConfiguration" ADD CONSTRAINT "ChargerConfiguration_chargerId_fkey" FOREIGN KEY ("chargerId") REFERENCES "Charger"("charger_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeGroupUser" ADD CONSTRAINT "ChargeGroupUser_chargeGroupId_fkey" FOREIGN KEY ("chargeGroupId") REFERENCES "ChargeGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeGroupUser" ADD CONSTRAINT "ChargeGroupUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeGroupUser" ADD CONSTRAINT "ChargeGroupUser_tariffId_fkey" FOREIGN KEY ("tariffId") REFERENCES "Tariff"("tariff_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargingProfile" ADD CONSTRAINT "ChargingProfile_chargerId_fkey" FOREIGN KEY ("chargerId") REFERENCES "Charger"("charger_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfigurationProfileItem" ADD CONSTRAINT "ConfigurationProfileItem_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ConfigurationProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeterValue" ADD CONSTRAINT "MeterValue_chargerId_fkey" FOREIGN KEY ("chargerId") REFERENCES "Charger"("charger_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceComponent" ADD CONSTRAINT "DeviceComponent_chargerId_fkey" FOREIGN KEY ("chargerId") REFERENCES "Charger"("charger_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceVariable" ADD CONSTRAINT "DeviceVariable_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "DeviceComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariableAttribute" ADD CONSTRAINT "VariableAttribute_variableId_fkey" FOREIGN KEY ("variableId") REFERENCES "DeviceVariable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargerAlert" ADD CONSTRAINT "ChargerAlert_chargerId_fkey" FOREIGN KEY ("chargerId") REFERENCES "Charger"("charger_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkingSpot" ADD CONSTRAINT "ParkingSpot_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "ChargingStation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargingSchedulePlan" ADD CONSTRAINT "ChargingSchedulePlan_chargerId_fkey" FOREIGN KEY ("chargerId") REFERENCES "Charger"("charger_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticEvent" ADD CONSTRAINT "DiagnosticEvent_chargerId_fkey" FOREIGN KEY ("chargerId") REFERENCES "Charger"("charger_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleEnergyProfile" ADD CONSTRAINT "VehicleEnergyProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleEnergyProfile" ADD CONSTRAINT "VehicleEnergyProfile_rfidUserId_fkey" FOREIGN KEY ("rfidUserId") REFERENCES "RfidUser"("rfid_user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReimbursementContract" ADD CONSTRAINT "ReimbursementContract_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReimbursementContract" ADD CONSTRAINT "ReimbursementContract_rfidUserId_fkey" FOREIGN KEY ("rfidUserId") REFERENCES "RfidUser"("rfid_user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReimbursementContract" ADD CONSTRAINT "ReimbursementContract_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "ChargingStation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReimbursementContract" ADD CONSTRAINT "ReimbursementContract_tariffId_fkey" FOREIGN KEY ("tariffId") REFERENCES "Tariff"("tariff_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReimbursementLedger" ADD CONSTRAINT "ReimbursementLedger_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "ReimbursementContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleContractCertificate" ADD CONSTRAINT "VehicleContractCertificate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleContractCertificate" ADD CONSTRAINT "VehicleContractCertificate_rfidUserRfid_user_id_fkey" FOREIGN KEY ("rfidUserRfid_user_id") REFERENCES "RfidUser"("rfid_user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstalledCertificate" ADD CONSTRAINT "InstalledCertificate_chargerId_fkey" FOREIGN KEY ("chargerId") REFERENCES "Charger"("charger_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaCampaign" ADD CONSTRAINT "MediaCampaign_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "ChargingStation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaCampaign" ADD CONSTRAINT "MediaCampaign_chargeGroupId_fkey" FOREIGN KEY ("chargeGroupId") REFERENCES "ChargeGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoamingSession" ADD CONSTRAINT "RoamingSession_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "RoamingPartner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoamingSession" ADD CONSTRAINT "RoamingSession_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "ChargingStation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CDR" ADD CONSTRAINT "CDR_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "RoamingPartner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CDR" ADD CONSTRAINT "CDR_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "ChargingStation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SepaMandate" ADD CONSTRAINT "SepaMandate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SepaMandate" ADD CONSTRAINT "SepaMandate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocalAuthList" ADD CONSTRAINT "LocalAuthList_chargerId_fkey" FOREIGN KEY ("chargerId") REFERENCES "Charger"("charger_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocalAuthListEntry" ADD CONSTRAINT "LocalAuthListEntry_localAuthListId_fkey" FOREIGN KEY ("localAuthListId") REFERENCES "LocalAuthList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_chargerId_fkey" FOREIGN KEY ("chargerId") REFERENCES "Charger"("charger_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_rfidUserId_fkey" FOREIGN KEY ("rfidUserId") REFERENCES "RfidUser"("rfid_user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificateRequest" ADD CONSTRAINT "CertificateRequest_chargerId_fkey" FOREIGN KEY ("chargerId") REFERENCES "Charger"("charger_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ChargerToTariff" ADD CONSTRAINT "_ChargerToTariff_A_fkey" FOREIGN KEY ("A") REFERENCES "Charger"("charger_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ChargerToTariff" ADD CONSTRAINT "_ChargerToTariff_B_fkey" FOREIGN KEY ("B") REFERENCES "Tariff"("tariff_id") ON DELETE CASCADE ON UPDATE CASCADE;

