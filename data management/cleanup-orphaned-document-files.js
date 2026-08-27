const db = require("../db_connection");
const supabase = require("../supabase");

const BUCKET_NAME = "files";

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
            limit: 1000
        });

    if (error) {
        throw error;
    }

    const files = [];

    for (const item of data || []) {

        const path = folder
            ? `${folder}/${item.name}`
            : item.name;


        // ----------------------------------------------------
        // Folder
        // ----------------------------------------------------

        if (!item.id) {

            const nestedFiles =
                await getAllStorageFiles(path);

            files.push(...nestedFiles);

        }

        // ----------------------------------------------------
        // File
        // ----------------------------------------------------

        else {

            files.push(path);
        }
    }

    return files;
}


// ============================================================
// CLEANUP ORPHANED DOCUMENT FILES
// ============================================================

async function cleanupOrphanedDocumentFiles() {

    try {

        console.log(
            "Starting orphaned document file cleanup..."
        );


        // ====================================================
        // 1. GET ALL STORAGE PATHS REFERENCED BY DOCUMENTS
        // ====================================================

        const result = await db.query(`
            SELECT storage_path
            FROM documents
            WHERE storage_path IS NOT NULL
        `);


        const connectedPaths = new Set(
            result.rows
                .map(row => row.storage_path)
                .filter(Boolean)
        );


        console.log(
            `Found ${connectedPaths.size} document storage references`
        );


        // ====================================================
        // 2. GET EVERY FILE FROM SUPABASE STORAGE
        // ====================================================

        const storageFiles =
            await getAllStorageFiles();


        console.log(
            `Found ${storageFiles.length} files in storage`
        );


        // ====================================================
        // 3. FIND FILES THAT ARE NOT REFERENCED BY ANY
        //    DOCUMENT
        // ====================================================

        const orphanedFiles =
            storageFiles.filter(
                filePath =>
                    !connectedPaths.has(filePath)
            );


        console.log(
            `Found ${orphanedFiles.length} orphaned files`
        );


        // ====================================================
        // 4. DELETE ORPHANED FILES
        // ====================================================

        if (orphanedFiles.length === 0) {

            console.log(
                "No orphaned document files found."
            );

            return;
        }


        // Supabase Storage remove accepts up to 1000 paths
        // at a time, so process in batches.

        for (
            let i = 0;
            i < orphanedFiles.length;
            i += 1000
        ) {

            const batch =
                orphanedFiles.slice(
                    i,
                    i + 1000
                );


            const {
                error
            } = await supabase.storage
                .from(BUCKET_NAME)
                .remove(batch);


            if (error) {
                throw error;
            }


            console.log(
                `Deleted ${batch.length} orphaned files`
            );
        }


        console.log(
            "Orphaned document file cleanup completed."
        );

    } catch (err) {

        console.error(
            "Orphaned document file cleanup failed:",
            err
        );
    }
}


module.exports =
    cleanupOrphanedDocumentFiles;