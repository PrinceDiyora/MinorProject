import { URL } from "node:url";

export function buildPostgresConnectionString(databaseUrl, defaultDatabase = "postgres") {
  if (!databaseUrl || !databaseUrl.trim()) {
    throw new Error("DATABASE_URL is not set");
  }

  const trimmed = databaseUrl.trim().replace(/\/+$/, "");

  try {
    const parsed = new URL(trimmed);
    const pathname = parsed.pathname.replace(/^\/+/, "");

    if (!pathname) {
      parsed.pathname = `/${defaultDatabase}`;
    }

    return parsed.toString().replace(/\/+$/, "");
  } catch {
    if (trimmed.includes("/")) {
      return trimmed;
    }

    return `${trimmed}/${defaultDatabase}`;
  }
}

export function getPostgresDatabaseName(databaseUrl, fallback = "postgres") {
  if (!databaseUrl || !databaseUrl.trim()) {
    return fallback;
  }

  const trimmed = databaseUrl.trim().replace(/\/+$/, "");

  try {
    const parsed = new URL(trimmed);
    const pathname = parsed.pathname.replace(/^\/+/, "");
    return pathname || fallback;
  } catch {
    const parts = trimmed.split("/").filter(Boolean);
    return parts.length > 0 ? parts[parts.length - 1] : fallback;
  }
}

export function buildMaintenanceConnectionString(databaseUrl, maintenanceDatabase = "postgres") {
  const maintenanceUrl = new URL(buildPostgresConnectionString(databaseUrl, maintenanceDatabase));
  maintenanceUrl.pathname = `/${maintenanceDatabase}`;
  return maintenanceUrl.toString().replace(/\/+$/, "");
}

export function shouldUseSsl() {
  const sslSetting = String(process.env.DATABASE_SSL || process.env.PGSSLMODE || "").toLowerCase();
  return sslSetting === "true" || sslSetting === "1" || sslSetting === "require";
}