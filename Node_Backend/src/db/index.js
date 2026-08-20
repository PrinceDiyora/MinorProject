import pg from "pg";
import { buildPostgresConnectionString, shouldUseSsl } from "./connection.js";

const { Pool } = pg;

const pool = new Pool({
    connectionString: buildPostgresConnectionString(process.env.DATABASE_URL),
    ...(shouldUseSsl() ? { ssl: { rejectUnauthorized: false } } : {}),
});

const connectDB = async () => {
    try {
        const client = await pool.connect();
        console.log(`\nPostgreSQL connected !! DB HOST: ${client.host}`);
        client.release();
    } catch (error) {
        console.log("POSTGRESQL connection error ", error);
        process.exit(1);
    }
}

export { pool };
export default connectDB;