const { Pool } = require("pg");
require("dotenv").config();

/* Postgresql pool setup */

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASS,
    port: process.env.DB_PORT,
    ssl: {
        rejectUnauthorized: false,
    },
});

const makeDBRequest = async (queryStr, queryVar) => {
    const client = await pool.connect();
    return new Promise((resolve, reject) => {
        client
            .query(queryStr, queryVar)
            .then(resolve)
            .catch(reject)
            .finally(client.release);
    });
};

module.exports = makeDBRequest;
