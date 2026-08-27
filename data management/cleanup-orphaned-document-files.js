const db = require("../db_connection");
const supabase = require("../supabase");

const BUCKET_NAME = "finance-hub";

// ============================================================
// GET ALL FILES RECURSIVELY FROM SUPABASE STORAGE
// ============================================================

async function getAllStorageFiles(folder = "") {

    const {
        data,
        error
    } = await supabase.storage
        .from(BUCKET_NAME)
        .list(folder, {
            limit: 1000,
            offset: 0,
            sortBy: {
                column: "name",
                order: "asc"
            }
        });


    if (error) {

        throw new Error(
            `Failed to list Storage folder "${folder}": ${error.message}`
        );
    }


    const files = [];


    for (const item of data || []) {

        const currentPath =
            folder
                ? `${folder}/${item.name}`
                : item.name;


        // ========================================================
        // SUPABASE STORAGE
        //
        // FOLDERS:
        // metadata is null
        //
        // FILES:
        // metadata contains file information
        // ========================================================

        if (item.metadata === null) {

            console.log(
                `Entering folder: ${currentPath}`
            );


            const nestedFiles =
                await getAllStorageFiles(
                    currentPath
                );


            files.push(
                ...nestedFiles
            );

        } else {

            console.log(
                `Found file: ${currentPath}`
            );


            files.push(
                currentPath
            );
        }
    }


    return files;
}


// ============================================================
// GET DATABASE STORAGE PATHS
// ============================================================

async function getDocumentStoragePaths(db) {

    const result =
        await db.query(
            `
            SELECT storage_path
            FROM documents
            WHERE storage_path IS NOT NULL
              AND TRIM(storage_path) <> ''
            `
        );


    return new Set(
        result.rows
            .map(
                row =>
                    normalizePath(
                        row.storage_path
                    )
            )
            .filter(Boolean)
    );
}


// ============================================================
// NORMALIZE PATH
// ============================================================

function normalizePath(path) {

    if (!path) {
        return null;
    }


    return String(path)
        .trim()
        .replace(/^\/+/, "")
        .replace(/\/+/g, "/");
}


// ============================================================
// CLEANUP
// ============================================================

async function cleanupOrphanedDocumentFiles(db) {

    console.log(
        "=========================================="
    );

    console.log(
        "Starting orphaned document file cleanup"
    );

    console.log(
        "=========================================="
    );


    // ========================================================
    // DATABASE
    // ========================================================

    const documentPaths =
        await getDocumentStoragePaths(db);


    console.log(
        `Found ${documentPaths.size} document storage references`
    );


    // ========================================================
    // STORAGE
    // ========================================================

    const storageFiles =
        await getAllStorageFiles();


    console.log(
        `Found ${storageFiles.length} files in Storage`
    );


    // ========================================================
    // COMPARE
    // ========================================================

    const orphanedFiles =
        storageFiles.filter(
            storagePath =>
                !documentPaths.has(
                    normalizePath(
                        storagePath
                    )
                )
        );


    console.log(
        `Found ${orphanedFiles.length} orphaned files`
    );


    // ========================================================
    // NOTHING TO DELETE
    // ========================================================

    if (orphanedFiles.length === 0) {

        console.log(
            "No orphaned files to clean."
        );


        return {
            scanned: storageFiles.length,
            referenced: documentPaths.size,
            orphaned: 0,
            deleted: 0
        };
    }


    // ========================================================
    // SHOW ORPHANS
    // ========================================================

    console.log(
        "Files that will be deleted:"
    );


    for (const file of orphanedFiles) {

        console.log(
            `  - ${file}`
        );
    }


    // ========================================================
    // DELETE IN BATCHES
    // ========================================================

    const BATCH_SIZE = 100;

    let deletedCount = 0;


    for (
        let i = 0;
        i < orphanedFiles.length;
        i += BATCH_SIZE
    ) {

        const batch =
            orphanedFiles.slice(
                i,
                i + BATCH_SIZE
            );


        const {
            data,
            error
        } = await supabase.storage
            .from(BUCKET_NAME)
            .remove(batch);


        if (error) {

            console.error(
                "Storage deletion failed:",
                error
            );

            continue;
        }


        const removedCount =
            data?.length ??
            batch.length;


        deletedCount +=
            removedCount;


        console.log(
            `Deleted ${removedCount} files`
        );
    }


    // ========================================================
    // RESULT
    // ========================================================

    console.log(
        "=========================================="
    );

    console.log(
        `Cleanup complete. Deleted ${deletedCount} files.`
    );

    console.log(
        "=========================================="
    );


    return {
        scanned: storageFiles.length,
        referenced: documentPaths.size,
        orphaned: orphanedFiles.length,
        deleted: deletedCount
    };
}


module.exports = {
    cleanupOrphanedDocumentFiles,
    getAllStorageFiles
};