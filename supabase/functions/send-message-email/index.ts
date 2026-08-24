import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

// Initialize Supabase Client to fetch user details
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

serve(async (req) => {
  try {
    const body = await req.json();

    // Ensure it's an INSERT operation on the messages table
    if (body.type === "INSERT" && body.table === "messages") {
      const message = body.record;
      
      // Fetch Sender and Receiver Details
      const { data: sender } = await supabase
        .from("users")
        .select("name, email")
        .eq("id", message.sender_id)
        .single();

      const { data: receiver } = await supabase
        .from("users")
        .select("name, email")
        .eq("id", message.receiver_id)
        .single();

      if (!sender || !receiver) {
        console.error("Sender or Receiver not found.");
        return new Response("Sender or Receiver not found", { status: 400 });
      }

      // Send Email via Resend
      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "Vikramshila College ERP <noreply@vikramshilacollege.erp.in>",
          to: receiver.email,
          reply_to: sender.email,
          subject: `New Message from ${sender.name}`,
          html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333;">
              <h2 style="color: #0284c7;">You have a new message!</h2>
              <p><strong>Sender:</strong> ${sender.name} via Vikramshila College ERP</p>
              <div style="margin: 20px 0; padding: 15px; border-left: 4px solid #0284c7; background: #f0f9ff;">
                <p style="margin: 0;">${message.content}</p>
              </div>
              <p>Please log in to the ERP to reply.</p>
              <p style="font-size: 12px; color: #888;">Note: This message will be auto-deleted from the ERP after 7 days.</p>
            </div>
          `,
        }),
      });

      const resendData = await resendRes.json();
      
      if (resendRes.ok) {
         return new Response(JSON.stringify({ success: true, id: resendData.id }), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        });
      } else {
         console.error("Resend API Error:", resendData);
         return new Response(JSON.stringify({ error: resendData }), {
          headers: { "Content-Type": "application/json" },
          status: 400,
        });
      }
    }

    return new Response("Not an INSERT event on messages", { status: 200 });

  } catch (err) {
    console.error("Internal Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
