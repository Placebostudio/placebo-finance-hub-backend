
require("dotenv").config();

const { Pool } = require("pg");

const url = process.env.DATABASE_URL;

const db = new Pool({
    connectionString: url
});

db.query("SELECT NOW()")
    .then(result => console.log("DATABASE CONNECTED:", result.rows[0]))
    .catch(err => console.error("DATABASE FAILED:", err.message));

module.exports = db;