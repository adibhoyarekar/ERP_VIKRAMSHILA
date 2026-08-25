import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Supabase Edge Function: purge-attendance-photos
 * 
 * Automatically deletes attendance photos older than 24 hours from Storage
 * and clears their DB references. Designed to run on a cron schedule.
 * 
 * Triggered by: Supabase pg_cron (every 24 hours) OR manual HTTP call.
 */

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

serve(async (_req) => {
  try {
    // Use service role key to bypass RLS
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // 1. Call the RPC to get expired photo URLs and clear DB references
    const { data: purgeResult, error: rpcError } = await supabase.rpc(
      "delete_old_attendance_photos"
    );

    if (rpcError) {
      console.error("RPC error:", rpcError);
      return new Response(
        JSON.stringify({ success: false, error: rpcError.message }),
        { headers: { "Content-Type": "application/json" }, status: 500 }
      );
    }

    let storageDeletedCount = 0;

    // 2. Delete actual files from Storage via the Storage API
    if (purgeResult?.photo_urls_to_delete?.length > 0) {
      const photoUrls: string[] = purgeResult.photo_urls_to_delete;

      // Supabase storage.remove() accepts max ~100 files at a time
      const BATCH_SIZE = 100;
      for (let i = 0; i < photoUrls.length; i += BATCH_SIZE) {
        const batch = photoUrls.slice(i, i + BATCH_SIZE);
        const { error: deleteError } = await supabase.storage
          .from("attendance_photos")
          .remove(batch);

        if (deleteError) {
          console.warn(`Storage delete batch ${i} warning:`, deleteError);
        } else {
          storageDeletedCount += batch.length;
        }
      }
    }

    const result = {
      success: true,
      cleared_db_records: purgeResult?.cleared_records ?? 0,
      deleted_storage_files: storageDeletedCount,
      timestamp: new Date().toISOString(),
    };

    console.log("Purge completed:", result);

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("Purge error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { headers: { "Content-Type": "application/json" }, status: 500 }
    );
  }
});
