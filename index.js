const cors = require("cors");
const express = require("express")
const app = express()
const fs = require("fs")
const path = require("path")
require("dotenv").config();

const userModule = require("./data management/router/user-router.js");
const userRouter = userModule.userRouter;

const documentModule = require("./data management/router/document-router.js");
const documentRouter = documentModule.documentRouter;
const documentAttachmentModule = require("./data management/router/document_attachment-router.js");
const document_attachmentRouter =
    documentAttachmentModule.document_attachmentRouter;
const documentExtractionModule = require("./data management/router/document_extraction-router.js");
const document_extractionRouter =
    documentExtractionModule.document_extractionRouter;
const expenseModule = require("./data management/router/expense-router.js");
const expenseRouter = expenseModule.expenseRouter;
const statementModule = require("./data management/router/statement-router.js");
const statementRouter = statementModule.statementRouter;
const transactionModule = require("./data management/router/transaction-router.js");
const transactionRouter = transactionModule.transactionRouter;
const matchModule = require("./data management/router/match-router.js");
const matchRouter = matchModule.matchRouter;
const projectModule = require("./data management/router/project-router.js");
const projectRouter = projectModule.projectRouter;
const vendorModule = require("./data management/router/vendor-router.js");
const vendorRouter = vendorModule.vendorRouter;
const categoryModule = require("./data management/router/category-router.js");
const categoryRouter = categoryModule.categoryRouter;
const columnMappingModule = require("./data management/router/column_mapping-router.js");
const column_mappingRouter = columnMappingModule.column_mappingRouter;
const jobModule = require("./data management/router/job-router.js");
const jobRouter = jobModule.jobRouter;
const reportModule = require("./data management/router/report-router.js");
const reportRouter = reportModule.reportRouter;
const currencyModule = require("./data management/router/currency-router.js");
const currencyRouter = currencyModule.currencyRouter;

const auditLogModule = require("./data management/router/audit_log-router.js");
const audit_logRouter = auditLogModule.audit_logRouter;










process.on("uncaughtException", (err) => {
    console.error("UNCAUGHT: ", err);
});

process.on("unhandledRejection", (err) => {
    console.error("UNHANDLED: ", err);
});

app.use(express.json())

app.use(cors({
    origin: [
        "http://localhost:3000",
        "http://localhost:3001",
        "https://placebo-plm-js.vercel.app",
        "http://localhost:5173"
    ],
    credentials: true
}));

const server = app.listen(process.env.PORT || 5173);

server.on('listening', () => {
    console.log(`Server running on port ${process.env.PORT || 5173}`);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${process.env.PORT || 5173} is already in use. Kill the conflicting process and restart.`);
    } else {
        console.error('Server error:', err.message);
    }
    process.exit(1);
});

app.use("/api/users", userRouter)
app.use("/api/documents", documentRouter)
app.use("/api/document_attachments", document_attachmentRouter)
app.use("/api/document_extractions", document_extractionRouter)
app.use("/api/expenses", expenseRouter)
app.use("/api/statements", statementRouter)
app.use("/api/transactions", transactionRouter)
app.use("/api/matches", matchRouter)
app.use("/api/projects", projectRouter)
app.use("/api/vendors", vendorRouter)
app.use("/api/categories", categoryRouter)
app.use("/api/column_mappings", column_mappingRouter)
app.use("/api/jobs", jobRouter)
app.use("/api/reports", reportRouter)
app.use("/api/currencies", currencyRouter)

app.use("/api/audit_logs", audit_logRouter)

